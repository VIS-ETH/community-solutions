from django.contrib.auth.models import User

from answers.models import Answer
from documents.models import Comment as DocumentComment
from documents.models import Document
from myauth.models import get_my_user
from notifications.models import Notification, NotificationSetting, NotificationType


def is_notification_enabled(receiver, notification_type):
    return NotificationSetting.objects.filter(
        user=receiver, type=notification_type.value, enabled=True
    ).exists()


def send_notification(sender, receiver, type_, title, message, answer):
    if sender == receiver:
        return
    if not is_notification_enabled(receiver, type_):
        return
    # In the case a user has a comment on their own answer, this prevents them from getting
    # 2 notifications if they have both notification options on.
    # "new comment to answer" will be shown instead of "new comment to comment"
    # the only time we want to prevent this is when the receiver is the answer author AND
    # the receiver has both settings turned on
    if (
        answer.author == receiver
        and type_ == NotificationType.NEW_COMMENT_TO_COMMENT
        and is_notification_enabled(receiver, NotificationType.NEW_COMMENT_TO_ANSWER)
    ):
        return
    notification = Notification(
        sender=sender,
        receiver=receiver,
        type=type_.value,
        title=title,
        text=message,
        answer=answer,
    )
    notification.save()


def send_doc_notification(sender, receiver, type_, title, message, document):
    if sender == receiver:
        return
    if not is_notification_enabled(receiver, type_):
        return
    notification = Notification(
        sender=sender,
        receiver=receiver,
        type=type_.value,
        title=title,
        text=message,
        document=document,
        answer=None,
    )
    notification.save()


def send_feedback_notification(sender, receiver, type_, title, message, feedback):
    if sender == receiver:
        return
    if not is_notification_enabled(receiver, type_):
        return
    notification = Notification(
        sender=sender,
        receiver=receiver,
        type=type_.value,
        title=title,
        text=message,
        feedback=feedback,
        answer=None,
    )
    notification.save()


def new_comment_to_answer(answer, new_comment):
    if answer.kind != Answer.Kind.PERSONAL:
        return
    send_notification(
        new_comment.author,
        answer.author,
        NotificationType.NEW_COMMENT_TO_ANSWER,
        "New comment",
        f"A new comment to your answer was added.\n\n{new_comment.text}",
        answer,
    )


def _new_comment_to_comment(old_comment, new_comment):
    send_notification(
        new_comment.author,
        old_comment.author,
        NotificationType.NEW_COMMENT_TO_COMMENT,
        "New comment",
        f"A new comment was added to an answer you commented on.\n\n{new_comment.text}",
        old_comment.answer,
    )


def new_comment_to_comment(answer, new_comment):
    done = set()
    for comment in answer.comments.all():
        if comment != new_comment and comment.author not in done:
            done.add(comment.author)
            _new_comment_to_comment(comment, new_comment)


def _new_answer_to_answer(old_answer, new_answer):
    if old_answer.kind != Answer.Kind.PERSONAL:
        return
    send_notification(
        new_answer.author,
        old_answer.author,
        NotificationType.NEW_ANSWER_TO_ANSWER,
        "New answer",
        "A new answer was posted to a question you answered.",
        new_answer,
    )


def new_answer_to_answer(new_answer):
    for other_answer in Answer.objects.filter(
        answer_section=new_answer.answer_section, kind=Answer.Kind.PERSONAL
    ):
        if other_answer != new_answer:
            _new_answer_to_answer(other_answer, new_answer)


def new_comment_to_document(document: Document, new_comment: DocumentComment):
    send_doc_notification(
        new_comment.author,
        document.author,
        NotificationType.NEW_COMMENT_TO_DOCUMENT,
        "New comment",
        f"A new comment was added to your document.\n\n{new_comment.text}",
        document=document,
    )


def new_feedback_reply(admin_user, feedback):
    send_feedback_notification(
        admin_user,
        feedback.author,
        NotificationType.NEW_COMMENT_TO_FEEDBACK,
        "Reply to your feedback",
        f"An admin has replied to your feedback.\n\n{feedback.reply}",
        feedback=feedback,
    )


def new_document_transfer_request(document: Document):
    sender_displayname = get_my_user(document.author).displayname()
    target_user = document.pending_transfer_user
    if not target_user:
        raise ValueError("Received document with pending_transfer_user=None.")

    send_doc_notification(
        sender=document.author,
        receiver=target_user,
        type_=NotificationType.DOCUMENT_TRANSFER,
        title="New document transfer request",
        message=f"{sender_displayname} wants to transfer a document to you.",
        document=document,
    )


# Invariant: Document has already been transferred
def accepted_document_transfer_request(document: Document, old_owner: User):
    target_user_displayname = get_my_user(document.author).displayname()

    send_doc_notification(
        sender=document.author,
        receiver=old_owner,
        type_=NotificationType.DOCUMENT_TRANSFER,
        title="Document transfer request accepted",
        message=f"{target_user_displayname} has accepted your document transfer.",
        document=document,
    )
