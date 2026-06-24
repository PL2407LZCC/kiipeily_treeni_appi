/**
 * Session-teemat: valittavissa olevat teemat (oletukset + käyttäjän lisäämät).
 * Hallitaan asetuksista; valitaan sessiota aloitettaessa.
 */

import { asc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import { db } from '../client';
import { sessionThemes } from '../schema';

export function listThemes() {
  return db.select().from(sessionThemes).orderBy(asc(sessionThemes.name)).all();
}

/** Lisää teema. Nimi on uniikki — duplikaatti ohitetaan. Palauttaa rivin id:n tai null. */
export function addTheme(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const res = db
    .insert(sessionThemes)
    .values({ name: trimmed, createdAt: nowIso() })
    .onConflictDoNothing({ target: sessionThemes.name })
    .run();
  return res.changes ? Number(res.lastInsertRowId) : null;
}

export function deleteTheme(id: number): void {
  db.delete(sessionThemes).where(eq(sessionThemes.id, id)).run();
}

/** Kaikki teemat (varmuuskopiointia varten). */
export function allThemes() {
  return db.select().from(sessionThemes).all();
}
