/**
 * IAPWS-IF97 Region 1: Subcooled/Compressed Liquid
 *
 * Implementation of IAPWS-IF97 Region 1 equations for subcooled liquid water.
 * Valid range: 273.15 K ≤ T ≤ 623.15 K (0-350°C), P_sat(T) ≤ P ≤ 100 MPa
 *
 * Reference: IAPWS-IF97 Table 2 (34 coefficients)
 */

import {
  R_WATER,
  validateRegion1,
  getPiRegion1,
  getTauRegion1,
  getSubcooling,
} from './steamTablesCommon';

// ============================================================================
// Region 1 Coefficients (IAPWS-IF97 Table 2)
// ============================================================================

/** I exponents for Region 1 */
const I1: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29,
  30, 31, 32,
];

/** J exponents for Region 1 */
const J1: readonly number[] = [
  -2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6,
  -29, -31, -38, -39, -40, -41,
];

/** n coefficients for Region 1 (IAPWS-IF97 Table 2) */
const n1: readonly number[] = [
  0.14632971213167, -0.84548187169114, -0.3756360367204e1, 0.33855169168385e1, -0.95791963387872,
  0.15772038513228, -0.16616417199501e-1, 0.81214629983568e-3, 0.28319080123804e-3,
  -0.60706301565874e-3, -0.18990068218419e-1, -0.32529748770505e-1, -0.21841717175414e-1,
  -0.5283835796993e-4, -0.47184321073267e-3, -0.30001780793026e-3, 0.47661393906987e-4,
  -0.44141845330846e-5, -0.72694996297594e-15, -0.31679644845054e-4, -0.28270797985312e-5,
  -0.85205128120103e-9, -0.22425281908e-5, -0.65171222895601e-6, -0.14341729937924e-12,
  -0.40516996860117e-6, -0.12734301741682e-8, -0.17424871230634e-9, -0.68762131295531e-18,
  0.14478307828521e-19, 0.26335781662795e-22, -0.11947622640071e-22, 0.18228094581404e-23,
  -0.93537087292458e-25,
];

// ============================================================================
// Gibbs Free Energy and Derivatives
// ============================================================================

/**
 * Calculate dimensionless Gibbs free energy γ for Region 1
 *
 * γ = Σ nᵢ × (7.1 - π)^Iᵢ × (τ - 1.222)^Jᵢ
 */
function gamma1(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum += n1[i]! * Math.pow(piTerm, I1[i]!) * Math.pow(tauTerm, J1[i]!);
  }
  return sum;
}

/**
 * Calculate ∂γ/∂π (derivative with respect to pi) for Region 1
 */
function gamma1_pi(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum += -n1[i]! * I1[i]! * Math.pow(piTerm, I1[i]! - 1) * Math.pow(tauTerm, J1[i]!);
  }
  return sum;
}

/**
 * Calculate ∂²γ/∂π² for Region 1
 */
function gamma1_pipi(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum +=
      n1[i]! * I1[i]! * (I1[i]! - 1) * Math.pow(piTerm, I1[i]! - 2) * Math.pow(tauTerm, J1[i]!);
  }
  return sum;
}

/**
 * Calculate ∂γ/∂τ (derivative with respect to tau) for Region 1
 */
function gamma1_tau(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum += n1[i]! * Math.pow(piTerm, I1[i]!) * J1[i]! * Math.pow(tauTerm, J1[i]! - 1);
  }
  return sum;
}

/**
 * Calculate ∂²γ/∂τ² for Region 1
 */
function gamma1_tautau(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum +=
      n1[i]! * Math.pow(piTerm, I1[i]!) * J1[i]! * (J1[i]! - 1) * Math.pow(tauTerm, J1[i]! - 2);
  }
  return sum;
}

/**
 * Calculate ∂²γ/∂π∂τ for Region 1
 */
function gamma1_pitau(pi: number, tau: number): number {
  let sum = 0;
  const piTerm = 7.1 - pi;
  const tauTerm = tau - 1.222;

  for (let i = 0; i < 34; i++) {
    sum += -n1[i]! * I1[i]! * Math.pow(piTerm, I1[i]! - 1) * J1[i]! * Math.pow(tauTerm, J1[i]! - 1);
  }
  return sum;
}

// ============================================================================
// Property Functions
// ============================================================================

/**
 * Get specific enthalpy of subcooled liquid
 *
 * h = R × T × τ × γ_τ
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific enthalpy in kJ/kg
 */
export function getEnthalpySubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);
  const TK = tempC + 273.15;

  return R_WATER * TK * tau * gamma1_tau(pi, tau);
}

/**
 * Get specific volume of subcooled liquid
 *
 * v = R × T / P × π × γ_π
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific volume in m³/kg
 */
export function getSpecificVolumeSubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);
  const TK = tempC + 273.15;
  const pMPa = pressureBar / 10;

  // R in kJ/(kg·K) = 1000 J/(kg·K), P in MPa = 10^6 Pa
  // v = R*T*π*γ_π / P = (R*1000) * T * π * γ_π / (P * 10^6)
  // Simplify: v = R * T * π * γ_π / (P * 1000)
  return (R_WATER * TK * pi * gamma1_pi(pi, tau)) / (pMPa * 1000);
}

/**
 * Get density of subcooled liquid
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getDensitySubcooled(pressureBar: number, tempC: number): number {
  return 1 / getSpecificVolumeSubcooled(pressureBar, tempC);
}

/**
 * Get specific heat capacity at constant pressure (Cp) of subcooled liquid
 *
 * Cp = -R × τ² × γ_ττ
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific heat in kJ/(kg·K)
 */
export function getSpecificHeatSubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);

  return -R_WATER * tau * tau * gamma1_tautau(pi, tau);
}

/**
 * Get speed of sound in subcooled liquid
 *
 * w = √(R × T × γ_π² / ((γ_π - τ×γ_πτ)²/(τ²×γ_ττ) - γ_ππ)) × 1000
 *
 * Note: Factor of 1000 to convert from kJ to J for velocity in m/s
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Speed of sound in m/s
 */
export function getSpeedOfSoundSubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);
  const TK = tempC + 273.15;

  const gp = gamma1_pi(pi, tau);
  const gpp = gamma1_pipi(pi, tau);
  const gtt = gamma1_tautau(pi, tau);
  const gpt = gamma1_pitau(pi, tau);

  const term1 = gp * gp;
  const term2 = Math.pow(gp - tau * gpt, 2) / (tau * tau * gtt);
  const denominator = term2 - gpp;

  // R in kJ/(kg·K), multiply by 1000 to get J/(kg·K) for m/s result
  return Math.sqrt((R_WATER * 1000 * TK * term1) / denominator);
}

/**
 * Get internal energy of subcooled liquid
 *
 * u = R × T × (τ × γ_τ - π × γ_π)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Internal energy in kJ/kg
 */
export function getInternalEnergySubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);
  const TK = tempC + 273.15;

  return R_WATER * TK * (tau * gamma1_tau(pi, tau) - pi * gamma1_pi(pi, tau));
}

/**
 * Get entropy of subcooled liquid
 *
 * s = R × (τ × γ_τ - γ)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Entropy in kJ/(kg·K)
 */
export function getEntropySubcooled(pressureBar: number, tempC: number): number {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);

  return R_WATER * (tau * gamma1_tau(pi, tau) - gamma1(pi, tau));
}

// ============================================================================
// Bundled Properties Function
// ============================================================================

/**
 * Subcooled liquid properties interface
 */
export interface SubcooledProperties {
  /** Specific enthalpy in kJ/kg */
  enthalpy: number;
  /** Specific volume in m³/kg */
  specificVolume: number;
  /** Density in kg/m³ */
  density: number;
  /** Specific heat Cp in kJ/(kg·K) */
  specificHeat: number;
  /** Speed of sound in m/s */
  speedOfSound: number;
  /** Degree of subcooling in °C */
  subcooling: number;
  /** Internal energy in kJ/kg */
  internalEnergy: number;
  /** Entropy in kJ/(kg·K) */
  entropy: number;
}

/**
 * Get all subcooled liquid properties at once
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Object with all subcooled properties
 */
export function getSubcooledProperties(pressureBar: number, tempC: number): SubcooledProperties {
  validateRegion1(pressureBar, tempC);

  const pi = getPiRegion1(pressureBar);
  const tau = getTauRegion1(tempC);
  const TK = tempC + 273.15;
  const pMPa = pressureBar / 10;

  // Pre-calculate derivatives
  const g = gamma1(pi, tau);
  const gp = gamma1_pi(pi, tau);
  const gpp = gamma1_pipi(pi, tau);
  const gt = gamma1_tau(pi, tau);
  const gtt = gamma1_tautau(pi, tau);
  const gpt = gamma1_pitau(pi, tau);

  // Calculate all properties
  const enthalpy = R_WATER * TK * tau * gt;
  const specificVolume = (R_WATER * TK * pi * gp) / (pMPa * 1000);
  const density = 1 / specificVolume;
  const specificHeat = -R_WATER * tau * tau * gtt;

  const term1 = gp * gp;
  const term2 = Math.pow(gp - tau * gpt, 2) / (tau * tau * gtt);
  const speedOfSound = Math.sqrt((R_WATER * 1000 * TK * term1) / (term2 - gpp));

  const internalEnergy = R_WATER * TK * (tau * gt - pi * gp);
  const entropy = R_WATER * (tau * gt - g);
  const subcooling = getSubcooling(pressureBar, tempC);

  return {
    enthalpy,
    specificVolume,
    density,
    specificHeat,
    speedOfSound,
    subcooling,
    internalEnergy,
    entropy,
  };
}
