/**
 * Line Calculations for SSOT
 *
 * Calculates pipe sizing based on flow rate and design velocity.
 * Uses continuity equation: A = Q / V, where D = sqrt(4A/π)
 */

import { FLUID_TYPES, type FluidType, type ProcessLineInput } from '@vapour/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Fallback design velocity in m/s, used only when the line's fluid is not a
 * recognised `FluidType`.
 *
 * This is a LIQUID velocity. It was previously the single default for every
 * line regardless of service, which meant a hand-entered gas line was sized as
 * though it were water — a biogas main at 1.5 m/s comes out several pipe sizes
 * too large. Prefer `getDesignVelocity(fluid)`, which is fluid-aware; this
 * constant remains only for the case where the fluid string is unrecognised.
 */
export const DEFAULT_DESIGN_VELOCITY = 1.5;

/**
 * Design velocity per fluid service, m/s.
 *
 * ⚠ THE GAS VALUES ARE ASSUMED AND AWAIT CONFIRMATION (plan §2.7, checkpoint
 * CP1). They are typical process-design figures, not values this repo derived
 * or that the team has signed off. They are stated here rather than buried so
 * they can be reviewed as numbers: changing one changes every line size
 * computed from it.
 *
 * Liquids keep 1.5 m/s — the value already in use, unchanged, so no existing
 * line resizes as a side effect of this change.
 *
 * Gas services are sized at a velocity here, but low-pressure gas mains are
 * commonly sized on allowable pressure drop per unit length instead, because a
 * blower has very little head to spend. Which basis applies is the open
 * question in §2.7; until it is answered these velocities are the stand-in.
 */
export const DESIGN_VELOCITY_BY_FLUID: Record<FluidType, number> = {
  // ── Liquids: unchanged from the previous single default ─────────────────
  'SEA WATER': 1.5,
  'BRINE WATER': 1.5,
  'DISTILLATE WATER': 1.5,
  'FEED WATER': 1.5,

  // ── Gases and vapours: ASSUMED, pending CP1 ─────────────────────────────
  /** Vapour ducts and steam mains. Typical range 25–40 m/s. */
  STEAM: 30,
  /** Non-condensable gas headers to the vacuum system. Typical range 15–25 m/s. */
  NCG: 20,
  /** Biogas mains at low pressure. Typical range 5–15 m/s. */
  BIOGAS: 10,
};

/**
 * Design velocity for a line's fluid service, m/s.
 *
 * `ProcessLine.fluid` is a free string rather than a `FluidType` — generators
 * write the fluid type into it, but a hand-entered line may hold anything. An
 * unrecognised value falls back to the liquid default rather than guessing at a
 * phase, since a wrong liquid velocity oversizes a line while a wrong gas
 * velocity can undersize one.
 */
export function getDesignVelocity(fluid: string | undefined): number {
  if (!fluid) return DEFAULT_DESIGN_VELOCITY;
  const normalised = fluid.toUpperCase().trim();
  const match = FLUID_TYPES.find((f) => f === normalised);
  return match ? DESIGN_VELOCITY_BY_FLUID[match] : DEFAULT_DESIGN_VELOCITY;
}

// ============================================================================
// Calculations
// ============================================================================

/**
 * Calculate required inner diameter from flow and velocity
 *
 * From continuity: Q = A × V
 * A = Q / V
 * A = π × D² / 4
 * D = sqrt(4 × Q / (π × V))
 *
 * @param flowRateKgS - Flow rate in kg/s
 * @param density - Density in kg/m³
 * @param velocity - Design velocity in m/s
 * @returns Inner diameter in mm
 */
export function calculateInnerDiameter(
  flowRateKgS: number,
  density: number,
  velocity: number
): number {
  // Volumetric flow rate: Q = m / ρ (m³/s)
  const volumetricFlow = flowRateKgS / density;

  // Cross-sectional area: A = Q / V (m²)
  const area = volumetricFlow / velocity;

  // Diameter from area: D = sqrt(4A/π) (m)
  const diameterM = Math.sqrt((4 * area) / Math.PI);

  // Convert to mm
  return diameterM * 1000;
}

/**
 * Calculate actual velocity from flow and diameter
 *
 * V = Q / A = 4Q / (π × D²)
 *
 * @param flowRateKgS - Flow rate in kg/s
 * @param density - Density in kg/m³
 * @param innerDiameterMm - Inner diameter in mm
 * @returns Velocity in m/s
 */
export function calculateVelocity(
  flowRateKgS: number,
  density: number,
  innerDiameterMm: number
): number {
  // Volumetric flow rate: Q = m / ρ (m³/s)
  const volumetricFlow = flowRateKgS / density;

  // Diameter in meters
  const diameterM = innerDiameterMm / 1000;

  // Cross-sectional area: A = π × D² / 4 (m²)
  const area = (Math.PI * diameterM * diameterM) / 4;

  // Velocity: V = Q / A (m/s)
  return volumetricFlow / area;
}

// ============================================================================
// Input Enrichment
// ============================================================================

/**
 * Enrich line input with calculated values
 *
 * Calculates:
 * - calculatedID from flowRateKgS, density, and calculatedVelocity
 * - actualVelocity from flowRateKgS, density, and selectedID
 */
export function enrichLineInput(input: ProcessLineInput): ProcessLineInput {
  const { flowRateKgS, density, designVelocity: inputDesignVelocity, selectedID } = input;

  // Skip if missing required fields
  if (flowRateKgS === undefined || density === undefined || density <= 0) {
    return input;
  }

  let calculatedID = input.calculatedID;
  let actualVelocity = input.actualVelocity;

  // Calculate required ID from design velocity. An explicit velocity on the
  // input always wins — generated lines carry the one the design sized them at.
  const designVelocity = inputDesignVelocity || getDesignVelocity(input.fluid);
  if (flowRateKgS > 0 && designVelocity > 0) {
    calculatedID = calculateInnerDiameter(flowRateKgS, density, designVelocity);
  }

  // Calculate actual velocity from selected ID
  if (selectedID && selectedID > 0 && flowRateKgS > 0) {
    actualVelocity = calculateVelocity(flowRateKgS, density, selectedID);
  }

  return {
    ...input,
    designVelocity,
    calculatedID,
    actualVelocity,
  };
}
