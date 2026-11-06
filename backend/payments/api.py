from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Form, Router, Schema

from answers.models import Exam
from myauth import auth_check
from myauth.models import MyUser
from payments.models import Payment
from util import response
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Payments"])


class PaymentRequest(Schema):
    username: str


@router.post(
    "/pay/",
    response={
        200: None,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="pay",
)
@auth_check.require_admin
def pay(request, data: Form[PaymentRequest]):
    user = get_object_or_404(MyUser, username=data.username)
    payment = Payment(user=user)
    payment.save()
    return response.success()


@router.post(
    "/remove/{oid}/",
    response={
        200: None,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removePayment",
)
@auth_check.require_admin
def remove(request, oid: int):
    payment = get_object_or_404(Payment, pk=oid)
    payment.delete()
    return response.success()


@router.post(
    "/refund/{oid}/",
    response={
        200: None,
        # Not Possible
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
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


class PaymentInfo(Schema):
    oid: int
    active: bool
    payment_time: timezone.datetime
    check_time: timezone.datetime | None
    refund_time: timezone.datetime | None
    valid_until: timezone.datetime
    uploaded_filename: str | None


def get_user_payments(user):
    res = [
        {
            "oid": payment.id,
            "active": payment.valid(),
            "payment_time": payment.payment_time,
            "check_time": payment.check_time,
            "refund_time": payment.refund_time,
            "valid_until": payment.valid_until(),
            "uploaded_filename": payment.uploaded_transcript.filename
            if payment.uploaded_transcript
            else None,
        }
        for payment in sorted(
            Payment.objects.filter(user=user),
            key=lambda x: (not x.valid(), x.payment_time),
        )
    ]
    return res


@router.get(
    "/query/{username}/",
    response={
        200: ValueWrapped[list[PaymentInfo]],
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getPayments",
)
@auth_check.require_login
def query(request, username: str):
    # If username not myself, require admin
    if not auth_check.has_admin_rights(request) and request.user.username != username:
        return response.not_allowed()

    user = get_object_or_404(MyUser, username=username)
    return response.success(value=get_user_payments(user))


@router.post(
    "/markexamchecked/{filename}/",
    response={
        200: None,
        400: ErrorSchema,
        # Unauthenticated
        401: ErrorSchema,
        # Unauthorised
        403: ErrorSchema,
        404: ErrorSchema,
    },
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
