from django.db import migrations


def normalise_order(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    DocumentFile = apps.get_model("documents", "DocumentFile")

    for document in Document.objects.all():
        document_files = document.files.order_by("order")

        for order, file in enumerate(document_files):
            file.order = order

        DocumentFile.objects.bulk_update(document_files, ["order"])


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0017_comment_marked_as_ai"),
    ]

    operations = [
        migrations.RunPython(normalise_order, migrations.RunPython.noop),
    ]
