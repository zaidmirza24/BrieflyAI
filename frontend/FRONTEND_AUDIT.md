# Frontend Audit Report

_Audit date: 2026-08-31 · Scope: `frontend/` (Vite + React 19 + React Router 7 + Tailwind v4)_

---

## Implementation status (2026-08-31)

Phases 1–4 and most of Phase 5 have been applied. `npm run build` and `oxlint` pass.

**Done**
- **Error boundary** (`components/ErrorBoundary.tsx`) wraps all routes; guarded the two
  reachable throwers (`ResultsPanel` study-hours unit, `StudentProfile` status label,
  plus `Array.isArray` guard on insight lists).
- **Dialog + mobile-drawer accessibility**: new `lib/useFocusTrap.ts` — initial focus,
  focus trap, focus restore, Escape to close — wired into `components/ui/dialog.tsx`
  (now also `aria-labelledby` / `aria-describedby`) and the mobile nav drawer.
- **Landmarks**: `<main id="main">`, `<nav aria-label="Primary">`, a "Skip to content"
  link; per-route `document.title` via `lib/usePageTitle.ts`.
- **Assignments mobile**: unassigned-queue table now scrolls in its own container; the
  bulk-assign bar is `sticky` (in-flow) instead of `fixed`, so it no longer covers rows;
  checkboxes enlarged with an accent focus style.
- **Analyse flow**: `streamAnalysis` takes an `AbortSignal`; `NewAnalysis` aborts it on
  unmount and ignores abort errors. `AnalysisView` now polls while a session is
  processing and shows the stepper, so a refresh re-attaches to an in-flight analysis.
- **Error recovery**: shared `components/ui/error-state.tsx` with a "Try again" button,
  wired into Dashboard, Students, Analyses, StudentProfile, Mentors, MentorDetail,
  AnalysisView.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` block in `index.css`.
- **Upload**: dropzone is now a real `<button>` (keyboard-operable) with a 500 MB guard
  and inline error.
- **Perf**: full mentor list memoised (`listAllMentorsCached` + `invalidateMentorsCache`
  on every mentor/assignment mutation) and used by the assign dialog + add-mentee wizard;
  transcript parsing memoised; tab panels stay mounted (no re-parse on switch); list
  pages keep stale rows visible during debounced refilter instead of flashing a skeleton.
- **A11y polish**: `aria-live` on the stepper and toast region, `role="alert"` paths,
  `aria-label` on the credential copy button, `autocomplete` on the login form,
  heading levels fixed via a `CardTitle as="h2"` prop, section headers given real weight.
- **404 page** (`pages/NotFound.tsx`); centralised `formatDate` in `lib/utils.ts`
  (removed 6 copies); deleted unused `assets/hero.png`.

**Deliberately not done** (need product calls or are lower value than the risk of
touching them): the full `useAsync` hook rollout, `<FilterBar>` / single `<StatCard>`
extraction, sourcing `LOCATIONS` from the backend, container-width unification, and the
Vercel-Hobby 60 s analyze cap (infra, tracked separately). See the phase tables below.

---

---

## 1. Executive Summary

**Overall quality.** This is a well-built, coherent frontend. It has a real design-token
system (`index.css`), a small consistent component library (`components/ui/*`), light and
dark themes, skeleton loaders, empty states, toasts, and thoughtful touches (client-side
audio duration, RTL-aware transcript rendering, presigned direct-to-storage upload with
retry). The code is readable, typed, and free of heavy dependencies. For an internal tool
it is already above average.

**Production readiness: ~70%.** The app will work for the happy path, but a few
structural gaps will cause visible failures in real use:

- **No error boundary anywhere.** A single render-time exception (and there are a few
  reachable ones) turns the whole app into a blank white screen with no recovery.
- **Modals and the mobile menu are not accessible to keyboard users.** No focus trap,
  no focus return, focus stays on the page behind the overlay.
- **`Assignments` unassigned-queue table overflows horizontally on phones** (missing the
  `overflow-x-auto` wrapper every other table has), and the fixed bottom action bar
  covers content on small screens.
- **The core "Analyze" flow has no resilience**: navigate away or refresh during the
  15–20 minute analysis and the progress UI is gone with no way back, and on Vercel
  Hobby the request itself can hit the 60 s function cap (already tracked in project
  notes).

**Biggest risks (in order of user impact):**

1. White-screen crashes from unguarded render code + no error boundary.
2. Keyboard / screen-reader users cannot use any dialog or the mobile nav.
3. Long-running analysis is fragile and unrecoverable from the UI.
4. Mobile layout breakage on the Assignments page.
5. Repeated, uncached `listMentors()` / list calls on nearly every screen and dialog.

**Most important improvements:** add an error boundary + a couple of null-guards; make
`Dialog` and the mobile drawer trap and restore focus; fix the Assignments table/​bar on
mobile; make the analysis stepper resumable (or at least survive a refresh); centralise
the duplicated `formatDate` and the mentor-list fetching.

---

## 2. Critical Issues 🔴

### 2.1 No error boundary — any render exception blanks the entire app

- **Affected:** `src/App.tsx` (no boundary around `<Routes>`), and every page. Reachable
  throwers include:
  - `src/pages/StudentProfile.tsx:248` — `s[0].toUpperCase()` on the status string;
    throws if the value is ever `""`.
  - `src/components/ResultsPanel.tsx:125` — `studyHours.unit.replace(/_/g, " ")`; `unit`
    is typed `string` but comes from the model output cast with `as never`
    (`AnalysisResult.tsx:86`). If the backend sends `null`/omits it, this throws.
  - `src/components/ui/tabs.tsx:43,63` — `throw new Error(...)` if a `Tabs*` is rendered
    out of context (developer error, but still un-caught at runtime).
- **Why it's a problem:** React unmounts the whole tree on an uncaught render error. The
  user sees a white page, no message, and the only fix is a manual reload.
- **Impact:** One malformed analysis record or one unexpected `null` takes down the app
  for that user until they realise they need to refresh.
- **Recommended solution:** Add a single `<ErrorBoundary>` (small class component, ~30
  lines, no dependency) wrapping `<Routes>` in `App.tsx`, rendering a "Something went
  wrong — reload" card. Additionally guard the two specific spots above
  (`String(s).charAt(0)`, `studyHours.unit?.replace(...)`).

### 2.2 Dialogs and the mobile nav are not keyboard/screen-reader accessible

- **Affected:** `src/components/ui/dialog.tsx` (used by every add/edit/assign flow),
  `src/App.tsx:183-210` (mobile nav drawer).
- **Why it's a problem:**
  - No focus is moved into the dialog when it opens; keyboard focus stays on the trigger
    button behind the overlay.
  - No focus trap — Tab cycles through the page _behind_ the modal.
  - Focus is not restored to the trigger on close.
  - The mobile drawer has no `Escape` handler (the `Dialog` does), no `role`, and the
    same trap/restore gaps.
  - Background content is not inert / `aria-hidden`, so screen readers read straight past
    the dialog into the page.
- **Impact:** Keyboard-only and screen-reader users cannot reliably complete _any_
  create/edit/assign task, and can get "lost" behind an open modal. WCAG 2.1.2 (No
  Keyboard Trap — inverse), 2.4.3 (Focus Order).
- **Recommended solution:** In `Dialog`, on mount: store `document.activeElement`, move
  focus to the dialog container (or first focusable), add a `keydown` Tab handler that
  wraps focus within the dialog, and restore focus on unmount. Give the mobile drawer the
  same treatment (or render it _through_ the `Dialog` primitive). ~40 lines in one file,
  fixes every consumer at once.

### 2.3 Assignments page breaks on mobile

- **Affected:** `src/pages/Assignments.tsx`.
  - `UnassignedQueue` renders `<table>` (line 221) **without** the `overflow-x-auto`
    wrapper that `Students`, `Analyses`, `MentorDetail`, and `ByMentor` all use → the
    5-column table forces horizontal page scroll on phones.
  - The bulk-assign action bar is `fixed inset-x-0 bottom-0` (line 267). On mobile its
    contents stack vertically (label + mentor select + reason input + button), making it
    tall; the page's `pb-28` (7rem) is not enough clearance, so the bar covers the last
    rows of the table.
- **Why it's a problem:** Admins triaging assignments on a phone can't see or reach part
  of the content.
- **Impact:** Primary admin workflow partially unusable on small screens.
- **Recommended solution:** Wrap the queue table in `<div className="overflow-x-auto">`.
  For the bar, either make it non-fixed on mobile (`sm:fixed`, inline above content on
  mobile) or measure/raise the page bottom padding to match the stacked height.

### 2.4 The Analyze flow is not resilient or recoverable

- **Affected:** `src/pages/NewAnalysis.tsx`, `src/lib/api.ts:streamAnalysis`.
- **Why it's a problem:**
  - `streamAnalysis` uses a `fetch` reader with **no `AbortController`**. Navigating away
    mid-analysis leaves a dangling read; there is no effect cleanup.
  - All progress state (`phase`, `stage`, `sessionId`) is local component state. A
    refresh, an accidental back-navigation, or a dropped connection loses the stepper
    entirely — the user has no way to re-attach to a session that is still processing
    server-side.
  - On Vercel Hobby the `POST /analyze` request is capped at 60 s (already noted in
    project memory); a 15–20 min recording will surface as a generic failure.
- **Impact:** For the app's single most important action — which is also its slowest —
  any interruption looks like total failure, even though the backend job is fine and
  retryable.
- **Recommended solution (incremental):**
  1. Add an `AbortController` and abort it in the effect cleanup.
  2. On `/analyses/:id`, if `status` is a processing state, show the stepper and
     re-open the stream (or poll `GET /sessions/:id`) so a refresh re-attaches.
  3. Longer term: move analysis to a background job + polling, per the deployment note.
- **Requires runtime testing** to confirm the 60 s cap behaviour on the deployed Hobby
  environment.

---

## 3. High Priority Issues 🟠

### 3.1 Heading hierarchy jumps h1 → h3

- **Affected:** `src/components/ui/card.tsx:21` (`CardTitle` is always `<h3>`), used
  directly under page `<h1>` on `NewAnalysis`, `AnalysisView`, `ResultsPanel`, etc. Page
  section headers on `StudentProfile.tsx:113,138` are `<h2>` but styled as small muted
  text, so they don't read as headings visually either.
- **Why it's a problem:** Screen-reader users navigating by heading skip a level and lose
  the document outline; sighted users don't perceive the section structure.
- **Impact:** Degraded navigation for AT users; weak visual hierarchy on detail pages.
- **Recommended solution:** Make `CardTitle` accept an `as` prop (default `h3` is fine
  when nested, but allow `h2`), or drop the heading semantics from `CardTitle` and let
  callers place real headings. Give `StudentProfile`'s section titles visible weight.

### 3.2 No landmarks, no skip link, document title never changes

- **Affected:** `src/App.tsx` (content is a bare `<div>`, not `<main>`), `index.html`
  (single static `<title>`).
- **Why it's a problem:** No `<main>` / `<nav>` landmarks for AT; no "skip to content"
  link, so keyboard users tab through the whole sidebar on every page; the tab title is
  identical on every route.
- **Impact:** Slower keyboard navigation, weaker orientation.
- **Recommended solution:** Wrap page content in `<main id="main">`, mark the sidebar
  `<nav aria-label="Primary">` (already `<nav>` inside — add the aria-label and the
  landmark on the `<aside>`), add a visually-hidden skip link, and set
  `document.title` per route (tiny effect in each page or a shared hook).

### 3.3 `listMentors()` is refetched on almost every screen and every dialog

- **Affected:** `Students.tsx`, `Analyses.tsx`, `Assignments.tsx` (twice),
  `NewAnalysis.tsx`, `MentorDetail.tsx` indirectly, and **`AssignMenteeDialog.tsx:30`
  fetches the full unscoped mentor list every time the dialog opens**.
- **Why it's a problem:** No caching or dedupe layer. Opening the assign dialog on a row,
  closing, opening another → N identical network round trips. The mentor list is small
  and changes rarely.
- **Impact:** Unnecessary latency and load, visible "empty then populated" flicker in the
  assign dialog's `<select>`.
- **Recommended solution:** Either introduce a tiny cache (a module-level
  `Map`/promise memo in `api.ts`, ~15 lines) or adopt a small data layer. At minimum,
  lift the mentor list into the parent pages that already have it and pass it into
  `AssignMenteeDialog` as a prop.

### 3.4 Fetch failures show a dead-end red line, no retry

- **Affected:** `Dashboard.tsx:54`, `AnalysisView.tsx:20`, `StudentProfile.tsx:35`,
  `Mentors.tsx:29`, `Assignments.tsx` queue.
- **Why it's a problem:** On a failed load the user gets `Could not load …` as plain text
  with no button. Their only recourse is a full reload.
- **Impact:** Transient network blips look like hard failures.
- **Recommended solution:** Add a small shared `<ErrorState onRetry={...}>` (mirror of
  `EmptyState`) with a "Try again" button that re-runs the loader.

### 3.5 Audio dropzone is mouse-only; no size guard

- **Affected:** `src/components/AudioUpload.tsx:97-135`.
- **Why it's a problem:** The dropzone is a `<div>` with `onClick`; it is not focusable
  and has no keyboard handler, so keyboard users cannot open the file picker. There is
  also no client-side file-size or duration ceiling or messaging — a multi-GB file just
  silently attempts to upload for a long time.
- **Impact:** Upload is inaccessible by keyboard; users can start doomed uploads.
- **Recommended solution:** Make the dropzone a `<button type="button">` (or add
  `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space). Add a soft size
  check with a clear message before calling `presignUpload`.

### 3.6 Skeletons don't match the content they replace

- **Affected:** `Students.tsx:141-148`, `Analyses.tsx:166-173`,
  `Assignments.tsx:201-210` — all render a 2-cell "row" skeleton, but the real content is
  a 5–7 column table. `Dashboard` and `MentorDetail` skeletons are well matched.
- **Why it's a problem:** Layout visibly jumps when data arrives (CLS), undermining the
  perceived-quality benefit skeletons are meant to give.
- **Recommended solution:** Give the table pages a skeleton with the same column
  structure, or a simpler shimmering block the exact height of the loaded table.

### 3.7 `prefers-reduced-motion` is ignored

- **Affected:** `index.css` (`scroll-behavior: smooth`), `button.tsx`
  (`active:scale-[0.98]`, `transition-all`), `skeleton.tsx` / `AnalysisStepper.tsx`
  (`animate-pulse`), `Progress` width transitions.
- **Why it's a problem:** Users with vestibular sensitivity get motion they asked the OS
  to suppress. WCAG 2.3.3.
- **Recommended solution:** One `@media (prefers-reduced-motion: reduce)` block in
  `index.css` that neutralises transitions/animations and sets `scroll-behavior: auto`.

---

## 4. Medium Priority Issues 🟡

### 4.1 Long transcripts render every line into the DOM with index keys

- **Affected:** `src/components/AnalysisResult.tsx:33-48`. A 15–20 minute call can be
  thousands of lines; all are mounted inside a `max-h-[32rem]` scroll box, each parsed
  with a regex, keyed by array index. Switching tabs unmounts and re-parses the whole
  thing.
- **Impact:** Noticeable jank opening the Transcript tab on long sessions;
  **requires runtime testing** to quantify.
- **Recommendation:** Memoise the parsed lines (`useMemo` on `transcript`), keep the tab
  content mounted (hide with CSS instead of `return null` in `TabsContent`), and if
  profiling shows a problem, windowise the list.

### 4.2 `insights` is trusted without validation

- **Affected:** `AnalysisResult.tsx:86` (`insights as never`), `ResultsPanel.tsx`.
  Arrays are guarded (`items && items.length`), but scalar fields
  (`summary`, `student_participation`, `study_hours.unit`) are used directly.
- **Impact:** Backend/model shape drift → render crash (see 2.1) or `undefined` text.
- **Recommendation:** A small normaliser that coerces each expected field to a safe
  default before passing to `ResultsPanel`.

### 4.3 Location filter is a fixed 2-item list, but mentee `area` is free-form

- **Affected:** `src/lib/locations.ts` (`["Mumbra", "Govandi"]`),
  used as the canonical filter in `Students`, `Analyses`, `Assignments`, `Mentors`,
  `EditMenteeDialog`.
- **Why it's a problem:** A mentee whose `area` is anything else is invisible to the
  location filter, and `EditMenteeDialog` already has to special-case "unknown area"
  (line 102). This will silently hide records as the programme grows.
- **Recommendation:** Source the location list from the backend (distinct areas) or at
  least surface an "Other / unknown area" bucket in the filters.

### 4.4 Small tap targets

- **Affected:** Dialog footer buttons are all `size="sm"` (`h-8`, 32 px) including
  primary "Save" actions; the `Assignments` select-all / row checkboxes are default
  browser size (~13–16 px); `PasswordInput` toggle is 24 px.
- **Why it's a problem:** Below the ~44 px comfortable touch target; the checkboxes in
  particular are hard to hit on the mobile assignment flow.
- **Recommendation:** Use `size="default"` for primary dialog actions (or bump `sm` to
  `h-9`), and style the checkboxes to ~18–20 px with a real focus ring and larger hit
  area.

### 4.5 Hardcoded, context-blind "Back" links

- **Affected:** `AnalysisView.tsx:26` always "Back to Students" (you usually arrive from
  Analyses or the Dashboard), `StudentProfile.tsx:43` "Back to Mentees",
  `MentorDetail.tsx:50`.
- **Impact:** Mild disorientation; the back link often points somewhere the user wasn't.
- **Recommendation:** Use `navigate(-1)` with a generic "Back" label, or pass the origin
  via router state.

### 4.6 `formatDate` duplicated in 6 files

- **Affected:** `Dashboard`, `Students`, `Analyses`, `StudentProfile`, `MentorDetail`,
  `AnalysisResult`, `Assignments` — each defines its own near-identical helper (some
  handle `null`, some don't).
- **Recommendation:** Move one `formatDate(iso: string | null)` into `src/lib/utils.ts`
  next to `formatBytes` / `formatDuration`.

### 4.7 No 404 page

- **Affected:** `App.tsx:240` — `*` silently `<Navigate to="/">`.
- **Impact:** A stale or mistyped deep link dumps the user on the dashboard with no
  explanation.
- **Recommendation:** A minimal "Page not found" route with a link home.

### 4.8 Login form missing autocomplete hints

- **Affected:** `src/pages/Login.tsx` — `Input` for username has no
  `autoComplete="username"`, `PasswordInput` no `autoComplete="current-password"`.
- **Impact:** Password managers and browser autofill work poorly.
- **Recommendation:** Add the attributes (the `PasswordInput` already forwards props).

### 4.9 `Select` `loading` state hides the control with `opacity-0`

- **Affected:** `src/components/ui/select.tsx:18` overlays a `Skeleton` on top of an
  `opacity-0` but still-focusable `<select>`.
- **Impact:** Keyboard focus can land on an invisible control; minor SR confusion.
- **Recommendation:** Also set `pointer-events-none` + `aria-hidden` (it already disables)
  or conditionally render the skeleton _instead of_ the select.

---

## 5. Minor Improvements 🟢

- **Container widths vary per page** (`max-w-2xl` / `3xl` / `4xl` / `5xl`) with no clear
  rule — `Students` table at `5xl` vs `MentorDetail` table at `4xl` feels arbitrary.
  Pick two (a "list" width and a "detail" width) and apply consistently.
- **Two different stat-card designs**: `Dashboard.StatCard` (large, `pt-6`, 11×11 icon)
  vs `Assignments.StatCard` (compact `p-4`, 9×9 icon) for visually similar dashboards.
  Extract one shared `StatCard`.
- **`CardHeader` is `p-6 pb-3`** but almost every caller overrides with `pb-2` — make
  `pb-2` the default and delete the overrides.
- **`AudioUpload` copy mismatch**: helper text lists "MP3, WAV, M4A, AAC, OGG, FLAC" but
  `accept` also allows `opus`, `webm`. Align the two.
- **Dashboard attention banner** uses `bg-[var(--warning-bg)]/30` (washed out) while the
  analysis-failed and toast styles use solid token backgrounds — unify alert styling.
- **`Brand`** forces a line break with `<br/>` ("Mentor-Mentee / Insights"); brittle if
  the string changes. Use a block element + `leading-tight`.
- **`::selection` in dark mode** (`accent-bg` on `accent-strong`) is low-contrast — pick
  a more legible pair.
- **`react-hooks/exhaustive-deps` eslint-disable comments** (`Students.tsx:65`,
  `Mentors.tsx:36`) but the configured linter is `oxlint` — the directives are inert;
  either wire the rule or drop the comments and fix the deps properly.
- **`h-4.5` / `w-4.5` / `h-3.5`** arbitrary sizes scattered around; fine functionally,
  but a `size="sm|md"` convention on icons would read cleaner.
- **`favicon.svg`** referenced in `index.html` — confirm it exists in `public/`
  (`src/assets` holds only `hero.png`, `react.svg`, `vite.svg`; `hero.png` appears
  unused — dead asset).
- **`playwright` is in devDependencies but there are no e2e specs** — either add a smoke
  test for login + new-analysis or remove the dependency.

---

## 6. UI/UX Recommendations

**Visual hierarchy**
- Give detail-page section headers (`StudentProfile`, `MentorDetail`) real visual weight
  (`text-sm font-semibold text-foreground` + a touch more top margin), so "Assignment
  history" / "Session history" read as sections, not captions.
- On `AnalysisResult`, the summary card, the profile card, and the 2-up grid all compete
  at similar visual weight. Make the AI **Summary** the clear hero (larger text, more
  padding) and demote the metadata row.

**Consistency**
- One `StatCard`, one page-width scale, one card-title spacing (see §5).
- Standardise the "filter bar" (`Students`, `Analyses`, `Mentors`, `Assignments` all
  hand-roll a `flex flex-wrap` row of `Select`s + a search `Input`) into a
  `<FilterBar>` wrapper for consistent spacing and wrap behaviour.

**Navigation**
- Replace hardcoded back links with `navigate(-1)` + "Back".
- Add a 404 page.
- Consider a breadcrumb on detail pages (`Mentees › Aisha › Session 12 Aug`).
- The mobile drawer should close on `Escape` and trap focus (see §2.2).

**User feedback**
- Add "Try again" to every load-error state (§3.4).
- `AssignMenteeDialog` / `EditMenteeDialog` show errors but the "over capacity" warning
  is non-blocking with no confirmation — either make the reason for allowing it explicit
  ("Assign anyway?") or keep it purely informational and say so.
- Toasts auto-dismiss at 4 s with no pause-on-hover; for a two-line message that's tight.
  Bump to ~6 s or pause on hover/focus.
- After a successful analysis the app navigates straight to the result with no "Analysis
  complete" confirmation — a toast would close the loop.

**Perceived quality**
- Match skeletons to layouts (§3.6).
- Respect reduced motion (§3.7).
- Keep the transcript tab mounted so switching tabs is instant (§4.1).

**Overall product experience**
- Make an in-progress analysis re-attachable from `/analyses/:id` (§2.4) — this is the
  single biggest confidence problem in the product.

---

## 7. Performance Recommendations

### 7.1 Cache / dedupe the small reference lists
- **Current problem:** `listMentors()` fires on nearly every route and on every open of
  `AssignMenteeDialog` (`AssignMenteeDialog.tsx:30`), unscoped.
- **Expected benefit:** Removes a network round trip and a select-population flicker on
  most interactions.
- **Implementation:** Module-level promise memo in `api.ts`
  (`let mentorsCache: Promise<MentorAdmin[]> | null`), invalidated after
  create/update/reassign; or pass the already-loaded list into the dialog as a prop.

### 7.2 Collapse the `NewAnalysis` request waterfall
- **Current problem:** `getMe()` → then location effect → then `listMentors` → then
  `listStudents` run strictly in series (`NewAnalysis.tsx:60-102`), each gated on the
  previous `setState`.
- **Expected benefit:** Faster time-to-interactive on the new-analysis form for admins.
- **Implementation:** For a signed-in mentor, `getMe` already returns `mentor_id` +
  `area` — fetch their mentees in the same effect rather than through three chained
  effects.

### 7.3 Memoise transcript parsing + keep tab content mounted
- **Current problem:** `transcript.split("\n").map(regex…)` re-runs on every render and
  every tab switch (`AnalysisResult.tsx`).
- **Expected benefit:** Instant tab switching, no re-parse on unrelated re-renders.
- **Implementation:** `useMemo(() => transcript?.split("\n") ?? [], [transcript])`; in
  `TabsContent`, render with `hidden` instead of returning `null`.

### 7.4 Abort in-flight streams/fetches on unmount
- **Current problem:** `streamAnalysis` and most page loaders have no `AbortController`;
  navigating away leaves work running and can `setState` after unmount.
- **Expected benefit:** No wasted work, no "setState on unmounted component" noise, clean
  cancellation of the SSE read.
- **Implementation:** Thread an `AbortSignal` through `request()` / `streamAnalysis` and
  abort in each effect's cleanup.

### 7.5 Debounced list reloads null the data first
- **Current problem:** `Students.reload()` / `Analyses` effect set the list to `null`
  (full skeleton) on every keystroke-triggered reload, even though old data is still
  valid.
- **Expected benefit:** No full-page skeleton flash while typing a search.
- **Implementation:** Keep the previous list visible with a subtle loading indicator;
  only show the skeleton on the first load.

_Not recommended:_ adding `React.memo` broadly, code-splitting routes (bundle is small),
or virtualising tables at current data volumes — none are justified yet.

---

## 8. Accessibility Recommendations

1. **Focus management in `Dialog` and the mobile drawer** — trap, set initial focus,
   restore on close, `aria-hidden`/`inert` the background. (§2.2) — highest impact.
2. **Add landmarks + skip link** — `<main>`, `<nav aria-label>`, visually-hidden
   "Skip to content". (§3.2)
3. **Fix heading order** — don't jump h1→h3; give `CardTitle` a configurable tag or use
   real `<h2>`s for page sections. (§3.1)
4. **Keyboard-operable file upload** — make the dropzone a real button. (§3.5)
5. **Dialog `aria-labelledby`** — point it at the real `<h2 id>` instead of duplicating
   the string in `aria-label`.
6. **`prefers-reduced-motion`** support. (§3.7)
7. **Checkbox styling + focus** in `Assignments` — larger, visible focus ring.
8. **Login autocomplete** attributes. (§4.8)
9. **Contrast check (runtime):** verify the small `--warning`-coloured "Overdue" badge
   text and the `--muted-foreground` on `--muted` combinations meet 4.5:1 (they are
   borderline in the tokens). **Requires a contrast tool against the running app.**
10. **`Select` loading state** shouldn't leave a focusable invisible control. (§4.9)
11. **Icon-only buttons** (mobile "New Analysis" `+`, password toggle, pagination
    arrows, copy button in `CredentialCard`) — most have `aria-label`; the
    `CredentialCard` copy button (`MentorLogin.tsx:38`) does not. Add one.
12. **Live regions:** analysis stage changes (`AnalysisStepper`) and toasts are not
    announced — wrap the stepper's active step and the toast container in
    `aria-live="polite"`.

---

## 9. Code Quality Recommendations

**Worth doing:**

- **Error boundary** (§2.1) — structural gap, not aesthetic.
- **Centralise `formatDate`** (§4.6) — 6 copies, inconsistent null handling.
- **Extract `<FilterBar>` and one `<StatCard>`** — the four list pages and two
  dashboards duplicate this markup with drifting spacing.
- **Extract `<ErrorState>`** to match `EmptyState` (§3.4).
- **A `useResource`/`useAsync` hook** — every page reimplements the
  `data|null` + `error` + `useEffect(load)` + manual `reload()` pattern
  (`Dashboard`, `StudentProfile`, `MentorDetail`, `Mentors`, `Analyses`, `Students`,
  `Assignments`). One ~30-line hook removes ~15 lines per page and standardises loading /
  error / refetch / abort.
- **Mentor-list fetching** should live in one place (§7.1).
- **`api.ts` side effects:** `request()` mutates `window.location` on 401. Consider
  emitting an event / calling an injected handler so the module stays free of DOM
  navigation (helps future testing).
- **Type the `insights` payload properly** and validate it at the boundary (§4.2)
  instead of `as never`.

**Not worth doing (leave as-is):**

- The `components/ui/*` primitives are appropriately small — don't over-abstract them.
- Prop drilling is minimal and fine; no need for context/state-management library.
- The manual SSE parser in `streamAnalysis` is fine for one consumer.
- Wizard/stepper split (`WizardSteps` vs `AnalysisStepper`) is correct — different jobs.

**Folder structure** is sound (`pages/`, `components/ui/`, `components/<feature>/`,
`lib/`). No change needed.

---

## 10. Prioritized Implementation Plan

### Phase 1 — Critical Fixes
| Item | Expected impact |
|---|---|
| Add `<ErrorBoundary>` around routes + guard `StudentProfile:248` and `ResultsPanel:125` | Eliminates white-screen crashes — the highest-severity failure mode |
| Focus trap + initial focus + focus restore in `Dialog`; same for the mobile drawer + `Escape` | Makes every create/edit/assign flow and the mobile menu usable by keyboard/SR users |
| Wrap the Assignments unassigned-queue table in `overflow-x-auto`; fix the fixed bottom bar clearance on mobile | Restores the admin assignment workflow on phones |
| `AbortController` in `streamAnalysis`; re-attach the stepper on `/analyses/:id` when status is "processing" | Interrupted analyses stop looking like total failures |

### Phase 2 — UX and Responsive Fixes
| Item | Expected impact |
|---|---|
| Shared `<ErrorState onRetry>` on all load failures | Transient network errors become recoverable in one click |
| Match table skeletons to real column layout | Removes layout jump / CLS on the three list pages |
| Keyboard-operable upload dropzone + soft file-size guard | Upload becomes accessible; fewer doomed long uploads |
| `prefers-reduced-motion` block | Respects OS accessibility setting |
| Landmarks (`<main>`, `<nav aria-label>`) + skip link + per-route `document.title` | Faster keyboard nav, better orientation |
| `navigate(-1)` back links + a real 404 page | Less disorientation from context-blind links / dead deep links |
| Login `autocomplete` attributes | Password managers work |

### Phase 3 — Code Quality Improvements
| Item | Expected impact |
|---|---|
| `useAsync` hook adopted across the 7 data pages | ~15 fewer lines/page, consistent loading/error/abort behaviour |
| Centralise `formatDate`; extract `<FilterBar>` and one `<StatCard>` | Removes drift, one place to fix spacing/format bugs |
| Fix heading hierarchy (`CardTitle` tag prop / real `<h2>`s) | Correct document outline for AT |
| Type + validate the `insights` payload at the boundary | Prevents a class of render crashes from backend drift |
| Move the 401→redirect side effect out of `api.ts` | Testable API layer |

### Phase 4 — Performance Optimization
| Item | Expected impact |
|---|---|
| Cache/dedupe `listMentors()`; pass mentor list into `AssignMenteeDialog` | Removes a round trip + select flicker on most interactions |
| Collapse `NewAnalysis` request waterfall | Faster new-analysis form load |
| Memoise transcript parse + keep tab content mounted | Instant tab switching on long transcripts |
| Keep stale list visible during debounced search reloads | No skeleton flash while typing |

### Phase 5 — Final Polish
| Item | Expected impact |
|---|---|
| Unify container widths, card-title padding, alert styling, stat cards | Cohesive, "intentional" feel |
| Toast timing / pause-on-hover; "analysis complete" toast | Clearer feedback loop |
| `aria-live` on stepper + toasts; `aria-label` on `CredentialCard` copy button | Announcements for SR users |
| Remove dead `hero.png`; resolve `favicon.svg`; drop unused `playwright` or add a smoke test | Housekeeping |
| Source `LOCATIONS` from backend or add "unknown area" bucket | Records stop being hidden as the programme grows |

---

_Items marked **requires runtime testing**: the Vercel Hobby 60 s analyze cap (§2.4),
long-transcript rendering cost (§4.1), and exact colour-contrast ratios (§8.9). Everything
else was verified by static inspection of the source._

---

## 11. Application Language & Label Improvements

_Phase 16 pass (2026-09-01). Scope: every visible label, heading, button, status,
message, placeholder, empty state and loading string, audited against the product's
actual domain and the role using each screen. Changes applied, not just catalogued._

### Domain understanding used for the audit

- **What it is:** a tool for a school-mentoring programme (Mumbra / Govandi) that
  records mentor–mentee sessions, transcribes them, and produces AI insights.
- **Roles:** `admin` (programme coordinator — runs mentors, mentees, assignments, sees
  everything) and `mentor` (scoped to their own assigned mentees).
- **Core objects:** **mentor**, **mentee**, **session** (one recorded mentoring call),
  **analysis** (the AI output of a session), **assignment** (mentee ↔ mentor, audited).

### 1. Domain terminology standardised

| Was | Now | Why |
|---|---|---|
| "Total Students" / "Student participation" / "Student Profile / Participation" | "Mentees" / "Mentee participation" / "Mentee snapshot" | The whole app calls this person a **mentee**; only the dashboard stat and the AI-insights panel still said "Student". Now consistent everywhere the user can see. |
| "Analyse" / "analysed" (British) mixed with "Analyze" / "Analyzed" (badge, stepper, buttons) | "Analyze" / "analyzed" everywhere | One spelling. The status badge, stepper and primary button already used the American form. |
| "conversation" / "Audio File" for the thing being analysed | "session" / "Session recording" | Detail pages already speak in **sessions** ("Session history"); the new-analysis screen now matches. |
| Wizard steps "Identity" / "Assignment" | "Details" / "Mentor" | "Identity" is developer language; "Details" and "Mentor" describe what the step actually collects. |

Left deliberately unchanged: "Grade / Std" (local school terminology in this
programme's area), route paths / `student_*` API fields (not user-visible), and
"Mentor Advice" / "Suggestions for Mentor" / "Mentee Commitments" in the insights panel
(already consistent and domain-correct).

### 2. Role-based labels

| Screen | Admin sees | Mentor sees |
|---|---|---|
| Dashboard tab title | "Admin dashboard" | "Mentor dashboard" |
| Dashboard subtitle | "Mentees, mentors, and every session across the programme." | "Your mentees and their latest mentoring sessions." |
| Dashboard stat card | "Mentees" | "My mentees" |
| Dashboard recent-session row | "Mentor: {name} · {date}" | "{date}" (the mentor is always themselves — dropped the noise) |
| Mentees page / title | "Mentees" — "Every mentee across the programme." | "My Mentees" — "The mentees assigned to you." (already in place, confirmed) |
| Analyses subtitle | "Every mentoring session analyzed across the programme." | "Every session you've analyzed." |

### 3. Contextual messaging (generic → domain-specific)

- Analyses empty state: "You're ready to get started" / "Analyse a recording and it'll
  show up here." → **"No sessions analyzed yet"** / "Analyze a mentoring session
  recording and it'll show up here."
- New-analysis primary action: "Analyze Conversation" → **"Analyze session"**.
- Upload action: "Upload Audio" → **"Upload recording"**.

### 4. Loading states

The app already uses contextual, scoped loading copy (`Loading mentors…`,
`Loading mentees…`, `Verifying upload…`, `Uploading… {n}%`, per-button `Saving…` /
`Adding…` / `Creating…`, the named analysis stepper). One stepper label tightened:
"Analyzing conversation" → **"Analyzing the session"**. No generic bare `Loading…`
strings remain in user-facing views.

### 5. Empty states

Already actionable and page-specific (Mentees, Mentors, Assignments queue, session
history, transcript, insights all explain what's empty + a next step). Only the
Analyses no-filter empty state was still generic — fixed above. The filtered-vs-unfiltered
split ("No matches for these filters" + "clear a filter" vs the real empty message) is
preserved on every list.

### 6. Error and success messages

- **Generic HTTP leakage removed** from `lib/api.ts`: `"Request failed (500)"` →
  role-neutral human copy — 5xx: *"Something went wrong on our end. Please try again in
  a moment."*, 4xx: *"That didn't go through. Please check your details and try again."*
  Backend `detail` strings are still surfaced when they're a plain string (they are
  already domain-worded: "Mentee not found.", "That username is taken.", …).
- **Analyze stream start failure**: `"Request failed (n)"` → *"The analysis service is
  busy right now. Your recording is safe — please retry in a moment."* (5xx) /
  *"We couldn't start the analysis. Please try again."* (4xx).
- Success toasts were already contextual and were left as-is ("Mentee {name} added",
  "{name} assigned to {mentor}", "Analysis ready for {name}", "Status updated", …).

### Status label mapping (confirmed centralised)

Backend session states are mapped to display labels in one place —
`components/ui/badge.tsx` (`STATUS_LABEL` / `STATUS_VARIANT`, and `MENTEE_STATUS`).
No raw `PROCESSING` / `AUDIO_DELETED` style values reach the screen; `AUDIO_DELETED`
already renders as "Complete". No change needed — noted here so it stays centralised.

_`npm run build` + `tsc` green after these changes._
