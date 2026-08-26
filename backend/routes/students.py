"""Student list/detail + history endpoints."""

import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from backend.auth import require_auth
from backend.db import get_db
from backend.schemas import SessionSummaryOut, StudentCreate, StudentDetailOut, StudentOut

router = APIRouter(prefix="/api/students", tags=["students"])


def _student_out(db: Database, student: dict) -> StudentOut:
    sessions = list(db.sessions.find({"student_id": student["_id"]}).sort("created_at", -1))
    mentor_name = None
    if sessions:
        mentor = db.mentors.find_one({"_id": sessions[0]["mentor_id"]})
        mentor_name = mentor["name"] if mentor else None
    return StudentOut(
        id=str(student["_id"]),
        name=student["name"],
        mentor_name=mentor_name,
        analysis_count=len(sessions),
        last_analysis_at=sessions[0]["created_at"] if sessions else None,
    )


@router.post("", response_model=StudentOut)
def create_student(payload: StudentCreate, db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Student name is required.")
    student = db.students.find_one({"name": name})
    if student is None:
        now = datetime.datetime.now(datetime.timezone.utc)
        result = db.students.insert_one({"name": name, "created_at": now, "updated_at": now})
        student = db.students.find_one({"_id": result.inserted_id})
    return _student_out(db, student)


@router.get("", response_model=list[StudentOut])
def list_students(q: str | None = Query(None), db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    query = {"name": {"$regex": q, "$options": "i"}} if q else {}
    students = db.students.find(query).sort("name", 1)
    return [_student_out(db, s) for s in students]


@router.get("/{student_id}", response_model=StudentDetailOut)
def get_student(student_id: str, db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    try:
        oid = ObjectId(student_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Student not found.")

    student = db.students.find_one({"_id": oid})
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")

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
    return StudentDetailOut(
        id=str(student["_id"]),
        name=student["name"],
        mentor_name=session_summaries[0].mentor_name if session_summaries else None,
        analysis_count=len(sessions),
        last_analysis_at=sessions[0]["created_at"] if sessions else None,
        sessions=session_summaries,
    )


@router.get("/{student_id}/analyses", response_model=list[SessionSummaryOut])
def get_student_analyses(student_id: str, db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    detail = get_student(student_id, db, _user)
    return detail.sessions
