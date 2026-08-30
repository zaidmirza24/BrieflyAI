"""One-time (idempotent) seed of mentors and mentees (students) from the
Anfaal Foundation "Mentor & Mentee list Mumbra" planning sheet (15-Aug-26).

Run with:
    python -m backend.scripts.seed_mentors_mentees

Safe to re-run: upserts by name, so it will not create duplicates and will
refresh profile fields if the sheet changes. It never touches `sessions`.

Each mentee's `primary_mentor_id` records the pairing exactly as laid out on
the sheet (mentors are followed by their assigned block of mentees). This is
now the authoritative assignment: the mentor panel scopes a mentor to exactly
the mentees whose `primary_mentor_id` points at their record, and admins can
reassign via PATCH /api/students/{id}/assignment (audited).

This script does NOT create login accounts -- an admin provisions those from
the Mentors screen (POST /api/mentors/{id}/account).
"""

import datetime

from backend.db import get_db

# (name, gender, contact, area, education)
MENTORS = [
    ("S. Ariza Fatima Imran Ali", "F", "8104279274", "Mumbra", "TY.Bcom"),
    ("Saudagar Shifa Zehra", "F", "9699286225", "Mumbra", "Mech.engg."),
    ("Shaikh Alisha Bano", "F", "8767326868", "Mumbra", "TY.BSC"),
    ("Kaneez Mehdi", "F", "9838734640", "Mumbra", "BBM"),
    ("Asmi Mazhar Abbas Sayed", "F", "9619131443", "Mumbra", "ECCED"),
    ("Umme Abiha", "F", "8879695009", "Mumbra", "NEET / 189"),
    ("Bushra Javed Ali Mirza", "F", "9137583520", "Mumbra", "15std"),
    ("Liza Fatima", "F", "9967357262", "Mumbra", "TY Electrical Eng"),
    ("Safir Sayyed", "F", "7039035567", "Mumbra", "SY BSC IT"),
    ("Haider Abbas", "M", "9335147108", "Mumbra", "TY BSC"),
    ("Shahwar Hasan", "M", "7208711964", "Mumbra", "SY BMS"),
    ("Khan Mohd Taqi", "M", "8976411866", "Mumbra", "T.Y. Eng"),
    ("Kaif Mirza", "M", "7304029821", "Mumbra", "B.tech"),
    ("Hasan Abbas", "M", "7021724360", "Mumbra", "FY Bcom"),
    ("Gulrez Mehdi", "M", "8693872110", "Mumbra", "SY BA"),
    ("Sayed Rehbar Raza", "M", "6209723253", "Mumbra", "TY Comp. Eng"),
    ("S. Mohammed Hussain", "M", "7506863025", "Mumbra", "B.tech mech."),
]

# (mentor_name, [(mentee_name, contact, std, gender), ...])
MENTEE_GROUPS = [
    ("S. Ariza Fatima Imran Ali", [
        ("Sayyed zehra", "9594046035", "7th", "F"),
        ("Khan Tanis Fatima Enam H", "9324208784", "7th", "F"),
    ]),
    ("Saudagar Shifa Zehra", [
        ("Riza", "8898945325", "9th", "F"),
        ("Sayyed Alfiya Bano", "9987787139", "9th", "F"),
    ]),
    ("Shaikh Alisha Bano", [
        ("Khan Binte Farwa", "8779924139", "9th", "F"),
        ("Kayenat Rizwan Ali Naqvi", "9167087401", "9th", "F"),
    ]),
    ("Kaneez Mehdi", [
        ("S.Sukaina Fatema Ambar", "9076265404", "8th", "F"),
        ("Fizza fatima", "8879209213", "8th", "F"),
    ]),
    ("Asmi Mazhar Abbas Sayed", [
        ("Zara A Shaikh", "7718919982", "10th", "F"),
        ("Mehvish Fatima S Khan", "7718919982", "10th", "F"),
    ]),
    ("Umme Abiha", [
        ("Batul Zehra Mehdi Abbas S.", "7039090554", "9th", "F"),
        ("Aliza Zehra", "9555507591", "9th", "F"),
    ]),
    ("Bushra Javed Ali Mirza", [
        ("Sanober Fatema", "9555507591", "10th", "F"),
        ("Maryam Fatima Sayyed", "9769801268", "10th", "F"),
    ]),
    ("Liza Fatima", [
        ("Sayed Wahiba Muzammil", "8779701951", "9th", "F"),
    ]),
    ("Safir Sayyed", [
        ("Innama Fatema", "9653688824", "10th", "F"),
        ("Kaniz Fatema A Sayyed", "9220375267", "10th", "F"),
    ]),
    ("Haider Abbas", [
        ("Sayed Mohd Amir Abbas", "9833256590", "7th", "M"),
        ("Mohd.Qasim Mazhar Abbas", "9619131443", "7th", "M"),
        ("Leshan", "9076498318", "7th", "M"),
    ]),
    ("Shahwar Hasan", [
        ("S. Mohd Hadi Mohd Burer", "8169262090", "7th", "M"),
        ("Sayed Farman Abbas", "8369044285", "8th", "M"),
        ("S. Mohammad Nadeem", "9324740967", "8th", "M"),
    ]),
    ("Khan Mohd Taqi", [
        ("Sayed Ishaan Abbas", "8369044285", "8th", "M"),
        ("Sayyed Muktar Ali", "8879209213", "8th", "M"),
        ("Gazi Abbas", "7506020199", "8th", "M"),
    ]),
    ("Kaif Mirza", [
        ("Ali Abrar Jafferi", "7715968845", "10th", "M"),
        ("Mohammed Rahib Shaikh", "9222229320", "10th", "M"),
        ("Abid Ali Mirza", "9930185821", "10th", "M"),
    ]),
    ("Hasan Abbas", [
        ("Sayyed Mohammad Ali", "8850127924", "9th", "M"),
        ("Farhan Abbas Khan", "9082119601", "9th", "M"),
        ("Mubashshir Abbas", "7506335257", "9th", "M"),
    ]),
    ("Gulrez Mehdi", [
        ("Sayed Muntazir Ali", "7039479700", "9th", "M"),
        ("Mohd Shujaat Zaya Syed", "7506493917", "9th", "M"),
    ]),
    ("Sayed Rehbar Raza", [
        ("Sayyed Rahil Abbas", "9702105040", "9th", "M"),
        ("M Mujtaba A Sayyed", "9076265404", "10th", "M"),
        ("Ayaz Abbas Sayyed", "8879836903", "10th", "M"),
    ]),
    ("S. Mohammed Hussain", [
        ("Sayyed Mohammad Kazim", "9833779218", "9th", "M"),
        ("Mohd.Hassan R Mugal", "9594828173", "10th", "M"),
        ("Mohd.Hasnain K Sayyed", "9005676576", "10th", "M"),
    ]),
]


def seed() -> None:
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)

    mentor_ids: dict[str, object] = {}
    for name, gender, contact, area, education in MENTORS:
        result = db.mentors.update_one(
            {"name": name},
            {
                "$set": {"gender": gender, "contact": contact, "area": area, "education": education, "updated_at": now},
                "$setOnInsert": {"name": name, "created_at": now},
            },
            upsert=True,
        )
        doc = db.mentors.find_one({"name": name}) if result.upserted_id is None else {"_id": result.upserted_id}
        mentor_ids[name] = doc["_id"]

    mentee_count = 0
    for mentor_name, mentees in MENTEE_GROUPS:
        mentor_id = mentor_ids[mentor_name]
        for mentee_name, contact, std, gender in mentees:
            db.students.update_one(
                {"name": mentee_name},
                {
                    "$set": {
                        "contact": contact,
                        "std": std,
                        "gender": gender,
                        "primary_mentor_id": mentor_id,
                        "updated_at": now,
                    },
                    "$setOnInsert": {"name": mentee_name, "created_at": now},
                },
                upsert=True,
            )
            mentee_count += 1

    print(f"Seeded {len(MENTORS)} mentors and {mentee_count} mentees.")


if __name__ == "__main__":
    seed()
