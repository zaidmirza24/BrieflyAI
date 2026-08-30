"""
Central configuration for the mentor-mentee audio analysis CLI.

Locked-in stack: Deepgram for transcription + diarization (single hosted
call), Gemini for LLM analysis. All tunables live here so the other modules
never hardcode model names. Everything can be overridden via environment
variables or CLI flags (see analyze.py).
"""

import os
from dataclasses import dataclass, field

# Dataclass field defaults below read os.environ.get(...) at class-definition
# time (i.e. the first time this module is imported), so .env must be loaded
# here -- before anything else imports from this module -- or those defaults
# would permanently miss any variable that's only set in .env.
#
# Loaded by explicit path (next to this file), not load_dotenv()'s default
# cwd-search -- otherwise running `uvicorn api.main:app` from a different
# working directory (or via a process manager) silently finds no .env and
# every var falls back to its default/None.
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass


@dataclass
class TranscriptionConfig:
    api_key: str | None = os.environ.get("DEEPGRAM_API_KEY")
    model: str = os.environ.get("DEEPGRAM_MODEL", "nova-3")
    # None / "auto" -> Deepgram auto-detects language
    language: str | None = os.environ.get("WHISPER_LANGUAGE", None)


@dataclass
class LLMConfig:
    model: str = os.environ.get("LLM_MODEL", "gemini-3.6-flash")
    api_key: str | None = os.environ.get("GEMINI_API_KEY")
    max_tokens: int = int(os.environ.get("LLM_MAX_TOKENS", "4096"))
    temperature: float = float(os.environ.get("LLM_TEMPERATURE", "0.2"))
    # "english" (default), "roman-urdu", or "roman-hindi" -- controls the
    # language the LLM writes insights.json's text values in (JSON keys
    # always stay English for consistent parsing)
    insights_language: str = os.environ.get("INSIGHTS_LANGUAGE", "english")


@dataclass
class AppConfig:
    transcription: TranscriptionConfig = field(default_factory=TranscriptionConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    output_dir: str = os.environ.get("OUTPUT_DIR", "output")

    # -- Web app (api/) settings; unused by the CLI --
    admin_username: str = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password: str = os.environ.get("ADMIN_PASSWORD", "admin123")
    cors_origin: str = os.environ.get("CORS_ORIGIN", "http://localhost:5173")

    # -- Auth (JWT) -- bearer tokens issued by POST /api/auth/login. Set
    # JWT_SECRET in every real deployment; the default only exists so local
    # dev works out of the box (startup logs a warning when it's in use).
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-insecure-change-me")
    jwt_ttl_seconds: int = int(os.environ.get("JWT_TTL_SECONDS", str(60 * 60 * 12)))
    max_upload_mb: int = int(os.environ.get("MAX_UPLOAD_MB", "500"))

    # -- Object storage (Backblaze B2, S3-compatible) -- TEMPORARY staging only:
    # audio is deleted once analysis is saved to MongoDB (see api/services/).
    b2_key_id: str | None = os.environ.get("B2_KEY_ID")
    b2_application_key: str | None = os.environ.get("B2_APPLICATION_KEY")
    b2_endpoint: str | None = os.environ.get("B2_ENDPOINT")  # e.g. https://s3.us-west-004.backblazeb2.com
    b2_bucket: str = os.environ.get("B2_BUCKET", "insightder-audio-temp")
    # Presigned URL validity window, in seconds (long enough for a slow 15-20min upload).
    b2_upload_url_ttl_seconds: int = int(os.environ.get("B2_UPLOAD_URL_TTL_SECONDS", "3600"))

    # -- MongoDB (permanent storage for students/mentors/sessions/insights) --
    # Accepts MONGO_URI too (common shorthand) as a fallback for MONGODB_URI.
    mongodb_uri: str | None = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
    mongodb_db_name: str = os.environ.get("MONGODB_DB_NAME", "insightder")

    # -- Cleanup of abandoned/failed uploads still sitting in B2 --
    cleanup_max_age_hours: int = int(os.environ.get("CLEANUP_MAX_AGE_HOURS", "24"))
