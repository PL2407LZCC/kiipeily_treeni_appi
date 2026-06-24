# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

"Kiipeily Treeni Appi" (Finnish: *Climbing Training App*) — a native mobile app for logging
and tracking climbing training (boulder + French sport). Its differentiator is handling
**repeated climbs and attempt counts** properly: log sends with repeats, or switch into
**projecting mode** and accumulate attempts on a project across sessions until it's sent.

In **Send mode**, a **short tap** on a grade logs a send; a **long-press** (~800 ms,
`ATTEMPT_LONG_PRESS_MS` in `src/app/(tabs)/index.tsx`) logs a **loose attempt** at that grade
— a failed/unsent try that isn't tied to a project (e.g. the first two goes before sending on
the third). These live in the `attempt_logs` table (separate from `project_attempts`) and are
**excluded from stats** (pyramid/volume count sends + sent projects only).

**Hold type (optional).** When the `trackHoldType` setting is on (Settings; default off), logging
a send/loose-attempt opens a blocking 3-button prompt (`HoldTypePrompt`) — Slopy · Ei määritelty
· Crimpy — that sets a `hold_type` (`HoldType = 'crimpy' | 'slopy'`, null = undefined) on that
row; projects get a hold type at creation. Stored on `send_logs`/`attempt_logs`/`projects` for a
future weekly "crimpy vs. slopy per grade" stat; editable in session detail. When off, no
hold-type UI appears.

**Sessions** carry optional `theme` and `environment` (`indoor`/`outdoor`) alongside the
free-text `location`, set on the Start-session screen (not editable later). Theme is picked from
a dropdown (`ThemePicker`) backed by the `session_themes` table — seeded with Endurance/Strength/
Power on first run and managed (add/remove) in Settings — to avoid free-text typos.

UI text is **Finnish**; climbing jargon stays **English** (send, project, projecting, flash,
redpoint, beta). See `PLAN.md` for the full product/data-model spec.

## Tech stack

- **Expo (managed) + TypeScript**, React Native 0.85, React 19 — Expo SDK 56.
- **expo-router** (file-based routing, typed routes) — screens live in `src/app/`.
- **expo-sqlite + drizzle-orm** (`drizzle-orm/expo-sqlite`) — local, offline-first DB.
  Tables are created on startup via idempotent DDL in `src/db/client.ts` (no drizzle-kit
  migrations); the drizzle schema in `src/db/schema.ts` provides type-safe queries. New columns
  on existing tables are added by the idempotent `ensureColumn` helper in `client.ts`
  (`PRAGMA table_info` + `ALTER TABLE … ADD COLUMN`), since `CREATE TABLE IF NOT EXISTS` won't
  alter an existing table — add a call there when introducing a column.
- **zustand** — lightweight UI state (`src/state/`): active-session UI, settings mirror, and a
  global `dataVersion` counter that `useDbQuery` watches to re-run reads after a mutation.
- **expo-haptics** (tap feedback), **expo-file-system + expo-sharing** (JSON export/import),
  **@expo/vector-icons** (Ionicons), **react-native-svg** (installed; charts are currently
  View-based in `src/components/BarChart.tsx`).

Storage is **on-device only** — no cloud, no accounts. Backup is manual JSON export/import in
Settings (`src/backup/exportImport.ts`).

## Project layout

```
src/
  app/                  expo-router screens
    _layout.tsx         root Stack + DB init + settings load
    (tabs)/             index (Treeni), timeline, projects, stats, settings
    session/[id].tsx    session detail
  db/        client.ts, schema.ts, repositories/ (sessions, sends, attemptLogs, projects, attempts, supplemental, themes, settings)
  domain/    grades.ts (scales + Font↔V conversion), stats.ts (pyramid/volume), types.ts, dates.ts
  state/     activeSession.ts, settings.ts, dataVersion.ts
  components/ GradePicker, Stepper, SegmentedControl, ProjectCard, SessionCard, BarChart, modals, ...
  i18n/      fi.ts (Finnish strings; English jargon)
  backup/    exportImport.ts
  hooks/     use-db-query.ts, use-theme.ts, ...
```

## Commands

> NOTE: the user's global `~/.npmrc` sets `workspaces=true`, which breaks npm/npx/`create-expo-app`
> in a non-workspace repo. Prefix npm/npx commands with `npm_config_workspaces=false` (or
> `$env:npm_config_workspaces='false'` in PowerShell) when they fail with an ENOENT for a
> missing root `package.json`.

- **Run:** `npx expo start` → open in Expo Go (phone) or an Android/iOS simulator.
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`).
- **Unit tests:** `npm test` (Jest; covers `src/domain/grades.ts` and `stats.ts`).
- **Bundle check (no device):** `npx expo export --platform android --output-dir dist-check`.
- **Lint:** `npm run lint` (`expo lint`).
- **Android APK:** see **[BUILD.md](BUILD.md)**. Short version: native `android/` is generated
  (gitignored) via `expo prebuild`; the build needs a **JDK 17 toolchain** (`JAVA_HOME` →
  JDK 17, or set `org.gradle.java.installations.paths` + `auto-download=false` in
  `gradle.properties`), then `cd android && ./gradlew assembleRelease`. Output:
  `android/app/build/outputs/apk/release/app-release.apk` (debug-signed, sideload-only).

## Conventions to preserve

- **Data access:** mutate through `src/db/repositories/*`, then call `bumpData()` so screens
  using `useDbQuery` refresh. Don't query drizzle directly from screens for writes.
- **Grades:** boulder uses Font/V (Font default, with Font↔V conversion in `grades.ts`, marked
  approximate); sport uses the French scale. Stats union sends + sent projects.
- **i18n:** add UI strings to `src/i18n/fi.ts`; keep climbing jargon in English.
- Secrets stay out of version control: `.env*` and `*.key` are gitignored. Keep credentials in
  environment files, never hardcoded.
