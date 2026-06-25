/**
 * Suunnitelman edistyminen + pehmeä enforcement (puhtaita funktioita).
 *
 * Guided-session (PR6): kun aktiivisella sessiolla on suunnitelma, näytetään
 * astekohtainen edistyminen (efforts vs. tavoite) ja varoitetaan-mutta-sallitaan,
 * kun kirjaus ylittäisi tavoitteen tai kirjaisi suunnitelmaan kuulumattoman asteen.
 *
 * Tavoitteet pidetään LOGATUSSA järjestelmässä (PlanTarget.gradeSystem); vertailua
 * varten ne normalisoidaan näyttöasteikkoon `convert`illa (likimääräinen — null jätetään
 * pois, jolloin kyseistä astetta ei varoiteta).
 *
 * Ulottuvuudet (dims): jos suunnitelma seuraa otetyyppiä ja/tai jyrkkyyttä, avain on
 * (normalisoitu aste [, holdType] [, steepness]) — sama aste eri ulottuvuusarvoilla on
 * erillinen tavoite ja erillinen edistymisrivi (null on oma varianttinsa). Pois kytketty
 * ulottuvuus jätetään huomiotta avaimessa.
 */

import { type ClimbEffort } from './aggregate';
import { convert, gradeIndex } from './grades';
import type { Discipline, GradeSystem, HoldType, PlanDims, SessionPlan, Steepness } from './types';

/** Yhdistelmäavain: aste + (käytössä olevat) ulottuvuusarvot. */
function dimsKey(
  grade: string,
  holdType: HoldType | null,
  steepness: Steepness | null,
  dims: PlanDims,
): string {
  const h = dims.holdType ? (holdType ?? '∅') : '*';
  const s = dims.steepness ? (steepness ?? '∅') : '*';
  return `${grade} ${h} ${s}`;
}

/** Suunnitelman dims turvallisesti (vanhat suunnitelmat ilman dims-kenttää). */
function planDims(plan: SessionPlan): PlanDims {
  return plan.dims ?? { holdType: false, steepness: false };
}

export interface PlanGradeTarget {
  grade: string;
  holdType: HoldType | null;
  steepness: Steepness | null;
  target: number;
}

/**
 * Normalisoi suunnitelman tavoitteet näyttöasteikkoon, avaimena
 * (aste [, holdType] [, steepness]). Muunnoksen epäonnistuessa (null) tavoite ohitetaan.
 */
export function planTargetsByGrade(
  plan: SessionPlan,
  displaySystem: GradeSystem,
): Map<string, PlanGradeTarget> {
  const dims = planDims(plan);
  const map = new Map<string, PlanGradeTarget>();
  for (const t of plan.targets) {
    const grade = convert(t.gradeValue, t.gradeSystem, displaySystem);
    if (grade == null) continue;
    const holdType = dims.holdType ? (t.holdType ?? null) : null;
    const steepness = dims.steepness ? (t.steepness ?? null) : null;
    const key = dimsKey(grade, holdType, steepness, dims);
    const existing = map.get(key);
    if (existing) existing.target += t.target;
    else map.set(key, { grade, holdType, steepness, target: t.target });
  }
  return map;
}

/**
 * Nykyiset effort-määrät avaimena (aste [, holdType] [, steepness]). Aste normalisoidaan
 * näyttöasteikkoon; muuntumattomat ohitetaan. Vain plan.discipline-lajin efforts lasketaan.
 */
function currentByKey(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
): Map<string, number> {
  const dims = planDims(plan);
  const map = new Map<string, number>();
  for (const e of efforts) {
    if (e.discipline !== plan.discipline) continue;
    const grade = convert(e.gradeValue, e.gradeSystem, displaySystem);
    if (grade == null) continue;
    const key = dimsKey(grade, e.holdType, e.steepness, dims);
    map.set(key, (map.get(key) ?? 0) + e.count);
  }
  return map;
}

export interface PlanProgressRow {
  grade: string;
  holdType: HoldType | null;
  steepness: Steepness | null;
  current: number;
  target: number;
}

/**
 * Astekohtainen (ja ulottuvuuskohtainen) edistyminen: jokaiselle suunnitelman tavoitteelle
 * nykyinen effort-määrä vs. tavoite. Lajiteltu helpoimmasta vaikeimpaan.
 */
export function planProgress(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
): PlanProgressRow[] {
  const dims = planDims(plan);
  const targets = planTargetsByGrade(plan, displaySystem);
  const current = currentByKey(plan, efforts, displaySystem);

  return [...targets.values()]
    .map((t) => ({
      grade: t.grade,
      holdType: t.holdType,
      steepness: t.steepness,
      target: t.target,
      current: current.get(dimsKey(t.grade, t.holdType, t.steepness, dims)) ?? 0,
    }))
    .sort((a, b) => gradeIndex(a.grade, displaySystem) - gradeIndex(b.grade, displaySystem));
}

export type LogVerdict = 'ok' | 'over' | 'offplan';

/**
 * Arvioi kirjaus suunnitelmaa vasten ENNEN insertointia.
 * - eri laji kuin suunnitelma → 'ok' (suunnitelma ei koske tätä).
 * - aste ei muunnu näyttöasteikkoon (null) → 'ok' (ei voida verrata → ei varoiteta).
 * - (aste [, holdType] [, steepness]) ei ole suunnitelmassa → 'offplan'.
 * - muuten current + addCount > target → 'over', muuten 'ok'.
 *
 * holdType/steepness ovat logattavan nousun arvot; niitä käytetään vain jos plan.dims
 * kyseisen ulottuvuuden ottaa huomioon.
 */
export function evaluateLog(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  discipline: Discipline,
  displaySystem: GradeSystem,
  gradeSystem: GradeSystem,
  gradeValue: string,
  addCount: number,
  holdType: HoldType | null = null,
  steepness: Steepness | null = null,
): LogVerdict {
  if (discipline !== plan.discipline) return 'ok';
  const grade = convert(gradeValue, gradeSystem, displaySystem);
  if (grade == null) return 'ok';

  const dims = planDims(plan);
  const key = dimsKey(grade, holdType, steepness, dims);

  const targets = planTargetsByGrade(plan, displaySystem);
  const target = targets.get(key);
  if (!target) return 'offplan';

  const current = currentByKey(plan, efforts, displaySystem).get(key) ?? 0;
  return current + addCount > target.target ? 'over' : 'ok';
}
