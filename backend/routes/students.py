"""Student (mentee) list/detail + history endpoints.

Scoping: a mentor principal only ever sees mentees whose primary_mentor_id is
their own mentor record. Admins see everyone and can filter by location/mentor.
"""

import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from backend.auth import Principal, get_principal, require_admin
from backend.db import get_db
from backend.schemas import (
    SessionSummaryOut,
    StudentCreate,
    StudentDetailOut,
    StudentOut,
    StudentUpdate,
)

router = APIRouter(prefix="/api/students", tags=["students"])


def _mentor_ids_in_area(db: Database, area: str) -> list[ObjectId]:
    cursor = db.mentors.find({"area": {"$regex": f"^{area}$", "$options": "i"}}, {"_id": 1})
    return [m["_id"] for m in cursor]


def _student_out(db: Database, student: dict) -> StudentOut:
    sessions = list(db.sessions.find({"student_id": student["_id"]}).sort("created_at", -1))
    mentor = None
    if student.get("primary_mentor_id"):
        mentor = db.mentors.find_one({"_id": student["primary_mentor_id"]})
    if mentor is None and sessions:
        mentor = db.mentors.find_one({"_id": sessions[0]["mentor_id"]})
    return StudentOut(
        id=str(student["_id"]),
        name=student["name"],
        mentor_name=mentor["name"] if mentor else None,
        mentor_area=mentor.get("area") if mentor else None,
        analysis_count=len(sessions),
        last_analysis_at=sessions[0]["created_at"] if sessions else None,
    )


def _load_scoped_student(db: Database, student_id: str, principal: Principal) -> dict:
    try:
        oid = ObjectId(student_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    student = db.students.find_one({"_id": oid})
    if student is None:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    if not principal.is_admin and student.get("primary_mentor_id") != principal.mentor_oid():
        raise HTTPException(status_code=404, detail="Mentee not found.")
    return student


@router.post("", response_model=StudentOut)
def create_student(
    payload: StudentCreate,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Mentee name is required.")

    if principal.is_admin:
        mentor_oid = None
        if payload.primary_mentor_id:
            try:
                mentor_oid = ObjectId(payload.primary_mentor_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid mentor id.")
            if db.mentors.find_one({"_id": mentor_oid}) is None:
                raise HTTPException(status_code=404, detail="Mentor not found.")
    else:
        mentor_oid = principal.mentor_oid()

    student = db.students.find_one({"name": name})
    now = datetime.datetime.now(datetime.timezone.utc)
    if student is None:
        result = db.students.insert_one(
            {"name": name, "primary_mentor_id": mentor_oid, "created_at": now, "updated_at": now}
        )
        student = db.students.find_one({"_id": result.inserted_id})
    elif mentor_oid is not None and student.get("primary_mentor_id") != mentor_oid:
        # Existing name: a mentor may only (re)claim an unassigned mentee.
        if not principal.is_admin and student.get("primary_mentor_id") is not None:
            raise HTTPException(status_code=409, detail="That mentee is already assigned to another mentor.")
        db.students.update_one({"_id": student["_id"]}, {"$set": {"primary_mentor_id": mentor_oid, "updated_at": now}})
        student = db.students.find_one({"_id": student["_id"]})
    return _student_out(db, student)


@router.get("", response_model=list[StudentOut])
def list_students(
    q: str | None = Query(None),
    mentor_id: str | None = Query(None),
    area: str | None = Query(None),
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    query: dict = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}

    if principal.is_admin:
        if mentor_id:
            try:
                query["primary_mentor_id"] = ObjectId(mentor_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid mentor id.")
        elif area:
            query["primary_mentor_id"] = {"$in": _mentor_ids_in_area(db, area)}
    else:
        query["primary_mentor_id"] = principal.mentor_oid()

    students = db.students.find(query).sort("name", 1)
    return [_student_out(db, s) for s in students]


@router.patch("/{student_id}", response_model=StudentOut)
def reassign_student(
    student_id: str, payload: StudentUpdate, db: Database = Depends(get_db), _admin=Depends(require_admin)
):
    try:
        oid = ObjectId(student_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    student = db.students.find_one({"_id": oid})
    if student is None:
        raise HTTPException(status_code=404, detail="Mentee not found.")

    mentor_oid = None
    if payload.primary_mentor_id:
        try:
            mentor_oid = ObjectId(payload.primary_mentor_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid mentor id.")
        if db.mentors.find_one({"_id": mentor_oid}) is None:
            raise HTTPException(status_code=404, detail="Mentor not found.")

    db.students.update_one(
        {"_id": oid},
        {"$set": {"primary_mentor_id": mentor_oid, "updated_at": datetime.datetime.now(datetime.timezone.utc)}},
    )
    return _student_out(db, db.students.find_one({"_id": oid}))


@router.get("/{student_id}", response_model=StudentDetailOut)
def get_student(
    student_id: str, db: Database = Depends(get_db), principal: Principal = Depends(get_principal)
):
    student = _load_scoped_student(db, student_id, principal)
    oid = student["_id"]

    sessions = list(db.sessions.find({"student_id": oid}).sort("created_at", -1))
    mentor_cache: dict = {}

    def mentor_name(mentor_id) -> str:
        key = str(mentor_id)
        if key not in mentor_cache:
            mentor = db.mentors.find_one({"_id": mentor_id})
            mentor_cache[key] = mentor["name"] if mentor else "Unknown"
        return mentor_cache[key]

    session_summaries = [
        SessionSummaryOut(
            id=str(s["_id"]),
            student_name=student["name"],
            mentor_name=mentor_name(s["mentor_id"]),
            audio_filename=s["audio_filename"],
            status=s["status"],
            created_at=s["created_at"],
        )
        for s in sessions
    ]
    primary = db.mentors.find_one({"_id": student["primary_mentor_id"]}) if student.get("primary_mentor_id") else None
    return StudentDetailOut(
        id=str(student["_id"]),
        name=student["name"],
        mentor_name=(primary["name"] if primary else (session_summaries[0].mentor_name if session_summaries else None)),
        analysis_count=len(sessions),
        last_analysis_at=sessions[0]["created_at"] if sessions else None,
        sessions=session_summaries,
    )


@router.get("/{student_id}/analyses", response_model=list[SessionSummaryOut])
def get_student_analyses(
    student_id: str, db: Database = Depends(get_db), principal: Principal = Depends(get_principal)
):
    return get_student(student_id, db, principal).sessions
