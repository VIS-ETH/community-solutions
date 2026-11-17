from datetime import datetime, timedelta

from django.db import models
from django.db.models import CheckConstraint, F, Q, UniqueConstraint
from django.db.models.functions import Cast
from django.utils import timezone
from django_prometheus.models import ExportModelOperationsMixin

from categories.models import Category

MANDATE_REJECTION_GRACE_PERIOD = timedelta(days=10)
MANDATE_EXTENSION_PERIOD = timedelta(days=1)


class Mandate(ExportModelOperationsMixin("mandate"), models.Model):
    class CheckedState(models.TextChoices):
        ACCEPTED = "accepted"
        REJECTED = "rejected"
        EXCUSED = "excused"

    user = models.ForeignKey("auth.User", on_delete=models.CASCADE)
    category = models.ForeignKey("categories.Category", on_delete=models.CASCADE)

    created_time = models.DateTimeField(default=timezone.now)
    edited_time = models.DateTimeField(default=timezone.now)
    due_date = models.DateField()
    fulfilled_time = models.DateTimeField(null=True, blank=True)
    checked_time = models.DateTimeField(null=True, blank=True)
    extended_time = models.DateTimeField(null=True, blank=True)
    checked_state = models.TextField(
        null=True,
        max_length=16,
        choices=CheckedState.choices,
    )

    uploaded_transcript = models.ForeignKey(
        "answers.Exam", null=True, on_delete=models.SET_NULL
    )

    class Meta:
        constraints = [
            # Technically, we could prevent overlaps over [created_time, due_time] by (user, category).
            # However, this requires the BTreeGist, doable in VIS environments, not positive if we want
            # to require this + VSETH environments
            CheckConstraint(
                name="mandate_created_before_edited",
                condition=Q(created_time__lte=F("edited_time")),
            ),
            CheckConstraint(
                name="mandate_created_before_due_date",
                condition=Q(
                    created_time__lte=Cast(
                        F("due_date"), output_field=models.DateTimeField()
                    )
                ),
            ),
            CheckConstraint(
                name="mandate_created_before_fulfilled",
                condition=(
                    Q(fulfilled_time__isnull=True)
                    | Q(created_time__lte=F("fulfilled_time"))
                ),
            ),
            CheckConstraint(
                name="mandate_fulfilled_before_checked",
                condition=Q(checked_time__isnull=True)
                # excusing needs no upload
                | Q(checked_state="excused", fulfilled_time__isnull=True)
                | (
                    Q(fulfilled_time__isnull=False)
                    & Q(fulfilled_time__lte=F("checked_time"))
                ),
            ),
            CheckConstraint(
                name="mandate_check_state_only_if_checked",
                condition=Q(checked_time__isnull=True, checked_state__isnull=True)
                | Q(checked_time__isnull=False, checked_state__isnull=False),
            ),
            UniqueConstraint(
                name="unique_category_mandate",
                fields=("user", "category"),
            ),
        ]

    def submit_transcript(self, exam):
        now = timezone.now()
        self.fulfilled_time = now
        self.edited_time = now
        self.uploaded_transcript = exam
        # resubmission clears a rejection
        self.checked_state = None
        self.checked_time = None
        self.save()

    @staticmethod
    def categories_with_access(user):
        # until due_date (inclusive), permanently once accepted or excused
        return Mandate.objects.filter(
            Q(user=user)
            & (
                Q(due_date__gte=timezone.now().date())
                | Q(
                    checked_state__in=[
                        Mandate.CheckedState.ACCEPTED,
                        Mandate.CheckedState.EXCUSED,
                    ]
                )
            )
        ).values("category")

    @staticmethod
    def user_has_mandate_category(username: str, category: Category):
        return Mandate.objects.filter(
            Q(user__username=username) & Q(category=category)
        ).exists()

    @staticmethod
    def next_due_date():
        # next March 1st or October 1st
        t = timezone.now()
        return min(
            reset
            for reset in (
                datetime(year, month, 1, tzinfo=t.tzinfo)
                for year in [t.year, t.year + 1]
                for month in [3, 10]
            )
            if reset > t
        ).date()

    @staticmethod
    def overdue_q():
        # unchecked mandates are fine. That means our moderators are slow, users should not be punished for that.
        now = timezone.now()
        # due_date and grace_until are the last days with access
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return Q(due_date__lt=now.date()) & (
            # not fulfilled nor excused
            Q(fulfilled_time__isnull=True, checked_state__isnull=True)
            | (
                Q(checked_state=Mandate.CheckedState.REJECTED)
                & Q(checked_time__lt=today_start - MANDATE_REJECTION_GRACE_PERIOD)
            )
        )

    @staticmethod
    def active_extension_q():
        return Q(extended_time__gt=timezone.now() - MANDATE_EXTENSION_PERIOD)

    @staticmethod
    def user_has_any_nongrace_overdue_mandates(username: str):
        return (
            Mandate.objects.filter(Q(user__username=username) & Mandate.overdue_q())
            .exclude(Mandate.active_extension_q())
            .exists()
        )
