from django.conf import settings
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from ninja import Form, Router, Schema

from answers.models import ExamUserSolved
from categories.models import Category, CategoryUserPinned, MetaCategory
from myauth import auth_check
from myauth.models import MyUser, get_my_user
from util import response
from util.schemas import ValueWrapped

router = Router(tags=["Categories"])


@router.get(
    "list/", response={200: ValueWrapped[list[str]]}, operation_id="listCategories"
)
def list_categories(request):
    return {
        "value": list(
            Category.objects.order_by("displayname").values_list(
                "displayname", flat=True
            )
        )
    }


class ListCategoriesWithMetaResponse(Schema):
    displayname: str
    slug: str
    documentcount: int
    examcountpublic: int
    examcountanswered: int
    answerprogress: float
    pinned: bool


@router.get(
    "listwithmeta/",
    response={200: ValueWrapped[list[ListCategoriesWithMetaResponse]]},
    operation_id="listCategoriesWithMeta",
)
def list_categories_with_meta(request):
    pinned_subquery = CategoryUserPinned.objects.filter(
        user=request.user,
        category=OuterRef("pk"),
    )
    categories = (
        Category.objects.select_related("meta")
        .annotate(pinned=Exists(pinned_subquery))
        .order_by("displayname")
        .all()
    )
    res = [
        {
            "displayname": cat.displayname,
            "slug": cat.slug,
            "documentcount": cat.meta.documentcount,
            "examcountpublic": cat.meta.examcount_public,
            "examcountanswered": cat.meta.examcount_answered,
            "answerprogress": cat.answer_progress(),
            "pinned": cat.pinned,
        }
        for cat in categories
    ]
    return {"value": res}


class ListCategoriesBasicResponse(Schema):
    displayname: str
    slug: str


@router.get(
    "listonlyadmin/",
    response={200: ValueWrapped[list[ListCategoriesBasicResponse]]},
    operation_id="listCategoriesOnlyAdmin",
)
@auth_check.require_login
def list_categories_only_admin(request):
    categories = Category.objects.order_by("displayname").all()
    res = [
        {
            "displayname": cat.displayname,
            "slug": cat.slug,
        }
        for cat in categories
        if auth_check.has_admin_rights_for_category(request, cat)
    ]
    return {"value": res}


@router.get(
    "listonlypayment/",
    response={200: ValueWrapped[list[ListCategoriesBasicResponse]]},
    operation_id="listCategoriesOnlyPayment",
)
@auth_check.require_login
def list_categories_only_payment(request):
    res = [
        {
            "displayname": cat.displayname,
            "slug": cat.slug,
        }
        for cat in Category.objects.filter(has_payments=True).order_by("displayname")
    ]
    return {"value": res}


@router.post("add/", response={200: ValueWrapped[str]}, operation_id="addCategory")
@auth_check.require_admin
def add_category(request, category: Form[str]):
    slug = create_category_slug(category)
    cat = Category(
        displayname=category,
        slug=slug,
    )
    cat.save()
    return {"value": slug}


def create_category_slug(category, ignored_pk=None):
    """
    Create a valid and unique slug for the category name
    :param category: category name
    """
    oslug = "".join(
        filter(
            lambda x: x in settings.COMSOL_CATEGORY_SLUG_CHARS,
            category.lower().replace(" ", "_"),
        )
    )
    if oslug == "":
        oslug = "invalid_name"

    def exists(aslug):
        categories = Category.objects.filter(slug=aslug)
        if ignored_pk is not None:
            categories = categories.exclude(pk=ignored_pk)
        return categories.exists()

    slug = oslug
    cnt = 0
    while exists(slug):
        slug = oslug + "_" + str(cnt)
        cnt += 1

    return slug


@router.post("remove/", response={200: None}, operation_id="removeCategory")
@auth_check.require_admin
def remove_category(request, slug: Form[str]):
    cat = get_object_or_404(Category, slug=slug)
    if cat.slug == "default":
        return response.not_possible("Can not delete default category")
    cat.exam_set.update(category=Category.objects.get(slug="default"))
    cat.document_set.update(category=Category.objects.get(slug="default"))
    cat.delete()
    return response.success()


class ListExamsResponse(Schema):
    displayname: str
    filename: str
    category_displayname: str
    needs_payment: bool
    examtype: str
    remark: str
    import_claim: str | None
    import_claim_displayname: str | None
    import_claim_time: str | None
    public: bool
    has_solution: bool
    is_printonly: bool
    finished_cuts: bool
    canView: bool
    count_cuts: int
    count_answered: int
    user_solved: bool


@router.get(
    "listexams/{slug}/",
    response={200: ValueWrapped[list[ListExamsResponse]]},
    operation_id="listExams",
)
def list_exams(request, slug):
    cat = get_object_or_404(Category, slug=slug)

    solved_subquery = ExamUserSolved.objects.filter(
        user=request.user,
        exam=OuterRef("pk"),
    )

    exams = (
        cat.exam_set.select_related("exam_type", "import_claim", "counts")
        .annotate(user_solved=Exists(solved_subquery))
        .all()
    )

    res = sorted(
        [
            {
                "sort-key": ex.sort_key(),
                "displayname": ex.displayname,
                "filename": ex.filename,
                "category_displayname": cat.displayname,
                "needs_payment": ex.needs_payment,
                "examtype": ex.exam_type.displayname if ex.exam_type else "",
                "remark": ex.remark,
                "import_claim": ex.import_claim.username if ex.import_claim else None,
                "import_claim_displayname": (
                    get_my_user(ex.import_claim).displayname()
                    if ex.import_claim
                    else None
                ),
                "import_claim_time": ex.import_claim_time,
                "public": ex.public,
                "has_solution": ex.has_solution,
                "is_printonly": ex.is_printonly,
                "finished_cuts": ex.finished_cuts,
                "canView": ex.current_user_can_view(request),
                "count_cuts": ex.counts.count_cuts,
                "count_answered": ex.counts.count_answered,
                "user_solved": ex.user_solved,
            }
            for ex in exams
        ],
        key=lambda x: x["sort-key"],
        reverse=True,
    )
    for ex in res:
        del ex["sort-key"]
    return {"value": res}


class CategoryDataAttachment(Schema):
    displayname: str
    filename: str


class CategoryData(Schema):
    displayname: str
    slug: str
    admins: list[str]
    experts: list[str]
    semester: str | None
    form: str | None
    permission: str | None
    remark: str
    has_payments: bool
    catadmin: bool
    more_exams_link: str
    pinned: bool
    attachments: list[CategoryDataAttachment]


def get_category_data(request, cat) -> CategoryData:
    pinned = CategoryUserPinned.objects.filter(
        user=request.user,
        category=cat,
    ).exists()

    res = {
        "displayname": cat.displayname,
        "slug": cat.slug,
        "admins": [],
        "experts": [],
        "semester": cat.semester,
        "form": cat.form,
        "permission": cat.permission,
        "remark": cat.remark,
        "has_payments": cat.has_payments,
        "catadmin": auth_check.has_admin_rights_for_category(request, cat),
        "more_exams_link": cat.more_exams_link,
        "pinned": pinned,
        # These values are not needed in the frontend and are expensive to calculate
        # 'examcountpublic': cat.exam_set.filter(public=True).count(),
        # 'examcountanswered': cat.exam_count_answered(),
        # 'answerprogress': cat.answer_progress(),
        "attachments": sorted(
            [
                {
                    "displayname": att.displayname,
                    "filename": att.filename,
                }
                for att in cat.attachment_set.all()
            ],
            key=lambda x: x["displayname"],
        ),
    }
    if auth_check.has_admin_rights_for_category(request, cat):
        res["admins"] = list(cat.admins.all().values_list("username", flat=True))
        res["experts"] = list(cat.experts.all().values_list("username", flat=True))
    return res


@router.get(
    "metadata/{slug}/",
    response={200: ValueWrapped[CategoryData], 404: response.ErrorSchema},
    operation_id="getCategoryMetadata",
)
@auth_check.require_login
def get_metadata(request, slug: str):
    cat = get_object_or_404(Category, slug=slug)
    res = get_category_data(request, cat)
    return {"value": res}


class SetMetadataRequest(Schema):
    displayname: str | None = None
    semester: str | None = None
    form: str | None = None
    permission: str | None = None
    remark: str | None = None
    has_payments: bool | None = None
    more_exams_link: str | None = None


@router.post(
    "setmetadata/{slug}/",
    response={200: ValueWrapped[CategoryData], 404: response.ErrorSchema},
    operation_id="setCategoryMetadata",
)
@auth_check.require_admin
def set_metadata(
    request,
    slug: str,
    data: Form[SetMetadataRequest],
):
    cat = get_object_or_404(Category, slug=slug)
    if data.displayname is not None:
        if cat.slug == "default":
            return response.not_possible("Can not rename default category")
        # prevent whitespaced or empty displaynames
        if data.displayname.strip() == "":
            return response.not_possible("Invalid displayname")
        cat.displayname = data.displayname
        cat.slug = create_category_slug(cat.displayname, cat.pk)
    if data.semester is not None:
        cat.semester = data.semester
    if data.form is not None:
        cat.form = data.form
    if data.permission is not None:
        cat.permission = data.permission
    if data.remark is not None:
        cat.remark = data.remark
    if data.has_payments is not None:
        cat.has_payments = data.has_payments
    if data.more_exams_link is not None:
        cat.more_exams_link = data.more_exams_link
    cat.save()
    res = get_category_data(request, cat)
    return {"value": res}


@router.post(
    "addusertoset/{slug}/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="addUserToCategorySet",
)
@auth_check.require_admin
def add_user_to_set(request, slug: str, key: Form[str], user: Form[str]):
    cat = get_object_or_404(Category, slug=slug)
    user = get_object_or_404(MyUser, username=user)
    if key == "admins":
        if not cat.admins.filter(pk=user.pk).exists():
            cat.admins.add(user)
            cat.save()
    elif key == "experts":
        if not cat.experts.filter(pk=user.pk).exists():
            cat.experts.add(user)
            cat.save()
    else:
        return response.not_possible("Unknown key")
    return response.success()


@router.post(
    "removeuserfromset/{slug}/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="removeUserFromCategorySet",
)
@auth_check.require_admin
def remove_user_from_set(request, slug: str, key: Form[str], user: Form[str]):
    cat = get_object_or_404(Category, slug=slug)
    user = get_object_or_404(MyUser, username=user)
    if key == "admins":
        if cat.admins.filter(pk=user.pk).exists():
            cat.admins.remove(user)
            cat.save()
    elif key == "experts":
        if cat.experts.filter(pk=user.pk).exists():
            cat.experts.remove(user)
            cat.save()
    else:
        return response.not_possible("Unknown key")
    return response.success()


class Meta2CategoryResponse(Schema):
    displayname: str
    categories: list[str]


class Meta1CategoryResponse(Schema):
    displayname: str
    meta2: list[Meta2CategoryResponse]


@router.get(
    "listmetacategories/",
    response={200: ValueWrapped[list[Meta1CategoryResponse]]},
    operation_id="listMetaCategories",
)
def list_metacategories(request):
    categories = (
        MetaCategory.objects.select_related("parent")
        .prefetch_related("metacategory_set", "category_set")
        .all()
    )
    tree = {}
    for cat in categories:
        tree.setdefault(cat.parent, []).append(cat)

    res = []
    for parent, childs in sorted(
        filter(lambda x: x[0] and x[0].parent is None, tree.items()),
        key=lambda x: (x[0].order, x[0].displayname),
    ):
        res.append(
            {
                "displayname": parent.displayname,
                "meta2": [
                    {
                        "displayname": mcat.displayname,
                        "categories": [
                            cat.slug
                            for cat in sorted(
                                mcat.category_set.all(), key=lambda x: x.displayname
                            )
                        ],
                    }
                    for mcat in sorted(childs, key=lambda x: (x.order, x.displayname))
                ],
            }
        )
    return {"value": res}


@router.post(
    "addmetacategory/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="addMetaCategory",
)
@auth_check.require_admin
def add_metacategory(request, meta1: Form[str], meta2: Form[str], category: Form[str]):
    cat = get_object_or_404(Category, slug=category)
    meta1, _ = MetaCategory.objects.get_or_create(displayname=meta1, parent=None)
    meta2, _ = MetaCategory.objects.get_or_create(displayname=meta2, parent=meta1)
    if not meta2.category_set.filter(pk=cat.pk).exists():
        meta2.category_set.add(cat)
    return response.success()


@router.post(
    "removemetacategory/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="removeMetaCategory",
)
@auth_check.require_admin
def remove_metacategory(
    request, meta1: Form[str], meta2: Form[str], category: Form[str]
):
    cat = get_object_or_404(Category, slug=category)
    meta1 = get_object_or_404(MetaCategory, displayname=meta1, parent=None)
    meta2 = get_object_or_404(MetaCategory, displayname=meta2, parent=meta1)
    meta2.category_set.remove(cat)
    if not meta2.category_set.exists():
        meta2.delete()
    if not meta1.metacategory_set.exists():
        meta1.delete()
    return response.success()


@router.post(
    "deletemeta1/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="deleteMetaCategory1",
)
@auth_check.require_admin
def delete_meta1(request, meta1: Form[str]):
    meta1 = get_object_or_404(MetaCategory, displayname=meta1, parent=None)
    meta1.delete()
    return response.success()


@router.post(
    "deletemeta2/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="deleteMetaCategory2",
)
@auth_check.require_admin
def delete_meta2(request, meta1: Form[str], meta2: Form[str]):
    meta1 = get_object_or_404(MetaCategory, displayname=meta1, parent=None)
    meta2 = get_object_or_404(MetaCategory, displayname=meta2, parent=meta1)
    meta2.delete()
    return response.success()


@router.post(
    "editmeta1/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="editMetaCategory1",
)
@auth_check.require_admin
def edit_meta1(request, oldmeta1: Form[str], newmeta1: Form[str]):
    if MetaCategory.objects.filter(displayname=newmeta1, parent=None).exists():
        return response.not_possible("This meta category already exists.")
    meta1 = get_object_or_404(MetaCategory, displayname=oldmeta1, parent=None)
    meta1.displayname = newmeta1
    meta1.save()
    return response.success()


@router.post(
    "editmeta2/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="editMetaCategory2",
)
@auth_check.require_admin
def edit_meta2(
    request,
    meta1: Form[str],
    newmeta1: Form[str],
    oldmeta2: Form[str],
    newmeta2: Form[str],
):
    oldmeta1 = get_object_or_404(MetaCategory, displayname=meta1, parent=None)
    if meta1 != newmeta1:
        newmeta1, _ = MetaCategory.objects.get_or_create(
            displayname=newmeta1, parent=None
        )
    else:
        newmeta1 = oldmeta1
    if MetaCategory.objects.filter(displayname=newmeta2, parent=newmeta1).exists():
        return response.not_possible("This meta category already exists.")
    meta2 = get_object_or_404(MetaCategory, displayname=oldmeta2, parent=oldmeta1)
    meta2.parent = newmeta1
    meta2.displayname = newmeta2
    meta2.save()
    if not oldmeta1.metacategory_set.exists():
        oldmeta1.delete()
    return response.success()


@router.post(
    "setmetacategoryorder/",
    response={204: None, 404: response.ErrorSchema},
    operation_id="setMetaCategoryOrder",
)
@auth_check.require_admin
def set_metacategory_order(
    request, meta1: Form[str], order: Form[int], meta2: Form[str | None] = None
):
    meta1 = get_object_or_404(MetaCategory, displayname=meta1, parent=None)
    if meta2 is not None:
        meta2 = get_object_or_404(MetaCategory, displayname=meta2, parent=meta1)
        meta2.order = int(order)
        meta2.save()
    else:
        meta1.order = int(order)
        meta1.save()
    return response.success()


class CategoryUserPinnedResponse(Schema):
    category_pinned: bool


@router.put(
    "{slug}/pinned/",
    response={200: CategoryUserPinnedResponse, 404: response.ErrorSchema},
    operation_id="setCategoryPin",
)
@auth_check.require_login
def set_category_pin(request, slug: str):
    category = get_object_or_404(Category, slug=slug)
    CategoryUserPinned.objects.update_or_create(
        user=request.user, category=category, defaults={}
    )
    pinned = True
    return {"category_pinned": pinned}


@router.get(
    "{slug}/pinned/",
    response={200: CategoryUserPinnedResponse, 404: response.ErrorSchema},
    operation_id="getCategoryPin",
)
@auth_check.require_login
def get_category_pin(request, slug: str):
    category = get_object_or_404(Category, slug=slug)
    pinned = CategoryUserPinned.objects.filter(
        user=request.user, category=category
    ).exists()
    return {"category_pinned": pinned}


@router.delete(
    "{slug}/pinned/",
    response={200: CategoryUserPinnedResponse, 404: response.ErrorSchema},
    operation_id="deleteCategoryPin",
)
@auth_check.require_login
def delete_category_pin(request, slug: str):
    category = get_object_or_404(Category, slug=slug)
    CategoryUserPinned.objects.filter(user=request.user, category=category).delete()
    pinned = False
    return {"category_pinned": pinned}
