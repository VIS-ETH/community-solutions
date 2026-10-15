import logging

import pypdfium2 as pdfium

from answers.models import (
    ExamPage as ExamPageModel,
)

logger = logging.getLogger(__name__)


def _get_page_text(pdf, path_to_pdf, page):
    if page > len(pdf):
        logger.warning(
            f"Page number out of range when reading PDF text: {path_to_pdf} page {page}"
        )
        return ""

    if page == 0:
        # Have a way to extract text from the entire PDF
        return "\n".join(
            page.get_textpage().get_text_bounded().replace("\r\n", "\n") for page in pdf
        )

    page = pdf[page - 1]

    # PDFium generates text with \r\n line breaks, but we want to use \n for
    # consistency with pdftotext and general text handling in Python
    return page.get_textpage().get_text_bounded().replace("\r\n", "\n")


def analyze_pdf(
    exam,
    path_to_pdf,
    ExamPage=ExamPageModel,
):
    try:
        ExamPage.objects.filter(exam=exam).delete()

        exam_pages = []
        with pdfium.PdfDocument(path_to_pdf) as pdf:
            for page_number in range(1, len(pdf) + 1):
                page = pdf[page_number - 1]
                w, h = page.get_size()
                page_text = _get_page_text(pdf, path_to_pdf, page_number)
                exam_pages.append(
                    ExamPage(
                        exam=exam,
                        page_number=page_number,
                        width=w,
                        height=h,
                        text=page_text,
                    )
                )

        ExamPage.objects.bulk_create(exam_pages)

        return True
    except (FileNotFoundError, pdfium.PdfiumError):
        return False
