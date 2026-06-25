/**
 * Tallennetut treenisuunnitelmamallit (templates). Toisin kuin sessions.plan
 * (yhden session JSON), nämä elävät training_plans-taulussa ja niistä voi aloittaa
 * uusia sessioita. Targetit talletetaan JSON-merkkijonona.
 */

import { desc, eq } from 'drizzle-orm';

import { nowIso } from '@/domain/dates';
import {
  DEFAULT_PLAN_DIMS,
  type Discipline,
  type PlanDims,
  type PlanTarget,
  type SessionEnvironment,
  type TrainingPlanTemplate,
} from '@/domain/types';
import { db } from '../client';
import { trainingPlans } from '../schema';

/**
 * Sisäinen rivi → domain-tyyppi (parsii targets-JSONin). Tukee kahta muotoa:
 *  - vanha: pelkkä PlanTarget[] (ennen dims-ominaisuutta) → dims oletetaan pois päältä.
 *  - uusi:  { dims, targets } -objekti.
 */
function toTemplate(row: typeof trainingPlans.$inferSelect): TrainingPlanTemplate {
  let targets: PlanTarget[] = [];
  let dims: PlanDims = { ...DEFAULT_PLAN_DIMS };
  try {
    const parsed = JSON.parse(row.targets);
    if (Array.isArray(parsed)) {
      targets = parsed as PlanTarget[];
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.targets)) {
      targets = parsed.targets as PlanTarget[];
      if (parsed.dims && typeof parsed.dims === 'object') {
        dims = {
          holdType: !!parsed.dims.holdType,
          steepness: !!parsed.dims.steepness,
        };
      }
    }
  } catch {
    targets = [];
  }
  return {
    id: row.id,
    name: row.name,
    discipline: row.discipline,
    theme: row.theme,
    environment: row.environment,
    dims,
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
  dims: PlanDims;
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
      // dims + targets tallennetaan yhtenä objektina (back-compat luetaan toTemplatessa).
      targets: JSON.stringify({ dims: t.dims, targets: t.targets }),
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
