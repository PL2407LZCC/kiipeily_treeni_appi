/**
 * Tallennetut treenisuunnitelmamallit (templates). Toisin kuin sessions.plan
 * (yhden session JSON), nämä elävät training_plans-taulussa ja niistä voi aloittaa
 * uusia sessioita. Targetit talletetaan JSON-merkkijonona.
 */

import { desc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import type {
  Discipline,
  PlanTarget,
  SessionEnvironment,
  TrainingPlanTemplate,
} from '@/domain/types';
import { db } from '../client';
import { trainingPlans } from '../schema';

/** Sisäinen rivi → domain-tyyppi (parsii targets-JSONin). */
function toTemplate(row: typeof trainingPlans.$inferSelect): TrainingPlanTemplate {
  let targets: PlanTarget[] = [];
  try {
    const parsed = JSON.parse(row.targets);
    if (Array.isArray(parsed)) targets = parsed as PlanTarget[];
  } catch {
    targets = [];
  }
  return {
    id: row.id,
    name: row.name,
    discipline: row.discipline,
    theme: row.theme,
    environment: row.environment,
    targets,
    createdAt: row.createdAt,
  };
}

/** Kaikki mallit, uusin ensin. */
export function listTemplates(): TrainingPlanTemplate[] {
  return db
    .select()
    .from(trainingPlans)
    .orderBy(desc(trainingPlans.createdAt))
    .all()
    .map(toTemplate);
}

export function getTemplate(id: number): TrainingPlanTemplate | null {
  const row = db.select().from(trainingPlans).where(eq(trainingPlans.id, id)).get();
  return row ? toTemplate(row) : null;
}

export interface NewTemplate {
  name: string;
  discipline: Discipline;
  theme: string | null;
  environment: SessionEnvironment | null;
  targets: PlanTarget[];
}

/** Lisää malli. Palauttaa rivin id:n, tai null jos nimi on tyhjä tai ei tavoitteita. */
export function addTemplate(t: NewTemplate): number | null {
  const name = t.name.trim();
  if (!name || t.targets.length === 0) return null;
  const res = db
    .insert(trainingPlans)
    .values({
      name,
      discipline: t.discipline,
      theme: t.theme,
      environment: t.environment,
      targets: JSON.stringify(t.targets),
      createdAt: nowIso(),
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function deleteTemplate(id: number): void {
  db.delete(trainingPlans).where(eq(trainingPlans.id, id)).run();
}

/** Kaikki rivit raakana (varmuuskopiointia varten). */
export function allTemplates() {
  return db.select().from(trainingPlans).all();
}
