import { desc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import type { SupplementalKind } from '@/domain/types';
import { db } from '../client';
import { supplementalEntries } from '../schema';

export interface NewSupplemental {
  sessionId: number;
  name: string;
  kind: SupplementalKind;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  durationSec?: number | null;
  notes?: string | null;
}

export function listSupplementalForSession(sessionId: number) {
  return db
    .select()
    .from(supplementalEntries)
    .where(eq(supplementalEntries.sessionId, sessionId))
    .orderBy(desc(supplementalEntries.createdAt))
    .all();
}

export function addSupplemental(e: NewSupplemental): number {
  const res = db
    .insert(supplementalEntries)
    .values({
      sessionId: e.sessionId,
      name: e.name.trim(),
      kind: e.kind,
      sets: e.sets ?? null,
      reps: e.reps ?? null,
      weight: e.weight ?? null,
      durationSec: e.durationSec ?? null,
      notes: e.notes ?? null,
      createdAt: nowIso(),
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function deleteSupplemental(id: number): void {
  db.delete(supplementalEntries).where(eq(supplementalEntries.id, id)).run();
}
