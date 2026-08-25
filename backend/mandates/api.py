from datetime import date, datetime
from typing import Literal

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Query, Router, Schema

from categories.models import Category
from mandates.models import MANDATE_REJECTION_GRACE_PERIOD, Mandate
from myauth import auth_check
from myauth.models import get_my_user
from util import response
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
    checked_state: Literal["accepted", "rejected", "excused"] | None

    grace_until: date | None

    uploaded_transcript: str | None
    uploaded_transcript_display_name: str | None


class CreateMandateSchema(Schema):
    category: str
    username: str | None = None
    due_date: datetime | None = None


class CheckMandateSchema(Schema):
    checked_state: Literal["accepted", "rejected", "excused"]


class MandateListSchema(ValueWrapped[list[MandateSchema]]):
    pass


class EmptySchema(Schema):
    pass


class Filters(Schema):
    username: str | None = None
    checked_state: Literal["accepted", "rejected", "excused"] | None = None


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
        checked_state=mandate.checked_state or None,
        grace_until=max(
            (mandate.checked_time + MANDATE_REJECTION_GRACE_PERIOD).date(),
            mandate.due_date,
        )
        if mandate.checked_state == "rejected" and mandate.checked_time
        else None,
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
    response={
        200: MandateSchema,
        400: ErrorSchema,
        # Unauthenticated
        401: response.ErrorSchema,
        # Unauthorised
        403: response.ErrorSchema,
    },
    operation_id="createMandate",
)
@auth_check.require_login
def create_mandate(request, data: Form[CreateMandateSchema]):
    if not auth_check.has_admin_rights(request) and data.username not in (
        None,
        request.user.username,
    ):
        return response.not_allowed()
    user = (
        request.user
        if data.username is None
        else get_object_or_404(User, username=data.username)
    )
    category = get_object_or_404(Category, slug=data.category)
    if not category.has_payments:
        return response.not_possible(
            "Cannot create mandate for a category without payments"
        )
    unhandled_exists = Mandate.objects.filter(
        Q(user=user)
        & Q(category=category)
        & (Q(checked_state="accepted") | Q(checked_state="excused"))
    ).exists()
    if unhandled_exists:
        return response.not_possible(
            "User already has an unhandled mandate for this category"
        )

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
    response={
        200: MandateListSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
    },
    operation_id="listMandates",
)
@auth_check.require_login
def get_mandates(request, filters: Query[Filters]):
    if (
        not auth_check.has_admin_rights(request)
        and request.user.username != filters.username
    ):
        return response.not_allowed()
    db_filters = {"user__username": filters.username} if filters.username else {}
    db_filters |= (
        {"checked_state": Mandate.CheckedState[filters.checked_state]}
        if filters.checked_state
        else {}
    )
    mandates = Mandate.objects.select_related(
        "category", "user", "uploaded_transcript"
    ).filter(**db_filters)
    return {"value": [mandate_to_schema_resp(mandate) for mandate in mandates]}


@router.post(
    "/{mandate_id}/fulfill/",
    response={
        200: MandateSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
        304: EmptySchema,
    },
    operation_id="fulfillMandate",
)
@auth_check.require_login
def fulfill_mandate(request, mandate_id: str):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_related("user", "category"),
            pk=mandate_id,
        )

        if (
            not auth_check.has_admin_rights(request)
            and request.user.username != mandate.user.username
        ):
            return response.not_allowed()

        if (
            mandate.fulfilled_time is not None
            and mandate.checked_state != Mandate.CheckedState.REJECTED
        ):
            return response.not_possible("Mandate already fulfilled")

        mandate.fulfilled_time = timezone.now()
        mandate.edited_time = timezone.now()
        mandate.save()
    return mandate_to_schema_resp(mandate)


@router.delete(
    "/{mandate_id}/",
    response={
        204: EmptySchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="deleteMandate",
)
def delete_mandate(request, mandate_id: str):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_related("user", "category"),
            pk=mandate_id,
        )

        if not auth_check.has_admin_rights_for_category(request, mandate.category):
            return response.not_allowed()

        mandate.delete()
    return 204, {}


@router.post(
    "/{mandate_id}/check/",
    response={
        200: MandateSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="checkMandate",
)
@auth_check.require_login
def check_mandate(request, mandate_id: str, data: Form[CheckMandateSchema]):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_related("user", "category"),
            pk=mandate_id,
        )

        if not auth_check.has_admin_rights_for_category(request, mandate.category):
            return response.not_allowed()

        if mandate.fulfilled_time is None or mandate.uploaded_transcript is None:
            return response.not_possible("Mandate not fulfilled yet")

        mandate.checked_state = Mandate.CheckedState[data.checked_state]
        mandate.checked_time = timezone.now()
        mandate.edited_time = timezone.now()
        mandate.save()
