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

/** Seinän jyrkkyys (valinnainen ominaisuus). null = määrittelemätön. */
export type Steepness = 'slab' | 'overhang';

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
  steepness: Steepness | null;
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
  steepness: Steepness | null;
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
  steepness: Steepness | null;
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

/**
 * Yksi suunnitelman tavoite: kuinka monta efforttia tietyllä asteella tavoitellaan.
 * Asteavain pidetään LOGATUSSA järjestelmässä (gradeSystem) — likimääräistä
 * Font↔V-muunnosta ei käytetä kanonisena avaimena.
 */
export interface PlanTarget {
  gradeSystem: GradeSystem;
  gradeValue: string;
  target: number;
  /** Otetyyppi-ulottuvuus (vain jos suunnitelman dims.holdType päällä). */
  holdType?: HoldType | null;
  /** Jyrkkyys-ulottuvuus (vain jos suunnitelman dims.steepness päällä). */
  steepness?: Steepness | null;
}

/**
 * Suunnitelman ulottuvuus-kytkimet: jakaako tavoitteet otetyypin / jyrkkyyden
 * mukaan. Per-suunnitelma (EI globaali asetus).
 */
export interface PlanDims {
  holdType: boolean;
  steepness: boolean;
}

/** Oletus-dims vanhoille suunnitelmille jotka tallennettiin ennen tätä ominaisuutta. */
export const DEFAULT_PLAN_DIMS: PlanDims = { holdType: false, steepness: false };

/**
 * Suunnitelman noudatustila:
 *  - `loose`: kaikki asteet näkyvät; tavoitteen ylitys / suunnitelman ulkopuolinen aste
 *    vain varoittaa ("kirjaa silti") — nykyinen oletuskäytös.
 *  - `exact`: kova katto. Vain suunnitelman asteet näkyvät, täyttyneet poistuvat
 *    valikosta, eikä ylitystä voi ohittaa.
 */
export type PlanMode = 'loose' | 'exact';

/** Oletus-tila vanhoille suunnitelmille jotka tallennettiin ennen tätä ominaisuutta. */
export const DEFAULT_PLAN_MODE: PlanMode = 'loose';

/**
 * Guided-session-suunnitelma: johdettu menneestä sessiosta + modifikaattoreista,
 * tallennetaan JSON-merkkijonona sessions.plan-sarakkeeseen. PR4: vain suunnitelma
 * ja sen näyttö (read-only) — ei enforcementtia eikä tallennettuja templaatteja.
 */
export interface SessionPlan {
  discipline: Discipline;
  label: string;
  sourceSessionId: number | null;
  modifier: { volumePct?: number; gradeShift?: number };
  /** Ulottuvuus-kytkimet: jaetaanko tavoitteet otetyypin/jyrkkyyden mukaan. */
  dims: PlanDims;
  /** Noudatustila (oletus 'loose' vanhoille suunnitelmille). */
  mode?: PlanMode;
  targets: PlanTarget[];
}

/**
 * Tallennettu, uudelleenkäytettävä treenisuunnitelmamalli (template). Toisin kuin
 * SessionPlan (yhden session JSON sessions.plan-sarakkeessa), nämä elävät omassa
 * training_plans-taulussaan ja niistä voi aloittaa uusia sessioita.
 */
export interface TrainingPlanTemplate {
  id: number;
  name: string;
  discipline: Discipline;
  theme: string | null;
  environment: SessionEnvironment | null;
  /** Ulottuvuus-kytkimet: jaetaanko tavoitteet otetyypin/jyrkkyyden mukaan. */
  dims: PlanDims;
  /** Noudatustila (oletus 'loose' vanhoille malleille). */
  mode?: PlanMode;
  targets: PlanTarget[];
  createdAt: string;
}
