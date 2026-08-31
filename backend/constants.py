ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".webm", ".flac"}

# -- Mentee lifecycle --------------------------------------------------------
# active   -- currently being mentored
# paused   -- temporarily on hold (exams, travel, family) but still enrolled
# graduated-- completed the programme
# dropped  -- left the programme
MENTEE_STATUSES = ("active", "paused", "graduated", "dropped")
MENTEE_STATUS_DEFAULT = "active"

# Statuses that count as "on the roster" for capacity / attention purposes.
MENTEE_ACTIVE_STATUSES = ("active", "paused")

GENDERS = ("M", "F", "O")

# -- Pagination -------------------------------------------------------------
SESSIONS_PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100
