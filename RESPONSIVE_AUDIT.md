# Responsive / Mobile UX Audit

_Audit date: 2026-09-01 · Scope: `frontend/` — all screens, shared components, breakpoints_

## 1. State before this pass

The SPA was **already substantially responsive**: a mobile header + slide-out
drawer with focus trap, filter bars that stack (`flex-col sm:flex-row`), stat
grids that collapse (`grid-cols-1 sm:grid-cols-2/3`), the mentor directory as a
`1 → 2 → 3` card grid, wizard step-labels hidden on mobile, and every data table
wrapped in `overflow-x-auto`.

**The gap:** data tables were *scroll-only* on phones — a 5–7 column table on a
375px screen means pinch-zoom and sideways drag to read one row. Dialogs were
centred desktop modals shrunk to fit. Small tap targets (32px buttons, 16px
checkboxes). Dialog form fields stayed 2-up at every width.

Breakpoint strategy: Tailwind defaults, effectively a single `sm` (640px)
switch between "mobile" and "desktop" layouts, `lg` (1024px) for the sidebar and
the mentor grid's third column. Kept as-is — one honest breakpoint per component
beats a spray of custom ones for an app this size.

## 2. Shared foundations changed

| Component | Change |
|---|---|
| `components/ui/dialog.tsx` | **Bottom sheet on phones**: anchors to the bottom edge, full-width, `rounded-t-2xl`, `max-h-92vh` with a flex column so the header and footer stay pinned while the body scrolls. Centred modal with rounded corners from `sm` up. Footer wraps and pads for `env(safe-area-inset-bottom)`. Close button 32→36px. |
| `components/ui/button.tsx` | `size="sm"` height 32→36px — lifts every dialog footer action, table-row action, and pagination arrow closer to a comfortable touch target without breaking dense desktop rows. |
| `index.css` | `overflow-x: clip` on `html,body` as a safety net against accidental page-level horizontal scroll (`clip`, not `hidden`, so `position: sticky` keeps working and no scroll container is created). `max-width: 100%` on `img/svg/video`. Root causes are still fixed at the component. |
| Dialog/wizard forms | `grid grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2` in `AddMenteeWizard`, `AddMentorWizard`, `EditMenteeDialog`, `EditMentorDialog`, `AssignMenteeDialog` — paired fields (Contact / Area, Gender / Grade) now stack on phones instead of squeezing to ~120px. |

## 3. Tables → intentional mobile layout

Strategy chosen: **card list on mobile, full table from `sm` up** — not
horizontal scroll. Rows in this app are read one at a time (open a mentee, assign
a mentor), not compared column-to-column, so a stacked card carrying the same
fields is strictly better than a scroll box. The `<table>` is kept verbatim
behind `hidden sm:block` for desktop density.

| Screen | Mobile card carries |
|---|---|
| `Students` (mentee list) | name + grade, status badge, mentor / area / session count / last-session, and the Assign/Reassign action as a full button |
| `Analyses` | mentee name + status, mentor · date, filename (truncated); whole card links to the analysis |
| `Assignments` — unassigned queue | 20px checkbox + full-row tap label, name, status + grade + area; "select all" promoted to its own labelled row |
| `Assignments` — by-mentor roster | name + grade, status, last session, Reassign / Unassign buttons |
| `MentorDetail` — mentee roster | name + grade, status, school + last session, Reassign / Unassign |

Desktop tables are untouched.

## 4. Other mobile fixes

- Assignments row + header checkboxes 16→20px (both table and card).
- `MentorDetail` login row (`Badge` + Reset/Create button) now `flex-wrap` so it
  doesn't overflow the card on narrow screens.
- Assignments bulk-assign bar was already `sticky` (in-flow) and stacks its
  controls `flex-col sm:flex-row`; left as-is.
- All 9 page containers: `py-10` → `py-6 sm:py-10` — reclaims ~32px of vertical
  space above the fold on phones without changing the desktop rhythm.

## 5. Verified

- `npm run build` (tsc + vite) green; `oxlint` clean (pre-existing warnings only).
- No component forces page width at 320px (tables scroll inside their own
  `hidden sm:block` wrapper; cards are the mobile path).

## 6. Remaining recommendations

- Consider a bottom-nav for the 3 primary destinations on phones instead of the
  hamburger drawer (mentor role especially — Dashboard / My Mentees / Analyses).
- Source `LOCATIONS` from the backend (already tracked) — the fixed 2-item list
  also constrains the mobile filter selects.
