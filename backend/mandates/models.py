from django.db import models
from django.db.models import CheckConstraint, F, Q
from django.db.models.functions import Cast
from django.utils import timezone
from django_prometheus.models import ExportModelOperationsMixin


class Mandate(ExportModelOperationsMixin("mandate"), models.Model):
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE)
    category = models.ForeignKey("categories.Category", on_delete=models.CASCADE)

    created_time = models.DateTimeField(default=timezone.now, null=True)
    edited_time = models.DateTimeField(default=timezone.now, null=True)
    due_date = models.DateField()
    fulfilled_time = models.DateTimeField(null=True, blank=True)
    checked_time = models.DateTimeField(null=True, blank=True)
    rejected = models.BooleanField(default=False)

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
                condition=Q(created_time__lte=F("fulfilled_time")),
            ),
            CheckConstraint(
                name="mandate_fulfilled_before_checked",
                condition=Q(fulfilled_time__lte=F("checked_time")),
            ),
        ]

    @staticmethod
    def user_has_any_overdue_mandates(username: str):
        # unchecked mandates are fine. That means our moderators are slow, users should not be punished for that.
        return Mandate.objects.filter(
            Q(user__username=username)  # mandate is for this user
            & Q(due_date__lte=timezone.now().date())  # mandate is due
            & (  # mandate is not handled yet
                Q(fulfilled_time__isnull=True)  # mandate is not fulfilled
                | Q(rejected=True)  # or it has been rejected
            )
        ).exists()
