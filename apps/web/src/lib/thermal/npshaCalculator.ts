/**
 * NPSHa (Net Positive Suction Head Available) Calculator
 *
 * Calculate NPSHa for pump suction systems under various conditions
 * including open tanks, closed vessels, and vacuum systems.
 *
 * NPSHa = Hs + Hp - Hvp - Hf
 *
 * Where:
 * - Hs = Static head (liquid level above pump centerline)
 * - Hp = Pressure head (vessel pressure converted to head)
 * - Hvp = Vapor pressure head (at liquid temperature)
 * - Hf = Friction loss in suction piping
 *
 * Reference: Hydraulic Institute Standards
 */

import {
  getSaturationPressure,
  getBoilingPointElevation,
  getSeawaterDensity,
  getDensityLiquid,
} from '@vapour/constants';
import { ATM_PRESSURE_BAR, barToHead as _barToHead, headToBar as _headToBar } from './thermalUtils';

// Re-export for backward compatibility
export const barToHead = _barToHead;
export const headToBar = _headToBar;

// ============================================================================
// Types
// ============================================================================

/**
 * Vessel type for NPSHa calculation
 */
export type VesselType = 'OPEN' | 'CLOSED' | 'VACUUM';

/**
 * Liquid type
 */
export type LiquidType = 'PURE_WATER' | 'SEAWATER';

/**
 * Input parameters for NPSHa calculation
 */
export interface NPSHaInput {
  /** Type of vessel/source */
  vesselType: VesselType;
  /** Liquid level above pump centerline in m (positive = above pump) */
  liquidLevelAbovePump: number;
  /** Vessel pressure in bar abs (for closed/vacuum vessel) */
  vesselPressure?: number;
  /** Atmospheric pressure in bar abs (for open vessel, default 1.01325) */
  atmosphericPressure?: number;
  /** Liquid temperature in °C */
  liquidTemperature: number;
  /** Type of liquid */
  liquidType: LiquidType;
  /** Salinity in ppm (for seawater) */
  salinity?: number;
  /** Estimated friction loss in suction piping in m */
  frictionLoss: number;
}

/**
 * Result of NPSHa calculation
 */
export interface NPSHaResult {
  /** Static head (liquid level) in m */
  staticHead: number;
  /** Pressure head from vessel/atmospheric pressure in m */
  pressureHead: number;
  /** Vapor pressure head at liquid temperature in m */
  vaporPressureHead: number;
  /** Boiling point elevation (for seawater) in °C */
  boilingPointElevation: number;
  /** Friction loss in suction piping in m */
  frictionLoss: number;
  /** Net Positive Suction Head Available in m */
  npshAvailable: number;
  /** Liquid density used for calculation in kg/m³ */
  liquidDensity: number;
  /** Vapor pressure of liquid in bar abs */
  vaporPressure: number;
  /** Recommendation for pump selection */
  recommendation: string;
  /** Warnings */
  warnings: string[];
  /** Detailed breakdown */
  breakdown: {
    component: string;
    value: number;
    sign: '+' | '-';
    description: string;
  }[];
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate NPSHa (Net Positive Suction Head Available)
 *
 * @param input - NPSHa calculation input
 * @returns NPSHa calculation result
 */
export function calculateNPSHa(input: NPSHaInput): NPSHaResult {
  const warnings: string[] = [];
  const breakdown: NPSHaResult['breakdown'] = [];

  // Get liquid density
  let liquidDensity: number;
  let boilingPointElevation = 0;

  if (input.liquidType === 'SEAWATER' && input.salinity) {
    try {
      liquidDensity = getSeawaterDensity(input.salinity, input.liquidTemperature);
      boilingPointElevation = getBoilingPointElevation(input.salinity, input.liquidTemperature);
    } catch {
      liquidDensity = 1025; // fallback
      warnings.push('Could not calculate seawater properties, using default density');
    }
  } else {
    try {
      liquidDensity = getDensityLiquid(input.liquidTemperature);
    } catch {
      liquidDensity = 1000; // fallback
    }
  }

  // Calculate static head (Hs)
  const staticHead = input.liquidLevelAbovePump;
  breakdown.push({
    component: 'Static Head (Hs)',
    value: staticHead,
    sign: staticHead >= 0 ? '+' : '-',
    description: `Liquid level ${Math.abs(staticHead).toFixed(2)}m ${staticHead >= 0 ? 'above' : 'below'} pump centerline`,
  });

  if (staticHead < 0) {
    warnings.push('Liquid level is below pump centerline - verify suction lift capability');
  }

  // Calculate pressure head (Hp)
  let pressureBar: number;
  let pressureDescription: string;

  if (input.vesselType === 'OPEN') {
    pressureBar = input.atmosphericPressure ?? ATM_PRESSURE_BAR;
    pressureDescription = `Atmospheric pressure: ${(pressureBar * 1000).toFixed(0)} mbar`;
  } else {
    pressureBar = input.vesselPressure ?? ATM_PRESSURE_BAR;
    if (input.vesselType === 'VACUUM') {
      pressureDescription = `Vacuum vessel at ${(pressureBar * 1000).toFixed(0)} mbar abs`;
    } else {
      pressureDescription = `Closed vessel at ${pressureBar.toFixed(3)} bar abs`;
    }
  }

  const pressureHead = barToHead(pressureBar, liquidDensity);
  breakdown.push({
    component: 'Pressure Head (Hp)',
    value: pressureHead,
    sign: '+',
    description: pressureDescription,
  });

  // Calculate vapor pressure head (Hvp)
  // For seawater, account for BPE - actual boiling point is higher than pure water
  // But vapor pressure is based on pure water at that temperature
  let vaporPressure: number;
  try {
    // Use actual liquid temperature for vapor pressure
    vaporPressure = getSaturationPressure(input.liquidTemperature);
  } catch {
    // If outside valid range, estimate conservatively
    vaporPressure = 0.01; // Low estimate
    warnings.push('Temperature outside steam table range, using conservative vapor pressure');
  }

  const vaporPressureHead = barToHead(vaporPressure, liquidDensity);
  breakdown.push({
    component: 'Vapor Pressure Head (Hvp)',
    value: vaporPressureHead,
    sign: '-',
    description: `Vapor pressure ${(vaporPressure * 1000).toFixed(1)} mbar at ${input.liquidTemperature}°C`,
  });

  // For seawater, note BPE effect
  if (input.liquidType === 'SEAWATER' && boilingPointElevation > 0.1) {
    breakdown.push({
      component: 'BPE Note',
      value: boilingPointElevation,
      sign: '+',
      description: `Seawater BPE of ${boilingPointElevation.toFixed(2)}°C reduces cavitation risk`,
    });
  }

  // Friction loss (Hf)
  const frictionLoss = input.frictionLoss;
  breakdown.push({
    component: 'Friction Loss (Hf)',
    value: frictionLoss,
    sign: '-',
    description: `Suction piping losses: ${frictionLoss.toFixed(2)} m`,
  });

  // Calculate NPSHa
  // NPSHa = Hs + Hp - Hvp - Hf
  const npshAvailable = staticHead + pressureHead - vaporPressureHead - frictionLoss;

  // Generate recommendation
  let recommendation: string;
  if (npshAvailable < 0) {
    recommendation =
      'CRITICAL: NPSHa is negative - pump will cavitate. Increase liquid level, reduce friction loss, or lower liquid temperature.';
    warnings.push('NPSHa is negative - cavitation will occur');
  } else if (npshAvailable < 1) {
    recommendation =
      'WARNING: Very low NPSHa. Select a pump with NPSHr < 0.5m and add safety margin.';
    warnings.push('NPSHa is very low - limited pump options');
  } else if (npshAvailable < 2) {
    recommendation =
      'Select a pump with NPSHr < ' +
      (npshAvailable * 0.6).toFixed(1) +
      'm. Consider centrifugal pumps with low NPSHr impellers.';
  } else if (npshAvailable < 5) {
    recommendation =
      'NPSHa is adequate. Standard centrifugal pumps with NPSHr < ' +
      (npshAvailable * 0.7).toFixed(1) +
      'm are suitable.';
  } else {
    recommendation =
      'NPSHa is excellent. Wide selection of pumps available. Ensure NPSHr < ' +
      (npshAvailable * 0.8).toFixed(1) +
      'm.';
  }

  // Check for vacuum operation
  if (input.vesselType === 'VACUUM' && pressureBar < 0.1) {
    warnings.push('Operating under deep vacuum - ensure pump seal system is compatible');
  }

  // Check for high temperature
  if (input.liquidTemperature > 90) {
    warnings.push('High temperature operation - verify pump materials and seal compatibility');
  }

  return {
    staticHead,
    pressureHead,
    vaporPressureHead,
    boilingPointElevation,
    frictionLoss,
    npshAvailable,
    liquidDensity,
    vaporPressure,
    recommendation,
    warnings,
    breakdown,
  };
}

/**
 * Calculate minimum liquid level required for given NPSHr
 *
 * @param npshr - Required NPSH from pump datasheet in m
 * @param input - Other NPSHa input parameters
 * @param safetyMargin - Safety margin above NPSHr (default 0.5m)
 * @returns Minimum liquid level above pump in m
 */
export function calculateMinimumLiquidLevel(
  npshr: number,
  input: Omit<NPSHaInput, 'liquidLevelAbovePump'>,
  safetyMargin: number = 0.5
): number {
  // Solve for Hs from: NPSHr + margin = Hs + Hp - Hvp - Hf
  // Hs = NPSHr + margin - Hp + Hvp + Hf

  // First calculate with a dummy liquid level to get other heads
  const tempResult = calculateNPSHa({
    ...input,
    liquidLevelAbovePump: 0,
  });

  const requiredNPSHa = npshr + safetyMargin;
  const minLiquidLevel =
    requiredNPSHa -
    tempResult.pressureHead +
    tempResult.vaporPressureHead +
    tempResult.frictionLoss;

  return minLiquidLevel;
}
