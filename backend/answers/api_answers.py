from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Field, Form, Router, Schema

from answers import section_util
from answers.models import Answer, AnswerSection
from answers.section_util import AnswerSchema, AnswerSectionSchema
from myauth import auth_check
from notifications import notification_util
from util import response
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Answers"])


@router.get(
    "/answer/{longId}/",
    response={
        200: ValueWrapped[AnswerSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getAnswer",
)
@auth_check.require_login
def get_answer(request, longId: str):
    try:
        answer = section_util.prepare_answer_objects(Answer.objects, request).get(
            long_id=longId
        )
        return response.success(value=section_util.get_answer_response(request, answer))
    except Answer.DoesNotExist as err:
        raise Http404() from err
    except Answer.MultipleObjectsReturned as err:
        raise Http404() from err


class SetAnswerRequestBody(Schema):
    text: str
    kind: Answer.AnswerKind


@router.post(
    "/setanswer/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setAnswer",
)
@auth_check.require_login
def set_answer(request, oid: int, data: Form[SetAnswerRequestBody]):
    section = get_object_or_404(
        AnswerSection.objects.select_related("exam").prefetch_related(
            "answer_set",
            "answer_set__comments",
            "answer_set__upvotes",
            "answer_set__downvotes",
            "answer_set__expertvotes",
        ),
        pk=oid,
    )

    if not section.has_answers:
        return response.not_allowed()

    kind = data.kind
    text = data.text

    if kind != Answer.AnswerKind.PERSONAL and not auth_check.has_admin_rights_for_exam(
        request, section.exam
    ):
        return response.not_allowed()
    where = {"answer_section": section, "kind": kind}

    if kind == Answer.AnswerKind.PERSONAL:
        where["author"] = request.user

    answer, created = None, False
    if not text:
        Answer.objects.filter(*where).delete()
    else:
        defaults = {
            "author": request.user,
            "text": text,
            "edittime": timezone.now(),
        }
        answer, created = Answer.objects.update_or_create(**where, defaults=defaults)

    if created and kind == Answer.AnswerKind.PERSONAL:
        answer.upvotes.add(request.user)
        notification_util.new_answer_to_answer(answer)

    section_util.increase_section_version(section)

    return {
        "value": section_util.get_answersection_response(request, section),
    }


@router.post(
    "/removeanswer/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeAnswer",
)
@auth_check.require_login
def remove_answer(request, oid: int):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    if not (answer.author == request.user or auth_check.has_admin_rights(request)):
        return response.not_allowed()

    section = answer.answer_section
    answer.delete()
    section_util.increase_section_version(section)
    return {"value": section_util.get_answersection_response(request, section)}


class SetLikeRequestBody(Schema):
    # `like` must be -1, 0, or 1
    like: int = Field(ge=-1, le=1)


@router.post(
    "/setlike/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setAnswerLike",
)
@auth_check.require_login
def set_like(request, oid: int, data: Form[SetLikeRequestBody]):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    like = data.like
    old_like = 0
    if answer.upvotes.filter(pk=request.user.pk).exists():
        old_like = 1
    elif answer.downvotes.filter(pk=request.user.pk).exists():
        old_like = -1
    if like != old_like:
        if old_like == 1:
            answer.upvotes.remove(request.user)
        elif old_like == -1:
            answer.downvotes.remove(request.user)
        if like == 1:
            answer.upvotes.add(request.user)
        elif like == -1:
            answer.downvotes.add(request.user)
        answer.save()

    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


class SetExpertVoteRequestBody(Schema):
    vote: bool


@router.post(
    "/setexpertvote/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setExpertVote",
)
@auth_check.require_login
def set_expertvote(request, oid: int, data: Form[SetExpertVoteRequestBody]):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    if not auth_check.is_expert_for_exam(request, answer.answer_section.exam):
        return response.not_allowed()

    old_vote = answer.expertvotes.filter(pk=request.user.pk).exists()
    if data.vote != old_vote:
        if old_vote:
            answer.expertvotes.remove(request.user)
        else:
            answer.expertvotes.add(request.user)
        answer.save()
    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


class SetFlaggedRequestBody(Schema):
    flagged: bool


@router.post(
    "/setanswerflagged/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setAnswerFlagged",
)
@auth_check.require_login
def set_flagged(request, oid: int, data: Form[SetFlaggedRequestBody]):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    if request.user == answer.author:
        return response.not_possible("User can't flag their own answer")

    old_flagged = answer.flagged.filter(pk=request.user.pk).exists()
    if data.flagged != old_flagged:
        if old_flagged:
            answer.flagged.remove(request.user)
        else:
            answer.flagged.add(request.user)
        answer.save()

    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


class MarkAsAiRequestBody(Schema):
    markedAsAi: bool


@router.post(
    "/setanswermarkedasai/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setAnswerMarkedAsAI",
)
@auth_check.require_login
def set_marked_as_ai(request, oid: int, data: Form[MarkAsAiRequestBody]):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    if request.user == answer.author:
        return response.not_possible("User can't mark their own answer as AI")

    old_marked_as_ai = answer.marked_as_ai.filter(pk=request.user.pk).exists()
    if data.markedAsAi != old_marked_as_ai:
        if old_marked_as_ai:
            answer.marked_as_ai.remove(request.user)
        else:
            answer.marked_as_ai.add(request.user)
        answer.save()

    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


@router.post(
    "/resetanswerflagged/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="resetAnswerFlagged",
)
@auth_check.require_admin
def reset_flagged(request, oid: int):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    answer.flagged.clear()
    answer.save()

    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


@router.post(
    "/resetanswermarkedasai/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="resetAnswerMarkedAsAi",
)
@auth_check.require_admin
def reset_marked_as_ai(request, oid: int):
    answer = get_object_or_404(
        Answer.objects.select_related("answer_section").all(), pk=oid
    )
    answer.marked_as_ai.clear()
    answer.save()

    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }
