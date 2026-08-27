"""Mentor list endpoint. Mentors are persistent, pre-seeded entities (see
backend/scripts/seed_mentors_mentees.py) -- this only lists them for the
session-creation dropdown, it never creates one."""

import re

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from backend.auth import require_auth
from backend.db import get_db
from backend.schemas import MentorOut

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


@router.get("", response_model=list[MentorOut])
def list_mentors(
    q: str | None = Query(None),
    area: str | None = Query(None, description="Filter to mentors in this area/location (exact, case-insensitive)."),
    db: Database = Depends(get_db),
    _user: str = Depends(require_auth),
):
    query: dict = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if area:
        query["area"] = {"$regex": f"^{re.escape(area)}$", "$options": "i"}
    mentors = db.mentors.find(query).sort("name", 1)
    return [MentorOut(id=str(m["_id"]), name=m["name"], area=m.get("area")) for m in mentors]
