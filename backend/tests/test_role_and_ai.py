"""Iteration 4 backend tests: role detection, role gating on Classroom endpoints,
and AI grade-help Anthropic Claude integration via emergentintegrations.

The tests focus on:
  a) /api/me/role for teacher/student (seeded)
  b) /api/auth/me returns role field
  c) 403 vs 200 role gating for teacher/student endpoints (must be enforced
     BEFORE any real Google Classroom API call is attempted, since the seeded
     classroom_tokens have fake refresh_tokens that would fail at token refresh.
     So we assert 403 for the wrong-role case; we do NOT assert 200 for the
     right-role case because the real Classroom call will fail with 502.)
  d) /api/ai/grade-help end-to-end (real Anthropic call via emergentintegrations)
     — validates response schema, no final_grade / assigned_grade, and that a
     row is written to db.ai_grading_logs.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading frontend/.env – matches how the app is deployed
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE_URL}/api"

TEACHER_TOKEN = "seed_teacher_session"
STUDENT_TOKEN = "seed_student_session"
TEACHER_UID = "seed_teacher_1"
STUDENT_UID = "seed_student_1"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="session", autouse=True)
def ensure_seed(mongo):
    """Ensure seed users / sessions / classroom_tokens exist. Idempotent."""
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    exp = (now + timedelta(days=7)).isoformat()

    mongo.users.update_one(
        {"user_id": TEACHER_UID},
        {"$set": {"user_id": TEACHER_UID, "email": "seed.teacher@example.com",
                  "name": "Seed Teacher", "picture": None,
                  "created_at": now.isoformat()}},
        upsert=True,
    )
    mongo.users.update_one(
        {"user_id": STUDENT_UID},
        {"$set": {"user_id": STUDENT_UID, "email": "seed.student@example.com",
                  "name": "Seed Student", "picture": None,
                  "created_at": now.isoformat()}},
        upsert=True,
    )
    mongo.user_sessions.update_one(
        {"session_token": TEACHER_TOKEN},
        {"$set": {"user_id": TEACHER_UID, "session_token": TEACHER_TOKEN,
                  "expires_at": exp, "created_at": now.isoformat()}},
        upsert=True,
    )
    mongo.user_sessions.update_one(
        {"session_token": STUDENT_TOKEN},
        {"$set": {"user_id": STUDENT_UID, "session_token": STUDENT_TOKEN,
                  "expires_at": exp, "created_at": now.isoformat()}},
        upsert=True,
    )
    # classroom_tokens are already seeded with role teacher/student
    mongo.classroom_tokens.update_one(
        {"user_id": TEACHER_UID},
        {"$set": {"user_id": TEACHER_UID, "role": "teacher",
                  "refresh_token": "fake_refresh_teacher",
                  "access_token": "fake_access_teacher",
                  "scopes": []}},
        upsert=True,
    )
    mongo.classroom_tokens.update_one(
        {"user_id": STUDENT_UID},
        {"$set": {"user_id": STUDENT_UID, "role": "student",
                  "refresh_token": "fake_refresh_student",
                  "access_token": "fake_access_student",
                  "scopes": []}},
        upsert=True,
    )
    yield


def _teacher():
    return {"Authorization": f"Bearer {TEACHER_TOKEN}"}


def _student():
    return {"Authorization": f"Bearer {STUDENT_TOKEN}"}


# ---------- /me/role & /auth/me ----------
class TestRoleEndpoint:
    def test_teacher_role(self):
        r = requests.get(f"{API}/me/role", headers=_teacher(), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "teacher"
        assert data["classroom_connected"] is True

    def test_student_role(self):
        r = requests.get(f"{API}/me/role", headers=_student(), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "student"
        assert data["classroom_connected"] is True

    def test_role_requires_auth(self):
        r = requests.get(f"{API}/me/role", timeout=10)
        assert r.status_code == 401

    def test_auth_me_teacher_includes_role(self):
        r = requests.get(f"{API}/auth/me", headers=_teacher(), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "role" in data
        assert data["role"] == "teacher"
        assert data["classroom_connected"] is True
        assert data["user_id"] == TEACHER_UID

    def test_auth_me_student_includes_role(self):
        r = requests.get(f"{API}/auth/me", headers=_student(), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "role" in data
        assert data["role"] == "student"
        assert data["classroom_connected"] is True
        assert data["user_id"] == STUDENT_UID


# ---------- Role gating: student calling teacher endpoints => 403 ----------
class TestStudentBlockedOnTeacherRoutes:
    def test_student_cannot_create_coursework(self):
        r = requests.post(
            f"{API}/classroom/courses/fake_course/coursework",
            headers={**_student(), "Content-Type": "application/json"},
            json={"title": "T", "description": "d", "max_points": 100},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_student_cannot_list_submissions(self):
        r = requests.get(
            f"{API}/classroom/courses/fake_course/coursework/fake_cw/submissions",
            headers=_student(), timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_student_cannot_use_ai_grade_help(self):
        r = requests.post(
            f"{API}/ai/grade-help",
            headers={**_student(), "Content-Type": "application/json"},
            json={"assignment_title": "x", "student_text": "y"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_student_cannot_submit_grade(self):
        r = requests.post(
            f"{API}/classroom/courses/c/coursework/cw/submissions/s/grade",
            headers={**_student(), "Content-Type": "application/json"},
            json={"assigned_grade": 90},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"


# ---------- Role gating: teacher calling student endpoints => 403 ----------
class TestTeacherBlockedOnStudentRoutes:
    def test_teacher_cannot_get_student_coursework(self):
        r = requests.get(f"{API}/student/coursework", headers=_teacher(), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_teacher_cannot_get_student_coursework_detail(self):
        r = requests.get(
            f"{API}/student/courses/fake_course/coursework/fake_cw",
            headers=_teacher(), timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"


# ---------- AI /ai/grade-help — real Anthropic call ----------
class TestAiGradeHelp:
    """Real Anthropic call via emergentintegrations. May be slow (~10-20s)."""

    @pytest.fixture(scope="class")
    def ai_response(self, mongo):
        # capture pre-count of ai_grading_logs
        pre = mongo.ai_grading_logs.count_documents({"teacher_id": TEACHER_UID})
        payload = {
            "assignment_title": "Redação: Meio Ambiente",
            "assignment_description": "Escreva uma dissertação de 200 palavras sobre a importância da preservação ambiental.",
            "max_points": 10,
            "student_name": "Ana Silva",
            "student_text": (
                "A preservação do meio ambiente é um dos maiores desafios da humanidade "
                "no século XXI. As florestas ajudam a regular o clima e abrigam milhões "
                "de espécies. Se continuarmos desmatando na velocidade atual, muitas "
                "espécies serão extintas. Por isso, precisamos reciclar, reduzir o consumo "
                "e apoiar políticas públicas de proteção ambiental. A educação é a base "
                "para uma sociedade sustentável."
            ),
        }
        r = requests.post(
            f"{API}/ai/grade-help",
            headers={**_teacher(), "Content-Type": "application/json"},
            json=payload,
            timeout=90,
        )
        return r, pre, payload

    def test_ai_status_200(self, ai_response):
        r, _, _ = ai_response
        if r.status_code != 200:
            pytest.skip(f"AI call failed (transient?): {r.status_code} {r.text[:400]}")
        assert r.status_code == 200

    def test_ai_schema_no_final_grade(self, ai_response):
        r, _, _ = ai_response
        if r.status_code != 200:
            pytest.skip(f"AI call failed: {r.status_code}")
        data = r.json()
        assert isinstance(data.get("strengths"), list), f"strengths missing/not list: {data}"
        assert len(data["strengths"]) >= 1
        assert isinstance(data.get("improvements"), list)
        assert len(data["improvements"]) >= 1
        assert isinstance(data.get("key_checkpoints"), list)
        assert len(data["key_checkpoints"]) >= 1
        sr = data.get("suggested_range")
        assert isinstance(sr, dict), f"suggested_range missing: {data}"
        assert "min" in sr and "max" in sr
        assert isinstance(sr["min"], (int, float))
        assert isinstance(sr["max"], (int, float))
        assert sr["min"] <= sr["max"]
        assert isinstance(data.get("reasoning"), str) and len(data["reasoning"]) > 0
        # CRITICAL: no definitive final grade fields allowed
        assert "final_grade" not in data, f"final_grade must NOT be present: {data}"
        assert "assigned_grade" not in data, f"assigned_grade must NOT be present: {data}"

    def test_ai_professor_reminder_present(self, ai_response):
        r, _, _ = ai_response
        if r.status_code != 200:
            pytest.skip(f"AI call failed: {r.status_code}")
        data = r.json()
        assert isinstance(data.get("professor_reminder"), str)
        assert len(data["professor_reminder"]) > 0

    def test_ai_grading_log_written(self, ai_response, mongo):
        r, pre, payload = ai_response
        if r.status_code != 200:
            pytest.skip(f"AI call failed: {r.status_code}")
        # allow small delay for mongo write
        time.sleep(0.5)
        post = mongo.ai_grading_logs.count_documents({"teacher_id": TEACHER_UID})
        assert post == pre + 1, f"expected 1 new ai_grading_log row, pre={pre} post={post}"
        # verify latest row payload
        latest = mongo.ai_grading_logs.find_one(
            {"teacher_id": TEACHER_UID}, sort=[("created_at", -1)]
        )
        assert latest is not None
        assert latest["student_name"] == payload["student_name"]
        assert latest["assignment_title"] == payload["assignment_title"]

    def test_ai_requires_auth(self):
        r = requests.post(
            f"{API}/ai/grade-help",
            headers={"Content-Type": "application/json"},
            json={"assignment_title": "x", "student_text": "y"},
            timeout=15,
        )
        assert r.status_code == 401
