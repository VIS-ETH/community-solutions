from datetime import date, datetime

from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Query, Router, Schema

from categories.models import Category
from mandates.models import Mandate
from myauth.models import get_my_user
from util.response import ErrorSchema
from util.schemas import ValueWrapped

router = Router(tags=["Mandates"])


class MandateSchema(Schema):
    id: str

    user: str
    user_display_name: str

    category: str
    category_display_name: str

    created_at: datetime
    last_edited_at: datetime
    due_date: date
    fulfilled_at: datetime | None
    checked_at: datetime | None
    rejected: bool | None

    uploaded_transcript: str | None
    uploaded_transcript_display_name: str | None


class CreateMandateSchema(Schema):
    category: str
    username: str | None = None
    due_date: datetime | None = None


class MandateListSchema(ValueWrapped[list[MandateSchema]]):
    pass


class EmptySchema(Schema):
    pass


class Filters(Schema):
    username: str | None = None


def mandate_to_schema_resp(mandate: Mandate) -> MandateSchema:
    return MandateSchema(
        id=str(mandate.pk),
        user=mandate.user.username,
        user_display_name=get_my_user(mandate.user).displayname(),
        category=mandate.category.slug,
        category_display_name=mandate.category.displayname,
        created_at=mandate.created_time.isoformat(),
        last_edited_at=mandate.edited_time.isoformat(),
        due_date=mandate.due_date.isoformat(),
        fulfilled_at=mandate.fulfilled_time,
        checked_at=mandate.checked_time,
        rejected=mandate.rejected or None,
        uploaded_transcript=mandate.uploaded_transcript.filename
        if mandate.uploaded_transcript
        else None,
        uploaded_transcript_display_name=mandate.uploaded_transcript.displayname
        if mandate.uploaded_transcript
        else None,
    )


def _next_max_due_date():
    t = timezone.now()
    resetdates = [
        datetime(year, month, 1, tzinfo=t.tzinfo)
        for year in [t.year, t.year + 1]
        for month in [3, 10]
    ]
    for reset in resetdates:
        if reset > t:
            return reset.date()
    else:
        raise Exception("No reset date found after payment time")


@router.post(
    "/",
    response={200: MandateSchema, 403: ErrorSchema},
    operation_id="createMandate",
)
def create_mandate(
    request, data: Form[CreateMandateSchema]
) -> MandateSchema | ErrorSchema:
    user = (
        request.user
        if data.username is None
        else get_object_or_404(User, username=data.username)
    )
    category = get_object_or_404(Category, slug=data.category)
    created_mandate = Mandate.objects.create(
        user=user,
        category=category,
        due_date=data.due_date or _next_max_due_date(),
    )
    mandate = Mandate.objects.select_related("user", "category").get(
        pk=created_mandate.pk
    )
    return mandate_to_schema_resp(mandate)


@router.get(
    "/",
    response={200: MandateListSchema, 403: ErrorSchema},
    operation_id="listMandates",
)
def get_mandates(request, filters: Query[Filters]):
    db_filters = {"user__username": filters.username} if filters.username else {}
    mandates = Mandate.objects.filter(**db_filters).prefetch_related(
        "category", "user", "uploaded_transcript"
    )
    return {"value": [mandate_to_schema_resp(mandate) for mandate in mandates]}


@router.post(
    "/{mandate_id}/fulfill/",
    response={200: MandateSchema, 403: ErrorSchema, 404: ErrorSchema, 304: EmptySchema},
    operation_id="fulfillMandate",
)
def fulfill_mandate(request, mandate_id: str) -> MandateSchema | ErrorSchema:
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_related("user", "category"),
            pk=mandate_id,
        )
        mandate.fulfilled_time = timezone.now()
        mandate.edited_time = timezone.now()
        mandate.save()
    return mandate_to_schema_resp(mandate)
