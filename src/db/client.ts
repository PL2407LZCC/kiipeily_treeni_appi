/**
 * Tietokantayhteys: expo-sqlite + drizzle-orm.
 *
 * Taulut luodaan käynnistyksessä idempotentilla DDL:llä (CREATE TABLE IF NOT EXISTS)
 * — kevyt korvike migraatioille yhden laitteen offline-MVP:ssä.
 * Change listener on päällä, jotta drizzlen useLiveQuery päivittyy automaattisesti.
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'kiipeily.db';

export const sqlite = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });

let initialized = false;

/** Luo taulut ja oletusasetukset. Turvallinen kutsua useasti. */
export function initDatabase(): void {
  if (initialized) return;
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  sqlite.execSync(schema.CREATE_TABLES_SQL);
  initialized = true;
}

// Alusta heti moduulia ladattaessa, jotta taulut ovat olemassa ennen kyselyitä.
initDatabase();
