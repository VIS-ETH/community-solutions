from categories.models import Category
from documents.models import Document, DocumentFile, DocumentType
from myauth.models import MyUser
from notifications.models import Notification, NotificationSetting, NotificationType
from testing.tests import ComsolTest


class ComsolTestDocumentData(ComsolTest):
    def setUp(self, call_my_setup=True):
        super().setUp(call_my_setup=False)
        for user in self.users:
            self.user = user
            self.get("/api/notification/unreadcount/")

        self.category = Category(
            displayname="Test Category",
            slug="TestCategory",
        )
        self.category.save()

        self.document_type = DocumentType(display_name="Documents")
        self.document_type.save()

        self.documents = []

        author = MyUser.objects.get(username=self.nonAdminUsers[0]["username"])
        for i in range(3):
            document = Document(
                display_name=f"Document {i}",
                category=self.category,
                document_type=self.document_type,
                author=author,
            )
            document.save()
            self.documents.append(document)

        if call_my_setup:
            self.mySetUp()


class TestDocumentTransfer(ComsolTestDocumentData):
    def setUp(self, call_my_setup=True):
        super().setUp(call_my_setup=False)

        for user in self.users:
            NotificationSetting(
                user=MyUser.objects.get(username=user["username"]),
                type=NotificationType.DOCUMENT_TRANSFER,
                enabled=True,
            ).save()

        if call_my_setup:
            self.mySetUp()

    def test_put_transfer_as_owner(self):
        target_username = self.nonAdminUsers[1]["username"]

        document = self.documents[0]
        self.login_as(self.nonAdminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": target_username},
            json_body=True,
        )["value"]

        self.assertEqual(res["pending_transfer_user"]["username"], target_username)
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user.username, target_username)

        notification = Notification.objects.filter(
            receiver__username=target_username,
            type=NotificationType.DOCUMENT_TRANSFER,
        ).get()
        self.assertEqual(notification.sender.id, document.author.id)
        self.assertTrue(
            "transfer" in notification.title,
            msg=f'{notification.title=} must contain keyword "transfer".',
        )
        self.assertTrue(
            "transfer" in notification.text,
            msg=f'{notification.text=} must contain keyword "transfer".',
        )

    def test_put_transfer_as_admin(self):
        target_username = self.nonAdminUsers[1]["username"]

        document = self.documents[0]
        self.login_as(self.adminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": target_username},
            json_body=True,
        )["value"]

        self.assertEqual(res["pending_transfer_user"]["username"], target_username)
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user.username, target_username)

    def test_put_transfer_as_unprivileged_user(self):
        target_username = self.nonAdminUsers[1]["username"]

        document = self.documents[0]
        self.login_as(self.nonAdminUsers[1])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": target_username},
            json_body=True,
            status_code=403,
        )["err"]

        self.assertGreater(len(res), 0)
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user, None)

    def test_unset_transfer_as_owner(self):
        old_transfer_target = MyUser.objects.get(
            username=self.nonAdminUsers[1]["username"]
        )

        document = self.documents[0]
        document.pending_transfer_user = old_transfer_target
        document.save()

        self.login_as(self.nonAdminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": None},
            json_body=True,
        )["value"]

        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user, None)

    def test_unset_transfer_as_admin(self):
        old_transfer_target = MyUser.objects.get(
            username=self.nonAdminUsers[1]["username"]
        )

        document = self.documents[0]
        document.pending_transfer_user = old_transfer_target
        document.save()

        self.login_as(self.adminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": None},
            json_body=True,
        )["value"]

        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user, None)

    def test_unset_transfer_as_unprivileged_user(self):
        old_transfer_target = MyUser.objects.get(
            username=self.nonAdminUsers[1]["username"]
        )

        document = self.documents[0]
        document.pending_transfer_user = old_transfer_target
        document.save()

        self.login_as(self.nonAdminUsers[1])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": None},
            json_body=True,
            status_code=403,
        )["err"]

        self.assertGreater(len(res), 0)
        document.refresh_from_db()
        self.assertEqual(document.pending_transfer_user.id, old_transfer_target.id)

    def test_accept_transfer_as_target(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()

        original_owner = document.author

        self.login_as(self.nonAdminUsers[1])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/accept",
            {},
            json_body=True,
        )["value"]

        self.assertEqual(res["author"]["id"], transfer_target.id)
        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )

        document.refresh_from_db()
        self.assertEqual(document.author.id, transfer_target.id)
        self.assertEqual(document.pending_transfer_user, None)

        notification = Notification.objects.filter(
            receiver=original_owner, type=NotificationType.DOCUMENT_TRANSFER
        ).get()
        self.assertEqual(notification.sender.id, transfer_target.id)
        self.assertTrue(
            "accepted" in notification.title,
            msg=f'{notification.title=} must contain keyword "accepted".',
        )
        self.assertTrue(
            "accepted" in notification.text,
            msg=f'{notification.text=} must contain keyword "accepted".',
        )

    def test_accept_transfer_as_admin(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()

        self.login_as(self.adminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/accept",
            {},
            json_body=True,
        )["value"]

        self.assertEqual(res["author"]["id"], transfer_target.id)
        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )

        document.refresh_from_db()
        self.assertEqual(document.author.id, transfer_target.id)
        self.assertEqual(document.pending_transfer_user, None)

    def test_accept_transfer_as_original_author(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()
        original_owner_id = document.author.id

        self.login_as(self.nonAdminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/accept",
            {},
            json_body=True,
            status_code=403,
        )["err"]

        self.assertGreater(len(res), 0)
        document.refresh_from_db()
        self.assertEqual(document.author.id, original_owner_id)
        self.assertEqual(document.pending_transfer_user.id, transfer_target.id)

    def test_reject_transfer_as_target(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()

        original_owner = document.author

        self.login_as(self.nonAdminUsers[1])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/reject",
            {},
            json_body=True,
        )["value"]

        self.assertEqual(res["author"]["id"], original_owner.id)
        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )

        document.refresh_from_db()
        self.assertEqual(document.author.id, original_owner.id)
        self.assertEqual(document.pending_transfer_user, None)

        notification = Notification.objects.filter(
            receiver=original_owner, type=NotificationType.DOCUMENT_TRANSFER
        ).get()
        self.assertEqual(notification.sender.id, transfer_target.id)
        self.assertTrue(
            "rejected" in notification.title,
            msg=f'{notification.title=} must contain keyword "rejected".',
        )
        self.assertTrue(
            "rejected" in notification.text,
            msg=f'{notification.text=} must contain keyword "rejected".',
        )

    def test_reject_transfer_as_admin(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()

        original_owner = document.author

        self.login_as(self.adminUsers[1])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/reject",
            {},
            json_body=True,
        )["value"]

        self.assertEqual(res["author"]["id"], original_owner.id)
        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )

        document.refresh_from_db()
        self.assertEqual(document.author.id, original_owner.id)
        self.assertEqual(document.pending_transfer_user, None)

    def test_reject_transfer_as_original_author(self):
        transfer_target = MyUser.objects.get(username=self.nonAdminUsers[1]["username"])

        document = self.documents[0]
        document.pending_transfer_user = transfer_target
        document.save()

        original_owner_id = document.author.id

        self.login_as(self.nonAdminUsers[0])

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/transfer/reject",
            {},
            json_body=True,
        )["value"]

        self.assertEqual(res["author"]["id"], original_owner_id)
        self.assertFalse(
            "pending_transfer_user" in res,
            'res["pending_transfer_user"] must be unset.',
        )

        document.refresh_from_db()
        self.assertEqual(document.author.id, original_owner_id)
        self.assertEqual(document.pending_transfer_user, None)

    def test_transfer_to_same_user(self):
        target_username = self.nonAdminUsers[0]["username"]

        self.login_as(self.nonAdminUsers[0])
        document = self.documents[0]

        res = self.put(
            f"/api/document/{document.author.username}/{document.slug}/",
            {"pending_transfer_user": target_username},
            json_body=True,
            status_code=400,
        )["err"]

        self.assertTrue("same user" in res, f'{res=} must contain "same user".')


class TestMoveDocumentFile(ComsolTestDocumentData):
    def setUp(self, call_my_setup=True):
        super().setUp(call_my_setup=False)

        self.own_document = self.documents[0]
        self.own_files = [
            DocumentFile(
                document=self.own_document,
                display_name=f"File {i}",
                filename=f"ownfile{i}.pdf",
                mime_type="application/pdf",
                order=i,
            )
            for i in range(2)
        ]
        for f in self.own_files:
            f.save()

        self.foreign_document = Document(
            display_name="Foreign Document",
            category=self.category,
            document_type=self.document_type,
            author=MyUser.objects.get(username=self.nonAdminUsers[1]["username"]),
        )
        self.foreign_document.save()
        self.foreign_file = DocumentFile(
            document=self.foreign_document,
            display_name="Foreign File",
            filename="foreignfile0.pdf",
            mime_type="application/pdf",
            order=1,
        )
        self.foreign_file.save()

        if call_my_setup:
            self.mySetUp()

    def move_url(self, document, filename):
        return (
            f"/api/document/{document.author.username}/{document.slug}"
            f"/files/{filename}/move/"
        )

    def test_move_own_file(self):
        self.login_as(self.nonAdminUsers[0])
        self.post(
            self.move_url(self.own_document, self.own_files[1].filename),
            {"direction": "up"},
            status_code=204,
            as_json=False,
        )
        for f in self.own_files:
            f.refresh_from_db()
        self.assertEqual(self.own_files[0].order, 1)
        self.assertEqual(self.own_files[1].order, 0)

    def test_cannot_move_file_of_other_document(self):
        # Author of own_document passes a file belonging to foreign_document
        self.login_as(self.nonAdminUsers[0])
        self.post(
            self.move_url(self.own_document, self.foreign_file.filename),
            {"direction": "up"},
            status_code=404,
            as_json=False,
        )
        self.foreign_file.refresh_from_db()
        self.assertEqual(self.foreign_file.order, 1)
        for i, f in enumerate(self.own_files):
            f.refresh_from_db()
            self.assertEqual(f.order, i)
