/**
 * Thermo Vapour Compressor (TVC) / Steam Ejector Calculator
 *
 * Calculate entrainment ratio, flows, and performance for steam ejectors
 * used in MED thermal desalination.
 *
 * A TVC uses high-pressure motive steam to entrain and compress low-pressure
 * suction vapor to an intermediate discharge pressure.
 *
 * Method: 1-D Constant Pressure Mixing Model (based on Huang et al. 1999)
 *
 * The model uses:
 *   1. Energy balance for theoretical maximum entrainment
 *   2. Momentum-based efficiency corrections for real performance
 *   3. Component efficiencies: nozzle, mixing, diffuser
 *
 * Key equations:
 *   - Theoretical Ra = (h_m - h_d_sat) / (h_d_sat - h_e)
 *   - Actual Ra = Theoretical Ra × η_ejector
 *   - η_ejector = η_nozzle × η_mixing × η_diffuser × f(CR)
 *
 * Where:
 *   Ra = entrainment ratio (kg entrained / kg motive)
 *   CR = compression ratio (Pd / Ps)
 *   f(CR) = compression ratio correction factor
 *
 * Typical values for MED-TVC (from literature):
 *   - Entrainment ratio: 0.3 - 1.2
 *   - Compression ratio limit (single-stage): 1.8 - 2.5
 *   - Nozzle efficiency: 0.90 - 0.95
 *   - Mixing efficiency: 0.80 - 0.90
 *   - Diffuser efficiency: 0.70 - 0.85
 *
 * References:
 *   - Huang, B.J. et al. (1999) "A 1-D analysis of ejector performance"
 *     International Journal of Refrigeration, 22, 354-364
 *   - Keenan, J.H. et al. (1950) "An investigation of ejector design"
 *     ASME Journal of Applied Mechanics
 *   - El-Dessouky, H. & Ettouney, H. (2002) "Evaluation of steam jet ejectors"
 *     Chemical Engineering and Processing, 41, 551-561
 */

import {
  getSaturationTemperature,
  getEnthalpySuperheated,
  getEnthalpyVapor,
  isSuperheated,
} from '@vapour/constants';
import { tonHrToKgS } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

/** Input parameters for TVC calculation */
export interface TVCInput {
  /** Motive steam pressure in bar abs */
  motivePressure: number;
  /** Suction (entrained) vapor pressure in bar abs */
  suctionPressure: number;
  /** Discharge (compressed) vapor pressure in bar abs */
  dischargePressure: number;
  /** Motive steam temperature in °C (optional, default: saturated) */
  motiveTemperature?: number;
  /** Entrained vapor flow in ton/hr (specify one of entrainedFlow or motiveFlow) */
  entrainedFlow?: number;
  /** Motive steam flow in ton/hr (specify one of entrainedFlow or motiveFlow) */
  motiveFlow?: number;
  /** Nozzle isentropic efficiency (default: 0.92) */
  nozzleEfficiency?: number;
  /** Mixing section efficiency (default: 0.85) */
  mixingEfficiency?: number;
  /** Diffuser efficiency (default: 0.78) */
  diffuserEfficiency?: number;
}

/** Result of TVC calculation */
export interface TVCResult {
  /** Entrainment ratio (kg entrained / kg motive) - actual with losses */
  entrainmentRatio: number;
  /** Theoretical entrainment ratio from energy balance (ideal, no losses) */
  theoreticalEntrainmentRatio: number;
  /** Overall ejector efficiency (actual / theoretical) */
  ejectorEfficiency: number;
  /** Compression ratio (Pc / Ps) */
  compressionRatio: number;
  /** Expansion ratio (Pm / Ps) */
  expansionRatio: number;
  /** Motive steam flow in ton/hr */
  motiveFlow: number;
  /** Entrained vapor flow in ton/hr */
  entrainedFlow: number;
  /** Discharge flow in ton/hr (motive + entrained) */
  dischargeFlow: number;
  /** Motive steam enthalpy in kJ/kg */
  motiveEnthalpy: number;
  /** Suction vapor enthalpy in kJ/kg */
  suctionEnthalpy: number;
  /** Discharge enthalpy in kJ/kg (from energy balance) */
  dischargeEnthalpy: number;
  /** Discharge temperature in °C (superheated) */
  dischargeTemperature: number;
  /** Motive steam saturation temperature in °C */
  motiveSatTemperature: number;
  /** Suction vapor saturation temperature in °C */
  suctionSatTemperature: number;
  /** Discharge saturation temperature in °C */
  dischargeSatTemperature: number;
  /** Degrees of superheat at discharge in °C */
  dischargeSuperheat: number;
  /** Nozzle efficiency used */
  nozzleEfficiency: number;
  /** Mixing efficiency used */
  mixingEfficiency: number;
  /** Diffuser efficiency used */
  diffuserEfficiency: number;
  /** Warnings and notes */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default nozzle isentropic efficiency */
const DEFAULT_NOZZLE_EFFICIENCY = 0.92;

/** Default mixing section efficiency */
const DEFAULT_MIXING_EFFICIENCY = 0.85;

/** Default diffuser efficiency */
const DEFAULT_DIFFUSER_EFFICIENCY = 0.78;

/** Maximum compression ratio for single-stage ejector */
const MAX_CR_SINGLE_STAGE = 2.5;

/** Typical compression ratio for reliable single-stage operation */
const TYPICAL_CR_LIMIT = 2.2;

// ============================================================================
// Bisection Solver
// ============================================================================

/**
 * Find temperature at which enthalpy matches target value (bisection method)
 *
 * @param pressureBar - Pressure in bar
 * @param targetEnthalpy - Target enthalpy in kJ/kg
 * @param tMin - Lower temperature bound in °C
 * @param tMax - Upper temperature bound in °C
 * @returns Temperature in °C where enthalpy matches target
 */
function findTemperatureAtEnthalpy(
  pressureBar: number,
  targetEnthalpy: number,
  tMin: number,
  tMax: number
): number {
  const tolerance = 0.1; // kJ/kg
  const maxIterations = 50;

  let low = tMin;
  let high = tMax;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const hMid = getEnthalpySuperheated(pressureBar, mid);
    const diff = hMid - targetEnthalpy;

    if (Math.abs(diff) < tolerance) return mid;

    // Enthalpy increases with temperature at constant pressure
    if (diff < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

// ============================================================================
// Entrainment Ratio Calculations
// ============================================================================

/**
 * Calculate entrainment ratio using GEA empirical correlation with
 * expansion ratio dependence.
 *
 * Source: "Curves for the Prediction of TVC Performances" by GEA,
 * from WET's MED-TVC Excel design program.
 *
 * Four base curves of R(E) at fixed K, fitted to GEA performance data:
 *   K=1.5: R = 1.5615 × E^(-0.248)
 *   K=2.0: R = 3.0007 × E^(-0.287)
 *   K=3.0: R = 16.318 × E^(-0.560)
 *   K=4.0: R = 117.08 × E^(-0.914)
 *
 * R is interpolated between the two nearest K curves, then Ra = 1/R.
 *
 * Validated against as-built MED-TVC plants:
 *   - BARC (K=2.82, E=128): Ra ≈ 0.95 (as-built: 0.935)
 *   - Adani (K=2.07, E=70): Ra ≈ 1.0 (matches design)
 *
 * @param compressionRatio - K = Pd / Ps
 * @param expansionRatio - E = Pm / Ps
 * @returns Entrainment ratio Ra = F_suction / F_motive
 */
function calculateGEAEntrainmentRatio(compressionRatio: number, expansionRatio: number): number {
  if (compressionRatio <= 1.0 || expansionRatio <= 1.0) return 0;

  // GEA base curves: R = a × E^b at fixed K
  const curves: { K: number; a: number; b: number }[] = [
    { K: 1.5, a: 1.5615, b: -0.248 },
    { K: 2.0, a: 3.0007, b: -0.287 },
    { K: 3.0, a: 16.318, b: -0.56 },
    { K: 4.0, a: 117.08, b: -0.914 },
  ];

  // Find bracketing K curves
  const K = Math.max(1.5, Math.min(4.0, compressionRatio));

  let lowerIdx = 0;
  for (let i = 0; i < curves.length - 1; i++) {
    if (K >= curves[i]!.K && K <= curves[i + 1]!.K) {
      lowerIdx = i;
      break;
    }
  }

  const lower = curves[lowerIdx]!;
  const upper = curves[lowerIdx + 1]!;

  // R at each bounding K
  const R_lower = lower.a * Math.pow(expansionRatio, lower.b);
  const R_upper = upper.a * Math.pow(expansionRatio, upper.b);

  // Linear interpolation in K
  const frac = (K - lower.K) / (upper.K - lower.K);
  const R = R_lower + frac * (R_upper - R_lower);

  return R > 0 ? 1 / R : 0;
}

/**
 * Calculate theoretical entrainment ratio from energy balance (for reference).
 *
 * Ra_theoretical = (h_m - h_d_sat) / (h_d_sat - h_e)
 *
 * This is the thermodynamic maximum — not used as the primary correlation
 * but reported for comparison with the GEA empirical result.
 */
function calculateTheoreticalEntrainmentRatio(
  motiveEnthalpy: number,
  suctionEnthalpy: number,
  dischargeSatEnthalpy: number
): number {
  const denominator = dischargeSatEnthalpy - suctionEnthalpy;
  const numerator = motiveEnthalpy - dischargeSatEnthalpy;
  if (denominator <= 0 || numerator <= 0) return 0;
  return numerator / denominator;
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * Calculate TVC / steam ejector performance using 1-D model
 *
 * @param input - TVC parameters
 * @returns Calculation results including entrainment ratio and flows
 * @throws Error if pressure ordering is invalid or flow specification is missing
 */
export function calculateTVC(input: TVCInput): TVCResult {
  const { motivePressure, suctionPressure, dischargePressure, motiveTemperature } = input;

  const warnings: string[] = [];

  // Efficiency parameters with defaults
  const nozzleEfficiency = input.nozzleEfficiency ?? DEFAULT_NOZZLE_EFFICIENCY;
  const mixingEfficiency = input.mixingEfficiency ?? DEFAULT_MIXING_EFFICIENCY;
  const diffuserEfficiency = input.diffuserEfficiency ?? DEFAULT_DIFFUSER_EFFICIENCY;

  // Validate efficiencies
  if (nozzleEfficiency <= 0 || nozzleEfficiency > 1) {
    throw new Error('Nozzle efficiency must be between 0 and 1');
  }
  if (mixingEfficiency <= 0 || mixingEfficiency > 1) {
    throw new Error('Mixing efficiency must be between 0 and 1');
  }
  if (diffuserEfficiency <= 0 || diffuserEfficiency > 1) {
    throw new Error('Diffuser efficiency must be between 0 and 1');
  }

  // Validate pressures
  if (motivePressure <= 0 || suctionPressure <= 0 || dischargePressure <= 0) {
    throw new Error('All pressures must be positive');
  }

  if (motivePressure <= dischargePressure) {
    throw new Error(
      `Motive pressure (${motivePressure} bar) must be greater than discharge pressure (${dischargePressure} bar)`
    );
  }

  if (dischargePressure <= suctionPressure) {
    throw new Error(
      `Discharge pressure (${dischargePressure} bar) must be greater than suction pressure (${suctionPressure} bar)`
    );
  }

  // Validate flow specification
  const hasEntrained = input.entrainedFlow !== undefined && input.entrainedFlow > 0;
  const hasMotive = input.motiveFlow !== undefined && input.motiveFlow > 0;

  if (!hasEntrained && !hasMotive) {
    throw new Error('Specify either entrained flow or motive flow');
  }

  // Compression and expansion ratios
  const compressionRatio = dischargePressure / suctionPressure;
  const expansionRatio = motivePressure / suctionPressure;

  // Check compression ratio limits — warn but don't throw
  if (compressionRatio > MAX_CR_SINGLE_STAGE) {
    warnings.push(
      `Compression ratio (${compressionRatio.toFixed(2)}) exceeds single-stage limit (${MAX_CR_SINGLE_STAGE}). Consider multi-stage ejector or reducing the temperature spread.`
    );
  } else if (compressionRatio > TYPICAL_CR_LIMIT) {
    warnings.push(
      `Compression ratio (${compressionRatio.toFixed(2)}) is above typical limit (${TYPICAL_CR_LIMIT}). Performance may be reduced.`
    );
  }

  // Saturation temperatures
  const motiveSatTemperature = getSaturationTemperature(motivePressure);
  const suctionSatTemperature = getSaturationTemperature(suctionPressure);
  const dischargeSatTemperature = getSaturationTemperature(dischargePressure);

  // Enthalpies
  let motiveEnthalpy: number;
  if (motiveTemperature !== undefined && isSuperheated(motivePressure, motiveTemperature)) {
    motiveEnthalpy = getEnthalpySuperheated(motivePressure, motiveTemperature);
  } else {
    motiveEnthalpy = getEnthalpyVapor(motiveSatTemperature);
  }

  // Suction vapor assumed saturated
  const suctionEnthalpy = getEnthalpyVapor(suctionSatTemperature);

  // Discharge saturated vapor enthalpy (reference for energy balance)
  const dischargeSatEnthalpy = getEnthalpyVapor(dischargeSatTemperature);

  // GEA empirical correlation — primary method (from WET Excel)
  const entrainmentRatio = calculateGEAEntrainmentRatio(compressionRatio, expansionRatio);

  // Theoretical (thermodynamic maximum) — for reference only
  const theoreticalEntrainmentRatio = calculateTheoreticalEntrainmentRatio(
    motiveEnthalpy,
    suctionEnthalpy,
    dischargeSatEnthalpy
  );
  const ejectorEfficiency =
    theoreticalEntrainmentRatio > 0 ? entrainmentRatio / theoreticalEntrainmentRatio : 0;

  // Validate result is in reasonable range
  if (entrainmentRatio < 0.1) {
    warnings.push(
      `Low entrainment ratio (${entrainmentRatio.toFixed(2)}). Consider lower compression ratio or higher motive pressure.`
    );
  }

  if (entrainmentRatio > 2.0) {
    warnings.push(
      `High entrainment ratio (${entrainmentRatio.toFixed(2)}). Verify against manufacturer data.`
    );
  }

  // Calculate flows
  let motiveFlow: number;
  let entrainedFlow: number;

  if (hasEntrained) {
    entrainedFlow = input.entrainedFlow!;
    motiveFlow = entrainedFlow / entrainmentRatio;
  } else {
    motiveFlow = input.motiveFlow!;
    entrainedFlow = motiveFlow * entrainmentRatio;
  }

  const dischargeFlow = motiveFlow + entrainedFlow;

  // Discharge enthalpy from energy balance (actual mixed stream)
  const motiveFlowKgS = tonHrToKgS(motiveFlow);
  const entrainedFlowKgS = tonHrToKgS(entrainedFlow);
  const dischargeFlowKgS = motiveFlowKgS + entrainedFlowKgS;

  const dischargeEnthalpy =
    (motiveFlowKgS * motiveEnthalpy + entrainedFlowKgS * suctionEnthalpy) / dischargeFlowKgS;

  // Find discharge temperature from enthalpy (will be superheated)
  const dischargeTemperature = findTemperatureAtEnthalpy(
    dischargePressure,
    dischargeEnthalpy,
    dischargeSatTemperature + 0.5,
    dischargeSatTemperature + 100
  );

  const dischargeSuperheat = dischargeTemperature - dischargeSatTemperature;

  // Additional warnings
  if (dischargeSuperheat > 30) {
    warnings.push(
      `Discharge superheat (${dischargeSuperheat.toFixed(1)}°C) is high. Consider desuperheating.`
    );
  }

  return {
    entrainmentRatio,
    theoreticalEntrainmentRatio,
    ejectorEfficiency,
    compressionRatio,
    expansionRatio,
    motiveFlow,
    entrainedFlow,
    dischargeFlow,
    motiveEnthalpy,
    suctionEnthalpy,
    dischargeEnthalpy,
    dischargeTemperature,
    motiveSatTemperature,
    suctionSatTemperature,
    dischargeSatTemperature,
    dischargeSuperheat,
    nozzleEfficiency,
    mixingEfficiency,
    diffuserEfficiency,
    warnings,
  };
}
