import datetime
import os.path
from typing import Literal
from urllib import parse

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Exists, Max, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from ninja import File, Form, Router, Schema
from ninja.files import UploadedFile

from categories.models import Category
from documents.models import (
    Comment,
    Document,
    DocumentFile,
    DocumentType,
    generate_api_key,
)
from myauth import auth_check
from myauth.models import get_my_user
from notifications import notification_util
from util import s3_util
from util.response import ErrorSchema, not_allowed, not_possible, unsupported_media_type
from util.schemas import ValueWrapped

router = Router(tags=["Documents"])


class DocumentTypeListSchema(ValueWrapped[list[str]]):
    pass


class DocumentCommentSchema(Schema):
    oid: int
    text: str
    authorId: str
    authorDisplayName: str
    canEdit: bool
    time: datetime.datetime
    edittime: datetime.datetime
    isFlagged: bool
    flaggedCount: int
    isMarkedAsAi: bool
    markedAsAiCount: int


class CommentListSchema(ValueWrapped[list[DocumentCommentSchema]]):
    pass


class CreateDocumentCommentSchema(Schema):
    text: str


class UpdateDocumentCommentSchema(Schema):
    text: str | None = None


class SetDocumentCommentFlaggedSchema(Schema):
    flagged: bool


class SetDocumentCommentMarkedAsAiSchema(Schema):
    marked_as_ai: bool


class MoveDocumentFileSchema(Schema):
    direction: Literal["down"] | Literal["up"]


class DocumentCommentWrappedSchema(ValueWrapped[DocumentCommentSchema]):
    pass


class DocumentFileSchema(Schema):
    oid: int
    display_name: str
    filename: str
    mime_type: str
    order: int


class DocumentFileListSchema(ValueWrapped[list[DocumentFileSchema]]):
    pass


class CreateDocumentFileSchema(Schema):
    display_name: str


class UpdateDocumentFileSchema(Schema):
    display_name: str | None = None


class DocumentFileWrappedSchema(ValueWrapped[DocumentFileSchema]):
    pass


class DeleteDocumentFileResponse(ValueWrapped[bool]):
    pass


class DocumentSchema(Schema):
    slug: str
    display_name: str
    description: str
    category: str
    document_type: str
    category_display_name: str
    author: str
    author_displayname: str
    can_edit: bool
    can_delete: bool
    time: datetime.datetime
    edittime: datetime.datetime
    like_count: int | None = None
    liked: int | None = None
    api_key: str | None = None
    comments: list[DocumentCommentSchema] | None = None
    files: list[DocumentFileSchema] | None = None


class DocumentListSchema(ValueWrapped[list[DocumentSchema]]):
    pass


class CreateDocumentSchema(Schema):
    display_name: str
    category: str
    # description is optional
    description: str = ""


class UpdateDocumentSchema(Schema):
    liked: bool | None = None
    description: str | None = None
    display_name: str | None = None
    category: str | None = None
    document_type: str | None = None


class DocumentWrappedSchema(ValueWrapped[DocumentSchema]):
    pass


class DeleteDocumentResponse(ValueWrapped[bool]):
    pass


def user_liked(request):
    return Count("likes", filter=Q(likes__pk=request.user.pk))


like_count = Count("likes")


def prep_comment_obj(comment: Comment, request):
    comment.flagged_count = comment.flagged.count()
    comment.is_flagged = comment.flagged.filter(id=request.user.id).exists()
    comment.marked_as_ai_count = comment.marked_as_ai.count()
    comment.is_marked_as_ai = comment.marked_as_ai.filter(id=request.user.id).exists()
    return comment


def make_comment_response(comment, request):
    return DocumentCommentSchema(
        oid=comment.pk,
        text=comment.text,
        authorId=comment.author.username,
        authorDisplayName=get_my_user(comment.author).displayname(),
        canEdit=comment.current_user_can_edit(request),
        time=comment.time,
        edittime=comment.edittime,
        isFlagged=comment.is_flagged,
        flaggedCount=comment.flagged_count,
        isMarkedAsAi=comment.is_marked_as_ai,
        markedAsAiCount=comment.marked_as_ai_count,
    )


def make_file_response(file):
    return DocumentFileSchema(
        oid=file.pk,
        display_name=file.display_name,
        filename=file.filename,
        mime_type=file.mime_type,
        order=file.order,
    )


def make_document_response(
    document, request, include_comments=False, include_files=False
):
    return DocumentSchema(
        slug=document.slug,
        display_name=document.display_name,
        description=document.description,
        category=document.category.slug,
        document_type=document.document_type.display_name,
        category_display_name=document.category.displayname,
        author=document.author.username,
        author_displayname=get_my_user(document.author).displayname(),
        can_edit=document.current_user_can_edit(request),
        can_delete=document.current_user_can_delete(request),
        time=document.time,
        edittime=document.edittime,
        like_count=getattr(document, "like_count", None),
        liked=getattr(document, "liked", None),
        api_key=document.api_key if document.current_user_can_edit(request) else None,
        comments=[make_comment_response(c, request) for c in document.comments.all()]
        if include_comments
        else None,
        files=[make_file_response(f) for f in document.files.all()]
        if include_files
        else None,
    )


@router.get(
    "/listdocumenttypes/",
    response=DocumentTypeListSchema,
    operation_id="listDocumentTypes",
)
@auth_check.require_login
def list_document_types(request):
    return {
        "value": DocumentType.objects.values_list("display_name", flat=True).order_by(
            "order"
        )
    }


@router.get(
    "/",
    response={200: DocumentListSchema, 403: ErrorSchema},
    operation_id="listDocuments",
)
@auth_check.require_login
def list_documents(
    request,
    liked_by: str | None = None,
    username: str | None = None,
    category: str | None = None,
    document_type: str | None = None,
    include_comments: bool = False,
    include_files: bool = False,
):
    objects = Document.objects.annotate(
        like_count=like_count,
        liked=user_liked(request),
    ).select_related("category", "author")

    if document_type is not None:
        objects = objects.filter(document_type__display_name=document_type)

    if liked_by is not None:
        if liked_by == request.user.username:
            # to ensure one can only view their own liked documents
            objects = objects.filter(likes__username=request.user.username)
        else:
            return not_allowed()
    elif username is not None:
        objects = objects.filter(author__username=username)
    elif category is not None:
        objects = objects.filter(category__slug=category)
    else:  # if nothing is given, we return an empty result instead of giving back everything
        return {
            "value": [],
        }

    if include_comments:
        comments_query = Comment.objects.annotate(
            flagged_count=Count("flagged", distinct=True),
            is_flagged=Exists(
                Comment.objects.filter(id=OuterRef("id"), flagged=request.user)
            ),
            marked_as_ai_count=Count("marked_as_ai", distinct=True),
            is_marked_as_ai=Exists(
                Comment.objects.filter(id=OuterRef("id"), marked_as_ai=request.user)
            ),
        )
        objects = objects.prefetch_related(
            Prefetch(
                "comments",
                queryset=comments_query,
            )
        )

    if include_files:
        objects = objects.prefetch_related("files")

    res = [
        make_document_response(document, request, include_comments, include_files)
        for document in objects.all()
    ]
    return {
        "value": res,
    }


@router.post(
    "/",
    response={200: DocumentWrappedSchema, 400: ErrorSchema},
    operation_id="createDocument",
)
@auth_check.require_login
def create_document(request, data: CreateDocumentSchema = Form(...)):  # noqa: B008
    category = get_object_or_404(Category, slug=data.category)
    if slugify(parse.quote(data.display_name, " ")).strip() == "":
        return not_possible("Invalid displayname")

    document = Document(
        display_name=data.display_name,
        description=data.description,
        category=category,
        author=request.user,
        document_type=DocumentType.objects.get(display_name="Documents"),
    )
    document.save()

    return {
        "value": make_document_response(document, request),
    }


@router.get(
    "/{username}/{slug}/",
    response={200: DocumentWrappedSchema},
    operation_id="getDocument",
)
@auth_check.require_login
def get_document(
    request,
    username: str,
    slug: str,
    include_comments: bool = False,
    include_files: bool = False,
):
    objects = Document.objects.prefetch_related("category", "author").annotate(
        like_count=like_count,
        liked=user_liked(request),
    )
    if include_comments:
        comments_query = Comment.objects.annotate(
            flagged_count=Count("flagged", distinct=True),
            is_flagged=Exists(
                Comment.objects.filter(id=OuterRef("id"), flagged=request.user)
            ),
            marked_as_ai_count=Count("marked_as_ai", distinct=True),
            is_marked_as_ai=Exists(
                Comment.objects.filter(id=OuterRef("id"), marked_as_ai=request.user)
            ),
        )
        objects = objects.prefetch_related(
            Prefetch(
                "comments",
                queryset=comments_query,
            )
        )

    if include_files:
        objects = objects.prefetch_related("files")

    document = get_object_or_404(objects, author__username=username, slug=slug)

    return {
        "value": make_document_response(
            document, request, include_comments, include_files
        )
    }


@router.put(
    "/{username}/{slug}/",
    response={200: DocumentWrappedSchema, 400: ErrorSchema, 403: ErrorSchema},
    operation_id="updateDocument",
    exclude_none=True,
)
@auth_check.require_login
def update_document(
    request,
    username: str,
    slug: str,
    data: UpdateDocumentSchema = Form(None),  # noqa: B008
):
    document = get_object_or_404(Document, author__username=username, slug=slug)

    update_data = data.dict(exclude_unset=True) if data else {}

    if "liked" in update_data:
        if update_data["liked"]:
            document.likes.add(request.user)
        else:
            document.likes.remove(request.user)

    can_edit = document.current_user_can_edit(request)
    edited = False

    if "description" in update_data:
        if not can_edit:
            return not_allowed()
        document.description = update_data["description"]
        edited = True

    if "display_name" in update_data:
        if not can_edit:
            return not_allowed()
        # avoids empty or whitespaced displaynames
        if slugify(parse.quote(update_data["display_name"], " ")).strip() == "":
            return not_possible("Invalid displayname")
        document.display_name = update_data["display_name"]
        edited = True

    if "category" in update_data:
        if not can_edit:
            return not_allowed()
        category = get_object_or_404(Category, slug=update_data["category"])
        document.category = category
        edited = True

    if "document_type" in update_data:
        if not can_edit:
            return not_allowed()
        old_document_type = document.document_type
        document.document_type, _ = DocumentType.objects.get_or_create(
            display_name=update_data["document_type"]
        )
        document.save()
        if old_document_type.id > 4 and not old_document_type.type_set.exists():
            old_document_type.delete()
        edited = True

    if edited:
        document.edittime = timezone.now()
        document.save()

    return {
        "value": make_document_response(document, request),
    }


@router.delete(
    "/{username}/{slug}/",
    response={200: DeleteDocumentResponse, 403: ErrorSchema},
    operation_id="deleteDocument",
)
@auth_check.require_login
def delete_document(request, username: str, slug: str):
    objects = Document.objects.prefetch_related("author")
    document = get_object_or_404(objects, author__username=username, slug=slug)
    if not document.current_user_can_delete(request):
        return not_allowed()

    filenames = [document_file.filename for document_file in document.files.all()]
    success = s3_util.delete_files(settings.COMSOL_DOCUMENT_DIR, filenames)
    document.delete()
    return {
        "value": success,
    }


@router.get(
    "/{username}/{slug}/comments/",
    response={200: CommentListSchema},
    operation_id="listDocumentComments",
)
@auth_check.require_login
def list_document_comments(request, username: str, slug: str):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    objects = (
        Comment.objects.filter(document=document)
        .all()
        .annotate(
            flagged_count=Count("flagged", distinct=True),
            is_flagged=Exists(
                Comment.objects.filter(id=OuterRef("id"), flagged=request.user)
            ),
            marked_as_ai_count=Count("marked_as_ai", distinct=True),
            is_marked_as_ai=Exists(
                Comment.objects.filter(id=OuterRef("id"), marked_as_ai=request.user)
            ),
        )
    )
    return {
        "value": [make_comment_response(comment, request) for comment in objects],
    }


@router.post(
    "/{username}/{slug}/comments/",
    response={200: DocumentCommentWrappedSchema, 400: ErrorSchema},
    operation_id="createDocumentComment",
)
@auth_check.require_login
def create_document_comment(
    request,
    username: str,
    slug: str,
    data: CreateDocumentCommentSchema = Form(...),  # noqa: B008
):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    comment = Comment(document=document, text=data.text, author=request.user)
    comment.save()
    notification_util.new_comment_to_document(document, comment)

    comment = prep_comment_obj(comment, request)
    return {
        "value": make_comment_response(comment, request),
    }


@router.get(
    "/{username}/{slug}/comments/{id}/",
    response={200: DocumentCommentSchema},
    operation_id="getDocumentComment",
)
@auth_check.require_login
def get_document_comment(request, username: str, slug: str, id: int):
    comment = get_object_or_404(
        Comment,
        pk=id,
        document__author__username=username,
        document__slug=slug,
    )
    comment = prep_comment_obj(comment, request)
    return make_comment_response(comment, request)


@router.put(
    "/{username}/{slug}/comments/{id}/",
    response={200: DocumentCommentWrappedSchema, 403: ErrorSchema},
    operation_id="updateDocumentComment",
)
@auth_check.require_login
def update_document_comment(
    request,
    username: str,
    slug: str,
    id: int,
    data: UpdateDocumentCommentSchema = Form(None),  # noqa: B008
):
    objects = Comment.objects.prefetch_related("author")
    comment = get_object_or_404(
        objects,
        pk=id,
        document__author__username=username,
        document__slug=slug,
    )
    if not comment.current_user_can_edit(request):
        return not_allowed()

    update_data = data.dict(exclude_unset=True) if data else {}
    if "text" in update_data:
        comment.text = update_data["text"]
        comment.edittime = timezone.now()
    comment.save()

    comment = prep_comment_obj(comment, request)
    return {
        "value": make_comment_response(comment, request),
    }


@router.delete(
    "/{username}/{slug}/comments/{id}/",
    response={204: None, 403: ErrorSchema},
    operation_id="deleteDocumentComment",
)
@auth_check.require_login
def delete_document_comment(request, username: str, slug: str, id: int):
    objects = Comment.objects.prefetch_related("author")
    comment = get_object_or_404(
        objects,
        pk=id,
        document__author__username=username,
        document__slug=slug,
    )
    if not comment.current_user_can_delete(request):
        return not_allowed()
    comment.delete()
    return 204, None


@router.get(
    "/{username}/{slug}/files/",
    response={200: DocumentFileListSchema},
    operation_id="listDocumentFiles",
)
@auth_check.require_login
def list_document_files(request, username: str, slug: str):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    objects = DocumentFile.objects.filter(document=document).all()
    return {
        "value": [make_file_response(file) for file in objects],
    }


@router.post(
    "/{username}/{slug}/files/",
    response={
        200: DocumentFileWrappedSchema,
        400: ErrorSchema,
        403: ErrorSchema,
        415: ErrorSchema,
    },
    operation_id="createDocumentFile",
)
@auth_check.require_login
def create_document_file(
    request,
    username: str,
    slug: str,
    data: CreateDocumentFileSchema = Form(...),  # noqa: B008
    file: UploadedFile = File(...),  # noqa: B008
):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if not document.current_user_can_edit(request):
        return not_allowed()

    if slugify(parse.quote(data.display_name, " ")).strip() == "":
        return not_possible("Invalid displayname")

    _, ext = os.path.splitext(file.name)

    max_order = (
        DocumentFile.objects.filter(document=document)
        .all()
        .aggregate(max_order=Max("order"))["max_order"]
    )
    new_order = (
        0
        if DocumentFile.objects.filter(document=document).count() == 0
        else max_order + 1
    )

    filename = s3_util.generate_filename(16, settings.COMSOL_DOCUMENT_DIR, ext)
    document_file = DocumentFile(
        display_name=data.display_name,
        document=document,
        filename=filename,
        mime_type=file.content_type,
        order=new_order,
    )
    document_file.save()

    s3_util.save_uploaded_file_to_s3(
        settings.COMSOL_DOCUMENT_DIR, filename, file, file.content_type
    )

    document.edittime = timezone.now()
    document.save()

    return {
        "value": make_file_response(document_file),
    }


@router.get(
    "/{username}/{slug}/files/{id}/",
    response={200: DocumentFileWrappedSchema},
    operation_id="getDocumentFileMeta",
)
@auth_check.require_login
def get_document_file_meta(request, username: str, slug: str, id: int):
    document_file = get_object_or_404(
        DocumentFile,
        pk=id,
        document__author__username=username,
        document__slug=slug,
    )
    return {
        "value": make_file_response(document_file),
    }


@router.put(
    "/{username}/{slug}/files/{id}/",
    response={
        200: DocumentFileWrappedSchema,
        400: ErrorSchema,
        403: ErrorSchema,
        415: ErrorSchema,
    },
    operation_id="updateDocumentFile",
)
@auth_check.require_login
def update_document_file(
    request,
    username: str,
    slug: str,
    id: int,
    data: UpdateDocumentFileSchema = Form(None),  # noqa: B008
    file: UploadedFile = File(None),  # noqa: B008
):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if not document.current_user_can_edit(request):
        return not_allowed()

    document_file = get_object_or_404(
        DocumentFile,
        pk=id,
        document=document,
    )

    update_data = data.dict(exclude_unset=True) if data else {}
    if "display_name" in update_data:
        if slugify(parse.quote(update_data["display_name"], " ")).strip() == "":
            return not_possible("Invalid displayname")
        document_file.display_name = update_data["display_name"]

    if file:
        _, ext = os.path.splitext(file.name)

        if not document_file.filename.endswith(ext):
            s3_util.delete_file(settings.COMSOL_DOCUMENT_DIR, document_file.filename)
            filename = s3_util.generate_filename(16, settings.COMSOL_DOCUMENT_DIR, ext)
            document_file.filename = filename
            document_file.mime_type = file.content_type

        s3_util.save_uploaded_file_to_s3(
            settings.COMSOL_DOCUMENT_DIR,
            document_file.filename,
            file,
            document_file.mime_type,
        )

    document_file.save()
    document.edittime = timezone.now()
    document.save()

    return {
        "value": make_file_response(document_file),
    }


@router.delete(
    "/{username}/{slug}/files/{id}/",
    response={200: DeleteDocumentFileResponse, 403: ErrorSchema},
    operation_id="deleteDocumentFile",
)
@auth_check.require_login
def delete_document_file(request, username: str, slug: str, id: int):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if not document.current_user_can_edit(request):
        return not_allowed()

    document_file = get_object_or_404(
        DocumentFile,
        pk=id,
        document=document,
    )

    document_file.delete()
    success = s3_util.delete_file(
        settings.COMSOL_DOCUMENT_DIR,
        document_file.filename,
    )

    document.edittime = timezone.now()
    document.save()

    return {
        "value": success,
    }


@router.post(
    "/setflaggedcomment/{id}",
    response={200: DocumentCommentWrappedSchema},
    operation_id="setFlaggedComment",
)
@auth_check.require_login
def set_flagged_comment(
    request,
    id: int,
    data: SetDocumentCommentFlaggedSchema = Form(...),  # noqa: B008
):
    comment = get_object_or_404(Comment, pk=id)
    old_flagged = comment.flagged.filter(pk=request.user.pk).exists()
    if data.flagged != old_flagged:
        if old_flagged:
            comment.flagged.remove(request.user)
        else:
            comment.flagged.add(request.user)
        comment.save()
    return {
        "value": make_comment_response(prep_comment_obj(comment, request), request),
    }


@router.post(
    "/setmarkedasaicomment/{id}",
    response={200: DocumentCommentWrappedSchema},
    operation_id="setCommentMarkedAsAi",
)
@auth_check.require_login
def set_marked_as_ai(
    request,
    id: int,
    data: SetDocumentCommentMarkedAsAiSchema = Form(...),  # noqa: B008
):
    comment = get_object_or_404(Comment, pk=id)
    old_marked_as_ai = comment.marked_as_ai.filter(pk=request.user.pk).exists()
    if data.marked_as_ai != old_marked_as_ai:
        if old_marked_as_ai:
            comment.marked_as_ai.remove(request.user)
        else:
            comment.marked_as_ai.add(request.user)
        comment.save()
    return {
        "value": make_comment_response(prep_comment_obj(comment, request), request),
    }


@router.post(
    "/resetflaggedcomment/{id}",
    response={200: DocumentCommentWrappedSchema},
    operation_id="resetFlaggedComment",
)
@auth_check.require_admin
def reset_flagged_comment(request, id: int):
    comment = get_object_or_404(Comment, pk=id)
    comment.flagged.clear()
    comment.save()
    return {
        "value": make_comment_response(prep_comment_obj(comment, request), request),
    }


@router.post(
    "/resetmarkedasaicomment/{id}",
    response={200: DocumentCommentWrappedSchema},
    operation_id="resetCommentMarkedAsAi",
)
@auth_check.require_admin
def reset_comment_marked_as_ai(request, id: int):
    comment = get_object_or_404(Comment, pk=id)
    comment.marked_as_ai.clear()
    comment.save()
    return {
        "value": make_comment_response(prep_comment_obj(comment, request), request),
    }


@router.post(
    "/{username}/{slug}/regenerate_api_key/",
    response={200: DocumentWrappedSchema, 403: ErrorSchema},
    operation_id="regenerateDocumentApiKey",
    exclude_none=True,
)
@auth_check.require_login
def regenerate_document_api_key(request, username: str, slug: str):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if not document.current_user_can_edit(request):
        return not_allowed()
    document.api_key = generate_api_key()
    document.save()
    return {
        "value": make_document_response(document, request),
    }


@router.get(
    path="/file/{filename}",
    operation_id="getDocumentFile",
)
def get_document_file(request, filename):
    document_file = get_object_or_404(DocumentFile, filename=filename)
    _, ext = os.path.splitext(document_file.filename)
    attachment_filename = document_file.display_name + ext
    return s3_util.send_file(
        settings.COMSOL_DOCUMENT_DIR,
        filename,
        as_attachment=True,
        attachment_filename=attachment_filename,
    )


@router.post(
    "/{username}/{slug}/files/{id}/update/",
    response={204: None, 403: ErrorSchema, 415: ErrorSchema},
    operation_id="updateDocumentFileContent",
    tags=["frontend-exclude"],
)
@csrf_exempt
def update_document_file_content(
    request,
    username: str,
    slug: str,
    id: int,
    file: UploadedFile = File(...),  # noqa: B008
):
    token = request.headers.get("Authorization", "")
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if document.api_key != token:
        return 403, {"error": "invalid authorization token"}

    document_file = get_object_or_404(
        DocumentFile,
        document__pk=document.pk,
        pk=id,
    )

    _, ext = os.path.splitext(file.name)

    changed = False

    if file.content_type != document_file.mime_type:
        document_file.mime_type = file.content_type
        changed = True

    if not document_file.filename.endswith(ext):
        s3_util.delete_file(settings.COMSOL_DOCUMENT_DIR, document_file.filename)
        filename = s3_util.generate_filename(16, settings.COMSOL_DOCUMENT_DIR, ext)
        document_file.filename = filename
        changed = True

    if changed:
        document_file.save()

    s3_util.save_uploaded_file_to_s3(
        settings.COMSOL_DOCUMENT_DIR,
        document_file.filename,
        file,
        document_file.mime_type,
    )

    document.edittime = timezone.now()
    document.save()

    return 204, None


@router.post(
    "/{username}/{slug}/files/{filename}/move/",
    response={204: None, 403: ErrorSchema},
    operation_id="moveDocumentFile",
)
@auth_check.require_login
def move_document_file(
    request,
    username: str,
    slug: str,
    filename: str,
    data: MoveDocumentFileSchema = Form(...),  # noqa: B008
):
    document = get_object_or_404(Document, author__username=username, slug=slug)
    if not document.current_user_can_edit(request):
        return not_allowed()

    direction = -1 if data.direction == "up" else 1

    file = get_object_or_404(DocumentFile, filename=filename)
    moved_file = get_object_or_404(
        DocumentFile, document=document, order=file.order + direction
    )
    file.order += direction
    moved_file.order -= direction

    with transaction.atomic():
        file.save()
        moved_file.save()

    return 204, None
