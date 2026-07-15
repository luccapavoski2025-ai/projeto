"""EduCRM - Backend for Teacher CRM with Google Classroom integration.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
import os
# Must be set BEFORE importing oauthlib. Google sometimes returns a slightly
# different set of scopes than requested (e.g. it replaces
# classroom.coursework.students.readonly with classroom.student-submissions.students.readonly).
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "0")

import uuid
import logging
import secrets
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Cookie
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import httpx

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---- Config ----
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_CLASSROOM_REDIRECT_URI = os.environ.get("GOOGLE_CLASSROOM_REDIRECT_URI", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

CLASSROOM_SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/classroom.coursework.me",
    "https://www.googleapis.com/auth/classroom.student-submissions.students",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/classroom.profile.emails",
    "https://www.googleapis.com/auth/classroom.profile.photos",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="EduCRM API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("educrm")


# ---- Models ----
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuthSessionRequest(BaseModel):
    session_id: str


# ---- Helpers ----
async def get_current_user(request: Request) -> User:
    """Extract user via session_token cookie or Bearer header."""
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sessão inválida")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessão expirada")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return User(**user_doc)


# ---- Auth Routes (Emergent Google Auth) ----
@api_router.post("/auth/session")
async def auth_session(payload: AuthSessionRequest, response: Response):
    """Exchange session_id for a session_token using Emergent Auth."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": data.get("name"),
                "picture": data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user_id": user_id, "email": email, "name": data.get("name"), "picture": data.get("picture")}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    classroom = await db.classroom_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    role = classroom.get("role") if classroom else None
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "classroom_connected": bool(classroom),
        "role": role,
    }


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---- Google Classroom OAuth ----
def _build_flow(state: Optional[str] = None) -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_CLASSROOM_REDIRECT_URI],
            }
        },
        scopes=CLASSROOM_SCOPES,
        state=state,
    )


@api_router.get("/classroom/oauth/start")
async def classroom_oauth_start(user: User = Depends(get_current_user)):
    state_token = secrets.token_urlsafe(24)
    flow = _build_flow(state_token)
    flow.redirect_uri = GOOGLE_CLASSROOM_REDIRECT_URI
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    await db.oauth_states.insert_one(
        {
            "state": state_token,
            "user_id": user.user_id,
            "code_verifier": flow.code_verifier,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"auth_url": auth_url}


@api_router.get("/classroom/oauth/callback")
async def classroom_oauth_callback(request: Request, code: str = None, state: str = None, error: str = None, error_description: str = None):
    from fastapi.responses import RedirectResponse
    import urllib.parse as _url

    # Google returned an error (e.g. access_denied, redirect_uri_mismatch)
    if error:
        msg = error_description or error
        return RedirectResponse(url=f"{FRONTEND_URL}/configuracoes?classroom_error={_url.quote(msg)}")

    if not code or not state:
        return RedirectResponse(url=f"{FRONTEND_URL}/configuracoes?classroom_error={_url.quote('Faltando code ou state')}")

    state_doc = await db.oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return RedirectResponse(url=f"{FRONTEND_URL}/configuracoes?classroom_error={_url.quote('State inválido ou expirado')}")

    flow = _build_flow(state)
    flow.redirect_uri = GOOGLE_CLASSROOM_REDIRECT_URI
    # Restore PKCE code_verifier that was generated during /oauth/start.
    if state_doc.get("code_verifier"):
        flow.code_verifier = state_doc["code_verifier"]
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        logger.exception("Token fetch falhou")
        return RedirectResponse(url=f"{FRONTEND_URL}/configuracoes?classroom_error={_url.quote(f'Falha ao obter token: {e}')}")

    creds = flow.credentials
    user_id = state_doc["user_id"]

    # Detect role by inspecting Classroom API access
    role = "unknown"
    try:
        service = build("classroom", "v1", credentials=creds, cache_discovery=False)
        teacher_courses = service.courses().list(teacherId="me", pageSize=1).execute().get("courses", [])
        if teacher_courses:
            role = "teacher"
        else:
            student_courses = service.courses().list(studentId="me", pageSize=1).execute().get("courses", [])
            if student_courses:
                role = "student"
    except Exception:
        logger.exception("Falha ao detectar role no callback")

    await db.classroom_tokens.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "refresh_token": creds.refresh_token,
                "access_token": creds.token,
                "scopes": creds.scopes,
                "role": role,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    await db.oauth_states.delete_one({"state": state})

    return RedirectResponse(url=f"{FRONTEND_URL}/configuracoes?classroom=connected")


async def _classroom_service(user_id: str):
    tok = await db.classroom_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not tok or not tok.get("refresh_token"):
        raise HTTPException(status_code=428, detail="Google Classroom não conectado")

    creds = Credentials(
        token=tok.get("access_token"),
        refresh_token=tok["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=CLASSROOM_SCOPES,
    )
    if not creds.valid:
        creds.refresh(GoogleRequest())
        await db.classroom_tokens.update_one(
            {"user_id": user_id},
            {"$set": {"access_token": creds.token, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return build("classroom", "v1", credentials=creds, cache_discovery=False)


@api_router.post("/classroom/disconnect")
async def classroom_disconnect(user: User = Depends(get_current_user)):
    await db.classroom_tokens.delete_one({"user_id": user.user_id})
    return {"ok": True}


# ---- Classroom Data Routes ----
@api_router.get("/classroom/courses")
async def list_courses(user: User = Depends(get_current_user)):
    try:
        service = await _classroom_service(user.user_id)
        result = service.courses().list(teacherId="me", pageSize=100).execute()
        return {"courses": result.get("courses", [])}
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro Google Classroom: {e}")


@api_router.get("/classroom/courses/{course_id}")
async def get_course(course_id: str, user: User = Depends(get_current_user)):
    try:
        service = await _classroom_service(user.user_id)
        course = service.courses().get(id=course_id).execute()
        students = service.courses().students().list(courseId=course_id, pageSize=200).execute().get("students", [])
        cw = service.courses().courseWork().list(courseId=course_id, pageSize=200).execute().get("courseWork", [])
        return {"course": course, "students": students, "coursework": cw}
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro Google Classroom: {e}")


# ---- AI Performance (Fictitious) ----
def _seeded(seed_str: str) -> random.Random:
    return random.Random(hash(seed_str) & 0xFFFFFFFF)


def _generate_student_ai(profile_id: str, name: str) -> dict:
    r = _seeded(profile_id)
    overall = r.randint(55, 96)
    skills = {
        "Compreensão": r.randint(50, 98),
        "Raciocínio Lógico": r.randint(50, 98),
        "Escrita": r.randint(50, 98),
        "Participação": r.randint(50, 98),
        "Colaboração": r.randint(50, 98),
        "Autonomia": r.randint(50, 98),
    }
    trend = [{"semana": f"S{i+1}", "nota": max(40, min(100, overall + r.randint(-10, 10)))} for i in range(8)]
    risk_labels = ["Baixo", "Moderado", "Alto"]
    risk = risk_labels[0] if overall > 80 else risk_labels[1] if overall > 65 else risk_labels[2]

    insights_pool = [
        f"{name.split()[0]} demonstra forte desempenho em raciocínio lógico.",
        f"Participação de {name.split()[0]} caiu 12% nas últimas 2 semanas.",
        f"IA identificou padrão de melhora contínua na escrita.",
        f"Recomenda-se reforço em interpretação textual.",
        f"Destaque em atividades colaborativas — pode ser mentor(a) da turma.",
        f"Atenção: risco de reprovação se o padrão atual continuar.",
        f"Aluno(a) responde melhor a exercícios visuais e interativos.",
    ]
    r.shuffle(insights_pool)
    return {
        "overall_score": overall,
        "risk_level": risk,
        "skills": skills,
        "trend": trend,
        "insights": insights_pool[:3],
    }


@api_router.get("/dashboard/metrics")
async def dashboard_metrics(user: User = Depends(get_current_user)):
    """KPIs from Google Classroom + AI-derived aggregations."""
    try:
        service = await _classroom_service(user.user_id)
    except HTTPException as e:
        if e.status_code == 428:
            return {
                "classroom_connected": False,
                "kpis": {
                    "total_alunos": 0,
                    "turmas_ativas": 0,
                    "tarefas_pendentes": 0,
                    "media_desempenho": 0,
                },
                "trend": [],
                "top_students": [],
                "at_risk": [],
                "insights": [],
            }
        raise

    courses = service.courses().list(teacherId="me", courseStates=["ACTIVE"], pageSize=100).execute().get("courses", [])
    total_students = 0
    total_pending = 0
    all_students = []
    for c in courses:
        try:
            students = service.courses().students().list(courseId=c["id"], pageSize=200).execute().get("students", [])
        except HttpError:
            students = []
        try:
            cw = service.courses().courseWork().list(courseId=c["id"], pageSize=200).execute().get("courseWork", [])
        except HttpError:
            cw = []
        total_students += len(students)
        total_pending += len([w for w in cw if w.get("state") == "PUBLISHED"])
        for s in students:
            p = s.get("profile", {})
            all_students.append(
                {
                    "id": p.get("id", s.get("userId", "")),
                    "name": p.get("name", {}).get("fullName", "Aluno"),
                    "email": p.get("emailAddress", ""),
                    "photo": p.get("photoUrl", ""),
                    "course_id": c["id"],
                    "course_name": c.get("name", ""),
                }
            )

    # AI-generated stats
    ai_scores = []
    for s in all_students:
        ai = _generate_student_ai(s["id"], s["name"])
        s["ai_score"] = ai["overall_score"]
        s["risk"] = ai["risk_level"]
        ai_scores.append(ai["overall_score"])

    media = round(sum(ai_scores) / len(ai_scores), 1) if ai_scores else 0

    # Weekly trend (aggregated fictitious)
    r = _seeded(user.user_id)
    base = media or 75
    trend = [{"semana": f"Sem {i+1}", "media": max(50, min(100, int(base + r.randint(-6, 6))))} for i in range(12)]

    top = sorted(all_students, key=lambda x: -x["ai_score"])[:5]
    at_risk = [s for s in all_students if s["risk"] == "Alto"][:5]

    insights = [
        {"type": "positive", "text": f"Média geral subiu {r.randint(2,8)}% nas últimas 4 semanas."},
        {"type": "warning", "text": f"{len(at_risk)} aluno(s) em risco de reprovação detectados pela IA."},
        {"type": "info", "text": f"Habilidade em destaque: {random.choice(['Raciocínio Lógico', 'Escrita', 'Colaboração'])}."},
        {"type": "warning", "text": f"{total_pending} tarefa(s) publicada(s) aguardando entregas."},
    ]

    return {
        "classroom_connected": True,
        "kpis": {
            "total_alunos": total_students,
            "turmas_ativas": len(courses),
            "tarefas_pendentes": total_pending,
            "media_desempenho": media,
        },
        "trend": trend,
        "top_students": top,
        "at_risk": at_risk,
        "insights": insights,
    }


@api_router.get("/students")
async def all_students(user: User = Depends(get_current_user)):
    service = await _classroom_service(user.user_id)
    courses = service.courses().list(teacherId="me", pageSize=100).execute().get("courses", [])
    seen = {}
    for c in courses:
        try:
            students = service.courses().students().list(courseId=c["id"], pageSize=200).execute().get("students", [])
        except HttpError:
            continue
        for s in students:
            p = s.get("profile", {})
            sid = p.get("id", s.get("userId", ""))
            if sid in seen:
                seen[sid]["courses"].append({"id": c["id"], "name": c.get("name", "")})
                continue
            ai = _generate_student_ai(sid, p.get("name", {}).get("fullName", "Aluno"))
            seen[sid] = {
                "id": sid,
                "name": p.get("name", {}).get("fullName", "Aluno"),
                "email": p.get("emailAddress", ""),
                "photo": p.get("photoUrl", ""),
                "courses": [{"id": c["id"], "name": c.get("name", "")}],
                "ai_score": ai["overall_score"],
                "risk": ai["risk_level"],
            }
    return {"students": list(seen.values())}


@api_router.get("/students/{student_id}")
async def student_detail(student_id: str, user: User = Depends(get_current_user)):
    service = await _classroom_service(user.user_id)
    courses = service.courses().list(teacherId="me", pageSize=100).execute().get("courses", [])
    profile = None
    student_courses = []
    for c in courses:
        try:
            students = service.courses().students().list(courseId=c["id"], pageSize=200).execute().get("students", [])
        except HttpError:
            continue
        for s in students:
            p = s.get("profile", {})
            sid = p.get("id", s.get("userId", ""))
            if sid == student_id:
                if not profile:
                    profile = p
                student_courses.append({"id": c["id"], "name": c.get("name", ""), "section": c.get("section", "")})
    if not profile:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    ai = _generate_student_ai(student_id, profile.get("name", {}).get("fullName", "Aluno"))
    return {
        "id": student_id,
        "name": profile.get("name", {}).get("fullName", "Aluno"),
        "email": profile.get("emailAddress", ""),
        "photo": profile.get("photoUrl", ""),
        "courses": student_courses,
        "ai": ai,
    }


# ---- Role helpers ----
async def _require_role(user: User, expected: str) -> dict:
    tok = await db.classroom_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    if not tok:
        raise HTTPException(status_code=428, detail="Google Classroom não conectado")
    if tok.get("role") != expected:
        raise HTTPException(status_code=403, detail=f"Acesso permitido apenas a {expected}s")
    return tok


@api_router.get("/me/role")
async def get_role(user: User = Depends(get_current_user)):
    tok = await db.classroom_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    return {"role": tok.get("role") if tok else None, "classroom_connected": bool(tok)}


# ---- Teacher: create coursework (posts to Classroom) ----
class CreateCourseworkRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    max_points: Optional[float] = 100.0
    due_date: Optional[str] = None  # ISO YYYY-MM-DD
    due_time: Optional[str] = None  # HH:MM


@api_router.post("/classroom/courses/{course_id}/coursework")
async def create_coursework(course_id: str, payload: CreateCourseworkRequest, user: User = Depends(get_current_user)):
    await _require_role(user, "teacher")
    service = await _classroom_service(user.user_id)
    body = {
        "title": payload.title,
        "description": payload.description or "",
        "workType": "ASSIGNMENT",
        "state": "PUBLISHED",
        "maxPoints": payload.max_points or 100,
    }
    if payload.due_date:
        try:
            y, m, d = payload.due_date.split("-")
            body["dueDate"] = {"year": int(y), "month": int(m), "day": int(d)}
        except Exception:
            pass
    if payload.due_time:
        try:
            hh, mm = payload.due_time.split(":")
            body["dueTime"] = {"hours": int(hh), "minutes": int(mm)}
        except Exception:
            pass
    try:
        cw = service.courses().courseWork().create(courseId=course_id, body=body).execute()
        return cw
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro Google Classroom: {e}")


# ---- Teacher: list submissions ----
@api_router.get("/classroom/courses/{course_id}/coursework/{cw_id}")
async def get_coursework(course_id: str, cw_id: str, user: User = Depends(get_current_user)):
    service = await _classroom_service(user.user_id)
    try:
        cw = service.courses().courseWork().get(courseId=course_id, id=cw_id).execute()
        return cw
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro: {e}")


@api_router.get("/classroom/courses/{course_id}/coursework/{cw_id}/submissions")
async def list_submissions(course_id: str, cw_id: str, user: User = Depends(get_current_user)):
    await _require_role(user, "teacher")
    service = await _classroom_service(user.user_id)
    try:
        subs = service.courses().courseWork().studentSubmissions().list(
            courseId=course_id, courseWorkId=cw_id, pageSize=200
        ).execute().get("studentSubmissions", [])
        students = service.courses().students().list(courseId=course_id, pageSize=200).execute().get("students", [])
        by_id = {s.get("userId"): s.get("profile", {}) for s in students}
        for s in subs:
            uid = s.get("userId")
            p = by_id.get(uid, {})
            s["_student"] = {
                "name": p.get("name", {}).get("fullName", "Aluno"),
                "email": p.get("emailAddress", ""),
                "photo": p.get("photoUrl", ""),
            }
        return {"submissions": subs}
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro: {e}")


@api_router.get("/classroom/courses/{course_id}/coursework/{cw_id}/submissions/{sub_id}")
async def get_submission(course_id: str, cw_id: str, sub_id: str, user: User = Depends(get_current_user)):
    service = await _classroom_service(user.user_id)
    try:
        sub = service.courses().courseWork().studentSubmissions().get(
            courseId=course_id, courseWorkId=cw_id, id=sub_id
        ).execute()
        # Enrich with student profile
        try:
            profile = service.userProfiles().get(userId=sub["userId"]).execute()
            sub["_student"] = {
                "name": profile.get("name", {}).get("fullName", "Aluno"),
                "email": profile.get("emailAddress", ""),
                "photo": profile.get("photoUrl", ""),
            }
        except Exception:
            pass
        # Get coursework
        try:
            cw = service.courses().courseWork().get(courseId=course_id, id=cw_id).execute()
            sub["_coursework"] = {"title": cw.get("title"), "description": cw.get("description"), "maxPoints": cw.get("maxPoints")}
        except Exception:
            pass
        return sub
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro: {e}")


# ---- Teacher: submit final grade (posts to Classroom) ----
class GradeRequest(BaseModel):
    assigned_grade: float
    draft_grade: Optional[float] = None
    return_to_student: Optional[bool] = True


@api_router.post("/classroom/courses/{course_id}/coursework/{cw_id}/submissions/{sub_id}/grade")
async def grade_submission(course_id: str, cw_id: str, sub_id: str, payload: GradeRequest, user: User = Depends(get_current_user)):
    await _require_role(user, "teacher")
    service = await _classroom_service(user.user_id)
    try:
        body = {"assignedGrade": payload.assigned_grade, "draftGrade": payload.draft_grade if payload.draft_grade is not None else payload.assigned_grade}
        updated = service.courses().courseWork().studentSubmissions().patch(
            courseId=course_id,
            courseWorkId=cw_id,
            id=sub_id,
            updateMask="assignedGrade,draftGrade",
            body=body,
        ).execute()
        if payload.return_to_student:
            try:
                service.courses().courseWork().studentSubmissions().return_(
                    courseId=course_id, courseWorkId=cw_id, id=sub_id
                ).execute()
            except HttpError:
                pass
        # Record the grading decision locally for audit
        await db.grading_decisions.insert_one({
            "teacher_id": user.user_id,
            "course_id": course_id,
            "coursework_id": cw_id,
            "submission_id": sub_id,
            "final_grade": payload.assigned_grade,
            "returned": payload.return_to_student,
            "graded_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True, "submission": updated}
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro Google Classroom: {e}")


# ---- AI Grading Assistant ----
class AiGradeRequest(BaseModel):
    assignment_title: str
    assignment_description: Optional[str] = ""
    max_points: Optional[float] = 100
    student_text: str
    student_name: Optional[str] = "Aluno"


AI_GRADING_SYSTEM = """Você é um assistente pedagógico de correção. Ajuda o professor analisando a entrega do aluno.
REGRAS CRÍTICAS:
- NUNCA decida a nota final. Apenas SUGIRA uma faixa e destaque pontos.
- Sempre lembre o professor de que a decisão final é dele(a).
- Seja construtivo e específico com exemplos do texto do aluno.
- Responda SEMPRE em JSON válido conforme o schema abaixo, nada mais.

Schema JSON obrigatório:
{
  "strengths": [string, ...],           // 2-4 pontos fortes específicos
  "improvements": [string, ...],        // 2-4 pontos de melhoria específicos
  "key_checkpoints": [string, ...],     // 3-5 aspectos que o professor deve verificar manualmente
  "suggested_range": {"min": number, "max": number},  // faixa sugerida dentro de max_points
  "reasoning": string,                  // 1-2 frases explicando a análise
  "professor_reminder": string          // frase reforçando que a decisão final é do professor
}"""


@api_router.post("/ai/grade-help")
async def ai_grade_help(payload: AiGradeRequest, user: User = Depends(get_current_user)):
    await _require_role(user, "teacher")
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY não configurada")

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import json as _json

    prompt = f"""Corrija esta entrega ajudando o professor.

TÍTULO DA TAREFA: {payload.assignment_title}
DESCRIÇÃO DA TAREFA: {payload.assignment_description or '(não fornecida)'}
PONTUAÇÃO MÁXIMA: {payload.max_points}
ALUNO: {payload.student_name}

TEXTO ENTREGUE PELO ALUNO:
---
{payload.student_text}
---

Analise e retorne o JSON conforme o schema. Lembre-se: você SUGERE uma faixa, o professor decide."""

    session_id = f"grade_{user.user_id}_{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=key,
        session_id=session_id,
        system_message=AI_GRADING_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp if isinstance(resp, str) else str(resp)
        # Try parse JSON
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            parsed = _json.loads(text[start:end + 1])
        else:
            parsed = {"raw": text}
        parsed["professor_reminder"] = parsed.get(
            "professor_reminder",
            "Esta é apenas uma sugestão da IA. A decisão final da correção é sua.",
        )
        # Log AI usage
        await db.ai_grading_logs.insert_one({
            "teacher_id": user.user_id,
            "student_name": payload.student_name,
            "assignment_title": payload.assignment_title,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return parsed
    except Exception as e:
        logger.exception("AI grading falhou")
        raise HTTPException(status_code=500, detail=f"Falha na IA: {e}")


# ---- Student endpoints ----
@api_router.get("/student/coursework")
async def student_coursework(user: User = Depends(get_current_user)):
    await _require_role(user, "student")
    service = await _classroom_service(user.user_id)
    courses = service.courses().list(studentId="me", pageSize=100).execute().get("courses", [])
    out = []
    for c in courses:
        try:
            cw_list = service.courses().courseWork().list(courseId=c["id"], pageSize=100).execute().get("courseWork", [])
        except HttpError:
            cw_list = []
        for cw in cw_list:
            if cw.get("state") != "PUBLISHED":
                continue
            out.append({
                "course_id": c["id"],
                "course_name": c.get("name", ""),
                "id": cw["id"],
                "title": cw.get("title", ""),
                "description": cw.get("description", ""),
                "max_points": cw.get("maxPoints"),
                "due_date": cw.get("dueDate"),
                "state": cw.get("state"),
            })
    return {"coursework": out}


@api_router.get("/student/courses/{course_id}/coursework/{cw_id}")
async def student_coursework_detail(course_id: str, cw_id: str, user: User = Depends(get_current_user)):
    await _require_role(user, "student")
    service = await _classroom_service(user.user_id)
    try:
        cw = service.courses().courseWork().get(courseId=course_id, id=cw_id).execute()
        my_subs = service.courses().courseWork().studentSubmissions().list(
            courseId=course_id, courseWorkId=cw_id, userId="me"
        ).execute().get("studentSubmissions", [])
        return {"coursework": cw, "my_submission": my_subs[0] if my_subs else None}
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Erro: {e}")


# ---- Health ----
@api_router.get("/")
async def root():
    return {"service": "EduCRM API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
