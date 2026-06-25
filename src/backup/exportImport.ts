/**
 * Manuaalinen JSON-varmuuskopiointi (ei pilveä).
 * Vie kaikki taulut yhteen tiedostoon ja jaa; tuo palauttaa kaiken datan.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db, sqlite } from '@/db/client';
import {
  appSettings,
  attemptLogs,
  projectAttempts,
  projects,
  sendLogs,
  sessions,
  sessionThemes,
  supplementalEntries,
  trainingPlans,
} from '@/db/schema';

export const BACKUP_APP_ID = 'kiipeily-treeni-appi';
// v2: lisätty attempt_logs (irralliset yritykset).
// v3: lisätty hold_type-sarakkeet (send_logs/attempt_logs/projects).
// v4: lisätty session_themes-taulu sekä sessions.theme/environment-sarakkeet.
// v5: lisätty sessions.plan-sarake (guided sessions; kulkee sessions-rivien mukana).
// v6: lisätty training_plans-taulu (tallennetut suunnitelmamallit; oma avaimensa).
// v7: lisätty steepness-sarakkeet (send_logs/attempt_logs/projects; kulkevat rivien mukana).
// v8: suunnitelmat (sessions.plan / training_plans) kantavat nyt dims-kytkimet +
//     ulottuvuus-tavoitteet JSONissa. Ei rakenteellista muutosta (rivien JSON-sisältö
//     laajenee); vanhat suunnitelmat ilman dims-kenttää oletetaan ulottuvuuksiltaan pois
//     päältä lukuvaiheessa (getSessionPlan / plans.toTemplate).
// Sarakkeet kulkevat olemassa olevien taulujen mukana; uudet taulut omana avaimenaan.
// Vanhat tiedostot tuodaan edelleen (puuttuvat kentät jäävät tyhjiksi/null, ja
// puuttuva session_themes-/training_plans-avain jättää nykyiset rivit ennalleen).
export const BACKUP_VERSION = 8;

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    sessions: unknown[];
    sendLogs: unknown[];
    attemptLogs?: unknown[];
    projects: unknown[];
    projectAttempts: unknown[];
    supplementalEntries: unknown[];
    sessionThemes?: unknown[];
    trainingPlans?: unknown[];
    appSettings: unknown[];
  };
}

function collectData(): BackupFile['data'] {
  return {
    sessions: db.select().from(sessions).all(),
    sendLogs: db.select().from(sendLogs).all(),
    attemptLogs: db.select().from(attemptLogs).all(),
    projects: db.select().from(projects).all(),
    projectAttempts: db.select().from(projectAttempts).all(),
    supplementalEntries: db.select().from(supplementalEntries).all(),
    sessionThemes: db.select().from(sessionThemes).all(),
    trainingPlans: db.select().from(trainingPlans).all(),
    appSettings: db.select().from(appSettings).all(),
  };
}

/** Vie data tiedostoon ja avaa jakovalikko. Palauttaa tiedoston URIn. */
export async function exportBackup(exportedAtIso: string): Promise<string> {
  const payload: BackupFile = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: exportedAtIso,
    data: collectData(),
  };

  const fileName = `kiipeily-backup-${exportedAtIso.slice(0, 10)}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Vie varmuuskopio',
      UTI: 'public.json',
    });
  }
  return file.uri;
}

function isBackupFile(x: unknown): x is BackupFile {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.app === BACKUP_APP_ID && typeof o.data === 'object' && o.data !== null;
}

/**
 * Avaa tiedostonvalitsin, lue JSON ja palauta data. Palauttaa null jos peruttu.
 * Heittää virheen, jos tiedosto on virheellinen.
 */
export async function pickAndParseBackup(): Promise<BackupFile | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  if (picked.canceled || !picked.result) return null;
  const text = await picked.result.text();
  const parsed = JSON.parse(text);
  if (!isBackupFile(parsed)) {
    throw new Error('Virheellinen varmuuskopiotiedosto');
  }
  return parsed;
}

/** Korvaa kaikki tiedot varmuuskopion datalla (transaktiossa). */
export function restoreBackup(backup: BackupFile): void {
  const d = backup.data;
  sqlite.withTransactionSync(() => {
    // Tyhjennä lapsista vanhempiin (FK-turvallisesti).
    db.delete(projectAttempts).run();
    db.delete(attemptLogs).run();
    db.delete(sendLogs).run();
    db.delete(supplementalEntries).run();
    db.delete(projects).run();
    db.delete(sessions).run();

    if (d.sessions.length) db.insert(sessions).values(d.sessions as any).run();
    if (d.projects.length) db.insert(projects).values(d.projects as any).run();
    if (d.sendLogs.length) db.insert(sendLogs).values(d.sendLogs as any).run();
    if (d.attemptLogs?.length) db.insert(attemptLogs).values(d.attemptLogs as any).run();
    if (d.projectAttempts.length)
      db.insert(projectAttempts).values(d.projectAttempts as any).run();
    if (d.supplementalEntries.length)
      db.insert(supplementalEntries).values(d.supplementalEntries as any).run();

    // session_themes vain jos varmuuskopiossa on avain (vanhat tiedostot jättävät
    // nykyiset teemat ennalleen).
    if (d.sessionThemes) {
      db.delete(sessionThemes).run();
      if (d.sessionThemes.length) db.insert(sessionThemes).values(d.sessionThemes as any).run();
    }

    // training_plans vain jos varmuuskopiossa on avain (vanhat tiedostot jättävät
    // nykyiset mallit ennalleen).
    if (d.trainingPlans) {
      db.delete(trainingPlans).run();
      if (d.trainingPlans.length) db.insert(trainingPlans).values(d.trainingPlans as any).run();
    }

    if (d.appSettings.length) {
      db.delete(appSettings).run();
      db.insert(appSettings).values(d.appSettings as any).run();
    }
  });
}
