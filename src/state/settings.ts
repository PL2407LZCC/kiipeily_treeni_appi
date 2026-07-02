/**
 * Asetustila (zustand), joka peilaa app_settings-taulua.
 * Lataa kannasta käynnistyksessä; setterit tallentavat kantaan ja päivittävät tilan.
 */

import { create } from 'zustand';

import { Settings } from '@/db/repositories';
import type { GradeSystem, HiddenGrades } from '@/domain/types';

interface SettingsState {
  boulderDefaultSystem: GradeSystem; // 'font' | 'v'
  showSecondaryGrade: boolean;
  trackHoldType: boolean;
  trackSteepness: boolean;
  hiddenGrades: HiddenGrades;
  gradeColumns: number;
  climbTimeSubtractSec: number;
  loaded: boolean;
  load: () => void;
  setBoulderDefaultSystem: (s: GradeSystem) => void;
  setShowSecondaryGrade: (v: boolean) => void;
  setTrackHoldType: (v: boolean) => void;
  setTrackSteepness: (v: boolean) => void;
  setGradeColumns: (n: number) => void;
  setClimbTimeSubtractSec: (n: number) => void;
  toggleHiddenGrade: (system: GradeSystem, grade: string) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  boulderDefaultSystem: 'font',
  showSecondaryGrade: true,
  trackHoldType: false,
  trackSteepness: false,
  hiddenGrades: {},
  gradeColumns: 4,
  climbTimeSubtractSec: 0,
  loaded: false,

  load: () => {
    const s = Settings.getSettings();
    set({ ...s, loaded: true });
  },
  setBoulderDefaultSystem: (boulderDefaultSystem) => {
    Settings.saveSettings({ boulderDefaultSystem });
    set({ boulderDefaultSystem });
  },
  setShowSecondaryGrade: (showSecondaryGrade) => {
    Settings.saveSettings({ showSecondaryGrade });
    set({ showSecondaryGrade });
  },
  setTrackHoldType: (trackHoldType) => {
    Settings.saveSettings({ trackHoldType });
    set({ trackHoldType });
  },
  setTrackSteepness: (trackSteepness) => {
    Settings.saveSettings({ trackSteepness });
    set({ trackSteepness });
  },
  setGradeColumns: (gradeColumns) => {
    Settings.saveSettings({ gradeColumns });
    set({ gradeColumns });
  },
  setClimbTimeSubtractSec: (climbTimeSubtractSec) => {
    Settings.saveSettings({ climbTimeSubtractSec });
    set({ climbTimeSubtractSec });
  },
  toggleHiddenGrade: (system, grade) => {
    const cur = get().hiddenGrades[system] ?? [];
    const next = cur.includes(grade) ? cur.filter((g) => g !== grade) : [...cur, grade];
    const hiddenGrades = { ...get().hiddenGrades, [system]: next };
    Settings.saveSettings({ hiddenGrades });
    set({ hiddenGrades });
  },
}));
