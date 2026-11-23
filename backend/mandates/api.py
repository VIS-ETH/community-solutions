from datetime import date, datetime
from typing import Literal

from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Query, Router, Schema

from answers.models import Exam
from categories.models import Category
from mandates.models import Mandate
from myauth import auth_check
from myauth.models import get_my_user
from notifications import notification_util
from util import response
from util.schemas import ErrorSchema

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
    extended_until: datetime | None
    reason: str

    uploaded_transcript: str | None
    uploaded_transcript_display_name: str | None

    can_manage: bool


class CreateMandateSchema(Schema):
    category: str
    username: str | None = None


class ReasonSchema(Schema):
    reason: str


class Filters(Schema):
    username: str | None = None
    checked_state: Literal["accepted", "rejected", "excused"] | None = None


def mandate_to_schema_resp(request, mandate: Mandate) -> MandateSchema:
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
        grace_until=mandate.grace_until(),
        extended_until=mandate.extended_until(),
        reason=mandate.reason,
        uploaded_transcript=mandate.uploaded_transcript.filename
        if mandate.uploaded_transcript
        else None,
        uploaded_transcript_display_name=mandate.uploaded_transcript.displayname
        if mandate.uploaded_transcript
        else None,
        can_manage=auth_check.has_admin_rights_for_category(request, mandate.category),
    )


@router.post(
    "/",
    response={
        200: MandateSchema,
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
    },
    operation_id="createMandate",
)
@auth_check.require_login
def create_mandate(request, data: Form[CreateMandateSchema]):
    category = get_object_or_404(Category, slug=data.category)
    if data.username not in (
        None,
        request.user.username,
    ) and not auth_check.has_admin_rights_for_category(request, category):
        return response.not_allowed()
    user = (
        request.user
        if data.username is None
        else get_object_or_404(User, username=data.username)
    )
    if not category.has_payments:
        return response.not_possible(
            "Cannot create mandate for a category without payments"
        )

    if Mandate.objects.filter(user=user, category=category).exists():
        return response.not_possible("User already has a mandate for this category")

    created_mandate = Mandate.objects.create(
        user=user,
        category=category,
        due_date=Mandate.next_due_date(),
    )
    mandate = Mandate.objects.select_related("user", "category").get(
        pk=created_mandate.pk
    )
    return mandate_to_schema_resp(request, mandate)


@router.get(
    "/",
    response={
        200: list[MandateSchema],
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
    },
    operation_id="listMandates",
)
@auth_check.require_login
def list_mandates(request, filters: Query[Filters]):
    # category admins only see mandates of their own categories
    only_admin_categories = (
        not auth_check.has_admin_rights(request)
        and request.user.username != filters.username
    )
    if only_admin_categories and not auth_check.has_admin_rights_for_any_category(
        request
    ):
        return response.not_allowed()
    db_filters = {"user__username": filters.username} if filters.username else {}
    db_filters |= (
        {"checked_state": Mandate.CheckedState(filters.checked_state)}
        if filters.checked_state
        else {}
    )
    mandates = Mandate.objects.select_related(
        "category", "user", "uploaded_transcript"
    ).filter(**db_filters)
    if only_admin_categories:
        mandates = mandates.filter(category__in=request.user.category_admin_set.all())
    return [mandate_to_schema_resp(request, mandate) for mandate in mandates]


@router.delete(
    "/{mandate_id}/",
    response={
        204: None,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="deleteMandate",
)
@auth_check.require_login
def delete_mandate(request, mandate_id: str):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_related("user", "category"),
            pk=mandate_id,
        )

        if not auth_check.has_admin_rights_for_category(request, mandate.category):
            return response.not_allowed()

        mandate.delete()
    return 204, None


@router.post(
    "/{mandate_id}/excuse/",
    response={
        200: MandateSchema,
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="excuseMandate",
)
@auth_check.require_login
def excuse_mandate(request, mandate_id: str, data: Form[ReasonSchema]):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_for_update(of=("self",)).select_related(
                "user", "category", "uploaded_transcript"
            ),
            pk=mandate_id,
        )

        if not auth_check.has_admin_rights_for_category(request, mandate.category):
            return response.not_allowed()

        current = mandate.checked_state
        if current in (Mandate.CheckedState.ACCEPTED, Mandate.CheckedState.EXCUSED):
            return response.not_possible(f"Mandate is already {current}")
        reason = data.reason.strip()
        if not reason:
            return response.not_possible("Excusing requires a reason")

        now = timezone.now()
        mandate.reason = reason
        mandate.checked_state = Mandate.CheckedState.EXCUSED
        mandate.checked_time = now
        mandate.edited_time = now
        mandate.save()
        notification_util.mandate_excused(request.user, mandate)
    return mandate_to_schema_resp(request, mandate)


@router.post(
    "/transcript/{filename}/reject/",
    response={
        200: MandateSchema,
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="rejectMandateTranscript",
)
@auth_check.require_login
def reject_transcript(request, filename: str):
    with transaction.atomic():
        exam = get_object_or_404(Exam, filename=filename)
        if not auth_check.has_admin_rights_for_exam(request, exam):
            return response.not_allowed()

        mandate = (
            Mandate.objects.select_for_update(of=("self",))
            .select_related("user", "category", "uploaded_transcript")
            .filter(uploaded_transcript=exam, checked_state__isnull=True)
            .first()
        )
        if mandate is None:
            return response.not_possible("No mandate awaits a check of this transcript")

        now = timezone.now()
        mandate.checked_state = Mandate.CheckedState.REJECTED
        mandate.checked_time = now
        mandate.edited_time = now
        mandate.save()
        notification_util.mandate_rejected(request.user, mandate)
    return mandate_to_schema_resp(request, mandate)


@router.post(
    "/{mandate_id}/extend/",
    response={
        200: MandateSchema,
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="extendMandate",
)
@auth_check.require_login
def extend_mandate(request, mandate_id: str, data: Form[ReasonSchema]):
    with transaction.atomic():
        mandate = get_object_or_404(
            Mandate.objects.select_for_update(of=("self",)).select_related(
                "user", "category", "uploaded_transcript"
            ),
            pk=mandate_id,
        )

        if not auth_check.has_admin_rights_for_category(request, mandate.category):
            return response.not_allowed()

        # granting again restarts the period
        if not Mandate.objects.filter(Mandate.overdue_q(), pk=mandate.pk).exists():
            return response.not_possible("Mandate is not overdue")
        reason = data.reason.strip()
        if not reason:
            return response.not_possible("Extending requires a reason")

        now = timezone.now()
        mandate.reason = reason
        mandate.extended_time = now
        mandate.edited_time = now
        mandate.save()
        notification_util.mandate_extended(request.user, mandate)
    return mandate_to_schema_resp(request, mandate)
