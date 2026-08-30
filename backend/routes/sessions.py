"""POST /api/sessions registers an already-uploaded (B2) recording;
POST /api/sessions/{id}/analyze streams the pipeline over SSE and is also
the retry endpoint (same session id, no re-upload needed as long as the B2
file is still staged).

Scoping: a mentor may only register/inspect/analyze sessions for their own
mentees, and the session's mentor_id is forced to their own record.
"""

import asyncio
import json
import queue
import threading

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pymongo.database import Database

from config import AppConfig
from backend.auth import Principal, get_principal
from backend.db import get_db
from backend.schemas import SessionCreate, SessionCreated, SessionOut, SessionSummaryOut
from backend.services.analysis_service import AnalysisError, create_session, get_session, run_analysis_for_session

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
_cfg = AppConfig()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _load_scoped_session(db: Database, session_id: str, principal: Principal) -> dict:
    try:
        oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    doc = db.sessions.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if not principal.is_admin and doc.get("mentor_id") != principal.mentor_oid():
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return doc


@router.post("", response_model=SessionCreated)
def register_session(
    payload: SessionCreate,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    try:
        student_oid = ObjectId(payload.student_id)
        mentor_oid = ObjectId(payload.mentor_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid mentee or mentor id.")

    if not principal.is_admin:
        mentor_oid = principal.mentor_oid()
        if mentor_oid is None:
            raise HTTPException(status_code=403, detail="Your account is not linked to a mentor record.")

    student = db.students.find_one({"_id": student_oid})
    if student is None:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    if db.mentors.find_one({"_id": mentor_oid}) is None:
        raise HTTPException(status_code=404, detail="Mentor not found.")
    if not principal.is_admin and student.get("primary_mentor_id") != mentor_oid:
        raise HTTPException(status_code=403, detail="That mentee is not assigned to you.")

    result = create_session(
        db=db,
        student_id=student_oid,
        mentor_id=mentor_oid,
        storage_key=payload.storage_key,
        audio_filename=payload.audio_filename,
        audio_duration=payload.audio_duration,
        content_type=payload.content_type,
    )
    return SessionCreated(**result)


@router.post("/{session_id}/analyze")
def analyze_session(
    session_id: str,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _load_scoped_session(db, session_id, principal)
    q: "queue.Queue[dict | None]" = queue.Queue()

    def on_stage(stage: str) -> None:
        q.put({"type": "stage", "stage": stage})

    def worker() -> None:
        try:
            result = run_analysis_for_session(db, _cfg, session_id, on_stage=on_stage)
            q.put({"type": "done", "result": result})
        except AnalysisError as e:
            q.put({"type": "error", "message": str(e)})
        except Exception:
            q.put({"type": "error", "message": "Something went wrong while processing this recording."})
        finally:
            q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    async def event_stream():
        loop = asyncio.get_event_loop()
        while True:
            item = await loop.run_in_executor(None, q.get)
            if item is None:
                break
            yield _sse(item)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{session_id}", response_model=SessionOut)
def get_session_route(
    session_id: str,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _load_scoped_session(db, session_id, principal)
    session = get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return SessionOut(**session)


@router.get("", response_model=list[SessionSummaryOut])
def list_sessions(
    mentor_id: str | None = Query(None),
    student_id: str | None = Query(None),
    area: str | None = Query(None),
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    query: dict = {}
    if principal.is_admin:
        if mentor_id:
            try:
                query["mentor_id"] = ObjectId(mentor_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid mentor id.")
        elif area:
            ids = [m["_id"] for m in db.mentors.find({"area": {"$regex": f"^{area}$", "$options": "i"}}, {"_id": 1})]
            query["mentor_id"] = {"$in": ids}
        if student_id:
            try:
                query["student_id"] = ObjectId(student_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid mentee id.")
    else:
        query["mentor_id"] = principal.mentor_oid()

    docs = db.sessions.find(query).sort("created_at", -1).limit(50)
    out = []
    for doc in docs:
        student = db.students.find_one({"_id": doc["student_id"]})
        mentor = db.mentors.find_one({"_id": doc["mentor_id"]})
        out.append(
            SessionSummaryOut(
                id=str(doc["_id"]),
                student_name=student["name"] if student else "Unknown",
                mentor_name=mentor["name"] if mentor else "Unknown",
                audio_filename=doc["audio_filename"],
                status=doc["status"],
                created_at=doc["created_at"],
            )
        )
    return out
