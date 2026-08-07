from answers.models import Comment
from myauth.models import MyUser
from testing.tests import ComsolTestExamData


class TestComment(ComsolTestExamData):
    def test_flag(self):
        comment = self.comments[1]
        self.assertEqual(comment.flagged.count(), 0)
        self.post(f"/api/exam/setcommentflagged/{comment.id}/", {"flagged": False})
        self.post(f"/api/exam/setcommentflagged/{comment.id}/", {"flagged": True})
        comment.refresh_from_db()
        self.assertEqual(comment.flagged.count(), 1)
        self.post(f"/api/exam/setcommentflagged/{comment.id}/", {"flagged": False})
        comment.refresh_from_db()
        self.assertEqual(comment.flagged.count(), 0)

    def test_mark_as_ai(self):
        comment = self.comments[1]
        self.assertEqual(comment.marked_as_ai.count(), 0)
        self.post(
            f"/api/exam/setcommentmarkedasai/{comment.id}/",
            {"markedAsAi": False},
        )
        self.post(
            f"/api/exam/setcommentmarkedasai/{comment.id}/",
            {"markedAsAi": True},
        )
        comment.refresh_from_db()
        self.assertEqual(comment.marked_as_ai.count(), 1)
        self.post(
            f"/api/exam/setcommentmarkedasai/{comment.id}/",
            {"markedAsAi": False},
        )
        comment.refresh_from_db()
        self.assertEqual(comment.marked_as_ai.count(), 0)

    def test_add_comment(self):
        answer = self.answers[0]
        self.assertEqual(answer.comments.count(), 4)
        self.post(f"/api/exam/addcomment/{answer.id}/", {"text": "New Test Comment"})
        answer.refresh_from_db()
        self.assertEqual(answer.comments.count(), 5)

    def test_set_comment(self):
        comment = self.comments[0]
        self.post(
            f"/api/exam/setcomment/{comment.id}/",
            {"text": "New Comment content"},
        )
        comment.refresh_from_db()
        self.assertEqual(comment.text, "New Comment content")

    def test_set_comment_not_me(self):
        comment = self.comments[1]
        self.post(
            f"/api/exam/setcomment/{comment.id}/",
            {"text": "New Comment content"},
            status_code=403,
        )
        comment.refresh_from_db()
        self.assertNotEqual(comment.text, "New Comment content")

    def test_remove_comment(self):
        self.assertEqual(Comment.objects.count(), 80)
        for comment in self.comments:
            self.post(f"/api/exam/removecomment/{comment.id}/", {})
        self.assertEqual(Comment.objects.count(), 0)


class TestCommentNonadmin(ComsolTestExamData):
    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def test_remove_all_comments(self):
        self.assertEqual(Comment.objects.count(), 80)
        removed = 0
        for comment in self.comments:
            can_remove = comment.author.username == self.user["username"]
            if can_remove:
                removed += 1
            self.post(
                f"/api/exam/removecomment/{comment.id}/",
                {},
                status_code=200 if can_remove else 403,
            )
        self.assertEqual(removed, 20)
        self.assertEqual(Comment.objects.count(), 80 - removed)


class ResetFlagsMixin:
    def flag_by_everyone(self, field):
        # Flagging from multiple users, so that a reset which only removed the
        # flag of the requesting user would not pass these tests.
        comment = self.comments[1]
        for user in self.users:
            getattr(comment, field).add(MyUser.objects.get(username=user["username"]))
        comment.save()
        self.assertEqual(getattr(comment, field).count(), len(self.users))
        return comment


class TestResetFlags(ResetFlagsMixin, ComsolTestExamData):
    def test_reset_flagged(self):
        comment = self.flag_by_everyone("flagged")
        self.post(f"/api/exam/resetcommentflagged/{comment.id}/", {})
        comment.refresh_from_db()
        self.assertEqual(comment.flagged.count(), 0)

    def test_reset_marked_as_ai(self):
        comment = self.flag_by_everyone("marked_as_ai")
        self.post(f"/api/exam/resetcommentmarkedasai/{comment.id}/", {})
        comment.refresh_from_db()
        self.assertEqual(comment.marked_as_ai.count(), 0)


class TestResetFlagsNonadmin(ResetFlagsMixin, ComsolTestExamData):
    def setUpLogin(self):
        self.login_as(self.nonAdminUsers[0])

    def test_reset_flagged(self):
        comment = self.flag_by_everyone("flagged")
        self.post(f"/api/exam/resetcommentflagged/{comment.id}/", {}, status_code=403)
        comment.refresh_from_db()
        self.assertEqual(comment.flagged.count(), len(self.users))

    def test_reset_marked_as_ai(self):
        comment = self.flag_by_everyone("marked_as_ai")
        self.post(
            f"/api/exam/resetcommentmarkedasai/{comment.id}/", {}, status_code=403
        )
        comment.refresh_from_db()
        self.assertEqual(comment.marked_as_ai.count(), len(self.users))
