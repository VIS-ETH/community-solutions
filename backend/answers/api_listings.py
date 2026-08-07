import datetime

from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from ninja import Query, Router, Schema

from answers import section_util
from answers.models import Answer, Comment, Exam, ExamType
from answers.section_util import AnswerSchema, SingleCommentSchema
from documents.models import Comment as DocumentComment
from myauth import auth_check
from myauth.models import MyUser
from users.api import UserSchema
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Answers"])


@router.get(
    "/listexamtypes/",
    response={
        200: ValueWrapped[list[str]],
        401: ErrorSchema,
    },
    operation_id="listExamTypes",
)
@auth_check.require_login
def list_exam_types(request):
    return {
        "value": ExamType.objects.values_list("displayname", flat=True),
    }


@router.get(
    "/listexams/",
    response={
        200: ValueWrapped[list[str]],
        401: ErrorSchema,
    },
    operation_id="listExams",
)
@auth_check.require_login
def list_exams(request):
    return {
        "value": Exam.objects.values_list("filename", flat=True),
    }


class ListImportExamsSchema(Schema):
    filename: str
    displayname: str
    remark: str
    categoryDisplayname: str
    importClaim: UserSchema | None
    importClaimTime: datetime.datetime | None
    public: bool
    finishedCuts: bool


@router.get(
    "/listimportexams/",
    response={
        200: ValueWrapped[list[ListImportExamsSchema]],
        401: ErrorSchema,
    },
    operation_id="listImportExams",
)
@auth_check.require_login
def list_import_exams(request, includeHidden: bool = False):
    condition = Q(finished_cuts=False)
    if includeHidden:
        condition = condition | Q(public=False)

    def filter_exams(exams):
        if auth_check.has_admin_rights(request):
            return exams
        return [
            exam
            for exam in exams
            if auth_check.has_admin_rights_for_exam(request, exam)
        ]

    res = [
        ListImportExamsSchema(
            filename=exam.filename,
            displayname=exam.displayname,
            categoryDisplayname=exam.category.displayname,
            remark=exam.remark,
            importClaim=exam.import_claim,
            importClaimTime=exam.import_claim_time,
            public=exam.public,
            finishedCuts=exam.finished_cuts,
        )
        for exam in filter_exams(
            Exam.objects.filter(condition)
            .select_related("import_claim", "category")
            .order_by("category__displayname", "displayname")
        )
    ]

    return {
        "value": res,
    }


class ListPaymentCheckExamsSchema(Schema):
    filename: str
    displayname: str
    categoryDisplayname: str
    paymentUploader: UserSchema | None


@router.get(
    "/listpaymentcheckexams/",
    response={
        200: ValueWrapped[list[ListPaymentCheckExamsSchema]],
        401: ErrorSchema,
        403: ErrorSchema,
    },
    operation_id="listPaymentCheckExams",
)
@auth_check.require_admin
def list_payment_check_exams(request):
    res = [
        ListPaymentCheckExamsSchema(
            filename=exam.filename,
            displayname=exam.displayname,
            categoryDisplayname=exam.category.displayname,
            paymentUploader=exam.oral_transcript_uploader,
        )
        for exam in Exam.objects.filter(
            is_oral_transcript=True, oral_transcript_checked=False
        ).order_by("category__displayname", "displayname")
    ]
    return {
        "value": res,
    }


class ListFlaggedSchema(Schema):
    link: str
    flaggedCount: int
    author: UserSchema
    flagType: bool


@router.get(
    "/listflagged/",
    response={
        200: ValueWrapped[list[ListFlaggedSchema]],
        401: ErrorSchema,
        403: ErrorSchema,
    },
    operation_id="listFlagged",
)
@auth_check.require_admin
def list_flagged(request):
    answers = (
        Answer.objects.exclude(flagged=None)
        .select_related("author", "answer_section__exam")
        .annotate(flagged_count=Count("flagged", distinct=True))
    )

    exam_comments = (
        Comment.objects.exclude(flagged=None)
        .select_related("author", "answer__answer_section__exam")
        .annotate(flagged_count=Count("flagged", distinct=True))
    )

    document_comments = (
        DocumentComment.objects.exclude(flagged=None)
        .select_related("author", "document__author")
        .annotate(flagged_count=Count("flagged", distinct=True))
    )

    answer_list = [
        ListFlaggedSchema(
            link="/exams/"
            + answer.answer_section.exam.filename
            + "?answer="
            + answer.long_id,
            flaggedCount=answer.flagged_count,
            author=answer.author,
            flagType=False,
        )
        for answer in answers
    ]

    exam_comment_list = [
        ListFlaggedSchema(
            link="/exams/"
            + comment.answer.answer_section.exam.filename
            + "?comment="
            + comment.long_id
            + "&answer="
            + comment.answer.long_id,
            flaggedCount=comment.flagged_count,
            author=comment.author,
            flagType=True,
        )
        for comment in exam_comments
    ]

    document_comment_list = [
        ListFlaggedSchema(
            link="/user/"
            + comment.document.author.username
            + "/document/"
            + comment.document.display_name.lower().replace(" ", "-")
            + "?comment="
            + str(comment.id),
            flaggedCount=comment.flagged_count,
            author=comment.author.username,
            flagType=True,
        )
        for comment in document_comments
    ]

    combined = answer_list + exam_comment_list + document_comment_list
    return {
        "value": combined,
    }


@router.get(
    "/listbyuser/{username}/",
    response={
        200: ValueWrapped[list[AnswerSchema]],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="listAnswersByUser",
)
@auth_check.require_login
def get_by_user(request, username: str, page: int = Query(-1, ge=-1)):
    user = get_object_or_404(MyUser, username=username)

    sorted_answers = Answer.objects.filter(
        author=user, kind=Answer.AnswerKind.PERSONAL
    ).select_related(*section_util.get_answer_fields_to_preselect())
    sorted_answers = section_util.prepare_answer_objects(
        sorted_answers, request
    ).order_by("-expert_count", "-delta_votes", "time")

    if page >= 0:
        PAGE_SIZE = 20
        sorted_answers = sorted_answers[page * PAGE_SIZE : (page + 1) * PAGE_SIZE]

    res = [
        section_util.get_answer_response(request, answer, ignore_exam_admin=True)
        for answer in sorted_answers
    ]

    return {
        "value": res,
    }


@router.get(
    "/listcommentsbyuser/{username}/",
    response={
        200: ValueWrapped[list[SingleCommentSchema]],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="listCommentsByUser",
)
@auth_check.require_login
def get_comments_by_user(request, username: str, page: int = Query(-1, ge=-1)):
    user = get_object_or_404(MyUser, username=username)

    sorted_comments = (
        Comment.objects.filter(author=user)
        .select_related(*section_util.get_comment_fields_to_preselect())
        .prefetch_related(*section_util.get_comment_fields_to_prefetch())
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
        .order_by("-time", "id")
    )

    if page >= 0:
        PAGE_SIZE = 20
        sorted_comments = sorted_comments[page * PAGE_SIZE : (page + 1) * PAGE_SIZE]

    res = [
        section_util.get_comment_response(request, comment)
        for comment in sorted_comments
    ]
    return {
        "value": res,
    }
