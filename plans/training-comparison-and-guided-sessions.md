# Plan: training comparison + guided sessions ("use the data")

> Multi-PR roadmap. Status: planned, not started. See `PLAN.md` for the original MVP spec and
> `CLAUDE.md` for stack/conventions.

## Context
The app collects rich climbing data (grade, count, flash, hold type, discipline, session
date/theme/environment, and the projecting/attempt data that is its differentiator), but the
Stats tab only renders a grade pyramid + volume and **ignores attempts entirely** (only sends +
sent projects count). This phase turns the data into utility, in two intertwined capabilities:

1. **Comparison** — compare amount/quality of climbing across time scopes (session/day, week,
   month, custom range). Stats tab: this-week-vs-last-week by default, plus custom period vs
   period. History tab: compare the open session to another past session. Metrics (defaults,
   later user-customizable): **# workouts**, **total efforts by grade (sends + attempts)**, and
   **attempts by grade**.
2. **Guided sessions (training plans)** — on session start, after choosing theme + environment,
   build a plan from a past session (curated list filtered by theme/environment/recency) **or a
   saved template**, apply modifiers (±volume %, grade shift), and get per-grade targets. During
   the session the app shows live progress and **warns but allows override** when you exceed a
   grade target or log an off-plan grade.

**The unifying primitive:** a per-grade tally where a **send and an attempt each count as one
"effort."** That single aggregation powers both comparisons and plan baselines/targets/progress.

### Decisions locked
- **Enforcement:** soft — show progress, warn + allow override (record over/off-plan); never hard-block.
- **Plans:** derived from a past session AND savable as named reusable templates.
- **Per-discipline:** all by-grade aggregation is scoped per discipline (boulder vs sport),
  normalized to the display scale — consistent with today's discipline toggle + `gradePyramid`.
- **Effort definitions (a "go" at a grade; single source of truth in `aggregate.ts`, easy to pivot):**
  - *efforts (total)* per grade = `send_logs.count + attempt_logs.count + project_attempts.attemptCount`.
    Do **NOT** also add the sent-project +1 here — the sending go is already inside `attemptCount`,
    so adding it would over-count sent projects by one.
  - *attempts* per grade = `attempt_logs.count + project_attempts.attemptCount` (known imperfection:
    a project's sending go is counted here as an attempt because `project_attempts` is an aggregate
    counter with no per-go rows; "might pivot").
  - *sends* per grade = `send_logs.count` + 1 per sent project — a separate lens (successful
    ascents), used by the existing pyramid; never summed into *efforts*.
- **Grade keys & normalization:** tally/compare/target on a key of `(discipline, system, gradeValue)`
  **as logged**, then normalize to the chosen display scale only for rendering. Plan targets are kept
  in the logged system (no lossy round-trip) and enforcement matches on the same normalized key.
  `convert` (Font↔V) is approximate — never use it as the canonical target key.
- **Date attribution:** bucket efforts by their **session's `date`** (calendar day), consistent with
  the timeline. Scopes: *session* (one session id), *day* (all sessions that date — multiple/day
  allowed), *week*, *month*, *custom range*.
- **Modifiers:** volume = scale each grade's baseline count by `(1 + pct/100)`, rounded; grade
  shift = move each grade by ±N steps in its discipline scale (`gradeIndex`, clamped). Combinable.

## Shared foundation — reuse, don't reinvent
- `src/domain/stats.ts`: `isoWeekStart`, `gradePyramid`, `VolumeBucket/DatedCount` patterns.
- `src/domain/grades.ts`: `gradeIndex`, `convert`, `gradesFor`, `defaultSystemForDiscipline`.
- Repos: `Sends.allSends`, `AttemptLogs.allAttemptLogs`, `Projects.allSentProjects`,
  `Attempts` (need a new `allProjectAttemptsWithGrade()` joining project grade + session date),
  `Sessions.listSessions`, `Themes.listThemes`.
- UI: `BarChart`, `SegmentedControl`, `ThemePicker`, `useDbQuery`/`bumpData`, `useSettings`,
  the `ensureColumn` migration helper in `client.ts`, backup `collectData`/`restoreBackup`.

---

## PR1 — Effort-aggregation core (foundation, pure + tested)
Branch `feat/effort-aggregation`. No UI.
- New `src/domain/aggregate.ts`:
  - `ClimbEffort` = `{ discipline, gradeSystem, gradeValue, count, kind: 'send'|'attempt', date, sessionId }`.
  - Builders from raw rows (`send_logs`, `attempt_logs`, `project_attempts`+project grade) given a
    `sessionId → date` map.
  - `Period = { start, end }` + helpers `weekRange`, `lastWeekRange`, `monthRange`, `dayRange`
    (build on `isoWeekStart`); filter efforts by date.
  - `tallyByGrade(efforts, { metric:'total'|'attempts'|'sends', discipline, displaySystem }) → PyramidRow[]`.
  - `countWorkouts(sessions, period, filter?)` and `comparePeriods(a, b)` →
    `{ grade, a, b, delta }[]` + totals.
- New `src/domain/aggregate.test.ts` covering tally classification, normalization, range filters,
  comparison deltas, modifier math (volume scale + grade shift).
- Verify: `npm test` green (new + existing 15).

## PR2 — Stats tab: period comparison
Branch `feat/stats-comparison` (after PR1).
- Add a `Efforts.listEffortsInRange(start,end)` style repo aggregator (or fetch-all + filter in a
  `useDbQuery`, mirroring current `stats.tsx`), plus `Attempts.allProjectAttemptsWithGrade()`.
- Revamp `src/app/(tabs)/stats.tsx`: keep pyramid/volume; add a **Comparison** section — default
  **this week vs last week**, with a period picker for each side (week / month / custom range).
  Show # workouts, total efforts by grade, attempts by grade as grouped/delta bars.
- New components: `PeriodPicker` — preset windows (this/last week, this/last month) **plus an
  in-app custom date-range picker** (start/end), built in this PR — and a grouped/delta variant of
  `BarChart` (extend `BarChart` or add `ComparisonBarChart`).
- Ship **fixed default metrics** (workouts, total efforts by grade, attempts by grade) this PR;
  user-customizable metric visibility is **deferred to a later optional PR** (keeps PR2 focused).
- i18n: label the combined metric unambiguously (e.g. "Kaikki nousut (yritykset + sendit)"), not
  "total sends", to avoid confusion. Verify on device via `/dev-start`.

## PR3 — History tab: session-vs-session comparison
Branch `feat/session-comparison` (after PR2; reuses its comparison components).
- In `src/app/session/[id].tsx`: a "Vertaa…" action → pick another past session (list from
  `Sessions.listSessions`) → render per-grade tallies side by side, using PR1 + PR2 components.
- **Metric set differs from PR2:** no "# workouts" (always 1 vs 1). Show total efforts by grade,
  attempts by grade, and headline totals (total efforts, total attempts, highest grade). A small
  optional "quality" headline (highest grade / volume-weighted-by-grade index) can land here or PR2.

## PR4 — Guided sessions: plan model + derive-from-session builder
Branch `feat/guided-session-plan` (after PR1). Deliberately excludes templates (PR5) and
enforcement (PR6) so the slice stays shippable.
- **Data model** (migrations via `ensureColumn` + new tables in `CREATE_TABLES_SQL` + backup):
  - `sessions.plan TEXT` — JSON snapshot of the active plan
    `{ targets: {system,gradeValue,target}[], discipline, label, source }` (targets keyed in the
    logged system per "Grade keys" above).
  - Bump `BACKUP_VERSION`; `sessions.plan` rides along in the sessions array.
- **Repos:** `Sessions.getSessionPlan`/`setSessionPlan`; a curated query filtering sessions by
  theme + environment + recency window.
- **Builder UI** on Start-session (`index.tsx`), after theme/environment chosen: pick a curated
  past session → apply modifiers (±volume %, grade shift; reuse PR1 tally + modifier math) →
  preview per-grade targets → start session with the plan snapshot attached. No live enforcement
  yet (PR6); just persist + show the plan on the session header.

## PR5 — Guided sessions: saved templates
Branch `feat/training-plan-templates` (after PR4).
- `training_plans` table (`id, name, discipline, theme?, environment?, targets JSON, createdAt`) +
  `Plans` repo CRUD + backup + bump version.
- Builder gains: start from a **saved template** (not just a past session), and **save** a built
  plan as a named template. Manage/delete templates in Settings.

## PR6 — Guided sessions: live progress + soft enforcement
Branch `feat/guided-session-progress` (after PR1 + PR4).
- In `SendMode` (and projecting `+1`) when the active session has a plan: show per-grade progress
  (current efforts vs target, reusing PR1 tally on this session's efforts).
- **Flow ordering:** the over/off-plan check runs at *log intent, before the DB insert*, so the
  warn + override confirm happens first; on proceed, insert, then (if `trackHoldType`) the existing
  hold-type prompt — the two prompts never collide. Sends and attempts both decrement the same
  per-grade budget; off-plan grades and over-target logs are allowed but marked.
- Optional: plan summary/progress on the active-session header.

## Dependency order
PR1 → PR2 → PR3 ; PR1 → PR4 → {PR5, PR6}. (Comparison track and guided-session track are
independent past PR1; PR5 and PR6 both build on PR4 and can proceed in either order.)

## Cross-cutting conventions
- Mutations go through repos then `bumpData()`; screens read via `useDbQuery`.
- New tables/columns: update `schema.ts` DDL + `ensureColumn` migration + backup + (if a column)
  the drizzle table. Keep migrations idempotent.
- Finnish UI text; English climbing jargon. Add strings to `src/i18n/fi.ts`.

## Future / backlog (agreed out of scope now — candidate issues, implementation TBD)
- **Intensity / RPE** per session or per climb (perceived effort) — enables smarter load comparison.
- **Wall angle / steepness** (slab / vertical / overhang) — another training-balance dimension.
- **Send-rate & flash-rate** metrics (sends ÷ efforts; flashes ÷ sends) per grade/period.
- **Per-metric customization UI** for the comparison view (user chooses which metrics show).
- (Supplemental-workout rework stays separate; revisit only if load metrics need it.)

## Verification (per PR)
- `npm run typecheck` + `npm test` green; new pure logic (aggregate, modifiers) unit-tested.
- Migration safety on an existing DB (no crash; `PRAGMA table_info` shows new columns).
- Manual on device via the `/dev-start` skill: PR2 this-week-vs-last-week + a custom compare;
  PR3 compare two sessions; PR4 build a plan from a curated past endurance/indoor session with
  +20% volume and start the session; PR5 save/reuse a template; PR6 see live progress and the
  warn-on-exceed override (and off-plan grade) logging anyway.
