from django.middleware.gzip import GZipMiddleware

"""
We don't use GZipMiddleware directly to avoid
compressing files from S3, e.g. PDFs which aren't very compressible.
"""

_COMPRESSIBLE_CONTENT_TYPES = frozenset(
    (
        "application/json",
        "application/wasm",
        "application/x-tex",
        "image/svg+xml",
        "image/x-icon",
    )
)


def _is_compressible(content_type: str) -> bool:
    media_type = content_type.split(";", 1)[0].strip().lower()

    return media_type.startswith("text/") or media_type in _COMPRESSIBLE_CONTENT_TYPES


class ContentTypeAwareGZipMiddleware(GZipMiddleware):
    def process_response(self, request, response):
        if not _is_compressible(response.get("Content-Type", "")):
            return response

        return super().process_response(request, response)
