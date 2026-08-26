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

# Deepgram's `keyterm` prompting (nova-3 only) boosts recognition of specific
# terms without needing per-word confidence tuning. Kept short and mined from
# real session transcripts -- recurring org/program name, subjects, exam
# names, and Shia religious terminology that's shown up mangled before (see
# core/llm_analyzer.py's speaker-role work and the language=ur A/B test in
# .env). Per-session student/mentor names are added on top of this list at
# call time, not hardcoded here.
GLOBAL_KEYTERMS = [
    # Program/org identity -- appears in nearly every real session
    "Anfaal",
    "Anfaal Foundation",
    "mentor",
    "mentorship",
    "scholarship",
    # Academic subjects and exam/qualification names
    "Commerce",
    "Science",
    "Biology",
    "English",
    "Hindi",
    "Marathi",
    "Arabic",
    "Maths",
    "NEET",
    "MBBS",
    "IIT",
    "SSC",
    "percentage",
    "admission",
    "syllabus",
    # Shia religious terminology -- confirmed to mangle under non-Urdu
    # language settings (see the hi/ur and multi/ur A/B tests)
    "Azadari",
    "Majlis",
    "Moharram",
    "Imam Hussain",
    "Juloos",
    "Ziyarat",
    # Career/vocational terms
    "Software Engineering",
    "career guidance",
]

# `keyterm` only biases which word Deepgram recognizes -- it can't change
# what SCRIPT that word renders in. Under language=ur, a correctly-heard
# "Commerce" still comes back as "کامرس" because that's just what Urdu-script
# output does with an English loanword; that's a real limitation on this
# project's Urdulish (Urdu+English code-switched) audio, since Deepgram has
# no Urdu+English multilingual code-switching mode to fall back on.
#
# REPLACE_TERMS is a post-processing patch for exactly that: known,
# consistently-observed Urdu-script phonetic renderings of English loanwords,
# each mapped back to its actual English spelling via Deepgram's `replace`
# param (plain exact-string substitution -- no fuzzy/phonetic matching, so
# this only catches spellings we've actually confirmed Deepgram produces).
# Deliberately does NOT include native Urdu/Arabic religious vocabulary
# (Azadari, Majlis, etc.) -- those are correctly Urdu-script words, not
# garbled English, and should stay as-is.
REPLACE_TERMS = [
    ("کامرس", "Commerce"),
    ("پرسنٹیج", "percentage"),
    ("پروسنٹیج", "percentage"),
    ("بزنس", "business"),
    ("سافٹ وئر انجینئرنگ", "Software Engineering"),
    ("انفال", "Anfaal"),
    ("مینٹر", "mentor"),
]


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

    def transcribe(self, audio_path: str, extra_keyterms: list[str] | None = None) -> TranscriptionResult:
        if not self.cfg.api_key:
            raise RuntimeError(
                "DEEPGRAM_API_KEY is not set. Get a free key (with $200 free credit) at "
                "https://console.deepgram.com/signup and set it in your environment or a .env file."
            )

        from deepgram import DeepgramClient

        # SDK default is a 60s HTTP timeout, which a several-minute audio
        # upload can exceed on a slow connection well before transcription
        # itself is the bottleneck.
        client = DeepgramClient(api_key=self.cfg.api_key, timeout=180)
        language = None if not self.cfg.language or self.cfg.language == "auto" else self.cfg.language

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        # Dedupe while preserving order -- extra_keyterms (student/mentor
        # names) take priority first since callers may expect their exact
        # terms to survive even if trimmed later.
        seen = set()
        keyterms = []
        for term in [*(extra_keyterms or []), *GLOBAL_KEYTERMS]:
            if term and term not in seen:
                seen.add(term)
                keyterms.append(term)

        with Spinner(f"Transcribing + diarizing via Deepgram ({self.cfg.model})"):
            kwargs = dict(
                request=audio_bytes,
                model=self.cfg.model,
                diarize=True,
                utterances=True,
                punctuate=True,
                smart_format=True,
                keyterm=keyterms,
                replace=[f"{find}:{replacement}" for find, replacement in REPLACE_TERMS],
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
