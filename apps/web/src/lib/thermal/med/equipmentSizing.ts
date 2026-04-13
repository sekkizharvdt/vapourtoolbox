/**
 * MED Plant Equipment Sizing
 *
 * Sizes all major heat exchangers from the H&M balance:
 *   - Evaporator effects (falling film, horizontal tube bundle)
 *   - Final condenser (shell & tube)
 *   - Preheaters (shell & tube)
 *   - Demister per effect
 *   - Wetting rate verification per effect
 *
 * Consumes existing calculators as library functions — no duplication.
 *
 * References:
 * - El-Dessouky & Ettouney (2002), Chapters 6–7
 * - TEMA Standards for tube bundle geometry
 * - HEI Standards for condenser design
 */

import {
  getSaturationPressure,
  getLatentHeat,
  getSeawaterSpecificHeat,
  getSeawaterDensity,
  getSeawaterViscosity,
  getSeawaterThermalConductivity,
  getDensityLiquid,
  getDensityVapor,
  getViscosityLiquid,
  getThermalConductivityLiquid,
  MED_TUBE_CONDUCTIVITY,
  ROGNONI_REFERENCE,
} from '@vapour/constants';
import type {
  MEDEffectResult,
  MEDFinalCondenserResult,
  MEDPreheaterResult,
  MEDPlantInputs,
  TubeMaterial,
} from '@vapour/types';

import { calculateNusseltCondensation, calculateOverallHTC } from '../heatTransfer';
import { calculateLMTD, calculateHeatExchangerArea } from '../heatDutyCalculator';
import { calculateDemisterSizing } from '../demisterCalculator';

// ============================================================================
// Types
// ============================================================================

/**
 * Comparison between our computed value and Rognoni's reference assumption.
 * Allows engineers to see both values side by side.
 */
export interface RognoniComparison {
  /** Label describing the parameter */
  label: string;
  /** Our computed value */
  calculated: number;
  /** Rognoni's fixed/assumed reference value */
  rognoniRef: number;
  /** Unit */
  unit: string;
  /** Deviation from Rognoni reference (%) — positive = our value is higher */
  deviation: number;
}

export interface EvaporatorSizingResult {
  effectNumber: number;
  /** Heat duty in kW */
  heatDuty: number;
  /** Effective ΔT for heat transfer in °C */
  effectiveDeltaT: number;
  /** Tube-side (condensation) HTC in W/(m²·K) */
  tubeSideHTC: number;
  /** Shell-side (falling film evaporation) HTC in W/(m²·K) */
  shellSideHTC: number;
  /** Overall HTC in W/(m²·K) */
  overallHTC: number;
  /** Required heat transfer area in m² */
  requiredArea: number;
  /** Design area (with fouling margin) in m² */
  designArea: number;
  /** Number of tubes */
  tubeCount: number;
  /** Tube OD in mm */
  tubeOD: number;
  /** Tube length in m */
  tubeLength: number;
  /** Tube material */
  tubeMaterial: TubeMaterial;
  /** Approximate bundle diameter in mm */
  bundleDiameter: number;
  /** Wetting rate in kg/(m·s) — without recirculation */
  wettingRate: number;
  /** Wetting rate in kg/(m·s) — with recirculation applied */
  wettingRateWithRecirc: number;
  /** Minimum wetting rate in kg/(m·s) */
  minimumWettingRate: number;
  /** Wetting status (based on effective wetting rate, with recirc if enabled) */
  wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';
  /** Recommended recirculation ratio to achieve 1.5× minimum wetting rate */
  recommendedRecircRatio: number;
  /** Demister required area in m² */
  demisterArea: number;
  /** Demister pressure drop in Pa */
  demisterPressureDrop: number;
  /** Rognoni reference comparisons for key parameters */
  rognoniComparisons: RognoniComparison[];
  /** Warnings */
  warnings: string[];
}

export interface CondenserSizingResult {
  /** Heat duty in kW */
  heatDuty: number;
  /** LMTD in °C */
  lmtd: number;
  /** Tube-side (seawater) HTC in W/(m²·K) */
  tubeSideHTC: number;
  /** Shell-side (condensation) HTC in W/(m²·K) */
  shellSideHTC: number;
  /** Overall HTC in W/(m²·K) */
  overallHTC: number;
  /** Required area in m² */
  requiredArea: number;
  /** Design area in m² */
  designArea: number;
  /** Number of tubes */
  tubeCount: number;
  /** Tube OD in mm */
  tubeOD: number;
  /** Tube length in m */
  tubeLength: number;
  /** Tube material */
  tubeMaterial: TubeMaterial;
  /** Bundle diameter in mm */
  bundleDiameter: number;
  /** Shell ID in mm */
  shellID: number;
  /** Seawater velocity in tubes in m/s */
  tubeVelocity: number;
  /** Rognoni reference comparisons for key parameters */
  rognoniComparisons: RognoniComparison[];
  /** Warnings */
  warnings: string[];
}

export interface PreheaterSizingResult {
  effectNumber: number;
  /** Heat duty in kW */
  heatDuty: number;
  /** LMTD in °C */
  lmtd: number;
  /** Tube-side (seawater) HTC in W/(m²·K) */
  tubeSideHTC: number;
  /** Shell-side (condensation) HTC in W/(m²·K) */
  shellSideHTC: number;
  /** Overall HTC in W/(m²·K) */
  overallHTC: number;
  /** Required area in m² */
  requiredArea: number;
  /** Design area in m² */
  designArea: number;
  /** Number of tubes */
  tubeCount: number;
  /** Tube OD in mm */
  tubeOD: number;
  /** Tube length in m */
  tubeLength: number;
  /** Warnings */
  warnings: string[];
}

export interface EquipmentSizingResult {
  evaporators: EvaporatorSizingResult[];
  condenser: CondenserSizingResult;
  preheaters: PreheaterSizingResult[];
  /** Total evaporator heat transfer area in m² */
  totalEvaporatorArea: number;
  /** Total condenser heat transfer area in m² */
  totalCondenserArea: number;
  /** Total preheater heat transfer area in m² */
  totalPreheaterArea: number;
  /** Grand total heat transfer area in m² */
  grandTotalArea: number;
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default fouling resistance in m²·K/W */
const DEFAULT_FOULING_SEAWATER = 0.00009;
const DEFAULT_FOULING_DISTILLATE = 0.00005;

/** Design margin for heat transfer area (fraction) */
const AREA_DESIGN_MARGIN = 0.15;

/** Minimum wetting rate for falling film (kg/(m·s)) — El-Dessouky correlation threshold */
const MIN_WETTING_RATE = 0.03;

/** Chun-Seban correlation coefficient for turbulent falling film */
// h = 0.18 × Re^0.24 × Pr^0.66 × (μ²/(k³ρ²g))^(-1/3)

/** Standard condenser tube passes */
const CONDENSER_TUBE_PASSES = 4;

/** Bundle layout constant for triangular pitch (TEMA) */
const K1_TRIANGULAR = 0.319; // 1 pass
const N1_TRIANGULAR = 2.142;

/** Build a Rognoni comparison entry */
function rognoniCompare(
  label: string,
  calculated: number,
  rognoniRef: number,
  unit: string
): RognoniComparison {
  const deviation = rognoniRef !== 0 ? ((calculated - rognoniRef) / rognoniRef) * 100 : 0;
  return {
    label,
    calculated: Math.round(calculated * 100) / 100,
    rognoniRef: Math.round(rognoniRef * 100) / 100,
    unit,
    deviation: Math.round(deviation * 10) / 10,
  };
}

// ============================================================================
// Evaporator Sizing
// ============================================================================

/**
 * Size a single evaporator effect.
 *
 * The evaporator is a horizontal-tube falling film unit:
 *   - Tube side: vapor condenses (releases latent heat)
 *   - Shell side: seawater falling film evaporates
 */
function sizeEvaporator(effect: MEDEffectResult, inputs: MEDPlantInputs): EvaporatorSizingResult {
  const warnings: string[] = [];
  const tubeSpec = inputs.evaporatorTubes;
  const tubeMaterial = tubeSpec.material;

  const effectTemp = effect.temperature;
  const steamTemp = effect.vaporIn.temperature;

  // ---- Heat duty ----
  const heatDuty = effect.heatTransferred; // kW (from H&M balance)
  const effectiveDeltaT = effect.effectiveDeltaT;

  if (effectiveDeltaT <= 0) {
    warnings.push(`Effect ${effect.effectNumber}: ΔT ≤ 0, cannot size.`);
    return emptyEvaporatorResult(effect.effectNumber, tubeMaterial, warnings);
  }

  // ---- Tube-side HTC (condensation inside horizontal tubes) ----
  // Nusselt film condensation at steam conditions
  const deltaT_cond = Math.max(steamTemp - effectTemp, 0.5);
  const condensationResult = calculateNusseltCondensation({
    liquidDensity: getDensityLiquid(steamTemp),
    vaporDensity: getDensityVapor(steamTemp),
    latentHeat: getLatentHeat(steamTemp), // kJ/kg — function converts to J/kg internally
    liquidConductivity: getThermalConductivityLiquid(steamTemp),
    liquidViscosity: getViscosityLiquid(steamTemp),
    dimension: (tubeSpec.od - 2 * tubeSpec.thickness) / 1000, // tube ID in m
    deltaT: deltaT_cond,
    orientation: 'horizontal',
  });
  const tubeSideHTC = condensationResult.htc;

  // ---- Shell-side HTC (falling film evaporation) ----
  // Chun-Seban falling film correlation (used by WET Excel programs):
  //   h = 0.18 × Re_film^0.24 × Pr^0.66 × (μ²/(k³×ρ²×g))^(-1/3)
  const brineSalForProps = Math.min(
    inputs.seawaterSalinity * inputs.brineConcentrationFactor,
    120000
  );
  const mu_ff = getSeawaterViscosity(brineSalForProps, effectTemp);
  const k_ff = getSeawaterThermalConductivity(brineSalForProps, effectTemp);
  const rho_ff = getSeawaterDensity(brineSalForProps, effectTemp);
  const cp_ff = getSeawaterSpecificHeat(brineSalForProps, effectTemp) * 1000; // kJ→J
  const Pr_ff = (cp_ff * mu_ff) / k_ff;
  const GRAVITY = 9.80665;
  const filmFactor = Math.pow(
    (mu_ff * mu_ff) / (k_ff * k_ff * k_ff * rho_ff * rho_ff * GRAVITY),
    -1 / 3
  );

  /** Compute Chun-Seban shell-side HTC for a given wetting rate */
  const computeShellSideHTC = (gamma: number): number => {
    const Re = (4 * gamma) / mu_ff;
    return 0.18 * Math.pow(Re, 0.24) * Math.pow(Pr_ff, 0.66) * filmFactor;
  };

  // ---- Overall HTC ----
  const tubeID = tubeSpec.od - 2 * tubeSpec.thickness; // mm
  const tubeWallConductivity = MED_TUBE_CONDUCTIVITY[tubeMaterial] ?? 15; // W/(m·K)

  const computeOverallHTCEvap = (shellHTC: number): number => {
    const result = calculateOverallHTC({
      tubeSideHTC,
      shellSideHTC: shellHTC,
      tubeOD: tubeSpec.od / 1000,
      tubeID: tubeID / 1000,
      tubeWallConductivity,
      tubeSideFouling: DEFAULT_FOULING_DISTILLATE,
      shellSideFouling: DEFAULT_FOULING_SEAWATER,
    });
    return result.overallHTC;
  };

  // ---- Pass 1: Size with assumed design wetting rate Γ ≈ 0.045 kg/(m·s) ----
  const designWettingRate = 0.045;
  let shellSideHTC = computeShellSideHTC(designWettingRate);
  let overallHTC = computeOverallHTCEvap(shellSideHTC);
  let requiredArea = calculateHeatExchangerArea(heatDuty, overallHTC, effectiveDeltaT);
  let designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);
  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length; // m² per tube
  let tubeCount = Math.ceil(designArea / tubeOuterArea);
  const pitch = tubeSpec.od * 1.315; // triangular pitch ≈ 1.315 × OD (33.4/25.4)
  const rowSpacing = pitch * Math.sin((60 * Math.PI) / 180); // pitch × sin(60°)
  let bundleDiameter = tubeSpec.od * Math.pow(tubeCount / K1_TRIANGULAR, 1 / N1_TRIANGULAR);
  let nRows = bundleDiameter > 0 ? Math.floor(bundleDiameter / rowSpacing) : 1;

  // ---- Pass 2: Re-iterate HTC with actual wetting rate ----
  // Resolves circular dependency: HTC → area → tubeCount → wettingRate → HTC
  const sprayFlow = effect.sprayWater.flow / 3600; // kg/s
  const actualGamma =
    nRows > 0 && tubeSpec.length > 0
      ? sprayFlow / (2 * tubeSpec.length * nRows)
      : designWettingRate;

  if (Math.abs(actualGamma - designWettingRate) / designWettingRate > 0.05) {
    // Wetting rate differs from assumption by >5% — recompute
    const revisedShellHTC = computeShellSideHTC(actualGamma);
    if (Math.abs(revisedShellHTC - shellSideHTC) / shellSideHTC > 0.05) {
      shellSideHTC = revisedShellHTC;
      overallHTC = computeOverallHTCEvap(shellSideHTC);
      requiredArea = calculateHeatExchangerArea(heatDuty, overallHTC, effectiveDeltaT);
      designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);
      tubeCount = Math.ceil(designArea / tubeOuterArea);
      bundleDiameter = tubeSpec.od * Math.pow(tubeCount / K1_TRIANGULAR, 1 / N1_TRIANGULAR);
      nRows = bundleDiameter > 0 ? Math.floor(bundleDiameter / rowSpacing) : 1;
    }
  }

  // ---- Wetting rate verification ----
  // VGB "Engineers Guide to Desalination" (Appendix C):
  //   Γ = ṁ / (2 × L × n_rows)
  // Validated against BARC as-built: recirc ratio 2.18× matches formula.
  const wettingRate =
    nRows > 0 && tubeSpec.length > 0 ? sprayFlow / (2 * tubeSpec.length * nRows) : 0;
  const minimumWettingRate = MIN_WETTING_RATE;

  // Target: 1.5× minimum = 0.045 kg/(m·s)
  const targetWettingRate = minimumWettingRate * 1.5;

  // Recommended recirculation ratio to achieve target wetting
  const recommendedRecircRatio =
    wettingRate > 0 && wettingRate < targetWettingRate
      ? Math.ceil((targetWettingRate / wettingRate) * 10) / 10
      : 1.0;
  const wettingRateWithRecirc = wettingRate * recommendedRecircRatio;
  const effectiveWettingRate = wettingRateWithRecirc;
  const wettingRatio = effectiveWettingRate / minimumWettingRate;

  let wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';
  if (wettingRatio >= 2.0) wettingStatus = 'excellent';
  else if (wettingRatio >= 1.5) wettingStatus = 'good';
  else if (wettingRatio >= 1.0) wettingStatus = 'marginal';
  else {
    wettingStatus = 'poor';
    warnings.push(
      `Effect ${effect.effectNumber}: Wetting rate with recommended recirc (${effectiveWettingRate.toFixed(4)} kg/(m·s)) still below minimum (${minimumWettingRate}). Check tube geometry.`
    );
  }

  // ---- Demister sizing ----
  const vaporFlow = effect.vaporOut.flow / 3600; // kg/s
  const vaporDensity = (getSaturationPressure(effectTemp) * 100) / (0.4615 * (effectTemp + 273.15));
  const liquidDensity = getSeawaterDensity(
    inputs.seawaterSalinity * inputs.brineConcentrationFactor,
    effectTemp
  );

  let demisterArea = 0;
  let demisterPressureDrop = 0;
  try {
    const demisterResult = calculateDemisterSizing({
      vaporMassFlow: vaporFlow,
      vaporDensity: Math.max(vaporDensity, 0.02),
      liquidDensity,
      demisterType: 'wire_mesh',
      orientation: 'horizontal',
      designMargin: 0.8,
      geometry: 'circular',
    });
    demisterArea = demisterResult.requiredArea;
    demisterPressureDrop = demisterResult.pressureDrop;
  } catch {
    warnings.push(`Effect ${effect.effectNumber}: Demister sizing failed.`);
  }

  // ---- Rognoni reference comparisons ----
  // Rognoni uses fixed U values that vary by effect position
  const totalEffects = inputs.numberOfEffects;
  const effectFraction = (effect.effectNumber - 1) / Math.max(totalEffects - 1, 1);
  const rognoniU =
    effectFraction < 0.33
      ? ROGNONI_REFERENCE.evaporatorOverallHTC.hotEnd
      : effectFraction < 0.67
        ? ROGNONI_REFERENCE.evaporatorOverallHTC.midRange
        : ROGNONI_REFERENCE.evaporatorOverallHTC.coldEnd;

  // Area from Rognoni's fixed U (for comparison)
  const rognoniRequiredArea = calculateHeatExchangerArea(heatDuty, rognoniU, effectiveDeltaT);
  const rognoniDesignArea = rognoniRequiredArea * (1 + ROGNONI_REFERENCE.designMargin);

  const rognoniComparisons: RognoniComparison[] = [
    rognoniCompare('Falling Film HTC', shellSideHTC, ROGNONI_REFERENCE.fallingFilmHTC, 'W/(m²·K)'),
    rognoniCompare('Condensation HTC', tubeSideHTC, ROGNONI_REFERENCE.condensationHTC, 'W/(m²·K)'),
    rognoniCompare('Overall U', overallHTC, rognoniU, 'W/(m²·K)'),
    rognoniCompare('Required Area', requiredArea, rognoniRequiredArea, 'm²'),
    rognoniCompare('Design Area', designArea, rognoniDesignArea, 'm²'),
    rognoniCompare(
      'Wetting Rate',
      wettingRateWithRecirc,
      ROGNONI_REFERENCE.wettingRate,
      'kg/(m·s)'
    ),
  ];

  return {
    effectNumber: effect.effectNumber,
    heatDuty,
    effectiveDeltaT,
    tubeSideHTC: Math.round(tubeSideHTC),
    shellSideHTC: Math.round(shellSideHTC),
    overallHTC: Math.round(overallHTC * 10) / 10,
    requiredArea: Math.round(requiredArea * 100) / 100,
    designArea: Math.round(designArea * 100) / 100,
    tubeCount,
    tubeOD: tubeSpec.od,
    tubeLength: tubeSpec.length,
    tubeMaterial,
    bundleDiameter: Math.round(bundleDiameter),
    wettingRate: Math.round(wettingRate * 10000) / 10000,
    wettingRateWithRecirc: Math.round(wettingRateWithRecirc * 10000) / 10000,
    minimumWettingRate,
    wettingStatus,
    recommendedRecircRatio: Math.round(recommendedRecircRatio * 10) / 10,
    demisterArea: Math.round(demisterArea * 100) / 100,
    demisterPressureDrop: Math.round(demisterPressureDrop * 10) / 10,
    rognoniComparisons,
    warnings,
  };
}

// ============================================================================
// Final Condenser Sizing
// ============================================================================

// ============================================================================
// Shared: Condensing Shell & Tube Heat Exchanger Sizing
// ============================================================================

/**
 * Size a shell & tube heat exchanger with vapor condensing on the shell
 * side and seawater flowing inside the tubes.
 *
 * Used for both the final condenser and preheaters — same physics,
 * different operating conditions.
 *
 *   - Tube-side HTC: Dittus-Boelter (seawater forced convection)
 *   - Shell-side HTC: Nusselt horizontal tube condensation
 *   - Overall U from composite thermal resistance (wall + fouling)
 *   - Tube count from area, with velocity check
 */
interface CondensingHXInput {
  /** Label for warnings (e.g., "Condenser", "Preheater 2") */
  label: string;
  /** Heat duty in kW */
  heatDuty: number;
  /** LMTD in °C */
  lmtd: number;
  /** Vapor (shell side) condensation temperature in °C */
  vaporTemp: number;
  /** Seawater inlet temperature in °C */
  swInletTemp: number;
  /** Seawater outlet temperature in °C */
  swOutletTemp: number;
  /** Seawater salinity in ppm */
  swSalinity: number;
  /** Seawater mass flow in kg/hr */
  swMassFlow: number;
  /** Tube specification */
  tubeSpec: { od: number; thickness: number; length: number; material: TubeMaterial };
  /** Design velocity target in m/s (condenser ~1.8, preheater ~1.6) */
  designVelocity: number;
  /** Number of tube passes */
  tubePasses: number;
  /** Estimated number of tube rows in the bundle (for Kern correction, default 10) */
  estimatedTubeRows?: number;
  /** NCG degradation factor (fraction of HTC lost to NCG blanketing, default 0) */
  ncgDegradation?: number;
}

interface CondensingHXResult {
  tubeSideHTC: number;
  shellSideHTC: number;
  overallHTC: number;
  requiredArea: number;
  designArea: number;
  tubeCount: number;
  bundleDiameter: number;
  shellID: number;
  tubeVelocity: number;
  warnings: string[];
}

function sizeCondensingHX(input: CondensingHXInput): CondensingHXResult {
  const warnings: string[] = [];
  const { tubeSpec, swSalinity, designVelocity, tubePasses } = input;
  const nTubeRows = input.estimatedTubeRows ?? 10;
  const ncgDeg = input.ncgDegradation ?? 0;

  // ---- Seawater properties at average tube-side temperature ----
  const avgSwTemp = (input.swInletTemp + input.swOutletTemp) / 2;
  const swDensity = getSeawaterDensity(swSalinity, avgSwTemp);
  const swViscosity = getSeawaterViscosity(swSalinity, avgSwTemp);
  const swConductivity = getSeawaterThermalConductivity(swSalinity, avgSwTemp);
  const swCp = getSeawaterSpecificHeat(swSalinity, avgSwTemp);
  const tubeID = (tubeSpec.od - 2 * tubeSpec.thickness) / 1000;

  // ---- Step 1: Initial tube-side HTC at design velocity ----
  // Used for first-pass area estimation (will be refined at actual velocity)
  const computeTubeSideHTC = (velocity: number) => {
    const Re = (swDensity * velocity * tubeID) / swViscosity;
    const Pr = (swCp * 1000 * swViscosity) / swConductivity;
    const Nu = Re > 2300 ? 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.4) : 4.36;
    return (Nu * swConductivity) / tubeID;
  };

  // ---- Step 2: Shell-side HTC (Nusselt single-tube condensation) ----
  const condensationResult = calculateNusseltCondensation({
    liquidDensity: getDensityLiquid(input.vaporTemp),
    vaporDensity: Math.max(getDensityVapor(input.vaporTemp), 0.02),
    latentHeat: getLatentHeat(input.vaporTemp), // kJ/kg — function converts to J/kg internally
    liquidConductivity: getThermalConductivityLiquid(input.vaporTemp),
    liquidViscosity: getViscosityLiquid(input.vaporTemp),
    dimension: tubeSpec.od / 1000,
    deltaT: Math.max(input.vaporTemp - avgSwTemp, 1),
    orientation: 'horizontal',
  });

  // Kern bundle row correction: condensate dripping from upper tubes degrades
  // the film coefficient on lower tubes. h_bundle = h_single × N^(-1/6)
  const kernFactor = Math.pow(Math.max(nTubeRows, 1), -1 / 6);

  // NCG degradation: non-condensable gases form a boundary layer that resists
  // mass transfer. More significant for the final condenser (accumulated NCG
  // from all effects) than for preheaters (single effect NCG only).
  const ncgFactor = 1 - ncgDeg;

  const shellSideHTC = condensationResult.htc * kernFactor * ncgFactor;

  // ---- Step 3: Overall HTC and initial sizing ----
  const tubeWallConductivity = MED_TUBE_CONDUCTIVITY[tubeSpec.material] ?? 15;

  const computeOverallU = (hTube: number) => {
    const result = calculateOverallHTC({
      tubeSideHTC: hTube,
      shellSideHTC,
      tubeOD: tubeSpec.od / 1000,
      tubeID,
      tubeWallConductivity,
      tubeSideFouling: DEFAULT_FOULING_SEAWATER,
      shellSideFouling: DEFAULT_FOULING_DISTILLATE,
    });
    return result.overallHTC;
  };

  // First pass: size at design velocity
  let tubeSideHTC = computeTubeSideHTC(designVelocity);
  let overallHTC = computeOverallU(tubeSideHTC);

  const requiredArea = calculateHeatExchangerArea(input.heatDuty, overallHTC, input.lmtd);
  const designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);

  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length;
  const rawTubeCount = Math.ceil(designArea / tubeOuterArea);
  const tubeCount = Math.ceil(rawTubeCount / tubePasses) * tubePasses;

  // ---- Step 4: Recalculate HTC at actual velocity ----
  const flowAreaPerPass = (tubeCount / tubePasses) * (Math.PI / 4) * tubeID * tubeID;
  const swMassFlowKgS = input.swMassFlow / 3600;
  const tubeVelocity = flowAreaPerPass > 0 ? swMassFlowKgS / (swDensity * flowAreaPerPass) : 0;

  // Refine tube-side HTC at actual velocity (not design velocity)
  if (tubeVelocity > 0 && Math.abs(tubeVelocity - designVelocity) > 0.1) {
    tubeSideHTC = computeTubeSideHTC(tubeVelocity);
    overallHTC = computeOverallU(tubeSideHTC);
  }

  // ---- Bundle & shell ----
  const bundleDiameter = tubeSpec.od * Math.pow(tubeCount / K1_TRIANGULAR, 1 / N1_TRIANGULAR);
  // Minimum 50mm clearance between bundle OD and shell ID (industry standard)
  const shellID = bundleDiameter + Math.max(50, Math.round(bundleDiameter * 0.05));

  // ---- Velocity warnings ----
  if (tubeVelocity > 2.5) {
    warnings.push(`${input.label}: Tube velocity (${tubeVelocity.toFixed(2)} m/s) > 2.5 m/s.`);
  }
  if (tubeVelocity < 1.0 && tubeVelocity > 0) {
    warnings.push(
      `${input.label}: Tube velocity (${tubeVelocity.toFixed(2)} m/s) < 1.0 m/s. Risk of fouling.`
    );
  }

  return {
    tubeSideHTC: Math.round(tubeSideHTC),
    shellSideHTC: Math.round(shellSideHTC),
    overallHTC: Math.round(overallHTC * 10) / 10,
    requiredArea: Math.round(requiredArea * 100) / 100,
    designArea: Math.round(designArea * 100) / 100,
    tubeCount,
    bundleDiameter: Math.round(bundleDiameter),
    shellID: Math.round(shellID),
    tubeVelocity: Math.round(tubeVelocity * 100) / 100,
    warnings,
  };
}

// ============================================================================
// Final Condenser (uses shared sizeCondensingHX)
// ============================================================================

function sizeFinalCondenser(
  condenser: MEDFinalCondenserResult,
  inputs: MEDPlantInputs
): CondenserSizingResult {
  const warnings: string[] = [];
  const tubeSpec = inputs.condenserTubes;

  const heatDuty = condenser.heatTransferred;
  const vaporTemp = condenser.vaporIn.temperature;
  const swInTemp = inputs.seawaterInletTemp;
  const swOutTemp = inputs.seawaterDischargeTemp;

  const lmtdResult = calculateLMTD({
    hotInlet: vaporTemp,
    hotOutlet: vaporTemp,
    coldInlet: swInTemp,
    coldOutlet: swOutTemp,
    flowArrangement: 'COUNTER',
  });
  const lmtd = lmtdResult.correctedLMTD;
  warnings.push(...lmtdResult.warnings);

  if (lmtd <= 0) {
    warnings.push('Final condenser: LMTD ≤ 0, cannot size.');
    return emptyCondenserResult(tubeSpec.material, warnings);
  }

  const hx = sizeCondensingHX({
    label: 'Condenser',
    heatDuty,
    lmtd,
    vaporTemp,
    swInletTemp: swInTemp,
    swOutletTemp: swOutTemp,
    swSalinity: inputs.seawaterSalinity,
    swMassFlow: condenser.seawaterIn.flow,
    tubeSpec,
    designVelocity: 1.8,
    tubePasses: CONDENSER_TUBE_PASSES,
    estimatedTubeRows: 10,
    ncgDegradation: 0.15, // 15% — accumulated NCG from all effects
  });
  warnings.push(...hx.warnings);

  const rognoniCondU = ROGNONI_REFERENCE.condenserOverallHTC;
  const rognoniCondArea = calculateHeatExchangerArea(heatDuty, rognoniCondU, lmtd);
  const rognoniCondDesignArea = rognoniCondArea * (1 + ROGNONI_REFERENCE.designMargin);

  const rognoniComparisons: RognoniComparison[] = [
    rognoniCompare('Overall U', hx.overallHTC, rognoniCondU, 'W/(m²·K)'),
    rognoniCompare('Required Area', hx.requiredArea, rognoniCondArea, 'm²'),
    rognoniCompare('Design Area', hx.designArea, rognoniCondDesignArea, 'm²'),
    rognoniCompare(
      'Tube Velocity',
      hx.tubeVelocity,
      ROGNONI_REFERENCE.condenserTubeVelocity,
      'm/s'
    ),
  ];

  return {
    heatDuty: Math.round(heatDuty * 10) / 10,
    lmtd: Math.round(lmtd * 100) / 100,
    tubeSideHTC: hx.tubeSideHTC,
    shellSideHTC: hx.shellSideHTC,
    overallHTC: hx.overallHTC,
    requiredArea: hx.requiredArea,
    designArea: hx.designArea,
    tubeCount: hx.tubeCount,
    tubeOD: tubeSpec.od,
    tubeLength: tubeSpec.length,
    tubeMaterial: tubeSpec.material,
    bundleDiameter: hx.bundleDiameter,
    shellID: hx.shellID,
    tubeVelocity: hx.tubeVelocity,
    rognoniComparisons,
    warnings,
  };
}

// ============================================================================
// Preheater (uses shared sizeCondensingHX)
// ============================================================================

function sizePreheater(
  preheater: MEDPreheaterResult,
  inputs: MEDPlantInputs
): PreheaterSizingResult {
  const warnings: string[] = [];
  const tubeSpec = inputs.condenserTubes;

  const heatDuty = preheater.heatExchanged;
  const lmtd = preheater.lmtd;

  if (lmtd <= 0) {
    warnings.push(`Preheater on effect ${preheater.effectNumber}: LMTD ≤ 0.`);
    return emptyPreheaterResult(preheater.effectNumber, warnings);
  }

  const hotEndApproach = preheater.vaporTemperature - preheater.seawaterOutletTemp;
  if (hotEndApproach < 2.0) {
    warnings.push(
      `Preheater ${preheater.effectNumber}: Hot-end approach (${hotEndApproach.toFixed(1)}°C) < 2°C minimum.`
    );
  }

  const hx = sizeCondensingHX({
    label: `Preheater ${preheater.effectNumber}`,
    heatDuty,
    lmtd,
    vaporTemp: preheater.vaporTemperature,
    swInletTemp: preheater.seawaterInletTemp,
    swOutletTemp: preheater.seawaterOutletTemp,
    swSalinity: inputs.seawaterSalinity,
    swMassFlow: preheater.seawaterFlow,
    tubeSpec,
    designVelocity: 1.6,
    tubePasses: CONDENSER_TUBE_PASSES,
    estimatedTubeRows: 6, // smaller bundle than condenser
    ncgDegradation: 0.05, // 5% — single effect NCG only
  });
  warnings.push(...hx.warnings);

  return {
    effectNumber: preheater.effectNumber,
    heatDuty: Math.round(heatDuty * 10) / 10,
    lmtd: Math.round(lmtd * 100) / 100,
    tubeSideHTC: hx.tubeSideHTC,
    shellSideHTC: hx.shellSideHTC,
    overallHTC: hx.overallHTC,
    requiredArea: hx.requiredArea,
    designArea: hx.designArea,
    tubeCount: hx.tubeCount,
    tubeOD: tubeSpec.od,
    tubeLength: tubeSpec.length,
    warnings,
  };
}

// ============================================================================
// Main Equipment Sizing Function
// ============================================================================

/**
 * Size all major equipment from the MED plant H&M balance results.
 */
export function sizeEquipment(
  effects: MEDEffectResult[],
  condenser: MEDFinalCondenserResult,
  preheaters: MEDPreheaterResult[],
  inputs: MEDPlantInputs
): EquipmentSizingResult {
  const warnings: string[] = [];

  // Size each evaporator effect
  const evaporators = effects.map((eff) => sizeEvaporator(eff, inputs));
  for (const ev of evaporators) {
    warnings.push(...ev.warnings);
  }

  // Size final condenser
  const condenserSizing = sizeFinalCondenser(condenser, inputs);
  warnings.push(...condenserSizing.warnings);

  // Size preheaters
  const preheaterSizings = preheaters.map((ph) => sizePreheater(ph, inputs));
  for (const ph of preheaterSizings) {
    warnings.push(...ph.warnings);
  }

  // Totals
  const totalEvaporatorArea = evaporators.reduce((sum, e) => sum + e.designArea, 0);
  const totalCondenserArea = condenserSizing.designArea;
  const totalPreheaterArea = preheaterSizings.reduce((sum, p) => sum + p.designArea, 0);
  const grandTotalArea = totalEvaporatorArea + totalCondenserArea + totalPreheaterArea;

  return {
    evaporators,
    condenser: condenserSizing,
    preheaters: preheaterSizings,
    totalEvaporatorArea: Math.round(totalEvaporatorArea * 100) / 100,
    totalCondenserArea: Math.round(totalCondenserArea * 100) / 100,
    totalPreheaterArea: Math.round(totalPreheaterArea * 100) / 100,
    grandTotalArea: Math.round(grandTotalArea * 100) / 100,
    warnings,
  };
}

// ============================================================================
// Empty Result Helpers
// ============================================================================

function emptyEvaporatorResult(
  effectNumber: number,
  tubeMaterial: TubeMaterial,
  warnings: string[]
): EvaporatorSizingResult {
  return {
    effectNumber,
    heatDuty: 0,
    effectiveDeltaT: 0,
    tubeSideHTC: 0,
    shellSideHTC: 0,
    overallHTC: 0,
    requiredArea: 0,
    designArea: 0,
    tubeCount: 0,
    tubeOD: 0,
    tubeLength: 0,
    tubeMaterial,
    bundleDiameter: 0,
    wettingRate: 0,
    wettingRateWithRecirc: 0,
    minimumWettingRate: MIN_WETTING_RATE,
    wettingStatus: 'poor',
    recommendedRecircRatio: 1.0,
    demisterArea: 0,
    demisterPressureDrop: 0,
    rognoniComparisons: [],
    warnings,
  };
}

function emptyCondenserResult(
  tubeMaterial: TubeMaterial,
  warnings: string[]
): CondenserSizingResult {
  return {
    heatDuty: 0,
    lmtd: 0,
    tubeSideHTC: 0,
    shellSideHTC: 0,
    overallHTC: 0,
    requiredArea: 0,
    designArea: 0,
    tubeCount: 0,
    tubeOD: 0,
    tubeLength: 0,
    tubeMaterial,
    bundleDiameter: 0,
    shellID: 0,
    tubeVelocity: 0,
    rognoniComparisons: [],
    warnings,
  };
}

function emptyPreheaterResult(effectNumber: number, warnings: string[]): PreheaterSizingResult {
  return {
    effectNumber,
    heatDuty: 0,
    lmtd: 0,
    tubeSideHTC: 0,
    shellSideHTC: 0,
    overallHTC: 0,
    requiredArea: 0,
    designArea: 0,
    tubeCount: 0,
    tubeOD: 0,
    tubeLength: 0,
    warnings,
  };
}
