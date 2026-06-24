/**
 * Asetustila (zustand), joka peilaa app_settings-taulua.
 * Lataa kannasta käynnistyksessä; setterit tallentavat kantaan ja päivittävät tilan.
 */

import { create } from 'zustand';

import { Settings } from '@/db/repositories';
import type { GradeSystem } from '@/domain/types';

interface SettingsState {
  boulderDefaultSystem: GradeSystem; // 'font' | 'v'
  showSecondaryGrade: boolean;
  loaded: boolean;
  load: () => void;
  setBoulderDefaultSystem: (s: GradeSystem) => void;
  setShowSecondaryGrade: (v: boolean) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  boulderDefaultSystem: 'font',
  showSecondaryGrade: true,
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
}));
