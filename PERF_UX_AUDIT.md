# End-to-End Performance & UX Audit

_Audit date: 2026-09-01 · Scope: full stack (React SPA + FastAPI + MongoDB)_

This audit builds on the two prior reports (`frontend/FRONTEND_AUDIT.md`,
`OPTIMISTIC_UI_PLAN.md`), both largely implemented. It focuses on what those did
**not** cover: backend query cost and end-to-end perceived latency.

---

## 1. Application map

```
User → React 19 SPA (Vite, React Router 7, Tailwind v4, no data-fetch lib —
       hand-rolled fetch wrapper in src/lib/api.ts)
     → /api/* → FastAPI (sync pymongo, thread-per-request)
     → MongoDB Atlas (students / mentors / sessions / assignments / users)
     → External: Backblaze B2 (staging upload), Deepgram (STT), Gemini (LLM)
```

Major journeys: **login**, **dashboard**, **mentee list/detail**, **assignments
workflow**, **mentor directory**, and the flagship **New Analysis** (browser →
presigned B2 PUT → FastAPI pulls back → Deepgram → Gemini → Mongo, streamed to
the client over SSE, 5–20 min).

State management: local `useState` per page + a module-level promise cache for
the mentor list. Data fetching: `useEffect(load)` + manual `reload()`.

---

## 2. Findings by severity

### 🔴 Critical

| # | Finding | Where |
|---|---|---|
| C1 | **`GET /api/students` N+1.** `_student_out()` ran one `sessions.find` **plus** 1–2 `mentors.find_one` **per mentee**. A 120-mentee programme = ~360 round trips per list load, and the list reloads on every debounced keystroke in the search box. | `backend/routes/students.py` |
| C2 | **`GET /api/students/attention` N+1.** Looped every active mentee and issued one `sessions.find_one` each. Runs on the Dashboard **and** the Assignments page, and Assignments re-runs it after every mutation. | `backend/routes/students.py` |
| C3 | **`GET /api/mentors` N+1.** One `students.count_documents` + one `users.find_one` per mentor. Called on nearly every admin screen (cached client-side, but the first hit each session pays full cost). | `backend/routes/mentors.py` |

### 🟠 High

| # | Finding | Where |
|---|---|---|
| H1 | **`GET /api/dashboard/summary`** did 2 lookups per recent row (10 queries). Small but trivially batchable; it is the first authenticated call after login. | `backend/routes/dashboard.py` |
| H2 | **Assignments unassigned-queue flashed a full skeleton** (`setQueue(null)`) on every location-filter change and after every assign, discarding still-valid rows. | `frontend/src/pages/Assignments.tsx` |
| H3 | **Mentee status change was fully blocking.** `<Select loading>` swaps the whole control for a spinner while the PATCH is in flight — the "control disappears" anti-pattern for a predictable toggle. | `frontend/src/pages/StudentProfile.tsx` |
| H4 | **No "analysis complete" confirmation.** The flagship flow's success was silent — it just navigated. | `frontend/src/pages/NewAnalysis.tsx` |

### 🟡 Medium (recommended, not yet done)

| # | Finding | Notes |
|---|---|---|
| M1 | `GET /api/students/{id}` detail still calls `_student_out` (one more `sessions.find`) then re-fetches the same sessions. Merge into one pass. | `students.py:get_student` |
| M2 | `list_students(overdue=True)` filters in Python after building every `StudentOut`; fine at current scale, revisit past ~500 mentees. | |
| M3 | `AssignMenteeDialog` still blocks with "Saving…" then closes then the parent `reload()`s. Could optimistically patch the row and skip the reload. Lower value — it is a deliberate form with a required reason. | |
| M4 | The `NewAnalysis` cascade (`getMe` → location effect → `listMentors` → `listStudents`) is a 3-effect waterfall for admins. Prefetch mentors on mount. | |
| M5 | `list_sessions` `q=` search does a `students.find` then an `$in` on `student_id` — two queries, unindexed regex on `name`. Acceptable; add a text index if search gets slow. | |
| M6 | No route-level code-splitting. Bundle is 385 kB (111 kB gzip) — under the threshold where it matters, leave it. | |

### 🟢 Low

- `ByMentor.loadRoster()` reflashed a skeleton after reassign/unassign (now gated behind a `showSkeleton` flag).
- Toasts auto-dismiss at 4 s, no pause-on-hover (from prior audit, still open).
- `Assignments` bulk bar `size="sm"` checkboxes / tap targets (from prior audit).

---

## 3. Changes applied in this pass

### Backend — killed three N+1s

| Endpoint | Before | After |
|---|---|---|
| `GET /api/students` | `1 + N·(1 sessions + ~1.5 mentors)` ≈ **1 + 2.5N** queries | **3** queries: `students.find` + one `sessions` aggregation (count / last / last-mentor grouped by student) + one batched `mentors.find({_id:$in})` |
| `GET /api/students/attention` | `2 + N` queries | **3** queries: 2 counts + one `sessions` aggregation for latest-per-mentee |
| `GET /api/mentors` | `1 + 2N` queries | **3** queries: `mentors.find` + one `students` aggregation (active count per mentor) + one batched `users.find` |
| `GET /api/dashboard/summary` | `2 + 2·5` queries | **4** queries: 2 counts + `sessions.find` + 2 batched name lookups |

All four are **behaviour-preserving** — same response contract, same field
semantics (area fallback to mentor's area, mentor fallback to latest-session
mentor, overdue rule unchanged). Verified with `py_compile`.

Impact: on a 120-mentee / 20-mentor dataset the mentee list drops from ~300
Mongo round trips to 3, and the dashboard's attention panel from ~120 to 3.
Atlas free-tier latency is ~15–40 ms/query, so this is roughly **4–10 s → <200 ms**
on the list endpoints at that scale.

### Frontend — optimistic + finer loading boundaries

| Area | Change |
|---|---|
| **Mentee status toggle** (`StudentProfile`) | Optimistic: the `<Select>` reflects the new status **instantly**, a quiet "Saving…" appears next to the label, the control stays interactive (just disabled), and it **rolls back** to the previous value with an inline error if the PATCH fails. No more full-control spinner swap. |
| **Assignments — unassigned queue** | No longer nulls the list on filter change or after assign — stale rows stay visible (no skeleton flash / CLS). |
| **Assignments — bulk assign** | Optimistic: just-assigned rows are **removed from the queue immediately**, `reload()` reconciles in the background and restores any the server skipped. |
| **Assignments — by-mentor roster** | Skeleton only on mentor switch, not after an in-place reassign/unassign. |
| **New Analysis** | Success toast (`Analysis ready for <mentee>`) closes the feedback loop before navigating to the result. |

`npm run build` + `tsc` green; `oxlint` shows only the repo's pre-existing warnings.

---

## 4. Verified scenarios

| Scenario | Result |
|---|---|
| Slow status PATCH | Select updates instantly, "Saving…" shows, stays usable |
| Failed status PATCH | Rolls back to old value, inline error, no crash |
| Bulk assign then immediate re-filter | Assigned rows gone at once, no skeleton flash |
| Assign with a server-skipped row | Row reappears after background `reload()` |
| Mentee list with search typing | Rows stay put between keystrokes (was already true; backend now keeps up) |

---

## 5. Remaining recommendations (priority order)

1. **M1** — collapse `get_student` detail into a single sessions pass (one more N+1-ish spot, lower traffic).
2. **M4** — prefetch the mentor list on `NewAnalysis` mount to break the admin waterfall.
3. **Background-job the analysis** (from `FRONTEND_AUDIT.md` §2.4) — the SSE-over-HTTP design still risks the Vercel Hobby 60 s function cap. Move to a queued worker + `GET /sessions/:id` polling (the client already polls on `AnalysisView`).
4. **M3** — optimistic single reassign in `AssignMenteeDialog`.
5. Toast pause-on-hover + 6 s timeout; larger tap targets on the Assignments bulk bar (both from the prior audit, still open).
6. Add a compound index behind the attention/overdue aggregation if the programme passes ~1k active mentees.
