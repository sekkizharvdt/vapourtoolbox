/**
 * Stream Calculations for SSOT
 *
 * Auto-calculates thermodynamic properties based on fluid type:
 * - SEA WATER / BRINE WATER: Uses seawater correlations (requires TDS)
 * - DISTILLATE WATER / FEED WATER: Uses pure water properties
 * - STEAM: Uses IAPWS-IF97 steam tables
 * - NCG: Uses ideal gas approximations
 */

import {
  getSeawaterDensity,
  getSeawaterEnthalpy,
  getDensityVapor,
  getEnthalpyVapor,
} from '@vapour/constants';
import type { FluidType, ProcessStreamInput } from '@vapour/types';

// ============================================================================
// Types
// ============================================================================

export interface StreamCalculationResult {
  density: number; // kg/m³
  enthalpy: number; // kJ/kg
  flowRateKgHr: number; // kg/hr (calculated from kg/s)
  pressureBar: number; // bar (calculated from mbar)
}

export interface StreamCalculationInput {
  fluidType: FluidType;
  temperature: number; // °C
  pressureMbar: number; // mbar(a)
  flowRateKgS: number; // kg/s
  tds?: number; // ppm (required for seawater/brine)
}

// ============================================================================
// Fluid Type Detection
// ============================================================================

/**
 * Infer fluid type from line tag prefix
 *
 * Common prefixes:
 * - SW: Sea Water
 * - B: Brine
 * - D: Distillate
 * - S: Steam
 * - NCG: Non-Condensable Gas
 * - FW: Feed Water
 */
export function inferFluidType(lineTag: string): FluidType {
  const tag = lineTag.toUpperCase().trim();

  if (tag.startsWith('SW')) return 'SEA WATER';
  if (tag.startsWith('B')) return 'BRINE WATER';
  if (tag.startsWith('D')) return 'DISTILLATE WATER';
  if (tag.startsWith('S')) return 'STEAM';
  if (tag.startsWith('NCG')) return 'NCG';
  if (tag.startsWith('FW')) return 'FEED WATER';

  // Default to sea water if unknown
  return 'SEA WATER';
}

// ============================================================================
// Property Calculations
// ============================================================================

/**
 * Calculate density based on fluid type
 */
export function calculateDensity(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) {
        throw new Error(`TDS is required for ${fluidType} density calculation`);
      }
      return getSeawaterDensity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterDensity(0, temperature);

    case 'STEAM':
      // Steam density from steam tables
      return getDensityVapor(temperature);

    case 'NCG': {
      // NCG (Non-Condensable Gas) - approximate as ideal gas
      // Assume mostly air: M ≈ 29 g/mol
      // ρ = P*M / (R*T) where R = 8.314 J/(mol·K)
      const pressurePa = (pressureMbar || 1000) * 100; // mbar to Pa
      const tempK = temperature + 273.15;
      const M = 0.029; // kg/mol
      const R = 8.314; // J/(mol·K)
      return (pressurePa * M) / (R * tempK);
    }

    default:
      throw new Error(`Unknown fluid type: ${fluidType}`);
  }
}

/**
 * Calculate enthalpy based on fluid type
 */
export function calculateEnthalpy(fluidType: FluidType, temperature: number, tds?: number): number {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) {
        throw new Error(`TDS is required for ${fluidType} enthalpy calculation`);
      }
      return getSeawaterEnthalpy(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterEnthalpy(0, temperature);

    case 'STEAM':
      // Saturated steam enthalpy
      return getEnthalpyVapor(temperature);

    case 'NCG':
      // NCG enthalpy - approximate as ideal gas with Cp ≈ 1.0 kJ/(kg·K)
      // Reference state: h = 0 at 0°C
      return 1.0 * temperature;

    default:
      throw new Error(`Unknown fluid type: ${fluidType}`);
  }
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate all stream properties from input data
 *
 * This function:
 * 1. Converts flow rate from kg/s to kg/hr
 * 2. Converts pressure from mbar to bar
 * 3. Calculates density based on fluid type
 * 4. Calculates enthalpy based on fluid type
 */
export function calculateStreamProperties(input: StreamCalculationInput): StreamCalculationResult {
  const { fluidType, temperature, pressureMbar, flowRateKgS, tds } = input;

  // Unit conversions
  const flowRateKgHr = flowRateKgS * 3600;
  const pressureBar = pressureMbar / 1000;

  // Calculate properties
  const density = calculateDensity(fluidType, temperature, tds, pressureMbar);
  const enthalpy = calculateEnthalpy(fluidType, temperature, tds);

  return {
    density,
    enthalpy,
    flowRateKgHr,
    pressureBar,
  };
}

/**
 * Auto-fill calculated fields for a stream input
 *
 * Use this when creating or updating streams to ensure
 * all calculated fields are properly set.
 */
export function enrichStreamInput(input: ProcessStreamInput): ProcessStreamInput {
  const { fluidType, temperature, pressureMbar, flowRateKgS, tds } = input;

  // Skip calculation if required fields are missing
  if (temperature === undefined || pressureMbar === undefined || flowRateKgS === undefined) {
    return input;
  }

  try {
    const calculated = calculateStreamProperties({
      fluidType,
      temperature,
      pressureMbar,
      flowRateKgS,
      tds,
    });

    return {
      ...input,
      flowRateKgHr: calculated.flowRateKgHr,
      pressureBar: calculated.pressureBar,
      density: calculated.density,
      enthalpy: calculated.enthalpy,
    };
  } catch (error) {
    // If calculation fails (e.g., out of range), return input unchanged
    console.warn('[streamCalculations] Calculation failed:', error);
    return input;
  }
}
