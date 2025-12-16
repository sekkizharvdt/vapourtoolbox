/**
 * Stream Calculations for SSOT
 *
 * Auto-calculates thermodynamic properties based on fluid type:
 * - SEA WATER / BRINE WATER: Uses seawater correlations (requires TDS)
 * - DISTILLATE WATER / FEED WATER: Uses pure water properties
 * - STEAM: Uses IAPWS-IF97 steam tables (pressure-aware)
 * - NCG: Uses ideal gas approximations
 */

import {
  // Seawater properties
  getSeawaterDensity,
  getSeawaterEnthalpy,
  getSeawaterSpecificHeat,
  getSeawaterViscosity,
  getSeawaterThermalConductivity,
  getBoilingPointElevation,
  // Steam saturation properties
  getDensityVapor,
  getEnthalpyVapor,
  // Pressure-aware steam properties
  getRegion,
  getDensityAtPT,
  getEnthalpy,
  getSteamProperties,
  // Region-specific steam properties
  getSpecificHeatSubcooled,
  getSpecificHeatSuperheated,
  getEntropySubcooled,
  getEntropySuperheated,
} from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import type { FluidType, ProcessStreamInput, SteamRegion } from '@vapour/types';

const logger = createLogger({ context: 'streamCalculations' });

// ============================================================================
// Types
// ============================================================================

export interface StreamCalculationResult {
  // Core properties
  density: number; // kg/m³
  enthalpy: number; // kJ/kg
  flowRateKgHr: number; // kg/hr (calculated from kg/s)
  pressureBar: number; // bar (calculated from mbar)
  // Extended properties
  specificHeat?: number; // kJ/(kg·K) - Cp
  viscosity?: number; // Pa·s - dynamic viscosity
  thermalConductivity?: number; // W/(m·K) - for seawater
  entropy?: number; // kJ/(kg·K) - for steam
  boilingPointElevation?: number; // °C - for seawater/brine
  steamRegion?: SteamRegion; // For steam: saturation, subcooled, or superheated
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
// Steam Region Detection
// ============================================================================

/**
 * Determine steam region from pressure and temperature
 * Returns the region as a SteamRegion type for the data model
 */
function getSteamRegionType(pressureBar: number, tempC: number): SteamRegion {
  try {
    const region = getRegion(pressureBar, tempC);
    switch (region) {
      case 1:
        return 'subcooled';
      case 2:
        return 'superheated';
      case 4:
      default:
        return 'saturation';
    }
  } catch {
    // Default to saturation if out of range
    return 'saturation';
  }
}

// ============================================================================
// Property Calculations
// ============================================================================

/**
 * Calculate density based on fluid type
 * Now pressure-aware for steam calculations
 */
export function calculateDensity(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

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

    case 'STEAM': {
      // Use pressure-aware steam density calculation
      try {
        return getDensityAtPT(pressureBar, temperature);
      } catch {
        // Fall back to saturation vapor density if out of range
        return getDensityVapor(temperature);
      }
    }

    case 'NCG': {
      // NCG (Non-Condensable Gas) - approximate as ideal gas
      // Assume mostly air: M ≈ 29 g/mol
      // ρ = P*M / (R*T) where R = 8.314 J/(mol·K)
      const pressurePa = pressureMbar! * 100; // mbar to Pa
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
 * Now pressure-aware for steam calculations
 */
export function calculateEnthalpy(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

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

    case 'STEAM': {
      // Use pressure-aware steam enthalpy calculation
      try {
        return getEnthalpy(pressureBar, temperature);
      } catch {
        // Fall back to saturation vapor enthalpy if out of range
        return getEnthalpyVapor(temperature);
      }
    }

    case 'NCG':
      // NCG enthalpy - approximate as ideal gas with Cp ≈ 1.0 kJ/(kg·K)
      // Reference state: h = 0 at 0°C
      return 1.0 * temperature;

    default:
      throw new Error(`Unknown fluid type: ${fluidType}`);
  }
}

/**
 * Calculate specific heat (Cp) based on fluid type
 */
export function calculateSpecificHeat(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number | undefined {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterSpecificHeat(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterSpecificHeat(0, temperature);

    case 'STEAM': {
      // Use pressure-aware steam specific heat
      try {
        const region = getRegion(pressureBar, temperature);
        if (region === 1) {
          return getSpecificHeatSubcooled(pressureBar, temperature);
        } else if (region === 2) {
          return getSpecificHeatSuperheated(pressureBar, temperature);
        }
        // For saturation, use approximate value
        const props = getSteamProperties(pressureBar, temperature);
        return props.specificHeat;
      } catch {
        return undefined;
      }
    }

    case 'NCG':
      // NCG Cp ≈ 1.0 kJ/(kg·K) for air-like gases
      return 1.0;

    default:
      return undefined;
  }
}

/**
 * Calculate dynamic viscosity based on fluid type
 */
export function calculateViscosity(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterViscosity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterViscosity(0, temperature);

    case 'STEAM':
      // Steam viscosity is complex and temperature/pressure dependent
      // For now, use approximate correlation for low-pressure steam
      // μ = μ₀ × (T/T₀)^0.5 where μ₀ ≈ 12.5e-6 Pa·s at 100°C
      return 12.5e-6 * Math.pow((temperature + 273.15) / 373.15, 0.5);

    case 'NCG':
      // Air viscosity approximation
      // μ = μ₀ × (T/T₀)^0.7 where μ₀ ≈ 18.2e-6 Pa·s at 20°C
      return 18.2e-6 * Math.pow((temperature + 273.15) / 293.15, 0.7);

    default:
      return undefined;
  }
}

/**
 * Calculate thermal conductivity based on fluid type
 * Only applicable to seawater and pure water
 */
export function calculateThermalConductivity(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterThermalConductivity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterThermalConductivity(0, temperature);

    case 'STEAM':
    case 'NCG':
      // Thermal conductivity for gases is less commonly needed
      // Return undefined for now
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Calculate entropy based on fluid type
 * Only applicable to steam
 */
export function calculateEntropy(
  fluidType: FluidType,
  temperature: number,
  pressureMbar?: number
): number | undefined {
  if (fluidType !== 'STEAM') {
    return undefined;
  }

  const pressureBar = (pressureMbar || 1013.25) / 1000;

  try {
    const region = getRegion(pressureBar, temperature);
    if (region === 1) {
      return getEntropySubcooled(pressureBar, temperature);
    } else if (region === 2) {
      return getEntropySuperheated(pressureBar, temperature);
    }
    // For saturation, use getSteamProperties
    const props = getSteamProperties(pressureBar, temperature);
    return props.entropy;
  } catch {
    return undefined;
  }
}

/**
 * Calculate boiling point elevation
 * Only applicable to seawater and brine
 */
export function calculateBoilingPointElevation(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  if (fluidType !== 'SEA WATER' && fluidType !== 'BRINE WATER') {
    return undefined;
  }

  if (tds === undefined) {
    return undefined;
  }

  try {
    return getBoilingPointElevation(tds, temperature);
  } catch {
    return undefined;
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
 * 3. Calculates density based on fluid type (pressure-aware for steam)
 * 4. Calculates enthalpy based on fluid type (pressure-aware for steam)
 * 5. Calculates extended properties: Cp, viscosity, thermal conductivity, entropy, BPE
 */
export function calculateStreamProperties(input: StreamCalculationInput): StreamCalculationResult {
  const { fluidType, temperature, pressureMbar, flowRateKgS, tds } = input;

  // Unit conversions
  const flowRateKgHr = flowRateKgS * 3600;
  const pressureBar = pressureMbar / 1000;

  // Calculate core properties
  const density = calculateDensity(fluidType, temperature, tds, pressureMbar);
  const enthalpy = calculateEnthalpy(fluidType, temperature, tds, pressureMbar);

  // Calculate extended properties
  const specificHeat = calculateSpecificHeat(fluidType, temperature, tds, pressureMbar);
  const viscosity = calculateViscosity(fluidType, temperature, tds);
  const thermalConductivity = calculateThermalConductivity(fluidType, temperature, tds);
  const entropy = calculateEntropy(fluidType, temperature, pressureMbar);
  const boilingPointElevation = calculateBoilingPointElevation(fluidType, temperature, tds);

  // Determine steam region if applicable
  const steamRegion =
    fluidType === 'STEAM' ? getSteamRegionType(pressureBar, temperature) : undefined;

  return {
    density,
    enthalpy,
    flowRateKgHr,
    pressureBar,
    specificHeat,
    viscosity,
    thermalConductivity,
    entropy,
    boilingPointElevation,
    steamRegion,
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
      specificHeat: calculated.specificHeat,
      viscosity: calculated.viscosity,
      thermalConductivity: calculated.thermalConductivity,
      entropy: calculated.entropy,
      boilingPointElevation: calculated.boilingPointElevation,
      steamRegion: calculated.steamRegion,
    };
  } catch (error) {
    // If calculation fails (e.g., out of range), return input unchanged
    logger.warn('Stream calculation failed, returning input unchanged', {
      error,
      fluidType,
      temperature,
      pressureMbar,
    });
    return input;
  }
}
