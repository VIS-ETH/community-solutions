import re
from django.conf import settings
from images.models import Image
from util import s3_util

_IMAGE_FILENAME_RE = re.compile(r'!\[.*?\]\(([^)/\s]+)\)')


def extract_image_filenames(text: str) -> set:
    return {m.group(1) for m in _IMAGE_FILENAME_RE.finditer(text)}


def cleanup_removed_images(old_text: str, new_text: str):
    """Delete images that appeared in old_text but not new_text, if no longer referenced anywhere."""
    removed = extract_image_filenames(old_text) - extract_image_filenames(new_text)
    if not removed:
        return

    from answers.models import Answer, Comment as AnswerComment
    from documents.models import Comment as DocumentComment, Document
    from faq.models import FAQuestion

    for filename in removed:
        try:
            image = Image.objects.get(filename=filename)
        except Image.DoesNotExist:
            continue

        if (
            Answer.objects.filter(text__contains=filename).exists()
            or AnswerComment.objects.filter(text__contains=filename).exists()
            or DocumentComment.objects.filter(text__contains=filename).exists()
            or Document.objects.filter(description__contains=filename).exists()
            or FAQuestion.objects.filter(answer__contains=filename).exists()
        ):
            continue

        s3_util.delete_file(settings.COMSOL_IMAGE_DIR, filename)
        image.delete()
