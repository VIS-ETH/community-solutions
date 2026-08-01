from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Router, Schema

from answers.models import Exam
from myauth import auth_check
from myauth.models import MyUser
from payments.models import Payment
from util import response
from util.schemas import ValueWrapped

router = Router(tags=["Payments"])


class PaymentRequest(Schema):
    username: str


@router.post(
    "/pay/", response={200: None, 400: response.ErrorSchema}, operation_id="pay"
)
@auth_check.require_admin
def pay(request, data: Form[PaymentRequest]):
    user = get_object_or_404(MyUser, username=data.username)
    payment = Payment(user=user)
    payment.save()
    return response.success()


@router.post(
    "/remove/{oid}/",
    response={200: None, 400: response.ErrorSchema},
    operation_id="removePayment",
)
@auth_check.require_admin
def remove(request, oid: int):
    payment = get_object_or_404(Payment, pk=oid)
    payment.delete()
    return response.success()


@router.post(
    "/refund/{oid}/",
    response={200: None, 400: response.ErrorSchema},
    operation_id="refundPayment",
)
@auth_check.require_admin
def refund(request, oid: int):
    payment = get_object_or_404(Payment, pk=oid)
    if payment.refund_time:
        return response.not_possible("Already refundend")
    payment.refund_time = timezone.now()
    payment.save()
    return response.success()


class UserPayments(Schema):
    oid: int
    active: bool
    payment_time: timezone.datetime
    check_time: timezone.datetime | None
    refund_time: timezone.datetime | None
    valid_until: timezone.datetime | None
    uploaded_filename: str | None


def get_user_payments(user):
    res = [
        UserPayments(
            oid=payment.id,
            active=payment.valid(),
            payment_time=payment.payment_time,
            check_time=payment.check_time,
            refund_time=payment.refund_time,
            valid_until=payment.valid_until(),
            uploaded_filename=payment.uploaded_transcript.filename
            if payment.uploaded_transcript
            else None,
        )
        for payment in sorted(
            Payment.objects.filter(user=user),
            key=lambda x: (not x.valid(), x.payment_time),
        )
    ]
    return res


@router.get(
    "/query/{username}/",
    response={200: ValueWrapped[list[UserPayments]], 404: response.ErrorSchema},
    operation_id="getUserPayments",
)
@auth_check.require_admin
def query(request, username: str):
    user = get_object_or_404(MyUser, username=username)
    return response.success(value=get_user_payments(user))


@router.get(
    "/me/",
    response={200: ValueWrapped[list[UserPayments]]},
    operation_id="getMyPayments",
)
@auth_check.require_login
def get_me(request):
    return response.success(value=get_user_payments(request.user))


@router.post(
    "/markexamchecked/{filename}/",
    response={200: None, 400: response.ErrorSchema},
    operation_id="markExamChecked",
)
@auth_check.require_admin
def mark_exam_checked(request, filename: str):
    exam = get_object_or_404(Exam, filename=filename)
    if not exam.is_oral_transcript:
        return response.not_possible("Exam is not an oral transcript")
    if exam.oral_transcript_checked:
        return response.not_possible("Exam was already checked")
    exam.oral_transcript_checked = True
    exam.public = True
    exam.save()
    payment = [
        x
        for x in Payment.objects.filter(user=exam.oral_transcript_uploader)
        if x.valid() and not x.check_time
    ]
    if payment:
        payment[0].check_time = timezone.now()
        payment[0].uploaded_transcript = exam
        payment[0].save()
    return response.success()
