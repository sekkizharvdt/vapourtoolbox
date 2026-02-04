/**
 * Thermo Vapour Compressor (TVC) / Steam Ejector Calculator
 *
 * Calculate entrainment ratio, flows, and energy balance for steam ejectors
 * used in MED thermal desalination.
 *
 * A TVC uses high-pressure motive steam to entrain and compress low-pressure
 * suction vapor to an intermediate discharge pressure.
 *
 * Correlation: El-Dessouky & Ettouney (2002)
 *   Ra = 0.296 × (Ps^1.04 / Pm^1.04) × (Pc/Pm)^0.015 × TCF × PCF
 *
 * Where:
 *   Ra = entrainment ratio (kg entrained / kg motive)
 *   Ps = suction pressure (kPa)
 *   Pm = motive pressure (kPa)
 *   Pc = discharge (compressed) pressure (kPa)
 *   TCF = 1.0 (temperature correction factor, unity for steam)
 *   PCF = 1.0 (pressure correction factor, unity for standard conditions)
 *
 * Reference: El-Dessouky & Ettouney, "Fundamentals of Salt Water Desalination", 2002
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
}

/** Result of TVC calculation */
export interface TVCResult {
  /** Entrainment ratio (kg entrained / kg motive) */
  entrainmentRatio: number;
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
  /** Motive steam saturation temperature in °C */
  motiveSatTemperature: number;
  /** Suction vapor saturation temperature in °C */
  suctionSatTemperature: number;
  /** Discharge saturation temperature in °C */
  dischargeSatTemperature: number;
  /** Warnings and notes */
  warnings: string[];
}

// ============================================================================
// Entrainment Ratio Correlation
// ============================================================================

/**
 * El-Dessouky & Ettouney (2002) entrainment ratio correlation
 *
 * Ra = 0.296 × (Ps/Pm)^1.04 × (Pc/Pm)^0.015 × TCF × PCF
 *
 * @param Pm_kPa - Motive pressure in kPa
 * @param Ps_kPa - Suction pressure in kPa
 * @param Pc_kPa - Discharge pressure in kPa
 * @returns Entrainment ratio (kg entrained / kg motive)
 */
function calculateEntrainmentRatio(Pm_kPa: number, Ps_kPa: number, Pc_kPa: number): number {
  const TCF = 1.0;
  const PCF = 1.0;

  const Ra =
    ((0.296 * Math.pow(Ps_kPa, 1.04)) / Math.pow(Pm_kPa, 1.04)) *
    Math.pow(Pc_kPa / Pm_kPa, 0.015) *
    TCF *
    PCF;

  return Ra;
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * Calculate TVC / steam ejector performance
 *
 * @param input - TVC parameters
 * @returns Calculation results including entrainment ratio and flows
 * @throws Error if pressure ordering is invalid or flow specification is missing
 */
export function calculateTVC(input: TVCInput): TVCResult {
  const { motivePressure, suctionPressure, dischargePressure, motiveTemperature } = input;

  const warnings: string[] = [];

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

  // Convert pressures to kPa for correlation
  const Pm_kPa = motivePressure * 100;
  const Ps_kPa = suctionPressure * 100;
  const Pc_kPa = dischargePressure * 100;

  // Calculate entrainment ratio
  const entrainmentRatio = calculateEntrainmentRatio(Pm_kPa, Ps_kPa, Pc_kPa);

  // Compression and expansion ratios
  const compressionRatio = dischargePressure / suctionPressure;
  const expansionRatio = motivePressure / suctionPressure;

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

  // Discharge enthalpy from energy balance
  const motiveFlowKgS = tonHrToKgS(motiveFlow);
  const entrainedFlowKgS = tonHrToKgS(entrainedFlow);
  const dischargeFlowKgS = motiveFlowKgS + entrainedFlowKgS;

  const dischargeEnthalpy =
    (motiveFlowKgS * motiveEnthalpy + entrainedFlowKgS * suctionEnthalpy) / dischargeFlowKgS;

  // Warnings
  if (compressionRatio > 4) {
    warnings.push(
      `High compression ratio (${compressionRatio.toFixed(1)}). Consider multi-stage ejector.`
    );
  }

  if (expansionRatio > 10) {
    warnings.push(
      `High expansion ratio (${expansionRatio.toFixed(1)}). Verify ejector design feasibility.`
    );
  }

  if (entrainmentRatio < 0.2) {
    warnings.push(
      `Low entrainment ratio (${entrainmentRatio.toFixed(3)}). Large motive steam requirement.`
    );
  }

  return {
    entrainmentRatio,
    compressionRatio,
    expansionRatio,
    motiveFlow,
    entrainedFlow,
    dischargeFlow,
    motiveEnthalpy,
    suctionEnthalpy,
    dischargeEnthalpy,
    motiveSatTemperature,
    suctionSatTemperature,
    dischargeSatTemperature,
    warnings,
  };
}
