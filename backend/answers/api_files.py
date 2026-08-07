import os

from django.conf import settings
from django.shortcuts import get_object_or_404
from ninja import Field, File, Form, Router, Schema, UploadedFile

from answers import pdf_utils
from answers.models import Exam, ExamType
from categories.models import Category
from myauth import auth_check
from util import ethprint, response, s3_util
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Answers"])


class ExamPdfUrlSchema(Schema):
    url: str
    displayName: str


def prepare_exam_pdf_file(file: File[UploadedFile]):
    orig_filename = file.name
    ext = s3_util.check_filename(orig_filename, settings.COMSOL_EXAM_ALLOWED_EXTENSIONS)
    if not ext:
        return response.not_possible("Invalid File Extension")


class UploadExamPdfRequestBody(Schema):
    category: str = Field(default="default", max_length=256)
    displayname: str = Field(max_length=256)


@router.post(
    "/upload/exam/",
    response={
        200: ValueWrapped[str],
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="uploadExamPdf",
)
@auth_check.require_login
def upload_exam_pdf(
    request, data: Form[UploadExamPdfRequestBody], file: File[UploadedFile]
):
    err = prepare_exam_pdf_file(file)
    if err is not None:
        return err

    filename = s3_util.generate_filename(8, settings.COMSOL_EXAM_DIR, ".pdf")
    category = get_object_or_404(Category, slug=data.category)
    if not auth_check.has_admin_rights_for_category(request, category):
        return response.not_allowed()

    exam = Exam(
        filename=filename,
        displayname=data.displayname,
        exam_type=ExamType.objects.get(displayname="Exams"),
        category=category,
        resolve_alias=file.name,
    )
    exam.save()
    s3_util.save_uploaded_file_to_s3(
        settings.COMSOL_EXAM_DIR, filename, file, "application/pdf"
    )
    pdf_utils.analyze_pdf(exam, os.path.join(settings.COMSOL_UPLOAD_FOLDER, filename))
    return {
        "value": filename,
    }


class UploadTranscriptRequestBody(Schema):
    category: str = Field(default="default", max_length=256)
    displayname: str | None = Field(default=None, max_length=256)


@router.post(
    "/upload/transcript/",
    response={
        200: ValueWrapped[str],
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
    },
    operation_id="uploadTranscript",
)
@auth_check.require_login
def upload_transcript(
    request, data: Form[UploadTranscriptRequestBody], file: File[UploadedFile]
):
    err = prepare_exam_pdf_file(file)
    if err is not None:
        return err

    filename = s3_util.generate_filename(8, settings.COMSOL_EXAM_DIR, ".pdf")
    category = get_object_or_404(Category, slug=data.category)
    if not category.has_payments:
        return response.not_possible("Category is not valid")
    try:
        s3_util.save_uploaded_file_to_s3(
            settings.COMSOL_EXAM_DIR, filename, file, "application/pdf"
        )
    except Exception:
        return response.internal_error()

    exam = Exam(
        filename=filename,
        displayname=data.displayname if data.displayname is not None else file.name,
        category=category,
        exam_type=ExamType.objects.get(displayname="Transcripts"),
        resolve_alias=file.name,
        needs_payment=True,
        is_oral_transcript=True,
        oral_transcript_uploader=request.user,
    )
    exam.save()

    pdf_utils.analyze_pdf(exam, os.path.join(settings.COMSOL_UPLOAD_FOLDER, filename))
    return {
        "value": filename,
    }


def get_existing_exam(request, file: File[UploadedFile], filename: str):
    err = prepare_exam_pdf_file(file)
    if err is not None:
        return err, None

    exam = get_object_or_404(Exam, filename=filename)
    if not auth_check.has_admin_rights_for_exam(request, exam):
        return response.not_allowed(), None

    return None, exam


class UploadExamAdditionalFileRequestBody(Schema):
    filename: str = Field(max_length=256)


@router.post(
    "/upload/printonly/",
    response={
        200: ValueWrapped[ExamPdfUrlSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="uploadPrintonly",
)
@auth_check.require_login
def upload_printonly(
    request, data: Form[UploadExamAdditionalFileRequestBody], file: File[UploadedFile]
):
    err, exam = get_existing_exam(request, file, data.filename)
    if err is not None:
        return err

    exam.is_printonly = True
    exam.save()

    s3_util.save_uploaded_file_to_s3(
        settings.COMSOL_PRINTONLY_DIR, data.filename, file, "application/pdf"
    )

    return {
        "value": ExamPdfUrlSchema(
            url=get_presigned_url_printonly(exam),
            displayName=_format_exam_display_name(exam),
        )
    }


@router.post(
    "/upload/solution/",
    response={
        200: ValueWrapped[ExamPdfUrlSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="uploadSolution",
)
@auth_check.require_login
def upload_solution(
    request, data: Form[UploadExamAdditionalFileRequestBody], file: File[UploadedFile]
):
    err, exam = get_existing_exam(request, file, data.filename)
    if err is not None:
        return err

    exam.has_solution = True
    exam.save()

    s3_util.save_uploaded_file_to_s3(
        settings.COMSOL_SOLUTION_DIR, data.filename, file, "application/pdf"
    )

    return {
        "value": ExamPdfUrlSchema(
            url=get_presigned_url_solution(exam),
            displayName=_format_solution_display_name(exam),
        ),
    }


@router.post(
    "/remove/exam/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeExam",
)
@auth_check.require_exam_admin
def remove_exam(request, filename: str):
    request.exam.delete()
    s3_util.delete_file(settings.COMSOL_EXAM_DIR, filename)


@router.post(
    "/remove/printonly/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removePrintonly",
)
@auth_check.require_exam_admin
def remove_printonly(request, filename: str):
    exam = request.exam
    exam.is_printonly = False
    exam.save()
    s3_util.delete_file(settings.COMSOL_PRINTONLY_DIR, filename)


@router.post(
    "/remove/solution/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeSolution",
)
@auth_check.require_exam_admin
def remove_solution(request, filename: str):
    exam = request.exam
    exam.has_solution = False
    exam.save()
    s3_util.delete_file(settings.COMSOL_SOLUTION_DIR, filename)


def _format_exam_display_name(exam: Exam) -> str:
    return exam.category.displayname + " " + exam.displayname + ".pdf"


def get_presigned_url_exam(exam: Exam):
    return s3_util.presigned_get_object(
        settings.COMSOL_EXAM_DIR,
        exam.filename,
        content_type="application/pdf",
        display_name=_format_exam_display_name(exam),
    )


@router.get(
    "/pdf/exam/{filename}/",
    response={
        200: ValueWrapped[ExamPdfUrlSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getExamPdfUrl",
)
@auth_check.require_login
def get_exam_pdf(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    if not exam.current_user_can_view(request):
        return response.not_allowed()

    res = ExamPdfUrlSchema(
        url=get_presigned_url_exam(exam),
        displayName=_format_exam_display_name(exam),
    )

    return {
        "value": res,
    }


def _format_solution_display_name(exam: Exam) -> str:
    return exam.category.displayname + " " + exam.displayname + " (Solution).pdf"


def get_presigned_url_solution(exam: Exam):
    return s3_util.presigned_get_object(
        settings.COMSOL_SOLUTION_DIR,
        exam.filename,
        content_type="application/pdf",
        display_name=_format_solution_display_name(exam),
    )


@router.get(
    "/pdf/solution/{filename}/",
    response={
        200: ValueWrapped[ExamPdfUrlSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getSolutionPdfUrl",
)
@auth_check.require_login
def get_solution_pdf(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)

    if not exam.current_user_can_view(request) or exam.solution_printonly:
        return response.not_allowed()
    if not exam.has_solution:
        return response.not_found()

    return {
        "value": ExamPdfUrlSchema(
            url=get_presigned_url_solution(exam),
            displayName=_format_solution_display_name(exam),
        ),
    }


def get_presigned_url_printonly(exam: Exam):
    return s3_util.presigned_get_object(
        settings.COMSOL_PRINTONLY_DIR,
        exam.filename,
        content_type="application/pdf",
        display_name=exam.category.displayname + " " + exam.displayname + ".pdf",
    )


@router.get(
    "/pdf/printonly/{filename}/",
    response={
        200: ValueWrapped[ExamPdfUrlSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getPrintonlyPdfUrl",
)
@auth_check.require_login
def get_printonly_pdf(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)

    if not exam.current_user_can_view(
        request
    ) or not auth_check.has_admin_rights_for_exam(request, exam):
        return response.not_allowed()
    if not exam.is_printonly:
        return response.not_found()

    res = ExamPdfUrlSchema(
        url=get_presigned_url_printonly(exam),
        displayName=_format_exam_display_name(exam),
    )
    return {
        "value": res,
    }


def print_pdf(exam, request, filename, s3_dir):
    if not exam.current_user_can_view(request):
        return response.not_allowed()
    try:
        pdfpath = os.path.join(settings.COMSOL_UPLOAD_FOLDER, filename)
        if not s3_util.save_file(s3_dir, filename, pdfpath):
            return response.internal_error()
        return_code = ethprint.start_job(
            request.user.username, request.POST["password"], filename, pdfpath
        )
        if return_code:
            return response.not_possible(
                "Could not connect to the printer. Please check your password and try again."
            )
    except Exception:
        pass


class PrintPdfRequestBody(Schema):
    password: str


@router.post(
    "/printpdf/exam/{filename}/",
    response={
        200: None,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
    },
    operation_id="printExamPdf",
)
@auth_check.require_login
def print_exam(request, filename: str, data: Form[PrintPdfRequestBody]):
    exam = get_object_or_404(Exam, filename=filename)
    s3_dir = (
        settings.COMSOL_PRINTONLY_DIR if exam.is_printonly else settings.COMSOL_EXAM_DIR
    )

    return print_pdf(exam, request, filename, s3_dir)


@router.post(
    "/printpdf/solution/{filename}/",
    response={
        200: None,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
    },
    operation_id="printSolutionPdf",
)
@auth_check.require_login
def print_solution(request, filename, data: Form[PrintPdfRequestBody]):
    exam = get_object_or_404(Exam, filename=filename)
    return print_pdf(exam, request, filename, settings.COMSOL_SOLUTION_DIR)
