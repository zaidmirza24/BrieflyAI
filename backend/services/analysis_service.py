"""Orchestrates one analysis session: pull the staged audio back down from
B2 -> run the shared core pipeline (core/pipeline.py, same code the CLI
uses) -> persist to MongoDB -> only on full success, delete the B2 object.

The session document's `status` field is the source of truth for the
lifecycle (see api/session_status.py). On any failure the B2 file is left
in place and `status` is set to FAILED with a human-readable `error`, so
`run_analysis_for_session` can simply be called again to retry -- no
re-upload needed.
"""

import datetime
import logging
import os
import tempfile
import uuid
from typing import Callable

from bson import ObjectId
from pymongo.database import Database

from config import AppConfig
from core.pipeline import run_pipeline
from backend.services import storage_service
from backend.services.storage_service import StorageError
from backend.session_status import SessionStatus

logger = logging.getLogger(__name__)


class AnalysisError(Exception):
    """A human-readable, user-facing error. Never leaks stack traces or paths."""


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _find_or_create_student(db: Database, name: str) -> dict:
    doc = db.students.find_one({"name": name})
    if doc:
        return doc
    now = _now()
    result = db.students.insert_one({"name": name, "created_at": now, "updated_at": now})
    return db.students.find_one({"_id": result.inserted_id})


def _find_or_create_mentor(db: Database, name: str) -> dict:
    doc = db.mentors.find_one({"name": name})
    if doc:
        return doc
    result = db.mentors.insert_one({"name": name, "created_at": _now()})
    return db.mentors.find_one({"_id": result.inserted_id})


def create_session(
    db: Database,
    student_name: str,
    mentor_name: str,
    storage_key: str,
    audio_filename: str,
    audio_duration: float | None,
    content_type: str | None,
) -> dict:
    student = _find_or_create_student(db, student_name)
    mentor = _find_or_create_mentor(db, mentor_name)
    now = _now()
    doc = {
        "student_id": student["_id"],
        "mentor_id": mentor["_id"],
        "audio_filename": audio_filename,
        "audio_duration": audio_duration,
        "content_type": content_type,
        "transcription_backend": "deepgram",
        "storage_key": storage_key,
        "status": SessionStatus.UPLOADED,
        "transcript": None,
        "insights": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    result = db.sessions.insert_one(doc)
    return {"id": str(result.inserted_id), "status": SessionStatus.UPLOADED}


def _set_status(db: Database, session_id: ObjectId, status: SessionStatus, **fields) -> None:
    fields["status"] = status
    fields["updated_at"] = _now()
    db.sessions.update_one({"_id": session_id}, {"$set": fields})


def session_to_dict(db: Database, doc: dict) -> dict:
    student = db.students.find_one({"_id": doc["student_id"]})
    mentor = db.mentors.find_one({"_id": doc["mentor_id"]})
    return {
        "id": str(doc["_id"]),
        "student_id": str(doc["student_id"]),
        "student_name": student["name"] if student else "Unknown",
        "mentor_id": str(doc["mentor_id"]),
        "mentor_name": mentor["name"] if mentor else "Unknown",
        "audio_filename": doc["audio_filename"],
        "audio_duration": doc.get("audio_duration"),
        "transcription_backend": doc.get("transcription_backend", "deepgram"),
        "status": doc["status"],
        "error": doc.get("error"),
        "transcript": doc.get("transcript"),
        "insights": doc.get("insights"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def get_session(db: Database, session_id: str) -> dict | None:
    try:
        oid = ObjectId(session_id)
    except Exception:
        return None
    doc = db.sessions.find_one({"_id": oid})
    return session_to_dict(db, doc) if doc else None


def run_analysis_for_session(
    db: Database,
    cfg: AppConfig,
    session_id: str,
    on_stage: "Callable[[str], None] | None" = None,
) -> dict:
    def _notify(stage: str) -> None:
        if on_stage:
            on_stage(stage)

    try:
        oid = ObjectId(session_id)
    except Exception as e:
        raise AnalysisError("Invalid analysis id.") from e

    session = db.sessions.find_one({"_id": oid})
    if session is None:
        raise AnalysisError("Analysis not found.")

    storage_key = session.get("storage_key")
    if session["status"] == SessionStatus.AUDIO_DELETED or not storage_key:
        raise AnalysisError(
            "This analysis has already completed and its audio was removed. There is nothing to retry."
        )

    def _fail(message: str, **extra_fields) -> "AnalysisError":
        # Every failure exit goes through here so status=FAILED is always
        # persisted (and the client always gets an 'error' SSE event) --
        # never just re-raise without recording the failure first.
        _set_status(db, oid, SessionStatus.FAILED, error=message, **extra_fields)
        _notify("error")
        return AnalysisError(message)

    _set_status(db, oid, SessionStatus.PROCESSING, error=None)
    _notify("processing")

    tmp_path = os.path.join(tempfile.gettempdir(), f"insightder_{uuid.uuid4().hex}{os.path.splitext(session['audio_filename'])[1]}")
    try:
        try:
            storage_service.download_object_to_file(cfg, storage_key, tmp_path)
        except StorageError as e:
            raise _fail(str(e)) from e

        def bridge(stage: str) -> None:
            _notify(stage)
            if stage == "transcribed":
                _set_status(db, oid, SessionStatus.TRANSCRIBED)

        student = db.students.find_one({"_id": session["student_id"]})
        mentor = db.mentors.find_one({"_id": session["mentor_id"]})

        try:
            result = run_pipeline(
                tmp_path,
                cfg,
                on_stage=bridge,
                student_name=student["name"] if student else None,
                mentor_name=mentor["name"] if mentor else None,
            )
        except RuntimeError as e:
            # Missing API keys, ffmpeg, etc -- already human-readable.
            raise _fail(str(e)) from e
        except Exception as e:
            logger.exception("Pipeline failed for session %s", session_id)
            raise _fail("Transcription or analysis failed. Please try again in a moment.") from e

        if not result.clean_transcript.strip():
            raise _fail("Transcription produced no readable text. Please check the recording and try again.")

        llm_failure = next((w for w in result.warnings if "LLM analysis failed" in w), None)
        if llm_failure:
            raise _fail("Analysis failed while generating insights. Please try again.", transcript=result.clean_transcript)

        _set_status(db, oid, SessionStatus.ANALYZED, transcript=result.clean_transcript, insights=result.insights)
        _notify("analyzed")

        _set_status(db, oid, SessionStatus.SAVED)
        _notify("saved")

        _notify("deleting")
        storage_service.delete_object(cfg, storage_key)
        _set_status(db, oid, SessionStatus.AUDIO_DELETED, storage_key=None)
        _notify("audio_deleted")

        return session_to_dict(db, db.sessions.find_one({"_id": oid}))
    except AnalysisError:
        raise
    except Exception as e:
        logger.exception("Unexpected error processing session %s", session_id)
        raise _fail("Something went wrong while processing this recording.") from e
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
