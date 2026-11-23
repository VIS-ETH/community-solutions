from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from answers.models import Exam, ExamType
from categories.models import Category
from mandates.models import Mandate
from myauth.models import MyUser
from testing.tests import ComsolTest, ComsolTestExamData


class TestMandate(ComsolTest):
    def mySetUp(self):
        self.testuser = MyUser(username="test")
        self.testuser.save()

        self.category = Category(
            displayname="Test Category",
            has_payments=True,
            slug="TestCategory",
        )
        self.category.save()

        self.post(
            "/api/mandates/",
            {"username": "test", "category": "TestCategory"},
        )
        self.mandate = Mandate.objects.get(user__username="test")

    def test_query(self):
        MyUser(username="test2").save()

        self.post(
            "/api/mandates/",
            {"username": "test2", "category": "TestCategory"},
        )
        res = self.get("/api/mandates/?username=test2")
        self.assertEqual(len(res), 1)

    def test_me(self):
        res = self.get(f"/api/mandates/?username={self.user['username']}")
        self.assertEqual(len(res), 0)
        self.post(
            "/api/mandates/",
            {"username": self.user["username"], "category": "TestCategory"},
        )
        res = self.get(f"/api/mandates/?username={self.user['username']}")
        self.assertEqual(len(res), 1)

    def test_category_endpoints_show_due_date(self):
        expected = Mandate.next_due_date().isoformat()
        res = self.get("/api/category/metadata/TestCategory/")
        self.assertEqual(res["mandate_due_date"], expected)
        res = self.get("/api/category/listonlypayment/")
        self.assertEqual([c["mandate_due_date"] for c in res], [expected])

    def test_second_mandate_rejected(self):
        self.post(
            "/api/mandates/",
            {"username": "test", "category": "TestCategory"},
            status_code=400,
        )

    def test_due_date_not_settable(self):
        res = self.post(
            "/api/mandates/",
            {"category": "TestCategory", "due_date": "2099-01-01T00:00:00Z"},
        )
        self.assertEqual(res["due_date"], Mandate.next_due_date().isoformat())

    def set_mandate(self, due_in_days, checked_days_ago=None):
        now = timezone.now()
        due_date = now.date() + timedelta(days=due_in_days)
        fields = {
            "created_time": now - timedelta(days=60),
            "due_date": due_date,
            "fulfilled_time": None,
            "checked_time": None,
            "checked_state": None,
        }
        if checked_days_ago is not None:
            checked = now - timedelta(days=checked_days_ago)
            fields |= {
                "fulfilled_time": checked - timedelta(days=1),
                "checked_time": checked,
                "checked_state": Mandate.CheckedState.REJECTED,
            }
        Mandate.objects.filter(pk=self.mandate.pk).update(**fields)

    def is_blocked(self):
        return Mandate.user_has_any_nongrace_overdue_mandates("test")

    def test_blocked_from_day_after_due_date(self):
        self.set_mandate(due_in_days=0)
        self.assertFalse(self.is_blocked())
        self.set_mandate(due_in_days=-1)
        self.assertTrue(self.is_blocked())

    def test_rejected_blocked_from_day_after_grace_until(self):
        self.set_mandate(due_in_days=-5, checked_days_ago=10)
        self.assertFalse(self.is_blocked())
        res = self.get("/api/mandates/?username=test")[0]
        self.assertEqual(res["grace_until"], timezone.now().date().isoformat())

        self.set_mandate(due_in_days=-5, checked_days_ago=11)
        self.assertTrue(self.is_blocked())

    def test_rejected_not_blocked_until_due_date(self):
        self.set_mandate(due_in_days=0, checked_days_ago=20)
        self.assertFalse(self.is_blocked())


class TestMandateTranscript(ComsolTest):
    def mySetUp(self):
        for name in ["Test", "Other"]:
            Category(
                displayname=f"{name} Category",
                has_payments=True,
                slug=f"{name}Category",
            ).save()

        self.post("/api/mandates/", {"category": "TestCategory"})
        self.mandate = Mandate.objects.get(user__username=self.user["username"])
        self.uploaded = []

    def myTearDown(self):
        # remove uploads from s3
        for filename in self.uploaded:
            if Exam.objects.filter(filename=filename).exists():
                self.post(f"/api/exam/remove/exam/{filename}/", {}, as_json=False)

    def delete_transcript(self, filename):
        self.post(f"/api/exam/remove/exam/{filename}/", {}, as_json=False)

    def assert_unchanged_after_delete(self, filename):
        before = self.my_mandate()
        self.delete_transcript(filename)
        after = self.my_mandate()
        self.assertIsNone(after["uploaded_transcript"])
        for field in ["fulfilled_at", "checked_at", "checked_state"]:
            self.assertEqual(after[field], before[field])
        return after

    def test_delete_transcript_accepted(self):
        filename = self.upload("TestCategory")
        self.post(f"/api/payment/markexamchecked/{filename}/", {})
        after = self.assert_unchanged_after_delete(filename)
        self.assertEqual(after["checked_state"], "accepted")

    def test_delete_transcript_excused(self):
        filename = self.upload("TestCategory")
        self.excuse()
        after = self.assert_unchanged_after_delete(filename)
        self.assertEqual(after["checked_state"], "excused")

    def test_delete_transcript_awaiting_check(self):
        filename = self.upload("TestCategory")
        after = self.assert_unchanged_after_delete(filename)
        self.assertTrue(after["fulfilled_at"])
        self.assertIsNone(after["checked_state"])
        # without the file it can only be excused (or deleted)
        self.reject_transcript(filename, status_code=404)
        self.assertEqual(self.excuse()["checked_state"], "excused")

    def upload(self, category):
        filename = self.post(
            "/api/exam/upload/transcript/",
            {
                "category": category,
                "file": SimpleUploadedFile(
                    "file.pdf", b"file_content", content_type="application/pdf"
                ),
            },
        )
        self.uploaded.append(filename)
        return filename

    def my_mandate(self):
        return self.get(f"/api/mandates/?username={self.user['username']}")[0]

    def excuse(self, status_code=200, reason="Test reason"):
        return self.post(
            f"/api/mandates/{self.mandate.pk}/excuse/",
            {"reason": reason},
            status_code=status_code,
        )

    def mark_checked(self, filename, status_code=200):
        return self.post(
            f"/api/payment/markexamchecked/{filename}/", {}, status_code=status_code
        )

    def reject_transcript(self, filename, status_code=200):
        return self.post(
            f"/api/mandates/transcript/{filename}/reject/", {}, status_code=status_code
        )

    def test_upload_fulfills(self):
        filename = self.upload("TestCategory")
        res = self.my_mandate()
        self.assertTrue(res["fulfilled_at"])
        self.assertIsNone(res["checked_state"])
        self.assertEqual(res["uploaded_transcript"], filename)

    def test_upload_other_category(self):
        self.upload("OtherCategory")
        res = self.my_mandate()
        self.assertIsNone(res["fulfilled_at"])
        self.assertIsNone(res["uploaded_transcript"])

    def test_upload_again_while_unchecked(self):
        first = self.upload("TestCategory")
        self.upload("TestCategory")
        self.assertEqual(self.my_mandate()["uploaded_transcript"], first)

    def test_upload_after_rejection(self):
        self.reject_transcript(self.upload("TestCategory"))
        self.assertEqual(self.my_mandate()["checked_state"], "rejected")

        filename = self.upload("TestCategory")
        res = self.my_mandate()
        self.assertIsNone(res["checked_state"])
        self.assertIsNone(res["checked_at"])
        self.assertEqual(res["uploaded_transcript"], filename)

    def test_mark_checked(self):
        filename = self.upload("TestCategory")
        self.mark_checked(filename)
        res = self.my_mandate()
        self.assertEqual(res["checked_state"], "accepted")
        self.assertTrue(res["checked_at"])
        self.assertEqual(res["uploaded_transcript"], filename)
        exam = Exam.objects.get(filename=filename)
        self.assertTrue(exam.oral_transcript_checked)
        self.assertTrue(exam.public)

    def test_mark_checked_other_category(self):
        filename = self.upload("TestCategory")
        other = self.upload("OtherCategory")
        self.post(f"/api/payment/markexamchecked/{other}/", {})
        res = self.my_mandate()
        self.assertIsNone(res["checked_state"])
        self.assertEqual(res["uploaded_transcript"], filename)

    def test_reject_keeps_transcript_unchecked(self):
        filename = self.upload("TestCategory")
        self.reject_transcript(filename)
        exam = Exam.objects.get(filename=filename)
        self.assertFalse(exam.oral_transcript_checked)

    def test_check_transitions(self):
        filename = self.upload("TestCategory")
        self.reject_transcript(filename)
        self.reject_transcript(filename, status_code=400)
        self.mark_checked(filename)
        self.reject_transcript(filename, status_code=400)
        self.excuse(status_code=400)
        self.assertEqual(self.my_mandate()["checked_state"], "accepted")

    def test_reject_transcript(self):
        filename = self.upload("TestCategory")
        res = self.reject_transcript(filename)
        self.assertEqual(res["checked_state"], "rejected")
        self.assertEqual(res["uploaded_transcript"], filename)
        # nothing awaiting a check anymore
        self.reject_transcript(filename, status_code=400)
        self.reject_transcript("doesnotexist", status_code=404)

        # a new upload can be rejected again
        filename = self.upload("TestCategory")
        self.reject_transcript(filename)

    def test_excused_is_final(self):
        self.excuse()
        filename = self.upload("TestCategory")
        self.excuse(status_code=400)
        self.reject_transcript(filename, status_code=400)
        self.mark_checked(filename)
        self.assertEqual(self.my_mandate()["checked_state"], "excused")

    def test_excuse_without_upload(self):
        res = self.excuse()
        self.assertEqual(res["checked_state"], "excused")
        self.assertIsNone(res["fulfilled_at"])

        # excused never blocks, even when overdue
        past = timezone.now() - timedelta(days=30)
        Mandate.objects.filter(pk=self.mandate.pk).update(
            created_time=past, due_date=past + timedelta(days=1)
        )
        self.assertFalse(
            Mandate.user_has_any_nongrace_overdue_mandates(self.user["username"])
        )

        # a later upload leaves it excused
        self.upload("TestCategory")
        res = self.my_mandate()
        self.assertEqual(res["checked_state"], "excused")
        self.assertIsNone(res["uploaded_transcript"])

    def test_excuse_requires_reason(self):
        for reason in ["", "  \n\t"]:
            self.excuse(status_code=400, reason=reason)
        self.assertIsNone(self.my_mandate()["checked_state"])
        res = self.excuse(reason=" Moved abroad ")
        self.assertEqual(res["reason"], "Moved abroad")

    def test_reason_constraint(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Mandate.objects.filter(pk=self.mandate.pk).update(
                checked_time=timezone.now(),
                checked_state=Mandate.CheckedState.EXCUSED,
                reason=" ",
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            Mandate.objects.filter(pk=self.mandate.pk).update(
                extended_time=timezone.now()
            )

    def test_filter_checked_state(self):
        url = f"/api/mandates/?username={self.user['username']}&checked_state="
        filename = self.upload("TestCategory")
        self.assertEqual(len(self.get(url + "rejected")), 0)
        self.reject_transcript(filename)
        self.assertEqual(len(self.get(url + "rejected")), 1)
        self.assertEqual(len(self.get(url + "accepted")), 0)


class TestMandateExamAccess(ComsolTestExamData):
    def mySetUp(self):
        self.category.has_payments = True
        self.category.save()
        self.exam.needs_payment = True
        self.exam.has_solution = True
        self.exam.save()
        self.login_as(self.nonAdminUsers[0])

    def add_mandate(self, due_in_days, **fields):
        Mandate.objects.create(
            user=self.get_my_user(),
            category=self.category,
            created_time=timezone.now() - timedelta(days=30),
            due_date=timezone.now().date() + timedelta(days=due_in_days),
            **fields,
        )

    def search_types(self, term):
        res = self.post("/api/exam/search/", {"term": term})
        return {r["type"] for r in res}

    def assert_access(self, expected):
        metadata = self.get(f"/api/exam/metadata/{self.exam.filename}/")
        self.assertEqual(metadata["hasPaid"], expected)
        self.assertEqual(metadata["canView"], expected)
        self.assertEqual(metadata["examFile"] is not None, expected)
        self.assertEqual(metadata["solutionFile"] is not None, expected)
        status = 200 if expected else 403
        for kind in ["exam", "solution"]:
            self.get(f"/api/exam/pdf/{kind}/{self.exam.filename}/", status_code=status)
        self.assertEqual("exam" in self.search_types("Displayname"), expected)
        self.assertEqual("answer" in self.search_types("Answer"), expected)
        self.assertEqual("comment" in self.search_types("Comment"), expected)

        for path in [
            f"cuts/{self.exam.filename}",
            f"cutversions/{self.exam.filename}",
            f"answersection/{self.sections[0].id}",
            f"answer/{self.answers[0].long_id}",
        ]:
            self.get(f"/api/exam/{path}/", status_code=status)
        author = self.users[0]["username"]
        for path in ["listbyuser", "listcommentsbyuser"]:
            self.assertEqual(bool(self.get(f"/api/exam/{path}/{author}/")), expected)
        self.post(
            f"/api/exam/addcomment/{self.answers[0].id}/",
            {"text": "new comment"},
            status_code=status,
        )

    def test_without_mandate(self):
        self.assert_access(False)

    def test_with_mandate(self):
        self.add_mandate(due_in_days=0)
        self.assert_access(True)

    def count_list_queries(self):
        with CaptureQueriesContext(connection) as ctx:
            res = self.get(f"/api/category/listexams/{self.category.slug}/")
        self.assertTrue(all(not ex["canView"] for ex in res))
        return len(ctx.captured_queries)

    def test_list_exams_queries_independent_of_paid_exams(self):
        single = self.count_list_queries()
        for i in range(3):
            Exam.objects.create(
                filename=f"paid{i}.pdf",
                displayname=f"Paid {i}",
                category=self.category,
                exam_type=self.exam.exam_type,
                resolve_alias=f"paid{i}.pdf",
                public=True,
                needs_payment=True,
            )
        self.assertEqual(self.count_list_queries(), single)

    def test_after_due_date(self):
        # awaiting check, so the overdue mandate does not block login
        self.add_mandate(due_in_days=-1, fulfilled_time=timezone.now())
        self.assert_access(False)

    def test_permanent_once_accepted_or_excused(self):
        now = timezone.now()
        self.add_mandate(
            due_in_days=-1,
            fulfilled_time=now - timedelta(days=1),
            checked_time=now,
            checked_state=Mandate.CheckedState.ACCEPTED,
        )
        self.assert_access(True)
        Mandate.objects.update(
            fulfilled_time=None,
            checked_state=Mandate.CheckedState.EXCUSED,
            reason="Test reason",
        )
        self.assert_access(True)


class TestMandateCategoryAdmin(ComsolTest):
    def mySetUp(self):
        self.categories = {}
        for name in ["Own", "Other"]:
            category = Category(
                displayname=f"{name} Category", has_payments=True, slug=name
            )
            category.save()
            self.categories[name] = category
        self.student = self.nonAdminUsers[1]["username"]
        self.login_as(self.nonAdminUsers[1])
        self.login_as(self.nonAdminUsers[0])
        self.categories["Own"].admins.add(self.get_my_user())

    def create(self, category, status_code=200):
        return self.post(
            "/api/mandates/",
            {"username": self.student, "category": category},
            status_code=status_code,
        )

    def test_create_for_other_user(self):
        self.create("Own")
        self.create("Other", status_code=403)

    def test_list_categories_can_manage(self):
        res = self.get("/api/category/listonlypayment/")
        self.assertEqual(
            {c["slug"]: c["can_manage"] for c in res}, {"Own": True, "Other": False}
        )

    def test_list_only_own_categories(self):
        self.create("Own")
        self.login_as(self.adminUsers[0])
        self.create("Other")
        self.login_as(self.nonAdminUsers[0])

        res = self.get(f"/api/mandates/?username={self.student}")
        self.assertEqual([m["category"] for m in res], ["Own"])
        res = self.get("/api/mandates/")
        self.assertEqual([m["category"] for m in res], ["Own"])

    def test_list_requires_category_admin(self):
        self.categories["Own"].admins.clear()
        self.get(f"/api/mandates/?username={self.student}", status_code=403)

    def test_mark_checked(self):
        for slug in ["Own", "Other"]:
            Exam(
                filename=f"{slug}.pdf",
                displayname="Transcript",
                category=self.categories[slug],
                exam_type=ExamType.objects.get(displayname="Transcripts"),
                resolve_alias=f"{slug}.pdf",
                is_oral_transcript=True,
            ).save()
        self.post("/api/payment/markexamchecked/Own.pdf/", {})
        self.post("/api/payment/markexamchecked/Other.pdf/", {}, status_code=403)
        self.assertTrue(Exam.objects.get(filename="Own.pdf").oral_transcript_checked)
        self.assertFalse(Exam.objects.get(filename="Other.pdf").oral_transcript_checked)


class TestMandateManage(ComsolTest):
    def mySetUp(self):
        self.category = Category(
            displayname="Test Category", has_payments=True, slug="TestCategory"
        )
        self.category.save()
        self.student = self.nonAdminUsers[1]
        self.login_as(self.student)
        self.login_as(self.adminUsers[0])
        now = timezone.now()
        self.mandate = Mandate.objects.create(
            user=MyUser.objects.get(username=self.student["username"]),
            category=self.category,
            created_time=now - timedelta(days=60),
            due_date=now.date() - timedelta(days=1),
        )

    def is_blocked(self):
        return Mandate.user_has_any_nongrace_overdue_mandates(self.student["username"])

    def extend(self, status_code=200, reason="Test reason"):
        return self.post(
            f"/api/mandates/{self.mandate.pk}/extend/",
            {"reason": reason},
            status_code=status_code,
        )

    def test_extend_unblocks_for_one_day(self):
        self.assertTrue(self.is_blocked())
        res = self.extend()
        self.assertFalse(self.is_blocked())
        self.assertTrue(res["extended_until"])

        Mandate.objects.filter(pk=self.mandate.pk).update(
            extended_time=timezone.now() - timedelta(days=1, seconds=1)
        )
        self.assertTrue(self.is_blocked())
        # granting again restarts the day
        self.extend()
        self.assertFalse(self.is_blocked())

    def test_extend_requires_reason(self):
        for reason in ["", "   "]:
            self.extend(status_code=400, reason=reason)
        self.assertTrue(self.is_blocked())
        res = self.extend(reason="Exam postponed")
        self.assertEqual(res["reason"], "Exam postponed")

        # kept after the extension expires
        Mandate.objects.filter(pk=self.mandate.pk).update(
            extended_time=timezone.now() - timedelta(days=2)
        )
        self.assertTrue(self.is_blocked())
        self.assertEqual(
            Mandate.objects.get(pk=self.mandate.pk).reason, "Exam postponed"
        )

    def test_extend_rejected_overdue(self):
        checked = timezone.now() - timedelta(days=20)
        Mandate.objects.filter(pk=self.mandate.pk).update(
            fulfilled_time=checked - timedelta(days=1),
            checked_time=checked,
            checked_state=Mandate.CheckedState.REJECTED,
        )
        self.assertTrue(self.is_blocked())
        self.extend()
        self.assertFalse(self.is_blocked())

    def test_extend_requires_blocking_mandate(self):
        Mandate.objects.filter(pk=self.mandate.pk).update(
            due_date=timezone.now().date()
        )
        self.extend(status_code=400)
        Mandate.objects.filter(pk=self.mandate.pk).update(
            due_date=timezone.now().date() - timedelta(days=1),
            checked_time=timezone.now(),
            checked_state=Mandate.CheckedState.EXCUSED,
            reason="Test reason",
        )
        self.extend(status_code=400)

    def test_category_admin_can_manage(self):
        self.login_as(self.nonAdminUsers[0])
        self.extend(status_code=403)
        res = self.get(f"/api/mandates/?username={self.student['username']}", 403)

        self.category.admins.add(self.get_my_user())
        res = self.get(f"/api/mandates/?username={self.student['username']}")
        self.assertTrue(res[0]["can_manage"])
        self.extend()
        self.post(
            f"/api/mandates/{self.mandate.pk}/excuse/",
            {"reason": "Test reason"},
        )
        self.assertFalse(self.is_blocked())
        self.delete(f"/api/mandates/{self.mandate.pk}/", status_code=204, as_json=False)
        self.assertFalse(Mandate.objects.exists())

    def test_owner_cannot_manage(self):
        # not overdue, so the owner can log in
        Mandate.objects.filter(pk=self.mandate.pk).update(
            due_date=timezone.now().date() + timedelta(days=1)
        )
        self.login_as(self.student)
        res = self.get(f"/api/mandates/?username={self.student['username']}")
        self.assertFalse(res[0]["can_manage"])
