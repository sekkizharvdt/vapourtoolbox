/**
 * Desuperheating Water Requirement Calculator
 *
 * Calculate spray water flow required to desuperheat steam from superheated
 * conditions to a target temperature using an energy balance.
 *
 * Energy balance:
 *   m_steam × h_steam + m_water × h_water = (m_steam + m_water) × h_target
 *
 * Solving for spray water:
 *   m_water = m_steam × (h_steam - h_target) / (h_target - h_water)
 *
 * Reference: Perry's Chemical Engineers' Handbook, Section 11
 */

import {
  getSaturationTemperature,
  getEnthalpySuperheated,
  getEnthalpyLiquid,
  getEnthalpyVapor,
  isSuperheated,
} from '@vapour/constants';
import { tonHrToKgS, kgSToTonHr } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

/** Input parameters for desuperheating calculation */
export interface DesuperheatingInput {
  /** Steam pressure in bar abs (constant through desuperheater) */
  steamPressure: number;
  /** Inlet steam temperature in °C (must be superheated) */
  steamTemperature: number;
  /** Target outlet temperature in °C (must be >= Tsat at pressure) */
  targetTemperature: number;
  /** Spray water temperature in °C */
  sprayWaterTemperature: number;
  /** Steam mass flow rate in ton/hr */
  steamFlow: number;
}

/** Result of desuperheating calculation */
export interface DesuperheatingResult {
  /** Required spray water flow in ton/hr */
  sprayWaterFlow: number;
  /** Total outlet flow (steam + water) in ton/hr */
  totalOutletFlow: number;
  /** Water-to-steam mass ratio (dimensionless) */
  waterToSteamRatio: number;
  /** Inlet steam enthalpy in kJ/kg */
  steamEnthalpy: number;
  /** Target outlet enthalpy in kJ/kg */
  targetEnthalpy: number;
  /** Spray water enthalpy in kJ/kg */
  sprayWaterEnthalpy: number;
  /** Saturation temperature at operating pressure in °C */
  saturationTemperature: number;
  /** Inlet degrees of superheat in °C */
  degreesOfSuperheat: number;
  /** Outlet degrees of superheat in °C (0 if at saturation) */
  outletSuperheat: number;
  /** Heat removed from steam in kW */
  heatRemoved: number;
  /** Warnings and notes */
  warnings: string[];
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * Calculate spray water requirement for desuperheating
 *
 * @param input - Desuperheating parameters
 * @returns Calculation results including spray water flow
 * @throws Error if steam is not superheated or target is below saturation
 */
export function calculateDesuperheating(input: DesuperheatingInput): DesuperheatingResult {
  const { steamPressure, steamTemperature, targetTemperature, sprayWaterTemperature, steamFlow } =
    input;

  const warnings: string[] = [];

  // Validate pressure range
  if (steamPressure <= 0) {
    throw new Error('Steam pressure must be positive');
  }

  // Get saturation temperature
  const tSat = getSaturationTemperature(steamPressure);

  // Validate steam is superheated
  if (!isSuperheated(steamPressure, steamTemperature)) {
    throw new Error(
      `Steam must be superheated. At ${steamPressure} bar, Tsat = ${tSat.toFixed(1)}°C but inlet is ${steamTemperature}°C`
    );
  }

  // Validate target temperature
  if (targetTemperature < tSat) {
    throw new Error(
      `Target temperature (${targetTemperature}°C) cannot be below saturation (${tSat.toFixed(1)}°C)`
    );
  }

  if (targetTemperature >= steamTemperature) {
    throw new Error(
      `Target temperature (${targetTemperature}°C) must be below inlet temperature (${steamTemperature}°C)`
    );
  }

  // Validate spray water
  if (sprayWaterTemperature >= tSat) {
    warnings.push(
      `Spray water temperature (${sprayWaterTemperature}°C) is at or above saturation (${tSat.toFixed(1)}°C)`
    );
  }

  // Validate flow
  if (steamFlow <= 0) {
    throw new Error('Steam flow must be positive');
  }

  // Get enthalpies
  const steamEnthalpy = getEnthalpySuperheated(steamPressure, steamTemperature);

  // Target enthalpy: superheated if above Tsat, saturated vapor if at Tsat
  const outletSuperheat = targetTemperature - tSat;
  const targetEnthalpy =
    outletSuperheat > 0.1
      ? getEnthalpySuperheated(steamPressure, targetTemperature)
      : getEnthalpyVapor(tSat);

  // Spray water enthalpy (liquid at water temperature)
  const sprayWaterEnthalpy = getEnthalpyLiquid(sprayWaterTemperature);

  // Energy balance: m_water = m_steam × (h_steam - h_target) / (h_target - h_water)
  const enthalpyDiffSteam = steamEnthalpy - targetEnthalpy;
  const enthalpyDiffWater = targetEnthalpy - sprayWaterEnthalpy;

  if (enthalpyDiffWater <= 0) {
    throw new Error(
      'Spray water enthalpy is higher than target enthalpy — desuperheating not possible'
    );
  }

  const waterToSteamRatio = enthalpyDiffSteam / enthalpyDiffWater;
  const sprayWaterFlowKgS = tonHrToKgS(steamFlow) * waterToSteamRatio;
  const sprayWaterFlow = kgSToTonHr(sprayWaterFlowKgS);
  const totalOutletFlow = steamFlow + sprayWaterFlow;

  // Heat removed (kW)
  const heatRemoved = tonHrToKgS(steamFlow) * enthalpyDiffSteam;

  // Warnings
  if (waterToSteamRatio > 0.3) {
    warnings.push(
      `High water-to-steam ratio (${(waterToSteamRatio * 100).toFixed(1)}%). Verify desuperheater capacity.`
    );
  }

  const degreesOfSuperheat = steamTemperature - tSat;

  return {
    sprayWaterFlow,
    totalOutletFlow,
    waterToSteamRatio,
    steamEnthalpy,
    targetEnthalpy,
    sprayWaterEnthalpy,
    saturationTemperature: tSat,
    degreesOfSuperheat,
    outletSuperheat: Math.max(0, outletSuperheat),
    heatRemoved,
    warnings,
  };
}
