/**
 * Manuaalinen JSON-varmuuskopiointi (ei pilveä).
 * Vie kaikki taulut yhteen tiedostoon ja jaa; tuo palauttaa kaiken datan.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db, sqlite } from '@/db/client';
import {
  appSettings,
  projectAttempts,
  projects,
  sendLogs,
  sessions,
  supplementalEntries,
} from '@/db/schema';

export const BACKUP_APP_ID = 'kiipeily-treeni-appi';
export const BACKUP_VERSION = 1;

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    sessions: unknown[];
    sendLogs: unknown[];
    projects: unknown[];
    projectAttempts: unknown[];
    supplementalEntries: unknown[];
    appSettings: unknown[];
  };
}

function collectData(): BackupFile['data'] {
  return {
    sessions: db.select().from(sessions).all(),
    sendLogs: db.select().from(sendLogs).all(),
    projects: db.select().from(projects).all(),
    projectAttempts: db.select().from(projectAttempts).all(),
    supplementalEntries: db.select().from(supplementalEntries).all(),
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
    db.delete(sendLogs).run();
    db.delete(supplementalEntries).run();
    db.delete(projects).run();
    db.delete(sessions).run();

    if (d.sessions.length) db.insert(sessions).values(d.sessions as any).run();
    if (d.projects.length) db.insert(projects).values(d.projects as any).run();
    if (d.sendLogs.length) db.insert(sendLogs).values(d.sendLogs as any).run();
    if (d.projectAttempts.length)
      db.insert(projectAttempts).values(d.projectAttempts as any).run();
    if (d.supplementalEntries.length)
      db.insert(supplementalEntries).values(d.supplementalEntries as any).run();

    if (d.appSettings.length) {
      db.delete(appSettings).run();
      db.insert(appSettings).values(d.appSettings as any).run();
    }
  });
}
