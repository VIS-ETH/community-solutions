from django.db import migrations


def normalise_order(apps, schema_editor):
    from documents.api import normalise_document_order
    from documents.models import Document

    for document in Document.objects.all():
        normalise_document_order(document)


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0017_comment_marked_as_ai"),
    ]

    operations = [
        migrations.RunPython(normalise_order, migrations.RunPython.noop),
    ]
