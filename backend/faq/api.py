from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import Form, Router, Schema

from faq.models import FAQuestion
from myauth import auth_check
from util.schemas import ErrorSchema, ValueWrapped

router = Router(tags=["Faq"])


class FaqEntry(Schema):
    oid: int
    question: str
    answer: str
    order: int


def get_faq_obj(faq: FAQuestion) -> FaqEntry:
    return FaqEntry(
        oid=faq.pk,
        question=faq.question,
        answer=faq.answer,
        order=faq.order,
    )


@router.get(
    "/",
    response={
        200: ValueWrapped[list[FaqEntry]],
        401: ErrorSchema,
    },
    operation_id="listFaqEntries",
)
@auth_check.require_login
def list_faq_entries(request):
    res = [get_faq_obj(q) for q in FAQuestion.objects.order_by("order", "pk").all()]

    return {
        "value": res,
    }


class NewFaqEntrySchema(Schema):
    question: str
    answer: str
    order: int


@router.post(
    "/",
    response={
        200: ValueWrapped[FaqEntry],
        401: ErrorSchema,
        403: ErrorSchema,
    },
    operation_id="addFaqEntry",
)
@auth_check.require_admin
def add_faq_entry(request, body: Form[NewFaqEntrySchema]):
    faq = FAQuestion(
        question=body.question,
        answer=body.answer,
        order=body.order,
    )
    faq.save()
    return {"value": get_faq_obj(faq)}


@router.get(
    "{id}/",
    response={
        200: ValueWrapped[FaqEntry],
        401: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="getFaqEntry",
)
@auth_check.require_login
def get_faq_entry(request, id: int):
    faq = get_object_or_404(FAQuestion, pk=id)
    return {
        "value": get_faq_obj(faq),
    }


class UpdateFaqEntrySchema(Schema):
    question: str | None = None
    answer: str | None = None
    order: int | None = None


@router.put(
    "{id}/",
    response={
        200: ValueWrapped[FaqEntry],
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="updateFaqEntry",
)
@auth_check.require_admin
def update_faq_entry(request, id: int, body: Form[UpdateFaqEntrySchema]):
    faq = get_object_or_404(FAQuestion, pk=id)

    if body.question is not None:
        faq.question = body.question
    if body.answer is not None:
        faq.answer = body.answer
    if body.order is not None:
        faq.order = body.order

    faq.save()
    return {"value": get_faq_obj(faq)}


@router.delete(
    "{id}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="removeFaqEntry",
)
@auth_check.require_admin
def remove_faq_entry(request, id: int):
    faq = get_object_or_404(FAQuestion, pk=id)
    faq.delete()


@router.put(
    "swap/{id_a}/{id_b}/",
    response={
        200: None,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    operation_id="swapFaqEntries",
)
@auth_check.require_admin
def swap_faq_entries(request, id_a: int, id_b: int):
    faq_a = get_object_or_404(FAQuestion, pk=id_a)
    faq_b = get_object_or_404(FAQuestion, pk=id_b)

    faq_a.order, faq_b.order = faq_b.order, faq_a.order

    with transaction.atomic():
        faq_a.save()
        faq_b.save()
