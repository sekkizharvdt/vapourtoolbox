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
export type FlowArrangement = 'COUNTER' | 'PARALLEL' | 'CROSSFLOW' | 'SHELL_AND_TUBE';

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
  /** Number of shell passes (for SHELL_AND_TUBE, default 1) */
  shellPasses?: number;
  /** Number of tube passes (for SHELL_AND_TUBE, default 2) */
  tubePasses?: number;
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
// TEMA F-Factor for Shell-and-Tube Heat Exchangers
// ============================================================================

/**
 * Calculate TEMA F-factor for a shell-and-tube heat exchanger.
 *
 * Uses the Bowman-Mueller-Nagle (1940) analytical formula for
 * E-shell (single shell pass) with even number of tube passes.
 * For multiple shell passes, applies the Nagle correction.
 *
 * Reference: Bowman, Mueller, Nagle, "Mean Temperature Difference in Design",
 * Trans. ASME 62, 1940, pp. 283-294.
 * Also: Perry's Chemical Engineers' Handbook, 8th Ed., Section 11.
 *
 * @param P - Thermal effectiveness = (t2 - t1) / (T1 - t1)
 *            where t = tube side (cold), T = shell side (hot)
 * @param R - Capacity ratio = (T1 - T2) / (t2 - t1)
 * @param shellPasses - Number of shell passes (1, 2, 3, etc.)
 * @returns F correction factor (0 to 1), or 1.0 for special cases
 */
function calculateFFactorSingleShell(P: number, R: number): number {
  // Special case: R = 0 (condensation — shell side isothermal)
  // F = 1.0 for pure condensation regardless of tube passes
  if (Math.abs(R) < 1e-6) return 1.0;

  // Special case: P = 0 (no heat transfer)
  if (Math.abs(P) < 1e-6) return 1.0;

  // Special case: R ≈ 1 (equal or near-equal capacity rates)
  // Use the R=1 closed-form which is numerically stable (the general formula
  // has S = √(R²+1)/(R-1) which diverges as R→1)
  // F = (P * √2) / ((1-P) * ln((2-P*(2-√2))/(2-P*(2+√2))))
  if (Math.abs(R - 1.0) < 0.3) {
    const sqrt2 = Math.SQRT2;
    const num = P * sqrt2;
    const denomArg = (2 - P * (2 - sqrt2)) / (2 - P * (2 + sqrt2));
    if (denomArg <= 0) return 0.5; // F is very low, approaching thermodynamic limit
    const denom = (1 - P) * Math.log(denomArg);
    if (Math.abs(denom) < 1e-10) return 1.0;
    return Math.max(0, Math.min(1.0, num / denom));
  }

  // General case: R ≠ 1
  // S = √(R² + 1) / (R - 1)
  // F = S * ln((1 - P)/(1 - P*R)) / ln((2 - P*(R+1-S)) / (2 - P*(R+1+S)))
  const S = Math.sqrt(R * R + 1) / (R - 1);
  const numArg = (1 - P) / (1 - P * R);
  if (numArg <= 0) return 0.5; // Temperature cross
  const num = S * Math.log(numArg);

  const denomArg = (2 - P * (R + 1 - S)) / (2 - P * (R + 1 + S));
  if (denomArg <= 0) return 0.5;
  const denom = Math.log(denomArg);

  if (Math.abs(denom) < 1e-10) return 1.0;
  const F = num / denom;

  return Math.max(0, Math.min(1.0, F));
}

/**
 * Calculate F-factor for multi-shell-pass configurations.
 *
 * For N shell passes in series, the equivalent single-shell P is:
 *   P1 = ((1 - P*R)/(1 - P))^(1/N)
 *   P_eq = (P1 - 1) / (P1 - R)
 *
 * Then F is calculated using P_eq with the single-shell formula.
 *
 * @param P - Overall thermal effectiveness
 * @param R - Capacity ratio
 * @param shellPasses - Number of shell passes
 * @returns F correction factor
 */
function calculateFFactorMultiShell(P: number, R: number, shellPasses: number): number {
  if (shellPasses <= 1) return calculateFFactorSingleShell(P, R);

  // Special cases
  if (Math.abs(R) < 1e-6 || Math.abs(P) < 1e-6) return 1.0;

  // Convert overall P to per-shell P
  const N = shellPasses;

  if (Math.abs(R - 1.0) < 1e-6) {
    // R = 1: P1 = P / (N - (N-1)*P)
    const P1 = P / (N - (N - 1) * P);
    return calculateFFactorSingleShell(P1, R);
  }

  // General: P1 from the series relation
  const ratio = (1 - P * R) / (1 - P);
  if (ratio <= 0) return 0.5;
  const ratioNth = Math.pow(ratio, 1 / N);
  const P1 = (ratioNth - 1) / (ratioNth - R);

  if (P1 <= 0 || P1 >= 1) return 0.5;
  return calculateFFactorSingleShell(P1, R);
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

  // Apply correction factor
  let correctionFactor = 1.0;
  const coldDeltaT = coldOutlet - coldInlet;

  if (flowArrangement === 'CROSSFLOW' || flowArrangement === 'SHELL_AND_TUBE') {
    // P = thermal effectiveness, R = capacity ratio
    // P = (t2 - t1) / (T1 - t1) where t=cold (tube), T=hot (shell)
    // R = (T1 - T2) / (t2 - t1)
    const denom_P = hotInlet - coldInlet;
    const P = Math.abs(denom_P) > 0.01 ? coldDeltaT / denom_P : 0;
    const R = Math.abs(coldDeltaT) > 0.01 ? (hotInlet - hotOutlet) / coldDeltaT : 0;

    if (flowArrangement === 'SHELL_AND_TUBE') {
      // TEMA F-factor: Bowman-Mueller-Nagle formula
      const shellPasses = input.shellPasses ?? 1;
      correctionFactor = calculateFFactorMultiShell(P, R, shellPasses);

      if (correctionFactor < 0.75) {
        warnings.push(
          `Low F-factor (${correctionFactor.toFixed(2)}). Consider more shell passes or a different configuration.`
        );
      }
    } else {
      // Crossflow: same formula as before (1-shell, even tube passes)
      correctionFactor = calculateFFactorSingleShell(P, R);
    }

    // Clamp to physical range
    correctionFactor = Math.max(0.5, Math.min(1.0, correctionFactor));
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
