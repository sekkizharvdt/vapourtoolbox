/**
 * Heat Duty Calculator
 *
 * Calculate sensible and latent heat duty for thermal processes.
 * Includes LMTD calculation for heat exchanger sizing.
 *
 * Equations:
 * - Sensible heat: Q = m × Cp × ΔT
 * - Latent heat: Q = m × hfg
 * - LMTD: (ΔT1 - ΔT2) / ln(ΔT1/ΔT2)
 *
 * Reference: Perry's Chemical Engineers' Handbook
 */

import { getSeawaterSpecificHeat, getLatentHeat } from '@vapour/constants';
import { tonHrToKgS } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Fluid type for heat duty calculation
 */
export type HeatFluidType = 'PURE_WATER' | 'SEAWATER' | 'STEAM';

/**
 * Heat transfer process type
 */
export type HeatProcessType = 'SENSIBLE' | 'LATENT' | 'COMBINED';

/**
 * Flow arrangement for LMTD calculation
 */
export type FlowArrangement = 'COUNTER' | 'PARALLEL' | 'CROSSFLOW';

/**
 * Input for sensible heat calculation
 */
export interface SensibleHeatInput {
  /** Fluid type */
  fluidType: HeatFluidType;
  /** Salinity in ppm (for seawater) */
  salinity?: number;
  /** Mass flow rate in ton/hr */
  massFlowRate: number;
  /** Inlet temperature in °C */
  inletTemperature: number;
  /** Outlet temperature in °C */
  outletTemperature: number;
}

/**
 * Input for latent heat calculation
 */
export interface LatentHeatInput {
  /** Mass flow rate in ton/hr */
  massFlowRate: number;
  /** Saturation temperature in °C */
  temperature: number;
  /** Process type */
  process: 'EVAPORATION' | 'CONDENSATION';
}

/**
 * Input for LMTD calculation
 */
export interface LMTDInput {
  /** Hot side inlet temperature */
  hotInlet: number;
  /** Hot side outlet temperature */
  hotOutlet: number;
  /** Cold side inlet temperature */
  coldInlet: number;
  /** Cold side outlet temperature */
  coldOutlet: number;
  /** Flow arrangement */
  flowArrangement: FlowArrangement;
}

/**
 * Result of sensible heat calculation
 */
export interface SensibleHeatResult {
  /** Heat duty in kW */
  heatDuty: number;
  /** Average specific heat in kJ/(kg·K) */
  specificHeat: number;
  /** Temperature change in °C */
  deltaT: number;
  /** Mass flow rate in kg/s */
  massFlowKgS: number;
  /** Is heating (positive) or cooling (negative) */
  isHeating: boolean;
}

/**
 * Result of latent heat calculation
 */
export interface LatentHeatResult {
  /** Heat duty in kW */
  heatDuty: number;
  /** Latent heat of vaporization in kJ/kg */
  latentHeat: number;
  /** Mass flow rate in kg/s */
  massFlowKgS: number;
  /** Process (evaporation/condensation) */
  process: 'EVAPORATION' | 'CONDENSATION';
}

/**
 * Result of LMTD calculation
 */
export interface LMTDResult {
  /** Log Mean Temperature Difference in °C */
  lmtd: number;
  /** Temperature difference at end 1 */
  deltaT1: number;
  /** Temperature difference at end 2 */
  deltaT2: number;
  /** LMTD correction factor (for crossflow) */
  correctionFactor: number;
  /** Corrected LMTD */
  correctedLMTD: number;
  /** Flow arrangement */
  flowArrangement: FlowArrangement;
  /** Warnings */
  warnings: string[];
}

/**
 * Combined heat duty result
 */
export interface CombinedHeatResult {
  sensible?: SensibleHeatResult;
  latent?: LatentHeatResult;
  totalHeatDuty: number;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate sensible heat duty
 *
 * Q = m × Cp × ΔT
 *
 * @param input - Sensible heat input parameters
 * @returns Sensible heat calculation result
 */
export function calculateSensibleHeat(input: SensibleHeatInput): SensibleHeatResult {
  const { fluidType, salinity, massFlowRate, inletTemperature, outletTemperature } = input;

  // Convert mass flow to kg/s
  const massFlowKgS = tonHrToKgS(massFlowRate);

  // Calculate temperature change
  const deltaT = outletTemperature - inletTemperature;
  const isHeating = deltaT > 0;

  // Calculate average specific heat at mean temperature
  const meanTemp = (inletTemperature + outletTemperature) / 2;
  let specificHeat: number;

  if (fluidType === 'SEAWATER' && salinity) {
    specificHeat = getSeawaterSpecificHeat(salinity, meanTemp);
  } else if (fluidType === 'PURE_WATER') {
    // Pure water Cp via Sharqawy correlation at 0 ppm salinity
    specificHeat = getSeawaterSpecificHeat(0, meanTemp);
  } else {
    // Steam (superheated) - approximate
    specificHeat = 2.0; // Approximate for steam
  }

  // Calculate heat duty: Q = m × Cp × ΔT
  // Result in kW (since m is in kg/s, Cp in kJ/kg·K, ΔT in K)
  const heatDuty = Math.abs(massFlowKgS * specificHeat * deltaT);

  return {
    heatDuty,
    specificHeat,
    deltaT: Math.abs(deltaT),
    massFlowKgS,
    isHeating,
  };
}

/**
 * Calculate latent heat duty
 *
 * Q = m × hfg
 *
 * @param input - Latent heat input parameters
 * @returns Latent heat calculation result
 */
export function calculateLatentHeat(input: LatentHeatInput): LatentHeatResult {
  const { massFlowRate, temperature, process } = input;

  // Convert mass flow to kg/s
  const massFlowKgS = tonHrToKgS(massFlowRate);

  // Get latent heat at saturation temperature
  const latentHeat = getLatentHeat(temperature);

  // Calculate heat duty: Q = m × hfg
  const heatDuty = massFlowKgS * latentHeat;

  return {
    heatDuty,
    latentHeat,
    massFlowKgS,
    process,
  };
}

/**
 * Calculate LMTD (Log Mean Temperature Difference)
 *
 * LMTD = (ΔT1 - ΔT2) / ln(ΔT1/ΔT2)
 *
 * @param input - LMTD input parameters
 * @returns LMTD calculation result
 */
export function calculateLMTD(input: LMTDInput): LMTDResult {
  const { hotInlet, hotOutlet, coldInlet, coldOutlet, flowArrangement } = input;
  const warnings: string[] = [];

  let deltaT1: number;
  let deltaT2: number;

  if (flowArrangement === 'COUNTER') {
    // Counter-current: hot inlet vs cold outlet, hot outlet vs cold inlet
    deltaT1 = hotInlet - coldOutlet;
    deltaT2 = hotOutlet - coldInlet;
  } else {
    // Parallel or crossflow: hot inlet vs cold inlet, hot outlet vs cold outlet
    deltaT1 = hotInlet - coldInlet;
    deltaT2 = hotOutlet - coldOutlet;
  }

  // Validate temperature differences
  if (deltaT1 <= 0 || deltaT2 <= 0) {
    warnings.push('Temperature cross detected - invalid heat exchanger configuration');
    return {
      lmtd: 0,
      deltaT1,
      deltaT2,
      correctionFactor: 1,
      correctedLMTD: 0,
      flowArrangement,
      warnings,
    };
  }

  // Calculate LMTD
  let lmtd: number;
  if (Math.abs(deltaT1 - deltaT2) < 0.01) {
    // If ΔT1 ≈ ΔT2, use arithmetic mean to avoid division by zero in ln
    lmtd = (deltaT1 + deltaT2) / 2;
  } else {
    lmtd = (deltaT1 - deltaT2) / Math.log(deltaT1 / deltaT2);
  }

  // Apply correction factor for crossflow
  let correctionFactor = 1.0;
  if (flowArrangement === 'CROSSFLOW') {
    // Simplified crossflow correction factor (single pass, both fluids unmixed)
    // F typically ranges from 0.75 to 0.95
    // Using approximate calculation based on P and R parameters
    const R = (hotInlet - hotOutlet) / (coldOutlet - coldInlet);
    const P = (coldOutlet - coldInlet) / (hotInlet - coldInlet);

    // Simplified crossflow correction (conservative estimate)
    if (R > 0 && R !== 1) {
      const S = Math.sqrt(R * R + 1) / (R - 1);
      const term = (2 - P * (R + 1 - S)) / (2 - P * (R + 1 + S));
      if (term > 0) {
        correctionFactor = (S * Math.log((1 - P) / (1 - P * R))) / Math.log(term);
      }
    }

    // Clamp correction factor to reasonable range
    correctionFactor = Math.max(0.7, Math.min(1.0, correctionFactor));

    if (correctionFactor < 0.8) {
      warnings.push('Low correction factor - consider counter-current arrangement');
    }
  }

  const correctedLMTD = lmtd * correctionFactor;

  // Warnings
  if (lmtd < 5) {
    warnings.push('Very low LMTD may result in large heat exchanger');
  }

  return {
    lmtd,
    deltaT1,
    deltaT2,
    correctionFactor,
    correctedLMTD,
    flowArrangement,
    warnings,
  };
}

/**
 * Calculate heat exchanger duty from LMTD
 *
 * Q = U × A × LMTD
 *
 * @param overallHTC - Overall heat transfer coefficient in W/(m²·K)
 * @param area - Heat transfer area in m²
 * @param lmtd - Log mean temperature difference in °C
 * @returns Heat duty in kW
 */
export function calculateHeatDutyFromLMTD(overallHTC: number, area: number, lmtd: number): number {
  // Q = U × A × LMTD (W)
  // Convert to kW
  return (overallHTC * area * lmtd) / 1000;
}

/**
 * Calculate required heat transfer area
 *
 * A = Q / (U × LMTD)
 *
 * @param heatDuty - Heat duty in kW
 * @param overallHTC - Overall heat transfer coefficient in W/(m²·K)
 * @param lmtd - Log mean temperature difference in °C
 * @returns Required area in m²
 */
export function calculateHeatExchangerArea(
  heatDuty: number,
  overallHTC: number,
  lmtd: number
): number {
  // A = Q / (U × LMTD)
  // Q in kW = Q * 1000 W
  return (heatDuty * 1000) / (overallHTC * lmtd);
}

/**
 * Calculate combined sensible + latent heat duty
 *
 * For processes like:
 * - Pre-heat + evaporate
 * - Condense + sub-cool
 *
 * @param sensibleInput - Optional sensible heat input
 * @param latentInput - Optional latent heat input
 * @returns Combined heat duty result
 */
export function calculateCombinedHeat(
  sensibleInput?: SensibleHeatInput,
  latentInput?: LatentHeatInput
): CombinedHeatResult {
  let sensible: SensibleHeatResult | undefined;
  let latent: LatentHeatResult | undefined;
  let totalHeatDuty = 0;

  if (sensibleInput) {
    sensible = calculateSensibleHeat(sensibleInput);
    totalHeatDuty += sensible.heatDuty;
  }

  if (latentInput) {
    latent = calculateLatentHeat(latentInput);
    totalHeatDuty += latent.heatDuty;
  }

  return {
    sensible,
    latent,
    totalHeatDuty,
  };
}

/**
 * Typical overall heat transfer coefficients (W/m²·K)
 */
export const TYPICAL_HTC: Record<string, { min: number; typical: number; max: number }> = {
  steam_to_water: { min: 1000, typical: 2500, max: 4000 },
  water_to_water: { min: 800, typical: 1500, max: 2500 },
  seawater_to_water: { min: 700, typical: 1200, max: 2000 },
  condensing_steam: { min: 2000, typical: 5000, max: 10000 },
  boiling_water: { min: 1500, typical: 3000, max: 6000 },
  air_to_water: { min: 20, typical: 50, max: 100 },
};
