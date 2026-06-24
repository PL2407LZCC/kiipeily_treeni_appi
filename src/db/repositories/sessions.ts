import { desc, eq, isNull } from 'drizzle-orm';

import { nowIso, todayIso } from '@/domain/dates';
import { db } from '../client';
import { sessions } from '../schema';

/** Avoin (käynnissä oleva) sessio, jos sellainen on. */
export function getActiveSession() {
  const rows = db
    .select()
    .from(sessions)
    .where(isNull(sessions.endedAt))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .all();
  return rows[0];
}

export function getSession(id: number) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function listSessions() {
  return db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.date), desc(sessions.startedAt))
    .all();
}

/** Aloita uusi sessio. Useita sessioita per päivä sallitaan. */
export function startSession(location?: string): number {
  const now = nowIso();
  const res = db
    .insert(sessions)
    .values({
      date: todayIso(),
      location: location?.trim() || null,
      startedAt: now,
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function endSession(id: number): void {
  db.update(sessions).set({ endedAt: nowIso() }).where(eq(sessions.id, id)).run();
}

export function updateSession(
  id: number,
  fields: { date?: string; location?: string | null; notes?: string | null },
): void {
  db.update(sessions).set(fields).where(eq(sessions.id, id)).run();
}

export function deleteSession(id: number): void {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}
