from feedback.models import Feedback
from testing.tests import ComsolTest


class TestSubmit(ComsolTest):
    def test_submit(self):
        self.post("/api/feedback/submit/", {"text": "test"}, as_json=False)
        res = self.get("/api/feedback/list/")[0]
        self.assertEqual(res["text"], "test")
        self.assertEqual(res["author"], self.user["username"])
        self.assertEqual(res["authorDisplayName"], self.user["displayname"])

    def test_list(self):
        for i in range(11):
            Feedback(
                author=self.get_my_user(),
                text="Test " + str(i),
            ).save()
        res = self.get("/api/feedback/list/")
        self.assertEqual(len(res), 11)

    def check_flags(self, read, done):
        res = self.get("/api/feedback/list/")[0]
        self.assertEqual(res["read"], read)
        self.assertEqual(res["done"], done)

    def test_flags(self):
        feedback = Feedback(author=self.get_my_user(), text="Test")
        feedback.save()
        self.check_flags(False, False)
        self.post(f"/api/feedback/flags/{feedback.id}/", {"read": True}, as_json=False)
        self.check_flags(True, False)
        self.post(f"/api/feedback/flags/{feedback.id}/", {"done": True}, as_json=False)
        self.check_flags(True, True)
        self.post(
            f"/api/feedback/flags/{feedback.id}/",
            {
                "read": False,
                "done": False,
            },
            as_json=False,
        )
        self.check_flags(False, False)
