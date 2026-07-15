"""Backend regression tests for the Google Classroom OAuth PKCE fix.

Covers:
- /api/classroom/oauth/start persists PKCE code_verifier in Mongo oauth_states.
- The generated authorization URL uses PKCE (code_challenge & S256).
- /api/classroom/oauth/callback returns 302 redirects with classroom_error=...
  for missing code, provider errors (access_denied) and invalid state.
- Existing endpoints still work: GET /api/, /api/auth/me, /api/dashboard/metrics.
"""
import os
import re
import urllib.parse as urlparse

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://educrm-10.preview.emergentagent.com").rstrip("/")
SESSION_TOKEN = "seed_test_session_educrm_1"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def auth_api(api):
    api.headers.update({"Authorization": f"Bearer {SESSION_TOKEN}"})
    return api


# ---------- basic sanity ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True

    def test_auth_me_with_seed(self, auth_api):
        r = auth_api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == "test_professor_1"
        assert data["classroom_connected"] is False

    def test_dashboard_metrics_no_classroom(self, auth_api):
        r = auth_api.get(f"{BASE_URL}/api/dashboard/metrics")
        assert r.status_code == 200
        data = r.json()
        assert data["classroom_connected"] is False


# ---------- classroom oauth start (PKCE) ----------
class TestOAuthStart:
    def test_start_returns_auth_url_with_pkce(self, auth_api, mongo_db):
        r = auth_api.get(f"{BASE_URL}/api/classroom/oauth/start")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "auth_url" in data
        auth_url = data["auth_url"]

        parsed = urlparse.urlparse(auth_url)
        qs = urlparse.parse_qs(parsed.query)

        assert parsed.netloc == "accounts.google.com"
        assert "code_challenge" in qs, f"missing code_challenge in {qs.keys()}"
        assert qs.get("code_challenge_method") == ["S256"], qs.get("code_challenge_method")
        assert "state" in qs
        state_token = qs["state"][0]
        assert state_token

        # The oauth_states document must exist and have a valid code_verifier
        state_doc = mongo_db.oauth_states.find_one({"state": state_token})
        assert state_doc is not None, "oauth_states document not persisted"
        code_verifier = state_doc.get("code_verifier")
        assert code_verifier, "code_verifier is missing/empty in oauth_states doc"
        # PKCE code_verifier: base64url, 43-128 chars, [A-Za-z0-9-._~]
        assert isinstance(code_verifier, str)
        assert 43 <= len(code_verifier) <= 128, f"unexpected length {len(code_verifier)}"
        assert re.match(r"^[A-Za-z0-9\-._~]+$", code_verifier), "code_verifier not URL-safe"
        assert state_doc.get("user_id") == "test_professor_1"

        # cleanup
        mongo_db.oauth_states.delete_one({"state": state_token})

    def test_start_unauthenticated(self, api):
        r = api.get(f"{BASE_URL}/api/classroom/oauth/start")
        assert r.status_code == 401


# ---------- classroom oauth callback (redirects, no more 400 JSON) ----------
class TestOAuthCallback:
    """All error branches must return 302 to /configuracoes?classroom_error=..."""

    def _assert_redirect_with_error(self, r, expected_substr: str = None):
        assert r.status_code in (302, 307), f"expected redirect, got {r.status_code} body={r.text[:200]}"
        loc = r.headers.get("location", "")
        assert "/configuracoes" in loc, loc
        assert "classroom_error=" in loc, loc
        if expected_substr:
            # substring match on the URL-decoded query value
            parsed = urlparse.urlparse(loc)
            qs = urlparse.parse_qs(parsed.query)
            err_val = qs.get("classroom_error", [""])[0]
            assert expected_substr.lower() in err_val.lower(), f"'{expected_substr}' not in '{err_val}'"

    def test_callback_no_code_no_error(self, api):
        r = api.get(f"{BASE_URL}/api/classroom/oauth/callback", allow_redirects=False)
        self._assert_redirect_with_error(r)

    def test_callback_provider_error_access_denied(self, api):
        r = api.get(
            f"{BASE_URL}/api/classroom/oauth/callback",
            params={"error": "access_denied"},
            allow_redirects=False,
        )
        self._assert_redirect_with_error(r, "access_denied")

    def test_callback_provider_error_with_description(self, api):
        r = api.get(
            f"{BASE_URL}/api/classroom/oauth/callback",
            params={
                "error": "access_denied",
                "error_description": "user denied",
            },
            allow_redirects=False,
        )
        self._assert_redirect_with_error(r)  # description or error should be in redirect
        loc = r.headers.get("location", "")
        parsed = urlparse.urlparse(loc)
        qs = urlparse.parse_qs(parsed.query)
        # description takes precedence
        assert "user denied" in qs.get("classroom_error", [""])[0]

    def test_callback_invalid_state(self, api):
        r = api.get(
            f"{BASE_URL}/api/classroom/oauth/callback",
            params={"code": "dummy_code", "state": "definitely_not_a_real_state_xyz"},
            allow_redirects=False,
        )
        # must be a redirect, NOT a 400 JSON
        self._assert_redirect_with_error(r, "state")
        # content-type should NOT be JSON
        ct = r.headers.get("content-type", "")
        assert "application/json" not in ct.lower(), f"unexpected JSON response: {ct}"

    def test_callback_missing_only_code(self, api):
        r = api.get(
            f"{BASE_URL}/api/classroom/oauth/callback",
            params={"state": "abc"},
            allow_redirects=False,
        )
        self._assert_redirect_with_error(r)


# ---------- OAUTHLIB_RELAX_TOKEN_SCOPE fix ----------
class TestOAuthlibRelaxScope:
    """Verify the fix for: 'Scope has changed from ... to ...' error.

    Re-executes the top-of-file env setup exactly the way server.py does it and
    then confirms oauthlib does NOT raise when Google returns a different scope
    than what was requested.
    """

    def test_server_module_sets_relax_scope_env_var(self):
        # Read server.py and execute only its os.environ.setdefault lines in a
        # fresh subprocess-like scope; this mirrors what happens on backend boot.
        import subprocess, sys
        code = (
            "import os;"
            "exec(open('/app/backend/server.py').read().split('import uuid')[0]);"
            "print(os.environ.get('OAUTHLIB_RELAX_TOKEN_SCOPE'))"
        )
        out = subprocess.check_output([sys.executable, "-c", code], text=True).strip()
        assert out == "1", f"expected '1', got {out!r}"

    def test_oauthlib_accepts_scope_mismatch_when_relax_is_set(self):
        # Simulate the exact failure Google produced ('classroom.coursework.students.readonly'
        # replaced with 'classroom.student-submissions.students.readonly').
        import json, os, importlib
        os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
        # Force reimport so the env var takes effect (in case a prior test cleared it)
        import oauthlib.oauth2  # noqa: F401
        importlib.reload(oauthlib.oauth2)
        from oauthlib.oauth2 import WebApplicationClient
        c = WebApplicationClient("cid")
        body = json.dumps({
            "access_token": "tok",
            "token_type": "Bearer",
            "scope": "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
        })
        # Should NOT raise (previously would raise a Warning-turned-Error)
        c.parse_request_body_response(
            body,
            scope=["https://www.googleapis.com/auth/classroom.coursework.students.readonly"],
        )
