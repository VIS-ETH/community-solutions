from django.shortcuts import get_object_or_404
from ninja import Field, Form, Router, Schema

from answers import section_util
from answers.models import AnswerSection, Exam
from answers.section_util import AnswerSectionSchema
from myauth import auth_check
from util import response
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Answers"])


class CutPageSchema(Schema):
    oid: int
    relHeight: float
    cutVersion: int
    name: str
    hidden: bool
    hasAnswers: bool


@router.get(
    "/cuts/{filename}/",
    response={
        200: ValueWrapped[dict[int, list[CutPageSchema]]],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getCuts",
)
@auth_check.require_login
def get_cuts(request, filename: str):
    sections = get_object_or_404(Exam, filename=filename).answersection_set.all()
    pages: dict[int, list[CutPageSchema]] = {}
    for sec in sections:
        pages.setdefault(sec.page_num, []).append(
            CutPageSchema(
                oid=sec.id,
                relHeight=sec.rel_height,
                cutVersion=sec.cut_version,
                name=sec.name,
                hidden=sec.hidden,
                hasAnswers=sec.has_answers,
            )
        )
    for page in pages.values():
        page.sort(key=lambda x: x.relHeight)

    return {
        "value": pages,
    }


class AddCutRequestBody(Schema):
    pageNum: int = Field(ge=1)
    relHeight: float = Field(ge=0.0, le=1.0)
    name: str = Field(default="", max_length=256)
    hidden: bool = False
    hasAnswers: bool = False


@router.post(
    "/addcut/{filename}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="addCut",
)
@auth_check.require_exam_admin
def add_cut(request, filename: str, data: Form[AddCutRequestBody]):
    section = AnswerSection(
        exam=request.exam,
        author=request.user,
        page_num=data.pageNum,
        rel_height=data.relHeight,
        name=data.name,
        hidden=data.hidden,
        has_answers=data.hasAnswers,
    )

    section.save()


class EditCutRequestBody(Schema):
    name: str | None = Field(default=None, max_length=256)
    pageNum: int | None = Field(default=None, ge=1)
    relHeight: float | None = Field(default=None, ge=0.0, le=1.0)
    hidden: bool | None = None
    hasAnswers: bool | None = None


@router.post(
    "/editcut/{oid}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="editCut",
)
@auth_check.require_login
def edit_cut(request, oid: int, data: Form[EditCutRequestBody]):
    section = get_object_or_404(AnswerSection, pk=oid)
    if not auth_check.has_admin_rights_for_exam(request, section.exam):
        return response.not_allowed()

    if data.name is not None:
        section.name = data.name
    if data.pageNum is not None:
        section.page_num = data.pageNum
    if data.relHeight is not None:
        section.rel_height = data.relHeight
    if data.hidden is not None:
        section.hidden = data.hidden
    if data.hasAnswers is not None:
        section.has_answers = data.hasAnswers

    section.cut_version += 1
    section.save()


@router.post(
    "/removecut/{oid}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeCut",
)
@auth_check.require_login
def remove_cut(request, oid: int):
    section = get_object_or_404(AnswerSection, pk=oid)
    if not auth_check.has_admin_rights_for_exam(request, section.exam):
        return response.not_allowed()
    section.delete()


@router.get(
    "/cutversions/{filename}/",
    response={
        200: ValueWrapped[dict[int, int]],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getCutVersions",
)
@auth_check.require_login
def get_cut_versions(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    res = {}
    for section in exam.answersection_set.all():
        res[section.id] = section.cut_version

    return {
        "value": res,
    }


@router.get(
    "/answersection/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getAnswerSection",
)
@auth_check.require_login
def get_answersection(request, oid: int):
    section = get_object_or_404(
        AnswerSection.objects.select_related("exam").prefetch_related(
            "answer_set",
            "answer_set__comments",
            "answer_set__upvotes",
            "answer_set__downvotes",
            "answer_set__expertvotes",
            "answer_set__flagged",
        ),
        pk=oid,
    )
    return {"value": section_util.get_answersection_response(request, section)}
