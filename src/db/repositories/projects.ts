import { desc, eq, inArray } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import type { Discipline, GradeSystem, HoldType, ProjectStatus } from '@/domain/types';
import { db } from '../client';
import { projects } from '../schema';

export interface NewProject {
  name?: string | null;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  location?: string | null;
  holdType?: HoldType | null;
  notes?: string | null;
}

export function listProjects(statuses?: ProjectStatus[]) {
  const base = db.select().from(projects);
  const rows = statuses?.length
    ? base.where(inArray(projects.status, statuses)).all()
    : base.all();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Aktiiviset projektit projecting-tilan valitsimeen. */
export function listActiveProjects() {
  return db
    .select()
    .from(projects)
    .where(eq(projects.status, 'active'))
    .orderBy(desc(projects.createdAt))
    .all();
}

export function getProject(id: number) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function createProject(p: NewProject): number {
  const res = db
    .insert(projects)
    .values({
      name: p.name?.trim() || null,
      discipline: p.discipline,
      gradeSystem: p.gradeSystem,
      gradeValue: p.gradeValue,
      status: 'active',
      location: p.location?.trim() || null,
      holdType: p.holdType ?? null,
      notes: p.notes ?? null,
      createdAt: nowIso(),
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function setProjectStatus(id: number, status: ProjectStatus): void {
  db.update(projects)
    .set({ status, sentAt: status === 'sent' ? nowIso() : null })
    .where(eq(projects.id, id))
    .run();
}

export function markProjectSent(id: number): void {
  db.update(projects)
    .set({ status: 'sent', sentAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function updateProject(
  id: number,
  fields: Partial<{
    name: string | null;
    gradeValue: string;
    gradeSystem: GradeSystem;
    location: string | null;
    holdType: HoldType | null;
    notes: string | null;
    status: ProjectStatus;
  }>,
): void {
  db.update(projects).set(fields).where(eq(projects.id, id)).run();
}

export function deleteProject(id: number): void {
  db.delete(projects).where(eq(projects.id, id)).run();
}

/** Lähetetyt projektit tilastoja varten. */
export function allSentProjects() {
  return db.select().from(projects).where(eq(projects.status, 'sent')).all();
}
