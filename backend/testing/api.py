import logging

from django.db import connection
from ninja import Router

router = Router(tags=["Testing"])


@router.get(
    "long_running_db/",
    response={
        200: str,
    },
    operation_id="longRunningDbQuery",
    tags=["frontend-exclude"],
)
def long_running_db_query(request):
    logging.info("Sending Wait request")

    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_sleep(15)")

    return "DB Query Success"
