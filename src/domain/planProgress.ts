/**
 * Suunnitelman edistyminen + pehmeä enforcement (puhtaita funktioita).
 *
 * Guided-session (PR6): kun aktiivisella sessiolla on suunnitelma, näytetään
 * astekohtainen edistyminen (efforts vs. tavoite) ja varoitetaan-mutta-sallitaan,
 * kun kirjaus ylittäisi tavoitteen tai kirjaisi suunnitelmaan kuulumattoman asteen.
 *
 * Tavoitteet pidetään LOGATUSSA järjestelmässä (PlanTarget.gradeSystem); vertailua
 * varten ne normalisoidaan näyttöasteikkoon `convert`illa (likimääräinen — null jätetään
 * pois, jolloin kyseistä astetta ei varoiteta).
 */

import { tallyByGrade, type ClimbEffort } from './aggregate';
import { convert, gradeIndex } from './grades';
import type { Discipline, GradeSystem, SessionPlan } from './types';

/**
 * Normalisoi suunnitelman tavoitteet näyttöasteikkoon: muunna kunkin tavoitteen aste
 * `displaySystem`-asteikkoon ja summaa tavoitteet normalisoidun asteen mukaan.
 * Muunnoksen epäonnistuessa (null) tavoite ohitetaan.
 */
export function planTargetsByGrade(
  plan: SessionPlan,
  displaySystem: GradeSystem,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of plan.targets) {
    const grade = convert(t.gradeValue, t.gradeSystem, displaySystem);
    if (grade == null) continue;
    map.set(grade, (map.get(grade) ?? 0) + t.target);
  }
  return map;
}

export interface PlanProgressRow {
  grade: string;
  current: number;
  target: number;
}

/**
 * Astekohtainen edistyminen: jokaiselle suunnitelman asteelle nykyinen effort-määrä
 * (tally `metric:'total'`) vs. tavoite. Lajiteltu helpoimmasta vaikeimpaan.
 */
export function planProgress(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  displaySystem: GradeSystem,
): PlanProgressRow[] {
  const targets = planTargetsByGrade(plan, displaySystem);
  const tally = tallyByGrade(efforts, {
    metric: 'total',
    discipline: plan.discipline,
    displaySystem,
  });
  const currentByGrade = new Map<string, number>();
  for (const r of tally) currentByGrade.set(r.grade, r.count);

  return [...targets.entries()]
    .map(([grade, target]) => ({
      grade,
      target,
      current: currentByGrade.get(grade) ?? 0,
    }))
    .sort((a, b) => gradeIndex(a.grade, displaySystem) - gradeIndex(b.grade, displaySystem));
}

export type LogVerdict = 'ok' | 'over' | 'offplan';

/**
 * Arvioi kirjaus suunnitelmaa vasten ENNEN insertointia.
 * - eri laji kuin suunnitelma → 'ok' (suunnitelma ei koske tätä).
 * - aste ei muunnu näyttöasteikkoon (null) → 'ok' (ei voida verrata → ei varoiteta).
 * - aste ei ole suunnitelmassa → 'offplan'.
 * - muuten current + addCount > target → 'over', muuten 'ok'.
 */
export function evaluateLog(
  plan: SessionPlan,
  efforts: ClimbEffort[],
  discipline: Discipline,
  displaySystem: GradeSystem,
  gradeSystem: GradeSystem,
  gradeValue: string,
  addCount: number,
): LogVerdict {
  if (discipline !== plan.discipline) return 'ok';
  const grade = convert(gradeValue, gradeSystem, displaySystem);
  if (grade == null) return 'ok';

  const targets = planTargetsByGrade(plan, displaySystem);
  if (!targets.has(grade)) return 'offplan';

  const tally = tallyByGrade(efforts, { metric: 'total', discipline: plan.discipline, displaySystem });
  const current = tally.find((r) => r.grade === grade)?.count ?? 0;
  return current + addCount > (targets.get(grade) ?? 0) ? 'over' : 'ok';
}
