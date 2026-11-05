import json

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.http import Http404
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.static import serve as static_serve

from answers.models import Exam
from util import response


@ensure_csrf_cookie
def index(request):
    context = {
        "BRANDING_URL": settings.FRONTEND_BRANDING_URL,
        "KEYCLOAK_URL": settings.COMSOL_FRONTEND_KEYCLOAK_URL,
        "KEYCLOAK_REALM": settings.COMSOL_FRONTEND_KEYCLOAK_REALM,
        "KEYCLOAK_CLIENT_ID": settings.COMSOL_FRONTEND_KEYCLOAK_CLIENT_ID,
        "FAVICON_URL": settings.FAVICON_URL,
        "SERVER_DATA": json.dumps(settings.FRONTEND_SERVER_DATA),
    }
    return render(request, "index.html", context)


def favicon(request):
    return response.send_file("favicon.ico")


def manifest(request):
    return response.send_file("manifest.json")


def branding(request, path):
    try:
        return static_serve(request, path, document_root=settings.BRANDING_DIR)
    except SuspiciousFileOperation:
        raise Http404()


def resolve(request, filename):
    exams = Exam.objects.filter(resolve_alias=filename)
    if not exams.exists():
        return Http404()
    return redirect("/exams/" + exams.first().filename + "/")


@ensure_csrf_cookie
def can_i_haz_csrf_cookie(request):
    return response.success(cookie="no")
