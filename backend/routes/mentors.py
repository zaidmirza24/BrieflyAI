"""Mentor list endpoint. Mentors are persistent, pre-seeded entities (see
backend/scripts/seed_mentors_mentees.py) -- this only lists them for the
session-creation dropdown, it never creates one."""

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from backend.auth import require_auth
from backend.db import get_db
from backend.schemas import MentorOut

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


@router.get("", response_model=list[MentorOut])
def list_mentors(q: str | None = Query(None), db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    query = {"name": {"$regex": q, "$options": "i"}} if q else {}
    mentors = db.mentors.find(query).sort("name", 1)
    return [MentorOut(id=str(m["_id"]), name=m["name"]) for m in mentors]
