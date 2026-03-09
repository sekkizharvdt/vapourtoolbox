/**
 * Falling Film Evaporator Calculator
 *
 * Designs horizontal-tube falling film evaporators used in MED desalination plants.
 * Seawater is sprayed onto the outside of horizontal tube bundles while steam
 * condenses inside the tubes, transferring heat through the tube wall to the
 * falling film of seawater on the outside.
 *
 * References:
 * - Chun, K.R. and Seban, R.A., "Heat Transfer to Evaporating Liquid Films,"
 *   Journal of Heat Transfer, Vol. 93, pp. 391-396, 1971.
 * - El-Dessouky, H.T. and Ettouney, H.M., "Fundamentals of Salt Water
 *   Desalination," Elsevier, 2002.
 * - Nusselt, W., "Die Oberflachenkondensation des Wasserdampfes," VDI-Zeitschrift,
 *   Vol. 60, pp. 541-546, 1916.
 * - Sharqawy, M.H., Lienhard V, J.H., and Zubair, S.M., "Thermophysical
 *   properties of seawater," Desalination and Water Treatment, Vol. 16, 2010.
 */

import {
  getSeawaterDensity,
  getSeawaterViscosity,
  getSeawaterSpecificHeat,
  getSeawaterThermalConductivity,
  getBoilingPointElevation,
  getLatentHeat,
  getDensityLiquid,
  getDensityVapor,
} from '@vapour/constants';

// ============================================================================
// Constants
// ============================================================================

/** Gravitational acceleration in m/s² */
const g = 9.81;

/** Default fouling resistance for clean seawater in m²·K/W */
const DEFAULT_FOULING_RESISTANCE = 0.00009;

/** Default design margin (15%) */
const DEFAULT_DESIGN_MARGIN = 0.15;

// ============================================================================
// Exported Constants
// ============================================================================

/**
 * Tube material thermal conductivities in W/(m·K)
 */
export const TUBE_MATERIALS: Record<string, { label: string; conductivity: number }> = {
  cu_ni_90_10: { label: 'Cu-Ni 90/10', conductivity: 45 },
  cu_ni_70_30: { label: 'Cu-Ni 70/30', conductivity: 29 },
  titanium: { label: 'Titanium Gr.2', conductivity: 22 },
  al_brass: { label: 'Aluminium Brass', conductivity: 100 },
  ss_316l: { label: 'SS 316L', conductivity: 16 },
  duplex_2205: { label: 'Duplex 2205', conductivity: 19 },
};

/**
 * Standard tube sizes with BWG gauge
 */
export const STANDARD_TUBE_SIZES: {
  od: number;
  id: number;
  bwg: number;
  label: string;
}[] = [
  { od: 19.05, id: 15.75, bwg: 18, label: '3/4" OD x 18 BWG' },
  { od: 25.4, id: 22.1, bwg: 18, label: '1" OD x 18 BWG' },
  { od: 25.4, id: 20.93, bwg: 16, label: '1" OD x 16 BWG' },
  { od: 31.75, id: 28.45, bwg: 18, label: '1-1/4" OD x 18 BWG' },
];

/**
 * Wetting ratio thresholds for falling film quality assessment
 */
export const WETTING_LIMITS = {
  EXCELLENT: 3.0, // Gamma/Gamma_min > 3
  GOOD: 2.0, // 2 < ratio <= 3
  MARGINAL: 1.5, // 1.5 < ratio <= 2
  // Below 1.5: poor (dry spots likely)
};

// ============================================================================
// Types
// ============================================================================

export interface FallingFilmInput {
  // Operating conditions
  feedFlowRate: number; // kg/s — total feed to the evaporator
  feedSalinity: number; // ppm — feed seawater salinity
  feedTemperature: number; // °C — feed temperature entering the evaporator
  steamTemperature: number; // °C — condensing steam temperature inside tubes

  // Tube geometry
  tubeOD: number; // mm — tube outer diameter (typically 25.4 for 1")
  tubeID: number; // mm — tube inner diameter
  tubeLength: number; // m — effective tube length
  numberOfTubes: number; // total tubes in the bundle
  tubeMaterial: string; // material key for thermal conductivity lookup

  // Tube layout
  tubeLayout: 'triangular' | 'square'; // tube pitch arrangement
  pitchRatio: number; // pitch/OD ratio (typically 1.25-1.5)
  tubeRows: number; // number of horizontal tube rows

  // Optional
  foulingResistance?: number; // m²·K/W — total fouling (default 0.00009)
  designMargin?: number; // fraction 0-1 (default 0.15 = 15%)
}

export interface FallingFilmResult {
  // Wetting analysis
  wettingRate: number; // kg/(m·s) — actual Gamma
  minimumWettingRate: number; // kg/(m·s) — Gamma_min
  wettingRatio: number; // Gamma/Gamma_min (should be > 1.5)
  wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';

  // Film characteristics
  filmReynolds: number;
  flowRegime: string; // 'Droplet' | 'Laminar Sheet' | 'Wavy-Laminar' | 'Turbulent'

  // Heat transfer
  filmHTC: number; // W/(m²·K) — outside film coefficient
  condensationHTC: number; // W/(m²·K) — inside condensation coefficient
  wallResistance: number; // m²·K/W
  foulingResistance: number; // m²·K/W
  overallHTC: number; // W/(m²·K) — overall U based on OD

  // Thermal performance
  effectiveTemperatureDiff: number; // °C (steam temp - boiling temp with BPE)
  boilingPointElevation: number; // °C
  heatTransferArea: number; // m² — total installed area
  heatDuty: number; // kW
  evaporationRate: number; // kg/s
  specificEvaporationRate: number; // kg/(m²·h) — evaporation per unit area

  // Tube bundle
  tubesPerRow: number;
  bundleWidth: number; // mm
  bundleHeight: number; // mm
  rowSpacing: number; // mm
  pitch: number; // mm

  // Design check
  designArea: number; // m² (with margin)
  excessArea: number; // % excess over required

  // Warnings
  warnings: string[];
}

// ============================================================================
// Pure Water Property Correlations (for condensate film inside tubes)
// ============================================================================

/**
 * Pure water dynamic viscosity using the Vogel-Fulcher-Tammann form.
 * mu(T) = 2.414e-5 * 10^(247.8 / (T + 133.15)) Pa·s
 *
 * @param tempC - Temperature in °C
 * @returns Dynamic viscosity in Pa·s
 */
function getPureWaterViscosity(tempC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tempC + 133.15));
}

/**
 * Pure water thermal conductivity (polynomial fit).
 * k(T) = 0.569 + 0.0019*T - 8e-6*T² W/(m·K)
 *
 * @param tempC - Temperature in °C
 * @returns Thermal conductivity in W/(m·K)
 */
function getPureWaterConductivity(tempC: number): number {
  return 0.569 + 0.0019 * tempC - 8e-6 * tempC * tempC;
}

/**
 * Surface tension of seawater (simplified Sharqawy correlation).
 * sigma = 0.0756 - 0.000145 * T  (N/m)
 *
 * @param tempC - Temperature in °C
 * @returns Surface tension in N/m
 */
function getSeawaterSurfaceTension(tempC: number): number {
  return 0.0756 - 0.000145 * tempC;
}

// ============================================================================
// Input Validation
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate falling film evaporator inputs.
 *
 * @param input - Falling film input parameters
 * @returns Validation result with errors and warnings
 */
export function validateFallingFilmInput(input: FallingFilmInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Tube geometry
  if (input.tubeOD <= 0) {
    errors.push('Tube OD must be greater than 0');
  }
  if (input.tubeID <= 0) {
    errors.push('Tube ID must be greater than 0');
  }
  if (input.tubeOD <= input.tubeID) {
    errors.push('Tube OD must be greater than tube ID');
  }

  // Tube counts
  if (input.numberOfTubes <= 0) {
    errors.push('Number of tubes must be greater than 0');
  }
  if (input.tubeRows <= 0) {
    errors.push('Number of tube rows must be greater than 0');
  }
  if (input.numberOfTubes > 0 && input.tubeRows > 0) {
    if (input.numberOfTubes % input.tubeRows !== 0) {
      warnings.push(
        `Number of tubes (${input.numberOfTubes}) does not divide evenly by tube rows (${input.tubeRows}). ` +
          `Using ${Math.floor(input.numberOfTubes / input.tubeRows)} tubes per row.`
      );
    }
  }

  // Operating conditions
  if (input.feedFlowRate <= 0) {
    errors.push('Feed flow rate must be greater than 0');
  }
  if (input.steamTemperature <= input.feedTemperature) {
    errors.push(
      `Steam temperature (${input.steamTemperature}\u00B0C) must be greater than feed temperature (${input.feedTemperature}\u00B0C)`
    );
  }

  // Tube length
  if (input.tubeLength <= 0) {
    errors.push('Tube length must be greater than 0');
  }

  // Pitch ratio
  if (input.pitchRatio < 1.25) {
    errors.push('Pitch ratio must be at least 1.25');
  }

  // Feed salinity
  if (input.feedSalinity < 0) {
    errors.push('Feed salinity cannot be negative');
  }
  if (input.feedSalinity > 120000) {
    errors.push('Feed salinity exceeds maximum valid range (120,000 ppm)');
  }

  // Tube material
  if (!TUBE_MATERIALS[input.tubeMaterial]) {
    errors.push(
      `Unknown tube material "${input.tubeMaterial}". Valid options: ${Object.keys(TUBE_MATERIALS).join(', ')}`
    );
  }

  // Optional parameter ranges
  if (input.foulingResistance !== undefined && input.foulingResistance < 0) {
    errors.push('Fouling resistance cannot be negative');
  }
  if (input.designMargin !== undefined && (input.designMargin < 0 || input.designMargin > 1)) {
    errors.push('Design margin must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate falling film evaporator design for horizontal-tube MED evaporators.
 *
 * @param input - Falling film evaporator input parameters
 * @returns Complete calculation result with heat transfer, wetting analysis, and bundle layout
 */
export function calculateFallingFilm(input: FallingFilmInput): FallingFilmResult {
  const warnings: string[] = [];

  // Validate inputs
  const validation = validateFallingFilmInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join('; ')}`);
  }
  warnings.push(...validation.warnings);

  // Resolve optional parameters
  const foulingResistance = input.foulingResistance ?? DEFAULT_FOULING_RESISTANCE;
  const designMargin = input.designMargin ?? DEFAULT_DESIGN_MARGIN;

  // Convert tube dimensions to metres
  const D_o = input.tubeOD / 1000; // m
  const D_i = input.tubeID / 1000; // m

  // Tube material conductivity (validated above, so non-null)
  const material = TUBE_MATERIALS[input.tubeMaterial];
  const k_wall = material!.conductivity; // W/(m·K)

  // Tubes per row
  const tubesPerRow = Math.floor(input.numberOfTubes / input.tubeRows);

  // ========================================================================
  // 1. Seawater properties at feed temperature
  // ========================================================================

  const rho_l = getSeawaterDensity(input.feedSalinity, input.feedTemperature); // kg/m³
  const mu_l = getSeawaterViscosity(input.feedSalinity, input.feedTemperature); // Pa·s
  const cp_l = getSeawaterSpecificHeat(input.feedSalinity, input.feedTemperature); // kJ/(kg·K)
  const k_l = getSeawaterThermalConductivity(input.feedSalinity, input.feedTemperature); // W/(m·K)
  const sigma = getSeawaterSurfaceTension(input.feedTemperature); // N/m

  // Prandtl number for seawater
  // Pr = mu * Cp / k  (Cp in J/(kg·K), so multiply kJ by 1000)
  const Pr_l = (mu_l * cp_l * 1000) / k_l;

  // ========================================================================
  // 2. Wetting Rate (Gamma)
  // ========================================================================

  // Gamma = feedFlowRate / (tubes_per_row * tubeLength * 2)
  // The factor 2 accounts for liquid flowing on both sides of each tube
  const wettingRate = input.feedFlowRate / (tubesPerRow * input.tubeLength * 2); // kg/(m·s)

  // ========================================================================
  // 3. Minimum Wetting Rate (Gamma_min)
  // ========================================================================

  // El-Dessouky & Ettouney (2002) correlation for horizontal tubes:
  // Gamma_min = 0.11 * (mu_l² / (rho_l * sigma))^(1/3)
  const gammaMin = 0.11 * Math.pow((mu_l * mu_l) / (rho_l * sigma), 1 / 3); // kg/(m·s)

  // Wetting ratio
  const wettingRatio = wettingRate / gammaMin;

  // Wetting status
  let wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';
  if (wettingRatio > WETTING_LIMITS.EXCELLENT) {
    wettingStatus = 'excellent';
  } else if (wettingRatio > WETTING_LIMITS.GOOD) {
    wettingStatus = 'good';
  } else if (wettingRatio > WETTING_LIMITS.MARGINAL) {
    wettingStatus = 'marginal';
  } else {
    wettingStatus = 'poor';
  }

  // Wetting warnings
  if (wettingRatio < 1.5) {
    warnings.push(
      `Wetting ratio (${wettingRatio.toFixed(2)}) is below 1.5 — dry spots are likely. Increase feed flow or reduce tubes per row.`
    );
  }
  if (wettingRatio > 6) {
    warnings.push(
      `Wetting ratio (${wettingRatio.toFixed(2)}) exceeds 6 — excessive flooding may occur. Consider adding more tubes per row.`
    );
  }

  // ========================================================================
  // 4. Film Reynolds Number
  // ========================================================================

  const filmReynolds = (4 * wettingRate) / mu_l;

  // Flow regime classification
  let flowRegime: string;
  if (filmReynolds < 30) {
    flowRegime = 'Droplet';
    warnings.push(
      `Film Reynolds number (${filmReynolds.toFixed(1)}) is in the droplet regime (Re < 30) — poor film coverage.`
    );
  } else if (filmReynolds < 400) {
    flowRegime = 'Laminar Sheet';
  } else if (filmReynolds < 1600) {
    flowRegime = 'Wavy-Laminar';
  } else {
    flowRegime = 'Turbulent';
  }

  // ========================================================================
  // 5. Film Heat Transfer Coefficient (outside tubes) — Chun-Seban (1971)
  // ========================================================================

  // Common grouping: (k_l³ * rho_l² * g / mu_l²)^(1/3)
  const filmGroup = Math.pow((k_l * k_l * k_l * rho_l * rho_l * g) / (mu_l * mu_l), 1 / 3);

  let filmHTC: number; // W/(m²·K)
  if (filmReynolds < 400) {
    // Laminar film
    filmHTC = 0.821 * filmGroup * Math.pow(filmReynolds, -1 / 3);
  } else if (filmReynolds < 1600) {
    // Wavy-laminar
    filmHTC = 0.0038 * filmGroup * Math.pow(filmReynolds, 0.4) * Math.pow(Pr_l, 0.65);
  } else {
    // Turbulent
    filmHTC = 0.0065 * filmGroup * Math.pow(filmReynolds, 0.4) * Math.pow(Pr_l, 0.65);
  }

  // ========================================================================
  // 6. Condensation HTC (inside tubes) — Nusselt horizontal tube
  // ========================================================================

  // Condensate properties at steam temperature (pure water)
  const rho_l_steam = getDensityLiquid(input.steamTemperature); // kg/m³
  const rho_v_steam = getDensityVapor(input.steamTemperature); // kg/m³
  const mu_l_steam = getPureWaterViscosity(input.steamTemperature); // Pa·s
  const k_l_steam = getPureWaterConductivity(input.steamTemperature); // W/(m·K)
  const hfg = getLatentHeat(input.steamTemperature) * 1000; // Convert kJ/kg to J/kg

  // Temperature difference for Nusselt condensation
  // Use steamTemp - feedTemp as the driving ΔT across the condensate film
  const deltaT_cond = input.steamTemperature - input.feedTemperature;

  // Nusselt horizontal tube condensation:
  // h_cond = 0.725 * [rho_l * (rho_l - rho_v) * g * hfg * k_l³ / (mu_l * D_i * ΔT)]^0.25
  const condensationHTC =
    0.725 *
    Math.pow(
      (rho_l_steam * (rho_l_steam - rho_v_steam) * g * hfg * Math.pow(k_l_steam, 3)) /
        (mu_l_steam * D_i * deltaT_cond),
      0.25
    );

  // ========================================================================
  // 7. Overall Heat Transfer Coefficient
  // ========================================================================

  // Wall resistance: (D_o * ln(D_o/D_i)) / (2 * k_wall)
  const wallResistance = (D_o * Math.log(D_o / D_i)) / (2 * k_wall); // m²·K/W

  // Overall HTC based on OD:
  // 1/U_o = 1/h_film + R_wall + (D_o/D_i)*(1/h_cond) + R_fouling
  const invU =
    1 / filmHTC + wallResistance + (D_o / D_i) * (1 / condensationHTC) + foulingResistance;
  const overallHTC = 1 / invU; // W/(m²·K)

  // ========================================================================
  // 8. Heat Transfer Area & Evaporation
  // ========================================================================

  // Boiling point elevation
  const bpe = getBoilingPointElevation(input.feedSalinity, input.feedTemperature);

  // Effective temperature difference
  const T_boiling = input.feedTemperature + bpe;
  const effectiveTempDiff = input.steamTemperature - T_boiling;

  // Warnings for temperature difference
  if (effectiveTempDiff < 1) {
    warnings.push(
      `Effective temperature difference (${effectiveTempDiff.toFixed(2)}\u00B0C) is less than 1\u00B0C — insufficient driving force for heat transfer.`
    );
  }
  if (effectiveTempDiff > 10) {
    warnings.push(
      `Effective temperature difference (${effectiveTempDiff.toFixed(2)}\u00B0C) exceeds 10\u00B0C — unusual for MED operation. Verify steam and feed temperatures.`
    );
  }

  // Total heat transfer area (installed)
  const heatTransferArea = Math.PI * D_o * input.tubeLength * input.numberOfTubes; // m²

  // Heat duty
  const heatDuty = overallHTC * heatTransferArea * effectiveTempDiff; // W
  const heatDutyKW = heatDuty / 1000; // kW

  // Evaporation rate
  const latentHeatFeed = getLatentHeat(input.feedTemperature) * 1000; // J/kg
  const evaporationRate = heatDuty / latentHeatFeed; // kg/s

  // Specific evaporation rate: kg/(m²·h)
  const specificEvaporationRate = (evaporationRate / heatTransferArea) * 3600; // kg/(m²·h)

  // Warning for specific evaporation rate
  if (specificEvaporationRate < 5) {
    warnings.push(
      `Specific evaporation rate (${specificEvaporationRate.toFixed(2)} kg/(m\u00B2\u00B7h)) is below typical MED range (5-20 kg/(m\u00B2\u00B7h)).`
    );
  }
  if (specificEvaporationRate > 20) {
    warnings.push(
      `Specific evaporation rate (${specificEvaporationRate.toFixed(2)} kg/(m\u00B2\u00B7h)) exceeds typical MED range (5-20 kg/(m\u00B2\u00B7h)).`
    );
  }

  // ========================================================================
  // 9. Tube Bundle Layout
  // ========================================================================

  const pitch = input.pitchRatio * input.tubeOD; // mm

  let rowSpacing: number; // mm
  if (input.tubeLayout === 'triangular') {
    rowSpacing = pitch * Math.sin((60 * Math.PI) / 180); // pitch * sin(60°) = pitch * 0.866
  } else {
    rowSpacing = pitch;
  }

  const bundleWidth = (tubesPerRow - 1) * pitch + input.tubeOD; // mm
  const bundleHeight = (input.tubeRows - 1) * rowSpacing + input.tubeOD; // mm

  // ========================================================================
  // 10. Design Check
  // ========================================================================

  // Required area from heat duty (without margin)
  const requiredArea =
    effectiveTempDiff > 0
      ? (heatDutyKW * 1000) / (overallHTC * effectiveTempDiff)
      : heatTransferArea;
  const designArea = requiredArea * (1 + designMargin);
  const excessArea =
    requiredArea > 0 ? ((heatTransferArea - requiredArea) / requiredArea) * 100 : 0;

  return {
    // Wetting analysis
    wettingRate,
    minimumWettingRate: gammaMin,
    wettingRatio,
    wettingStatus,

    // Film characteristics
    filmReynolds,
    flowRegime,

    // Heat transfer
    filmHTC,
    condensationHTC,
    wallResistance,
    foulingResistance,
    overallHTC,

    // Thermal performance
    effectiveTemperatureDiff: effectiveTempDiff,
    boilingPointElevation: bpe,
    heatTransferArea,
    heatDuty: heatDutyKW,
    evaporationRate,
    specificEvaporationRate,

    // Tube bundle
    tubesPerRow,
    bundleWidth,
    bundleHeight,
    rowSpacing,
    pitch,

    // Design check
    designArea,
    excessArea,

    // Warnings
    warnings,
  };
}
