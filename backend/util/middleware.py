from io import BytesIO

from django.http.multipartparser import MultiPartParser


def parse_request_middleware(get_response):
    def middleware(request):
        if request.method == "PUT" or request.method == "PATCH":
            # django-ninja handles PUT/PATCH
            if not request.path.startswith(
                ("/api/document/", "/api/feedback/", "/api/image/")
            ):
                try:
                    parser = MultiPartParser(
                        request.META, BytesIO(request.body), request.upload_handlers
                    )
                    request.DATA, files = parser.parse()
                    request.FILES.update(files)
                except Exception:
                    import traceback

                    traceback.print_exc()
        elif request.method == "POST":
            request.DATA = request.POST
        return get_response(request)

    return middleware
