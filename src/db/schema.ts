/**
 * Tietokantaskeema (drizzle-orm / expo-sqlite).
 *
 * Ydin: sendit ja projektit ovat erillisiä entiteettejä, mikä vastaa
 * "vaihda projecting-tilaan" -käyttöliittymää. Projekti voidaan lähettää
 * samassa sessiossa tai kerätä yrityksiä useamman session yli.
 */

import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type {
  Discipline,
  GradeSystem,
  ProjectStatus,
  SupplementalKind,
} from '@/domain/types';

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // ISO-päivä YYYY-MM-DD
  location: text('location'),
  notes: text('notes'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
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
});

/** DDL kaikkien taulujen luomiseen sovelluksen käynnistyessä (idempotentti). */
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT
  );
  CREATE TABLE IF NOT EXISTS send_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    grade_system TEXT NOT NULL,
    grade_value TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    flash INTEGER NOT NULL DEFAULT 0,
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
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    boulder_default_system TEXT NOT NULL DEFAULT 'font',
    show_secondary_grade INTEGER NOT NULL DEFAULT 1
  );
  INSERT OR IGNORE INTO app_settings (id, boulder_default_system, show_secondary_grade)
    VALUES (1, 'font', 1);
`;
