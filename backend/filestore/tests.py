from django.conf import settings

from answers.models import Exam, ExamType
from categories.models import Category
from testing.tests import ComsolTest


class TestUploadDownload(ComsolTest):
    def test_upload_and_download_category(self):
        category = Category(
            displayname="Test Category",
            slug="TestCategory",
        )
        category.save()

        with open(f"{settings.COMSOL_ASSETS_FOLDER}/exam10.pdf", "rb") as f:
            res = self.post(
                "/api/filestore/upload/",
                {
                    "displayname": "Test",
                    "category": category.slug,
                    "file": f,
                },
                test_get=False,
            )
            filename = res["value"]["filename"]

        self.get(f"/api/filestore/get/{filename}/", as_json=False)
        self.delete(f"/api/filestore/remove/{filename}/", as_json=False)

    def test_upload_and_download_exam(self):
        exam_type = ExamType.objects.first()
        exam = Exam(
            displayname="Test Exam",
            filename="coffee.pdf",
            exam_type=exam_type,
        )
        exam.save()

        with open(f"{settings.COMSOL_ASSETS_FOLDER}/exam10.pdf", "rb") as f:
            res = self.post(
                "/api/filestore/upload/",
                {
                    "displayname": "Test",
                    "exam": exam.filename,
                    "file": f,
                },
                test_get=False,
            )
            filename = res["value"]["filename"]

        self.get(f"/api/filestore/get/{filename}/", as_json=False)
        self.delete(f"/api/filestore/remove/{filename}/", as_json=False)
