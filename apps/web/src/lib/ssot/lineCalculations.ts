/**
 * Line Calculations for SSOT
 *
 * Calculates pipe sizing based on flow rate and design velocity.
 * Uses continuity equation: A = Q / V, where D = sqrt(4A/π)
 */

import type { ProcessLineInput } from '@vapour/types';

// ============================================================================
// Constants
// ============================================================================

/** Default design velocity in m/s (typical for liquid process lines) */
export const DEFAULT_DESIGN_VELOCITY = 1.5;

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

  // Calculate required ID from design velocity
  const designVelocity = inputDesignVelocity || DEFAULT_DESIGN_VELOCITY;
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
