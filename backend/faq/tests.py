from faq.models import FAQuestion
from testing.tests import ComsolTest


class TestFAQ(ComsolTest):
    test_http_methods = False

    def test_add_remove(self):
        faq = {
            "question": "Test Question",
            "answer": "Test Answer",
            "order": 42,
        }
        new_id = self.post(
            "/api/faq/",
            {
                "question": "Test Question",
                "answer": "Test Answer",
                "order": 42,
            },
        )["value"]["oid"]
        res = self.get("/api/faq/")["value"]
        self.assertEqual(1, len(res))
        self.assertEqual(faq["question"], res[0]["question"])
        self.assertEqual(faq["answer"], res[0]["answer"])
        self.delete(f"/api/faq/{new_id}/", as_json=False)
        res = self.get("/api/faq/")["value"]
        self.assertEqual(0, len(res))

    def test_set(self):
        faq = FAQuestion(question="Test", answer="Test", order=0)
        faq.save()
        new_faq = {
            "question": "Test Question",
            "answer": "Test Answer",
            "order": 42,
        }
        self.put(f"/api/faq/{faq.pk}/", new_faq)
        faq.refresh_from_db()
        self.assertEqual(faq.question, new_faq["question"])
        self.assertEqual(faq.answer, new_faq["answer"])
        self.assertEqual(faq.order, new_faq["order"])

    def test_order(self):
        perm = [5, 2, 4, 1, 8, 3]
        for x in perm:
            self.post(
                "/api/faq/",
                {
                    "question": str(x),
                    "answer": str(x),
                    "order": x,
                },
            )
        res = self.get("/api/faq/")["value"]
        self.assertEqual(len(perm), len(res))
        for re, x in zip(res, sorted(perm), strict=True):
            self.assertEqual(re["question"], str(x))
            self.assertEqual(re["answer"], str(x))

    def test_swap(self):
        for i in range(4):
            self.post(
                "/api/faq/",
                {
                    "question": str(i),
                    "answer": str(i),
                    "order": i,
                },
            )

        res = self.get("/api/faq/")["value"]

        self.put(f"/api/faq/swap/{res[0]['oid']}/{res[1]['oid']}", {}, as_json=False)
        self.put(f"/api/faq/swap/{res[2]['oid']}/{res[3]['oid']}", {}, as_json=False)

        res_new = self.get("/api/faq/")["value"]

        expected_order = [res[1], res[0], res[3], res[2]]

        new_ids = [r["oid"] for r in res_new]
        old_ids = [r["oid"] for r in expected_order]

        self.assertEqual(new_ids, old_ids)
