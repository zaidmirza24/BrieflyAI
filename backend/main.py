"""FastAPI app entry point. Run with:
    uvicorn backend.main:app --reload
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import AppConfig
from core.audio_utils import check_ffmpeg
from core.logging_utils import setup_logging
from backend.db import ensure_indexes, get_db
from backend.routes import dashboard, maintenance, sessions, students, uploads
from backend.routes import auth as auth_routes
from backend.services.cleanup_service import cleanup_stale_sessions

setup_logging()
logger = logging.getLogger("api")

cfg = AppConfig()

app = FastAPI(title="Mentor-Mentee Insights API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[cfg.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(uploads.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(dashboard.router)
app.include_router(maintenance.router)


@app.on_event("startup")
def on_startup() -> None:
    try:
        ensure_indexes()
    except Exception as e:
        logger.warning("Could not connect to MongoDB on startup: %s", e)

    try:
        check_ffmpeg()
    except RuntimeError as e:
        logger.warning("%s", e)

    try:
        cleanup_stale_sessions(get_db(), cfg)
    except Exception as e:
        logger.warning("Startup cleanup pass skipped: %s", e)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never leak raw stack traces / internal paths to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred."})


@app.get("/api/health")
def health():
    return {"status": "ok"}
