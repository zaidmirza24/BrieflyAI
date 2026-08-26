"""Logging setup and a lightweight terminal spinner for long-running steps.

Kept dependency-free (stdlib only, plus tqdm which is already a requirement)
so it works the same in plain cmd.exe, PowerShell, and Windows Terminal.
"""

import itertools
import logging
import sys
import threading
import time

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
DATE_FORMAT = "%H:%M:%S"


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format=LOG_FORMAT,
        datefmt=DATE_FORMAT,
        stream=sys.stdout,
    )
    # Third-party libs (httpx, urllib3, huggingface_hub, etc.) log a lot at
    # INFO -- keep only warnings/errors from them so our own log stays clean.
    for noisy_logger in ("httpx", "httpcore", "urllib3", "huggingface_hub", "filelock"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


class Spinner:
    """Simple animated 'waiting' indicator for steps with no measurable
    progress (model loading/download, diarization, an LLM API call).

    Usage:
        with Spinner("Loading Whisper model"):
            ... do the work ...
    """

    FRAMES = "|/-\\"

    def __init__(self, message: str):
        self.message = message
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._start_time = 0.0

    def __enter__(self) -> "Spinner":
        self._start_time = time.time()
        if sys.stdout.isatty():
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else:
            print(f"{self.message} ...")
        return self

    def _spin(self) -> None:
        for frame in itertools.cycle(self.FRAMES):
            if self._stop_event.is_set():
                break
            sys.stdout.write(f"\r{frame} {self.message}...")
            sys.stdout.flush()
            time.sleep(0.1)

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        elapsed = time.time() - self._start_time
        if self._thread is not None:
            self._stop_event.set()
            self._thread.join()
            sys.stdout.write("\r" + " " * (len(self.message) + 15) + "\r")

        status = "OK" if exc_type is None else "FAILED"
        print(f"[{status}] {self.message} ({elapsed:.1f}s)")
        return False
