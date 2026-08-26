"""Dashboard summary: totals + recent analyses."""

from fastapi import APIRouter, Depends
from pymongo.database import Database

from backend.auth import require_auth
from backend.db import get_db
from backend.schemas import DashboardSummary, SessionSummaryOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Database = Depends(get_db), _user: str = Depends(require_auth)):
    total_students = db.students.count_documents({})
    total_analyses = db.sessions.count_documents({})
    recent = list(db.sessions.find().sort("created_at", -1).limit(5))

    recent_out = []
    for doc in recent:
        student = db.students.find_one({"_id": doc["student_id"]})
        mentor = db.mentors.find_one({"_id": doc["mentor_id"]})
        recent_out.append(
            SessionSummaryOut(
                id=str(doc["_id"]),
                student_name=student["name"] if student else "Unknown",
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
