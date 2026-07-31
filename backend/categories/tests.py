from categories.models import Category, MetaCategory
from myauth.models import MyUser
from testing.tests import ComsolTest, ComsolTestExamsData


class TestAddRemove(ComsolTest):
    def test_add_remove(self):
        self.post("/api/category/add/", {"category": "Test Category"})
        res = self.get("/api/category/list/")["value"]
        self.assertEqual(res, ["default", "Test Category"])
        res = self.get("/api/category/listwithmeta/")["value"][1]
        self.assertEqual(res["displayname"], "Test Category")
        self.post("/api/category/remove/", {"slug": res["slug"]})
        res = self.get("/api/category/list/")["value"]
        self.assertEqual(res, ["default"])

    def test_remove_not_existing(self):
        self.post("/api/category/remove/", {"slug": "nonexistant"}, status_code=404)

    def test_remove_default(self):
        self.post("/api/category/remove/", {"slug": "default"}, status_code=400)

    def test_add_twice(self):
        self.post("/api/category/add/", {"category": "Test Category"})
        self.post("/api/category/add/", {"category": "Test Category"})
        res = self.get("/api/category/listwithmeta/")["value"]
        self.assertEqual(len(res), 3)
        self.assertEqual(res[0]["slug"], "default")
        self.assertNotEqual(res[1]["slug"], res[2]["slug"])
        self.assertEqual(res[1]["displayname"], res[2]["displayname"])


class TestList(ComsolTest):
    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def mySetUp(self):
        self.cat1 = Category(displayname="Test 1", slug="test1", has_payments=True)
        self.cat1.save()
        self.cat2 = Category(displayname="Test 2", slug="test2")
        self.cat2.save()
        self.cat2.admins.add(self.get_my_user())
        self.cat2.save()

    def test_list(self):
        res = self.get("/api/category/list/")["value"]
        self.assertEqual(len(res), 3)

    def test_listwithmeta(self):
        res = self.get("/api/category/listwithmeta/")["value"]
        self.assertEqual(len(res), 3)

    def test_admin(self):
        res = self.get("/api/category/listonlyadmin/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["displayname"], self.cat2.displayname)
        self.assertEqual(res[0]["slug"], self.cat2.slug)

    def test_payment(self):
        res = self.get("/api/category/listonlypayment/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["displayname"], self.cat1.displayname)
        self.assertEqual(res[0]["slug"], self.cat1.slug)


class TestMetadata(ComsolTest):
    def mySetUp(self):
        self.cat1 = Category(
            displayname="Test 1",
            slug="test1",
            remark="Test remark",
            semester="HS",
            has_payments=True,
        )
        self.cat1.save()

    def test_get_metadata(self):
        res = self.get("/api/category/metadata/test1/")["value"]
        self.assertEqual(res["displayname"], self.cat1.displayname)
        self.assertEqual(res["slug"], self.cat1.slug)
        self.assertEqual(res["remark"], self.cat1.remark)
        self.assertEqual(res["semester"], self.cat1.semester)
        self.assertEqual(res["has_payments"], self.cat1.has_payments)

    def test_set_metadata(self):
        self.post(
            "/api/category/setmetadata/test1/",
            {
                "remark": "New test remark",
                "semester": "FS",
                "has_payments": False,
            },
        )
        self.cat1.refresh_from_db()
        self.assertEqual(self.cat1.remark, "New test remark")
        self.assertEqual(self.cat1.semester, "FS")
        self.assertEqual(self.cat1.has_payments, False)

    def test_set_slug(self):
        self.post("/api/category/setmetadata/test1/", {"slug": "newslug"})
        self.cat1.refresh_from_db()
        self.assertEqual(self.cat1.slug, "test1")

    def test_add_remove_user(self):
        user, _ = MyUser.objects.get_or_create(username="morica")
        self.post(
            "/api/category/addusertoset/test1/",
            {
                "key": "admins",
                "user": "morica",
            },
        )
        self.cat1.refresh_from_db()
        self.assertTrue(user in self.cat1.admins.all())
        self.assertFalse(user in self.cat1.experts.all())
        self.post(
            "/api/category/removeuserfromset/test1/",
            {
                "key": "admins",
                "user": "morica",
            },
        )
        self.cat1.refresh_from_db()
        self.assertFalse(user in self.cat1.admins.all())
        self.assertFalse(user in self.cat1.experts.all())
        self.post(
            "/api/category/addusertoset/test1/",
            {
                "key": "experts",
                "user": "morica",
            },
        )
        self.cat1.refresh_from_db()
        self.assertFalse(user in self.cat1.admins.all())
        self.assertTrue(user in self.cat1.experts.all())
        self.post(
            "/api/category/removeuserfromset/test1/",
            {
                "key": "experts",
                "user": "morica",
            },
        )
        self.cat1.refresh_from_db()
        self.assertFalse(user in self.cat1.admins.all())
        self.assertFalse(user in self.cat1.experts.all())


class TestListExams(ComsolTestExamsData):
    def test_list_exams(self):
        self.exams[1].public = False
        self.exams[1].save()
        res = self.get("/api/category/listexams/TestCategory/")["value"]
        self.assertEqual(len(res), 3)
        self.assertTrue(res[0]["public"])
        self.assertFalse(res[1]["public"])
        self.assertTrue(res[2]["public"])


class MetaCategoriesMixin:
    def mySetUp(self):
        self.cat1 = Category(displayname="Test 1", slug="test1")
        self.cat1.save()
        self.meta1 = MetaCategory(displayname="Test Meta 1", parent=None)
        self.meta1.save()
        self.meta2 = []
        for i in range(3):
            meta = MetaCategory(displayname="Test Meta 2." + str(i), parent=self.meta1)
            meta.save()
            meta.category_set.add(self.cat1)
            meta.save()
            self.meta2.append(meta)


class TestMetaCategories(MetaCategoriesMixin, ComsolTest):
    def test_list_meta(self):
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(len(res[0]["meta2"]), 3)
        self.assertEqual(len(res[0]["meta2"][0]["categories"]), 1)

    def test_add_meta(self):
        cat = Category(displayname="Test 2", slug="test2")
        cat.save()
        self.post(
            "/api/category/addmetacategory/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.4",
                "category": "test2",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res[0]["meta2"]), 4)
        self.assertEqual(res[0]["meta2"][3]["categories"][0], "test2")
        self.post(
            "/api/category/addmetacategory/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.0",
                "category": "test2",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res[0]["meta2"]), 4)
        self.assertEqual(len(res[0]["meta2"][0]["categories"]), 2)
        self.assertEqual(res[0]["meta2"][0]["categories"][1], "test2")

    def test_remove_meta(self):
        self.post(
            "/api/category/removemetacategory/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.0",
                "category": "test1",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res[0]["meta2"]), 2)
        self.post(
            "/api/category/removemetacategory/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.1",
                "category": "test1",
            },
        )
        self.post(
            "/api/category/removemetacategory/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.2",
                "category": "test1",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 0)

    def test_metacategory_order(self):
        self.post(
            "/api/category/setmetacategoryorder/",
            {
                "meta1": "Test Meta 1",
                "meta2": "Test Meta 2.1",
                "order": 9,
            },
        )

    def test_edit_meta1(self):
        self.post(
            "/api/category/editmeta1/",
            {"oldmeta1": "Test Meta 1", "newmeta1": "Renamed Meta 1"},
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["displayname"], "Renamed Meta 1")
        # Renaming must not detach the children or their categories
        self.assertEqual(len(res[0]["meta2"]), 3)
        self.assertEqual(res[0]["meta2"][0]["categories"], ["test1"])
        self.assertFalse(
            MetaCategory.objects.filter(displayname="Test Meta 1").exists()
        )

    def test_edit_meta1_existing(self):
        other = MetaCategory(displayname="Other Meta 1", parent=None)
        other.save()
        self.post(
            "/api/category/editmeta1/",
            {"oldmeta1": "Test Meta 1", "newmeta1": "Other Meta 1"},
            status_code=400,
        )
        self.meta1.refresh_from_db()
        self.assertEqual(self.meta1.displayname, "Test Meta 1")

    def test_edit_meta1_not_existing(self):
        self.post(
            "/api/category/editmeta1/",
            {"oldmeta1": "nonexistant", "newmeta1": "Renamed Meta 1"},
            status_code=404,
        )

    def test_edit_meta2(self):
        self.post(
            "/api/category/editmeta2/",
            {
                "meta1": "Test Meta 1",
                "newmeta1": "Test Meta 1",
                "oldmeta2": "Test Meta 2.0",
                "newmeta2": "Renamed Meta 2",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(len(res[0]["meta2"]), 3)
        # meta2 entries are listed sorted by (order, displayname)
        self.assertEqual(res[0]["meta2"][0]["displayname"], "Renamed Meta 2")
        self.assertEqual(res[0]["meta2"][0]["categories"], ["test1"])

    def test_edit_meta2_new_parent(self):
        self.post(
            "/api/category/editmeta2/",
            {
                "meta1": "Test Meta 1",
                "newmeta1": "Test Meta 1b",
                "oldmeta2": "Test Meta 2.0",
                "newmeta2": "Test Meta 2.0",
            },
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 2)
        self.assertEqual(res[0]["displayname"], "Test Meta 1")
        self.assertEqual(len(res[0]["meta2"]), 2)
        # The new parent is created on the fly
        self.assertEqual(res[1]["displayname"], "Test Meta 1b")
        self.assertEqual(len(res[1]["meta2"]), 1)
        self.assertEqual(res[1]["meta2"][0]["displayname"], "Test Meta 2.0")

    def test_edit_meta2_new_parent_all(self):
        for meta2 in self.meta2:
            self.post(
                "/api/category/editmeta2/",
                {
                    "meta1": "Test Meta 1",
                    "newmeta1": "Test Meta 1b",
                    "oldmeta2": meta2.displayname,
                    "newmeta2": meta2.displayname,
                },
            )
        # The old parent is removed once it has no children left
        self.assertFalse(
            MetaCategory.objects.filter(displayname="Test Meta 1").exists()
        )
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["displayname"], "Test Meta 1b")
        self.assertEqual(len(res[0]["meta2"]), 3)

    def test_edit_meta2_existing(self):
        self.post(
            "/api/category/editmeta2/",
            {
                "meta1": "Test Meta 1",
                "newmeta1": "Test Meta 1",
                "oldmeta2": "Test Meta 2.0",
                "newmeta2": "Test Meta 2.1",
            },
            status_code=400,
        )
        self.meta2[0].refresh_from_db()
        self.assertEqual(self.meta2[0].displayname, "Test Meta 2.0")

    def test_edit_meta2_not_existing(self):
        self.post(
            "/api/category/editmeta2/",
            {
                "meta1": "Test Meta 1",
                "newmeta1": "Test Meta 1",
                "oldmeta2": "nonexistant",
                "newmeta2": "Renamed Meta 2",
            },
            status_code=404,
        )

    def test_delete_meta1(self):
        self.post("/api/category/deletemeta1/", {"meta1": "Test Meta 1"})
        # Deleting a meta1 cascades to its children
        self.assertEqual(MetaCategory.objects.count(), 0)
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res), 0)
        # The categories themselves are not affected
        self.assertTrue(Category.objects.filter(slug="test1").exists())

    def test_delete_meta1_not_existing(self):
        self.post(
            "/api/category/deletemeta1/", {"meta1": "nonexistant"}, status_code=404
        )

    def test_delete_meta2(self):
        self.post(
            "/api/category/deletemeta2/",
            {"meta1": "Test Meta 1", "meta2": "Test Meta 2.0"},
        )
        self.assertEqual(MetaCategory.objects.count(), 3)
        res = self.get("/api/category/listmetacategories/")["value"]
        self.assertEqual(len(res[0]["meta2"]), 2)
        self.assertTrue(Category.objects.filter(slug="test1").exists())

    def test_delete_meta2_not_existing(self):
        self.post(
            "/api/category/deletemeta2/",
            {"meta1": "Test Meta 1", "meta2": "nonexistant"},
            status_code=404,
        )


class TestMetaCategoriesNonadmin(MetaCategoriesMixin, ComsolTest):
    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def test_edit_meta1(self):
        self.post(
            "/api/category/editmeta1/",
            {"oldmeta1": "Test Meta 1", "newmeta1": "Renamed Meta 1"},
            status_code=403,
        )
        self.meta1.refresh_from_db()
        self.assertEqual(self.meta1.displayname, "Test Meta 1")

    def test_edit_meta2(self):
        self.post(
            "/api/category/editmeta2/",
            {
                "meta1": "Test Meta 1",
                "newmeta1": "Test Meta 1",
                "oldmeta2": "Test Meta 2.0",
                "newmeta2": "Renamed Meta 2",
            },
            status_code=403,
        )
        self.meta2[0].refresh_from_db()
        self.assertEqual(self.meta2[0].displayname, "Test Meta 2.0")

    def test_delete_meta1(self):
        self.post(
            "/api/category/deletemeta1/", {"meta1": "Test Meta 1"}, status_code=403
        )
        self.assertEqual(MetaCategory.objects.count(), 4)

    def test_delete_meta2(self):
        self.post(
            "/api/category/deletemeta2/",
            {"meta1": "Test Meta 1", "meta2": "Test Meta 2.0"},
            status_code=403,
        )
        self.assertEqual(MetaCategory.objects.count(), 4)


# TODO: test whether the counts returned in list_exams and withmeta are correct
