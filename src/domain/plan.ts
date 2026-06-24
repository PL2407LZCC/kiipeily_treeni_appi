/**
 * Guided-session-suunnitelman puhdas rakennuslogiikka (yksikkötestattava).
 *
 * Lähtötaso = menneen session per-(gradeSystem, gradeValue) effort-määrät
 * (sendit + irralliset yritykset + projektiyritykset; jokainen send JA yritys = 1).
 * Modifikaattori (volyymi-% ja/tai vaikeussiirto) sovelletaan KUNKIN
 * grade-systemin sisällä erikseen (ks. aggregate.applyModifier). Asteavain
 * pidetään logatussa järjestelmässä — likimääräistä Font↔V-muunnosta ei käytetä.
 */

import { applyModifier, type ClimbEffort, type GradeCount, type PlanModifier } from './aggregate';
import type { GradeSystem, PlanTarget } from './types';

/**
 * Rakenna suunnitelman tavoitteet lähtötason efforteista + modifikaattorista.
 *
 * Vaiheet:
 *  1. Laske per-(gradeSystem, gradeValue) effort-määrät (summaa countit).
 *  2. Sovella modifikaattori erikseen jokaisen gradeSystemin sisällä.
 *  3. Litistä PlanTarget-listaksi; pudota tavoitteet joiden määrä on <= 0.
 */
export function buildPlanTargets(
  efforts: ClimbEffort[],
  modifier: PlanModifier,
): PlanTarget[] {
  // 1. Ryhmittele effortit grade-systemiin → aste → summattu määrä.
  const bySystem = new Map<GradeSystem, Map<string, number>>();
  for (const e of efforts) {
    let byGrade = bySystem.get(e.gradeSystem);
    if (!byGrade) {
      byGrade = new Map<string, number>();
      bySystem.set(e.gradeSystem, byGrade);
    }
    byGrade.set(e.gradeValue, (byGrade.get(e.gradeValue) ?? 0) + e.count);
  }

  // 2.–3. Sovella modifikaattori per systeemi ja litistä tavoitteiksi.
  const out: PlanTarget[] = [];
  for (const [gradeSystem, byGrade] of bySystem) {
    const counts: GradeCount[] = [...byGrade.entries()].map(([gradeValue, count]) => ({
      gradeValue,
      count,
    }));
    const modified = applyModifier(counts, modifier, gradeSystem);
    for (const c of modified) {
      if (c.count <= 0) continue;
      out.push({ gradeSystem, gradeValue: c.gradeValue, target: c.count });
    }
  }
  return out;
}
