/**
 * Treeninäytön ohimenevä käyttöliittymätila (zustand).
 * Itse sessio ja kirjaukset elävät tietokannassa; tämä pitää vain UI-valinnat.
 */

import { create } from 'zustand';

import type { Discipline, GradeSystem } from '@/domain/types';

export type LogMode = 'send' | 'project';

interface ActiveSessionState {
  mode: LogMode;
  discipline: Discipline;
  /** Boulderoinnin näyttöasteikko (font/v); sportissa käytetään aina frenchiä. */
  boulderDisplaySystem: GradeSystem;
  quantity: number; // toistojen määrä sendille
  flash: boolean;
  selectedProjectId: number | null;
  /** Viimeisimmän sendin id kumoamista varten. */
  lastSendId: number | null;
  /** Viimeisimmän irrallisen yrityksen id kumoamista varten. */
  lastAttemptId: number | null;

  setMode: (mode: LogMode) => void;
  setDiscipline: (d: Discipline) => void;
  setBoulderDisplaySystem: (s: GradeSystem) => void;
  setQuantity: (n: number) => void;
  toggleFlash: () => void;
  setSelectedProject: (id: number | null) => void;
  setLastSendId: (id: number | null) => void;
  setLastAttemptId: (id: number | null) => void;
  resetLogging: () => void;
}

export const useActiveSession = create<ActiveSessionState>((set) => ({
  mode: 'send',
  discipline: 'boulder',
  boulderDisplaySystem: 'font',
  quantity: 1,
  flash: false,
  selectedProjectId: null,
  lastSendId: null,
  lastAttemptId: null,

  setMode: (mode) => set({ mode }),
  setDiscipline: (discipline) => set({ discipline }),
  setBoulderDisplaySystem: (boulderDisplaySystem) => set({ boulderDisplaySystem }),
  setQuantity: (quantity) => set({ quantity: Math.max(1, quantity) }),
  toggleFlash: () => set((s) => ({ flash: !s.flash })),
  setSelectedProject: (selectedProjectId) => set({ selectedProjectId }),
  setLastSendId: (lastSendId) => set({ lastSendId }),
  setLastAttemptId: (lastAttemptId) => set({ lastAttemptId }),
  resetLogging: () => set({ quantity: 1, flash: false, lastSendId: null, lastAttemptId: null }),
}));
