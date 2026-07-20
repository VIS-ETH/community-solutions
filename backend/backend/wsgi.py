"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from gevent.monkey import is_module_patched

# Only patch under gevent to avoid file descriptor leak
if is_module_patched("socket"):
    from psycogreen.gevent import patch_psycopg

    patch_psycopg()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

application = get_wsgi_application()
