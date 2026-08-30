# Insightder

Mentor-mentee call analysis. Upload a recording, and it gets transcribed
(with speaker diarization) and analyzed into structured insights — student
progress, goals, challenges, action items.

Two ways to use it:
- **Web app** — FastAPI backend + React frontend, with auth, MongoDB-backed
  student/session history, and a browser upload flow. This is the primary,
  deployed app.
- **CLI** (`analyze.py`) — the original single-file pipeline, still present
  for local one-off runs without any of the web app's infrastructure.

Both share the same core pipeline (`core/`): audio -> Deepgram (transcription
+ diarization, one call) -> clean transcript -> Gemini (LLM analysis) ->
structured JSON insights.

## Architecture

```
Browser (frontend/, React + Vite + Tailwind)
  │  Basic Auth (Authorization header on every request)
  ▼
FastAPI backend (backend/)
  │
  ├─ B2 (Backblaze, S3-compatible) ── temporary audio staging only.
  │     Browser uploads directly to B2 via a presigned URL (backend never
  │     touches the audio bytes). Backend downloads it back down to pull it
  │     into the pipeline, then deletes it once analysis is saved.
  │
  ├─ core/ pipeline (shared with the CLI)
  │     Deepgram (transcription + diarization) -> Gemini (analysis)
  │
  └─ MongoDB ── permanent storage for students, mentors, sessions, insights.
```

**Upload/analysis flow** (see [backend/routes/uploads.py](backend/routes/uploads.py),
[backend/routes/sessions.py](backend/routes/sessions.py)):
1. `POST /api/uploads/presign` — backend mints a short-lived presigned PUT URL for B2.
2. Browser uploads the audio file straight to B2 with that URL.
3. `POST /api/sessions` — registers a session document in MongoDB (status `UPLOADED`).
4. `POST /api/sessions/{id}/analyze` — streams progress over **SSE**: downloads
   the file from B2, runs the shared pipeline, saves the transcript + insights
   to MongoDB, then deletes the B2 object. Session `status` (see
   [backend/session_status.py](backend/session_status.py)) tracks the
   lifecycle end-to-end (`UPLOADED` -> `PROCESSING` -> `TRANSCRIBED` ->
   `ANALYZED` -> `SAVED` -> `AUDIO_DELETED`, or `FAILED`). On failure the B2
   file is left in place and the same endpoint can be called again to retry
   — no re-upload needed.

**Auth**: single hardcoded admin credential pair (env-configured), checked via
HTTP Basic on every protected request — no sessions, no user table
([backend/auth.py](backend/auth.py)).

**Data model** (MongoDB collections): `students`, `mentors`, `sessions`
(one per uploaded recording, holding status/transcript/insights).

## Project layout

```
analyze.py             CLI entry point (pipeline + printed summary)
config.py              All settings (Deepgram, Gemini, B2, MongoDB, auth) in one place
core/                  Shared pipeline, used by both the CLI and the backend
  transcriber.py         DeepgramTranscriber (transcription + diarization)
  llm_analyzer.py        GeminiProvider + the insights prompt/schema
  pipeline.py            Wires transcription -> analysis, tracks timings
  audio_utils.py         ffmpeg/ffprobe helpers
  logging_utils.py       Logging setup + terminal spinner

backend/               FastAPI app (the web app's backend)
  main.py                App setup, CORS, startup checks, routers
  auth.py                HTTP Basic auth dependency
  db.py                  MongoDB connection (pymongo)
  schemas.py             Pydantic request/response models
  session_status.py      Session lifecycle status enum
  routes/
    auth.py                GET /api/auth/check
    uploads.py             Presigned B2 upload URL + upload confirmation
    sessions.py            Register session, run analysis (SSE), fetch/list
    students.py            Student CRUD + per-student analysis history
    dashboard.py           Summary stats
    maintenance.py         Manual cleanup trigger
  services/
    storage_service.py    B2 presigned URLs, download, delete (boto3, S3-compatible)
    analysis_service.py   Orchestrates one session: B2 -> pipeline -> MongoDB -> delete B2 object
    cleanup_service.py    Sweeps stale/abandoned uploads

api/index.py           Vercel serverless entrypoint — imports backend.main:app
vercel.json            Vercel config (frontend build + Python function for api/)

frontend/              React + Vite + TypeScript + Tailwind + shadcn-style UI
  src/pages/             Login, Dashboard, Students, StudentProfile, NewAnalysis, AnalysisView
  src/components/        AudioUpload, AnalysisStepper, AnalysisResult, ResultsPanel, ui/
  src/lib/               api.ts (backend client), auth.ts
```

## 1. Setup

**Prerequisites**
- Python 3.10+
- Node.js (for the frontend)
- [ffmpeg](https://ffmpeg.org/) on your PATH (used to read audio duration)
  - Windows: `winget install Gyan.FFmpeg` (then open a new terminal)

**Backend**
```bash
cd Insightder
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in:
- **Deepgram** (transcription + diarization): free $200 credit, no card. **https://console.deepgram.com/signup**
- **Gemini** (analysis): free tier. **https://aistudio.google.com/apikey**
- **MongoDB** (`MONGODB_URI`): free cluster at **https://www.mongodb.com/cloud/atlas/register**
- **Backblaze B2** (`B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_ENDPOINT`, `B2_BUCKET`): temporary audio staging bucket — only needed for the web app's browser-upload flow, not the CLI
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: web app login
- `CORS_ORIGIN`: frontend origin (defaults to `http://localhost:5173`)

**Frontend**
```bash
cd frontend
npm install
```

## 2. Run

**Web app** (two terminals):
```bash
# Backend
venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Frontend
cd frontend
npm run dev
```
Open the frontend dev server URL, log in with `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

**CLI** (no backend/frontend/MongoDB/B2 needed):
```bash
python analyze.py "path\to\audio.mp3"
```
Outputs are written to `output/<audio filename>/`:
- `transcript.txt` — clean, timestamped, speaker-labeled transcript
- `insights.json` — structured analysis

### Useful CLI flags

```bash
python analyze.py "call.mp3" --language ur                      # force language instead of auto-detect
python analyze.py "call.mp3" --insights-language roman-urdu     # write insights.json in Roman Urdu/Urdulish
python analyze.py "call.mp3" --llm-model gemini-3.6-pro         # higher-quality analysis
python analyze.py "call.mp3" --output-dir results/session1
```

### Forcing the language

Auto-detect only looks at the first ~30 seconds and locks the whole file to
one language — this fails badly on recordings that open in one language
(e.g. English greetings) but are mostly another (e.g. Urdu). If your
recordings are consistently in one language, force it:
```
WHISPER_LANGUAGE=ur
```
in `.env` (or `--language ur` per run). Deepgram's `nova-3` model has
production-grade Hindi and Urdu support, including Hinglish/Urdulish
code-switching, so English words mixed into Urdu speech still transcribe
correctly once the base language is forced correctly.

## 3. Insights schema

```json
{
  "summary": "",
  "school_name": "",
  "student_participation": "",
  "tuition_status": "",
  "study_hours": "",
  "current_routine": "",
  "goals": [],
  "challenges": [],
  "mentor_advice": [],
  "mentee_commitments": [],
  "action_items": [],
  "important_points": [],
  "mentor_suggestions": []
}
```
Keys always stay in English for consistent parsing; the text *values* follow
`INSIGHTS_LANGUAGE` (`english` default, or `roman-urdu`/`roman-hindi`).

## Locked-in stack

This project intentionally runs on hosted APIs rather than local models:

- **Deepgram** (`nova-3`) — transcription + diarization in one call, fast,
  strong Hindi/Urdu support. The audio file is uploaded to Deepgram.
- **Gemini** — LLM analysis. Only the transcript text is sent, never audio.
- **Backblaze B2** — temporary staging for browser-uploaded audio (web app only).
- **MongoDB** — permanent storage for students/mentors/sessions/insights (web app only).

If you need a fully offline/local pipeline instead (no data leaving your
machine at all), that's a different architecture — local Whisper for
transcription and a local LLM via Ollama for analysis — and would need to
be rebuilt; ask if you want that path.

## Deployment

Deployed to Vercel as a single project: the frontend builds as a static Vite
site, and `api/index.py` is a Python serverless function that imports the
FastAPI app from `backend/main.py` (see [vercel.json](vercel.json)). All
`/api/*` requests route to that function; everything else falls back to the
SPA's `index.html`.

## Troubleshooting

- **"ffmpeg was not found on PATH"** — install ffmpeg and open a new terminal.
- **"No module named 'deepgram'" (or similar)** — you're running the
  system Python instead of the venv. Run `venv\Scripts\Activate.ps1` first.
- **"DEEPGRAM_API_KEY is not set" / "GEMINI_API_KEY is not set"** — check your `.env` file.
- **"MONGODB_URI is not set"** — needed for the web app (not the CLI); create a free Atlas cluster.
- **"Audio storage isn't configured yet"** — set `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_ENDPOINT` for the web app's upload flow.
- **LLM analysis failed with a 503/UNAVAILABLE error** — transient overload on Gemini's end; the transcript is still saved, just retry the analysis.
- **Wrong language detected / garbled transcript** — force the language with `WHISPER_LANGUAGE` in `.env` or `--language` (see section 2).
