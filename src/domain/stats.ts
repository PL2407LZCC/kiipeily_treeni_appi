/**
 * Tilastojen aggregointi (puhtaita funktioita, yksikkötestattavia).
 *
 * Sääntö: grade pyramid yhdistää send_logs + lähetetyt projektit, joten
 * lähetetty projekti lasketaan nousuksi omalla asteikollaan.
 */

import { convert, gradeIndex } from './grades';
import type { Climb, Discipline, GradeSystem } from './types';

export interface PyramidRow {
  grade: string;
  count: number;
}

/**
 * Rakenna grade pyramid yhdelle lajille, normalisoituna näyttöasteikkoon.
 * Boulder-nousut muunnetaan kohdeasteikkoon (font/v); sportissa käytetään frenchiä.
 * Tulos on järjestetty helpoimmasta vaikeimpaan; tuntemattomat asteet jätetään pois.
 */
export function gradePyramid(
  climbs: Climb[],
  discipline: Discipline,
  displaySystem: GradeSystem,
): PyramidRow[] {
  const target: GradeSystem = discipline === 'sport' ? 'french' : displaySystem;
  const counts = new Map<string, number>();

  for (const c of climbs) {
    if (c.discipline !== discipline) continue;
    const normalized = convert(c.gradeValue, c.gradeSystem, target);
    if (normalized == null) continue;
    if (gradeIndex(normalized, target) === -1) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + c.count);
  }

  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => gradeIndex(a.grade, target) - gradeIndex(b.grade, target));
}

export interface VolumeBucket {
  /** Avain: ISO-päivä (day) tai ISO-viikon alku (week). */
  key: string;
  label: string;
  count: number;
}

export type VolumePeriod = 'day' | 'week';

export interface DatedCount {
  date: string; // ISO date YYYY-MM-DD
  count: number;
}

/** Maanantaina alkavan ISO-viikon alkupäivä annetulle ISO-päivälle. */
export function isoWeekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Käytä UTC:tä läpi laskennan, jotta aikavyöhyke ei siirrä päivää.
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 = su
  const diff = (day === 0 ? -6 : 1) - day; // siirrä maanantaihin
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

/**
 * Aggregoi volyymi (nousujen määrä) päivä- tai viikkokoreihin, aikajärjestyksessä.
 */
export function volumeOverTime(items: DatedCount[], period: VolumePeriod): VolumeBucket[] {
  const buckets = new Map<string, number>();

  for (const it of items) {
    const key = period === 'week' ? isoWeekStart(it.date) : it.date;
    buckets.set(key, (buckets.get(key) ?? 0) + it.count);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => ({
      key,
      label: period === 'week' ? `vko ${weekLabel(key)}` : dayLabel(key),
      count,
    }));
}

function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}.${Number(m)}.`;
}

function weekLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}.${Number(m)}.`;
}
