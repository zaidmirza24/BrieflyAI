"""Mentee (student) records: profile CRUD, the audited mentor-assignment
workflow, and per-mentee history.

Scoping
-------
A mentor principal only ever sees / edits mentees whose ``primary_mentor_id``
is their own mentor record. Admins see everyone and can filter by
location / mentor / status.

Assignment is a first-class, audited action. Every change to
``primary_mentor_id`` — on create, single reassign, or bulk assign — writes
an immutable row to the ``assignments`` collection (who, from, to, why,
when). Editing other mentee attributes goes through ``PATCH /{id}`` and does
*not* touch the assignment.
"""

import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from backend.auth import Principal, get_principal, require_admin
from backend.constants import (
    MENTEE_ACTIVE_STATUSES,
    MENTEE_CADENCE_DAYS_DEFAULT,
    MENTEE_STATUS_DEFAULT,
)
from backend.db import get_db
from backend.schemas import (
    AssignmentOut,
    AssignmentUpdate,
    AttentionSummary,
    BulkAssign,
    BulkAssignResult,
    SessionSummaryOut,
    StudentCreate,
    StudentDetailOut,
    StudentOut,
    StudentProfileUpdate,
)

router = APIRouter(prefix="/api/students", tags=["students"])

_PROFILE_FIELDS = ("gender", "contact", "std", "school", "area", "cadence_days", "notes")


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _oid(value: str, what: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"Invalid {what}.")


def _mentor_ids_in_area(db: Database, area: str) -> list[ObjectId]:
    cursor = db.mentors.find({"area": {"$regex": f"^{area}$", "$options": "i"}}, {"_id": 1})
    return [m["_id"] for m in cursor]


def _is_overdue(student: dict, last_session_at: datetime.datetime | None) -> bool:
    if student.get("status", MENTEE_STATUS_DEFAULT) not in MENTEE_ACTIVE_STATUSES:
        return False
    if last_session_at is None:
        return True
    cadence = student.get("cadence_days") or MENTEE_CADENCE_DAYS_DEFAULT
    if last_session_at.tzinfo is None:
        last_session_at = last_session_at.replace(tzinfo=datetime.timezone.utc)
    return last_session_at < _now() - datetime.timedelta(days=cadence)


def _student_out(db: Database, student: dict) -> StudentOut:
    sessions = list(db.sessions.find({"student_id": student["_id"]}).sort("created_at", -1))
    mentor = None
    if student.get("primary_mentor_id"):
        mentor = db.mentors.find_one({"_id": student["primary_mentor_id"]})
    if mentor is None and sessions:
        mentor = db.mentors.find_one({"_id": sessions[0]["mentor_id"]})
    last_at = sessions[0]["created_at"] if sessions else None
    return StudentOut(
        id=str(student["_id"]),
        name=student["name"],
        gender=student.get("gender"),
        contact=student.get("contact"),
        std=student.get("std"),
        school=student.get("school"),
        area=student.get("area") or (mentor.get("area") if mentor else None),
        status=student.get("status", MENTEE_STATUS_DEFAULT),
        cadence_days=student.get("cadence_days"),
        notes=student.get("notes"),
        primary_mentor_id=str(student["primary_mentor_id"]) if student.get("primary_mentor_id") else None,
        mentor_name=mentor["name"] if mentor else None,
        mentor_area=mentor.get("area") if mentor else None,
        analysis_count=len(sessions),
        last_analysis_at=last_at,
        overdue=_is_overdue(student, last_at),
    )


def _load_scoped_student(db: Database, student_id: str, principal: Principal) -> dict:
    student = db.students.find_one({"_id": _oid(student_id, "mentee id")})
    if student is None:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    if not principal.is_admin and student.get("primary_mentor_id") != principal.mentor_oid():
        raise HTTPException(status_code=404, detail="Mentee not found.")
    return student


def _record_assignment(
    db: Database,
    student: dict,
    to_mentor_oid: ObjectId | None,
    reason: str | None,
    principal: Principal,
) -> None:
    """Persist the new assignment on the student and append an audit row.
    No-op when the mentor is unchanged."""
    from_oid = student.get("primary_mentor_id")
    if from_oid == to_mentor_oid:
        return
    now = _now()
    db.students.update_one(
        {"_id": student["_id"]},
        {"$set": {"primary_mentor_id": to_mentor_oid, "updated_at": now}},
    )
    db.assignments.insert_one(
        {
            "student_id": student["_id"],
            "from_mentor_id": from_oid,
            "to_mentor_id": to_mentor_oid,
            "reason": (reason or None),
            "by_user_id": _oid(principal.user_id) if principal.user_id else None,
            "by_username": principal.username,
            "created_at": now,
        }
    )
    student["primary_mentor_id"] = to_mentor_oid


def _validated_mentor_oid(db: Database, mentor_id: str | None) -> ObjectId | None:
    if not mentor_id:
        return None
    oid = _oid(mentor_id, "mentor id")
    if db.mentors.find_one({"_id": oid}) is None:
        raise HTTPException(status_code=404, detail="Mentor not found.")
    return oid


# --------------------------------------------------------------------------- #
#  Create / list
# --------------------------------------------------------------------------- #
@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Mentee name is required.")

    if principal.is_admin:
        mentor_oid = _validated_mentor_oid(db, payload.primary_mentor_id)
    else:
        mentor_oid = principal.mentor_oid()
        if mentor_oid is None:
            raise HTTPException(status_code=403, detail="Your account is not linked to a mentor record.")

    now = _now()
    profile = {f: getattr(payload, f) for f in _PROFILE_FIELDS}
    existing = db.students.find_one({"name": name})

    if existing is None:
        doc = {
            "name": name,
            "status": payload.status,
            "primary_mentor_id": None,
            "created_at": now,
            "updated_at": now,
            **profile,
        }
        result = db.students.insert_one(doc)
        student = db.students.find_one({"_id": result.inserted_id})
        if mentor_oid is not None:
            _record_assignment(db, student, mentor_oid, payload.assignment_reason or "Assigned on creation", principal)
            student = db.students.find_one({"_id": student["_id"]})
        return _student_out(db, student)

    # Name already exists — a mentor may only (re)claim an unassigned mentee.
    if mentor_oid is not None and existing.get("primary_mentor_id") != mentor_oid:
        if not principal.is_admin and existing.get("primary_mentor_id") is not None:
            raise HTTPException(status_code=409, detail="That mentee is already assigned to another mentor.")
        _record_assignment(db, existing, mentor_oid, payload.assignment_reason or "Claimed existing mentee", principal)
    return _student_out(db, db.students.find_one({"_id": existing["_id"]}))


@router.get("", response_model=list[StudentOut])
def list_students(
    q: str | None = Query(None),
    mentor_id: str | None = Query(None),
    area: str | None = Query(None),
    status: str | None = Query(None, description="active | paused | graduated | dropped"),
    unassigned: bool = Query(False, description="Only mentees with no mentor."),
    overdue: bool = Query(False, description="Only active/paused mentees past their cadence window."),
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    query: dict = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if status:
        query["status"] = status

    if principal.is_admin:
        if unassigned:
            query["primary_mentor_id"] = None
        elif mentor_id:
            query["primary_mentor_id"] = _oid(mentor_id, "mentor id")
        elif area:
            query["primary_mentor_id"] = {"$in": _mentor_ids_in_area(db, area)}
    else:
        query["primary_mentor_id"] = principal.mentor_oid()

    students = db.students.find(query).sort("name", 1)
    out = [_student_out(db, s) for s in students]
    if overdue:
        out = [s for s in out if s.overdue]
    return out


@router.get("/attention", response_model=AttentionSummary)
def attention_summary(db: Database = Depends(get_db), principal: Principal = Depends(get_principal)):
    """Counts that drive the 'needs attention' panel, scoped to the caller."""
    base: dict = {}
    if not principal.is_admin:
        base["primary_mentor_id"] = principal.mentor_oid()

    unassigned = 0 if not principal.is_admin else db.students.count_documents(
        {**base, "primary_mentor_id": None, "status": {"$in": list(MENTEE_ACTIVE_STATUSES)}}
    )
    paused = db.students.count_documents({**base, "status": "paused"})

    overdue = 0
    for student in db.students.find({**base, "status": {"$in": list(MENTEE_ACTIVE_STATUSES)}}):
        latest = db.sessions.find_one({"student_id": student["_id"]}, sort=[("created_at", -1)])
        if _is_overdue(student, latest["created_at"] if latest else None):
            overdue += 1

    return AttentionSummary(unassigned=unassigned, overdue=overdue, paused=paused)


# --------------------------------------------------------------------------- #
#  Assignment (audited) — admin only
# --------------------------------------------------------------------------- #
@router.patch("/{student_id}/assignment", response_model=StudentOut)
def reassign_student(
    student_id: str,
    payload: AssignmentUpdate,
    db: Database = Depends(get_db),
    principal: Principal = Depends(require_admin),
):
    student = db.students.find_one({"_id": _oid(student_id, "mentee id")})
    if student is None:
        raise HTTPException(status_code=404, detail="Mentee not found.")
    mentor_oid = _validated_mentor_oid(db, payload.primary_mentor_id)
    if student.get("primary_mentor_id") == mentor_oid:
        raise HTTPException(status_code=409, detail="Mentee is already assigned that way.")
    _record_assignment(db, student, mentor_oid, payload.reason, principal)
    return _student_out(db, db.students.find_one({"_id": student["_id"]}))


@router.post("/assign", response_model=BulkAssignResult)
def bulk_assign(
    payload: BulkAssign,
    db: Database = Depends(get_db),
    principal: Principal = Depends(require_admin),
):
    mentor_oid = _validated_mentor_oid(db, payload.primary_mentor_id)
    assigned = 0
    skipped: list[str] = []
    for sid in dict.fromkeys(payload.student_ids):  # de-dupe, preserve order
        try:
            oid = ObjectId(sid)
        except InvalidId:
            skipped.append(sid)
            continue
        student = db.students.find_one({"_id": oid})
        if student is None or student.get("primary_mentor_id") == mentor_oid:
            skipped.append(sid)
            continue
        _record_assignment(db, student, mentor_oid, payload.reason, principal)
        assigned += 1
    return BulkAssignResult(assigned=assigned, skipped=skipped)


# --------------------------------------------------------------------------- #
#  Profile edit
# --------------------------------------------------------------------------- #
@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: str,
    payload: StudentProfileUpdate,
    db: Database = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    student = _load_scoped_student(db, student_id, principal)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Mentee name cannot be empty.")
        clash = db.students.find_one({"name": name, "_id": {"$ne": student["_id"]}})
        if clash is not None:
            raise HTTPException(status_code=409, detail="Another mentee already has that name.")
        updates["name"] = name
    if updates:
        updates["updated_at"] = _now()
        db.students.update_one({"_id": student["_id"]}, {"$set": updates})
    return _student_out(db, db.students.find_one({"_id": student["_id"]}))


# --------------------------------------------------------------------------- #
#  Detail / history
# --------------------------------------------------------------------------- #
def _assignment_out(db: Database, row: dict, cache: dict) -> AssignmentOut:
    def name_of(mid) -> str | None:
        if mid is None:
            return None
        key = str(mid)
        if key not in cache:
            m = db.mentors.find_one({"_id": mid})
            cache[key] = m["name"] if m else "Unknown"
        return cache[key]

    return AssignmentOut(
        id=str(row["_id"]),
        student_id=str(row["student_id"]),
        from_mentor_id=str(row["from_mentor_id"]) if row.get("from_mentor_id") else None,
        from_mentor_name=name_of(row.get("from_mentor_id")),
        to_mentor_id=str(row["to_mentor_id"]) if row.get("to_mentor_id") else None,
        to_mentor_name=name_of(row.get("to_mentor_id")),
        reason=row.get("reason"),
        by_username=row.get("by_username"),
        created_at=row["created_at"],
    )


@router.get("/{student_id}", response_model=StudentDetailOut)
def get_student(
    student_id: str, db: Database = Depends(get_db), principal: Principal = Depends(get_principal)
):
    student = _load_scoped_student(db, student_id, principal)
    oid = student["_id"]
    base = _student_out(db, student)

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
    assignments = [
        _assignment_out(db, r, mentor_cache)
        for r in db.assignments.find({"student_id": oid}).sort("created_at", -1)
    ]
    return StudentDetailOut(
        **base.model_dump(),
        sessions=session_summaries,
        assignments=assignments,
    )


@router.get("/{student_id}/assignments", response_model=list[AssignmentOut])
def get_student_assignments(
    student_id: str, db: Database = Depends(get_db), principal: Principal = Depends(get_principal)
):
    student = _load_scoped_student(db, student_id, principal)
    cache: dict = {}
    return [
        _assignment_out(db, r, cache)
        for r in db.assignments.find({"student_id": student["_id"]}).sort("created_at", -1)
    ]


@router.get("/{student_id}/analyses", response_model=list[SessionSummaryOut])
def get_student_analyses(
    student_id: str, db: Database = Depends(get_db), principal: Principal = Depends(get_principal)
):
    return get_student(student_id, db, principal).sessions
