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

/** Typical falling film evaporation HTC range (W/(m²·K)) */
const FALLING_FILM_HTC_MIN = 2000;
const FALLING_FILM_HTC_MAX = 4000;

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
    latentHeat: getLatentHeat(steamTemp) * 1000, // kJ/kg → J/kg
    liquidConductivity: getThermalConductivityLiquid(steamTemp),
    liquidViscosity: getViscosityLiquid(steamTemp),
    dimension: (tubeSpec.od - 2 * tubeSpec.thickness) / 1000, // tube ID in m
    deltaT: deltaT_cond,
    orientation: 'horizontal',
  });
  const tubeSideHTC = condensationResult.htc;

  // ---- Shell-side HTC (falling film evaporation) ----
  // Use empirical correlation for horizontal-tube falling film
  // El-Dessouky: h_ff ≈ 2000–4000 W/(m²·K) depending on wetting rate and temperature
  // Simplified: h_ff = 2500 × (T_effect / 60)^0.3 for typical MED conditions
  const shellSideHTC = Math.min(
    FALLING_FILM_HTC_MAX,
    Math.max(FALLING_FILM_HTC_MIN, 2500 * Math.pow(effectTemp / 60, 0.3))
  );

  // ---- Overall HTC ----
  const tubeID = tubeSpec.od - 2 * tubeSpec.thickness; // mm
  const tubeWallConductivity = MED_TUBE_CONDUCTIVITY[tubeMaterial] ?? 15; // W/(m·K)
  const overallResult = calculateOverallHTC({
    tubeSideHTC,
    shellSideHTC,
    tubeOD: tubeSpec.od / 1000, // m
    tubeID: tubeID / 1000, // m
    tubeWallConductivity,
    tubeSideFouling: DEFAULT_FOULING_DISTILLATE,
    shellSideFouling: DEFAULT_FOULING_SEAWATER,
  });
  const overallHTC = overallResult.overallHTC;

  // ---- Area calculation ----
  const requiredArea = calculateHeatExchangerArea(heatDuty, overallHTC, effectiveDeltaT);
  const designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);

  // ---- Tube count ----
  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length; // m² per tube
  const tubeCount = Math.ceil(designArea / tubeOuterArea);

  // ---- Bundle diameter (triangular pitch) ----
  const bundleDiameter = tubeSpec.od * Math.pow(tubeCount / K1_TRIANGULAR, 1 / N1_TRIANGULAR); // mm

  // ---- Wetting rate verification ----
  const sprayFlow = effect.sprayWater.flow / 3600; // kg/s
  const totalTubeLength = tubeCount * tubeSpec.length; // m
  // Wetting rate Γ = spray flow / (2 × total tube length on one side)
  // For horizontal tubes: Γ = flow / (N_tubes × L × 2) ... per side
  const wettingRate = sprayFlow / (2 * totalTubeLength);
  const minimumWettingRate = MIN_WETTING_RATE;

  // Recommended recirculation ratio to achieve 1.5× minimum wetting rate (target = 0.045 kg/(m·s))
  const targetWettingRate = minimumWettingRate * 1.5;
  const recommendedRecircRatio =
    wettingRate >= targetWettingRate ? 1.0 : Math.ceil((targetWettingRate / wettingRate) * 10) / 10;

  // Apply recirculation if enabled via inputs
  const recircRatio = inputs.brineRecirculation
    ? (inputs.brineRecirculationRatio ?? recommendedRecircRatio)
    : 1.0;
  const wettingRateWithRecirc = wettingRate * recircRatio;
  const effectiveWettingRate = wettingRateWithRecirc;
  const wettingRatio = effectiveWettingRate / minimumWettingRate;

  let wettingStatus: 'excellent' | 'good' | 'marginal' | 'poor';
  if (wettingRatio >= 2.0) wettingStatus = 'excellent';
  else if (wettingRatio >= 1.5) wettingStatus = 'good';
  else if (wettingRatio >= 1.0) wettingStatus = 'marginal';
  else {
    wettingStatus = 'poor';
    warnings.push(
      `Effect ${effect.effectNumber}: Wetting rate (${effectiveWettingRate.toFixed(4)} kg/(m·s)) below minimum (${minimumWettingRate}). ${inputs.brineRecirculation ? 'Increase recirculation ratio.' : 'Enable brine recirculation.'}`
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

/**
 * Size the final condenser (shell & tube, seawater on tube side).
 */
function sizeFinalCondenser(
  condenser: MEDFinalCondenserResult,
  inputs: MEDPlantInputs
): CondenserSizingResult {
  const warnings: string[] = [];
  const tubeSpec = inputs.condenserTubes;

  const heatDuty = condenser.heatTransferred; // kW

  // LMTD — counter-current: vapor condensing (isothermal) vs seawater heating
  const vaporTemp = condenser.vaporIn.temperature;
  const swInTemp = inputs.seawaterInletTemp;
  const swOutTemp = inputs.seawaterDischargeTemp;

  const lmtdResult = calculateLMTD({
    hotInlet: vaporTemp,
    hotOutlet: vaporTemp, // isothermal condensation
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

  // ---- Tube-side HTC (seawater forced convection) ----
  // Simplified Dittus-Boelter for seawater in tubes
  const avgSwTemp = (swInTemp + swOutTemp) / 2;
  const swDensity = getSeawaterDensity(inputs.seawaterSalinity, avgSwTemp);
  const swViscosity = getSeawaterViscosity(inputs.seawaterSalinity, avgSwTemp);
  const swConductivity = getSeawaterThermalConductivity(inputs.seawaterSalinity, avgSwTemp);
  const swCp = getSeawaterSpecificHeat(inputs.seawaterSalinity, avgSwTemp); // kJ/(kg·K)

  const tubeID = (tubeSpec.od - 2 * tubeSpec.thickness) / 1000; // m
  // Assume design velocity ~1.8 m/s for seawater in condenser tubes
  const designVelocity = 1.8;
  const Re = (swDensity * designVelocity * tubeID) / swViscosity;
  const Pr = (swCp * 1000 * swViscosity) / swConductivity;
  const Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.4); // Dittus-Boelter (heating)
  const tubeSideHTC = (Nu * swConductivity) / tubeID;

  // ---- Shell-side HTC (vapor condensation on tube bundle) ----
  const condensationResult = calculateNusseltCondensation({
    liquidDensity: getDensityLiquid(vaporTemp),
    vaporDensity: Math.max(getDensityVapor(vaporTemp), 0.02),
    latentHeat: getLatentHeat(vaporTemp) * 1000,
    liquidConductivity: getThermalConductivityLiquid(vaporTemp),
    liquidViscosity: getViscosityLiquid(vaporTemp),
    dimension: tubeSpec.od / 1000,
    deltaT: Math.max(vaporTemp - avgSwTemp, 1),
    orientation: 'horizontal',
  });
  const shellSideHTC = condensationResult.htc;

  // ---- Overall HTC ----
  const tubeWallConductivity = MED_TUBE_CONDUCTIVITY[tubeSpec.material] ?? 15;
  const overallResult = calculateOverallHTC({
    tubeSideHTC,
    shellSideHTC,
    tubeOD: tubeSpec.od / 1000,
    tubeID,
    tubeWallConductivity,
    tubeSideFouling: DEFAULT_FOULING_SEAWATER,
    shellSideFouling: DEFAULT_FOULING_DISTILLATE,
  });
  const overallHTC = overallResult.overallHTC;

  // ---- Area ----
  const requiredArea = calculateHeatExchangerArea(heatDuty, overallHTC, lmtd);
  const designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);

  // ---- Tube count ----
  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length;
  const rawTubeCount = Math.ceil(designArea / tubeOuterArea);
  // Round up to nearest multiple of tube passes
  const tubeCount = Math.ceil(rawTubeCount / CONDENSER_TUBE_PASSES) * CONDENSER_TUBE_PASSES;

  // ---- Bundle & shell diameter ----
  const bundleDiameter = tubeSpec.od * Math.pow(tubeCount / K1_TRIANGULAR, 1 / N1_TRIANGULAR);
  const shellID = bundleDiameter + 20; // mm (clearance)

  // ---- Tube velocity check ----
  const flowAreaPerPass = (tubeCount / CONDENSER_TUBE_PASSES) * (Math.PI / 4) * tubeID * tubeID; // m²
  const swMassFlow = condenser.seawaterIn.flow / 3600; // kg/s
  const tubeVelocity = swMassFlow / (swDensity * flowAreaPerPass);

  if (tubeVelocity > 2.5) {
    warnings.push(
      `Condenser: Tube velocity (${tubeVelocity.toFixed(2)} m/s) exceeds 2.5 m/s. Consider more tubes or larger OD.`
    );
  }
  if (tubeVelocity < 1.0) {
    warnings.push(
      `Condenser: Tube velocity (${tubeVelocity.toFixed(2)} m/s) below 1.0 m/s. Risk of fouling.`
    );
  }

  // ---- Rognoni reference comparisons ----
  const rognoniCondU = ROGNONI_REFERENCE.condenserOverallHTC;
  const rognoniCondArea = calculateHeatExchangerArea(heatDuty, rognoniCondU, lmtd);
  const rognoniCondDesignArea = rognoniCondArea * (1 + ROGNONI_REFERENCE.designMargin);

  const rognoniComparisons: RognoniComparison[] = [
    rognoniCompare('Overall U', overallHTC, rognoniCondU, 'W/(m²·K)'),
    rognoniCompare('Required Area', requiredArea, rognoniCondArea, 'm²'),
    rognoniCompare('Design Area', designArea, rognoniCondDesignArea, 'm²'),
    rognoniCompare('Tube Velocity', tubeVelocity, ROGNONI_REFERENCE.condenserTubeVelocity, 'm/s'),
  ];

  return {
    heatDuty: Math.round(heatDuty * 10) / 10,
    lmtd: Math.round(lmtd * 100) / 100,
    tubeSideHTC: Math.round(tubeSideHTC),
    shellSideHTC: Math.round(shellSideHTC),
    overallHTC: Math.round(overallHTC * 10) / 10,
    requiredArea: Math.round(requiredArea * 100) / 100,
    designArea: Math.round(designArea * 100) / 100,
    tubeCount,
    tubeOD: tubeSpec.od,
    tubeLength: tubeSpec.length,
    tubeMaterial: tubeSpec.material,
    bundleDiameter: Math.round(bundleDiameter),
    shellID: Math.round(shellID),
    tubeVelocity: Math.round(tubeVelocity * 100) / 100,
    rognoniComparisons,
    warnings,
  };
}

// ============================================================================
// Preheater Sizing
// ============================================================================

/**
 * Size a preheater (shell & tube, vapor on shell side, seawater on tube side).
 */
function sizePreheater(
  preheater: MEDPreheaterResult,
  inputs: MEDPlantInputs
): PreheaterSizingResult {
  const warnings: string[] = [];
  // Preheaters use condenser tube spec (smaller tubes)
  const tubeSpec = inputs.condenserTubes;

  const heatDuty = preheater.heatExchanged; // kW
  const lmtd = preheater.lmtd;

  if (lmtd <= 0) {
    warnings.push(`Preheater on effect ${preheater.effectNumber}: LMTD ≤ 0.`);
    return emptyPreheaterResult(preheater.effectNumber, warnings);
  }

  // Typical preheater overall HTC: 2000–3000 W/(m²·K)
  // (condensing vapor shell side + forced convection tube side)
  const overallHTC = 2500; // W/(m²·K) — conservative estimate

  const requiredArea = calculateHeatExchangerArea(heatDuty, overallHTC, lmtd);
  const designArea = requiredArea * (1 + AREA_DESIGN_MARGIN);

  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length;
  const tubeCount = Math.ceil(designArea / tubeOuterArea);

  return {
    effectNumber: preheater.effectNumber,
    heatDuty: Math.round(heatDuty * 10) / 10,
    lmtd: Math.round(lmtd * 100) / 100,
    overallHTC,
    requiredArea: Math.round(requiredArea * 100) / 100,
    designArea: Math.round(designArea * 100) / 100,
    tubeCount,
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
    overallHTC: 0,
    requiredArea: 0,
    designArea: 0,
    tubeCount: 0,
    tubeOD: 0,
    tubeLength: 0,
    warnings,
  };
}
