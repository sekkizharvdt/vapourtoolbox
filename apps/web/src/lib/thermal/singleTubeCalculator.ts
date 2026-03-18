/**
 * Single Tube Analysis Calculator
 *
 * Analyses a single horizontal tube with:
 *   - Vapour condensing INSIDE the tube (Nusselt horizontal in-tube condensation)
 *   - Spray water evaporating on the OUTSIDE (Chun-Seban falling film)
 *
 * Calculates film thickness on both sides, heat transfer coefficients,
 * overall U-value, and complete heat & mass balance.
 *
 * References:
 * - Nusselt, W., "Die Oberflachenkondensation des Wasserdampfes," 1916
 * - Chun, K.R. and Seban, R.A., "Heat Transfer to Evaporating Liquid Films," 1971
 * - El-Dessouky & Ettouney, "Fundamentals of Salt Water Desalination," 2002
 * - Sharqawy, M.H. et al., "Thermophysical properties of seawater," 2010
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
  TUBE_CONDUCTIVITY,
} from '@vapour/constants';
import type {
  SingleTubeInput,
  SingleTubeResult,
  FilmAnalysis,
  SingleTubeHeatMassBalance,
  TubeMaterialKey,
} from '@vapour/types';

// ============================================================================
// Constants
// ============================================================================

const g = 9.81; // m/s²
const DEFAULT_FOULING = 0.00009; // m²·K/W
const DEFAULT_DESIGN_MARGIN = 0.15;

/** Map TubeMaterialKey to TUBE_CONDUCTIVITY key */
const MATERIAL_KEY_MAP: Record<TubeMaterialKey, string> = {
  al_5052: 'aluminium_5052',
  ti_sb338_gr2: 'titanium_sb338_gr2',
  cu_ni_90_10: 'copper_nickel_90_10',
  cu_ni_70_30: 'copper_nickel_70_30',
  al_brass: 'aluminium_brass',
  ss_316l: 'stainless_316',
  duplex_2205: 'duplex_2205',
};

/** Default wall thickness per material (mm) */
const DEFAULT_WALL_THICKNESS: Record<TubeMaterialKey, number> = {
  al_5052: 1.0,
  ti_sb338_gr2: 0.4,
  cu_ni_90_10: 0.7,
  cu_ni_70_30: 0.7,
  al_brass: 0.7,
  ss_316l: 0.7,
  duplex_2205: 0.7,
};

/** Material labels for display */
export const SINGLE_TUBE_MATERIAL_LABELS: Record<TubeMaterialKey, string> = {
  al_5052: 'Aluminium 5052',
  ti_sb338_gr2: 'Titanium SB 338 Gr 2',
  cu_ni_90_10: 'Cu-Ni 90/10',
  cu_ni_70_30: 'Cu-Ni 70/30',
  al_brass: 'Aluminium Brass',
  ss_316l: 'SS 316L',
  duplex_2205: 'Duplex 2205',
};

// ============================================================================
// Pure water property correlations (for condensate film)
// ============================================================================

function getPureWaterViscosity(tempC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tempC + 133.15));
}

function getPureWaterConductivity(tempC: number): number {
  return 0.569 + 0.0019 * tempC - 8e-6 * tempC * tempC;
}

function getSeawaterSurfaceTension(tempC: number): number {
  return 0.0756 - 0.000145 * tempC;
}

function getPureWaterSpecificHeat(tempC: number): number {
  // kJ/(kg·K) — polynomial fit valid 0-200°C
  return 4.2174 - 0.0036 * tempC + 1.7e-5 * tempC * tempC;
}

// ============================================================================
// Validation
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSingleTubeInput(input: SingleTubeInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Tube geometry
  if (input.tubeOD <= 0) errors.push('Tube OD must be > 0');
  if (input.wallThickness <= 0) errors.push('Wall thickness must be > 0');
  if (input.wallThickness >= input.tubeOD / 2)
    errors.push('Wall thickness must be less than tube radius');
  if (input.tubeLength <= 0) errors.push('Tube length must be > 0');
  if (input.tubeLength > 20) warnings.push('Tube length > 20 m is unusual for MED tubes');

  // Inside conditions
  if (input.vapourTemperature <= 0) errors.push('Vapour temperature must be > 0°C');
  if (input.vapourTemperature > 200) errors.push('Vapour temperature must be ≤ 200°C');
  if (input.vapourFlowRate <= 0) errors.push('Vapour flow rate must be > 0');

  // Outside conditions
  if (input.sprayTemperature <= 0) errors.push('Spray temperature must be > 0°C');
  if (input.sprayTemperature >= input.vapourTemperature)
    errors.push('Spray temperature must be lower than vapour temperature');
  if (input.sprayFlowRate <= 0) errors.push('Spray flow rate must be > 0');

  // Salinity
  if (input.spraySalinity < 0) errors.push('Salinity cannot be negative');
  if (input.spraySalinity > 120000) errors.push('Salinity exceeds valid range (120,000 ppm)');

  // Material
  if (!MATERIAL_KEY_MAP[input.tubeMaterial])
    errors.push(`Unknown tube material "${input.tubeMaterial}"`);

  // Fouling
  if (input.insideFouling !== undefined && input.insideFouling < 0)
    errors.push('Inside fouling resistance cannot be negative');
  if (input.outsideFouling !== undefined && input.outsideFouling < 0)
    errors.push('Outside fouling resistance cannot be negative');

  return { isValid: errors.length === 0, errors, warnings };
}

// ============================================================================
// Wetting limits (same as falling film calculator)
// ============================================================================

const WETTING_LIMITS = {
  EXCELLENT: 3.0,
  GOOD: 2.0,
  MARGINAL: 1.5,
};

// ============================================================================
// Main calculator
// ============================================================================

/**
 * Analyse a single horizontal tube with vapour condensing inside
 * and spray water evaporating on the outside.
 */
export function calculateSingleTube(input: SingleTubeInput): SingleTubeResult {
  const validation = validateSingleTubeInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join('; ')}`);
  }
  const warnings = [...validation.warnings];

  // Resolve optional params
  const insideFouling = input.insideFouling ?? DEFAULT_FOULING;
  const outsideFouling = input.outsideFouling ?? DEFAULT_FOULING;
  const designMargin = input.designMargin ?? DEFAULT_DESIGN_MARGIN;

  // ========================================================================
  // Tube geometry
  // ========================================================================

  const D_o = input.tubeOD / 1000; // m
  const wallM = input.wallThickness / 1000; // m
  const D_i = D_o - 2 * wallM; // m
  const tubeID = D_i * 1000; // mm

  const outerSurfaceArea = Math.PI * D_o * input.tubeLength; // m²
  const innerSurfaceArea = Math.PI * D_i * input.tubeLength; // m²

  // Wall conductivity
  const matKey = MATERIAL_KEY_MAP[input.tubeMaterial];
  const wallConductivity = TUBE_CONDUCTIVITY[matKey]?.value ?? 22; // W/(m·K)

  // ========================================================================
  // Outside: Spray water / falling film properties
  // ========================================================================

  const salPPM = input.spraySalinity;
  const T_spray = input.sprayTemperature;

  // Seawater/brine properties (works for pure water at salinity=0 too)
  const rho_spray = salPPM > 0 ? getSeawaterDensity(salPPM, T_spray) : getDensityLiquid(T_spray);
  const mu_spray =
    salPPM > 0 ? getSeawaterViscosity(salPPM, T_spray) : getPureWaterViscosity(T_spray);
  const cp_spray =
    salPPM > 0 ? getSeawaterSpecificHeat(salPPM, T_spray) : getPureWaterSpecificHeat(T_spray);
  const k_spray =
    salPPM > 0
      ? getSeawaterThermalConductivity(salPPM, T_spray)
      : getPureWaterConductivity(T_spray);
  const sigma_spray = getSeawaterSurfaceTension(T_spray);

  const Pr_spray = (mu_spray * cp_spray * 1000) / k_spray; // cp in J/(kg·K)

  // BPE
  const bpe = salPPM > 0 ? getBoilingPointElevation(salPPM, T_spray) : 0;

  // ========================================================================
  // Outside: Wetting analysis
  // ========================================================================

  // For a single tube, wetting rate Γ = sprayFlowRate / (L × 2)
  // Factor 2: liquid flows on both sides of the horizontal tube
  const wettingRate = input.sprayFlowRate / (input.tubeLength * 2); // kg/(m·s)

  // Minimum wetting rate (El-Dessouky & Ettouney 2002)
  const gammaMin = 0.11 * Math.pow((mu_spray * mu_spray) / (rho_spray * sigma_spray), 1 / 3);
  const wettingRatio = wettingRate / gammaMin;

  let wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';
  if (wettingRatio > WETTING_LIMITS.EXCELLENT) wettingStatus = 'excellent';
  else if (wettingRatio > WETTING_LIMITS.GOOD) wettingStatus = 'good';
  else if (wettingRatio > WETTING_LIMITS.MARGINAL) wettingStatus = 'marginal';
  else wettingStatus = 'poor';

  if (wettingRatio < 1.5) {
    warnings.push(
      `Wetting ratio (${wettingRatio.toFixed(2)}) below 1.5 — dry spots likely. Increase spray flow.`
    );
  }

  // ========================================================================
  // Outside: Film Reynolds & HTC (Chun-Seban 1971)
  // ========================================================================

  const filmReynoldsOut = (4 * wettingRate) / mu_spray;

  let flowRegimeOut: string;
  if (filmReynoldsOut < 30) {
    flowRegimeOut = 'Droplet';
    warnings.push('Outside film is in droplet regime (Re < 30) — poor film coverage.');
  } else if (filmReynoldsOut < 400) {
    flowRegimeOut = 'Laminar Sheet';
  } else if (filmReynoldsOut < 1600) {
    flowRegimeOut = 'Wavy-Laminar';
  } else {
    flowRegimeOut = 'Turbulent';
  }

  // Common film group: (k³ × ρ² × g / μ²)^(1/3)
  const filmGroupOut = Math.pow(
    (k_spray * k_spray * k_spray * rho_spray * rho_spray * g) / (mu_spray * mu_spray),
    1 / 3
  );

  let htcOutside: number;
  if (filmReynoldsOut < 400) {
    htcOutside = 0.821 * filmGroupOut * Math.pow(filmReynoldsOut, -1 / 3);
  } else if (filmReynoldsOut < 1600) {
    htcOutside = 0.0038 * filmGroupOut * Math.pow(filmReynoldsOut, 0.4) * Math.pow(Pr_spray, 0.65);
  } else {
    htcOutside = 0.0065 * filmGroupOut * Math.pow(filmReynoldsOut, 0.4) * Math.pow(Pr_spray, 0.65);
  }

  // Film thickness outside: δ = (3 × μ × Γ / (ρ² × g))^(1/3)
  const filmThicknessOut =
    Math.pow((3 * mu_spray * wettingRate) / (rho_spray * rho_spray * g), 1 / 3) * 1000; // mm

  // ========================================================================
  // Inside: Condensate film (Nusselt horizontal in-tube)
  // ========================================================================

  const T_vap = input.vapourTemperature;

  // Condensate properties at vapour temperature (pure water condensate)
  const rho_cond = getDensityLiquid(T_vap);
  const rho_vap = getDensityVapor(T_vap);
  const mu_cond = getPureWaterViscosity(T_vap);
  const k_cond = getPureWaterConductivity(T_vap);
  const hfg_cond = getLatentHeat(T_vap); // kJ/kg

  // ΔT across condensate film ≈ T_vap - T_spray (approximation for single tube)
  const deltaT_cond = T_vap - T_spray;

  // Nusselt horizontal in-tube condensation:
  // h = 0.725 × [ρ_l × (ρ_l − ρ_v) × g × hfg × k³ / (μ × D_i × ΔT)]^0.25
  const safeDeltaT = Math.max(deltaT_cond, 0.1);
  const numerator = rho_cond * (rho_cond - rho_vap) * g * (hfg_cond * 1000) * Math.pow(k_cond, 3);
  const denominator = mu_cond * D_i * safeDeltaT;
  const htcInside = 0.725 * Math.pow(numerator / denominator, 0.25);

  // Condensate film Reynolds (for reference)
  // Approximate: Re_cond = 4 × Γ_cond / μ_cond
  // where Γ_cond ≈ condensate rate per unit length
  // We'll compute this after heat duty is known; use estimated value for now
  const filmReynoldsIn_est = (4 * (input.vapourFlowRate * 0.5)) / (input.tubeLength * mu_cond);

  let flowRegimeIn: string;
  if (filmReynoldsIn_est < 30) flowRegimeIn = 'Thin Film';
  else if (filmReynoldsIn_est < 400) flowRegimeIn = 'Laminar';
  else if (filmReynoldsIn_est < 1600) flowRegimeIn = 'Wavy-Laminar';
  else flowRegimeIn = 'Turbulent';

  // Film thickness inside (Nusselt theory):
  // δ = [4 × μ × k × ΔT × D / (ρ × (ρ − ρ_v) × g × hfg)]^0.25
  // Simplified: δ = k / h (from Nu definition for film condensation)
  const filmThicknessIn = (k_cond / htcInside) * 1000; // mm

  // ========================================================================
  // Overall HTC
  // ========================================================================

  // Wall resistance: R_wall = D_o × ln(D_o/D_i) / (2 × k_wall)
  const wallResistance = (D_o * Math.log(D_o / D_i)) / (2 * wallConductivity);

  // Overall HTC based on OD:
  // 1/U_o = 1/h_o + R_fo + R_wall + R_fi×(D_o/D_i) + (D_o/D_i)×(1/h_i)
  const invU =
    1 / htcOutside +
    outsideFouling +
    wallResistance +
    insideFouling * (D_o / D_i) +
    (D_o / D_i) * (1 / htcInside);

  const overallHTC = 1 / invU;

  // ========================================================================
  // Thermal performance
  // ========================================================================

  const T_boiling = T_spray + bpe;
  const effectiveDeltaT = T_vap - T_boiling;

  if (effectiveDeltaT < 1) {
    warnings.push(
      `Effective ΔT (${effectiveDeltaT.toFixed(2)}°C) < 1°C — insufficient driving force.`
    );
  }

  // Heat duty
  const heatDuty = overallHTC * outerSurfaceArea * effectiveDeltaT; // W
  const heatDutyKW = heatDuty / 1000;

  // ========================================================================
  // Heat & mass balance
  // ========================================================================

  const latentHeatEvap = getLatentHeat(T_spray); // kJ/kg (outside evaporation)

  // Vapour condensed inside
  const vapourCondensed = heatDutyKW / hfg_cond; // kg/s
  const condensateOut = vapourCondensed;

  // Water evaporated outside
  const waterEvaporated = heatDutyKW / latentHeatEvap; // kg/s

  // Brine leaving
  const brineOut = input.sprayFlowRate - waterEvaporated;
  const brineOutSalinity =
    brineOut > 0 && salPPM > 0 ? (salPPM * input.sprayFlowRate) / brineOut : 0;

  if (waterEvaporated > input.sprayFlowRate * 0.5) {
    warnings.push('Over 50% of spray water evaporated — may cause dry-out on tube surface.');
  }

  if (vapourCondensed > input.vapourFlowRate) {
    warnings.push(
      `Calculated condensate (${(vapourCondensed * 3600).toFixed(1)} kg/h) exceeds vapour inlet ` +
        `(${(input.vapourFlowRate * 3600).toFixed(1)} kg/h). All vapour would condense before tube end.`
    );
  }

  // Recalculate inside film Reynolds with actual condensate rate
  const gammaCondActual = vapourCondensed / (input.tubeLength * 2);
  const filmReynoldsIn = (4 * gammaCondActual) / mu_cond;
  if (filmReynoldsIn < 30) flowRegimeIn = 'Thin Film';
  else if (filmReynoldsIn < 400) flowRegimeIn = 'Laminar';
  else if (filmReynoldsIn < 1600) flowRegimeIn = 'Wavy-Laminar';
  else flowRegimeIn = 'Turbulent';

  const heatMassBalance: SingleTubeHeatMassBalance = {
    heatDuty: heatDutyKW,
    vapourCondensed,
    waterEvaporated,
    condensateOut,
    brineOut,
    brineOutSalinity,
    latentHeatCondensation: hfg_cond,
    latentHeatEvaporation: latentHeatEvap,
  };

  // ========================================================================
  // Design check
  // ========================================================================

  const requiredArea =
    effectiveDeltaT > 0 ? heatDuty / (overallHTC * effectiveDeltaT) : outerSurfaceArea;
  const designArea = requiredArea * (1 + designMargin);
  const excessArea =
    requiredArea > 0 ? ((outerSurfaceArea - requiredArea) / requiredArea) * 100 : 0;

  // ========================================================================
  // Build result
  // ========================================================================

  const insideFilm: FilmAnalysis = {
    filmThickness: filmThicknessIn,
    reynoldsNumber: filmReynoldsIn,
    flowRegime: flowRegimeIn,
    htc: htcInside,
  };

  const outsideFilm: FilmAnalysis = {
    filmThickness: filmThicknessOut,
    reynoldsNumber: filmReynoldsOut,
    flowRegime: flowRegimeOut,
    htc: htcOutside,
  };

  return {
    inputs: input,
    tubeID,
    outerSurfaceArea,
    innerSurfaceArea,
    wallConductivity,
    insideFilm,
    outsideFilm,
    wallResistance,
    insideFouling,
    outsideFouling,
    overallHTC,
    effectiveDeltaT,
    boilingPointElevation: bpe,
    heatMassBalance,
    wettingRate,
    minimumWettingRate: gammaMin,
    wettingRatio,
    wettingStatus,
    requiredArea,
    designArea,
    excessArea,
    warnings,
  };
}

/**
 * Get the default wall thickness for a given tube material.
 */
export function getDefaultWallThickness(material: TubeMaterialKey): number {
  return DEFAULT_WALL_THICKNESS[material] ?? 1.0;
}
