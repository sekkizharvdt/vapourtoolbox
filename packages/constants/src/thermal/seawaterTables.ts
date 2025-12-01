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
 */

// ============================================================================
// Constants
// ============================================================================

/** Reference salinity for standard seawater in ppm */
export const STANDARD_SEAWATER_SALINITY = 35000;

// ============================================================================
// Boiling Point Elevation (BPE)
// ============================================================================

/**
 * Calculate boiling point elevation for seawater
 *
 * The BPE is the increase in boiling temperature due to dissolved salts.
 * Uses the correlation from El-Dessouky and Ettouney (2002).
 *
 * @param salinity - Salinity in ppm
 * @param tempC - Temperature in °C
 * @returns Boiling point elevation in °C
 */
export function getBoilingPointElevation(salinity: number, tempC: number): number {
  // Validate inputs
  if (salinity < 0 || salinity > 120000) {
    throw new Error(`Salinity ${salinity} ppm is outside valid range (0-120000 ppm)`);
  }
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Convert salinity from ppm to weight fraction (X)
  const X = salinity / 1000000;

  // El-Dessouky & Ettouney correlation for BPE
  // BPE = A*X + B*X² + C*X³
  // where coefficients are functions of temperature

  const A = 8.325e-2 + 1.883e-4 * tempC + 4.02e-6 * tempC * tempC;
  const B = -7.625e-4 + 9.02e-5 * tempC - 5.2e-7 * tempC * tempC;
  const C = 1.522e-4 - 3.0e-6 * tempC - 3.0e-8 * tempC * tempC;

  // Convert X to percentage for correlation (X% = X * 100)
  const Xpct = X * 100;

  const BPE = A * Xpct + B * Xpct * Xpct + C * Xpct * Xpct * Xpct;

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
 * Calculate seawater specific heat capacity at constant pressure
 *
 * Uses correlation from Sharqawy et al. (2010)
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

  // Convert salinity from ppm to g/kg (S)
  const S = salinity / 1000;

  // Pure water specific heat (Sharqawy et al.)
  const Cp_w =
    4.2174 -
    3.720283e-3 * tempC +
    1.412855e-4 * tempC * tempC -
    2.654387e-6 * tempC * tempC * tempC +
    2.093236e-8 * tempC * tempC * tempC * tempC;

  // Seawater specific heat correction
  const A = -7.6444e-3 + 1.0727e-4 * tempC - 1.3839e-6 * tempC * tempC;

  const B = 1.7413e-4 - 4.1326e-6 * tempC + 8.3486e-8 * tempC * tempC;

  // Seawater specific heat
  const Cp_sw = Cp_w + A * S + B * S * S;

  return Cp_sw;
}

// ============================================================================
// Enthalpy
// ============================================================================

/**
 * Calculate seawater specific enthalpy
 *
 * Uses correlation from Sharqawy et al. (2010)
 * Reference state: h = 0 at T = 0°C and S = 0
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
  if (tempC < 0 || tempC > 180) {
    throw new Error(`Temperature ${tempC}°C is outside valid range (0-180°C)`);
  }

  // Convert salinity from ppm to g/kg (S)
  const S = salinity / 1000;

  // Pure water enthalpy (integration of Cp from 0°C)
  const h_w =
    4.2174 * tempC -
    (3.720283e-3 / 2) * tempC * tempC +
    (1.412855e-4 / 3) * tempC * tempC * tempC -
    (2.654387e-6 / 4) * tempC * tempC * tempC * tempC +
    (2.093236e-8 / 5) * tempC * tempC * tempC * tempC * tempC;

  // Seawater enthalpy correction
  const h_sw_correction =
    S *
    (-7.6444e-3 * tempC +
      (1.0727e-4 / 2) * tempC * tempC -
      (1.3839e-6 / 3) * tempC * tempC * tempC);

  const h_sw_correction2 =
    S *
    S *
    (1.7413e-4 * tempC - (4.1326e-6 / 2) * tempC * tempC + (8.3486e-8 / 3) * tempC * tempC * tempC);

  return h_w + h_sw_correction + h_sw_correction2;
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
 */
export const SEAWATER_35000_PPM_TABLE = [
  { tempC: 20, density: 1024.8, cp: 3.998, viscosity: 1.072e-3 },
  { tempC: 30, density: 1022.4, cp: 4.0, viscosity: 8.42e-4 },
  { tempC: 40, density: 1019.5, cp: 4.003, viscosity: 6.73e-4 },
  { tempC: 50, density: 1016.0, cp: 4.007, viscosity: 5.49e-4 },
  { tempC: 60, density: 1012.1, cp: 4.013, viscosity: 4.56e-4 },
  { tempC: 70, density: 1007.7, cp: 4.02, viscosity: 3.85e-4 },
  { tempC: 80, density: 1002.9, cp: 4.029, viscosity: 3.3e-4 },
  { tempC: 90, density: 997.6, cp: 4.04, viscosity: 2.86e-4 },
  { tempC: 100, density: 991.9, cp: 4.053, viscosity: 2.51e-4 },
] as const;

/**
 * Boiling point elevation at different salinities (at 100°C)
 */
export const BPE_REFERENCE_TABLE = [
  { salinity: 10000, bpe: 0.17 },
  { salinity: 20000, bpe: 0.35 },
  { salinity: 35000, bpe: 0.61 },
  { salinity: 50000, bpe: 0.88 },
  { salinity: 70000, bpe: 1.26 },
  { salinity: 100000, bpe: 1.85 },
] as const;
