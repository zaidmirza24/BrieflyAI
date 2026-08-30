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
    db.sessions.create_index([("mentor_id", ASCENDING)])
    db.students.create_index([("primary_mentor_id", ASCENDING)])
    db.users.create_index([("username", ASCENDING)], unique=True)
    db.users.create_index([("mentor_id", ASCENDING)])
    db.mentors.create_index([("area", ASCENDING)])


def ensure_admin_user() -> None:
    """Seed (or refresh the password of) the env-configured admin so there is
    always exactly one way in even on a fresh database."""
    import datetime

    from backend.security import hash_password

    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)
    existing = db.users.find_one({"username": _cfg.admin_username})
    if existing is None:
        db.users.insert_one(
            {
                "username": _cfg.admin_username,
                "password_hash": hash_password(_cfg.admin_password),
                "role": "admin",
                "mentor_id": None,
                "disabled": False,
                "created_at": now,
                "updated_at": now,
            }
        )
        logger.info("Seeded admin user %r", _cfg.admin_username)
    elif existing.get("role") != "admin":
        db.users.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin", "updated_at": now}})
