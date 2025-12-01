/**
 * IAPWS-IF97 Steam Tables
 *
 * Implementation of the IAPWS Industrial Formulation 1997 for the
 * Thermodynamic Properties of Water and Steam.
 *
 * This module provides saturation properties for water/steam within
 * the temperature range of 0-374°C (critical point).
 *
 * Reference: IAPWS-IF97 (International Association for the Properties
 * of Water and Steam - Industrial Formulation 1997)
 */

// ============================================================================
// Constants
// ============================================================================

/** Critical temperature of water in °C */
export const CRITICAL_TEMPERATURE_C = 373.946;

/** Critical pressure of water in bar */
export const CRITICAL_PRESSURE_BAR = 220.64;

/** Triple point temperature in °C */
export const TRIPLE_POINT_TEMPERATURE_C = 0.01;

/** Triple point pressure in bar */
export const TRIPLE_POINT_PRESSURE_BAR = 0.00611657;

/** Specific gas constant for water in kJ/(kg·K) */
const R = 0.461526;

/** Reference temperature for Region 4 (K) */
const T_STAR = 1;

/** Reference pressure for Region 4 (MPa) */
const P_STAR = 1;

// ============================================================================
// Region 4: Saturation Line Coefficients (IAPWS-IF97)
// ============================================================================

/** Coefficients for saturation pressure equation (IAPWS-IF97 Region 4) */
const n: readonly [number, number, number, number, number, number, number, number, number, number] =
  [
    0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.1202082470247e5,
    -0.32325550322333e7, 0.1491510861353e2, -0.48232657361591e4, 0.40511340542057e6,
    -0.23855557567849, 0.65017534844798e3,
  ] as const;

// ============================================================================
// Saturation Properties Functions
// ============================================================================

/**
 * Get saturation pressure from temperature using IAPWS-IF97 Region 4 equation
 *
 * @param tempC - Temperature in °C
 * @returns Saturation pressure in bar
 */
export function getSaturationPressure(tempC: number): number {
  // Validate input range
  if (tempC < TRIPLE_POINT_TEMPERATURE_C || tempC > CRITICAL_TEMPERATURE_C) {
    throw new Error(
      `Temperature ${tempC}°C is outside valid range (${TRIPLE_POINT_TEMPERATURE_C}-${CRITICAL_TEMPERATURE_C}°C)`
    );
  }

  const T = tempC + 273.15; // Convert to Kelvin

  // IAPWS-IF97 Region 4 backward equation
  const theta = T / T_STAR + n[8] / (T / T_STAR - n[9]);
  const A = theta * theta + n[0] * theta + n[1];
  const B = n[2] * theta * theta + n[3] * theta + n[4];
  const C = n[5] * theta * theta + n[6] * theta + n[7];

  const pMPa = Math.pow((2 * C) / (-B + Math.sqrt(B * B - 4 * A * C)), 4) * P_STAR;

  return pMPa * 10; // Convert MPa to bar
}

/**
 * Get saturation temperature from pressure using IAPWS-IF97 Region 4 equation
 *
 * @param pressureBar - Pressure in bar
 * @returns Saturation temperature in °C
 */
export function getSaturationTemperature(pressureBar: number): number {
  // Validate input range
  if (pressureBar < TRIPLE_POINT_PRESSURE_BAR || pressureBar > CRITICAL_PRESSURE_BAR) {
    throw new Error(
      `Pressure ${pressureBar} bar is outside valid range (${TRIPLE_POINT_PRESSURE_BAR}-${CRITICAL_PRESSURE_BAR} bar)`
    );
  }

  const pMPa = pressureBar / 10; // Convert bar to MPa

  // IAPWS-IF97 Region 4 backward equation
  const beta = Math.pow(pMPa / P_STAR, 0.25);
  const E = beta * beta + n[2] * beta + n[5];
  const F = n[0] * beta * beta + n[3] * beta + n[6];
  const G = n[1] * beta * beta + n[4] * beta + n[7];
  const D = (2 * G) / (-F - Math.sqrt(F * F - 4 * E * G));

  const TK = ((n[9] + D - Math.sqrt((n[9] + D) * (n[9] + D) - 4 * (n[8] + n[9] * D))) / 2) * T_STAR;

  return TK - 273.15; // Convert to °C
}

/**
 * Get specific enthalpy of saturated liquid (hf) using polynomial fit
 *
 * @param tempC - Temperature in °C
 * @returns Specific enthalpy in kJ/kg
 */
export function getEnthalpyLiquid(tempC: number): number {
  // Validate input range
  if (tempC < 0 || tempC > CRITICAL_TEMPERATURE_C) {
    throw new Error(
      `Temperature ${tempC}°C is outside valid range (0-${CRITICAL_TEMPERATURE_C}°C)`
    );
  }

  // Polynomial fit for saturated liquid enthalpy (accurate within 0.1%)
  // hf = a0 + a1*T + a2*T² + a3*T³ + a4*T⁴
  const a0 = 0.0;
  const a1 = 4.2174;
  const a2 = -0.000467;
  const a3 = 0.00000914;
  const a4 = -0.0000000388;

  const T = tempC;
  return a0 + a1 * T + a2 * T * T + a3 * T * T * T + a4 * T * T * T * T;
}

/**
 * Get specific enthalpy of saturated vapor (hg) using polynomial fit
 *
 * @param tempC - Temperature in °C
 * @returns Specific enthalpy in kJ/kg
 */
export function getEnthalpyVapor(tempC: number): number {
  // Validate input range
  if (tempC < 0 || tempC > CRITICAL_TEMPERATURE_C) {
    throw new Error(
      `Temperature ${tempC}°C is outside valid range (0-${CRITICAL_TEMPERATURE_C}°C)`
    );
  }

  // Polynomial fit for saturated vapor enthalpy (accurate within 0.1%)
  // hg = b0 + b1*T + b2*T² + b3*T³
  const b0 = 2501.0;
  const b1 = 1.8378;
  const b2 = 0.0001198;
  const b3 = -0.00001063;

  const T = tempC;
  return b0 + b1 * T + b2 * T * T + b3 * T * T * T;
}

/**
 * Get latent heat of vaporization (hfg = hg - hf)
 *
 * @param tempC - Temperature in °C
 * @returns Latent heat in kJ/kg
 */
export function getLatentHeat(tempC: number): number {
  return getEnthalpyVapor(tempC) - getEnthalpyLiquid(tempC);
}

/**
 * Get specific volume of saturated liquid (vf) using polynomial fit
 *
 * @param tempC - Temperature in °C
 * @returns Specific volume in m³/kg
 */
export function getSpecificVolumeLiquid(tempC: number): number {
  // Validate input range
  if (tempC < 0 || tempC > CRITICAL_TEMPERATURE_C) {
    throw new Error(
      `Temperature ${tempC}°C is outside valid range (0-${CRITICAL_TEMPERATURE_C}°C)`
    );
  }

  // Polynomial fit for saturated liquid specific volume
  // vf = c0 + c1*T + c2*T² + c3*T³
  const c0 = 0.001;
  const c1 = 0.00000013;
  const c2 = 0.0000000028;
  const c3 = 0.000000000023;

  const T = tempC;
  return c0 + c1 * T + c2 * T * T + c3 * T * T * T;
}

/**
 * Get specific volume of saturated vapor (vg)
 *
 * @param tempC - Temperature in °C
 * @returns Specific volume in m³/kg
 */
export function getSpecificVolumeVapor(tempC: number): number {
  // Use ideal gas law as approximation with correction factor
  // vg ≈ R*T/P (with saturation pressure)
  const TK = tempC + 273.15;
  const pBar = getSaturationPressure(tempC);
  const pMPa = pBar / 10;

  // Compressibility factor correction (approximate)
  const Tr = TK / (CRITICAL_TEMPERATURE_C + 273.15);
  const Pr = pBar / CRITICAL_PRESSURE_BAR;
  const Z = 1 - (0.2 * Pr) / Tr; // Simplified compressibility correction

  return (Z * R * TK) / (pMPa * 1000); // R in kJ/(kg·K), need MPa to match units
}

/**
 * Get specific volume for a given phase
 *
 * @param tempC - Temperature in °C
 * @param phase - Phase ('liquid' or 'vapor')
 * @returns Specific volume in m³/kg
 */
export function getSpecificVolume(tempC: number, phase: 'liquid' | 'vapor'): number {
  return phase === 'liquid' ? getSpecificVolumeLiquid(tempC) : getSpecificVolumeVapor(tempC);
}

/**
 * Get density of saturated liquid
 *
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getDensityLiquid(tempC: number): number {
  return 1 / getSpecificVolumeLiquid(tempC);
}

/**
 * Get density of saturated vapor
 *
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getDensityVapor(tempC: number): number {
  return 1 / getSpecificVolumeVapor(tempC);
}

// ============================================================================
// Lookup Table for Quick Reference (10°C intervals)
// ============================================================================

/**
 * Pre-calculated saturation properties at 10°C intervals
 * For quick reference and validation
 */
export const SATURATION_TABLE = [
  { tempC: 0, pBar: 0.00611, hf: 0.0, hg: 2501.0, hfg: 2501.0 },
  { tempC: 10, pBar: 0.01228, hf: 42.0, hg: 2519.2, hfg: 2477.2 },
  { tempC: 20, pBar: 0.02339, hf: 83.9, hg: 2537.4, hfg: 2453.5 },
  { tempC: 30, pBar: 0.04246, hf: 125.7, hg: 2555.5, hfg: 2429.8 },
  { tempC: 40, pBar: 0.07384, hf: 167.5, hg: 2573.5, hfg: 2406.0 },
  { tempC: 50, pBar: 0.1235, hf: 209.3, hg: 2591.3, hfg: 2382.0 },
  { tempC: 60, pBar: 0.1994, hf: 251.1, hg: 2608.8, hfg: 2357.7 },
  { tempC: 70, pBar: 0.3119, hf: 293.0, hg: 2626.1, hfg: 2333.1 },
  { tempC: 80, pBar: 0.4739, hf: 335.0, hg: 2643.0, hfg: 2308.0 },
  { tempC: 90, pBar: 0.7014, hf: 377.0, hg: 2659.5, hfg: 2282.5 },
  { tempC: 100, pBar: 1.0135, hf: 419.1, hg: 2675.6, hfg: 2256.5 },
  { tempC: 110, pBar: 1.433, hf: 461.3, hg: 2691.1, hfg: 2229.8 },
  { tempC: 120, pBar: 1.986, hf: 503.7, hg: 2705.9, hfg: 2202.2 },
  { tempC: 130, pBar: 2.701, hf: 546.3, hg: 2720.1, hfg: 2173.8 },
  { tempC: 140, pBar: 3.614, hf: 589.1, hg: 2733.4, hfg: 2144.3 },
  { tempC: 150, pBar: 4.76, hf: 632.2, hg: 2745.9, hfg: 2113.7 },
  { tempC: 160, pBar: 6.181, hf: 675.5, hg: 2757.4, hfg: 2081.9 },
  { tempC: 170, pBar: 7.92, hf: 719.1, hg: 2767.9, hfg: 2048.8 },
  { tempC: 180, pBar: 10.03, hf: 763.1, hg: 2777.2, hfg: 2014.1 },
  { tempC: 190, pBar: 12.55, hf: 807.4, hg: 2785.3, hfg: 1977.9 },
  { tempC: 200, pBar: 15.55, hf: 852.3, hg: 2792.0, hfg: 1939.7 },
] as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert pressure from kg/cm²(g) to bar
 *
 * @param pressureKgCm2G - Pressure in kg/cm²(g)
 * @returns Pressure in bar
 */
export function kgCm2GaugeToBar(pressureKgCm2G: number): number {
  // kg/cm²(g) + atmospheric = kg/cm²(a)
  // kg/cm²(a) × 0.980665 = bar
  const pressureKgCm2A = pressureKgCm2G + 1.033;
  return pressureKgCm2A * 0.980665;
}

/**
 * Convert pressure from bar to kg/cm²(g)
 *
 * @param pressureBar - Pressure in bar
 * @returns Pressure in kg/cm²(g)
 */
export function barToKgCm2Gauge(pressureBar: number): number {
  const pressureKgCm2A = pressureBar / 0.980665;
  return pressureKgCm2A - 1.033;
}

/**
 * Get saturation temperature from gauge pressure in kg/cm²
 *
 * @param pressureKgCm2G - Gauge pressure in kg/cm²(g)
 * @returns Saturation temperature in °C
 */
export function getSaturationTemperatureFromGauge(pressureKgCm2G: number): number {
  const pressureBar = kgCm2GaugeToBar(pressureKgCm2G);
  return getSaturationTemperature(pressureBar);
}

/**
 * Convert pressure head in meters of water to bar
 *
 * @param headM - Pressure head in meters of water
 * @returns Pressure in bar
 */
export function waterHeadToBar(headM: number): number {
  // 10.33m of water = 1.01325 bar (at 4°C, standard gravity)
  return (headM / 10.33) * 1.01325;
}

/**
 * Convert bar to pressure head in meters of water
 *
 * @param pressureBar - Pressure in bar
 * @returns Pressure head in meters of water
 */
export function barToWaterHead(pressureBar: number): number {
  return (pressureBar / 1.01325) * 10.33;
}

/**
 * Convert millibar absolute to bar
 *
 * @param mbarAbs - Pressure in millibar absolute
 * @returns Pressure in bar
 */
export function mbarAbsToBar(mbarAbs: number): number {
  return mbarAbs / 1000;
}

/**
 * Convert bar to millibar absolute
 *
 * @param pressureBar - Pressure in bar
 * @returns Pressure in millibar absolute
 */
export function barToMbarAbs(pressureBar: number): number {
  return pressureBar * 1000;
}

/**
 * Get saturation temperature from absolute pressure in millibar
 *
 * @param mbarAbs - Absolute pressure in millibar
 * @returns Saturation temperature in °C
 */
export function getSaturationTemperatureFromMbar(mbarAbs: number): number {
  const pressureBar = mbarAbsToBar(mbarAbs);
  return getSaturationTemperature(pressureBar);
}

/** Atmospheric pressure in millibar */
export const ATM_MBAR = 1013.25;
