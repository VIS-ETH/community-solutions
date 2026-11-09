from django.conf import settings
from django.shortcuts import get_object_or_404
from ninja import File, Form, Router, Schema, UploadedFile

from answers.models import Exam
from categories.models import Category
from filestore.models import Attachment
from myauth import auth_check
from util import s3_util
from util.response import not_possible
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Filestore"])


class FilestoreUploadSchema(Schema):
    displayname: str
    category: str | None = None
    exam: str | None = None


class FilestoreUploadResult(Schema):
    filename: str


@router.post(
    "upload/",
    response={
        200: ValueWrapped[FilestoreUploadResult],
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="uploadAttachment",
)
@auth_check.require_admin
def upload_attachment(
    request,
    data: Form[FilestoreUploadSchema],
    file: File[UploadedFile],
):
    ext = s3_util.check_filename(
        file.name, settings.COMSOL_FILESTORE_ALLOWED_EXTENSIONS
    )
    if not ext:
        return not_possible("Invalid file extension.")

    if (data.category is None) == (data.exam is None):
        return not_possible("Provide exactly one of 'category' or 'exam'.")

    filename = s3_util.generate_filename(16, settings.COMSOL_FILESTORE_DIR, "." + ext)
    att = Attachment(filename=filename, displayname=data.displayname)

    if data.category is not None:
        att.category = get_object_or_404(Category, slug=data.category)
    else:
        att.exam = get_object_or_404(Exam, filename=data.exam)

    att.save()
    s3_util.save_uploaded_file_to_s3(settings.COMSOL_FILESTORE_DIR, filename, file)

    return {
        "value": FilestoreUploadResult(filename=filename),
    }


class FilestoreEditSchema(Schema):
    displayname: str


@router.patch(
    "edit/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="editAttachment",
)
@auth_check.require_admin
def edit_attachment(request, filename: str, data: Form[FilestoreEditSchema]):
    att = get_object_or_404(Attachment, filename=filename)
    att.displayname = data.displayname
    att.save()


@router.delete(
    "remove/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeAttachment",
)
@auth_check.require_admin
def remove_attachment(request, filename: str):
    att = get_object_or_404(Attachment, filename=filename)
    att.delete()
    s3_util.delete_file(settings.COMSOL_FILESTORE_DIR, filename)


@router.get("get/{filename}/", operation_id="getAttachment")
def get_attachment(request, filename: str):
    get_object_or_404(Attachment, filename=filename)
    return s3_util.send_file(
        settings.COMSOL_FILESTORE_DIR, filename, attachment_filename=filename
    )
