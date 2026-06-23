import { desc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import type { Discipline, GradeSystem } from '@/domain/types';
import { db } from '../client';
import { sendLogs } from '../schema';

export interface NewSend {
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count?: number;
  flash?: boolean;
  notes?: string | null;
}

export function listSendsForSession(sessionId: number) {
  return db
    .select()
    .from(sendLogs)
    .where(eq(sendLogs.sessionId, sessionId))
    .orderBy(desc(sendLogs.createdAt))
    .all();
}

export function addSend(send: NewSend): number {
  const res = db
    .insert(sendLogs)
    .values({
      sessionId: send.sessionId,
      discipline: send.discipline,
      gradeSystem: send.gradeSystem,
      gradeValue: send.gradeValue,
      count: send.count ?? 1,
      flash: send.flash ?? false,
      notes: send.notes ?? null,
      createdAt: nowIso(),
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function updateSend(
  id: number,
  fields: { count?: number; flash?: boolean; gradeValue?: string; notes?: string | null },
): void {
  db.update(sendLogs).set(fields).where(eq(sendLogs.id, id)).run();
}

export function deleteSend(id: number): void {
  db.delete(sendLogs).where(eq(sendLogs.id, id)).run();
}

/** Kaikki sendit (tilastoja varten). */
export function allSends() {
  return db.select().from(sendLogs).all();
}
