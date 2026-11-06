import datetime

from django.db.models import Count, Exists, F, Manager, OuterRef, Prefetch
from ninja import Schema

from answers.models import Answer, Comment
from myauth import auth_check
from users.api import UserSchema


def prepare_answer_objects(objects: Manager[Answer], request) -> Manager[Answer]:
    # Important optimization. Prevents amount of queries from
    # increasing quadratically ((N+1 problem)^2) and instead
    # results in a constant amount of queries.
    comments_query = (
        Comment.objects.select_related("author")
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
        .order_by("time", "id")
    )
    return (
        objects.annotate(
            expert_count=Count("expertvotes", distinct=True),
            downvotes_count=Count("downvotes", distinct=True),
            upvotes_count=Count("upvotes", distinct=True),
            flagged_count=Count("flagged", distinct=True),
            marked_as_ai_count=Count("marked_as_ai", distinct=True),
            is_upvoted=Exists(
                Answer.objects.filter(id=OuterRef("id"), upvotes=request.user)
            ),
            is_downvoted=Exists(
                Answer.objects.filter(id=OuterRef("id"), downvotes=request.user)
            ),
            is_expertvoted=Exists(
                Answer.objects.filter(id=OuterRef("id"), expertvotes=request.user)
            ),
            is_flagged=Exists(
                Answer.objects.filter(id=OuterRef("id"), flagged=request.user)
            ),
            is_marked_as_ai=Exists(
                Answer.objects.filter(id=OuterRef("id"), marked_as_ai=request.user)
            ),
            delta_votes=F("upvotes_count") - F("downvotes_count"),
        )
        .prefetch_related(
            Prefetch(
                "comments",
                queryset=comments_query,
                to_attr="all_comments",
            )
        )
        .select_related("author")
    )


class CommentSchema(Schema):
    oid: int
    longId: str
    text: str
    author: UserSchema
    canEdit: bool
    time: datetime.datetime
    edittime: datetime.datetime
    isFlagged: bool
    flaggedCount: int
    isMarkedAsAi: bool
    markedAsAiCount: int


class AnswerSchema(Schema):
    oid: int
    longId: str
    upvotes: int
    expertVotes: int
    author: UserSchema | None
    canEdit: bool
    isAuthor: bool
    isUpvoted: bool
    isDownvoted: bool
    isExpertVoted: bool
    isFlagged: bool
    flaggedCount: int
    isMarkedAsAi: bool
    markedAsAiCount: int
    comments: list[CommentSchema]
    text: str
    time: datetime.datetime
    edittime: datetime.datetime
    filename: str
    sectionId: int
    kind: Answer.AnswerKind


def get_answer_response(request, answer, ignore_exam_admin=False) -> AnswerSchema:
    """
    Call `prepare_answer_objects` on the answer objects beforehand to annotate
    them with the required aggregations. This function will fail otherwise.
    """
    if ignore_exam_admin:
        exam_admin = False
    else:
        exam_admin = auth_check.has_admin_rights_for_exam(
            request, answer.answer_section.exam
        )

    try:
        comments = [
            CommentSchema(
                oid=comment.id,
                longId=comment.long_id,
                text=comment.text,
                author=comment.author,
                canEdit=comment.author == request.user,
                time=comment.time,
                edittime=comment.edittime,
                isFlagged=comment.is_flagged,
                flaggedCount=comment.flagged_count,
                isMarkedAsAi=comment.is_marked_as_ai,
                markedAsAiCount=comment.marked_as_ai_count,
            )
            for comment in answer.all_comments
        ]

        return AnswerSchema(
            oid=answer.id,
            longId=answer.long_id,
            upvotes=answer.delta_votes,
            expertVotes=answer.expert_count,
            author=answer.author if answer.kind == Answer.AnswerKind.PERSONAL else None,
            canEdit=answer.author == request.user
            or (answer.kind != Answer.AnswerKind.PERSONAL and exam_admin),
            isAuthor=answer.author == request.user,
            isUpvoted=answer.is_upvoted,
            isDownvoted=answer.is_downvoted,
            isExpertVoted=answer.is_expertvoted,
            isFlagged=answer.is_flagged,
            flaggedCount=answer.flagged_count,
            isMarkedAsAi=answer.is_marked_as_ai,
            markedAsAiCount=answer.marked_as_ai_count,
            comments=comments,
            text=answer.text,
            time=answer.time,
            edittime=answer.edittime,
            filename=answer.answer_section.exam.filename,
            sectionId=answer.answer_section.id,
            kind=answer.kind,
        )
    except AttributeError as err:
        raise ValueError(
            "The given answer has not been prepared with 'prepare_answer_objects'"
        ) from err


class SingleCommentSchema(CommentSchema):
    answerLongId: str
    examDisplayname: str
    filename: str
    categoryDisplayname: str
    categorySlug: str


def get_comment_response(request, comment: Comment) -> SingleCommentSchema:
    """
    This function will fail if called on a normal comment object
    You have to either pass the prefetched comments from prepare_answer_objects to here or
    add is_flagged and flagged_count fields yourself before calling this function
    """
    try:
        return SingleCommentSchema(
            oid=comment.id,
            longId=comment.long_id,
            answerLongId=comment.answer.long_id,
            text=comment.text,
            author=comment.author,
            canEdit=comment.author == request.user,
            time=comment.time,
            edittime=comment.edittime,
            examDisplayname=comment.answer.answer_section.exam.displayname,
            filename=comment.answer.answer_section.exam.filename,
            categoryDisplayname=comment.answer.answer_section.exam.category.displayname,
            categorySlug=comment.answer.answer_section.exam.category.slug,
            isFlagged=comment.is_flagged,
            flaggedCount=comment.flagged_count,
            isMarkedAsAi=comment.is_marked_as_ai,
            markedAsAiCount=comment.marked_as_ai_count,
        )
    except AttributeError as err:
        raise ValueError("The object is missing the required annotations.") from err


class AnswerSectionSchema(Schema):
    oid: int
    name: str
    answers: list[AnswerSchema]
    allowNewAnswer: bool
    allowNewLegacyAnswer: bool
    allowNewOfficialAnswer: bool
    hasAnswers: bool
    hidden: bool
    cutVersion: int


def get_answersection_response(request, section) -> AnswerSectionSchema:
    prepared_query = prepare_answer_objects(section.answer_set, request)

    answers = [
        get_answer_response(request, answer)
        for answer in sorted(
            prepared_query, key=lambda x: (-x.expert_count, -x.delta_votes, x.time)
        )
    ]

    has_permission_official_answers = auth_check.has_admin_rights_for_exam(
        request, section.exam
    )

    return AnswerSectionSchema(
        oid=section.id,
        name=section.name,
        answers=answers,
        allowNewAnswer=not prepared_query.filter(
            author=request.user, kind=Answer.AnswerKind.PERSONAL
        ).exists(),
        allowNewLegacyAnswer=not prepared_query.filter(
            kind=Answer.AnswerKind.LEGACY
        ).exists(),
        allowNewOfficialAnswer=has_permission_official_answers
        and not prepared_query.filter(kind=Answer.AnswerKind.OFFICIAL).exists(),
        cutVersion=section.cut_version,
        hasAnswers=section.has_answers,
        hidden=section.hidden,
    )


def get_answer_fields_to_preselect():
    return [
        "author",
        "answer_section",
        "answer_section__exam",
        "answer_section__exam__category",
    ]


def get_answer_fields_to_prefetch():
    return [
        "upvotes",
        "downvotes",
        "expertvotes",
        "flagged",
        "marked_as_ai",
        "comments",
        "comments__author",
    ]


def get_comment_fields_to_preselect():
    return [
        "answer",
        "author",
        "answer__answer_section",
        "answer__answer_section__exam",
        "answer__answer_section__exam__category",
    ]


def get_comment_fields_to_prefetch():
    return []


def increase_section_version(section):
    section.cut_version += 1
    section.save()
