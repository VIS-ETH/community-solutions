from django.db.models import F, IntegerField, Q, Value
from django.db.models import Value as V
from django.db.models.expressions import Case, When
from django.db.models.functions import Concat
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from myauth import auth_check
from myauth.models import MyUser
from util import func_cache, response
from util.schemas import ValueWrapped

router = Router(tags=["Scoreboard"])


def get_user_scores(user, res):
    total_users = MyUser.objects.count()

    scores = user.scores

    res.update(
        {
            "rank": scores.id,
            "total_users": total_users,
            "score": scores.score,
            "score_answers": scores.answers,
            "score_comments": scores.comments,
            "score_cuts": scores.cuts,
            "score_legacy": scores.legacy,
            "score_official": scores.official,
            "score_documents": scores.documents,
        }
    )
    return res


@func_cache.cache(600)
def get_scoreboard_top(scoretype, limit):
    users = MyUser.objects.annotate(
        displayName=Case(
            When(
                Q(first_name__isnull=True),
                "last_name",
            ),
            default=Concat("first_name", V(" "), "last_name"),
        ),
        rank=F("scores__id"),
        # Constant value
        total_users=Value(MyUser.objects.count(), output_field=IntegerField()),
        score=F("scores__score"),
        score_answers=F("scores__answers"),
        score_comments=F("scores__comments"),
        score_documents=F("scores__documents"),
        score_cuts=F("scores__cuts"),
        score_legacy=F("scores__legacy"),
        score_official=F("scores__official"),
    )

    if scoretype == "score":
        users = users.order_by("-score")
    elif scoretype == "score_answers":
        users = users.order_by("-score_answers")
    elif scoretype == "score_comments":
        users = users.order_by("-score_comments")
    elif scoretype == "score_documents":
        users = users.order_by("-score_documents")
    elif scoretype == "score_cuts":
        users = users.order_by("-score_cuts")
    elif scoretype == "score_legacy":
        users = users.order_by("-score_legacy")
    elif scoretype == "score_official":
        users = users.order_by("-score_official")
    else:
        return response.not_found()

    return list(
        users[:limit].values(
            "username",
            "displayName",
            "rank",
            "total_users",
            "score",
            "score_answers",
            "score_comments",
            "score_cuts",
            "score_legacy",
            "score_official",
            "score_documents",
        )
    )


class UserInfoResponse(Schema):
    username: str
    displayName: str
    rank: int
    total_users: int
    score: int
    score_answers: int
    score_comments: int
    score_cuts: int
    score_legacy: int
    score_official: int
    score_documents: int


@router.get(
    "/userinfo/{username}/",
    response={200: ValueWrapped[UserInfoResponse], 404: None},
    operation_id="getUserScores",
)
@auth_check.require_login
def userinfo(request, username: str):
    user = get_object_or_404(MyUser.objects.select_related("scores"), username=username)
    res = {
        "username": username,
        "displayName": user.displayname(),
    }
    get_user_scores(user, res)
    return response.success(value=res)


@router.get(
    "/top/{scoretype}/",
    response={200: ValueWrapped[list[UserInfoResponse]], 404: None},
    operation_id="getScoreboardTop",
)
@auth_check.require_login
def scoreboard_top(request, scoretype: str, limit: int = 10):
    if limit > 10 and not auth_check.has_admin_rights(request):
        return response.not_allowed()
    return response.success(value=get_scoreboard_top(scoretype, limit))
