"""MongoDB connection (pymongo, sync -- thread-safe, fits the worker-thread
SSE pattern used for running the pipeline). Swapping providers later only
means changing MONGODB_URI; nothing else in the app touches connection
details directly."""

import logging

from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from config import AppConfig

logger = logging.getLogger(__name__)

_cfg = AppConfig()
_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not _cfg.mongodb_uri:
            raise RuntimeError(
                "MONGODB_URI is not set. Create a free MongoDB Atlas cluster at "
                "https://www.mongodb.com/cloud/atlas/register and set its connection "
                "string in your environment or a .env file."
            )
        _client = MongoClient(_cfg.mongodb_uri)
    return _client


def get_db() -> Database:
    return get_client()[_cfg.mongodb_db_name]


def ensure_indexes() -> None:
    db = get_db()
    db.students.create_index([("name", ASCENDING)], unique=True)
    db.mentors.create_index([("name", ASCENDING)], unique=True)
    db.sessions.create_index([("status", ASCENDING)])
    db.sessions.create_index([("created_at", ASCENDING)])
    db.sessions.create_index([("student_id", ASCENDING)])
