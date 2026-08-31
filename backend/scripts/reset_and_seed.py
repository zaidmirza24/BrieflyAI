"""DESTRUCTIVE reset: wipe all mentor/mentee/session data and re-seed the
mentors + mentees straight from the Anfaal Foundation "Mentor & Mentee list
Mumbra" planning sheet (15-Aug-26).

Run with:
    python -m backend.scripts.reset_and_seed

What it clears: `students`, `mentors`, `assignments`, `sessions`, and every
non-admin (mentor) row in `users`. The admin login is preserved. Object
storage (B2) is not touched -- staged audio is already deleted on success.

After wiping it calls the idempotent seed in `seed_mentors_mentees`.
"""

from backend.db import ensure_indexes, get_db
from backend.scripts.seed_mentors_mentees import seed


def reset_and_seed() -> None:
    db = get_db()

    for coll in ("students", "mentors", "assignments", "sessions"):
        deleted = db[coll].delete_many({}).deleted_count
        print(f"Cleared {deleted} docs from {coll!r}")

    users_deleted = db.users.delete_many({"role": {"$ne": "admin"}}).deleted_count
    print(f"Cleared {users_deleted} non-admin user(s)")

    ensure_indexes()
    seed()


if __name__ == "__main__":
    reset_and_seed()
