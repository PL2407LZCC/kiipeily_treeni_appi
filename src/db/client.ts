/**
 * Tietokantayhteys: expo-sqlite + drizzle-orm.
 *
 * Taulut luodaan käynnistyksessä idempotentilla DDL:llä (CREATE TABLE IF NOT EXISTS)
 * — kevyt korvike migraatioille yhden laitteen offline-MVP:ssä.
 * Change listener on päällä, jotta drizzlen useLiveQuery päivittyy automaattisesti.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { nowIso } from '@/domain/dates';
import * as schema from './schema';

/** Session-teemojen oletukset (kylvetään kerran, jos lista on tyhjä). */
const DEFAULT_THEMES = ['Endurance', 'Strength', 'Power'];

export const DATABASE_NAME = 'kiipeily.db';

export const sqlite = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });

let initialized = false;

/**
 * Lisää sarakkeen olemassa olevaan tauluun, jos se puuttuu (idempotentti).
 * Kevyt korvike migraatioille: CREATE TABLE IF NOT EXISTS ei lisää sarakkeita
 * jo luotuun tauluun, joten vanhat asennukset tarvitsevat ALTER TABLEn.
 */
function ensureColumn(table: string, column: string, decl: string): void {
  const cols = sqlite.getAllSync(`PRAGMA table_info(${table});`) as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  sqlite.execSync(`ALTER TABLE ${table} ADD COLUMN ${decl};`);
}

/** Lisää uudemmissa versioissa tulleet sarakkeet vanhoihin tauluihin. */
function runMigrations(): void {
  ensureColumn('send_logs', 'hold_type', 'hold_type TEXT');
  ensureColumn('attempt_logs', 'hold_type', 'hold_type TEXT');
  ensureColumn('projects', 'hold_type', 'hold_type TEXT');
  ensureColumn('app_settings', 'track_hold_type', 'track_hold_type INTEGER NOT NULL DEFAULT 0');
  ensureColumn('send_logs', 'steepness', 'steepness TEXT');
  ensureColumn('attempt_logs', 'steepness', 'steepness TEXT');
  ensureColumn('projects', 'steepness', 'steepness TEXT');
  ensureColumn('app_settings', 'track_steepness', 'track_steepness INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sessions', 'theme', 'theme TEXT');
  ensureColumn('sessions', 'environment', 'environment TEXT');
  ensureColumn('sessions', 'plan', 'plan TEXT');
  ensureColumn('app_settings', 'hidden_grades', "hidden_grades TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('app_settings', 'grade_columns', 'grade_columns INTEGER NOT NULL DEFAULT 4');
  ensureColumn(
    'app_settings',
    'climb_time_subtract_sec',
    'climb_time_subtract_sec INTEGER NOT NULL DEFAULT 0',
  );
}

/** Kylvä oletusteemat vain jos lista on tyhjä (ei palauta käyttäjän poistamia). */
function seedThemes(): void {
  const row = sqlite.getFirstSync('SELECT COUNT(*) AS n FROM session_themes;') as { n: number } | null;
  if (row && row.n > 0) return;
  const now = nowIso();
  for (const name of DEFAULT_THEMES) {
    sqlite.runSync('INSERT OR IGNORE INTO session_themes (name, created_at) VALUES (?, ?);', name, now);
  }
}

/** Luo taulut ja oletusasetukset. Turvallinen kutsua useasti. */
export function initDatabase(): void {
  if (initialized) return;
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  sqlite.execSync(schema.CREATE_TABLES_SQL);
  runMigrations();
  seedThemes();
  initialized = true;
}

// Alusta heti moduulia ladattaessa, jotta taulut ovat olemassa ennen kyselyitä.
initDatabase();
