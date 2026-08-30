"""Mentor directory + mentor-account management. All endpoints are admin-only:
mentors never manage other mentors, and a mentor's own identity/area comes
from GET /api/auth/me instead.
"""

import datetime
import re

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from backend.auth import require_admin
from backend.db import get_db
from backend.schemas import (
    MentorAccountCreate,
    MentorAccountOut,
    MentorAdminOut,
    MentorCreate,
    MentorOut,
    MentorUpdate,
)
from backend.security import generate_temp_password, hash_password

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


def _admin_out(db: Database, m: dict) -> MentorAdminOut:
    account = db.users.find_one({"mentor_id": m["_id"], "role": "mentor"})
    return MentorAdminOut(
        id=str(m["_id"]),
        name=m["name"],
        area=m.get("area"),
        gender=m.get("gender"),
        contact=m.get("contact"),
        education=m.get("education"),
        mentee_count=db.students.count_documents({"primary_mentor_id": m["_id"]}),
        account_username=account["username"] if account else None,
    )


def _get_mentor_or_404(db: Database, mentor_id: str) -> dict:
    try:
        oid = ObjectId(mentor_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Mentor not found.")
    mentor = db.mentors.find_one({"_id": oid})
    if mentor is None:
        raise HTTPException(status_code=404, detail="Mentor not found.")
    return mentor


@router.get("", response_model=list[MentorAdminOut])
def list_mentors(
    q: str | None = Query(None),
    area: str | None = Query(None, description="Filter to mentors in this area/location (exact, case-insensitive)."),
    db: Database = Depends(get_db),
    _admin=Depends(require_admin),
):
    query: dict = {}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    if area:
        query["area"] = {"$regex": f"^{re.escape(area)}$", "$options": "i"}
    mentors = db.mentors.find(query).sort("name", 1)
    return [_admin_out(db, m) for m in mentors]


@router.post("", response_model=MentorOut, status_code=201)
def create_mentor(payload: MentorCreate, db: Database = Depends(get_db), _admin=Depends(require_admin)):
    name = payload.name.strip()
    area = payload.area.strip()
    if not name or not area:
        raise HTTPException(status_code=400, detail="Mentor name and location are required.")
    now = datetime.datetime.now(datetime.timezone.utc)
    doc = {
        "name": name,
        "area": area,
        "gender": payload.gender,
        "contact": payload.contact,
        "education": payload.education,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = db.mentors.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A mentor with that name already exists.")
    return MentorOut(id=str(result.inserted_id), name=name, area=area)


@router.patch("/{mentor_id}", response_model=MentorAdminOut)
def update_mentor(
    mentor_id: str, payload: MentorUpdate, db: Database = Depends(get_db), _admin=Depends(require_admin)
):
    mentor = _get_mentor_or_404(db, mentor_id)
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump(exclude_unset=True).items()}
    if "name" in updates and not updates["name"]:
        raise HTTPException(status_code=400, detail="Mentor name cannot be empty.")
    if "area" in updates and not updates["area"]:
        raise HTTPException(status_code=400, detail="Location cannot be empty.")
    if updates:
        updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc)
        try:
            db.mentors.update_one({"_id": mentor["_id"]}, {"$set": updates})
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="A mentor with that name already exists.")
    return _admin_out(db, db.mentors.find_one({"_id": mentor["_id"]}))


@router.post("/{mentor_id}/account", response_model=MentorAccountOut, status_code=201)
def create_mentor_account(
    mentor_id: str, payload: MentorAccountCreate, db: Database = Depends(get_db), _admin=Depends(require_admin)
):
    mentor = _get_mentor_or_404(db, mentor_id)
    if db.users.find_one({"mentor_id": mentor["_id"], "role": "mentor"}):
        raise HTTPException(status_code=409, detail="This mentor already has a login. Reset the password instead.")

    username = payload.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9._-]{3,32}", username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 chars: letters, digits, dot, dash, underscore.")

    temp_password = generate_temp_password()
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        db.users.insert_one(
            {
                "username": username,
                "password_hash": hash_password(temp_password),
                "role": "mentor",
                "mentor_id": mentor["_id"],
                "disabled": False,
                "created_at": now,
                "updated_at": now,
            }
        )
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="That username is taken.")
    return MentorAccountOut(username=username, temp_password=temp_password)


@router.post("/{mentor_id}/account/reset", response_model=MentorAccountOut)
def reset_mentor_account(mentor_id: str, db: Database = Depends(get_db), _admin=Depends(require_admin)):
    mentor = _get_mentor_or_404(db, mentor_id)
    account = db.users.find_one({"mentor_id": mentor["_id"], "role": "mentor"})
    if account is None:
        raise HTTPException(status_code=404, detail="This mentor has no login yet.")
    temp_password = generate_temp_password()
    db.users.update_one(
        {"_id": account["_id"]},
        {"$set": {"password_hash": hash_password(temp_password), "updated_at": datetime.datetime.now(datetime.timezone.utc)}},
    )
    return MentorAccountOut(username=account["username"], temp_password=temp_password)
