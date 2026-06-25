/**
 * Puhtaat apufunktiot ClimbTagPromptin ele-pohjaiseen valintaan.
 * Eriytetty komponentista yksikkötestattavuuden vuoksi.
 */

import type { HoldType, Steepness } from './types';

/**
 * Otetyyppi vaakasuoran x-koordinaatin perusteella 3-painikkeen rivillä.
 * Rivi jaetaan kolmeen yhtä leveään kolmannekseen:
 *   vasen (0) = slopy · keski (1) = null (ei määritelty) · oikea (2) = crimpy.
 * x leikataan rivin [0, rowWidth] sisään; jos rowWidth <= 0, palautetaan null.
 */
export function holdTypeFromX(x: number, rowWidth: number): HoldType | null {
  if (rowWidth <= 0) return null;
  const clamped = Math.min(Math.max(x, 0), rowWidth - 0.0001);
  const index = Math.floor((clamped / rowWidth) * 3);
  if (index <= 0) return 'slopy';
  if (index >= 2) return 'crimpy';
  return null; // keskimmäinen kolmannes = ei määritelty
}

/**
 * Jyrkkyys pystysuoran liu'un (translationY) perusteella.
 * Ylös (negatiivinen dy) yli kynnyksen = 'slab', alas (positiivinen) = 'overhang',
 * muuten null (ei valittu). Pelkkä napautus (dy ~ 0) → null.
 */
export function steepnessFromDy(dy: number, threshold: number): Steepness | null {
  if (dy <= -threshold) return 'slab';
  if (dy >= threshold) return 'overhang';
  return null;
}
