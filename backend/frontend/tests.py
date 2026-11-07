import os
import tempfile
from unittest import mock

from django.http import HttpResponse
from django.test import override_settings

from backend.settings import csp_sources, resolve_branding_url
from testing.tests import ComsolTest

VSETH_VIS_URL = "https://static.vseth.ethz.ch/assets/vseth-1116-vis/config.js"


class TestResolveBrandingUrl(ComsolTest):
    def setUpLogin(self):
        self.login_as(None)

    def test_default_is_vseth_vis(self):
        self.assertEqual(resolve_branding_url({}), VSETH_VIS_URL)

    def test_explicit_url_wins(self):
        self.assertEqual(
            resolve_branding_url(
                {
                    "FRONTEND_BRANDING_URL": "/branding/config.js",
                    "FRONTEND_GLOB_ID": "vseth-0000-vseth",
                }
            ),
            "/branding/config.js",
        )

    def test_legacy_glob_id(self):
        self.assertEqual(
            resolve_branding_url({"FRONTEND_GLOB_ID": "vseth-0000-vseth"}),
            "https://static.vseth.ethz.ch/assets/vseth-0000-vseth/config.js",
        )


class TestCspSources(ComsolTest):
    def setUpLogin(self):
        self.login_as(None)

    def test_absolute_url(self):
        self.assertEqual(csp_sources(VSETH_VIS_URL), ["https://static.vseth.ethz.ch"])

    def test_url_with_port(self):
        self.assertEqual(
            csp_sources("http://cdn.example.org:8080/config.js"),
            ["http://cdn.example.org:8080"],
        )

    def test_protocol_relative_url(self):
        self.assertEqual(
            csp_sources("//cdn.example.org/config.js"), ["cdn.example.org"]
        )

    def test_self_hosted_path(self):
        self.assertEqual(csp_sources("/branding/config.js"), [])
        self.assertEqual(csp_sources("/favicon.ico"), [])


class TestBrandingFiles(ComsolTest):
    def setUpLogin(self):
        self.login_as(None)

    def mySetUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.branding_dir = os.path.join(self.tmpdir.name, "branding")
        os.mkdir(self.branding_dir)
        with open(os.path.join(self.branding_dir, "config.js"), "w") as f:
            f.write("window.configOptions = {};")
        # A file next to (not inside) the branding dir, to check traversal is refused.
        with open(os.path.join(self.tmpdir.name, "secret.txt"), "w") as f:
            f.write("secret")
        override = override_settings(BRANDING_DIR=self.branding_dir)
        override.enable()
        self.addCleanup(override.disable)

    def test_serves_config(self):
        res = self.client.get("/branding/config.js")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(b"".join(res.streaming_content), b"window.configOptions = {};")
        self.assertIn("javascript", res["Content-Type"])

    def test_missing_file_is_404(self):
        res = self.client.get("/branding/logo.svg")
        self.assertEqual(res.status_code, 404)

    def test_traversal_is_refused(self):
        for path in ["/branding/../secret.txt", "/branding/%2e%2e/secret.txt"]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 404, path)

    @override_settings(FRONTEND_BRANDING_URL="/branding/config.js")
    def test_index_passes_branding_url(self):
        with mock.patch(
            "frontend.views.render", return_value=HttpResponse("ok")
        ) as render:
            self.client.get("/")
        context = render.call_args.args[2]
        self.assertEqual(context["BRANDING_URL"], "/branding/config.js")
