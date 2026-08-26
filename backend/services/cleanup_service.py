"""Deletes B2 objects left behind by abandoned or failed uploads. A session
counts as abandoned once it's been sitting with a live storage_key and no
forward progress for cfg.cleanup_max_age_hours -- covers a browser tab
closed mid-upload (stuck at UPLOADED) as well as an analysis that failed
and was never retried."""

import datetime
import logging

from pymongo.database import Database

from config import AppConfig
from backend.services import storage_service
from backend.session_status import SessionStatus

logger = logging.getLogger(__name__)

_STALE_STATUSES = [
    SessionStatus.UPLOADED,
    SessionStatus.PROCESSING,
    SessionStatus.TRANSCRIBED,
    SessionStatus.ANALYZED,
    SessionStatus.FAILED,
]


def cleanup_stale_sessions(db: Database, cfg: AppConfig) -> int:
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=cfg.cleanup_max_age_hours)
    stale = db.sessions.find(
        {
            "storage_key": {"$ne": None},
            "status": {"$in": _STALE_STATUSES},
            "updated_at": {"$lt": cutoff},
        }
    )

    cleaned = 0
    for session in stale:
        storage_key = session.get("storage_key")
        if storage_key:
            storage_service.delete_object(cfg, storage_key)
        db.sessions.update_one(
            {"_id": session["_id"]},
            {
                "$set": {
                    "status": SessionStatus.AUDIO_DELETED,
                    "storage_key": None,
                    "cleanup_note": "Deleted by the abandoned-upload cleanup job.",
                    "updated_at": datetime.datetime.now(datetime.timezone.utc),
                }
            },
        )
        cleaned += 1

    if cleaned:
        logger.info("Cleanup: removed %d stale B2 object(s).", cleaned)
    return cleaned
