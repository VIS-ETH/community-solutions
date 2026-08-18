from categories.models import Category
from mandates.models import Mandate
from myauth.models import MyUser
from testing.tests import ComsolTest


class TestMandate(ComsolTest):
    def mySetUp(self):
        self.testuser = MyUser(username="test")
        self.testuser.save()

        self.category = Category(
            displayname="Test Category",
            slug="TestCategory",
        )
        self.category.save()

        self.post(
            "/api/mandates/",
            {"username": "test", "category": "TestCategory"},
            test_get=False,
        )
        self.mandate = Mandate.objects.get(user__username="test")

    def test_query(self):
        MyUser(username="test2").save()

        self.post(
            "/api/mandates/",
            {"username": "test2", "category": "TestCategory"},
            test_get=False,
        )
        res = self.get("/api/mandates/?username=test2", test_post=False)["value"]
        self.assertEqual(len(res), 1)

    def test_me(self):
        res = self.get(
            f"/api/mandates/?username={self.user['username']}", test_post=False
        )["value"]
        self.assertEqual(len(res), 0)
        self.post(
            "/api/mandates/",
            {"username": self.user["username"], "category": "TestCategory"},
            test_get=False,
        )
        res = self.get(
            f"/api/mandates/?username={self.user['username']}", test_post=False
        )["value"]
        self.assertEqual(len(res), 1)

    def test_fulfill(self):
        self.post(
            f"/api/mandates/{self.mandate.pk}/fulfill/",
            {},
        )
        res = self.get("/api/mandates/?username=test", test_post=False)["value"]
        self.assertEqual(len(res), 1)
        self.assertTrue(res[0]["fulfilled_at"])

    # def test_refund_twice(self):
    #    self.post(f"/api/payment/refund/{self.payment.id}/", {})
    #    self.post(f"/api/payment/refund/{self.payment.id}/", {}, status_code=400)

    # def test_payment_active(self):
    #    res = self.get("/api/payment/query/test/")["value"]
    #    self.assertTrue(res[0]["active"])
    #    self.payment.payment_time -= timedelta(days=365)
    #    self.payment.save()
    #    res = self.get("/api/payment/query/test/")["value"]
    #    self.assertFalse(res[0]["active"])


# class TestMarkChecked(ComsolTestExamsData):
#    def mySetUp(self):
#        self.testuser = MyUser(username="test")
#        self.testuser.save()
#        self.post("/api/payment/pay/", {"username": "test"})
#        self.payment = Payment.objects.get(user__username="test")
#
#    def test_mark_checked(self):
#        exam = self.exams[0]
#        exam.is_oral_transcript = True
#        exam.oral_transcript_uploader = self.testuser
#        exam.save()
#        res = self.get("/api/payment/query/test/")["value"]
#        self.assertFalse(res[0]["check_time"])
#        self.post(f"/api/payment/markexamchecked/{exam.filename}/", {})
#        res = self.get("/api/payment/query/test/")["value"]
#        self.assertTrue(res[0]["check_time"])
