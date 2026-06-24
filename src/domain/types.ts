/**
 * Ydintyypit (domain types). Kiipeilytermit pidetään englanniksi (send, project, flash).
 */

export type Discipline = 'boulder' | 'sport';

/** Asteikkojärjestelmät: Font ja V boulderointiin, French sport-kiipeilyyn. */
export type GradeSystem = 'font' | 'v' | 'french';

export type ProjectStatus = 'active' | 'sent' | 'abandoned' | 'archived';

export type SupplementalKind = 'strength' | 'endurance' | 'other';

/** Otteen/nousun tyyppi (valinnainen ominaisuus). null = määrittelemätön. */
export type HoldType = 'crimpy' | 'slopy';

/** Session ympäristö (valinnainen): sisä- vai ulkokiipeily. */
export type SessionEnvironment = 'indoor' | 'outdoor';

export interface Session {
  id: number;
  date: string; // ISO date (YYYY-MM-DD)
  location: string | null;
  theme: string | null; // valittu teema (session_themes-listalta)
  environment: SessionEnvironment | null; // indoor | outdoor | null
  notes: string | null;
  startedAt: string; // ISO datetime
  endedAt: string | null;
}

/** Valittavissa oleva session teema (oletukset + käyttäjän lisäämät). */
export interface SessionTheme {
  id: number;
  name: string;
  createdAt: string;
}

export interface SendLog {
  id: number;
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count: number;
  flash: boolean;
  holdType: HoldType | null;
  notes: string | null;
  createdAt: string;
}

/** Irrallinen yritys (ei sidottu projektiin) — astenapin pitkä painallus Send-tilassa. */
export interface AttemptLog {
  id: number;
  sessionId: number;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count: number;
  holdType: HoldType | null;
  notes: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  name: string | null;
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  status: ProjectStatus;
  location: string | null;
  holdType: HoldType | null;
  notes: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ProjectAttempt {
  id: number;
  projectId: number;
  sessionId: number;
  attemptCount: number;
  sent: boolean;
  notes: string | null;
  createdAt: string;
}

export interface SupplementalEntry {
  id: number;
  sessionId: number;
  name: string;
  kind: SupplementalKind;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  notes: string | null;
  createdAt: string;
}

/** Yhtenäistetty "nousu" tilastoja varten (send tai lähetetty projekti). */
export interface Climb {
  discipline: Discipline;
  gradeSystem: GradeSystem;
  gradeValue: string;
  count: number;
}
