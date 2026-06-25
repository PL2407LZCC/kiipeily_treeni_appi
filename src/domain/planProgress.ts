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
 * arvoon. Koska sama nousu voi osua useaan tavoitteeseen (ristikkäiset jokerit), nousut
 * sijoitetaan tavoitteisiin OPTIMAALISESTI maksimivirtauksella — ei ahneesti. Näin joustava
 * nousu ohjautuu pois jäykemmän tieltä (crimpy-vertical → "crimpy", jotta "vertical" jää
 * slopy-verticalille), eivätkä variantit tuplaannu eivätkä lukkiudu väärin.
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

/**
 * Nousu-ryhmä: yksi (aste, otetyyppi, jyrkkyys) -yhdistelmä summattuna + indeksit niihin
 * tavoitteisiin joihin se osuu. Ryhmät, jotka eivät osu mihinkään tavoitteeseen, jätetään
 * pois (suunnitelman ulkopuolisia; eivät kerrytä mitään).
 */
interface ClimbGroup {
  count: number;
  matches: number[];
}

/** Ryhmittele effortit näyttöasteikossa (aste, otetyyppi, jyrkkyys) ja liitä osuvat tavoitteet. */
function buildGroups(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
  targets: PlanGradeTarget[],
  dims: PlanDims,
): ClimbGroup[] {
  const byKey = new Map<string, { grade: string; holdType: HoldType | null; steepness: Steepness | null; count: number }>();
  for (const e of efforts) {
    if (e.discipline !== plan.discipline) continue;
    const grade = convert(e.gradeValue, e.gradeSystem, displaySystem);
    if (grade == null) continue;
    const k = `${grade}|${e.holdType ?? ''}|${e.steepness ?? ''}`;
    const g = byKey.get(k) ?? { grade, holdType: e.holdType, steepness: e.steepness, count: 0 };
    g.count += e.count;
    byKey.set(k, g);
  }
  const groups: ClimbGroup[] = [];
  for (const g of byKey.values()) {
    const matches: number[] = [];
    targets.forEach((t, i) => {
      if (targetMatches(t, g.grade, g.holdType, g.steepness, dims)) matches.push(i);
    });
    if (matches.length > 0) groups.push({ count: g.count, matches });
  }
  return groups;
}

/**
 * Sijoita nousu-ryhmät tavoitteisiin OPTIMAALISESTI (maksimivirtaus). Ahne jako ei riitä:
 * sama nousu voi osua useaan tavoitteeseen, ja joustava nousu pitää ohjata niin, ettei se
 * vie paikkaa jäykemmältä (esim. crimpy-vertical → "crimpy", jotta "vertical" jää slopy-
 * verticalille). Palauttaa sijoitetun kokonaismäärän + per-tavoite sisäänvirtauksen (≤ tavoite).
 */
function placeClimbs(
  groups: ClimbGroup[],
  targets: PlanGradeTarget[],
): { placed: number; byTarget: number[] } {
  const G = groups.length;
  const T = targets.length;
  const source = 0;
  const sink = 1 + G + T;
  const N = sink + 1;
  const total = groups.reduce((s, g) => s + g.count, 0);
  const INF = total + 1; // riittävä "ääretön" (kokonaismäärää suurempi)

  // Jäännöskapasiteettimatriisi.
  const cap: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let i = 0; i < G; i++) {
    cap[source][1 + i] = groups[i].count;
    for (const t of groups[i].matches) cap[1 + i][1 + G + t] = INF;
  }
  for (let j = 0; j < T; j++) cap[1 + G + j][sink] = targets[j].target;

  // Edmonds–Karp (BFS-lisäyspolut). Graafi on pieni → tehokkuus ei ole ongelma.
  let placed = 0;
  for (;;) {
    const parent = new Array<number>(N).fill(-1);
    parent[source] = source;
    const queue = [source];
    while (queue.length) {
      const u = queue.shift() as number;
      for (let v = 0; v < N; v++) {
        if (parent[v] === -1 && cap[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[sink] === -1) break;
    let bottleneck = INF;
    for (let v = sink; v !== source; v = parent[v]) bottleneck = Math.min(bottleneck, cap[parent[v]][v]);
    for (let v = sink; v !== source; v = parent[v]) {
      cap[parent[v]][v] -= bottleneck;
      cap[v][parent[v]] += bottleneck;
    }
    placed += bottleneck;
  }

  // Per-tavoite sisäänvirtaus = alkuperäinen kapasiteetti − jäljellä oleva (tavoite→sink).
  const byTarget = targets.map((t, j) => t.target - cap[1 + G + j][sink]);
  return { placed, byTarget };
}

/**
 * Nykyiset effort-määrät tavoitetta kohden (optimaalinen sijoitus). Avain = tavoitteen
 * tarkka dimsKey. Vain plan.discipline-lajin efforts; suunnitelman ulkopuoliset jäävät pois.
 */
function currentByTarget(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
  targets: PlanGradeTarget[],
): Map<string, number> {
  const dims = planDims(plan);
  const groups = buildGroups(plan, efforts, displaySystem, targets, dims);
  const { byTarget } = placeClimbs(groups, targets);
  const cur = new Map<string, number>();
  targets.forEach((t, j) => {
    cur.set(dimsKey(t.grade, t.holdType, t.steepness, dims), byTarget[j]);
  });
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

  // Mihin tavoitteisiin uusi nousu osuisi? Ei yhtään → suunnitelman ulkopuolinen.
  const newMatches: number[] = [];
  targets.forEach((t, i) => {
    if (targetMatches(t, grade, holdType, steepness, dims)) newMatches.push(i);
  });
  if (newMatches.length === 0) return 'offplan';

  // Vertaa optimaalista sijoitusta ilman ja kanssa uutta nousua: jos lisäys kasvattaa
  // sijoittamatta jäävää ylimäärää, nousu ei mahdu mihinkään osuvaan tavoitteeseen → 'over'.
  // (Optimaalinen jako ohjaa joustavat nousut pois jäykempien tieltä, joten täysi tarkka
  // variantti ei estä kirjausta, jos jokin osuva tavoite ottaa sen vielä vastaan.)
  const groups = buildGroups(plan, efforts, displaySystem, targets, dims);
  const without = placeClimbs(groups, targets);
  const totalWithout = groups.reduce((s, g) => s + g.count, 0);

  const groupsWith = [...groups, { count: addCount, matches: newMatches }];
  const withNew = placeClimbs(groupsWith, targets);
  const totalWith = totalWithout + addCount;

  const overflowWithout = totalWithout - without.placed;
  const overflowWith = totalWith - withNew.placed;
  return overflowWith > overflowWithout ? 'over' : 'ok';
}
