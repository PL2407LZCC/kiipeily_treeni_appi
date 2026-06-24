import { eq } from 'drizzle-orm';

import type { GradeSystem } from '@/domain/types';
import { db } from '../client';
import { appSettings } from '../schema';

export interface AppSettings {
  boulderDefaultSystem: GradeSystem; // 'font' | 'v'
  showSecondaryGrade: boolean;
}

const DEFAULTS: AppSettings = {
  boulderDefaultSystem: 'font',
  showSecondaryGrade: true,
};

export function getSettings(): AppSettings {
  const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
  if (!row) return DEFAULTS;
  return {
    boulderDefaultSystem: row.boulderDefaultSystem as GradeSystem,
    showSecondaryGrade: row.showSecondaryGrade,
  };
}

export function saveSettings(s: Partial<AppSettings>): void {
  db.insert(appSettings)
    .values({ id: 1, ...DEFAULTS, ...s })
    .onConflictDoUpdate({ target: appSettings.id, set: s })
    .run();
}
