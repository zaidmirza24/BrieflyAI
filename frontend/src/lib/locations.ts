// Areas the foundation currently operates in. Mentors carry an `area` field
// (see backend/scripts/seed_mentors_mentees.py); this is the canonical list the
// UI filters by. When the mentor panel lands, a signed-in mentor's own area
// will preselect this step instead of the user choosing it.
export const LOCATIONS = ["Mumbra", "Govandi"] as const

export type Location = (typeof LOCATIONS)[number]
