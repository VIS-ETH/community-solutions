from datetime import datetime

from django.http import FileResponse, JsonResponse


def data_dumper(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj


def success(**obj):
    return JsonResponse(obj, json_dumps_params={"default": data_dumper})


def unauthorized():
    return JsonResponse({"err": "Unauthorized"}, status=401)


def not_allowed():
    return JsonResponse({"err": "Not allowed"}, status=403)


def not_found():
    return JsonResponse({"err": "Not found"}, status=404)


def not_possible(msg):
    return JsonResponse({"err": msg}, status=400)


def unsupported_media_type():
    return JsonResponse({"err": "Unsupported Media Type"}, status=415)


def internal_error():
    return JsonResponse({"err": "Internal Server Error"}, status=500)


def send_file(file_, **kwargs):
    return FileResponse(open(file_, "rb"), **kwargs)


def send_file_obj(file_obj, filename, as_attachment=False, **kwargs):
    return FileResponse(
        file_obj, filename=filename, as_attachment=as_attachment, **kwargs
    )
