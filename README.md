# Mentor-Mentee Audio Analysis CLI

Pipeline: audio file -> Deepgram (transcription + speaker diarization, one
call) -> clean transcript -> Gemini (LLM analysis) -> structured JSON
insights.

Runs entirely from the command line. No frontend, no database, no Docker,
no auth. Only the transcript text is sent to Gemini; the audio file itself
is uploaded to Deepgram for transcription (this is a hosted-API pipeline,
not a local one -- see "Locked-in stack" below).

## 1. Install

**Prerequisites**
- Python 3.10+
- [ffmpeg](https://ffmpeg.org/) on your PATH (used to read audio duration)
  - Windows: `winget install Gyan.FFmpeg` (then open a new terminal)

**Setup**

```bash
cd Insightder
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```
Then fill in two keys:
- **Deepgram** (transcription + diarization): free $200 credit, no card. **https://console.deepgram.com/signup**
- **Gemini** (analysis): free tier. **https://aistudio.google.com/apikey**

**Every time you open a new terminal**, activate the venv first:
```bash
venv\Scripts\Activate.ps1     # PowerShell
```

## 2. Run

```bash
python analyze.py "path\to\audio.mp3"
```

Outputs are written to `output/<audio filename>/`:
- `transcript.txt` — clean, timestamped, speaker-labeled transcript
- `insights.json` — structured analysis

A typical 10-15 minute call finishes end-to-end in well under a minute.

### Useful flags

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

## 3. insights.json schema

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
  "important_points": []
}
```
Keys always stay in English for consistent parsing; the text *values* follow
`INSIGHTS_LANGUAGE` (`english` default, or `roman-urdu`/`roman-hindi`).

## Locked-in stack

This project intentionally runs on two hosted APIs rather than local
models:

- **Deepgram** (`nova-3`) — transcription + diarization in one call, fast,
  strong Hindi/Urdu support. The audio file is uploaded to Deepgram.
- **Gemini** — LLM analysis. Only the transcript text is sent, never audio.

If you need a fully offline/local pipeline instead (no data leaving your
machine at all), that's a different architecture — local Whisper for
transcription and a local LLM via Ollama for analysis — and would need to
be rebuilt; ask if you want that path.

## Project layout

```
analyze.py            CLI entry point / orchestration + printed summary
config.py             Deepgram + Gemini settings in one place
core/
  transcriber.py       DeepgramTranscriber (transcription + diarization)
  llm_analyzer.py       GeminiProvider + the insights prompt/schema
  pipeline.py           Wires transcription -> analysis, tracks timings
  audio_utils.py        ffmpeg/ffprobe helpers
  logging_utils.py       Logging setup + terminal spinner
```

## Troubleshooting

- **"ffmpeg was not found on PATH"** — install ffmpeg and open a new terminal.
- **"No module named 'deepgram'" (or similar)** — you're running the
  system Python instead of the venv. Run `venv\Scripts\Activate.ps1` first.
- **"DEEPGRAM_API_KEY is not set" / "GEMINI_API_KEY is not set"** — check your `.env` file.
- **LLM analysis failed with a 503/UNAVAILABLE error** — transient overload on Gemini's end; the transcript is still saved, just rerun for the analysis.
- **Wrong language detected / garbled transcript** — force the language with `WHISPER_LANGUAGE` in `.env` or `--language` (see section 2).
