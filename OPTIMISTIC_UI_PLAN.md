# Optimistic UI Plan — Mentor‑Mentee Insights

## 1. Current UI tone

The frontend is a React 19 + React Router 7 + Tailwind v4 SPA. It is already
well‑built: a token‑based design system in `src/index.css` (light/dark, semantic
colours, shadows, radii), a small `components/ui` primitive set (Button, Card,
Badge, Input, Select, Progress, Skeleton, Toast, EmptyState, ErrorState, Dialog,
Tabs, Wizard), consistent page scaffolding (`mx-auto max-w-*`, page title +
muted subtitle), skeleton loaders, empty states, error states with retry, focus
traps and skip links.

Emotionally the UI reads as **competent but cold**:

- Primary colour is near‑black (`#0b0c10`); the accent violet only appears in
  small chips and the nav active state. Screens are large fields of white/grey.
- Icon "chips" (empty states, 404, stat cards) are grey‑on‑grey — they feel
  inert rather than encouraging.
- Success is under‑celebrated: toasts and the analysis stepper confirm quietly;
  there is no visible "you're making progress / you're all set" moment.
- Skeletons use a flat grey pulse; loading feels like waiting, not working.
- Microcopy is accurate but a little flat / occasionally negative ("No transcript
  available", "Analysis failed", "No insights available yet").
- Buttons are functional but static — no hover lift, accent is a flat fill.

Nothing is broken; it just doesn't feel *alive* or *premium*.

## 2. Problems identified

| Area | Problem |
|---|---|
| Colour | Accent barely used; no brand gradient; success colour muted; shadows have no warmth |
| Progress | Stepper has no connective tissue, no positive completion state; Progress bar flat |
| Empty states | Grey chip + terse copy = dead end feeling |
| Loading | Grey pulse skeletons; no shimmer/motion continuity |
| Success | Toasts and completed analysis feel like nothing happened |
| Microcopy | Several negative / robotic strings |
| Buttons | Flat accent fill, no hover elevation, no dedicated success variant |
| Cards | No hover affordance on clickable cards/rows |
| Brand mark | Flat black square — no personality |

## 3. Design direction

Keep the restrained, monochrome base. Add **one confident brand gradient**
(indigo → violet) used sparingly for identity and primary momentum, a
**fresher, more legible success green**, subtly **warm‑tinted shadows**, and
**motion that signals "working" and "done"** — all behind
`prefers-reduced-motion`. No new colours per card, no decoration for its own
sake. Rewrite negative/robotic copy into calm, forward‑looking language.

## 4. Global changes

- **`index.css`**
  - Add `--accent-gradient`, `--brand-gradient`, `--ring-offset`.
  - Richer accent scale; brighter, more accessible `--success` (`#15a349` light
    stays but bump chips), keep contrast.
  - Warm‑tint shadows very slightly toward the accent hue.
  - Subtle fixed radial background wash on `body` for depth (very low alpha).
  - Keyframes: `rise` (fade + 4px up), `shimmer`, `pop`, `toast-in`; utility
    classes `.animate-rise`, `.shimmer-bg`, `.animate-pop`. All disabled under
    reduced motion (already globally handled, plus explicit no‑op).
- **Button** — accent variant uses gradient + shadow + `hover:-translate-y-px`
  + `hover:shadow-md`; add `success` variant; keep sizes/focus.
- **Card** — optional `interactive` prop → hover border + shadow lift + `-translate-y-px`.
- **Skeleton** — shimmer sweep instead of bare pulse.
- **Progress** — gradient fill, rounded, soft glow, smooth width transition.
- **EmptyState** — accent‑tinted icon chip, gentle `animate-rise`, optimistic
  default framing.
- **ErrorState** — calmer default title/description.
- **Badge** — `success` chip gets a leading dot option for "live/positive" use.
- **Toast** — slide/fade in, success uses success border + tinted bg.
- **AnalysisStepper** — vertical connector line, animated check "pop", explicit
  "All set — insights are ready" completed state.

## 5. Page‑specific changes

- **App shell / Brand** — gradient brand mark; active nav item gets a subtle
  left accent bar feel via existing accent‑bg (kept).
- **Login** — gradient brand mark; friendlier subtitle; success‑free but warmer.
- **Dashboard** — gradient stat‑card icons + hover; heading welcomes ("Here's
  where things stand"); recent‑analyses rows use interactive hover; attention
  banner copy softened ("A few mentees could use attention").
- **NewAnalysis** — primary CTA copy → "Analyze conversation" kept but button
  gets momentum styling; in‑progress card title friendlier; error copy calmer.
- **AnalysisView / AnalysisResult** — "No transcript available" →
  "The transcript will appear here once processing finishes."; failed‑analysis
  block phrased as recoverable.
- **Analyses / Students** — empty states reworded to be inviting; row hover.
- **NotFound** — warmer, still concise.

## 6. Component strategy

Improve existing primitives only — no new deps, no new files except this plan.
All changes flow through `components/ui/*` so every page inherits them.

## 7. Rollout order

1. `index.css` tokens + keyframes
2. Button, Card, Skeleton, Progress, Badge
3. EmptyState, ErrorState, Toast, AnalysisStepper
4. Brand mark + Dashboard + page microcopy
5. Build check
