"""POST /api/sessions registers an already-uploaded (B2) recording;
POST /api/sessions/{id}/analyze streams the pipeline over SSE and is also
the retry endpoint (same session id, no re-upload needed as long as the B2
file is still staged)."""

import asyncio
import json
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pymongo.database import Database

from config import AppConfig
from backend.auth import require_auth
from backend.db import get_db
from backend.schemas import SessionCreate, SessionCreated, SessionOut, SessionSummaryOut
from backend.services.analysis_service import AnalysisError, create_session, get_session, run_analysis_for_session

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
_cfg = AppConfig()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


@router.post("", response_model=SessionCreated)
def register_session(
    payload: SessionCreate,
    db: Database = Depends(get_db),
    _user: str = Depends(require_auth),
):
    if not payload.student_name.strip() or not payload.mentor_name.strip():
        raise HTTPException(status_code=400, detail="Student name and mentor name are required.")
    result = create_session(
        db=db,
        student_name=payload.student_name.strip(),
        mentor_name=payload.mentor_name.strip(),
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
    _user: str = Depends(require_auth),
):
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
    _user: str = Depends(require_auth),
):
    session = get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return SessionOut(**session)


@router.get("", response_model=list[SessionSummaryOut])
def list_sessions(
    db: Database = Depends(get_db),
    _user: str = Depends(require_auth),
):
    docs = db.sessions.find().sort("created_at", -1).limit(50)
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
