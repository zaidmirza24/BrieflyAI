"""Pydantic response/request models for the API. Mongo documents are worked
with as plain dicts internally (see api/services/); these schemas define
the shape returned to the client."""

import datetime

from pydantic import BaseModel

from backend.session_status import SessionStatus


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
    student_name: str
    mentor_name: str
    audio_filename: str
    status: SessionStatus
    created_at: datetime.datetime


class StudentOut(BaseModel):
    id: str
    name: str
    mentor_name: str | None
    mentor_area: str | None = None
    analysis_count: int
    last_analysis_at: datetime.datetime | None


class StudentDetailOut(BaseModel):
    id: str
    name: str
    mentor_name: str | None
    analysis_count: int
    last_analysis_at: datetime.datetime | None
    sessions: list[SessionSummaryOut]


class DashboardSummary(BaseModel):
    total_students: int
    total_analyses: int
    recent_analyses: list[SessionSummaryOut]


class StudentCreate(BaseModel):
    name: str
    primary_mentor_id: str | None = None  # admin may assign on create; ignored for mentors (self-assigned)


class MentorOut(BaseModel):
    id: str
    name: str
    area: str | None = None


class MentorAdminOut(MentorOut):
    gender: str | None = None
    contact: str | None = None
    education: str | None = None
    mentee_count: int = 0
    account_username: str | None = None  # None -> no login provisioned yet


class MentorCreate(BaseModel):
    name: str
    area: str
    gender: str | None = None
    contact: str | None = None
    education: str | None = None


class MentorUpdate(BaseModel):
    name: str | None = None
    area: str | None = None
    gender: str | None = None
    contact: str | None = None
    education: str | None = None


class MentorAccountCreate(BaseModel):
    username: str


class MentorAccountOut(BaseModel):
    username: str
    temp_password: str  # shown once, on create / reset — never stored in clear


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


class StudentUpdate(BaseModel):
    primary_mentor_id: str | None = None
