from django.core.files.uploadedfile import SimpleUploadedFile

from answers.models import Exam
from categories.models import Category
from testing.tests import ComsolTest


class TestFiles(ComsolTest):
    # As these tests will add files to s3,
    # we have to make sure we remove everything again

    def exam_file(self):
        return SimpleUploadedFile(
            "file.pdf", b"file_content", content_type="application/pdf"
        )

    def test_upload_exam(self):
        filename = self.post(
            "/api/exam/upload/exam/",
            {
                "category": "default",
                "displayname": "Test",
                "file": self.exam_file(),
            },
        )["filename"]
        response = self.get(f"/api/exam/pdf/exam/{filename}/", as_json=False)
        self.assertEqual(response.status_code, 200)
        self.post(f"/api/exam/remove/exam/{filename}/", {})

    def test_upload_transcript(self):
        self.post(
            "/api/exam/upload/transcript/",
            {
                "category": "default",
                "file": self.exam_file(),
            },
            status_code=400,
        )
        category = Category.objects.get(slug="default")
        category.has_payments = True
        category.save()
        filename = self.post(
            "/api/exam/upload/transcript/",
            {
                "category": "default",
                "file": self.exam_file(),
            },
        )["filename"]
        response = self.get(f"/api/exam/pdf/exam/{filename}/", as_json=False)
        exam = Exam.objects.get(filename=filename)
        self.assertTrue(exam.is_oral_transcript)
        self.assertEqual(exam.exam_type.displayname, "Transcripts")
        self.post(f"/api/exam/remove/exam/{filename}/", {})

    def test_upload_printonly(self):
        filename = self.post(
            "/api/exam/upload/exam/",
            {
                "category": "default",
                "displayname": "Test",
                "file": self.exam_file(),
            },
        )["filename"]
        self.post(
            "/api/exam/upload/printonly/",
            {
                "filename": filename,
                "file": self.exam_file(),
            },
        )
        response = self.get(f"/api/exam/pdf/printonly/{filename}/", as_json=False)
        self.post(f"/api/exam/remove/printonly/{filename}/", {})
        self.post(f"/api/exam/remove/exam/{filename}/", {})

    def test_upload_solution(self):
        filename = self.post(
            "/api/exam/upload/exam/",
            {
                "category": "default",
                "displayname": "Test",
                "file": self.exam_file(),
            },
        )["filename"]
        self.post(
            "/api/exam/upload/solution/",
            {
                "filename": filename,
                "file": self.exam_file(),
            },
        )
        response = self.get(f"/api/exam/pdf/solution/{filename}/", as_json=False)
        self.post(f"/api/exam/remove/solution/{filename}/", {})
        self.post(f"/api/exam/remove/exam/{filename}/", {})


# TODO: test printonly (among others: check that only admins can see it)
# TODO: test zip export
# TODO: test printing (probably not possible locally)
# TODO: test access right checks
