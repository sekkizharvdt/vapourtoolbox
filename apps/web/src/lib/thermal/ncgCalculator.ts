/**
 * NCG (Non-Condensable Gas) Properties Calculator
 *
 * Calculates thermophysical properties of NCG + water-vapour mixtures
 * encountered in thermal desalination vacuum systems.
 *
 * NCG is treated as standard dry air: N₂ 78.09 mol% · O₂ 20.95 mol% · Ar 0.93 mol%
 * Effective molar mass M_air = 28.97 g/mol.
 *
 * Dissolved gas content in seawater uses Weiss (1970) correlations,
 * valid for T = 0–36 °C and S = 0–40 g/kg.
 *
 * References
 * ──────────
 *  Weiss R.F. (1970). "The solubility of nitrogen, oxygen and argon in water
 *    and seawater." Deep-Sea Research 17, 721–735.
 *  Wilke C.R. (1950). "A viscosity equation for gas mixtures."
 *    J. Chem. Phys. 18(4), 517–519.
 *  Wassiljewa A. (1904) + Mason & Saxena (1958) — conductivity mixing rule.
 */

import { getSaturationPressure, getEnthalpyVapor } from '@vapour/constants';

// ── Physical constants ─────────────────────────────────────────────────────────

/** Effective molar mass of dry air (g/mol) */
const M_AIR = 28.97;
/** Molar mass of water (g/mol) */
const M_H2O = 18.015;
/** Universal gas constant (J / mol·K) */
const R_UNIV = 8.314;
/** Cp of dry air at low temperatures (kJ / kg·K) — nearly constant 0–200 °C */
const CP_AIR = 1.005;
/** Cp of low-pressure water vapour (kJ / kg·K) */
const CP_VAPOR = 1.872;

/** Conversion: mL(STP) O₂ → mg (M_O₂ / molar_volume_STP) */
const O2_MG_PER_ML_STP = 32.0 / 22.414; // ≈ 1.4276 mg/mL
/** Conversion: mL(STP) N₂ → mg */
const N2_MG_PER_ML_STP = 28.014 / 22.414; // ≈ 1.2499 mg/mL

// ── Weiss (1970) coefficients ──────────────────────────────────────────────────

const WEISS_O2_A = [-173.4292, 249.6339, 143.3483, -21.8492] as const;
const WEISS_O2_B = [-0.033096, 0.014259, -0.0017] as const;
const WEISS_N2_A = [-172.4965, 248.4262, 143.0738, -21.712] as const;
const WEISS_N2_B = [-0.049781, 0.025018, -0.0034861] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

export type NCGInputMode = 'seawater' | 'dry_ncg' | 'wet_ncg' | 'split_flows';

export interface NCGInput {
  mode: NCGInputMode;

  /** Mixture / vacuum-system temperature (°C) */
  temperatureC: number;

  /**
   * When useSatPressure = false: total system pressure (bar abs).
   * When useSatPressure = true: NCG-only partial pressure above P_sat(T) (bar).
   * Not required for 'split_flows' mode (pressure is derived from flow rates).
   */
  pressureBar?: number;

  /**
   * When true, P_total = P_sat(T) + pressureBar, where pressureBar is the NCG
   * partial pressure. Typical for vacuum systems where total pressure is only
   * slightly above the saturation pressure of the vapour.
   * Not required for 'split_flows' mode.
   */
  useSatPressure?: boolean;

  // — Seawater mode inputs ——————————————————————————————————————
  /** Seawater volumetric feed flow (m³/h) */
  seawaterFlowM3h?: number;
  /**
   * Temperature at which gas is released from seawater (°C).
   * Defaults to temperatureC if not supplied.
   * Weiss (1970) correlation is accurate for 0–36 °C; results outside this
   * range are extrapolated.
   */
  seawaterTempC?: number;
  /** Seawater salinity (g/kg). Default: 35 g/kg. */
  salinityGkg?: number;

  // — Dry NCG mode ———————————————————————————————————————————————
  /** Dry NCG mass flow (kg/h) — gas only, no water vapour included. */
  dryNcgFlowKgH?: number;

  // — Wet NCG mode ———————————————————————————————————————————————
  /** Total (wet) NCG+vapour mass flow at the stated T and P (kg/h). */
  wetNcgFlowKgH?: number;

  // — Split flows mode ───────────────────────────────────────────
  /**
   * Water vapour mass flow (kg/h) — used together with dryNcgFlowKgH in
   * 'split_flows' mode to derive total pressure via Dalton's law:
   *   P_total = P_sat(T) / y_H₂O
   */
  vapourFlowKgH?: number;
}

export interface NCGSeawaterInfo {
  gasTempC: number;
  salinityGkg: number;
  o2MlL: number; // mL(STP)/L dissolved O₂
  n2MlL: number; // mL(STP)/L dissolved N₂
  o2MgL: number; // mg/L dissolved O₂
  n2MgL: number; // mg/L dissolved N₂
  totalGasMgL: number; // mg/L total dissolved gas
  extrapolated: boolean; // true when T > 36 °C (outside Weiss valid range)
}

export interface NCGResult {
  // ── Conditions ──────────────────────────────────────────────────
  temperatureC: number;
  totalPressureBar: number;
  satPressureBar: number;
  ncgPartialPressureBar: number;
  waterVapourPartialPressureBar: number;

  // ── Composition ─────────────────────────────────────────────────
  waterVapourMoleFrac: number;
  ncgMoleFrac: number;
  waterVapourMassFrac: number;
  ncgMassFrac: number;
  mixMolarMass: number; // g/mol

  // ── Density & specific volume ───────────────────────────────────
  density: number; // kg/m³ at T, P_total
  specificVolume: number; // m³/kg

  // ── Enthalpy ────────────────────────────────────────────────────
  specificEnthalpy: number; // kJ/kg  (ref: dry air @ 0 °C; liquid water @ 0 °C)
  vaporEnthalpy: number; // kJ/kg  h_g at T from IAPWS
  airEnthalpy: number; // kJ/kg  Cp_air × T

  // ── Specific heats ──────────────────────────────────────────────
  cpMix: number; // kJ/(kg·K)
  cvMix: number; // kJ/(kg·K)
  gammaMix: number; // Cp / Cv

  // ── Transport properties ────────────────────────────────────────
  dynamicViscosityPas: number; // Pa·s
  thermalConductivityWmK: number; // W/(m·K)

  // ── Flow breakdown (populated only when a flow rate is provided) ─
  dryNcgFlowKgH: number | null;
  waterVapourFlowKgH: number | null;
  totalFlowKgH: number | null;
  volumetricFlowM3h: number | null; // m³/h at T, P_total

  // ── Seawater dissolution info (seawater mode only) ──────────────
  seawaterInfo?: NCGSeawaterInfo;
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Weiss (1970) dissolved gas concentration at air-saturation equilibrium.
 * Returns dissolved concentration in mL(STP)/L of seawater.
 *
 * Formula: ln(C) = A₁ + A₂·(100/T) + A₃·ln(T/100) + A₄·(T/100)
 *                + S·[ B₁ + B₂·(T/100) + B₃·(T/100)² ]
 * where T is in Kelvin and S is salinity in g/kg.
 */
function weissConcentration(
  A: readonly [number, number, number, number],
  B: readonly [number, number, number],
  tempC: number,
  salinityGkg: number
): number {
  const t = (tempC + 273.15) / 100; // T / 100 (Kelvin)
  const lnC =
    A[0] +
    A[1] / t +
    A[2] * Math.log(t) +
    A[3] * t +
    salinityGkg * (B[0] + B[1] * t + B[2] * t * t);
  return Math.exp(lnC);
}

/**
 * Dynamic viscosity of dry air using Sutherland's law (Pa·s).
 * Valid for T = 0–500 °C.
 */
function airViscosity(tempK: number): number {
  // Sutherland: μ = C₁ · T^(3/2) / (T + S)
  // C₁ = 1.458e-6, S_suth = 110.4 K
  return (1.458e-6 * Math.pow(tempK, 1.5)) / (tempK + 110.4);
}

/**
 * Dynamic viscosity of low-pressure water vapour (Pa·s).
 * Linear fit to NIST data, valid for T = 0–300 °C.
 */
function steamViscosity(tempK: number): number {
  const tC = tempK - 273.15;
  return (0.407 * tC + 80.4) * 1e-7;
}

/**
 * Thermal conductivity of dry air (W / m·K).
 * Linear fit, valid for T = 0–200 °C.
 */
function airConductivity(tempC: number): number {
  return 0.02442 + 7.18e-5 * tempC;
}

/**
 * Thermal conductivity of low-pressure water vapour (W / m·K).
 * Linear fit to NIST data, valid for T = 0–300 °C.
 */
function steamConductivity(tempC: number): number {
  return 0.01601 + 9.7e-5 * tempC;
}

/**
 * Wilke's mixing rule for dynamic viscosity of a binary gas mixture.
 *
 * @param y1   mole fraction of component 1 (NCG)
 * @param y2   mole fraction of component 2 (water vapour)
 * @param mu1  viscosity of component 1 (Pa·s)
 * @param mu2  viscosity of component 2 (Pa·s)
 * @param M1   molar mass of component 1 (g/mol)
 * @param M2   molar mass of component 2 (g/mol)
 */
function wilkeViscosity(
  y1: number,
  y2: number,
  mu1: number,
  mu2: number,
  M1: number,
  M2: number
): number {
  if (y1 < 1e-9) return mu2;
  if (y2 < 1e-9) return mu1;

  const sq8 = Math.sqrt(8);
  const phi12 =
    Math.pow(1 + Math.sqrt(mu1 / mu2) * Math.pow(M2 / M1, 0.25), 2) /
    (sq8 * Math.sqrt(1 + M1 / M2));
  const phi21 =
    Math.pow(1 + Math.sqrt(mu2 / mu1) * Math.pow(M1 / M2, 0.25), 2) /
    (sq8 * Math.sqrt(1 + M2 / M1));

  return (y1 * mu1) / (y1 + y2 * phi12) + (y2 * mu2) / (y2 + y1 * phi21);
}

/**
 * Wassiljewa–Mason–Saxena mixing rule for thermal conductivity of a binary gas.
 * Uses the same Φ interaction parameters as Wilke's viscosity rule.
 */
function wassiljewaConductivity(
  y1: number,
  y2: number,
  lam1: number,
  lam2: number,
  mu1: number,
  mu2: number,
  M1: number,
  M2: number
): number {
  if (y1 < 1e-9) return lam2;
  if (y2 < 1e-9) return lam1;

  const sq8 = Math.sqrt(8);
  const phi12 =
    Math.pow(1 + Math.sqrt(mu1 / mu2) * Math.pow(M2 / M1, 0.25), 2) /
    (sq8 * Math.sqrt(1 + M1 / M2));
  const phi21 =
    Math.pow(1 + Math.sqrt(mu2 / mu1) * Math.pow(M1 / M2, 0.25), 2) /
    (sq8 * Math.sqrt(1 + M2 / M1));

  return (y1 * lam1) / (y1 + y2 * phi12) + (y2 * lam2) / (y2 + y1 * phi21);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Dissolved O₂ and N₂ content in seawater at air-saturation equilibrium.
 * Uses Weiss (1970) correlations. Valid for T = 0–36 °C, S = 0–40 g/kg.
 * Results are flagged when temperature is outside the valid range.
 */
export function dissolvedGasContent(tempC: number, salinityGkg: number = 35): NCGSeawaterInfo {
  // Weiss valid range; we still compute outside it but flag the result
  const extrapolated = tempC < 0 || tempC > 36;
  // Clamp to prevent extreme extrapolation (>80 °C gives negligible dissolved gas)
  const tCalc = Math.min(Math.max(tempC, 0), 80);

  const o2MlL = weissConcentration(WEISS_O2_A, WEISS_O2_B, tCalc, salinityGkg);
  const n2MlL = weissConcentration(WEISS_N2_A, WEISS_N2_B, tCalc, salinityGkg);

  const o2MgL = o2MlL * O2_MG_PER_ML_STP;
  const n2MgL = n2MlL * N2_MG_PER_ML_STP;

  return {
    gasTempC: tCalc,
    salinityGkg,
    o2MlL,
    n2MlL,
    o2MgL,
    n2MgL,
    totalGasMgL: o2MgL + n2MgL,
    extrapolated,
  };
}

/**
 * Calculate thermophysical properties of an NCG + water-vapour mixture.
 *
 * The mixture is modelled as an ideal gas. Water vapour partial pressure
 * equals the saturation pressure at the mixture temperature (Dalton's law).
 * NCG is treated as dry air (M = 28.97 g/mol).
 *
 * @throws When conditions are physically invalid (e.g. P < P_sat, T out of range).
 */
export function calculateNCGProperties(input: NCGInput): NCGResult {
  const { temperatureC, mode } = input;

  if (temperatureC < 0 || temperatureC > 350) {
    throw new Error('Temperature must be between 0 and 350 °C.');
  }

  const TK = temperatureC + 273.15;
  const satPressureBar = getSaturationPressure(temperatureC);

  // ── Resolve total pressure and mole fractions ────────────────────────────────
  // Two paths: split_flows derives pressure from the known flow rates;
  // all other modes derive composition from the specified pressure.
  let totalPressureBar: number;
  let yWater: number;
  let yNCG: number;
  let waterVapourPP: number;
  let ncgPP: number;

  if (mode === 'split_flows') {
    // Both mass flows are known — derive mole fractions then pressure via Dalton's law.
    const mNCG = input.dryNcgFlowKgH ?? 0;
    const mVapour = input.vapourFlowKgH;
    if (mVapour === undefined || mVapour <= 0) {
      throw new Error('Water vapour flow must be positive in NCG + Vapour split mode.');
    }
    if (mNCG < 0) {
      throw new Error('NCG flow rate cannot be negative.');
    }
    // Proportional molar flows (units cancel in the ratio)
    const nNCG = mNCG / M_AIR;
    const nH2O = mVapour / M_H2O;
    const nTotal = nNCG + nH2O;
    yWater = nH2O / nTotal;
    yNCG = nNCG / nTotal;
    // P_total = P_sat / y_H2O  (from Dalton's law: y_H2O = P_sat / P_total)
    totalPressureBar = satPressureBar / yWater;
    waterVapourPP = satPressureBar;
    ncgPP = totalPressureBar - satPressureBar;
  } else {
    // Pressure-specified modes: seawater, dry_ncg, wet_ncg
    const { pressureBar, useSatPressure } = input;
    if (pressureBar === undefined || useSatPressure === undefined) {
      throw new Error('pressureBar and useSatPressure are required for this input mode.');
    }
    if (pressureBar <= 0) {
      throw new Error('Pressure must be positive.');
    }
    totalPressureBar = useSatPressure
      ? satPressureBar + pressureBar // pressureBar is the NCG partial pressure
      : pressureBar;

    // Water vapour fills to its saturation pressure; NCG makes up the rest.
    waterVapourPP = Math.min(satPressureBar, totalPressureBar);
    ncgPP = Math.max(0, totalPressureBar - waterVapourPP);

    if (totalPressureBar < satPressureBar && !useSatPressure) {
      throw new Error(
        `Total pressure (${totalPressureBar.toFixed(4)} bar) is below the saturation ` +
          `pressure at ${temperatureC} °C (${satPressureBar.toFixed(4)} bar). ` +
          `Either raise the pressure or lower the temperature.`
      );
    }
    yWater = waterVapourPP / totalPressureBar;
    yNCG = ncgPP / totalPressureBar;
  }

  // ── Mixture molar mass ───────────────────────────────────────────────────────
  const mixMolarMass = yWater * M_H2O + yNCG * M_AIR; // g/mol

  // Mass fractions
  const xWater = (yWater * M_H2O) / mixMolarMass;
  const xNCG = (yNCG * M_AIR) / mixMolarMass;

  // ── Density (ideal gas law: ρ = PM / RT) ────────────────────────────────────
  // P in Pa, M in kg/mol, R in J/(mol·K)
  const density = (totalPressureBar * 1e5 * (mixMolarMass * 1e-3)) / (R_UNIV * TK); // kg/m³
  const specificVolume = 1 / density;

  // ── Enthalpy ─────────────────────────────────────────────────────────────────
  // Water vapour at saturation: h_g from IAPWS tables (ref: liquid water @ 0.01 °C)
  const vaporEnthalpy = getEnthalpyVapor(temperatureC); // kJ/kg
  // Air: sensible heat from 0 °C reference
  const airEnthalpy = CP_AIR * temperatureC; // kJ/kg
  // Mass-weighted mixture enthalpy
  const specificEnthalpy = xWater * vaporEnthalpy + xNCG * airEnthalpy;

  // ── Specific heats ───────────────────────────────────────────────────────────
  const cpMix = xWater * CP_VAPOR + xNCG * CP_AIR;
  // Cv = Cp - R/M for each component
  // Units: R_UNIV [J/(mol·K)] / M [g/mol] = J/(g·K) = kJ/(kg·K) (factors of 1000 cancel)
  const cvWater = CP_VAPOR - R_UNIV / M_H2O;
  const cvAir = CP_AIR - R_UNIV / M_AIR;
  const cvMix = xWater * cvWater + xNCG * cvAir;
  const gammaMix = cpMix / cvMix;

  // ── Transport properties ─────────────────────────────────────────────────────
  const muAir = airViscosity(TK);
  const muSteam = steamViscosity(TK);
  const dynamicViscosityPas = wilkeViscosity(yNCG, yWater, muAir, muSteam, M_AIR, M_H2O);

  const lamAir = airConductivity(temperatureC);
  const lamSteam = steamConductivity(temperatureC);
  const thermalConductivityWmK = wassiljewaConductivity(
    yNCG,
    yWater,
    lamAir,
    lamSteam,
    muAir,
    muSteam,
    M_AIR,
    M_H2O
  );

  // ── Flow rates ───────────────────────────────────────────────────────────────
  let dryNcgFlowKgH: number | null = null;
  let waterVapourFlowKgH: number | null = null;
  let totalFlowKgH: number | null = null;
  let volumetricFlowM3h: number | null = null;
  let seawaterInfo: NCGSeawaterInfo | undefined;

  if (mode === 'seawater' && input.seawaterFlowM3h) {
    const gasTempC = input.seawaterTempC ?? temperatureC;
    const salinity = input.salinityGkg ?? 35;
    seawaterInfo = dissolvedGasContent(gasTempC, salinity);

    // NCG dry mass = Q_SW [m³/h] × totalGasMgL [mg/L] × 1000 [L/m³] × 1e-6 [kg/mg]
    dryNcgFlowKgH = seawaterInfo.totalGasMgL * input.seawaterFlowM3h * 1e-3;

    // Add water vapour according to mixture composition at T, P
    if (yNCG > 1e-9) {
      waterVapourFlowKgH = dryNcgFlowKgH * (xWater / xNCG);
    } else {
      waterVapourFlowKgH = 0;
    }
    totalFlowKgH = dryNcgFlowKgH + waterVapourFlowKgH;
    volumetricFlowM3h = totalFlowKgH * specificVolume;
  } else if (mode === 'dry_ncg' && input.dryNcgFlowKgH) {
    dryNcgFlowKgH = input.dryNcgFlowKgH;
    waterVapourFlowKgH = yNCG > 1e-9 ? dryNcgFlowKgH * (xWater / xNCG) : 0;
    totalFlowKgH = dryNcgFlowKgH + waterVapourFlowKgH;
    volumetricFlowM3h = totalFlowKgH * specificVolume;
  } else if (mode === 'wet_ncg' && input.wetNcgFlowKgH) {
    totalFlowKgH = input.wetNcgFlowKgH;
    dryNcgFlowKgH = totalFlowKgH * xNCG;
    waterVapourFlowKgH = totalFlowKgH * xWater;
    volumetricFlowM3h = totalFlowKgH * specificVolume;
  } else if (mode === 'split_flows') {
    // Both flows are user-supplied — echo them directly and derive totals.
    dryNcgFlowKgH = input.dryNcgFlowKgH ?? 0;
    waterVapourFlowKgH = input.vapourFlowKgH!;
    totalFlowKgH = dryNcgFlowKgH + waterVapourFlowKgH;
    volumetricFlowM3h = totalFlowKgH * specificVolume;
  }

  return {
    temperatureC,
    totalPressureBar,
    satPressureBar,
    ncgPartialPressureBar: ncgPP,
    waterVapourPartialPressureBar: waterVapourPP,
    waterVapourMoleFrac: yWater,
    ncgMoleFrac: yNCG,
    waterVapourMassFrac: xWater,
    ncgMassFrac: xNCG,
    mixMolarMass,
    density,
    specificVolume,
    specificEnthalpy,
    vaporEnthalpy,
    airEnthalpy,
    cpMix,
    cvMix,
    gammaMix,
    dynamicViscosityPas,
    thermalConductivityWmK,
    dryNcgFlowKgH,
    waterVapourFlowKgH,
    totalFlowKgH,
    volumetricFlowM3h,
    seawaterInfo,
  };
}
