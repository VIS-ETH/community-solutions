from django.contrib.auth import get_user_model
from django.db.models import CharField, Q, Value
from django.db.models.functions import Concat
from ninja import ModelSchema, Router

from myauth import auth_check, models
from util.response import not_found, not_possible

router = Router(tags=["Users"])

User = get_user_model()


class UserSchema(ModelSchema):
    class Meta:
        model = models.MyUser
        fields = ["id", "username"]

    id: int
    username: str
    displayname: str

    @staticmethod
    def resolve_displayname(obj):
        return models.get_my_user(obj).displayname()


@router.get("/search", operation_id="userSearch", response=list[UserSchema])
@auth_check.require_login
def user_search(request, q: str, limit: int = 20):
    # Normalise it a bit for better search results
    q = q.strip().casefold()

    if not (1 <= limit <= 50):
        return not_possible("Limit must be in range [1, 50].")

    if not q:
        return []

    return list(
        User.objects.annotate(
            display_name=Concat(
                "first_name", Value(" "), "last_name", output_field=CharField()
            )
        ).filter(Q(username__icontains=q) | Q(display_name__icontains=q))[:limit]
    )


@router.get("/{int:user_id}", operation_id="user", response=UserSchema)
@auth_check.require_login
def user(request, user_id: int):
    user = User.objects.filter(id=user_id).first()
    if user:
        return user

    return not_found()
