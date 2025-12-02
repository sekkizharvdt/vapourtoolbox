/**
 * IAPWS-IF97 Region 2: Superheated Steam
 *
 * Implementation of IAPWS-IF97 Region 2 equations for superheated steam.
 * Valid range: 273.15 K ≤ T ≤ 1073.15 K (0-800°C), 0 < P ≤ 100 MPa
 *
 * Region 2 uses a sum of ideal-gas (γ₀) and residual (γᵣ) parts:
 * γ = γ₀ + γᵣ
 *
 * Reference: IAPWS-IF97 Tables 10 and 11
 */

import {
  R_WATER,
  validateRegion2,
  getPiRegion2,
  getTauRegion2,
  getSuperheat,
} from './steamTablesCommon';

// ============================================================================
// Region 2 Ideal-Gas Part Coefficients (IAPWS-IF97 Table 10)
// ============================================================================

/** J0 exponents for ideal-gas part */
const J0: readonly number[] = [0, 1, -5, -4, -3, -2, -1, 2, 3];

/** n0 coefficients for ideal-gas part (9 terms) */
const n0: readonly number[] = [
  -0.96927686500217e1, 0.10086655968018e2, -0.5608791128302e-2, 0.71452738081455e-1,
  -0.40710498223928, 0.14240819171444e1, -0.4383951131945e1, -0.28408632460772, 0.21268463753307e-1,
];

// ============================================================================
// Region 2 Residual Part Coefficients (IAPWS-IF97 Table 11)
// ============================================================================

/** I exponents for residual part (43 terms) */
const Ir: readonly number[] = [
  1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 10, 10, 10,
  16, 16, 18, 20, 20, 20, 21, 22, 23, 24, 24, 24,
];

/** J exponents for residual part (43 terms) */
const Jr: readonly number[] = [
  0, 1, 2, 3, 6, 1, 2, 4, 7, 36, 0, 1, 3, 6, 35, 1, 2, 3, 7, 3, 16, 35, 0, 11, 25, 8, 36, 13, 4, 10,
  14, 29, 50, 57, 20, 35, 48, 21, 53, 39, 26, 40, 58,
];

/** nr coefficients for residual part (43 terms) */
const nr: readonly number[] = [
  -0.17731742473213e-2, -0.17834862292358e-1, -0.45996013696365e-1, -0.57581259083432e-1,
  -0.5032527872793e-1, -0.33032641670203e-4, -0.18948987516315e-3, -0.39392777243355e-2,
  -0.43797295650573e-1, -0.26674547914087e-4, 0.20481737692309e-7, 0.43870667284435e-6,
  -0.3227767723857e-4, -0.15033924542148e-2, -0.40668253562649e-4, -0.78847309559367e-9,
  0.12790717852285e-7, 0.48225372718507e-6, 0.22922076337661e-5, -0.16714766451061e-10,
  -0.21171472321355e-2, -0.23895741934104e2, -0.5905956432427e-17, -0.12621808899101e-5,
  -0.38946842435739e-1, 0.11256211360459e-10, -0.82311340897998e1, 0.19809712802088e-7,
  0.10406965210174e-18, -0.10234747095929e-12, -0.10018179379511e-8, -0.80882908646985e-10,
  0.10693031879409, -0.33662250574171, 0.89185845355421e-24, 0.30629316876232e-12,
  -0.42002467698208e-5, -0.59056029685639e-25, 0.37826947613457e-5, -0.12768608934681e-14,
  0.73087610595061e-28, 0.55414715350778e-16, -0.9436970724121e-6,
];

// ============================================================================
// Gibbs Free Energy - Ideal Gas Part
// ============================================================================

/**
 * Calculate ideal-gas part γ₀ for Region 2
 *
 * γ₀ = ln(π) + Σ n₀ᵢ × τ^J₀ᵢ
 */
function gamma0(pi: number, tau: number): number {
  let sum = Math.log(pi);
  for (let i = 0; i < 9; i++) {
    sum += n0[i]! * Math.pow(tau, J0[i]!);
  }
  return sum;
}

/**
 * ∂γ₀/∂π = 1/π
 */
function gamma0_pi(pi: number): number {
  return 1 / pi;
}

/**
 * ∂²γ₀/∂π² = -1/π²
 */
function gamma0_pipi(pi: number): number {
  return -1 / (pi * pi);
}

/**
 * ∂γ₀/∂τ = Σ n₀ᵢ × J₀ᵢ × τ^(J₀ᵢ-1)
 */
function gamma0_tau(tau: number): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += n0[i]! * J0[i]! * Math.pow(tau, J0[i]! - 1);
  }
  return sum;
}

/**
 * ∂²γ₀/∂τ² = Σ n₀ᵢ × J₀ᵢ × (J₀ᵢ-1) × τ^(J₀ᵢ-2)
 */
function gamma0_tautau(tau: number): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += n0[i]! * J0[i]! * (J0[i]! - 1) * Math.pow(tau, J0[i]! - 2);
  }
  return sum;
}

// ============================================================================
// Gibbs Free Energy - Residual Part
// ============================================================================

/**
 * Calculate residual part γᵣ for Region 2
 *
 * γᵣ = Σ nᵣᵢ × π^Iᵢ × (τ - 0.5)^Jᵢ
 */
function gammar(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Math.pow(pi, Ir[i]!) * Math.pow(tauTerm, Jr[i]!);
  }
  return sum;
}

/**
 * ∂γᵣ/∂π
 */
function gammar_pi(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Ir[i]! * Math.pow(pi, Ir[i]! - 1) * Math.pow(tauTerm, Jr[i]!);
  }
  return sum;
}

/**
 * ∂²γᵣ/∂π²
 */
function gammar_pipi(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Ir[i]! * (Ir[i]! - 1) * Math.pow(pi, Ir[i]! - 2) * Math.pow(tauTerm, Jr[i]!);
  }
  return sum;
}

/**
 * ∂γᵣ/∂τ
 */
function gammar_tau(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Math.pow(pi, Ir[i]!) * Jr[i]! * Math.pow(tauTerm, Jr[i]! - 1);
  }
  return sum;
}

/**
 * ∂²γᵣ/∂τ²
 */
function gammar_tautau(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Math.pow(pi, Ir[i]!) * Jr[i]! * (Jr[i]! - 1) * Math.pow(tauTerm, Jr[i]! - 2);
  }
  return sum;
}

/**
 * ∂²γᵣ/∂π∂τ
 */
function gammar_pitau(pi: number, tau: number): number {
  let sum = 0;
  const tauTerm = tau - 0.5;
  for (let i = 0; i < 43; i++) {
    sum += nr[i]! * Ir[i]! * Math.pow(pi, Ir[i]! - 1) * Jr[i]! * Math.pow(tauTerm, Jr[i]! - 1);
  }
  return sum;
}

// ============================================================================
// Property Functions
// ============================================================================

/**
 * Get specific enthalpy of superheated steam
 *
 * h = R × T × τ × (γ₀_τ + γᵣ_τ)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific enthalpy in kJ/kg
 */
export function getEnthalpySuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);
  const TK = tempC + 273.15;

  const gt0 = gamma0_tau(tau);
  const gtr = gammar_tau(pi, tau);

  return R_WATER * TK * tau * (gt0 + gtr);
}

/**
 * Get specific volume of superheated steam
 *
 * v = R × T / P × π × (γ₀_π + γᵣ_π)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific volume in m³/kg
 */
export function getSpecificVolumeSuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);
  const TK = tempC + 273.15;
  const pMPa = pressureBar / 10;

  const gp0 = gamma0_pi(pi);
  const gpr = gammar_pi(pi, tau);

  // v = R*T*π*(γ₀_π + γᵣ_π) / (P*1000)
  return (R_WATER * TK * pi * (gp0 + gpr)) / (pMPa * 1000);
}

/**
 * Get density of superheated steam
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getDensitySuperheated(pressureBar: number, tempC: number): number {
  return 1 / getSpecificVolumeSuperheated(pressureBar, tempC);
}

/**
 * Get specific heat capacity at constant pressure (Cp) of superheated steam
 *
 * Cp = -R × τ² × (γ₀_ττ + γᵣ_ττ)
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Specific heat in kJ/(kg·K)
 */
export function getSpecificHeatSuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);

  const gtt0 = gamma0_tautau(tau);
  const gttr = gammar_tautau(pi, tau);

  return -R_WATER * tau * tau * (gtt0 + gttr);
}

/**
 * Get speed of sound in superheated steam
 *
 * w = √(R×T × (1 + 2×π×γᵣ_π + π²×γᵣ_π²) /
 *       ((1 - π²×γᵣ_ππ) + (1 + π×γᵣ_π - τ×π×γᵣ_πτ)² / (τ²×(γ₀_ττ + γᵣ_ττ))))
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Speed of sound in m/s
 */
export function getSpeedOfSoundSuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);
  const TK = tempC + 273.15;

  const gp0 = gamma0_pi(pi);
  const gpp0 = gamma0_pipi(pi);
  const gtt0 = gamma0_tautau(tau);

  const gpr = gammar_pi(pi, tau);
  const gppr = gammar_pipi(pi, tau);
  const gttr = gammar_tautau(pi, tau);
  const gptr = gammar_pitau(pi, tau);

  // Total derivatives
  const gp = gp0 + gpr;
  const gpp = gpp0 + gppr;
  const gtt = gtt0 + gttr;

  const numerator = gp * gp;
  const term1 = Math.pow(gp - tau * gptr, 2) / (tau * tau * gtt);
  const denominator = term1 - gpp;

  // R in kJ/(kg·K), multiply by 1000 for m/s result
  return Math.sqrt((R_WATER * 1000 * TK * numerator) / denominator);
}

/**
 * Get internal energy of superheated steam
 *
 * u = R × T × (τ × (γ₀_τ + γᵣ_τ) - π × (γ₀_π + γᵣ_π))
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Internal energy in kJ/kg
 */
export function getInternalEnergySuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);
  const TK = tempC + 273.15;

  const gt0 = gamma0_tau(tau);
  const gtr = gammar_tau(pi, tau);
  const gp0 = gamma0_pi(pi);
  const gpr = gammar_pi(pi, tau);

  return R_WATER * TK * (tau * (gt0 + gtr) - pi * (gp0 + gpr));
}

/**
 * Get entropy of superheated steam
 *
 * s = R × (τ × (γ₀_τ + γᵣ_τ) - (γ₀ + γᵣ))
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Entropy in kJ/(kg·K)
 */
export function getEntropySuperheated(pressureBar: number, tempC: number): number {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);

  const g0 = gamma0(pi, tau);
  const gr = gammar(pi, tau);
  const gt0 = gamma0_tau(tau);
  const gtr = gammar_tau(pi, tau);

  return R_WATER * (tau * (gt0 + gtr) - (g0 + gr));
}

// ============================================================================
// Bundled Properties Function
// ============================================================================

/**
 * Superheated steam properties interface
 */
export interface SuperheatedProperties {
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
  /** Degree of superheat in °C */
  superheat: number;
  /** Internal energy in kJ/kg */
  internalEnergy: number;
  /** Entropy in kJ/(kg·K) */
  entropy: number;
}

/**
 * Get all superheated steam properties at once
 *
 * @param pressureBar - Pressure in bar
 * @param tempC - Temperature in °C
 * @returns Object with all superheated properties
 */
export function getSuperheatedProperties(
  pressureBar: number,
  tempC: number
): SuperheatedProperties {
  validateRegion2(pressureBar, tempC);

  const pi = getPiRegion2(pressureBar);
  const tau = getTauRegion2(tempC);
  const TK = tempC + 273.15;
  const pMPa = pressureBar / 10;

  // Pre-calculate derivatives
  const g0 = gamma0(pi, tau);
  const gr = gammar(pi, tau);
  const gp0 = gamma0_pi(pi);
  const gpr = gammar_pi(pi, tau);
  const gpp0 = gamma0_pipi(pi);
  const gppr = gammar_pipi(pi, tau);
  const gt0 = gamma0_tau(tau);
  const gtr = gammar_tau(pi, tau);
  const gtt0 = gamma0_tautau(tau);
  const gttr = gammar_tautau(pi, tau);
  const gptr = gammar_pitau(pi, tau);

  // Calculate properties
  const enthalpy = R_WATER * TK * tau * (gt0 + gtr);
  const specificVolume = (R_WATER * TK * pi * (gp0 + gpr)) / (pMPa * 1000);
  const density = 1 / specificVolume;
  const specificHeat = -R_WATER * tau * tau * (gtt0 + gttr);

  // Speed of sound calculation - using total derivatives
  const gp = gp0 + gpr;
  const gpp = gpp0 + gppr;
  const gtt = gtt0 + gttr;
  const numerator = gp * gp;
  const term1 = Math.pow(gp - tau * gptr, 2) / (tau * tau * gtt);
  const speedOfSound = Math.sqrt((R_WATER * 1000 * TK * numerator) / (term1 - gpp));

  const internalEnergy = R_WATER * TK * (tau * (gt0 + gtr) - pi * (gp0 + gpr));
  const entropy = R_WATER * (tau * (gt0 + gtr) - (g0 + gr));
  const superheat = getSuperheat(pressureBar, tempC);

  return {
    enthalpy,
    specificVolume,
    density,
    specificHeat,
    speedOfSound,
    superheat,
    internalEnergy,
    entropy,
  };
}
