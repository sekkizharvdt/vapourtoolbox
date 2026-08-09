/**
 * Metal mass of a vessel's pressure envelope, from geometry.
 *
 * The shell and dished heads of any cylindrical vessel — no tubes, no
 * tubesheets, no allowances. Those belong to whatever exchanger sits inside,
 * and lumping them in is what makes `metalMassKg` a shipping figure rather
 * than a thermal one.
 *
 * ── Why this is its own module ───────────────────────────────────────────
 * `med/weightEstimation.ts` already computes shell and head weights, but
 * `estimateShellWeight()` cannot be reused as-is:
 *
 *   - it hardcodes `DENSITY.duplex_ss` for the shell whatever material is
 *     specified — the source of the +2.56% divergence published in
 *     `metal-properties.json`
 *   - it demands tube count, OD, wall, length and tube density, none of which
 *     a flash chamber has
 *
 * So the vessel-envelope part is extracted here, keyed off a real
 * `MetalGrade`, and both callers converge on it (rule 32). `dishedHeadMassKg`
 * is the same 2:1 SE relation `weightEstimation.dishedHeadWeight` uses, moved
 * rather than copied.
 *
 * ── What a thermal consumer should know ──────────────────────────────────
 * This is the metal in contact with the process fluid on one side and ambient
 * on the other, which is what a lumped wall wants. It EXCLUDES the support
 * skirt (thermally remote from the contents), nozzles, flanges, stiffening
 * rings and internals — none of which this repo's flash chamber model sizes.
 * The result is therefore a floor, not a total.
 *
 * ⚠ The mass is only as good as the wall thickness, and for a vacuum vessel
 * that thickness is set by external-pressure buckling (ASME VIII Div 1 UG-28)
 * plus corrosion allowance and minimum practical plate. This repo performs
 * none of that. A mass derived from an assumed thickness is an ASSUMED MASS
 * and must be labelled one all the way to the consumer — hence
 * `wallThicknessSource` travelling with every result.
 */

import { METAL_PROPERTIES, type MetalGrade } from '@vapour/constants';

/** Mass of a cylindrical shell course, kg. */
export function cylindricalShellMassKg(
  insideDiameterMM: number,
  lengthMM: number,
  thicknessMM: number,
  densityKgM3: number
): number {
  const id = insideDiameterMM / 1000;
  const t = thicknessMM / 1000;
  const l = lengthMM / 1000;
  const od = id + 2 * t;

  // Annulus area × length × density — not π·D_mean·t·L, which is the thin-wall
  // approximation and drifts as t/D grows.
  return Math.PI * ((od * od - id * id) / 4) * l * densityKgM3;
}

/**
 * Mass of one 2:1 semi-ellipsoidal dished head, kg.
 *
 * `W = (π/4) · D² · t · ρ · K` with `K = 1.084`, the standard blank-area factor
 * for 2:1 SE that accounts for the knuckle region. Approximate by construction:
 * it carries no knuckle radius and no straight flange, because the flash chamber
 * model specifies neither.
 */
export function dishedHeadMassKg(
  insideDiameterMM: number,
  thicknessMM: number,
  densityKgM3: number
): number {
  const d = insideDiameterMM / 1000;
  const t = thicknessMM / 1000;
  const K = 1.084;

  return (Math.PI / 4) * d * d * t * densityKgM3 * K;
}

export interface VesselEnvelopeInput {
  /** Shell inside diameter, mm */
  insideDiameterMM: number;
  /** Tangent-to-tangent length of the cylindrical section, mm */
  tangentToTangentMM: number;
  /** Wall thickness, mm — same plate assumed for shell and heads */
  thicknessMM: number;
  /** Grade, keyed into METAL_PROPERTIES */
  grade: MetalGrade;
  /** Number of dished heads; 2 for a closed vessel */
  headCount?: number;
}

export interface VesselEnvelopeMass {
  /** Cylindrical shell, kg */
  shellKg: number;
  /** All dished heads together, kg */
  dishedHeadsKg: number;
  /** Shell + heads, kg. The pressure envelope only */
  totalKg: number;
  /** Density used, kg/m³ — echoed so the figure can be checked, not just compared */
  densityKgM3: number;
  /** Heat capacity of the envelope, J/K — the product a dynamic model wants */
  heatCapacityJPerK: number;
}

/**
 * Shell + heads for a cylindrical vessel.
 *
 * Returns the components separately as well as the total: a consumer modelling
 * only the wetted cylinder can drop the heads, and one that disagrees with the
 * 2:1 SE factor can recompute them, neither of which is possible from a total.
 */
export function vesselEnvelopeMass(input: VesselEnvelopeInput): VesselEnvelopeMass {
  const { insideDiameterMM, tangentToTangentMM, thicknessMM, grade, headCount = 2 } = input;
  const { densityKgM3, specificHeatJPerKgK } = METAL_PROPERTIES[grade];

  const shellKg = cylindricalShellMassKg(
    insideDiameterMM,
    tangentToTangentMM,
    thicknessMM,
    densityKgM3
  );
  const dishedHeadsKg = headCount * dishedHeadMassKg(insideDiameterMM, thicknessMM, densityKgM3);
  const totalKg = shellKg + dishedHeadsKg;

  return {
    shellKg,
    dishedHeadsKg,
    totalKg,
    densityKgM3,
    // Formed here rather than left to the caller so a mass cannot be paired
    // with the wrong grade's specific heat.
    heatCapacityJPerK: totalKg * specificHeatJPerKgK,
  };
}
