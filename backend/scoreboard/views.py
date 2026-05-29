from django.db.models import F, Q
from django.db.models import Value as V
from django.db.models.expressions import Case, When
from django.db.models.functions import Concat
from django.shortcuts import get_object_or_404

from answers.models import Answer
from myauth import auth_check
from myauth.models import MyUser
from util import func_cache, response


def get_user_scores(user, res):
    list = get_ranking_list()
    total_users = MyUser.objects.count()
    if user.username in list:
        rank = list.index(user.username) + 1
    else:
        rank = total_users

    scores = user.scores

    res.update(
        {
            "rank": rank,
            "total_users": total_users,
            "score": scores.document_likes
            + scores.upvotes
            - scores.downvotes,
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
def get_ranking_list():
    return list(
        MyUser.objects.annotate(
            score=F("scores__document_likes")
            + F("scores__upvotes")
            - F("scores__downvotes"),
        )
        .order_by("-score")
        .values_list("username", flat=True)
    )


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
        score=F("scores__document_likes")
        + F("scores__upvotes")
        - F("scores__downvotes"),
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
            "score",
            "score_answers",
            "score_comments",
            "score_cuts",
            "score_legacy",
            "score_official",
            "score_documents",
        )
    )


@response.request_get()
@auth_check.require_login
def userinfo(request, username):
    user = get_object_or_404(
          MyUser.objects.select_related("scores"), username=username
      )
    res = {
        "username": username,
        "displayName": user.displayname(),
    }
    get_user_scores(user, res)
    return response.success(value=res)


@response.request_get()
@auth_check.require_login
def scoreboard_top(request, scoretype):
    limit = int(request.GET.get("limit", "10"))
    if limit > 10 and not auth_check.has_admin_rights(request):
        return response.not_allowed()
    return response.success(value=get_scoreboard_top(scoretype, limit))
