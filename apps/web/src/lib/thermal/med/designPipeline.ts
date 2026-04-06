/**
 * MED Design Pipeline — Unified Orchestrator
 *
 * Replaces the monolithic designMED() function with a pipeline that uses
 * the core solver as the single source of thermodynamic truth.
 *
 * Pipeline steps:
 * 1. Resolve defaults from MEDDesignerInput
 * 2. Scenario analysis (lightweight, no full solver)
 * 3. GOR configuration matrix
 * 4. Convert to core solver inputs
 * 5. Solve H&M balance (solveMEDPlant — the source of truth)
 * 6. Equipment sizing
 * 7. Compose designer effect records (H&M + sizing + geometry)
 * 8. Auxiliary equipment
 * 9. Optional analyses (geometry comparison, weight, turndown)
 * 10. Assemble final MEDDesignerResult
 */

import { getBoilingPointElevation, getLatentHeat, getSeawaterDensity } from '@vapour/constants';
import type {
  MEDDesignerInput,
  MEDDesignerResult,
  MEDDesignOption,
  MEDScenarioRow,
} from './designerTypes';
import { resolveDesignerDefaults, toMEDPlantInputs } from './inputAdapter';
import {
  composeDesignerEffects,
  composeDesignerCondenser,
  composeDesignerPreheaters,
} from './resultAdapter';
import { calculateMED, type MEDEngineInput } from './medEngine';
import { sizeEquipment } from './equipmentSizing';
import { estimateU, findMinShellID, countLateralTubes } from './shellGeometry';
import { computeGORConfigurations } from './gorAnalysis';
import { computeGeometryComparisons } from './geometryComparison';
import { computePreheaterContributions } from './preheaterAnalysis';
import {
  computeAuxiliaryEquipment,
  computeDosing,
  computeVacuumSystem,
} from './auxiliaryEquipment';
import { computeTurndownAnalysis } from './turndownAnalysis';
import { estimatePlantWeight } from './weightEstimation';

// ============================================================================
// Scenario Analysis (lightweight, no full solver)
// ============================================================================

/**
 * Quick scenario comparison for 3-12 effects.
 * Uses simplified estimates — not a full H&M solve.
 */
function computeScenarios(
  input: MEDDesignerInput,
  totalRangeDT: number,
  avgLossPerEffect: number,
  avgTemp: number,
  tubeOD: number,
  tubeWall: number,
  kWall: number,
  pitch: number,
  maxTubeLength: number,
  designMargin: number,
  VENT_LOSS_FRACTION: number
): MEDScenarioRow[] {
  const Q1 = (input.steamFlow * 1000 * getLatentHeat(input.steamTemperature)) / 3600;
  const areaPerTubePerM = Math.PI * (tubeOD / 1000);
  const scenarios: MEDScenarioRow[] = [];

  for (let n = 3; n <= 12; n++) {
    const totalWorkDT = totalRangeDT - n * avgLossPerEffect;
    if (totalWorkDT <= 0) {
      scenarios.push({
        effects: n,
        totalWorkingDT: totalWorkDT,
        workingDTPerEffect: 0,
        requiredAreaPerEffect: Infinity,
        availableArea: 0,
        areaMargin: -100,
        achievableGOR: 0,
        distillate: 0,
        feasible: false,
      });
      continue;
    }

    const workDTPerEff = totalWorkDT / n;
    const avgU = estimateU(avgTemp, tubeOD, tubeWall, kWall);
    const reqAreaPerEff = ((Q1 * 1000) / (avgU * workDTPerEff)) * (1 + designMargin);
    const tubesNeeded = Math.ceil(reqAreaPerEff / (areaPerTubePerM * maxTubeLength));
    const requiredShellID = findMinShellID(tubesNeeded, tubeOD, pitch, false);
    const availableArea =
      countLateralTubes(requiredShellID, tubeOD, pitch, false) * areaPerTubePerM * maxTubeLength;
    const gorRaw = n * (1 - VENT_LOSS_FRACTION * n);
    const achievableGOR = Math.max(0, gorRaw);
    const distillate = input.steamFlow * achievableGOR;

    scenarios.push({
      effects: n,
      totalWorkingDT: totalWorkDT,
      workingDTPerEffect: workDTPerEff,
      requiredAreaPerEffect: reqAreaPerEff,
      availableArea,
      areaMargin: availableArea > 0 ? (availableArea / reqAreaPerEff - 1) * 100 : -100,
      achievableGOR,
      distillate,
      feasible: totalWorkDT > 0,
    });
  }

  return scenarios;
}

// ============================================================================
// Main Pipeline
// ============================================================================

const VENT_LOSS_FRACTION = 0.015;

/**
 * Design a complete MED plant using the unified pipeline.
 *
 * This function produces the exact same MEDDesignerResult shape as the
 * old designMED(), but uses the core solver for the H&M balance instead
 * of reimplementing it.
 */
export function designMEDPlant(input: MEDDesignerInput): MEDDesignerResult {
  const warnings: string[] = [];

  // ── 1. Preliminary scenario analysis ────────────────────────────────
  const swSalinity = input.seawaterSalinity ?? 35000;
  const maxBrineSalinity = input.maxBrineSalinity ?? 65000;
  const condenserApproach = input.condenserApproach ?? 4;
  const condenserSWOutlet = input.condenserSWOutlet ?? input.seawaterTemperature + 5;
  const tubeOD = input.tubeOD ?? 25.4;
  const tubeWall = input.tubeWallThickness ?? 1.0;
  const kWall = input.tubeConductivity ?? 138;
  const pitch = input.tubePitch ?? 33.4;
  const availableLengths = input.availableTubeLengths ?? [0.8, 1.0, 1.2, 1.5];
  const designMargin = input.designMargin ?? 0.15;
  const NEA = input.NEA ?? 0.25;
  const demLoss = input.demisterLoss ?? 0.15;
  const pdLoss = input.pressureDropLoss ?? 0.3;

  const lastEffectVapourT = condenserSWOutlet + condenserApproach;
  const totalRangeDT = input.steamTemperature - lastEffectVapourT;
  const avgBrineS = (swSalinity + maxBrineSalinity) / 2;
  const avgTemp = (input.steamTemperature + lastEffectVapourT) / 2;
  const maxTubeLength = Math.max(...availableLengths);

  if (totalRangeDT <= 0) {
    throw new Error(
      `No temperature driving force: steam temperature (${input.steamTemperature.toFixed(1)}°C) must be > last effect vapour (${lastEffectVapourT.toFixed(1)}°C)`
    );
  }

  const avgBPE = getBoilingPointElevation(avgBrineS, avgTemp);
  const avgLossPerEffect = avgBPE + NEA + demLoss + pdLoss;

  const scenarios = computeScenarios(
    input,
    totalRangeDT,
    avgLossPerEffect,
    avgTemp,
    tubeOD,
    tubeWall,
    kWall,
    pitch,
    maxTubeLength,
    designMargin,
    VENT_LOSS_FRACTION
  );

  // ── 2. Resolve all defaults ─────────────────────────────────────────
  const resolved = resolveDesignerDefaults(input, scenarios);
  const nEff = resolved.nEff;

  // ── 3. GOR configuration matrix ────────────────────────────────────
  const gorConfigurations = computeGORConfigurations(
    input.steamFlow,
    input.steamTemperature,
    lastEffectVapourT,
    maxBrineSalinity,
    swSalinity,
    condenserSWOutlet,
    input.targetGOR,
    avgLossPerEffect,
    NEA,
    demLoss,
    pdLoss
  );

  // ── 4. Build engine input ─────────────────────────────────────────
  const preheaterEffects: number[] = [];
  const nPreheaters = input.numberOfPreheaters ?? 0;
  if (nPreheaters > 0) {
    // Distribute preheaters evenly across effects (e.g., 2 PH on 6 eff → E3, E5)
    const step = Math.max(1, Math.floor((nEff - 2) / nPreheaters));
    for (let p = 0; p < nPreheaters && 2 + p * step <= nEff - 1; p++) {
      preheaterEffects.push(2 + p * step);
    }
  }

  const engineInput: MEDEngineInput = {
    steamFlow: input.steamFlow * 1000, // T/h → kg/hr
    steamTemperature: input.steamTemperature,
    numberOfEffects: nEff,
    seawaterInletTemp: input.seawaterTemperature,
    seawaterSalinity: swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserOutletTemp: condenserSWOutlet,
    ...(preheaterEffects.length > 0 && { preheaterEffects }),
    nea: NEA,
    demisterLoss: demLoss,
    ductLoss: pdLoss,
    foulingResistance: 0.00015,
    evapTubeOD: tubeOD,
    evapTubeWall: tubeWall,
    evapTubeLength: (resolved.resolvedDefaults.tubeLength as number) ?? maxTubeLength,
    evapTubeMaterial: ((resolved.resolvedDefaults.tubeMaterial as string) ??
      'titanium') as MEDEngineInput['evapTubeMaterial'],
    // TVC support will be added when designer supports MED-TVC mode
  };

  // ── 5. Solve H&M balance (new engine) ───────────────────────────────
  let engineResult;
  try {
    engineResult = calculateMED(engineInput);
    if (engineResult.warnings.length > 0) {
      warnings.push(...engineResult.warnings);
    }
  } catch (err) {
    throw new Error(`Core engine failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Build MEDPlantResult-shaped object for downstream stages (sizing, adapters)
  const hmResult = {
    inputs: toMEDPlantInputs(resolved),
    effects: engineResult.effects,
    finalCondenser: engineResult.finalCondenser,
    preheaters: engineResult.preheaters.map((ph) => ({
      effectNumber: ph.effectNumber,
      vaporFlow: ph.vaporFlow,
      vaporTemperature: ph.vaporTemp,
      seawaterFlow: ph.duty > 0 ? (engineInput.steamFlow * nEff) / nEff : 0,
      seawaterInletTemp: ph.swInletTemp,
      seawaterOutletTemp: ph.swOutletTemp,
      heatExchanged: ph.duty,
      lmtd: ph.lmtd,
      condensateFlow: ph.condensateFlow,
      condensateTemperature: ph.condensateTemp,
    })),
    tvcResult: engineResult.tvc
      ? {
          motiveFlow: engineResult.tvc.motiveFlow,
          entrainedFlow: engineResult.tvc.entrainedFlow,
          dischargeFlow: engineResult.tvc.dischargeFlow,
          entrainmentRatio: engineResult.tvc.entrainmentRatio,
          compressionRatio: engineResult.tvc.compressionRatio,
          isSuperheated: engineResult.tvc.isSuperheated,
          sprayWaterFlow: 0,
          vaporToEffect1Temp: engineResult.tvc.vaporToEffect1Temp,
        }
      : undefined,
    overallBalance: {
      totalSteamFlow: engineInput.steamFlow,
      totalDistillateFlow: engineResult.performance.netDistillate,
      totalBrineFlow: engineResult.performance.brineBlowdown,
      totalSeawaterFlow: engineResult.performance.seawaterIntake,
      totalFeedFlow: engineResult.performance.totalFeedWater,
    } as unknown as import('@vapour/types').MEDOverallBalance,
    performance: {
      gor: engineResult.performance.gor,
      specificThermalEnergy: engineResult.performance.specificThermalEnergy,
      specificThermalEnergy_kWh: engineResult.performance.specificThermalEnergy_kWh,
      grossProduction: engineResult.performance.netDistillate / 1000, // kg/hr → T/h
      netProduction: engineResult.performance.netDistillate / 1000,
      steamFlow: engineInput.steamFlow,
      motiveFlow: engineResult.tvc?.motiveFlow ?? 0,
      seawaterIntake: engineResult.performance.seawaterIntake / 1000,
      coolingWater: engineResult.performance.coolingWater / 1000,
      makeupWater: engineResult.performance.totalFeedWater / 1000,
      brineFlow: engineResult.performance.brineBlowdown / 1000,
      brineSalinity: engineResult.performance.brineSalinity,
      overdesign: 0,
    },
    warnings: engineResult.warnings,
    converged: engineResult.converged,
    iterations: engineResult.iterations,
  };

  const solverInputs = hmResult.inputs;

  // ── 6. Equipment sizing ─────────────────────────────────────────────
  // Use the engine's built-in sizing if available, otherwise compute
  const sizing =
    engineResult.equipmentSizing ??
    sizeEquipment(hmResult.effects, hmResult.finalCondenser, hmResult.preheaters, solverInputs);
  if (sizing.warnings.length > 0) {
    warnings.push(...sizing.warnings);
  }

  // ── 7. Compose designer effect records ──────────────────────────────
  const effects = composeDesignerEffects(hmResult, sizing, resolved);
  const condenser = composeDesignerCondenser(hmResult, sizing, resolved);
  const preheaters = composeDesignerPreheaters(hmResult, sizing, resolved);

  // ── 8. Compute summary values ───────────────────────────────────────
  const totalDistillate = hmResult.performance.netProduction; // T/h
  const totalDistillateM3Day = totalDistillate * 24; // approximate (density ≈ 1)
  const achievedGOR = hmResult.performance.gor;
  const totalArea = effects.reduce((sum, e) => sum + e.installedArea, 0);
  const totalRecirc = effects.reduce((sum, e) => sum + e.brineRecirculation, 0);
  const makeUpFeed = (totalDistillate * maxBrineSalinity) / (maxBrineSalinity - swSalinity);
  const brineBlowdown = makeUpFeed - totalDistillate;
  const spraySalinity =
    totalRecirc > 0
      ? (makeUpFeed * swSalinity + totalRecirc * maxBrineSalinity) / (makeUpFeed + totalRecirc)
      : swSalinity;
  const shellThkMM = resolved.shellThkMM;
  const largestShellOD = Math.max(...effects.map((e) => e.shellODmm));
  const largestShellID = largestShellOD - 2 * shellThkMM;

  if (largestShellID < 1800) {
    warnings.push(
      `Largest shell ID is ${largestShellID} mm (< 1,800 mm). A person cannot enter for tube maintenance.`
    );
  }

  // ── 9. Auxiliary equipment ──────────────────────────────────────────
  const swDensity = getSeawaterDensity(swSalinity, input.seawaterTemperature);
  const auxiliaryEquipment = computeAuxiliaryEquipment(effects, condenser, {
    swSalinity,
    maxBrineSalinity,
    spraySalinity,
    shellID: largestShellID,
    nEff,
    totalDistillate,
    makeUpFeed,
    brineBlowdown,
    totalRecirc,
    steamFlow: input.steamFlow,
    swTemp: input.seawaterTemperature,
    condenserSWFlowM3h: condenser.seawaterFlowM3h,
  });
  if (auxiliaryEquipment.auxWarnings.length > 0) {
    warnings.push(...auxiliaryEquipment.auxWarnings);
  }

  const dosing = computeDosing(makeUpFeed, swDensity, input.antiscalantDoseMgL ?? 2);

  const vacuumSystem = computeVacuumSystem(
    effects[nEff - 1]!.pressure,
    effects[nEff - 1]!.vapourOutTemp,
    makeUpFeed / (swDensity / 1000),
    input.seawaterTemperature,
    swSalinity / 1000,
    effects.reduce((sum, e) => {
      const shellR = (e.shellODmm - 2 * shellThkMM) / 2000;
      const shellL = e.shellLengthMM / 1000;
      return sum + Math.PI * shellR * shellR * shellL;
    }, 0),
    input.vacuumTrainConfig ??
      (nEff <= 4 ? 'single_ejector' : nEff <= 8 ? 'two_stage_ejector' : 'hybrid')
  );

  // ── 10. Optional analyses ───────────────────────────────────────────
  const result: MEDDesignerResult = {
    inputs: { ...input, resolvedDefaults: resolved.resolvedDefaults },
    gorConfigurations,
    scenarios,
    recommendedEffects: nEff,
    effects,
    condenser,
    preheaters,
    totalDistillate,
    totalDistillateM3Day,
    achievedGOR,
    totalEvaporatorArea: totalArea,
    totalBrineRecirculation: totalRecirc,
    makeUpFeed,
    brineBlowdown,
    spraySalinity,
    numberOfShells: nEff,
    auxiliaryEquipment,
    dosing: dosing ?? undefined,
    vacuumSystem: vacuumSystem ?? undefined,
    swReject: condenser.seawaterFlow - makeUpFeed,
    overallDimensions: {
      totalLengthMM: effects.reduce((sum, e) => sum + e.shellLengthMM, 0) + (nEff - 1) * 500,
      shellODmm: largestShellOD,
      shellLengthRange: {
        min: Math.min(...effects.map((e) => e.shellLengthMM)),
        max: Math.max(...effects.map((e) => e.shellLengthMM)),
      },
    },
    warnings,
  };

  // Geometry comparisons
  try {
    const areaPerTubePerM = Math.PI * (resolved.tubeOD / 1000);
    const Q1 = (input.steamFlow * 1000 * getLatentHeat(input.steamTemperature)) / 3600;
    result.geometryComparisons = computeGeometryComparisons(
      effects,
      nEff,
      resolved.tubeOD,
      resolved.pitch,
      resolved.tubeSheetAccessMM,
      resolved.shellThkMM,
      resolved.kWall,
      resolved.designMargin,
      Q1,
      resolved.availableLengths,
      areaPerTubePerM,
      input.seawaterTemperature,
      swSalinity,
      maxBrineSalinity
    );
  } catch {
    warnings.push('Geometry comparison failed.');
  }

  // Preheater contributions
  if (preheaters.length > 0) {
    result.preheaterContributions = computePreheaterContributions(
      preheaters,
      effects,
      input.steamFlow,
      condenserSWOutlet
    );
  }

  // Turndown analysis
  if (input.includeTurndown) {
    try {
      result.turndownAnalysis = computeTurndownAnalysis(input, result);
    } catch {
      warnings.push('Turndown analysis failed.');
    }
  }

  // Weight estimation
  try {
    const weight = estimatePlantWeight(result);
    // Weight is informational — stored in design options, not in main result
    // The BOM generator accesses it via generateDesignOptions
    void weight; // consumed by generateDesignOptions
  } catch {
    // Weight estimation is non-critical
  }

  return result;
}

// ============================================================================
// Design Options Generator
// ============================================================================

/**
 * Generate multiple design options for comparison across 3-10 effects.
 */
export function generateDesignOptionsPipeline(input: MEDDesignerInput): MEDDesignOption[] {
  const options: MEDDesignOption[] = [];

  for (let n = 3; n <= 10; n++) {
    try {
      const result = designMEDPlant({ ...input, numberOfEffects: n, includeTurndown: false });

      if (!result.achievedGOR || result.achievedGOR <= 0) continue;
      if (!result.totalDistillate || result.totalDistillate <= 0) continue;

      const distM3Day = result.totalDistillate * 24;
      const hfg = getLatentHeat(input.steamTemperature);
      const steKjKg = hfg / result.achievedGOR;
      const steKwhM3 = (steKjKg * 1000) / 3600;

      let label: string;
      if (result.achievedGOR >= input.targetGOR * 0.9) label = `Option — High GOR (${n} effects)`;
      else if (result.achievedGOR >= input.targetGOR * 0.7)
        label = `Option — Balanced (${n} effects)`;
      else label = `Option — Compact (${n} effects)`;

      const weight = estimatePlantWeight(result);

      options.push({
        effects: n,
        gor: result.achievedGOR,
        distillateM3Day: distM3Day,
        totalEvaporatorArea: result.totalEvaporatorArea,
        totalShells: n,
        condenserArea: result.condenser.designArea,
        totalPreheaterArea: result.preheaters.reduce((s, p) => s + p.designArea, 0),
        totalBrineRecirculation: result.totalBrineRecirculation,
        specificEnergy: steKwhM3,
        largestShellID:
          Math.max(...result.effects.map((e) => e.shellODmm)) - 2 * (input.shellThickness ?? 8),
        trainLengthMM: result.overallDimensions.totalLengthMM,
        weight,
        feasible: result.achievedGOR > 0 && result.totalDistillate > 0,
        label,
        detail: result,
      });
    } catch {
      // Skip configurations that fail
    }
  }

  return options.sort((a, b) => a.gor - b.gor);
}
