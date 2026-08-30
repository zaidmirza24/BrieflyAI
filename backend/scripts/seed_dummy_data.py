"""Dev-only: add demo data so the dashboards aren't empty.

  - 2 Govandi mentors (+ logins) with 4 mentees, so the location filter has
    both Mumbra and Govandi populated
  - ~10 completed analysis sessions with fake transcripts + insights, spread
    over the last few weeks, across several mentors

Every document created here carries `"dummy": true`. Run:

    python -m backend.scripts.seed_dummy_data          # add (skips if already present)
    python -m backend.scripts.seed_dummy_data --reset  # remove all dummy docs

NEVER run this against production data.
"""

import datetime
import random
import sys

from backend.db import get_db
from backend.security import generate_temp_password, hash_password
from backend.session_status import SessionStatus

GOVANDI_MENTORS = [
    ("Farhan Qureshi", "M", "9820011223", "Govandi", "B.Sc IT"),
    ("Nafisa Shaikh", "F", "9820044556", "Govandi", "M.A. Education"),
]
GOVANDI_MENTEES = [
    ("Farhan Qureshi", [("Adnan Shaikh", "9820500001", "9th", "M"), ("Sana Patel", "9820500002", "10th", "F")]),
    ("Nafisa Shaikh", [("Rehan Ansari", "9820500003", "8th", "M"), ("Iqra Khan", "9820500004", "9th", "F")]),
]

TRANSCRIPT = (
    "Mentor: Assalamu alaikum, how was your week?\n"
    "Mentee: Walaikum assalam. It was okay, I had my unit tests.\n"
    "Mentor: How did they go? Which subject felt hardest?\n"
    "Mentee: Maths was hard, especially trigonometry. Science was fine.\n"
    "Mentor: Let's plan an extra hour of maths practice on weekdays. Can you commit to that?\n"
    "Mentee: Yes, I can do 7 to 8 pm after dinner.\n"
    "Mentor: Good. Also keep a doubt notebook and bring it next session."
)


def _insights(name: str) -> dict:
    return {
        "summary": f"{name} completed unit tests this week. Maths (trigonometry) is the main pain point; "
        "science is comfortable. Agreed to add a daily maths practice hour and maintain a doubt notebook.",
        "school_name": "Anjuman Islam High School",
        "student_participation": "Engaged, answered openly, slightly hesitant about maths.",
        "tuition_status": "Attending tuition for science only.",
        "study_hours": {"current": 2, "target": 3, "unit": "hours_per_day", "mentioned": True},
        "current_routine": "School till 2pm, rest, homework in the evening, sleeps by 11pm.",
        "goals": ["Score above 80% in the maths final", "Finish the NCERT trigonometry exercises"],
        "challenges": ["Trigonometry identities", "Gets distracted by phone during study time"],
        "mentor_advice": ["Practice one hour of maths daily, 7-8pm", "Keep a doubt notebook", "Put phone in another room while studying"],
        "mentee_commitments": ["Do daily maths practice 7-8pm", "Bring doubt notebook next session"],
        "action_items": ["Mentee: complete Exercise 8.1 and 8.2 before next session", "Mentor: share a trigonometry formula sheet"],
        "important_points": ["Unit tests done", "Science is on track", "Phone is a distraction risk"],
        "mentor_suggestions": ["Check the doubt notebook every session", "Consider a weekly 10-minute maths quiz"],
        "dummy": True,
    }


def _reset(db) -> None:
    s = db.sessions.delete_many({"dummy": True})
    st = db.students.delete_many({"dummy": True})
    u = db.users.delete_many({"dummy": True})
    m = db.mentors.delete_many({"dummy": True})
    a = db.assignments.delete_many({"dummy": True})
    print(
        f"Removed dummy data: {m.deleted_count} mentors, {u.deleted_count} logins, "
        f"{st.deleted_count} mentees, {s.deleted_count} sessions, {a.deleted_count} assignments."
    )


def main() -> None:
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)

    if "--reset" in sys.argv:
        _reset(db)
        return

    if db.sessions.count_documents({"dummy": True}) or db.mentors.count_documents({"dummy": True}):
        print("Dummy data already present. Run with --reset first to reseed.")
        return

    # -- Govandi mentors + logins --
    mentor_ids: dict[str, object] = {}
    for name, gender, contact, area, education in GOVANDI_MENTORS:
        res = db.mentors.update_one(
            {"name": name},
            {
                "$set": {"gender": gender, "contact": contact, "area": area, "education": education, "dummy": True, "updated_at": now},
                "$setOnInsert": {"name": name, "created_at": now},
            },
            upsert=True,
        )
        mid = res.upserted_id or db.mentors.find_one({"name": name})["_id"]
        mentor_ids[name] = mid
        if not db.users.find_one({"mentor_id": mid, "role": "mentor"}):
            username = name.lower().replace(" ", ".")
            pw = generate_temp_password()
            db.users.insert_one(
                {
                    "username": username,
                    "password_hash": hash_password(pw),
                    "role": "mentor",
                    "mentor_id": mid,
                    "disabled": False,
                    "dummy": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            print(f"  login  {username:22} {pw}")

    # -- Govandi mentees --
    for mentor_name, mentees in GOVANDI_MENTEES:
        for idx, (mname, mcontact, std, gender) in enumerate(mentees):
            # Leave the last mentee of each mentor unassigned so the Assignments
            # queue has something to show.
            assigned = mentor_ids[mentor_name] if idx < len(mentees) - 1 else None
            res = db.students.update_one(
                {"name": mname},
                {
                    "$set": {
                        "contact": mcontact,
                        "std": std,
                        "gender": gender,
                        "area": "Govandi",
                        "status": "active",
                        "primary_mentor_id": assigned,
                        "dummy": True,
                        "updated_at": now,
                    },
                    "$setOnInsert": {"name": mname, "created_at": now},
                },
                upsert=True,
            )
            if assigned is not None:
                sid = res.upserted_id or db.students.find_one({"name": mname})["_id"]
                db.assignments.update_one(
                    {"student_id": sid, "to_mentor_id": assigned, "dummy": True},
                    {"$setOnInsert": {
                        "student_id": sid,
                        "from_mentor_id": None,
                        "to_mentor_id": assigned,
                        "reason": "Seeded assignment",
                        "by_username": "seed",
                        "dummy": True,
                        "created_at": now,
                    }},
                    upsert=True,
                )

    # -- Sessions across a spread of mentors/mentees --
    pairs = list(db.students.find({"primary_mentor_id": {"$ne": None}}))
    random.seed(42)
    chosen = random.sample(pairs, min(10, len(pairs)))
    statuses = [SessionStatus.AUDIO_DELETED] * 8 + [SessionStatus.FAILED, SessionStatus.PROCESSING]
    made = 0
    for i, student in enumerate(chosen):
        created = now - datetime.timedelta(days=random.randint(1, 28), hours=random.randint(0, 20))
        status = statuses[i]
        doc = {
            "student_id": student["_id"],
            "mentor_id": student["primary_mentor_id"],
            "audio_filename": f"session_{i + 1}.m4a",
            "audio_duration": round(random.uniform(600, 1500), 1),
            "content_type": "audio/mp4",
            "transcription_backend": "deepgram",
            "storage_key": None,
            "status": status,
            "transcript": TRANSCRIPT if status in (SessionStatus.AUDIO_DELETED, SessionStatus.FAILED) else None,
            "insights": _insights(student["name"]) if status == SessionStatus.AUDIO_DELETED else None,
            "error": "Transcription timed out. Please retry." if status == SessionStatus.FAILED else None,
            "dummy": True,
            "created_at": created,
            "updated_at": created,
        }
        db.sessions.insert_one(doc)
        made += 1

    print(f"\nAdded {len(GOVANDI_MENTORS)} Govandi mentors, {sum(len(x[1]) for x in GOVANDI_MENTEES)} mentees, {made} sessions.")
    print(f"Totals -> mentors: {db.mentors.count_documents({})}, mentees: {db.students.count_documents({})}, "
          f"sessions: {db.sessions.count_documents({})}, users: {db.users.count_documents({})}")


if __name__ == "__main__":
    main()
