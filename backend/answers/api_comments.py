from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Router, Schema

from answers import section_util
from answers.models import Answer, Comment
from answers.section_util import AnswerSectionSchema
from myauth import auth_check
from notifications import notification_util
from util import response
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Answers"])


class CreateModifyCommentRequestBody(Schema):
    text: str


@router.post(
    "/addcomment/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="addComment",
)
@auth_check.require_login
def add_comment(request, oid: int, data: Form[CreateModifyCommentRequestBody]):
    answer = get_object_or_404(Answer, pk=oid)
    new_comment = Comment(answer=answer, author=request.user, text=data.text)
    new_comment.save()
    notification_util.new_comment_to_answer(answer, new_comment)
    notification_util.new_comment_to_comment(answer, new_comment)
    section_util.increase_section_version(answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, answer.answer_section)
    }


@router.post(
    "/setcomment/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="updateComment",
)
@auth_check.require_login
def set_comment(request, oid: int, data: Form[CreateModifyCommentRequestBody]):
    comment = get_object_or_404(Comment, pk=oid)
    if comment.author != request.user:
        return response.not_allowed()

    comment.text = data.text
    comment.edittime = timezone.now()
    comment.save()

    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(
            request, comment.answer.answer_section
        )
    }


@router.post(
    "/removecomment/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeComment",
)
@auth_check.require_login
def remove_comment(request, oid: int):
    comment = get_object_or_404(Comment, pk=oid)
    if not (comment.author == request.user or auth_check.has_admin_rights(request)):
        return response.not_allowed()
    section = comment.answer.answer_section
    comment.delete()
    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(request, section),
    }


class FlagCommentRequestBody(Schema):
    flagged: bool


@router.post(
    "/setcommentflagged/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setCommentFlagged",
)
@auth_check.require_login
def set_flagged(request, oid: int, data: Form[FlagCommentRequestBody]):
    comment = get_object_or_404(Comment, pk=oid)
    if request.user == comment.author:
        return response.not_possible("User can't flag their own comment")

    old_flagged = comment.flagged.filter(pk=request.user.pk).exists()
    if data.flagged != old_flagged:
        if old_flagged:
            comment.flagged.remove(request.user)
        else:
            comment.flagged.add(request.user)
        comment.save()

    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(
            request, comment.answer.answer_section
        )
    }


class MarkCommentAsAiRequestBody(Schema):
    markedAsAi: bool


@router.post(
    "/setcommentmarkedasai/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="setCommentMarkedAsAi",
)
@auth_check.require_login
def set_marked_as_ai(request, oid: int, data: Form[MarkCommentAsAiRequestBody]):
    comment = get_object_or_404(Comment, pk=oid)
    if request.user == comment.author:
        return response.not_possible("User can't mark their own comment as AI")

    old_marked_as_ai = comment.marked_as_ai.filter(pk=request.user.pk).exists()
    if data.markedAsAi != old_marked_as_ai:
        if old_marked_as_ai:
            comment.marked_as_ai.remove(request.user)
        else:
            comment.marked_as_ai.add(request.user)
        comment.save()

    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(
            request, comment.answer.answer_section
        )
    }


@router.post(
    "/resetcommentflagged/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="resetCommentFlagged",
)
@auth_check.require_admin
def reset_flagged(request, oid: int):
    comment = get_object_or_404(Comment, pk=oid)
    comment.flagged.clear()
    comment.save()
    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(
            request, comment.answer.answer_section
        )
    }


@router.post(
    "/resetcommentmarkedasai/{oid}/",
    response={
        200: ValueWrapped[AnswerSectionSchema],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="resetCommentMarkedAsAi",
)
@auth_check.require_admin
def reset_marked_as_ai(request, oid: int):
    comment = get_object_or_404(Comment, pk=oid)
    comment.marked_as_ai.clear()
    comment.save()
    section_util.increase_section_version(comment.answer.answer_section)
    return {
        "value": section_util.get_answersection_response(
            request, comment.answer.answer_section
        )
    }
