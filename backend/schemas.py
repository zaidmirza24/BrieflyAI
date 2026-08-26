"""Pydantic response/request models for the API. Mongo documents are worked
with as plain dicts internally (see api/services/); these schemas define
the shape returned to the client."""

import datetime

from pydantic import BaseModel

from backend.session_status import SessionStatus


class SessionCreate(BaseModel):
    student_name: str
    mentor_name: str
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
