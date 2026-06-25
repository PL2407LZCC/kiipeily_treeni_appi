import { and, desc, eq, sql } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import { db } from '../client';
import { projectAttempts, projects } from '../schema';
import { markProjectSent } from './projects';

/** Tämän session yritysrivi projektille, tai undefined jos ei vielä ole. */
export function getSessionAttempt(projectId: number, sessionId: number) {
  return db
    .select()
    .from(projectAttempts)
    .where(
      and(eq(projectAttempts.projectId, projectId), eq(projectAttempts.sessionId, sessionId)),
    )
    .get();
}

/** Lisää yrityksiä tämän session riville (luo rivin tarvittaessa). Palauttaa uuden summan. */
export function addAttempts(projectId: number, sessionId: number, by = 1): number {
  const existing = getSessionAttempt(projectId, sessionId);
  if (existing) {
    const next = existing.attemptCount + by;
    db.update(projectAttempts)
      .set({ attemptCount: Math.max(0, next) })
      .where(eq(projectAttempts.id, existing.id))
      .run();
    return Math.max(0, next);
  }
  db.insert(projectAttempts)
    .values({
      projectId,
      sessionId,
      attemptCount: Math.max(0, by),
      sent: false,
      createdAt: nowIso(),
    })
    .run();
  return Math.max(0, by);
}

/**
 * Merkitse projekti lähetetyksi tässä sessiossa: varmista session yritysrivi,
 * aseta sen sent=true ja projektin status='sent'.
 */
export function markSentInSession(projectId: number, sessionId: number): void {
  let row = getSessionAttempt(projectId, sessionId);
  if (!row) {
    db.insert(projectAttempts)
      .values({ projectId, sessionId, attemptCount: 1, sent: true, createdAt: nowIso() })
      .run();
  } else {
    db.update(projectAttempts)
      .set({ sent: true })
      .where(eq(projectAttempts.id, row.id))
      .run();
  }
  markProjectSent(projectId);
}

/** Yritysten kokonaismäärä (lifetime) projektille. */
export function lifetimeAttempts(projectId: number): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${projectAttempts.attemptCount}), 0)` })
    .from(projectAttempts)
    .where(eq(projectAttempts.projectId, projectId))
    .get();
  return row?.total ?? 0;
}

/** Montako eri sessiota projektia on työstetty. */
export function sessionsWorked(projectId: number): number {
  const row = db
    .select({ n: sql<number>`count(distinct ${projectAttempts.sessionId})` })
    .from(projectAttempts)
    .where(eq(projectAttempts.projectId, projectId))
    .get();
  return row?.n ?? 0;
}

/** Session yritysrivit + projektin tiedot (session detail / Home). */
export function attemptsForSession(sessionId: number) {
  return db
    .select({
      id: projectAttempts.id,
      projectId: projectAttempts.projectId,
      attemptCount: projectAttempts.attemptCount,
      sent: projectAttempts.sent,
      createdAt: projectAttempts.createdAt,
      projectName: projects.name,
      discipline: projects.discipline,
      gradeSystem: projects.gradeSystem,
      gradeValue: projects.gradeValue,
      holdType: projects.holdType,
      status: projects.status,
    })
    .from(projectAttempts)
    .innerJoin(projects, eq(projectAttempts.projectId, projects.id))
    .where(eq(projectAttempts.sessionId, sessionId))
    .orderBy(desc(projectAttempts.createdAt))
    .all();
}

/**
 * Kaikki project-yritysrivit kaikilta sessioilta + projektin asteen tiedot
 * (vertailutilastoja varten). Mirroroi `attemptsForSession`-liitoksen.
 */
export function allProjectAttemptsWithGrade() {
  return db
    .select({
      sessionId: projectAttempts.sessionId,
      discipline: projects.discipline,
      gradeSystem: projects.gradeSystem,
      gradeValue: projects.gradeValue,
      attemptCount: projectAttempts.attemptCount,
    })
    .from(projectAttempts)
    .innerJoin(projects, eq(projectAttempts.projectId, projects.id))
    .all();
}

export function updateAttempt(id: number, fields: { attemptCount?: number; sent?: boolean }): void {
  db.update(projectAttempts).set(fields).where(eq(projectAttempts.id, id)).run();
}

export function deleteAttempt(id: number): void {
  db.delete(projectAttempts).where(eq(projectAttempts.id, id)).run();
}
