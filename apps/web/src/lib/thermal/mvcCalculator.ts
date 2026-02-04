/**
 * Mechanical Vapour Compressor (MVC) Calculator
 *
 * Calculate shaft power, discharge conditions, and specific energy
 * for isentropic vapor compression.
 *
 * Method:
 * 1. Determine suction state (saturated or superheated vapor)
 * 2. Find isentropic discharge temperature via bisection on entropy
 * 3. Apply isentropic efficiency to get actual discharge enthalpy
 * 4. Calculate power from enthalpy difference
 *
 * Equations:
 * - Isentropic: s_in = s_out_s → find T_out_s at P_out
 * - Actual: h_out = h_in + (h_out_s - h_in) / η_is
 * - Shaft Power: W = ṁ × (h_out - h_in)
 * - Electrical Power: W_elec = W_shaft / η_mech
 *
 * Reference: Smith, Van Ness & Abbott, "Introduction to Chemical Engineering Thermodynamics"
 */

import {
  getSaturationTemperature,
  getEnthalpySuperheated,
  getEntropySuperheated,
  getSpecificVolumeSuperheated,
  isSuperheated,
} from '@vapour/constants';
import { tonHrToKgS } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

/** Input parameters for MVC calculation */
export interface MVCInput {
  /** Suction pressure in bar abs */
  suctionPressure: number;
  /** Suction temperature in °C (optional, default: saturated vapor) */
  suctionTemperature?: number;
  /** Discharge pressure in bar abs */
  dischargePressure: number;
  /** Vapor flow rate in ton/hr */
  flowRate: number;
  /** Isentropic efficiency (0-1, default 0.75) */
  isentropicEfficiency?: number;
  /** Mechanical efficiency (0-1, default 0.95) */
  mechanicalEfficiency?: number;
}

/** Result of MVC calculation */
export interface MVCResult {
  /** Compression ratio (Pd / Ps) */
  compressionRatio: number;
  /** Isentropic compression power in kW */
  isentropicPower: number;
  /** Shaft power in kW (isentropic / η_is) */
  shaftPower: number;
  /** Electrical power in kW (shaft / η_mech) */
  electricalPower: number;
  /** Specific energy consumption in kWh/ton */
  specificEnergy: number;
  /** Suction temperature in °C */
  suctionTemperature: number;
  /** Isentropic discharge temperature in °C */
  dischargeTemperatureIsentropic: number;
  /** Actual discharge temperature in °C */
  dischargeTemperatureActual: number;
  /** Suction enthalpy in kJ/kg */
  suctionEnthalpy: number;
  /** Isentropic discharge enthalpy in kJ/kg */
  dischargeEnthalpyIsentropic: number;
  /** Actual discharge enthalpy in kJ/kg */
  dischargeEnthalpyActual: number;
  /** Suction entropy in kJ/(kg·K) */
  suctionEntropy: number;
  /** Volumetric flow at suction in m³/hr */
  volumetricFlowSuction: number;
  /** Isentropic efficiency used */
  isentropicEfficiency: number;
  /** Mechanical efficiency used */
  mechanicalEfficiency: number;
  /** Warnings and notes */
  warnings: string[];
}

// ============================================================================
// Bisection Solvers
// ============================================================================

/**
 * Find temperature at which entropy matches target value (bisection method)
 *
 * @param pressureBar - Pressure in bar
 * @param targetEntropy - Target entropy in kJ/(kg·K)
 * @param tMin - Lower temperature bound in °C
 * @param tMax - Upper temperature bound in °C
 * @returns Temperature in °C where entropy matches target
 */
function findTemperatureAtEntropy(
  pressureBar: number,
  targetEntropy: number,
  tMin: number,
  tMax: number
): number {
  const tolerance = 0.001; // kJ/(kg·K)
  const maxIterations = 50;

  let low = tMin;
  let high = tMax;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const sMid = getEntropySuperheated(pressureBar, mid);
    const diff = sMid - targetEntropy;

    if (Math.abs(diff) < tolerance) return mid;

    // Entropy increases with temperature at constant pressure
    if (diff < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

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
// Calculator
// ============================================================================

/**
 * Calculate mechanical vapour compressor performance
 *
 * @param input - MVC parameters
 * @returns Calculation results including power and discharge conditions
 * @throws Error if discharge pressure is below suction or inputs are invalid
 */
export function calculateMVC(input: MVCInput): MVCResult {
  const { suctionPressure, dischargePressure, flowRate } = input;
  const isentropicEfficiency = input.isentropicEfficiency ?? 0.75;
  const mechanicalEfficiency = input.mechanicalEfficiency ?? 0.95;

  const warnings: string[] = [];

  // Validate inputs
  if (suctionPressure <= 0 || dischargePressure <= 0) {
    throw new Error('Pressures must be positive');
  }

  if (dischargePressure <= suctionPressure) {
    throw new Error(
      `Discharge pressure (${dischargePressure} bar) must be greater than suction pressure (${suctionPressure} bar)`
    );
  }

  if (flowRate <= 0) {
    throw new Error('Flow rate must be positive');
  }

  if (isentropicEfficiency <= 0 || isentropicEfficiency > 1) {
    throw new Error('Isentropic efficiency must be between 0 and 1');
  }

  if (mechanicalEfficiency <= 0 || mechanicalEfficiency > 1) {
    throw new Error('Mechanical efficiency must be between 0 and 1');
  }

  // Determine suction state
  const tSatSuction = getSaturationTemperature(suctionPressure);
  let suctionTemperature: number;

  if (input.suctionTemperature !== undefined) {
    if (!isSuperheated(suctionPressure, input.suctionTemperature)) {
      throw new Error(
        `Suction temperature (${input.suctionTemperature}°C) must be above saturation (${tSatSuction.toFixed(1)}°C)`
      );
    }
    suctionTemperature = input.suctionTemperature;
  } else {
    // Use Tsat + 0.5°C for saturated vapor (keeps within Region 2)
    suctionTemperature = tSatSuction + 0.5;
  }

  // Get suction properties
  const suctionEnthalpy = getEnthalpySuperheated(suctionPressure, suctionTemperature);
  const suctionEntropy = getEntropySuperheated(suctionPressure, suctionTemperature);
  const suctionSpecificVolume = getSpecificVolumeSuperheated(suctionPressure, suctionTemperature);

  // Find isentropic discharge temperature
  const tSatDischarge = getSaturationTemperature(dischargePressure);
  const dischargeTemperatureIsentropic = findTemperatureAtEntropy(
    dischargePressure,
    suctionEntropy,
    tSatDischarge + 0.5,
    tSatDischarge + 200
  );

  // Isentropic discharge enthalpy
  const dischargeEnthalpyIsentropic = getEnthalpySuperheated(
    dischargePressure,
    dischargeTemperatureIsentropic
  );

  // Actual discharge enthalpy (with efficiency correction)
  const dischargeEnthalpyActual =
    suctionEnthalpy + (dischargeEnthalpyIsentropic - suctionEnthalpy) / isentropicEfficiency;

  // Find actual discharge temperature
  const dischargeTemperatureActual = findTemperatureAtEnthalpy(
    dischargePressure,
    dischargeEnthalpyActual,
    tSatDischarge + 0.5,
    tSatDischarge + 300
  );

  // Power calculations
  const massFlowKgS = tonHrToKgS(flowRate);
  const isentropicPower = massFlowKgS * (dischargeEnthalpyIsentropic - suctionEnthalpy);
  const shaftPower = massFlowKgS * (dischargeEnthalpyActual - suctionEnthalpy);
  const electricalPower = shaftPower / mechanicalEfficiency;

  // Specific energy (kWh per ton of vapor)
  const specificEnergy = electricalPower / flowRate;

  // Volumetric flow at suction (m³/hr)
  const volumetricFlowSuction = massFlowKgS * suctionSpecificVolume * 3600;

  // Compression ratio
  const compressionRatio = dischargePressure / suctionPressure;

  // Warnings
  if (compressionRatio > 3) {
    warnings.push(
      `High compression ratio (${compressionRatio.toFixed(1)}). Consider multi-stage compression.`
    );
  }

  if (isentropicEfficiency < 0.6) {
    warnings.push(
      `Low isentropic efficiency (${(isentropicEfficiency * 100).toFixed(0)}%). Verify compressor selection.`
    );
  }

  if (isentropicEfficiency > 0.85) {
    warnings.push(
      `High isentropic efficiency (${(isentropicEfficiency * 100).toFixed(0)}%). Verify this is achievable.`
    );
  }

  return {
    compressionRatio,
    isentropicPower,
    shaftPower,
    electricalPower,
    specificEnergy,
    suctionTemperature: input.suctionTemperature ?? tSatSuction,
    dischargeTemperatureIsentropic,
    dischargeTemperatureActual,
    suctionEnthalpy,
    dischargeEnthalpyIsentropic,
    dischargeEnthalpyActual,
    suctionEntropy,
    volumetricFlowSuction,
    isentropicEfficiency,
    mechanicalEfficiency,
    warnings,
  };
}
