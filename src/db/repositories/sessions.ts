import { and, desc, eq, gte, isNull } from 'drizzle-orm';

import { buildEfforts, type ClimbEffort } from '@/domain/aggregate';
import { nowIso, todayIso } from '@/domain/dates';
import {
  DEFAULT_PLAN_DIMS,
  DEFAULT_PLAN_MODE,
  type SessionEnvironment,
  type SessionPlan,
} from '@/domain/types';
import { db } from '../client';
import { sessions } from '../schema';
import { listAttemptLogsForSession } from './attemptLogs';
import { attemptsForSession } from './attempts';
import { listSendsForSession } from './sends';

export interface NewSession {
  location?: string | null;
  theme?: string | null;
  environment?: SessionEnvironment | null;
}

/** Avoin (käynnissä oleva) sessio, jos sellainen on. */
export function getActiveSession() {
  const rows = db
    .select()
    .from(sessions)
    .where(isNull(sessions.endedAt))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .all();
  return rows[0];
}

export function getSession(id: number) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function listSessions() {
  return db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.date), desc(sessions.startedAt))
    .all();
}

/** Aloita uusi sessio. Useita sessioita per päivä sallitaan. */
export function startSession(opts: NewSession = {}): number {
  const now = nowIso();
  const res = db
    .insert(sessions)
    .values({
      date: todayIso(),
      location: opts.location?.trim() || null,
      theme: opts.theme ?? null,
      environment: opts.environment ?? null,
      startedAt: now,
    })
    .run();
  return Number(res.lastInsertRowId);
}

export function endSession(id: number): void {
  db.update(sessions).set({ endedAt: nowIso() }).where(eq(sessions.id, id)).run();
}

export function updateSession(
  id: number,
  fields: { date?: string; location?: string | null; notes?: string | null },
): void {
  db.update(sessions).set(fields).where(eq(sessions.id, id)).run();
}

export function deleteSession(id: number): void {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}

/* ------------------------------ guided plan ------------------------------- */

/** Lue session suunnitelma (JSON.parse), tai null jos ei suunnitelmaa / virheellinen. */
export function getSessionPlan(id: number): SessionPlan | null {
  const row = db.select({ plan: sessions.plan }).from(sessions).where(eq(sessions.id, id)).get();
  if (!row?.plan) return null;
  try {
    const parsed = JSON.parse(row.plan) as SessionPlan;
    // Vanhat suunnitelmat (ennen dims/mode-ominaisuutta) eivät sisällä näitä kenttiä.
    return {
      ...parsed,
      dims: parsed.dims ?? { ...DEFAULT_PLAN_DIMS },
      mode: parsed.mode ?? DEFAULT_PLAN_MODE,
    };
  } catch {
    return null;
  }
}

/** Tallenna session suunnitelma (JSON.stringify sessions.plan-sarakkeeseen). */
export function setSessionPlan(id: number, plan: SessionPlan): void {
  db.update(sessions).set({ plan: JSON.stringify(plan) }).where(eq(sessions.id, id)).run();
}

/**
 * Laske session efforts-lista (sendit + irralliset yritykset + projektiyritykset)
 * suunnitelman lähtötasoa varten. Käyttää session omaa päivää kaikille riveille.
 */
export function sessionEfforts(id: number): ClimbEffort[] {
  const session = getSession(id);
  if (!session) return [];
  const dateBySession = new Map<number, string>([[id, session.date]]);
  const sends = listSendsForSession(id);
  const attemptLogs = listAttemptLogsForSession(id);
  const projectAttempts = attemptsForSession(id);
  return buildEfforts(
    {
      sends: sends.map((s) => ({
        sessionId: id,
        discipline: s.discipline,
        gradeSystem: s.gradeSystem,
        gradeValue: s.gradeValue,
        count: s.count,
        holdType: s.holdType,
        steepness: s.steepness,
      })),
      attemptLogs: attemptLogs.map((a) => ({
        sessionId: id,
        discipline: a.discipline,
        gradeSystem: a.gradeSystem,
        gradeValue: a.gradeValue,
        count: a.count,
        holdType: a.holdType,
        steepness: a.steepness,
      })),
      // Projektiyritykset perivät ulottuvuudet projektilta (join attemptsForSession-kyselyssä).
      projectAttempts: projectAttempts.map((p) => ({
        sessionId: id,
        discipline: p.discipline,
        gradeSystem: p.gradeSystem,
        gradeValue: p.gradeValue,
        attemptCount: p.attemptCount,
        holdType: p.holdType,
        steepness: p.steepness,
      })),
    },
    dateBySession,
  );
}

export interface SessionFilter {
  theme: string | null;
  environment: SessionEnvironment | null;
  /** Inklusiivinen alaraja (ISO-päivä YYYY-MM-DD): vain tätä uudemmat/yhtä uudet. */
  sinceDate: string;
}

/**
 * Menneet sessiot annetulla teemalla + ympäristöllä, päivästä `sinceDate` eteenpäin,
 * uusin ensin. Käytetään suunnitelman lähtötason valintaan.
 */
export function listSessionsFor(filter: SessionFilter) {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        filter.theme == null ? isNull(sessions.theme) : eq(sessions.theme, filter.theme),
        filter.environment == null
          ? isNull(sessions.environment)
          : eq(sessions.environment, filter.environment),
        gte(sessions.date, filter.sinceDate),
      ),
    )
    .orderBy(desc(sessions.date), desc(sessions.startedAt))
    .all();
}
