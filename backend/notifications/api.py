import datetime as dt

from django.shortcuts import get_object_or_404
from ninja import Form, Router, Schema

from myauth import auth_check
from notifications.models import Notification, NotificationSetting, NotificationType
from users.api import UserSchema
from util import response
from util.schemas import ErrorSchema


class NotificationEnableRequest(Schema):
    type: NotificationType
    enabled: bool


class NotificationSetReadRequest(Schema):
    read: bool


class NotificationResponse(Schema):
    oid: int
    receiver: UserSchema
    sender: UserSchema
    time: dt.datetime
    type: NotificationType
    title: str
    message: str
    link: str
    read: bool


router = Router(tags=["Notifications"])


@router.get(
    "/getenabled/",
    response={
        200: list[int],
        401: ErrorSchema,
    },
    operation_id="getEnabledNotifications",
)
@auth_check.require_login
def getenabled(request):
    disabled = set(
        NotificationSetting.objects.filter(
            user=request.user, enabled=False
        ).values_list("type", flat=True)
    )
    return [type_.value for type_ in NotificationType if type_.value not in disabled]


@router.post(
    "/setenabled/",
    response={
        200: None,
        400: ErrorSchema,
        401: ErrorSchema,
    },
    operation_id="enableNotification",
)
@auth_check.require_login
def setenabled(request, body: Form[NotificationEnableRequest]):
    setting, _ = NotificationSetting.objects.get_or_create(
        user=request.user, type=body.type
    )
    setting.enabled = body.enabled
    setting.save()
    return response.success()


def _get_notification_link(notification):
    if notification.answer:
        return f"/exams/{notification.answer.answer_section.exam.filename}#{notification.answer.long_id}"
    elif notification.document:
        return f"/user/{notification.receiver.username}/document/{notification.document.slug}"
    elif notification.type == NotificationType.MANDATE_UPDATE:
        return f"/user/{notification.receiver.username}"
    # Feedback Page is admin-only, so makes no sense to link it since notification contains reply anyway.
    return ""


@router.get(
    "/unreadcount/",
    response={
        200: int,
        401: ErrorSchema,
    },
    operation_id="getNotificationUnreadCount",
)
@auth_check.require_login
def unreadcount(request):
    return Notification.objects.filter(receiver=request.user, read=False).count()


@router.get(
    "/all/",
    response={
        200: list[NotificationResponse],
        401: ErrorSchema,
    },
    operation_id="getAllNotifications",
)
@auth_check.require_login
def all(request, unread: bool = False):
    notifications = Notification.objects.filter(receiver=request.user).select_related(
        "receiver",
        "sender",
        "answer",
        "document",
        "answer__answer_section",
        "answer__answer_section__exam",
    )

    if unread:
        notifications = notifications.filter(read=False)

    notifications = notifications.order_by("-time")

    return [
        {
            "oid": notification.id,
            "receiver": notification.receiver,
            "type": notification.type,
            "time": notification.time,
            "sender": notification.sender,
            "title": notification.title,
            "message": notification.text,
            "link": _get_notification_link(notification),
            "read": notification.read,
        }
        for notification in notifications
    ]


@router.post(
    "/setread/{oid}/",
    response={
        200: None,
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="markNotificationAsRead",
)
@auth_check.require_login
def setread(request, oid: int, body: Form[NotificationSetReadRequest]):
    notification = get_object_or_404(Notification, pk=oid, receiver=request.user)
    notification.read = body.read
    notification.save()
    return response.success()


@router.post(
    "/setallread/",
    response={200: None, 401: ErrorSchema},
    operation_id="markAllNotificationsAsRead",
)
@auth_check.require_login
def mark_all_read(request):
    Notification.objects.filter(receiver=request.user).update(read=True)
    return response.success()
