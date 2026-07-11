def parse_request_middleware(get_response):
    def middleware(request):
        if request.method in ("POST", "PUT", "PATCH"):
            # For PUT/PATCH, request.POST is populated by django-ninja because
            # fix_request_files_middleware runs before this middleware
            request.DATA = request.POST
        return get_response(request)

    return middleware
