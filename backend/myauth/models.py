from typing import TYPE_CHECKING

from django.contrib.auth.models import User
from django.db import models

if TYPE_CHECKING:
    from django.db.models.fields.related_descriptors import RelatedManager

    from payments.models import Payment


def get_my_user(user):
    user.__class__ = MyUser
    return user


class MyUser(User):
    class Meta:
        proxy = True

    if TYPE_CHECKING:
        payment_set: RelatedManager[Payment]  # payments.Payment.user

    def displayname(self):
        if not self.first_name:
            return self.last_name
        return self.first_name + " " + self.last_name

    def has_paid(self):
        return any(x.valid() for x in self.payment_set.all())


class Profile(models.Model):
    user = models.OneToOneField(
        MyUser, on_delete=models.CASCADE, related_name="profile"
    )
    sub = models.CharField(max_length=256, primary_key=True)
