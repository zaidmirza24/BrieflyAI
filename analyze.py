#!/usr/bin/env python
"""
CLI entry point for mentor-mentee audio analysis.
Locked-in stack: Deepgram (transcription + diarization) -> Gemini (analysis).

Usage:
    python analyze.py "path/to/audio.mp3"
    python analyze.py "path/to/audio.mp3" --language ur --insights-language roman-urdu
"""

import argparse
import json
import logging
import os
import sys
import time

from config import AppConfig  # also loads .env -- must be the first local import
from core.audio_utils import check_ffmpeg, get_audio_duration_seconds
from core.logging_utils import setup_logging
from core.pipeline import run_pipeline

setup_logging()
logger = logging.getLogger("analyze")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe and analyze a mentor-mentee audio recording.")
    parser.add_argument("audio_path", help="Path to the audio file (mp3, wav, m4a, aac, etc.)")
    parser.add_argument("--deepgram-model", default=None, help="Deepgram model. Default: nova-3")
    parser.add_argument("--language", default=None, help="Force a language code (e.g. 'ur', 'hi', 'en'). Default: auto-detect")
    parser.add_argument("--output-dir", default=None, help="Directory to write transcript.txt / insights.json. Default: output/<audio filename>")
    parser.add_argument("--llm-model", default=None, help="Override the Gemini model. Default: gemini-3.6-flash")
    parser.add_argument("--insights-language", default=None, choices=["english", "roman-urdu", "roman-hindi"], help="Language for insights.json text values. Default: english")
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> AppConfig:
    cfg = AppConfig()
    if args.deepgram_model:
        cfg.transcription.model = args.deepgram_model
    if args.language:
        cfg.transcription.language = args.language
    if args.llm_model:
        cfg.llm.model = args.llm_model
    if args.insights_language:
        cfg.llm.insights_language = args.insights_language
    return cfg


def main() -> int:
    args = parse_args()

    if not os.path.isfile(args.audio_path):
        logger.error("Audio file not found: %s", args.audio_path)
        return 1

    try:
        check_ffmpeg()
    except RuntimeError as e:
        logger.error(str(e))
        return 1

    cfg = build_config(args)

    audio_basename = os.path.splitext(os.path.basename(args.audio_path))[0]
    output_dir = args.output_dir or os.path.join(cfg.output_dir, audio_basename)
    os.makedirs(output_dir, exist_ok=True)

    logger.info("Audio file:    %s", args.audio_path)
    logger.info("Output dir:    %s", output_dir)
    logger.info("Transcription: deepgram model=%s (includes diarization)", cfg.transcription.model)
    logger.info("LLM:           gemini model=%s", cfg.llm.model)
    print("-" * 60)

    audio_duration = get_audio_duration_seconds(args.audio_path)

    overall_start = time.time()
    try:
        result = run_pipeline(args.audio_path, cfg)
    except Exception as e:
        logger.error("Pipeline failed: %s", e)
        return 1
    overall_elapsed = time.time() - overall_start

    transcript_path = os.path.join(output_dir, "transcript.txt")
    insights_path = os.path.join(output_dir, "insights.json")

    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(result.clean_transcript)

    with open(insights_path, "w", encoding="utf-8") as f:
        json.dump(result.insights, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)
    print(f"Detected language:     {result.transcription.language} "
          f"(confidence {result.transcription.language_probability:.2f})")
    print(f"Diarization status:    {result.diarization_status}")
    print(f"Audio duration:        {audio_duration:.1f}s")
    print(f"Transcription time:    {result.timings.transcription_seconds:.1f}s")
    print(f"LLM analysis time:     {result.timings.llm_seconds:.1f}s")
    print(f"Total processing time: {overall_elapsed:.1f}s")
    print(f"Transcript saved to:   {transcript_path}")
    print(f"Insights saved to:     {insights_path}")

    if result.warnings:
        print("\nWarnings:")
        for w in result.warnings:
            print(f"  - {w}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
