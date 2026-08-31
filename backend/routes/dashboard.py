"""Dashboard summary: totals + recent analyses, scoped to the caller.

Admins see project-wide numbers; a mentor sees only their own mentees and
sessions.
"""

from fastapi import APIRouter, Depends
from pymongo.database import Database

from backend.auth import Principal, get_principal
from backend.db import get_db
from backend.schemas import DashboardSummary, SessionSummaryOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Database = Depends(get_db), principal: Principal = Depends(get_principal)):
    student_filter: dict = {}
    session_filter: dict = {}
    if not principal.is_admin:
        mentor_oid = principal.mentor_oid()
        student_filter = {"primary_mentor_id": mentor_oid}
        session_filter = {"mentor_id": mentor_oid}

    total_students = db.students.count_documents(student_filter)
    total_analyses = db.sessions.count_documents(session_filter)
    recent = list(db.sessions.find(session_filter).sort("created_at", -1).limit(5))

    recent_out = []
    for doc in recent:
        student = db.students.find_one({"_id": doc["student_id"]})
        mentor = db.mentors.find_one({"_id": doc["mentor_id"]})
        recent_out.append(
            SessionSummaryOut(
                id=str(doc["_id"]),
                student_id=str(doc["student_id"]),
                student_name=student["name"] if student else "Unknown",
                mentor_id=str(doc["mentor_id"]),
                mentor_name=mentor["name"] if mentor else "Unknown",
                audio_filename=doc["audio_filename"],
                status=doc["status"],
                created_at=doc["created_at"],
            )
        )

    return DashboardSummary(
        total_students=total_students,
        total_analyses=total_analyses,
        recent_analyses=recent_out,
    )
