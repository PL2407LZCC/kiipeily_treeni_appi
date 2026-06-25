/**
 * Guided-session-suunnitelman puhdas rakennuslogiikka (yksikkötestattava).
 *
 * Lähtötaso = menneen session per-(gradeSystem, gradeValue) effort-määrät
 * (sendit + irralliset yritykset + projektiyritykset; jokainen send JA yritys = 1).
 * Modifikaattori (volyymi-% ja/tai vaikeussiirto) sovelletaan KUNKIN
 * grade-systemin sisällä erikseen (ks. aggregate.applyModifier). Asteavain
 * pidetään logatussa järjestelmässä — likimääräistä Font↔V-muunnosta ei käytetä.
 *
 * Ulottuvuudet (dims): jos suunnitelma seuraa otetyyppiä ja/tai jyrkkyyttä, efforts
 * ryhmitellään lisäksi näiden mukaan — sama aste eri ulottuvuusarvoilla muodostaa
 * erilliset tavoitteet (null on oma varianttinsa). Pois kytketty ulottuvuus jätetään
 * kokonaan huomiotta (ja sitä ei kirjoiteta tavoitteille).
 */

import { applyModifier, type ClimbEffort, type GradeCount, type PlanModifier } from './aggregate';
import type { GradeSystem, HoldType, PlanDims, PlanTarget, Steepness } from './types';

const NO_DIMS: PlanDims = { holdType: false, steepness: false };

/** Ryhmittelyavain ulottuvuuksille (vain käytössä olevat dims vaikuttavat). */
function dimKey(
  holdType: HoldType | null,
  steepness: Steepness | null,
  dims: PlanDims,
): string {
  const h = dims.holdType ? (holdType ?? '∅') : '*';
  const s = dims.steepness ? (steepness ?? '∅') : '*';
  return `${h}|${s}`;
}

/**
 * Rakenna suunnitelman tavoitteet lähtötason efforteista + modifikaattorista.
 *
 * Vaiheet:
 *  1. Laske per-(gradeSystem [, holdType] [, steepness]) → aste → summattu määrä
 *     (vain käytössä olevat dims vaikuttavat ryhmittelyyn; null = oma varianttinsa).
 *  2. Sovella modifikaattori erikseen jokaisen gradeSystem+variantti-yhdistelmän sisällä.
 *  3. Litistä PlanTarget-listaksi; pudota tavoitteet joiden määrä on <= 0. Kirjoita
 *     holdType/steepness tavoitteelle vain käytössä olevista ulottuvuuksista.
 */
export function buildPlanTargets(
  efforts: ClimbEffort[],
  modifier: PlanModifier,
  dims: PlanDims = NO_DIMS,
): PlanTarget[] {
  // 1. Ryhmittele effortit grade-systemiin + ulottuvuusvariantiin → aste → summattu määrä.
  interface Variant {
    holdType: HoldType | null;
    steepness: Steepness | null;
    byGrade: Map<string, number>;
  }
  const bySystem = new Map<GradeSystem, Map<string, Variant>>();
  for (const e of efforts) {
    let variants = bySystem.get(e.gradeSystem);
    if (!variants) {
      variants = new Map<string, Variant>();
      bySystem.set(e.gradeSystem, variants);
    }
    const key = dimKey(e.holdType, e.steepness, dims);
    let variant = variants.get(key);
    if (!variant) {
      variant = {
        holdType: dims.holdType ? e.holdType : null,
        steepness: dims.steepness ? e.steepness : null,
        byGrade: new Map<string, number>(),
      };
      variants.set(key, variant);
    }
    variant.byGrade.set(e.gradeValue, (variant.byGrade.get(e.gradeValue) ?? 0) + e.count);
  }

  // 2.–3. Sovella modifikaattori per systeemi+variantti ja litistä tavoitteiksi.
  const out: PlanTarget[] = [];
  for (const [gradeSystem, variants] of bySystem) {
    for (const variant of variants.values()) {
      const counts: GradeCount[] = [...variant.byGrade.entries()].map(([gradeValue, count]) => ({
        gradeValue,
        count,
      }));
      const modified = applyModifier(counts, modifier, gradeSystem);
      for (const c of modified) {
        if (c.count <= 0) continue;
        const target: PlanTarget = { gradeSystem, gradeValue: c.gradeValue, target: c.count };
        if (dims.holdType) target.holdType = variant.holdType;
        if (dims.steepness) target.steepness = variant.steepness;
        out.push(target);
      }
    }
  }
  return out;
}
