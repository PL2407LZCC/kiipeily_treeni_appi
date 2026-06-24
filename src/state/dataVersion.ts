/**
 * Globaali datan versionumero. Mutaatioiden jälkeen kutsutaan bump(),
 * jolloin kaikki useDbQuery-kyselyt lasketaan uudelleen.
 */

import { create } from 'zustand';

interface DataVersionState {
  version: number;
  bump: () => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** Kutsu mutaation jälkeen, jotta näkymät päivittyvät. */
export function bumpData(): void {
  useDataVersion.getState().bump();
}
