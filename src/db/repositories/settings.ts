import { eq } from 'drizzle-orm';

import type { GradeSystem, HiddenGrades } from '@/domain/types';
import { db } from '../client';
import { appSettings } from '../schema';

export interface AppSettings {
  boulderDefaultSystem: GradeSystem; // 'font' | 'v'
  showSecondaryGrade: boolean;
  trackHoldType: boolean;
  trackSteepness: boolean;
  hiddenGrades: HiddenGrades; // piilotetut asteet per asteikko (Treeni-astevalikko)
  gradeColumns: number; // astenappien määrä rivillä Treeni-näkymässä (3 tai 4)
  climbTimeSubtractSec: number; // vähennys mitatusta nousuajasta (complex-ajastin)
}

const DEFAULTS: AppSettings = {
  boulderDefaultSystem: 'font',
  showSecondaryGrade: true,
  trackHoldType: false,
  trackSteepness: false,
  hiddenGrades: {},
  gradeColumns: 4,
  climbTimeSubtractSec: 0,
};

export function getSettings(): AppSettings {
  const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
  if (!row) return DEFAULTS;
  return {
    boulderDefaultSystem: row.boulderDefaultSystem as GradeSystem,
    showSecondaryGrade: row.showSecondaryGrade,
    trackHoldType: row.trackHoldType,
    trackSteepness: row.trackSteepness,
    hiddenGrades: (row.hiddenGrades as HiddenGrades) ?? {},
    gradeColumns: row.gradeColumns,
    climbTimeSubtractSec: row.climbTimeSubtractSec,
  };
}

export function saveSettings(s: Partial<AppSettings>): void {
  db.insert(appSettings)
    .values({ id: 1, ...DEFAULTS, ...s })
    .onConflictDoUpdate({ target: appSettings.id, set: s })
    .run();
}
