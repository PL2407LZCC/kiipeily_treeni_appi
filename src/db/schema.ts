/**
 * Tietokantaskeema (drizzle-orm / expo-sqlite).
 *
 * Ydin: sendit ja projektit ovat erillisiä entiteettejä, mikä vastaa
 * "vaihda projecting-tilaan" -käyttöliittymää. Projekti voidaan lähettää
 * samassa sessiossa tai kerätä yrityksiä useamman session yli.
 */

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type {
  Discipline,
  GradeSystem,
  HiddenGrades,
  HoldType,
  ProjectStatus,
  SessionEnvironment,
  Steepness,
  SupplementalKind,
} from '@/domain/types';

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // ISO-päivä YYYY-MM-DD
  location: text('location'),
  theme: text('theme'), // valittu teema-nimi (session_themes), valinnainen
  environment: text('environment').$type<SessionEnvironment>(), // indoor | outdoor | null
  notes: text('notes'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  plan: text('plan'), // SessionPlan JSON-merkkijonona, valinnainen (guided sessions)
});

/** Valittavissa olevat session teemat (oletukset + käyttäjän lisäämät). */
export const sessionThemes = sqliteTable('session_themes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull(),
});

export const sendLogs = sqliteTable(
  'send_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    discipline: text('discipline').$type<Discipline>().notNull(), // boulder | sport
    gradeSystem: text('grade_system').$type<GradeSystem>().notNull(), // font | v | french
    gradeValue: text('grade_value').notNull(),
    count: integer('count').notNull().default(1),
    flash: integer('flash', { mode: 'boolean' }).notNull().default(false),
    holdType: text('hold_type').$type<HoldType>(), // crimpy | slopy | null
    steepness: text('steepness').$type<Steepness>(), // slab | overhang | null
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_send_logs_session').on(t.sessionId)],
);

/**
 * Irralliset yritykset: epäonnistuneet (tai vielä lähettämättömät) yritykset
 * johonkin asteeseen ILMAN projektia. Kirjataan astenapin pitkällä painalluksella,
 * kun "vain kiipeillään" eikä projektoida tiettyä nousua. Rinnakkainen send_logsille.
 */
export const attemptLogs = sqliteTable(
  'attempt_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    discipline: text('discipline').$type<Discipline>().notNull(), // boulder | sport
    gradeSystem: text('grade_system').$type<GradeSystem>().notNull(), // font | v | french
    gradeValue: text('grade_value').notNull(),
    count: integer('count').notNull().default(1),
    holdType: text('hold_type').$type<HoldType>(), // crimpy | slopy | null
    steepness: text('steepness').$type<Steepness>(), // slab | overhang | null
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_attempt_logs_session').on(t.sessionId)],
);

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  discipline: text('discipline').$type<Discipline>().notNull(),
  gradeSystem: text('grade_system').$type<GradeSystem>().notNull(),
  gradeValue: text('grade_value').notNull(),
  status: text('status').$type<ProjectStatus>().notNull().default('active'), // active | sent | abandoned | archived
  location: text('location'),
  holdType: text('hold_type').$type<HoldType>(), // crimpy | slopy | null
  steepness: text('steepness').$type<Steepness>(), // slab | overhang | null
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  sentAt: text('sent_at'),
});

export const projectAttempts = sqliteTable(
  'project_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    attemptCount: integer('attempt_count').notNull().default(1),
    sent: integer('sent', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_attempts_project').on(t.projectId),
    index('idx_attempts_session').on(t.sessionId),
  ],
);

export const supplementalEntries = sqliteTable('supplemental_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').$type<SupplementalKind>().notNull(), // strength | endurance | other
  sets: integer('sets'),
  reps: integer('reps'),
  weight: real('weight'),
  durationSec: integer('duration_sec'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

/**
 * Tallennetut treenisuunnitelmamallit (templates). Targetit JSON-merkkijonona.
 * Toisin kuin sessions.plan (yksi sessio), nämä ovat uudelleenkäytettäviä.
 */
export const trainingPlans = sqliteTable('training_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  discipline: text('discipline').$type<Discipline>().notNull(), // boulder | sport
  theme: text('theme'),
  environment: text('environment').$type<SessionEnvironment>(), // indoor | outdoor | null
  targets: text('targets').notNull(), // PlanTarget[] JSON-merkkijonona
  createdAt: text('created_at').notNull(),
});

/** Yksirivinen asetustaulu (id = 1). */
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  boulderDefaultSystem: text('boulder_default_system')
    .$type<GradeSystem>()
    .notNull()
    .default('font'),
  showSecondaryGrade: integer('show_secondary_grade', { mode: 'boolean' })
    .notNull()
    .default(true),
  trackHoldType: integer('track_hold_type', { mode: 'boolean' })
    .notNull()
    .default(false),
  trackSteepness: integer('track_steepness', { mode: 'boolean' })
    .notNull()
    .default(false),
  hiddenGrades: text('hidden_grades', { mode: 'json' })
    .$type<HiddenGrades>()
    .notNull()
    .default(sql`'{}'`),
  gradeColumns: integer('grade_columns').notNull().default(4),
  climbTimeSubtractSec: integer('climb_time_subtract_sec').notNull().default(0),
});

/** DDL kaikkien taulujen luomiseen sovelluksen käynnistyessä (idempotentti). */
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    location TEXT,
    theme TEXT,
    environment TEXT,
    notes TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    plan TEXT
  );
  CREATE TABLE IF NOT EXISTS session_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS send_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    grade_system TEXT NOT NULL,
    grade_value TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    flash INTEGER NOT NULL DEFAULT 0,
    hold_type TEXT,
    steepness TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_send_logs_session ON send_logs(session_id);
  CREATE TABLE IF NOT EXISTS attempt_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    grade_system TEXT NOT NULL,
    grade_value TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    hold_type TEXT,
    steepness TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempt_logs_session ON attempt_logs(session_id);
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    discipline TEXT NOT NULL,
    grade_system TEXT NOT NULL,
    grade_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    location TEXT,
    hold_type TEXT,
    steepness TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  );
  CREATE TABLE IF NOT EXISTS project_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    sent INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_project ON project_attempts(project_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_session ON project_attempts(session_id);
  CREATE TABLE IF NOT EXISTS supplemental_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    sets INTEGER,
    reps INTEGER,
    weight REAL,
    duration_sec INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS training_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    discipline TEXT NOT NULL,
    theme TEXT,
    environment TEXT,
    targets TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    boulder_default_system TEXT NOT NULL DEFAULT 'font',
    show_secondary_grade INTEGER NOT NULL DEFAULT 1,
    track_hold_type INTEGER NOT NULL DEFAULT 0,
    track_steepness INTEGER NOT NULL DEFAULT 0,
    hidden_grades TEXT NOT NULL DEFAULT '{}',
    grade_columns INTEGER NOT NULL DEFAULT 4,
    climb_time_subtract_sec INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO app_settings (id, boulder_default_system, show_secondary_grade)
    VALUES (1, 'font', 1);
`;
