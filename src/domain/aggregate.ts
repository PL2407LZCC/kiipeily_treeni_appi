/**
 * Effort-aggregation core (puhtaita funktioita, yksikkötestattavia).
 *
 * Yhtenäinen primitiivi vertailuille ja guided-session-suunnitelmille: jokainen
 * **send JA attempt on yksi "effort" (yritys)** tietyllä asteella. Sama tally
 * kannattelee sekä aikajaksojen vertailua että suunnitelmien lähtötasoa/tavoitteita.
 *
 * Avainpäätökset (ks. plans/training-comparison-and-guided-sessions.md):
 * - efforts (total) per aste = send_logs.count + attempt_logs.count + project_attempts.attemptCount.
 *   Lähetetyn projektin +1:tä EI lisätä tähän (lähetysyritys on jo attemptCountissa).
 * - attempts per aste = attempt_logs.count + project_attempts.attemptCount.
 * - Asteavain pidetään LOGATUSSA järjestelmässä; näyttöasteikkoon muunnetaan vasta
 *   esitystä/vertailua varten (convert on likimääräinen — ei kanonisena avaimena).
 * - Päivä = session.date (kalenteripäivä), yhtenevä timelinen kanssa.
 */

import { gradeIndex, gradesFor } from './grades';
import { gradePyramid, isoWeekStart, type PyramidRow } from './stats';
import type { Discipline, GradeSystem } from './types';

export type EffortKind = 'send' | 'attempt';
export type EffortMetric = 'total' | 'sends' | 'attempts';

/** Yhtenäistetty yritys: yksi send tai attempt jollakin asteella, session päivällä. */
export interface ClimbEffort {
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count: number;
  kind: EffortKind;
  date: string; // session-kalenteripäivä YYYY-MM-DD
  sessionId: number;
}

/* ------------------------- raakarivien normalisointi ------------------------- */

// Minimaaliset syötemuodot — toteutuvat rakenteellisesti SendLog/AttemptLog -riveistä
// ja project_attempts + project -liitoksesta.
export interface SendEffortInput {
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count: number;
}
export type AttemptEffortInput = SendEffortInput;
export interface ProjectAttemptEffortInput {
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  attemptCount: number;
}

export interface BuildEffortsInput {
  sends?: SendEffortInput[];
  attemptLogs?: AttemptEffortInput[];
  projectAttempts?: ProjectAttemptEffortInput[];
}

/**
 * Rakenna efforts-lista raakariveistä. `dateBySession` kartoittaa sessionId → päivä;
 * rivit joiden sessiolle ei löydy päivää ohitetaan.
 */
export function buildEfforts(
  input: BuildEffortsInput,
  dateBySession: Map<number, string>,
): ClimbEffort[] {
  const out: ClimbEffort[] = [];
  for (const s of input.sends ?? []) {
    const date = dateBySession.get(s.sessionId);
    if (date == null) continue;
    out.push({
      discipline: s.discipline,
      gradeSystem: s.gradeSystem,
      gradeValue: s.gradeValue,
      count: s.count,
      kind: 'send',
      date,
      sessionId: s.sessionId,
    });
  }
  for (const a of input.attemptLogs ?? []) {
    const date = dateBySession.get(a.sessionId);
    if (date == null) continue;
    out.push({
      discipline: a.discipline,
      gradeSystem: a.gradeSystem,
      gradeValue: a.gradeValue,
      count: a.count,
      kind: 'attempt',
      date,
      sessionId: a.sessionId,
    });
  }
  for (const p of input.projectAttempts ?? []) {
    const date = dateBySession.get(p.sessionId);
    if (date == null) continue;
    out.push({
      discipline: p.discipline,
      gradeSystem: p.gradeSystem,
      gradeValue: p.gradeValue,
      count: p.attemptCount,
      kind: 'attempt',
      date,
      sessionId: p.sessionId,
    });
  }
  return out;
}

/* ------------------------------- aikajaksot -------------------------------- */

/** Inklusiivinen ISO-päiväväli. */
export interface Period {
  start: string;
  end: string;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function dayRange(date: string): Period {
  return { start: date, end: date };
}

export function weekRange(date: string): Period {
  const start = isoWeekStart(date);
  return { start, end: addDaysIso(start, 6) };
}

export function lastWeekRange(date: string): Period {
  const start = addDaysIso(isoWeekStart(date), -7);
  return { start, end: addDaysIso(start, 6) };
}

export function monthRange(date: string): Period {
  const [y, m] = date.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1-based → päivä 0 = ed. kk viim. päivä
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export function inPeriod(date: string, period: Period): boolean {
  return date >= period.start && date <= period.end;
}

export function filterByPeriod<T extends { date: string }>(items: T[], period: Period): T[] {
  return items.filter((i) => inPeriod(i.date, period));
}

/* --------------------------------- tally ---------------------------------- */

function matchesMetric(kind: EffortKind, metric: EffortMetric): boolean {
  if (metric === 'total') return true;
  if (metric === 'sends') return kind === 'send';
  return kind === 'attempt';
}

export interface TallyOptions {
  metric: EffortMetric;
  discipline: Discipline;
  displaySystem: GradeSystem;
}

/**
 * Aste-jakauma efforteista, normalisoituna näyttöasteikkoon (helpoimmasta vaikeimpaan).
 * Käyttää uudelleen `gradePyramid`ia (sama normalisointi + lajittelu kuin tilastoissa).
 */
export function tallyByGrade(efforts: ClimbEffort[], opts: TallyOptions): PyramidRow[] {
  const climbs = efforts
    .filter((e) => matchesMetric(e.kind, opts.metric))
    .map((e) => ({
      discipline: e.discipline,
      gradeSystem: e.gradeSystem,
      gradeValue: e.gradeValue,
      count: e.count,
    }));
  return gradePyramid(climbs, opts.discipline, opts.displaySystem);
}

/** Efforttien kokonaismäärä (counttien summa) valitulla metriikalla. */
export function totalCount(efforts: ClimbEffort[], metric: EffortMetric = 'total'): number {
  return efforts
    .filter((e) => matchesMetric(e.kind, metric))
    .reduce((sum, e) => sum + e.count, 0);
}

/** Vaikein aste (näyttöasteikossa) tai null jos ei dataa. */
export function hardestGrade(
  efforts: ClimbEffort[],
  opts: { discipline: Discipline; displaySystem: GradeSystem },
): string | null {
  const rows = tallyByGrade(efforts, { metric: 'total', ...opts });
  return rows.length ? rows[rows.length - 1].grade : null;
}

/** Treenikertojen (sessioiden) määrä jaksolla. */
export function countWorkouts(sessions: { date: string }[], period: Period): number {
  return sessions.filter((s) => inPeriod(s.date, period)).length;
}

/* ------------------------------- vertailu --------------------------------- */

export interface GradeComparisonRow {
  grade: string;
  a: number;
  b: number;
  delta: number; // b - a
}

/**
 * Yhdistä kaksi aste-tallya vertailuksi (a vs b), lajiteltuna näyttöasteikon mukaan.
 * Molempien tulee olla normalisoitu samaan `system`-asteikkoon.
 */
export function compareTallies(
  a: PyramidRow[],
  b: PyramidRow[],
  system: GradeSystem,
): GradeComparisonRow[] {
  const map = new Map<string, { a: number; b: number }>();
  for (const r of a) map.set(r.grade, { a: r.count, b: 0 });
  for (const r of b) {
    const e = map.get(r.grade);
    if (e) e.b = r.count;
    else map.set(r.grade, { a: 0, b: r.count });
  }
  return [...map.entries()]
    .map(([grade, v]) => ({ grade, a: v.a, b: v.b, delta: v.b - v.a }))
    .sort((x, y) => gradeIndex(x.grade, system) - gradeIndex(y.grade, system));
}

/* ----------------------- suunnitelman modifikaattorit ----------------------- */

export interface GradeCount {
  gradeValue: string;
  count: number;
}

export interface PlanModifier {
  /** Volyymimuutos prosentteina (esim. +20 → ×1.2, pyöristetään). */
  volumePct?: number;
  /** Vaikeussiirto askelina lajin asteikolla (esim. +1 → yksi aste vaikeammaksi). */
  gradeShift?: number;
}

/** Siirrä jokaista astetta N askelta (klampataan asteikon rajoihin; törmäykset summataan). */
export function applyGradeShift(
  counts: GradeCount[],
  steps: number,
  system: GradeSystem,
): GradeCount[] {
  const scale = gradesFor(system);
  const merged = new Map<string, number>();
  for (const c of counts) {
    const idx = gradeIndex(c.gradeValue, system);
    if (idx === -1) continue; // tuntematon aste pudotetaan
    const ni = Math.min(scale.length - 1, Math.max(0, idx + steps));
    const g = scale[ni];
    merged.set(g, (merged.get(g) ?? 0) + c.count);
  }
  return [...merged.entries()]
    .map(([gradeValue, count]) => ({ gradeValue, count }))
    .sort((x, y) => gradeIndex(x.gradeValue, system) - gradeIndex(y.gradeValue, system));
}

/** Skaalaa jokaisen asteen määrä volyymiprosentilla (pyöristäen). */
export function applyVolume(counts: GradeCount[], pct: number): GradeCount[] {
  const factor = 1 + pct / 100;
  return counts.map((c) => ({ gradeValue: c.gradeValue, count: Math.round(c.count * factor) }));
}

/** Sovella sekä vaikeussiirto että volyymimuutos (jos annettu). */
export function applyModifier(
  counts: GradeCount[],
  mod: PlanModifier,
  system: GradeSystem,
): GradeCount[] {
  let out = counts.map((c) => ({ ...c }));
  if (mod.gradeShift) out = applyGradeShift(out, mod.gradeShift, system);
  if (mod.volumePct != null && mod.volumePct !== 0) out = applyVolume(out, mod.volumePct);
  return out;
}
