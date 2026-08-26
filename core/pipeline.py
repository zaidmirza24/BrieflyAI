"""Wires transcription+diarization (Deepgram) -> transcript formatting -> LLM analysis."""

import logging
import time
from dataclasses import dataclass
from typing import Callable

from config import AppConfig
from core.llm_analyzer import INSIGHTS_SCHEMA, get_provider
from core.logging_utils import Spinner
from core.transcriber import DeepgramTranscriber, TranscriptionResult

logger = logging.getLogger(__name__)


@dataclass
class PipelineTimings:
    transcription_seconds: float = 0.0
    llm_seconds: float = 0.0

    @property
    def total_seconds(self) -> float:
        return self.transcription_seconds + self.llm_seconds


@dataclass
class PipelineResult:
    transcription: TranscriptionResult
    clean_transcript: str
    insights: dict
    timings: PipelineTimings
    diarization_status: str
    warnings: list[str]


def format_transcript(transcription: TranscriptionResult) -> str:
    """Produces a clean, readable transcript. Uses speaker labels when
    available, otherwise plain sequential text."""
    lines = []
    for seg in transcription.segments:
        timestamp = f"[{_fmt_ts(seg.start)}]"
        if seg.speaker:
            lines.append(f"{timestamp} {seg.speaker}: {seg.text.strip()}")
        else:
            lines.append(f"{timestamp} {seg.text.strip()}")
    return "\n".join(lines)


def _fmt_ts(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def run_pipeline(
    audio_path: str,
    cfg: AppConfig,
    on_stage: "Callable[[str], None] | None" = None,
) -> PipelineResult:
    """Runs the full pipeline. `on_stage`, if given, is called with one of
    'transcribing', 'transcribed', 'analyzing', 'analyzed' right before/after
    each stage -- used by the API to stream progress. The CLI doesn't pass
    one, so its behavior is unchanged."""
    warnings: list[str] = []
    timings = PipelineTimings()

    def _notify(stage: str) -> None:
        if on_stage:
            on_stage(stage)

    # 1. Transcription + diarization (single Deepgram call)
    _notify("transcribing")
    transcriber = DeepgramTranscriber(cfg.transcription)
    t0 = time.time()
    transcription = transcriber.transcribe(audio_path)
    timings.transcription_seconds = time.time() - t0

    speaker_count = len({s.speaker for s in transcription.segments if s.speaker})
    diarization_status = f"{speaker_count} speakers found" if speaker_count else "no speakers detected"
    logger.info("Diarization: %s", diarization_status)

    # 2. Clean transcript
    clean_transcript = format_transcript(transcription)
    _notify("transcribed")

    # 3. LLM analysis (transcript text only, never audio)
    _notify("analyzing")
    provider = get_provider(cfg.llm)
    t0 = time.time()
    try:
        with Spinner(f"Analyzing transcript with gemini ({cfg.llm.model})"):
            insights = provider.analyze(clean_transcript)
    except Exception as e:
        warnings.append(f"LLM analysis failed: {e}")
        logger.error("LLM analysis failed: %s", e)
        insights = dict(INSIGHTS_SCHEMA)
    timings.llm_seconds = time.time() - t0
    _notify("analyzed")

    return PipelineResult(
        transcription=transcription,
        clean_transcript=clean_transcript,
        insights=insights,
        timings=timings,
        diarization_status=diarization_status,
        warnings=warnings,
    )
