"""Pydantic response/request models for the API. Mongo documents are worked
with as plain dicts internally (see api/services/); these schemas define
the shape returned to the client."""

import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field, field_validator

from backend.session_status import SessionStatus

MenteeStatus = Literal["active", "paused", "graduated", "dropped"]
Gender = Literal["M", "F", "O"]

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic paginated list envelope."""

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class SessionCreate(BaseModel):
    student_id: str
    mentor_id: str
    storage_key: str
    audio_filename: str
    audio_duration: float | None = None
    content_type: str | None = None


class SessionCreated(BaseModel):
    id: str
    status: SessionStatus


class SessionOut(BaseModel):
    id: str
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    audio_filename: str
    audio_duration: float | None
    transcription_backend: str
    status: SessionStatus
    error: str | None = None
    transcript: str | None = None
    insights: dict | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SessionSummaryOut(BaseModel):
    id: str
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    audio_filename: str
    status: SessionStatus
    created_at: datetime.datetime


class AssignmentOut(BaseModel):
    id: str
    student_id: str
    from_mentor_id: str | None = None
    from_mentor_name: str | None = None
    to_mentor_id: str | None = None
    to_mentor_name: str | None = None
    reason: str | None = None
    by_username: str | None = None
    created_at: datetime.datetime


class StudentOut(BaseModel):
    id: str
    name: str
    gender: Gender | None = None
    contact: str | None = None
    std: str | None = None
    school: str | None = None
    area: str | None = None
    status: MenteeStatus = "active"
    cadence_days: int | None = None
    notes: str | None = None
    primary_mentor_id: str | None = None
    mentor_name: str | None = None
    mentor_area: str | None = None
    analysis_count: int
    last_analysis_at: datetime.datetime | None
    created_at: datetime.datetime | None = None
    # True when status is active/paused and the last session is older than the
    # cadence window (or there has never been a session).
    overdue: bool = False


class StudentDetailOut(StudentOut):
    sessions: list[SessionSummaryOut] = []
    assignments: list[AssignmentOut] = []


class DashboardSummary(BaseModel):
    total_students: int
    total_analyses: int
    recent_analyses: list[SessionSummaryOut]


class _MenteeProfile(BaseModel):
    gender: Gender | None = None
    contact: str | None = Field(None, max_length=40)
    std: str | None = Field(None, max_length=20)
    school: str | None = Field(None, max_length=160)
    area: str | None = Field(None, max_length=80)
    cadence_days: int | None = Field(None, ge=1, le=365)
    notes: str | None = Field(None, max_length=2000)

    @field_validator("contact", "std", "school", "area", "notes", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class StudentCreate(_MenteeProfile):
    name: str = Field(min_length=1, max_length=120)
    status: MenteeStatus = "active"
    primary_mentor_id: str | None = None  # admin may assign on create; ignored for mentors (self-assigned)
    assignment_reason: str | None = Field(None, max_length=500)


class StudentProfileUpdate(_MenteeProfile):
    """Edit mentee attributes. Does NOT change mentor assignment — that is a
    separate, audited action (PATCH /students/{id}/assignment)."""

    name: str | None = Field(None, min_length=1, max_length=120)
    status: MenteeStatus | None = None


class AssignmentUpdate(BaseModel):
    primary_mentor_id: str | None = None  # None -> unassign (return to the queue)
    reason: str = Field(min_length=3, max_length=500)


class BulkAssign(BaseModel):
    student_ids: list[str] = Field(min_length=1, max_length=200)
    primary_mentor_id: str
    reason: str = Field(min_length=3, max_length=500)


class BulkAssignResult(BaseModel):
    assigned: int
    skipped: list[str] = []


class AttentionSummary(BaseModel):
    unassigned: int
    overdue: int
    paused: int


class MentorOut(BaseModel):
    id: str
    name: str
    area: str | None = None


class MentorAdminOut(MentorOut):
    gender: str | None = None
    contact: str | None = None
    education: str | None = None
    capacity: int | None = None  # target max active mentees; None -> no cap set
    mentee_count: int = 0  # active + paused mentees currently assigned
    account_username: str | None = None  # None -> no login provisioned yet


class MentorCreate(BaseModel):
    name: str
    area: str
    gender: str | None = None
    contact: str | None = None
    education: str | None = None
    capacity: int | None = Field(None, ge=1, le=500)
    # Optional inline login provisioning. Supply both to create the mentor's
    # account in the same step; leave both blank to add the login later.
    username: str | None = Field(None, min_length=3, max_length=32)
    password: str | None = Field(None, min_length=8, max_length=128)


class MentorUpdate(BaseModel):
    name: str | None = None
    area: str | None = None
    gender: str | None = None
    contact: str | None = None
    education: str | None = None
    capacity: int | None = Field(None, ge=1, le=500)


class MentorAccountCreate(BaseModel):
    username: str
    password: str | None = Field(None, min_length=8, max_length=128)  # None -> generate a one-time password


class MentorAccountOut(BaseModel):
    username: str
    temp_password: str  # shown once, on create / reset — never stored in clear


class MentorCreated(MentorOut):
    account: MentorAccountOut | None = None  # present when a login was provisioned inline


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    role: str
    username: str


class MeResponse(BaseModel):
    username: str
    role: str
    mentor_id: str | None = None
    mentor_name: str | None = None
    area: str | None = None
