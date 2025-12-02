/**
 * IAPWS-IF97 Common Utilities
 *
 * Shared constants and region detection functions for steam property calculations.
 * Supports Regions 1 (subcooled liquid), 2 (superheated steam), and 4 (saturation).
 *
 * Reference: IAPWS-IF97
 */

import { getSaturationTemperature, getSaturationPressure } from './steamTables';

// ============================================================================
// Shared Constants
// ============================================================================

/** Specific gas constant for water in kJ/(kg·K) */
export const R_WATER = 0.461526;

/** Critical temperature in K */
export const T_CRITICAL_K = 647.096;

/** Critical temperature in °C */
export const T_CRITICAL_C = 373.946;

/** Critical pressure in MPa */
export const P_CRITICAL_MPA = 22.064;

/** Critical pressure in bar */
export const P_CRITICAL_BAR = 220.64;

/** Region 1 reference temperature T* (K) */
export const T_STAR_R1 = 1386;

/** Region 1 reference pressure p* (MPa) */
export const P_STAR_R1 = 16.53;

/** Region 2 reference temperature T* (K) */
export const T_STAR_R2 = 540;

/** Region 2 reference pressure p* (MPa) */
export const P_STAR_R2 = 1;

// ============================================================================
// Region Detection Functions
// ============================================================================

/**
 * Determine which IAPWS-IF97 region a given P,T point belongs to
 *
 * Region 1: Subcooled liquid (T < T_sat at given P)
 * Region 2: Superheated steam (T > T_sat at given P)
 * Region 4: Saturation line (T ≈ T_sat at given P)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @param tolerance - Tolerance for saturation detection in °C (default: 0.1)
 * @returns Region number (1, 2, or 4)
 */
export function getRegion(pressureBar: number, tempC: number, tolerance: number = 0.1): 1 | 2 | 4 {
  // Get saturation temperature at given pressure
  const tSat = getSaturationTemperature(pressureBar);

  // Check if at saturation (within tolerance)
  if (Math.abs(tempC - tSat) <= tolerance) {
    return 4;
  }

  // Below saturation = subcooled liquid (Region 1)
  if (tempC < tSat) {
    return 1;
  }

  // Above saturation = superheated steam (Region 2)
  return 2;
}

/**
 * Check if a state is subcooled liquid (Region 1)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns true if subcooled
 */
export function isSubcooled(pressureBar: number, tempC: number): boolean {
  const tSat = getSaturationTemperature(pressureBar);
  return tempC < tSat;
}

/**
 * Check if a state is superheated steam (Region 2)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns true if superheated
 */
export function isSuperheated(pressureBar: number, tempC: number): boolean {
  const tSat = getSaturationTemperature(pressureBar);
  return tempC > tSat;
}

/**
 * Calculate degree of subcooling below saturation
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Actual temperature in °C
 * @returns Subcooling in °C (positive = subcooled, negative = superheated)
 */
export function getSubcooling(pressureBar: number, tempC: number): number {
  const tSat = getSaturationTemperature(pressureBar);
  return tSat - tempC;
}

/**
 * Calculate degree of superheat above saturation
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Actual temperature in °C
 * @returns Superheat in °C (positive = superheated, negative = subcooled)
 */
export function getSuperheat(pressureBar: number, tempC: number): number {
  const tSat = getSaturationTemperature(pressureBar);
  return tempC - tSat;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that inputs are within Region 1 bounds
 *
 * Region 1: 273.15 K ≤ T ≤ 623.15 K (0 - 350°C)
 *           P_sat(T) ≤ P ≤ 100 MPa (1000 bar)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @throws Error if outside valid range
 */
export function validateRegion1(pressureBar: number, tempC: number): void {
  // Temperature bounds
  if (tempC < 0 || tempC > 350) {
    throw new Error(`Temperature ${tempC}°C is outside Region 1 valid range (0-350°C)`);
  }

  // Pressure bounds
  if (pressureBar < 0.00611657 || pressureBar > 1000) {
    throw new Error(
      `Pressure ${pressureBar} bar is outside Region 1 valid range (0.00611657-1000 bar)`
    );
  }

  // Must be subcooled (P > P_sat at given T)
  const pSat = getSaturationPressure(tempC);
  if (pressureBar < pSat) {
    throw new Error(
      `State is not subcooled: P=${pressureBar} bar < P_sat=${pSat.toFixed(4)} bar at T=${tempC}°C`
    );
  }
}

/**
 * Validate that inputs are within Region 2 bounds
 *
 * Region 2: 273.15 K ≤ T ≤ 1073.15 K (0 - 800°C)
 *           0 < P ≤ 100 MPa (1000 bar)
 *           T > T_sat(P)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @throws Error if outside valid range
 */
export function validateRegion2(pressureBar: number, tempC: number): void {
  // Temperature bounds
  if (tempC < 0 || tempC > 800) {
    throw new Error(`Temperature ${tempC}°C is outside Region 2 valid range (0-800°C)`);
  }

  // Pressure bounds
  if (pressureBar <= 0 || pressureBar > 1000) {
    throw new Error(`Pressure ${pressureBar} bar is outside Region 2 valid range (>0-1000 bar)`);
  }

  // Must be superheated (T > T_sat at given P)
  // Note: For very low pressures, saturation temp might be below 0°C
  if (pressureBar >= 0.00611657 && pressureBar <= 220.64) {
    const tSat = getSaturationTemperature(pressureBar);
    if (tempC <= tSat) {
      throw new Error(
        `State is not superheated: T=${tempC}°C ≤ T_sat=${tSat.toFixed(2)}°C at P=${pressureBar} bar`
      );
    }
  }
}

// ============================================================================
// Dimensionless Parameter Functions
// ============================================================================

/**
 * Calculate dimensionless pressure (pi) for Region 1
 *
 * @param pressureBar - Pressure in bar
 * @returns Dimensionless pressure π = P / P*
 */
export function getPiRegion1(pressureBar: number): number {
  const pMPa = pressureBar / 10;
  return pMPa / P_STAR_R1;
}

/**
 * Calculate dimensionless temperature (tau) for Region 1
 *
 * @param tempC - Temperature in °C
 * @returns Dimensionless temperature τ = T* / T
 */
export function getTauRegion1(tempC: number): number {
  const TK = tempC + 273.15;
  return T_STAR_R1 / TK;
}

/**
 * Calculate dimensionless pressure (pi) for Region 2
 *
 * @param pressureBar - Pressure in bar
 * @returns Dimensionless pressure π = P / P*
 */
export function getPiRegion2(pressureBar: number): number {
  const pMPa = pressureBar / 10;
  return pMPa / P_STAR_R2;
}

/**
 * Calculate dimensionless temperature (tau) for Region 2
 *
 * @param tempC - Temperature in °C
 * @returns Dimensionless temperature τ = T* / T
 */
export function getTauRegion2(tempC: number): number {
  const TK = tempC + 273.15;
  return T_STAR_R2 / TK;
}
