from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Field, Form, Router, Schema

import answers.api_files as files
from answers.models import Exam, ExamType, ExamUserSolved
from categories.models import Category
from myauth import auth_check
from myauth.auth_check import has_admin_rights_for_exam, is_expert_for_exam
from users.api import UserSchema
from util import response
from util.schemas import ErrorSchema, ValueWrapped

from . import api_answers, api_comments, api_cuts, api_listings, api_search

router = Router(tags=["Answers"])
router.add_router("", api_answers.router)
router.add_router("", api_comments.router)
router.add_router("", api_cuts.router)
router.add_router("", files.router)
router.add_router("", api_listings.router)
router.add_router("", api_search.router)


class CategoryExamSchema(Schema):
    displayname: str
    filename: str
    categoryDisplayname: str
    needsPayment: bool
    examType: str
    remark: str
    importClaim: UserSchema | None = None
    importClaimTime: str | None = None
    public: bool
    hasSolution: bool
    isPrintonly: bool
    finishedCuts: bool
    canView: bool
    countCuts: int
    countAnswered: int
    userSolved: bool


class Attachment(Schema):
    displayname: str
    filename: str


class ExamMetadataSchema(Schema):
    canEdit: bool
    isExpert: bool
    canView: bool
    hasPaid: bool
    filename: str
    displayname: str
    category: str
    categoryDisplayname: str
    examType: str
    masterSolution: str
    resolveAlias: str
    remark: str
    public: bool
    finishedCuts: bool
    needsPayment: bool
    isPrintonly: bool
    hasSolution: bool
    solutionPrintonly: bool
    isOralTranscript: bool
    oralTranscriptChecked: bool
    darkModeWarning: bool
    countCuts: int
    countAnswered: int
    attachments: list[Attachment]
    userSolved: bool
    examFile: str | None
    solutionFile: str | None
    printonlyFile: str | None


def make_category_exam_obj(request, exam):
    solved = ExamUserSolved.objects.filter(
        user=request.user,
        exam=exam,
    ).exists()

    return CategoryExamSchema(
        filename=exam.filename,
        displayname=exam.displayname,
        categoryDisplayname=exam.category.displayname,
        remark=exam.remark,
        importClaim=exam.import_claim,
        importClaimTime=exam.import_claim_time,
        public=exam.public,
        finishedCuts=exam.finished_cuts,
        needsPayment=exam.needs_payment,
        examType=exam.exam_type.displayname,
        hasSolution=exam.has_solution,
        isPrintonly=exam.is_printonly,
        canView=exam.current_user_can_view(request),
        userSolved=solved,
        countCuts=exam.counts.count_cuts,
        countAnswered=exam.counts.count_answered,
    )


def make_exam_metadata_object(request, exam):
    admin_rights = has_admin_rights_for_exam(request, exam)
    can_view = exam.current_user_can_view(request)
    solved = ExamUserSolved.objects.filter(
        user=request.user,
        exam=exam,
    ).exists()
    is_expert = is_expert_for_exam(request, exam)

    exam_file = None
    if can_view:
        exam_file = files.get_presigned_url_exam(exam)

    solution_file = None
    if can_view and exam.has_solution:
        solution_file = files.get_presigned_url_solution(exam)

    printonly_file = None
    if can_view and admin_rights and exam.is_printonly:
        printonly_file = files.get_presigned_url_printonly(exam)

    attachments = [
        Attachment(
            displayname=att.displayname,
            filename=att.filename,
        )
        for att in exam.attachment_set.order_by("displayname").all()
    ]

    return ExamMetadataSchema(
        canEdit=admin_rights,
        isExpert=is_expert,
        canView=can_view,
        hasPaid=request.user.has_paid(),
        filename=exam.filename,
        displayname=exam.displayname,
        category=exam.category.slug,
        categoryDisplayname=exam.category.displayname,
        examType=exam.exam_type.displayname,
        masterSolution=exam.master_solution,
        resolveAlias=exam.resolve_alias,
        remark=exam.remark,
        public=exam.public,
        finishedCuts=exam.finished_cuts,
        needsPayment=exam.needs_payment,
        isPrintonly=exam.is_printonly,
        hasSolution=exam.has_solution,
        solutionPrintonly=exam.solution_printonly,
        darkModeWarning=exam.dark_mode_warning,
        isOralTranscript=exam.is_oral_transcript,
        oralTranscriptChecked=exam.oral_transcript_checked,
        countCuts=exam.counts.count_cuts,
        countAnswered=exam.counts.count_answered,
        attachments=attachments,
        userSolved=solved,
        examFile=exam_file,
        solutionFile=solution_file,
        printonlyFile=printonly_file,
    )


@router.get(
    "/status/{filename}/",
    response={
        200: ValueWrapped[CategoryExamSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getExamAdminStatus",
)
@auth_check.require_login
def get_exam_admin_status(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)

    if not (
        auth_check.has_admin_rights(request)
        or auth_check.has_admin_rights_for_exam(request, exam)
    ):
        return response.not_allowed()

    return {
        "value": make_category_exam_obj(request, exam),
    }


class UserSolvedExamSchema(Schema):
    userSolved: bool


@router.delete(
    "/{filename}/usersolved",
    response={
        200: ValueWrapped[UserSolvedExamSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeAnswerUserSolved",
)
@auth_check.require_login
def remove_answer_user_solved(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    ExamUserSolved.objects.filter(user=request.user, exam=exam).delete()

    return {
        "value": {
            "userSolved": False,
        }
    }


@router.put(
    "/{filename}/usersolved",
    response={
        200: ValueWrapped[UserSolvedExamSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setAnswerUserSolved",
)
@auth_check.require_login
def put_answer_user_solved(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    ExamUserSolved.objects.update_or_create(user=request.user, exam=exam, defaults={})
    return {
        "value": {
            "userSolved": True,
        }
    }


@router.get(
    "/{filename}/usersolved",
    response={
        200: ValueWrapped[UserSolvedExamSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getAnswerUserSolved",
)
@auth_check.require_login
def get_answer_user_solved(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    solved = ExamUserSolved.objects.filter(
        user=request.user,
        exam=exam,
    ).exists()
    return {
        "value": {
            "userSolved": solved,
        }
    }


@router.get(
    "/metadata/{filename}/",
    response={
        200: ValueWrapped[ExamMetadataSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getExamMetadata",
)
@auth_check.require_login
def exam_metadata(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)

    return {
        "value": make_exam_metadata_object(request, exam),
    }


class SetExamMetadataBodySchema(Schema):
    displayname: str | None = Field(default=None, max_length=256)
    category: str | None = Field(default=None, max_length=256)
    examType: str | None = Field(default=None, max_length=256)
    masterSolution: str | None = Field(default=None, max_length=512)
    resolveAlias: str | None = Field(default=None, max_length=256)
    remark: str | None = None
    public: bool | None = None
    finishedCuts: bool | None = None
    needsPayment: bool | None = None
    solutionPrintonly: bool | None = None
    darkModeWarning: bool | None = None


@router.post(
    "/setmetadata/{filename}/",
    response={
        200: None,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setExamMetadata",
)
@auth_check.require_exam_admin
def exam_set_metadata(request, data: Form[SetExamMetadataBodySchema], filename: str):
    exam = request.exam

    if data.displayname is not None:
        if data.displayname.strip() == "":
            return response.not_possible("Invalid displayname.")
        exam.displayname = data.displayname

    if data.masterSolution is not None:
        exam.master_solution = data.masterSolution

    if data.resolveAlias is not None:
        exam.resolve_alias = data.resolveAlias

    if data.remark is not None:
        exam.remark = data.remark

    if data.public is not None:
        exam.public = data.public

    if data.finishedCuts is not None:
        exam.finished_cuts = data.finishedCuts

    if data.needsPayment is not None:
        exam.needs_payment = data.needsPayment

    if data.solutionPrintonly is not None:
        exam.solution_printonly = data.solutionPrintonly

    if data.darkModeWarning is not None:
        exam.dark_mode_warning = data.darkModeWarning

    if data.category is not None:
        new_category = get_object_or_404(Category, slug=data.category)

        if not auth_check.has_admin_rights_for_category(request, new_category):
            return response.not_allowed()

        exam.category = new_category

    if data.examType is not None:
        old_exam_type = exam.exam_type
        exam.exam_type, _ = ExamType.objects.get_or_create(
            displayname=data.examType,
        )

        exam.save()
        if old_exam_type.id > 5 and not old_exam_type.exam_set.exists():
            old_exam_type.delete()

    exam.save()


class ClaimExamRequestBody(Schema):
    claim: bool


@router.post(
    "/claimexam/{filename}/",
    response={
        200: None,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="claimExam",
)
@auth_check.require_exam_admin
def claim_exam(request, filename: str, data: Form[ClaimExamRequestBody]):
    exam = request.exam
    if data.claim:
        if (
            exam.import_claim
            and exam.import_claim != request.user
            and timezone.now() - exam.import_claim_time < timedelta(hours=4)
        ):
            return response.not_possible("Exam is already claimed by different user")
        exam.import_claim = request.user
        exam.import_claim_time = timezone.now()
    else:
        if exam.import_claim == request.user:
            exam.import_claim = None
        else:
            return response.not_allowed()
    exam.save()
    return response.success()
