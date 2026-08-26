"""
Transcription + diarization via Deepgram.

One hosted call does both transcription and speaker diarization together
(segments come back with speaker labels already attached), which is why
there's no separate diarization module -- Deepgram's `nova-3` model has
production-grade Hindi/Urdu support including Hinglish code-switching.

Not local: the audio file is uploaded to Deepgram's servers.

To swap transcription providers later, implement the same `transcribe()`
contract on a new class and swap the instantiation in pipeline.py.
"""

import logging
from dataclasses import dataclass, field

from config import TranscriptionConfig
from core.logging_utils import Spinner

logger = logging.getLogger(__name__)


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    speaker: str | None = None


@dataclass
class TranscriptionResult:
    language: str
    language_probability: float
    segments: list[TranscriptSegment] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments).strip()


class DeepgramTranscriber:
    def __init__(self, cfg: TranscriptionConfig):
        self.cfg = cfg

    def transcribe(self, audio_path: str) -> TranscriptionResult:
        if not self.cfg.api_key:
            raise RuntimeError(
                "DEEPGRAM_API_KEY is not set. Get a free key (with $200 free credit) at "
                "https://console.deepgram.com/signup and set it in your environment or a .env file."
            )

        from deepgram import DeepgramClient

        client = DeepgramClient(api_key=self.cfg.api_key)
        language = None if not self.cfg.language or self.cfg.language == "auto" else self.cfg.language

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        with Spinner(f"Transcribing + diarizing via Deepgram ({self.cfg.model})"):
            kwargs = dict(
                request=audio_bytes,
                model=self.cfg.model,
                diarize=True,
                utterances=True,
                punctuate=True,
                smart_format=True,
            )
            if language:
                kwargs["language"] = language
            else:
                kwargs["detect_language"] = True
            response = client.listen.v1.media.transcribe_file(**kwargs)

        utterances = response.results.utterances or []
        segments = [
            TranscriptSegment(
                start=u.start,
                end=u.end,
                text=u.transcript.strip(),
                speaker=f"SPEAKER_{u.speaker:02d}" if u.speaker is not None else None,
            )
            for u in utterances
        ]

        detected_language = language or "unknown"
        channels = response.results.channels or []
        if channels and getattr(channels[0], "detected_language", None):
            detected_language = channels[0].detected_language

        logger.info("Detected language: %s", detected_language)

        return TranscriptionResult(
            language=detected_language,
            language_probability=1.0,  # Deepgram doesn't expose an overall confidence score
            segments=segments,
        )
