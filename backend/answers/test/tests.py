from datetime import timedelta

from answers.models import ExamUserSolved
from testing.tests import ComsolTestExamData


class TestMetadata(ComsolTestExamData):
    add_sections = False

    def test_metadata(self):
        res = self.get(f"/api/exam/metadata/{self.exam.filename}/")["value"]
        self.assertEqual(res["filename"], self.exam.filename)
        self.assertEqual(res["displayname"], self.exam.displayname)
        self.assertEqual(res["examtype"], self.exam.exam_type.displayname)
        self.assertEqual(res["remark"], self.exam.remark)
        self.assertEqual(res["resolve_alias"], self.exam.resolve_alias)
        self.assertEqual(res["public"], self.exam.public)
        self.assertEqual(res["finished_cuts"], self.exam.finished_cuts)
        self.assertEqual(res["needs_payment"], self.exam.needs_payment)
        self.assertEqual(res["dark_mode_warning"], self.exam.dark_mode_warning)

    def test_set_metadata(self):
        self.post(
            f"/api/exam/setmetadata/{self.exam.filename}/",
            {
                "displayname": "New Displayname",
                "category": "default",
                "examtype": "Transcripts",
                "resolve_alias": "new_resolve_alias.pdf",
                "remark": "New remark",
                "public": False,
                "finished_cuts": False,
                "needs_payment": True,
                "solution_printonly": True,
                "dark_mode_warning": True,
            },
        )
        self.exam.refresh_from_db()
        self.test_metadata()
        self.post(
            f"/api/exam/setmetadata/{self.exam.filename}/",
            {
                "filename": "cannotchange.pdf",
            },
        )
        res = self.get(f"/api/exam/metadata/{self.exam.filename}/")["value"]
        self.assertNotEqual(res["filename"], "cannotchange.pdf")


class TestClaim(ComsolTestExamData):
    add_sections = False

    def test_claim(self):
        self.assertEqual(self.exam.import_claim, None)
        self.post(f"/api/exam/claimexam/{self.exam.filename}/", {"claim": True})
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.import_claim.username, self.user["username"])
        self.post(f"/api/exam/claimexam/{self.exam.filename}/", {"claim": False})
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.import_claim, None)

    def test_claim_reset(self):
        self.post(f"/api/exam/claimexam/{self.exam.filename}/", {"claim": True})
        self.exam.refresh_from_db()

        self.user = self.adminUsers[1]

        self.post(
            f"/api/exam/claimexam/{self.exam.filename}/",
            {"claim": True},
            status_code=400,
        )

        self.exam.import_claim_time = self.exam.import_claim_time - timedelta(hours=5)
        self.exam.save()
        self.post(f"/api/exam/claimexam/{self.exam.filename}/", {"claim": True})

        self.exam.refresh_from_db()
        self.assertEqual(
            self.exam.import_claim.username, self.adminUsers[1]["username"]
        )

        self.user = self.adminUsers[1]


class TestUserSolved(ComsolTestExamData):
    add_sections = False

    def test_user_solved(self):
        url = f"/api/exam/{self.exam.filename}/usersolved"
        self.assertFalse(self.get(url)["user_solved"])
        self.assertTrue(self.put(url, {})["user_solved"])
        self.assertTrue(self.get(url)["user_solved"])
        self.assertEqual(ExamUserSolved.objects.count(), 1)
        self.assertFalse(self.delete(url)["user_solved"])
        self.assertFalse(self.get(url)["user_solved"])
        self.assertEqual(ExamUserSolved.objects.count(), 0)

    def test_mark_solved_twice(self):
        url = f"/api/exam/{self.exam.filename}/usersolved"
        self.put(url, {})
        self.put(url, {})
        self.assertEqual(ExamUserSolved.objects.count(), 1)

    def test_unmark_not_solved(self):
        # Unmarking an exam which was never marked is not an error
        url = f"/api/exam/{self.exam.filename}/usersolved"
        self.assertFalse(self.delete(url)["user_solved"])
        self.assertEqual(ExamUserSolved.objects.count(), 0)

    def test_user_solved_is_per_user(self):
        url = f"/api/exam/{self.exam.filename}/usersolved"
        self.put(url, {})
        self.user = self.adminUsers[1]
        self.assertFalse(self.get(url)["user_solved"])
        self.put(url, {})
        self.assertEqual(ExamUserSolved.objects.count(), 2)
        self.delete(url)
        self.user = self.adminUsers[0]
        # Unmarking for one user leaves the marker of the other one intact
        self.assertTrue(self.get(url)["user_solved"])

    def test_not_existing_exam(self):
        self.get("/api/exam/nonexistant.pdf/usersolved", status_code=404, as_json=False)
