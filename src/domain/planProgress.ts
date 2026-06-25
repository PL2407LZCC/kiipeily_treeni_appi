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
 * Ulottuvuudet (dims): jos suunnitelma seuraa otetyyppiä ja/tai jyrkkyyttä, tavoitteet
 * voivat eritellä saman asteen ulottuvuusarvon mukaan. Tavoitteen ulottuvuusarvo on joko
 * tietty arvo TAI **null = "ei rajattu" (jokeri)**, joka osuu mihin tahansa logatun nousun
 * arvoon. Nousu lasketaan TARKIMMAN osuvan tavoitteen hyväksi (eniten ei-null-arvoja),
 * jolloin erilliset variantit eivät tuplaannu.
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

/** Osuuko tavoite logattuun nousuun? Tavoitteen null-ulottuvuus = jokeri (osuu kaikkeen). */
function targetMatches(
  t: PlanGradeTarget,
  grade: string,
  holdType: HoldType | null,
  steepness: Steepness | null,
  dims: PlanDims,
): boolean {
  if (t.grade !== grade) return false;
  if (dims.holdType && t.holdType != null && t.holdType !== holdType) return false;
  if (dims.steepness && t.steepness != null && t.steepness !== steepness) return false;
  return true;
}

/** Tarkkuus = montako käytössä olevaa ulottuvuutta on rajattu (ei-null). */
function specificity(t: PlanGradeTarget, dims: PlanDims): number {
  return (
    (dims.holdType && t.holdType != null ? 1 : 0) +
    (dims.steepness && t.steepness != null ? 1 : 0)
  );
}

/** Tarkin osuva tavoite (eniten rajattuja ulottuvuuksia), tai null jos mikään ei osu. */
function bestTarget(
  targets: PlanGradeTarget[],
  grade: string,
  holdType: HoldType | null,
  steepness: Steepness | null,
  dims: PlanDims,
): PlanGradeTarget | null {
  let best: PlanGradeTarget | null = null;
  let bestSpec = -1;
  for (const t of targets) {
    if (!targetMatches(t, grade, holdType, steepness, dims)) continue;
    const s = specificity(t, dims);
    if (s > bestSpec) {
      best = t;
      bestSpec = s;
    }
  }
  return best;
}

/**
 * Nykyiset effort-määrät tavoitetta kohden. Jokainen effort lasketaan TARKIMMAN osuvan
 * tavoitteen hyväksi. Avain = tavoitteen tarkka dimsKey. Vain plan.discipline-lajin efforts.
 */
function currentByTarget(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
  targets: PlanGradeTarget[],
): Map<string, number> {
  const dims = planDims(plan);
  const map = new Map<string, number>();
  for (const e of efforts) {
    if (e.discipline !== plan.discipline) continue;
    const grade = convert(e.gradeValue, e.gradeSystem, displaySystem);
    if (grade == null) continue;
    const t = bestTarget(targets, grade, e.holdType, e.steepness, dims);
    if (!t) continue;
    const key = dimsKey(t.grade, t.holdType, t.steepness, dims);
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
  const targets = [...planTargetsByGrade(plan, displaySystem).values()];
  const current = currentByTarget(plan, efforts, displaySystem, targets);

  return targets
    .map((t) => ({
      grade: t.grade,
      holdType: t.holdType,
      steepness: t.steepness,
      target: t.target,
      current: current.get(dimsKey(t.grade, t.holdType, t.steepness, dims)) ?? 0,
    }))
    .sort((a, b) => gradeIndex(a.grade, displaySystem) - gradeIndex(b.grade, displaySystem));
}

/**
 * Asteet (näyttöasteikossa), joilla on vielä tilaa tavoitteeseen — exact-tilan
 * astesuodatusta varten. Aste on "auki", jos jokin sen varianteista on vajaa
 * (current < target); kun kaikki variantit ovat täynnä, aste poistuu valikosta.
 */
export function openGrades(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
): Set<string> {
  const open = new Set<string>();
  for (const r of planProgress(plan, efforts, displaySystem)) {
    if (r.current < r.target) open.add(r.grade);
  }
  return open;
}

export type LogVerdict = 'ok' | 'over' | 'offplan';

/**
 * Arvioi kirjaus suunnitelmaa vasten ENNEN insertointia.
 * - eri laji kuin suunnitelma → 'ok' (suunnitelma ei koske tätä).
 * - aste ei muunnu näyttöasteikkoon (null) → 'ok' (ei voida verrata → ei varoiteta).
 * - mikään tavoite ei osu (aste + ulottuvuudet, null-jokeri huomioiden) → 'offplan'.
 * - muuten tarkimman osuvan tavoitteen current + addCount > target → 'over', muuten 'ok'.
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
  const targets = [...planTargetsByGrade(plan, displaySystem).values()];
  const t = bestTarget(targets, grade, holdType, steepness, dims);
  if (!t) return 'offplan';

  const key = dimsKey(t.grade, t.holdType, t.steepness, dims);
  const current = currentByTarget(plan, efforts, displaySystem, targets).get(key) ?? 0;
  return current + addCount > t.target ? 'over' : 'ok';
}
