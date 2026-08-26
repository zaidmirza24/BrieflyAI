"""Small audio helper utilities that don't belong to any single pipeline stage."""

import json
import logging
import shutil
import subprocess

logger = logging.getLogger(__name__)


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "ffmpeg was not found on PATH. Whisper needs it to decode audio.\n"
            "Install it and make sure 'ffmpeg' works from a new terminal:\n"
            "  Windows (winget): winget install Gyan.FFmpeg\n"
            "  Windows (choco):  choco install ffmpeg"
        )


def get_audio_duration_seconds(audio_path: str) -> float:
    """Uses ffprobe (ships with ffmpeg) to read duration without decoding the file."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json",
                audio_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception as e:
        logger.warning("Could not determine audio duration via ffprobe: %s", e)
        return 0.0
