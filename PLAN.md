# Plan: Kiipeily Treeni Appi — Climbing Training Diary (MVP)

## Context

Existing climbing diaries handle **repeated climbs and attempt counts poorly** — there is no good way to log how many times you climbed something, or how many attempts you put into an unfinished ("projecting") climb. This app fixes that.

It is a **native mobile app** for logging climbing training during a session: tap a grade to log a send (with repeats), or switch into **projecting mode** to count attempts on a climb you're working — which can be sent the same session or **persist across sessions** until sent. Sessions are dated and browsable on a timeline with basic stats. Non-climbing (strength/endurance) workouts can also be logged as a secondary feature.

**Locked-in decisions (from planning Q&A):**
- **Platform:** React Native via **Expo** (managed) + TypeScript — native app.
- **Storage:** **Local-only / offline-first**, on-device, single device, **no cloud, no accounts**. (Gyms have poor signal.)
- **Discipline:** **Bouldering first**, plus **French sport climbing**.
- **Grades:** Support **Font and V** scales for bouldering with a **Font↔V conversion** (approximate now, optimizable later); **Font is the default**. French scale for sport.
- **Projects:** simple model — **archive action only**. Free-text location per session, no gym entity in v1. Project status: `active | sent | abandoned | archived` (manual Archive for when a gym resets routes).
- **Stats in v1:** basic — **grade pyramid** (sends per grade) + **climbing volume** over time (simple bar charts).
- **Backup:** **manual JSON export/import** in Settings (no cloud; lets you move to a new phone).
- **Language:** **Finnish UI, English climbing jargon** (projecting, flash, send/redpoint, beta).
- **MVP scope:** Log sends by grade · Projecting mode + attempts · Sessions + timeline · Basic stats · Supplemental workouts · Edit/undo · Export/import.

The repo currently contains only `README.md` and `.gitignore` — this is a greenfield build.

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo (managed) + TypeScript | Native, fast iteration, no Mac/Xcode needed to start |
| Navigation | `expo-router` (file-based) | Current Expo standard, typed routes |
| Local DB | `expo-sqlite` | Relational data (sessions → sends/attempts) fits SQL; fully offline |
| DB layer | `drizzle-orm` (drizzle-orm/expo-sqlite) + drizzle-kit migrations | Type-safe schema & queries; swappable for raw SQL if preferred |
| UI state | `zustand` | Lightweight store for active-session / projecting-mode UI state |
| Haptics | `expo-haptics` | Tap feedback for glove-friendly logging |
| Export/import | `expo-file-system` + `expo-sharing` | Write/share JSON backup, import from file |
| Charts | `react-native-svg` (+ light custom bars or `victory-native`) | Grade pyramid & volume bars |

> Update `CLAUDE.md` and prune `.gitignore` to the Node/Expo ecosystem (remove PHP/Python lines), and record run/build/test commands there.

## Data model (SQLite)

Core idea: **sends** and **projects** are separate entities, mirroring the "switch into projecting mode" UX. A project can be sent the same session or accumulate attempts across many.

- **`sessions`** — `id, date (ISO), location? (free text), notes?, started_at, ended_at?`
  - Manual **Start / End**; an open session stays open until ended. **Multiple sessions per day allowed**.
- **`send_logs`** — completed climbs logged by grade, with repeat count.
  `id, session_id→sessions, discipline (boulder|sport), grade_system (font|v|french), grade_value (e.g. "6B"), count (default 1), flash (bool), notes?, created_at`
- **`projects`** — a climb being worked.
  `id, name?, discipline, grade_system, grade_value, status (active|sent|abandoned|archived), location?, notes?, created_at, sent_at?`
  - **Archive** = manual status for gym-reset cleanup; archived/sent/abandoned drop out of the active picker.
- **`project_attempts`** — per-session attempt log against a project (the key feature).
  `id, project_id→projects, session_id→sessions, attempt_count (default 1), sent (bool), notes?, created_at`
  - Lifetime attempts = `SUM(attempt_count)` for the project; this session's attempts = the row for `(project, session)`. "+1" increments the current session's row; **Mark Sent** sets `projects.status='sent'`, `sent_at`, and this row's `sent=true`.
- **`supplemental_entries`** — non-climbing training within a session (generic for v1).
  `id, session_id→sessions, name (e.g. "Hangboard", "Run"), kind (strength|endurance|other), sets?, reps?, weight?, duration_sec?, notes?, created_at`

Indexes on `send_logs.session_id`, `project_attempts.project_id`, `project_attempts.session_id`.

**Stats rule:** grade counts/pyramid **union `send_logs` + sent `projects`** so a sent project counts as a climb at its grade.

## Grades & conversion

`src/domain/grades.ts`:
- Ordered arrays: **Font** (`4, 5, 5+, 6A, 6A+, 6B … 9A`), **V** (`V0…V17`), **French sport** (`4, 5a … 9c`).
- `fontToV` / `vToFont` approximate lookup tables (clearly marked approximate; refine later).
- `convert(value, from, to)` helper to render a secondary grade label (e.g. V-equivalent under a Font pick).
- Pick lists drive the touch grade picker; default system from settings (Font).

## Screens & navigation (expo-router tabs)

1. **Home / Active session** (`app/(tabs)/index.tsx`) — Start/resume/end session; main logging UI:
   - **Mode toggle: Send ⇆ Projecting**.
   - *Send mode:* large grade buttons (Font default, V toggle), tap = +1 send; quantity stepper for repeats; flash toggle.
   - *Projecting mode:* **pick an active project or create one**, big **+1 Attempt** button, **Mark Sent** button; shows attempts this session + lifetime total.
   - **Undo last action** + swipe-to-delete on logged entries.
   - Quick action to add a **supplemental entry**.
2. **Timeline / History** (`app/(tabs)/timeline.tsx`) — sessions grouped by date; tap to open detail.
3. **Projects** (`app/(tabs)/projects.tsx`) — active/sent/archived projects with lifetime attempt totals and # sessions worked; **Archive / Abandon** actions.
4. **Stats** (`app/(tabs)/stats.tsx`) — **grade pyramid** (sends per grade, sends ∪ sent projects) + **volume over time** (climbs per session/week) as simple bars.
5. **Settings** (`app/(tabs)/settings.tsx`) — default grade system (Font), Font/V display, **Export / Import JSON**.
6. **Session detail** (`app/session/[id].tsx`) — sends, projects worked + attempts, supplemental; edit/delete entries.

Touch/UX: large tap targets, minimal typing, steppers over keyboards, haptic feedback on log. **Finnish UI text, English climbing jargon.**

## Suggested project structure

```
app/                         expo-router screens (see above)
  _layout.tsx, (tabs)/_layout.tsx, (tabs)/index.tsx, timeline.tsx, projects.tsx, stats.tsx, settings.tsx
  session/[id].tsx
src/
  db/        client.ts (expo-sqlite + drizzle), schema.ts, migrations/, repositories/
  domain/    grades.ts, types.ts, stats.ts (pyramid/volume aggregation)
  state/     activeSession.ts (zustand)
  i18n/      fi.ts (Finnish strings; jargon kept English)
  backup/    exportImport.ts (JSON serialize/restore all tables)
  components/ GradePicker.tsx, Stepper.tsx, ModeToggle.tsx, ProjectCard.tsx, SessionCard.tsx, BarChart.tsx
  hooks/
```

## Implementation steps

1. **Scaffold** Expo + TypeScript (`npx create-expo-app`); add `expo-router`, `expo-sqlite`, `drizzle-orm`, `drizzle-kit`, `zustand`, `expo-haptics`, `expo-file-system`, `expo-sharing`, `react-native-svg`. Prune `.gitignore`, update `CLAUDE.md` with stack + commands.
2. **DB foundation:** `schema.ts`, drizzle + expo-sqlite client, initial migration run on app start; repositories (sessions, sends, projects, attempts, supplemental).
3. **Grades module:** scales + conversion + unit tests.
4. **Session lifecycle:** Start/End session, multiple-per-day, free-text location; zustand active-session store.
5. **Send mode:** grade picker, log sends with count/flash, persist; undo + delete.
6. **Projecting mode:** create/select active project, +1 attempts, Mark Sent; session + lifetime totals; Archive/Abandon.
7. **Timeline + Session detail:** list/group sessions; detail aggregates sends/projects/supplemental with edit/delete.
8. **Projects screen:** list with lifetime attempt totals, sessions worked, status actions.
9. **Stats screen:** grade pyramid + volume (aggregation in `domain/stats.ts`, union sends ∪ sent projects).
10. **Supplemental entries:** add/list within a session.
11. **Settings + Export/Import:** default/display grade system; JSON export (share) and import (restore all tables).
12. **i18n + polish:** Finnish strings (English jargon), large touch targets, haptics, empty states.

## Verification

- **Run:** `npx expo start` → Expo Go on a phone (or Android/iOS simulator).
- **Core flow (the differentiator):** Start a session → Send mode: log `3× 6B` and a flashed `6A` → Projecting mode: create "7A slab", tap +1 five times → End session. Start a **second** session, add 3 more attempts, then **Mark Sent**. Projects screen shows **8 lifetime attempts across 2 sessions**, status **sent**.
- **Edit/undo:** mis-tap a send, undo it; delete an entry from session detail.
- **Stats:** pyramid counts the sent project at 7A plus the logged sends; volume shows both sessions.
- **Timeline:** both sessions appear by date; detail shows correct sends/attempts/supplemental.
- **Grades:** Font default; V toggle shows converted equivalents; French available for sport.
- **Archive:** archive a project → it leaves the active picker but stays visible/filterable on Projects.
- **Backup:** Export JSON, clear app data (or reinstall), Import → all data restored.
- **Offline:** airplane mode — everything works and persists across restarts (SQLite).
- **Unit tests:** grade conversion (`grades.ts`) and stats aggregation (`stats.ts`).
