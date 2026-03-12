/**
 * TVC Integration for MED Plant
 *
 * Couples the TVC ejector calculator with the MED solver:
 *   - Motive steam (high pressure) entrains vapor from a selected effect
 *   - Discharge vapor feeds effect 1 at higher pressure than entrained vapor
 *   - Result: higher GOR (8–16) for the same number of effects
 *
 * The TVC discharge may be superheated, in which case a desuperheater is
 * needed before the vapor enters effect 1. The desuperheating calculator
 * is used to determine spray water requirements.
 *
 * References:
 * - El-Dessouky & Ettouney (2002), Chapter 7 (MED-TVC)
 * - Huang et al. (1999), 1-D ejector model
 */

import {
  getSaturationPressure,
  getSaturationTemperature,
} from '@vapour/constants';
import {
  calculateTVC,
  type TVCInput,
  type TVCResult,
} from '../tvcCalculator';
import {
  calculateDesuperheating,
  type DesuperheatingResult,
} from '../desuperheatingCalculator';

// ============================================================================
// Types
// ============================================================================

export interface TVCIntegrationInput {
  /** Motive steam pressure in bar abs */
  motivePressure: number;
  /** Motive steam temperature in °C (optional — defaults to saturated) */
  motiveTemperature?: number;

  /** Effect number whose vapor is entrained (1-based) */
  entrainedEffectNumber: number;
  /** Vapor temperature from the entrained effect in °C */
  entrainedVaporTemp: number;

  /** Desired discharge pressure in bar abs (usually set by effect 1 conditions) */
  dischargePressure: number;

  /** Required total vapor flow to effect 1 in kg/hr */
  requiredVaporToEffect1: number;

  /** Spray water temperature for desuperheating in °C */
  sprayWaterTemp: number;
}

export interface TVCIntegrationResult {
  /** TVC ejector performance details */
  tvc: TVCResult;
  /** Desuperheating result (null if discharge is saturated) */
  desuperheating: DesuperheatingResult | null;

  /** Motive steam flow to TVC in kg/hr */
  motiveFlow: number;
  /** Entrained vapor flow from selected effect in kg/hr */
  entrainedFlow: number;
  /** Total discharge flow from TVC in kg/hr */
  dischargeFlow: number;

  /** Temperature of vapor entering effect 1 in °C */
  vaporToEffect1Temp: number;
  /** Whether the discharge is superheated */
  isSuperheated: boolean;

  /** Net motive steam consumed (motive - any spray water credit) in kg/hr */
  netSteamConsumed: number;
  /** Spray water flow for desuperheating in kg/hr (0 if saturated) */
  sprayWaterFlow: number;

  /** Warnings from TVC and desuperheating calculations */
  warnings: string[];
}

// ============================================================================
// TVC Integration Solver
// ============================================================================

/**
 * Solve the TVC integration for a MED plant.
 *
 * Given the required vapor flow to effect 1, this function:
 * 1. Determines motive and entrained flows from the TVC ejector model
 * 2. If discharge is superheated, calculates desuperheating requirements
 * 3. Returns the net steam consumption and adjusted vapor conditions
 */
export function solveTVCIntegration(
  input: TVCIntegrationInput
): TVCIntegrationResult {
  const warnings: string[] = [];

  const {
    motivePressure,
    motiveTemperature,
    entrainedVaporTemp,
    dischargePressure,
    requiredVaporToEffect1,
    sprayWaterTemp,
  } = input;

  // Suction pressure = saturation pressure at entrained vapor temperature
  const suctionPressure = getSaturationPressure(entrainedVaporTemp);

  // Validate pressure ratios
  if (dischargePressure <= suctionPressure) {
    throw new Error(
      `Discharge pressure (${dischargePressure.toFixed(3)} bar) must be above suction pressure (${suctionPressure.toFixed(3)} bar)`
    );
  }
  if (motivePressure <= dischargePressure) {
    throw new Error(
      `Motive pressure (${motivePressure.toFixed(2)} bar) must be above discharge pressure (${dischargePressure.toFixed(3)} bar)`
    );
  }

  // Step 1: Calculate TVC performance
  // We specify entrained flow = requiredVaporToEffect1 initially as a seed,
  // then scale based on entrainment ratio
  const tvcInput: TVCInput = {
    motivePressure,
    suctionPressure,
    dischargePressure,
    ...(motiveTemperature !== undefined && { motiveTemperature }),
    // We'll set entrainedFlow and compute motiveFlow from entrainment ratio
    entrainedFlow: 1, // unit flow to get entrainment ratio
  };

  const tvcUnit = calculateTVC(tvcInput);
  warnings.push(...tvcUnit.warnings);

  // Entrainment ratio = kg entrained / kg motive
  const Ra = tvcUnit.entrainmentRatio;
  if (Ra <= 0) {
    throw new Error('TVC entrainment ratio is zero or negative — check pressure conditions');
  }

  // Required discharge flow = required vapor to effect 1
  // discharge = motive + entrained = motive × (1 + Ra)
  const motiveFlow = (requiredVaporToEffect1 / (1 + Ra)); // kg/hr
  const entrainedFlow = motiveFlow * Ra; // kg/hr
  const dischargeFlow = motiveFlow + entrainedFlow; // kg/hr

  // Step 2: Check if discharge is superheated
  const dischargeSatTemp = getSaturationTemperature(dischargePressure);
  const dischargeTemp = tvcUnit.dischargeTemperature;
  const isSuperheated = dischargeTemp > dischargeSatTemp + 0.5; // 0.5°C tolerance

  let desuperheating: DesuperheatingResult | null = null;
  let vaporToEffect1Temp = dischargeTemp;
  let sprayWaterFlow = 0;

  if (isSuperheated) {
    // Step 3: Desuperheat to saturation
    const desupInput = {
      steamPressure: dischargePressure,
      steamTemperature: dischargeTemp,
      targetTemperature: dischargeSatTemp, // cool to saturation
      sprayWaterTemperature: sprayWaterTemp,
      steamFlow: dischargeFlow / 1000, // convert kg/hr to ton/hr
    };

    desuperheating = calculateDesuperheating(desupInput);
    warnings.push(...desuperheating.warnings);

    sprayWaterFlow = desuperheating.sprayWaterFlow * 1000; // ton/hr → kg/hr
    vaporToEffect1Temp = dischargeSatTemp;
  } else {
    vaporToEffect1Temp = dischargeSatTemp;
  }

  // Net steam consumed = motive steam only (spray water is seawater, not steam)
  const netSteamConsumed = motiveFlow;

  return {
    tvc: tvcUnit,
    desuperheating,
    motiveFlow,
    entrainedFlow,
    dischargeFlow,
    vaporToEffect1Temp,
    isSuperheated,
    netSteamConsumed,
    sprayWaterFlow,
    warnings,
  };
}
