/**
 * MIT Seawater Property Correlations
 *
 * Implementation of seawater thermophysical property correlations
 * based on MIT research and industry-standard correlations.
 *
 * Valid ranges:
 * - Temperature: 0-180°C
 * - Salinity: 0-120,000 ppm (0-12% by weight)
 *
 * References:
 * - Sharqawy, M.H., Lienhard V, J.H., and Zubair, S.M., "Thermophysical
 *   properties of seawater: A review of existing correlations and data,"
 *   Desalination and Water Treatment, Vol. 16, pp. 354-380, 2010.
 * - El-Dessouky, H.T. and Ettouney, H.M., "Fundamentals of Salt Water
 *   Desalination," Elsevier, 2002.
 *
 * ── Pure-water baseline ────────────────────────────────────────────────────
 * The pure-water terms come from IAPWS-IF97 Region 1 evaluated at saturation,
 * NOT from the Sharqawy pure-water polynomials. Those polynomials track IF97
 * well below ~50 °C but diverge above it (+1.2% on cp at 70 °C, +3.0% at 80 °C,
 * +6.2% at 90 °C), which put the enthalpy baseline 0.29 kJ/kg high at 70 °C and
 * 1.19 high at 80 °C — with the error changing sign near 58 °C, so it did not
 * cancel in the enthalpy differences that set flash and effect vapour rates.
 *
 * Using IF97 for the pure-water part keeps S = 0 exact and preserves the
 * thermodynamic invariant dh/dT = cp, because IF97's own h and cp are mutually
 * consistent and the salinity corrections below are an exact integral pair.
 */

import { getSaturationPressure, TRIPLE_POINT_TEMPERATURE_C } from './steamTables';
import { getEnthalpySubcooled, getSpecificHeatSubcooled } from './steamTablesRegion1';

// ============================================================================
// Constants
// ============================================================================

/** Reference salinity for standard seawater in ppm */
export const STANDARD_SEAWATER_SALINITY = 35000;

/**
 * Temperature clamped to the IF97 domain, for the pure-water lookups below.
 *
 * These functions declare a 0-180 C range, but IF97 Region 1 is only defined
 * from the triple point (0.01 C) upward and re-validates the temperature
 * internally, so both the pressure and the temperature passed to it must be
 * clamped. The MED engine legitimately calls the property functions with
 * tempC = 0 for effects that receive no fresh seawater spray, where the result
 * is multiplied by a zero flow. Clamping keeps the declared range honest;
 * h_f at the triple point is 0.0006 kJ/kg, so the substitution is physically
 * negligible.
 */
function clampToIF97Domain(tempC: number): number {
  return Math.max(tempC, TRIPLE_POINT_TEMPERATURE_C);
}

// ============================================================================
// Boiling Point Elevation (BPE)
// ============================================================================

/**
 * Calculate boiling point elevation for seawater
 *
 * The BPE is the increase in boiling temperature due to dissolved salts.
 * Uses the correlation from Sharqawy et al. (2010), Eq. 36, which best fits
 * the experimental data of Bromley et al. (1974).
 *
 * Reference: Sharqawy M.H., Lienhard V J.H., Zubair S.M., "Thermophysical
 * properties of seawater: A review of existing correlations and data,"
 * Desalination and Water Treatment, Vol. 16, pp. 354-380, 2010.
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Boiling point elevation in K (°C)
 */
export function getBoilingPointElevation(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 120000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-120000 ppm)`);
  }
  if (tempC < 0 || tempC > 200) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-200°C)`);
  }

  // Convert salinity from ppm to mass fraction (s)
  // s = g/kg / 1000 = ppm / 1,000,000
  const s = salinity / 1000000;

  // Sharqawy et al. (2010) Eq. 36: BPE = A·s² + B·s
  // where coefficients are functions of temperature
  const A = 17.95 + 0.2823 * tempC - 4.584e-4 * tempC * tempC;
  const B = 6.56 + 0.05267 * tempC + 1.536e-4 * tempC * tempC;

  const BPE = A * s * s + B * s;

  return BPE;
}

// ============================================================================
// Density
// ============================================================================

/**
 * Calculate seawater density
 *
 * Uses correlation from Sharqawy et al. (2010)
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getSeawaterDensity(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 160000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-160000 ppm)`);
  }
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Convert salinity from ppm to g/kg (S)
  const S = salinity / 1000;

  // Pure water density correlation (Sharqawy et al.)
  const rho_w =
    999.842594 +
    6.793952e-2 * tempC -
    9.09529e-3 * tempC * tempC +
    1.001685e-4 * tempC * tempC * tempC -
    1.120083e-6 * tempC * tempC * tempC * tempC +
    6.536332e-9 * tempC * tempC * tempC * tempC * tempC;

  // Seawater density correction coefficients
  const A =
    8.02e-1 -
    2.001e-3 * tempC +
    1.677e-5 * tempC * tempC -
    3.06e-8 * tempC * tempC * tempC -
    1.613e-11 * tempC * tempC * tempC * tempC;

  const B = -5.3e-4 + 1.8e-5 * tempC - 2.1e-7 * tempC * tempC + 8.0e-10 * tempC * tempC * tempC;

  // Seawater density
  const rho_sw = rho_w + A * S + B * S * S;

  return rho_sw;
}

// ============================================================================
// Specific Heat Capacity
// ============================================================================

/**
 * Calculate seawater specific heat capacity at constant pressure.
 *
 * Salinity dependence from **Sharqawy et al. (2010) Eq. (9)**, which reproduces
 * Jamieson et al. (1969) — the accepted seawater cp correlation, and the one the
 * MIT seawater library itself uses. Validity 0-180 C, 0-180 g/kg, +/-1.5%.
 *
 * The pure-water baseline stays IAPWS-IF97 Region 1 (see header). Eq. (9) is a
 * single fit in S and T whose S = 0 limit is Jamieson's pure water, not IAPWS —
 * 4.1894 against 4.1841 at 20 C, 0.13% out. Taking only its salinity DIFFERENCE
 * keeps the authoritative pure-water standard exact at S = 0 while using the
 * accepted correlation for the salt term.
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Specific heat capacity in kJ/(kg·K)
 */
export function getSeawaterSpecificHeat(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 120000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-120000 ppm)`);
  }
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Pure water specific heat — IAPWS-IF97 Region 1 at saturation (see header)
  const tLookup = clampToIF97Domain(tempC);
  const Cp_w = getSpecificHeatSubcooled(getSaturationPressure(tLookup), tLookup);

  return Cp_w + jamiesonSalinityCp(salinity / 1000, tempC);
}

/**
 * Salinity contribution to cp, in kJ/(kg·K), from Sharqawy Eq. (9).
 *
 * Evaluated as `cp(S) - cp(0)` so the caller's pure-water baseline is preserved.
 * Temperature enters in K, per the published form.
 */
function jamiesonSalinityCp(S_gkg: number, tempC: number): number {
  const evaluate = (S: number): number => {
    const T = tempC + 273.15;
    const A = 5.328 - 9.76e-2 * S + 4.04e-4 * S * S;
    const B = -6.913e-3 + 7.351e-4 * S - 3.15e-6 * S * S;
    const C = 9.6e-6 - 1.927e-6 * S + 8.23e-9 * S * S;
    const D = 2.5e-9 + 1.666e-9 * S - 7.125e-12 * S * S;
    return A + B * T + C * T * T + D * T * T * T;
  };
  return evaluate(S_gkg) - evaluate(0);
}

// ============================================================================
// Enthalpy
// ============================================================================

/**
 * Calculate seawater specific enthalpy.
 *
 * Salinity dependence from **Sharqawy et al. (2010) Eq. (43)** — the published
 * seawater enthalpy correlation, fitted to Bromley et al. (1970) data. Validity
 * 10-120 C, 0-120 g/kg, +/-1.5%.
 *
 * Reference state: h = 0 at T = 0 C and S = 0. Pure-water baseline is
 * IAPWS-IF97 Region 1 (see header); Eq. (43) is written as `h_w + correction`,
 * so substituting the authoritative h_w is the correlation's own structure, and
 * the salinity term is exactly zero at S = 0 by construction.
 *
 * **This is not an exact integral pair with `getSeawaterSpecificHeat`.** Eq. (43)
 * and Eq. (9) are independent fits to different datasets (Bromley and Jamieson),
 * and they disagree by up to ~2.2% on `dh/dT` versus `cp` at 90 C and 120 g/kg.
 * That is a documented property of the published correlations, not a defect
 * here, and using both is what the MIT library and the wider literature do.
 * It is acceptable because this codebase uses cp only for sensible duties and h
 * only for stream enthalpies, never differentiating one to obtain the other. A
 * DYNAMIC energy balance would need the derivative of Eq. (43) instead, and
 * would then have a cp that is not Jamieson's — the opposite trade.
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Specific enthalpy in kJ/kg
 */
export function getSeawaterEnthalpy(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 120000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-120000 ppm)`);
  }
  // Eq. (43)'s own envelope is 10-120 C — narrower than the 0-180 C of the cp
  // correlation. Extrapolating silently is what the superseded home-grown
  // integral did; refuse instead (rule 3).
  if (tempC < 10 || tempC > 120) {
    throw new Error(
      `Temperature ${tempC}°C is outside the Sharqawy Eq. (43) validity range (10-120°C)`
    );
  }

  // Pure water enthalpy — IAPWS-IF97 Region 1 at saturation (see header)
  const h_w = getEnthalpySubcooled(getSaturationPressure(tempC), tempC);

  return h_w + sharqawySalinityEnthalpy(salinity / 1000, tempC);
}

/**
 * Salinity contribution to enthalpy, in kJ/kg, from Sharqawy Eq. (43).
 *
 * Published form gives J/kg with S as a mass FRACTION (kg/kg), hence the /1000
 * on the way in and the /1000 on the way out.
 */
function sharqawySalinityEnthalpy(S_gkg: number, tempC: number): number {
  const S = S_gkg / 1000; // g/kg → mass fraction
  const t = tempC;
  const b = [
    -2.348e4, 3.152e5, 2.803e6, -1.446e7, 7.826e3, -4.417e1, 2.139e-1, -1.991e4, 2.778e4, 9.728e1,
  ] as const;

  const seriesJPerKg =
    b[0] +
    b[1] * S +
    b[2] * S * S +
    b[3] * S * S * S +
    b[4] * t +
    b[5] * t * t +
    b[6] * t * t * t +
    b[7] * S * t +
    b[8] * S * S * t +
    b[9] * S * t * t;

  return (-S * seriesJPerKg) / 1000; // J/kg → kJ/kg
}

// ============================================================================
// Thermal Conductivity
// ============================================================================

/**
 * Calculate seawater thermal conductivity
 *
 * Uses correlation from Sharqawy et al. (2010)
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Thermal conductivity in W/(m·K)
 */
export function getSeawaterThermalConductivity(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 160000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-160000 ppm)`);
  }
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Convert salinity from ppm to g/kg (S)
  const S = salinity / 1000;

  // Log10 of thermal conductivity ratio
  const logRatio =
    Math.log10(240 + 0.0002 * S) +
    0.434 *
      (2.3 - (343.5 + 0.037 * S) / (tempC + 273.15)) *
      Math.pow(1 - (tempC + 273.15) / (647.26 + 0.03 * S), 0.333);

  return Math.pow(10, logRatio) / 1000; // Convert mW/(m·K) to W/(m·K)
}

// ============================================================================
// Dynamic Viscosity
// ============================================================================

/**
 * Calculate seawater dynamic viscosity
 *
 * Uses correlation from Sharqawy et al. (2010)
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Dynamic viscosity in Pa·s (kg/(m·s))
 */
export function getSeawaterViscosity(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 150000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-150000 ppm)`);
  }
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Convert salinity from ppm to g/kg (S)
  const S = salinity / 1000;

  // Pure water viscosity (Sharqawy et al.)
  const mu_w = 4.2844e-5 + 1 / (0.157 * Math.pow(tempC + 64.993, 2) - 91.296);

  // Seawater viscosity ratio
  const A = 1.541 + 1.998e-2 * tempC - 9.52e-5 * tempC * tempC;
  const B = 7.974 - 7.561e-2 * tempC + 4.724e-4 * tempC * tempC;

  const mu_sw_ratio = 1 + A * (S / 1000) + B * Math.pow(S / 1000, 2);

  return mu_w * mu_sw_ratio;
}

// ============================================================================
// Concentration Calculations
// ============================================================================

/**
 * Calculate brine salinity after flash evaporation
 *
 * @param inletSalinity - Inlet seawater salinity in ppm
 * @param inletFlow - Inlet mass flow rate
 * @param vaporFlow - Vapor mass flow rate
 * @returns Brine salinity in ppm
 */
export function getBrineSalinity(
  inletSalinity: number,
  inletFlow: number,
  vaporFlow: number
): number {
  // Mass balance: inlet salt = outlet salt (vapor has no salt)
  // S_in * M_in = S_out * (M_in - M_vapor)
  // S_out = S_in * M_in / (M_in - M_vapor)

  const brineFlow = inletFlow - vaporFlow;
  if (brineFlow <= 0) {
    throw new Error('Vapor flow cannot exceed inlet flow');
  }

  return (inletSalinity * inletFlow) / brineFlow;
}

/**
 * Calculate concentration factor
 *
 * @param inletSalinity - Inlet seawater salinity in ppm
 * @param brineSalinity - Brine salinity in ppm
 * @returns Concentration factor (dimensionless)
 */
export function getConcentrationFactor(inletSalinity: number, brineSalinity: number): number {
  return brineSalinity / inletSalinity;
}

// ============================================================================
// Reference Tables
// ============================================================================

/**
 * Seawater properties at standard salinity (35,000 ppm) for reference
 * Values from Sharqawy et al. (2010) correlations
 */
export const SEAWATER_35000_PPM_TABLE = [
  { tempC: 20, density: 1024.8, cp: 3.998, viscosity: 1.08e-3 },
  { tempC: 30, density: 1022.4, cp: 4.0, viscosity: 8.61e-4 },
  { tempC: 40, density: 1019.5, cp: 4.003, viscosity: 7.07e-4 },
  { tempC: 50, density: 1016.0, cp: 4.007, viscosity: 5.94e-4 },
  { tempC: 60, density: 1012.1, cp: 4.013, viscosity: 5.08e-4 },
  { tempC: 70, density: 1007.7, cp: 4.02, viscosity: 4.41e-4 },
  { tempC: 80, density: 1002.9, cp: 4.029, viscosity: 3.88e-4 },
  { tempC: 90, density: 997.6, cp: 4.04, viscosity: 3.45e-4 },
  { tempC: 100, density: 991.9, cp: 4.053, viscosity: 3.09e-4 },
] as const;

/**
 * Boiling point elevation at different salinities (at 100°C)
 * Values from Sharqawy et al. (2010), accuracy ±0.018 K
 */
export const BPE_REFERENCE_TABLE = [
  { salinity: 10000, bpe: 0.14 },
  { salinity: 20000, bpe: 0.28 },
  { salinity: 35000, bpe: 0.52 },
  { salinity: 50000, bpe: 0.77 },
  { salinity: 70000, bpe: 1.14 },
  { salinity: 100000, bpe: 1.75 },
  { salinity: 120000, bpe: 2.2 },
] as const;
