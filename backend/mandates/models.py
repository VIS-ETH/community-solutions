from datetime import timedelta

from django.db import models
from django.db.models import CheckConstraint, F, Q
from django.db.models.functions import Cast
from django.utils import timezone
from django_prometheus.models import ExportModelOperationsMixin

MANDATE_REJECTION_GRACE_PERIOD = timedelta(days=10)


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
            CheckConstraint(
                name="mandate_accepted_requires_transcript",
                condition=~Q(checked_state="accepted")
                | Q(uploaded_transcript__isnull=False),
            ),
        ]

    def is_unhandled_overdue(self):
        return self.due_date < timezone.now().date() and (
            not self.fulfilled_time
            or self.checked_state == Mandate.CheckedState.REJECTED
        )

    @staticmethod
    def user_has_any_nongrace_overdue_mandates(username: str):
        # unchecked mandates are fine. That means our moderators are slow, users should not be punished for that.
        return Mandate.objects.filter(
            Q(user__username=username)  # mandate is for this user
            & Q(due_date__lte=timezone.now())  # mandate is due
            & (  # mandate is not handled yet
                Q(fulfilled_time__isnull=True)  # mandate is not fulfilled
                | (  # or it has been rejected and grace period has passed!
                    Q(checked_state=Mandate.CheckedState.REJECTED)
                    & Q(
                        checked_time__lt=timezone.now() - MANDATE_REJECTION_GRACE_PERIOD
                    )
                )
            )
        ).exists()
