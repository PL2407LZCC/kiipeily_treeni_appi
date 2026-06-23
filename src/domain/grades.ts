/**
 * Asteikot ja muunnokset.
 *
 * Font ja V boulderointiin (Font oletuksena), French sport-kiipeilyyn.
 * Font<->V -muunnostaulukot ovat LIKIMÄÄRÄISIÄ — tarkennetaan myöhemmin.
 */

import type { Discipline, GradeSystem } from './types';

/** Font-asteikko (boulderointi), helpoimmasta vaikeimpaan. */
export const FONT_GRADES = [
  '4',
  '5',
  '5+',
  '6A',
  '6A+',
  '6B',
  '6B+',
  '6C',
  '6C+',
  '7A',
  '7A+',
  '7B',
  '7B+',
  '7C',
  '7C+',
  '8A',
  '8A+',
  '8B',
  '8B+',
  '8C',
  '8C+',
  '9A',
] as const;

/** V-asteikko (boulderointi). */
export const V_GRADES = [
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
] as const;

/** Ranskalainen sport-asteikko. */
export const FRENCH_GRADES = [
  '4',
  '5a',
  '5b',
  '5c',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
  '7b',
  '7b+',
  '7c',
  '7c+',
  '8a',
  '8a+',
  '8b',
  '8b+',
  '8c',
  '8c+',
  '9a',
  '9b',
  '9c',
] as const;

export function gradesFor(system: GradeSystem): readonly string[] {
  switch (system) {
    case 'font':
      return FONT_GRADES;
    case 'v':
      return V_GRADES;
    case 'french':
      return FRENCH_GRADES;
  }
}

/** Järjestysindeksi (vaikeustaso) lajittelua ja tilastoja varten. -1 jos tuntematon. */
export function gradeIndex(value: string, system: GradeSystem): number {
  return gradesFor(system).indexOf(value);
}

/** Boulderoinnin asteikot, joita voi vaihtaa keskenään. */
export function boulderSystemsAreInterchangeable(a: GradeSystem, b: GradeSystem): boolean {
  const boulder: GradeSystem[] = ['font', 'v'];
  return boulder.includes(a) && boulder.includes(b);
}

/**
 * Likimääräinen Font -> V -muunnos. Avaimet ovat Font-arvoja, arvot V-arvoja.
 */
const FONT_TO_V: Record<string, string> = {
  '4': 'V0',
  '5': 'V1',
  '5+': 'V2',
  '6A': 'V3',
  '6A+': 'V3',
  '6B': 'V4',
  '6B+': 'V4',
  '6C': 'V5',
  '6C+': 'V5',
  '7A': 'V6',
  '7A+': 'V7',
  '7B': 'V8',
  '7B+': 'V8',
  '7C': 'V9',
  '7C+': 'V10',
  '8A': 'V11',
  '8A+': 'V12',
  '8B': 'V13',
  '8B+': 'V14',
  '8C': 'V15',
  '8C+': 'V16',
  '9A': 'V17',
};

/** Likimääräinen V -> Font (edustava Font-arvo kullekin V:lle). */
const V_TO_FONT: Record<string, string> = {
  V0: '4',
  V1: '5',
  V2: '5+',
  V3: '6A',
  V4: '6B',
  V5: '6C',
  V6: '7A',
  V7: '7A+',
  V8: '7B',
  V9: '7C',
  V10: '7C+',
  V11: '8A',
  V12: '8A+',
  V13: '8B',
  V14: '8B+',
  V15: '8C',
  V16: '8C+',
  V17: '9A',
};

export function fontToV(value: string): string | null {
  return FONT_TO_V[value] ?? null;
}

export function vToFont(value: string): string | null {
  return V_TO_FONT[value] ?? null;
}

/**
 * Muunna asteikkoarvo toiseen järjestelmään (likimääräinen).
 * Palauttaa null jos muunnosta ei ole (esim. boulder <-> sport).
 */
export function convert(value: string, from: GradeSystem, to: GradeSystem): string | null {
  if (from === to) return value;
  if (from === 'font' && to === 'v') return fontToV(value);
  if (from === 'v' && to === 'font') return vToFont(value);
  // French (sport) ei muunnu boulderiasteikoiksi v1:ssä.
  return null;
}

/** Oletusasteikko lajille. Boulderissa annettu (font/v), sportissa aina french. */
export function defaultSystemForDiscipline(
  discipline: Discipline,
  boulderDefault: GradeSystem,
): GradeSystem {
  if (discipline === 'sport') return 'french';
  return boulderDefault === 'v' ? 'v' : 'font';
}

/**
 * Toissijainen näyttöteksti (esim. Font-valinnan alla V-vastine).
 * Palauttaa null jos toissijaista ei ole.
 */
export function secondaryLabel(
  value: string,
  system: GradeSystem,
  displaySystem: GradeSystem,
): string | null {
  if (system === displaySystem) return null;
  return convert(value, system, displaySystem);
}
