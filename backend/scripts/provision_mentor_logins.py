"""Bulk-provision one login per mentor that doesn't have one yet.

Idempotent: mentors who already have a mentor account are skipped, so this is
safe to re-run after adding new mentors. Also prunes broken mentor accounts
(role="mentor" but not linked to an existing mentor record).

Run from the repo root with the venv active:
    python -m backend.scripts.provision_mentor_logins

Each new login's one-time password is printed ONCE here and never stored in
clear -- capture the output and distribute over a private channel. Use the
admin "Reset password" action later if one is lost.
"""

import datetime
import re

from backend.db import get_db
from backend.security import generate_temp_password, hash_password

USERNAME_RE = re.compile(r"[a-z0-9._-]{3,32}")


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")[:32].strip(".")
    return s or "mentor"


def _unique_username(db, base: str) -> str:
    candidate = base
    n = 2
    while db.users.find_one({"username": candidate}):
        suffix = str(n)
        candidate = f"{base[: 32 - len(suffix) - 1]}.{suffix}"
        n += 1
    return candidate


def main() -> None:
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)
    mentor_ids = {m["_id"] for m in db.mentors.find({}, {"_id": 1})}

    pruned = db.users.delete_many(
        {"role": "mentor", "$or": [{"mentor_id": None}, {"mentor_id": {"$exists": False}}, {"mentor_id": {"$nin": list(mentor_ids)}}]}
    )
    if pruned.deleted_count:
        print(f"Pruned {pruned.deleted_count} broken mentor account(s).\n")

    created: list[tuple[str, str, str]] = []
    skipped = 0
    for mentor in db.mentors.find().sort("name", 1):
        if db.users.find_one({"mentor_id": mentor["_id"], "role": "mentor"}):
            skipped += 1
            continue
        base = _slug(mentor["name"])
        if not USERNAME_RE.fullmatch(base):
            base = "mentor"
        username = _unique_username(db, base)
        temp_password = generate_temp_password()
        db.users.insert_one(
            {
                "username": username,
                "password_hash": hash_password(temp_password),
                "role": "mentor",
                "mentor_id": mentor["_id"],
                "disabled": False,
                "created_at": now,
                "updated_at": now,
            }
        )
        created.append((mentor["name"], username, temp_password))

    print(f"Created {len(created)} login(s); skipped {skipped} mentor(s) that already had one.\n")
    if created:
        width = max(len(n) for n, _, _ in created)
        print(f"{'MENTOR'.ljust(width)}  {'USERNAME'.ljust(24)}  TEMP PASSWORD")
        print(f"{'-' * width}  {'-' * 24}  {'-' * 14}")
        for name, username, pw in created:
            print(f"{name.ljust(width)}  {username.ljust(24)}  {pw}")


if __name__ == "__main__":
    main()
