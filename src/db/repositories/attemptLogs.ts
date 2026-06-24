/**
 * Irralliset yritykset (attempt_logs): epäonnistuneet yritykset johonkin asteeseen
 * ilman projektia. Rinnakkainen Sends-repolle; ei mukana tilastoissa (pyramidi/volyymi
 * laskevat vain sendit + lähetetyt projektit).
 */

import { desc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import type { Discipline, GradeSystem } from '@/domain/types';
import { db } from '../client';
import { attemptLogs } from '../schema';

export interface NewAttemptLog {
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count?: number;
  notes?: string | null;
}

export function listAttemptLogsForSession(sessionId: number) {
  return db
    .select()
    .from(attemptLogs)
    .where(eq(attemptLogs.sessionId, sessionId))
    .orderBy(desc(attemptLogs.createdAt))
    .all();
}

export function addAttemptLog(a: NewAttemptLog): number {
  const res = db
    .insert(attemptLogs)
    .values({
      sessionId: a.sessionId,
      discipline: a.discipline,
      gradeSystem: a.gradeSystem,
      gradeValue: a.gradeValue,
      count: a.count ?? 1,
      notes: a.notes ?? null,
      createdAt: nowIso(),
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function deleteAttemptLog(id: number): void {
  db.delete(attemptLogs).where(eq(attemptLogs.id, id)).run();
}

/** Kaikki irralliset yritykset (varmuuskopiointia varten). */
export function allAttemptLogs() {
  return db.select().from(attemptLogs).all();
}
