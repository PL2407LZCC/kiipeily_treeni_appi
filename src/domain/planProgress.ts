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
 * arvoon. Nousu jaetaan osuviin tavoitteisiin kapasiteettitietoisella ahneella jaolla
 * (tarkin ensin, tasapelissä eniten tilaa jäljellä ensin), joten erilliset variantit eivät
 * tuplaannu MUTTA täysi tarkka variantti ei estä yhtä lailla osuvaa yleisempää tavoitetta.
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

/**
 * Kohteet, joihin nousu (grade, holdType, steepness) osuu — tarkin (eniten rajattuja
 * ulottuvuuksia) ensin. Tavoitteen null-ulottuvuus = jokeri (osuu kaikkeen).
 */
function matchingTargets(
  targets: PlanGradeTarget[],
  grade: string,
  holdType: HoldType | null,
  steepness: Steepness | null,
  dims: PlanDims,
): PlanGradeTarget[] {
  return targets
    .filter((t) => targetMatches(t, grade, holdType, steepness, dims))
    .sort((a, b) => specificity(b, dims) - specificity(a, dims));
}

/**
 * Nykyiset effort-määrät tavoitetta kohden, kapasiteettitietoisella ahneella jaolla.
 * Jokainen effort sijoitetaan osuviin tavoitteisiin: rajatuimmat effortit (vähiten
 * osumia) ensin, kukin täytetään tarkin ensin ja tasapelissä eniten tilaa jäljellä
 * ensin. Näin täysi tarkka variantti EI estä yhtä yleistä — esim. "5 crimpy" kelpaa
 * vaikka "5 vertical" olisi jo täynnä (sama nousu osuu molempiin samalla tarkkuudella).
 * Ylimäärä kirjataan tarkimmalle osumalle (näkyy 'over'na). Avain = tavoitteen tarkka
 * dimsKey. Vain plan.discipline-lajin efforts.
 */
function currentByTarget(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
  targets: PlanGradeTarget[],
): Map<string, number> {
  const dims = planDims(plan);
  const keyOf = (t: PlanGradeTarget) => dimsKey(t.grade, t.holdType, t.steepness, dims);
  const cur = new Map<string, number>();
  for (const t of targets) cur.set(keyOf(t), 0);

  // Esikäsittele: muunna aste + laske osuvat tavoitteet kullekin effortille.
  const items: { count: number; matches: PlanGradeTarget[] }[] = [];
  for (const e of efforts) {
    if (e.discipline !== plan.discipline) continue;
    const grade = convert(e.gradeValue, e.gradeSystem, displaySystem);
    if (grade == null) continue;
    const matches = matchingTargets(targets, grade, e.holdType, e.steepness, dims);
    if (matches.length === 0) continue;
    items.push({ count: e.count, matches });
  }
  // Rajatuimmat (vähiten osumia) ensin, jotta ne ehtivät varata ainoan kotinsa
  // ennen kuin joustavammat (useaan osuvat) effortit kuluttavat tilan.
  items.sort((a, b) => a.matches.length - b.matches.length);

  for (const it of items) {
    let remaining = it.count;
    // Täytä tarkin ensin; tasapelissä eniten tilaa jäljellä ensin (kapasiteettitietoinen).
    const order = [...it.matches].sort((a, b) => {
      const ds = specificity(b, dims) - specificity(a, dims);
      if (ds !== 0) return ds;
      const ra = a.target - (cur.get(keyOf(a)) ?? 0);
      const rb = b.target - (cur.get(keyOf(b)) ?? 0);
      return rb - ra;
    });
    for (const t of order) {
      if (remaining <= 0) break;
      const k = keyOf(t);
      const room = Math.max(0, t.target - (cur.get(k) ?? 0));
      const put = Math.min(room, remaining);
      cur.set(k, (cur.get(k) ?? 0) + put);
      remaining -= put;
    }
    // Ylimäärä (kaikki osumat täynnä) tarkimmalle osumalle → näkyy 'over'na.
    if (remaining > 0) {
      const k = keyOf(it.matches[0]);
      cur.set(k, (cur.get(k) ?? 0) + remaining);
    }
  }
  return cur;
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
 * - muuten: mahtuuko addCount osuvien tavoitteiden YHTEENLASKETTUUN jäljellä olevaan
 *   tilaan? Jos ei → 'over', muuten 'ok'. Näin täysi tarkka variantti ei estä kirjausta,
 *   jos jokin yhtä lailla osuva (yleisempi) tavoite ottaa nousun vielä vastaan.
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
  const matches = matchingTargets(targets, grade, holdType, steepness, dims);
  if (matches.length === 0) return 'offplan';

  const cur = currentByTarget(plan, efforts, displaySystem, targets);
  let remainingCapacity = 0;
  for (const t of matches) {
    const key = dimsKey(t.grade, t.holdType, t.steepness, dims);
    remainingCapacity += Math.max(0, t.target - (cur.get(key) ?? 0));
  }
  return addCount > remainingCapacity ? 'over' : 'ok';
}
