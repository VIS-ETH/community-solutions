from answers.models import Answer, AnswerSection
from myauth.models import MyUser
from testing.tests import ComsolTestExamData


class TestExistingAnswer(ComsolTestExamData):
    add_comments = False

    def test_set_answer(self):
        answer = self.answers[0]
        self.post(
            f"/api/exam/setanswer/{answer.answer_section.id}/",
            {
                "text": "New Answer Text",
                "kind": "personal",
            },
        )
        answer.refresh_from_db()
        self.assertEqual(answer.text, "New Answer Text")

    def test_remove_answer(self):
        answer = self.answers[0]
        id = answer.id
        self.post(f"/api/exam/removeanswer/{answer.id}/", {})
        self.assertFalse(Answer.objects.filter(id=id).exists())

    def test_remove_all_answers(self):
        self.assertEqual(Answer.objects.count(), 20)
        for answer in self.answers:
            self.post(f"/api/exam/removeanswer/{answer.id}/", {})
        self.assertEqual(Answer.objects.count(), 0)

    def test_like(self):
        answer = self.answers[1]
        self.assertEqual(answer.upvotes.count(), 0)
        self.assertEqual(answer.downvotes.count(), 0)
        self.post(f"/api/exam/setlike/{answer.id}/", {"like": 1})
        answer.refresh_from_db()
        self.assertEqual(answer.upvotes.count(), 1)
        self.assertEqual(answer.downvotes.count(), 0)
        self.post(f"/api/exam/setlike/{answer.id}/", {"like": -1})
        answer.refresh_from_db()
        self.assertEqual(answer.upvotes.count(), 0)
        self.assertEqual(answer.downvotes.count(), 1)
        self.post(f"/api/exam/setlike/{answer.id}/", {"like": 1})
        answer.refresh_from_db()
        self.assertEqual(answer.upvotes.count(), 1)
        self.assertEqual(answer.downvotes.count(), 0)
        self.post(f"/api/exam/setlike/{answer.id}/", {"like": 0})
        answer.refresh_from_db()
        self.assertEqual(answer.upvotes.count(), 0)
        self.assertEqual(answer.downvotes.count(), 0)

    def test_flag(self):
        answer = self.answers[1]
        self.assertEqual(answer.flagged.count(), 0)
        self.post(f"/api/exam/setanswerflagged/{answer.id}/", {"flagged": False})
        self.post(f"/api/exam/setanswerflagged/{answer.id}/", {"flagged": True})
        answer.refresh_from_db()
        self.assertEqual(answer.flagged.count(), 1)
        self.post(f"/api/exam/setanswerflagged/{answer.id}/", {"flagged": False})
        answer.refresh_from_db()
        self.assertEqual(answer.flagged.count(), 0)

    def test_mark_as_ai(self):
        answer = self.answers[1]
        self.assertEqual(answer.marked_as_ai.count(), 0)
        self.post(
            f"/api/exam/setanswermarkedasai/{answer.id}/",
            {"marked_as_ai": False},
        )
        self.post(
            f"/api/exam/setanswermarkedasai/{answer.id}/",
            {"marked_as_ai": True},
        )
        answer.refresh_from_db()
        self.assertEqual(answer.marked_as_ai.count(), 1)
        self.post(
            f"/api/exam/setanswermarkedasai/{answer.id}/",
            {"marked_as_ai": False},
        )
        answer.refresh_from_db()
        self.assertEqual(answer.marked_as_ai.count(), 0)

    def test_expertvote_nonexpert(self):
        answer = self.answers[1]
        self.post(
            f"/api/exam/setexpertvote/{answer.id}/",
            {"vote": True},
            status_code=403,
        )

    def test_expertvote(self):
        answer = self.answers[1]
        answer.answer_section.exam.category.experts.add(self.get_my_user())
        answer.save()
        self.assertEqual(answer.expertvotes.count(), 0)
        self.post(f"/api/exam/setexpertvote/{answer.id}/", {"vote": False})
        self.post(f"/api/exam/setexpertvote/{answer.id}/", {"vote": True})
        answer.refresh_from_db()
        self.assertEqual(answer.expertvotes.count(), 1)
        self.post(f"/api/exam/setexpertvote/{answer.id}/", {"vote": False})
        answer.refresh_from_db()
        self.assertEqual(answer.expertvotes.count(), 0)


class TestDeleteNonadmin(ComsolTestExamData):
    add_comments = False

    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def test_remove_answer(self):
        answer = self.answers[2]
        id = answer.id
        self.post(f"/api/exam/removeanswer/{answer.id}/", {})
        self.assertFalse(Answer.objects.filter(id=id).exists())

    def test_remove_all_answers(self):
        self.assertEqual(Answer.objects.count(), 20)
        removed = 0
        for answer in self.answers:
            can_remove = answer.author.username == self.user["username"]
            if can_remove:
                removed += 1
            self.post(
                f"/api/exam/removeanswer/{answer.id}/",
                {},
                status_code=200 if can_remove else 403,
            )
        self.assertEqual(removed, 4)
        self.assertEqual(Answer.objects.count(), 20 - removed)


class TestNonexisting(ComsolTestExamData):
    add_comments = False

    def mySetUp(self):
        self.mysection = AnswerSection(
            exam=self.exam,
            author=self.get_my_user(),
            page_num=1,
            rel_height=0.8,
            name="Test",
        )
        self.mysection.save()

    def test_set_answer(self):
        self.assertEqual(self.mysection.answer_set.count(), 0)
        self.assertFalse(
            Answer.objects.filter(
                answer_section=self.mysection, author=self.get_my_user()
            ).exists()
        )
        self.post(
            f"/api/exam/setanswer/{self.mysection.id}/",
            {
                "text": "Test Answer 123",
                "kind": "personal",
            },
        )
        self.assertEqual(self.mysection.answer_set.count(), 1)
        self.assertTrue(
            Answer.objects.filter(
                answer_section=self.mysection, author=self.get_my_user()
            ).exists()
        )


class ResetFlagsMixin:
    add_comments = False

    def flag_by_everyone(self, field):
        # Flagging from multiple users, so that a reset which only removed the
        # flag of the requesting user would not pass these tests.
        answer = self.answers[1]
        for user in self.users:
            getattr(answer, field).add(MyUser.objects.get(username=user["username"]))
        answer.save()
        self.assertEqual(getattr(answer, field).count(), len(self.users))
        return answer


class TestResetFlags(ResetFlagsMixin, ComsolTestExamData):
    def test_reset_flagged(self):
        answer = self.flag_by_everyone("flagged")
        self.post(f"/api/exam/resetanswerflagged/{answer.id}/", {})
        answer.refresh_from_db()
        self.assertEqual(answer.flagged.count(), 0)

    def test_reset_marked_as_ai(self):
        answer = self.flag_by_everyone("marked_as_ai")
        self.post(f"/api/exam/resetanswermarkedasai/{answer.id}/", {})
        answer.refresh_from_db()
        self.assertEqual(answer.marked_as_ai.count(), 0)


class TestResetFlagsNonadmin(ResetFlagsMixin, ComsolTestExamData):
    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def test_reset_flagged(self):
        answer = self.flag_by_everyone("flagged")
        self.post(f"/api/exam/resetanswerflagged/{answer.id}/", {}, status_code=403)
        answer.refresh_from_db()
        self.assertEqual(answer.flagged.count(), len(self.users))

    def test_reset_marked_as_ai(self):
        answer = self.flag_by_everyone("marked_as_ai")
        self.post(f"/api/exam/resetanswermarkedasai/{answer.id}/", {}, status_code=403)
        answer.refresh_from_db()
        self.assertEqual(answer.marked_as_ai.count(), len(self.users))
