"""Vercel Python entrypoint. This is the ONLY file under api/ -- Vercel's
zero-config Python support treats every .py file directly in api/ as its
own serverless function, so the actual backend package lives in backend/
(main.py, routes/, services/, db.py, ...) and gets imported here instead."""

from backend.main import app  # noqa: F401
