/**
 * MED Plant Designer — Integrated Multi-Effect Distillation Calculator
 *
 * Designs a complete MED plant from minimal inputs:
 *   Required: vapour flow, vapour temperature, seawater temperature, target GOR
 *   Everything else: auto-calculated with sensible defaults, user-overridable
 *
 * Uses validated correlations from Sharqawy (2010), El-Dessouky & Ettouney (2002),
 * calibrated against Campiche, CADAFE, BARC, and Case 6 as-built data.
 */

import {
  getBoilingPointElevation,
  getLatentHeat,
  getSeawaterDensity,
  getSeawaterSpecificHeat,
  getSeawaterViscosity,
  getSeawaterThermalConductivity,
  getDensityVapor,
  getDensityLiquid,
} from '@vapour/constants';

import { calculateTubeSideHTC, calculateNusseltCondensation } from './heatTransfer';
import {
  satPressureMbar,
  estimateU,
  findMinShellID,
  countLateralTubes,
  getMaxTubesPerRow,
} from './med/shellGeometry';
import { computeGORConfigurations } from './med/gorAnalysis';
import { computeGeometryComparisons } from './med/geometryComparison';
import { computePreheaterContributions } from './med/preheaterAnalysis';
import {
  computeAuxiliaryEquipment,
  computeDosing,
  computeVacuumSystem,
} from './med/auxiliaryEquipment';
import { computeTurndownAnalysis } from './med/turndownAnalysis';
import { estimatePlantWeight } from './med/weightEstimation';

// ============================================================================
// Types — re-exported from dedicated types file
// ============================================================================

export type {
  MEDDesignerInput,
  MEDDesignerEffect,
  MEDDesignerCondenser,
  MEDDesignerPreheater,
  PassOption,
  MEDDemisterResult,
  MEDSprayNozzleResult,
  MEDSiphonResult,
  MEDLineSizing,
  MEDPumpResult,
  MEDShellNozzle,
  MEDNozzleSchedule,
  MEDDosingResult,
  MEDVacuumResult,
  MEDCostItem,
  MEDCostEstimate,
  MEDTurndownPoint,
  MEDTurndownAnalysis,
  GeometryComparisonEffect,
  GeometryComparisonOption,
  PreheaterContribution,
  MEDAuxiliaryEquipment,
  ShellWeight,
  MEDWeightEstimate,
  MEDDesignOption,
  MEDScenarioRow,
  GORConfigRow,
  MEDDesignerResult,
  // Backward-compatible aliases
  MEDEffectResult,
  MEDCondenserResult,
  MEDPreheaterResult,
} from './med/designerTypes';

import type {
  MEDDesignerInput,
  MEDDesignerEffect as MEDEffectResult,
  MEDDesignerCondenser as MEDCondenserResult,
  MEDDesignerPreheater as MEDPreheaterResult,
  PassOption,
  MEDDesignOption,
  MEDScenarioRow,
  MEDDesignerResult,
} from './med/designerTypes';

// ============================================================================
// Constants
// ============================================================================

const VENT_LOSS_FRACTION = 0.015; // 1.5% vapour loss per effect (vent/NCG)

/** Default condenser U-value by tube material name */
/**
 * Calculate condenser/preheater U-value from first principles.
 *
 * Includes:
 * - Tube-side: Dittus-Boelter (seawater heating)
 * - Shell-side: Nusselt horizontal tube condensation
 * - Kern bundle row correction (condensate dripping from upper rows)
 * - NCG degradation (mass transfer resistance from non-condensable gas layer)
 * - OD/ID area correction
 * - Fouling on both sides
 *
 * Validated against BARC (1800-1900), Campiche (2082), CADAFE condensers.
 *
 * @param tubeVelocity  Tube-side velocity in m/s
 * @param swTempAvg     Average seawater temperature in tube side °C
 * @param condTempC     Condensation temperature (shell side) °C
 * @param tubeODmm      Tube OD in mm
 * @param tubeIDmm      Tube ID in mm
 * @param wallThkMM     Wall thickness in mm
 * @param kWall         Wall thermal conductivity W/(m·K)
 * @param nTubeRows     Number of tube rows in the bundle (for Kern correction)
 * @param ncgFraction   NCG degradation factor (0.15 for condenser, 0.05 for preheater)
 * @param foulingTube   Tube-side fouling m²·K/W (default 0.00018 for seawater)
 * @param foulingShell  Shell-side fouling m²·K/W (default 0.0001 for condensate)
 */
function calculateCondenserU(
  tubeVelocity: number,
  swTempAvg: number,
  condTempC: number,
  tubeODmm: number,
  tubeIDmm: number,
  wallThkMM: number,
  kWall: number,
  nTubeRows: number = 10,
  ncgFraction: number = 0.15,
  foulingTube: number = 0.00018,
  foulingShell: number = 0.0001
): number {
  const odID = tubeODmm / tubeIDmm;

  // ── Tube-side HTC (Dittus-Boelter) ──
  const rho = getSeawaterDensity(35000, swTempAvg);
  const mu = getSeawaterViscosity(35000, swTempAvg);
  const Cp = getSeawaterSpecificHeat(35000, swTempAvg) * 1000; // kJ→J
  const k_sw = getSeawaterThermalConductivity(35000, swTempAvg);
  const Re = (rho * tubeVelocity * (tubeIDmm / 1000)) / mu;
  const Pr = (mu * Cp) / k_sw;
  const Nu = Re > 2300 ? 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.4) : 4.36; // turbulent or laminar
  const hTube = (Nu * k_sw) / (tubeIDmm / 1000);

  // ── Shell-side HTC (Nusselt condensation) ──
  const rhoL = getDensityLiquid(condTempC);
  const rhoV = getDensityVapor(condTempC);
  const muL = 0.001 * Math.exp(-0.02 * (condTempC - 20)); // simplified viscosity
  const kL = 0.57 + 0.0018 * condTempC; // simplified conductivity
  const hfg = getLatentHeat(condTempC) * 1000; // kJ→J
  const dTfilm = 2; // °C assumed film temperature drop

  const hCondSingle =
    0.725 *
    Math.pow(
      (rhoL * (rhoL - rhoV) * 9.81 * hfg * Math.pow(kL, 3)) / (muL * (tubeODmm / 1000) * dTfilm),
      0.25
    );

  // Kern bundle row correction: h_bundle = h_single × N^(-1/6)
  const kernFactor = Math.pow(Math.max(nTubeRows, 1), -1 / 6);

  // NCG degradation: reduces effective condensation HTC
  const ncgDegradation = 1 - ncgFraction;

  const hCondEffective = hCondSingle * kernFactor * ncgDegradation;

  // ── Wall resistance ──
  const Rwall = wallThkMM / 1000 / kWall;

  // ── Overall U (referenced to OD) ──
  const Rtotal =
    1 / hCondEffective + // shell-side condensation
    foulingShell + // shell fouling
    Rwall + // tube wall
    foulingTube * odID + // tube fouling (corrected to OD)
    (1 / hTube) * odID; // tube-side (corrected to OD)

  return 1 / Rtotal;
}

/** Default condenser U-value — uses first-principles calculation */
function getDefaultCondenserU(
  _materialName: string,
  velocity: number = 1.5,
  condTemp: number = 39
): number {
  return Math.round(
    calculateCondenserU(
      velocity,
      32.5,
      condTemp,
      17,
      16.2,
      0.4,
      22, // Ti 17mm × 0.4mm
      10, // 10 tube rows in condenser bundle
      0.15 // 15% NCG degradation (accumulated NCG from all effects)
    )
  );
}

/** Default preheater U-value — uses first-principles calculation */
function getDefaultPreheaterU(
  _materialName: string,
  velocity: number = 1.5,
  condTemp: number = 48
): number {
  return Math.round(
    calculateCondenserU(
      velocity,
      42,
      condTemp,
      17,
      16.2,
      0.4,
      22, // Ti 17mm × 0.4mm
      6, // fewer tube rows in preheater
      0.05 // 5% NCG degradation (single effect NCG only)
    )
  );
}

/** Material cost rates in USD/kg for budgetary estimation */
// MATERIAL_COST_RATES moved to ./med/weightEstimation.ts
export { MATERIAL_COST_RATES } from './med/weightEstimation';

// Shell geometry functions (satPressureMbar, estimateU, findMinShellID,
// countLateralTubes, getMaxTubesPerRow) extracted to ./med/shellGeometry.ts

// ============================================================================
// Main Designer
// ============================================================================

export function designMED(input: MEDDesignerInput): MEDDesignerResult {
  const warnings: string[] = [];

  // ── Resolve defaults ─────────────────────────────────────────────────
  const swSalinity = input.seawaterSalinity ?? 35000;
  const maxBrineSalinity = input.maxBrineSalinity ?? 65000;
  const condenserApproach = input.condenserApproach ?? 4;
  const condenserSWOutlet = input.condenserSWOutlet ?? input.seawaterTemperature + 5;
  const shellID = input.shellID ?? 1800;
  const tubeOD = input.tubeOD ?? 25.4;
  const tubeWall = input.tubeWallThickness ?? 1.0;
  const kWall = input.tubeConductivity ?? 138;
  const tubeMaterialName = input.tubeMaterialName ?? 'Al 5052';
  const pitch = input.tubePitch ?? 33.4;
  const availableLengths = input.availableTubeLengths ?? [0.8, 1.0, 1.2, 1.5];
  const designMargin = input.designMargin ?? 0.15;
  const NEA = input.NEA ?? 0.25;
  const demLoss = input.demisterLoss ?? 0.15;
  const pdLoss = input.pressureDropLoss ?? 0.3;
  const minGamma = input.minimumWettingRate ?? 0.035;
  const includeRecirc = input.includeBrineRecirculation ?? true;
  const shellThkMM = input.shellThickness ?? 8;
  const tubeSheetThkMM = input.tubeSheetThickness ?? 8;
  const tubeSheetAccessMM = input.tubeSheetAccess ?? 750;

  const resolvedDefaults: Record<string, number | string | boolean> = {
    seawaterSalinity: swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserSWOutlet,
    shellID: shellID, // user input (may be overridden by auto-calc)
    tubeOD,
    tubeWallThickness: tubeWall,
    tubeConductivity: kWall,
    tubeMaterialName,
    tubePitch: pitch,
    designMargin,
    NEA,
    demisterLoss: demLoss,
    pressureDropLoss: pdLoss,
  };

  // ── Derived values ───────────────────────────────────────────────────
  // TBT is NOT a fixed approach from steam temperature.
  // The total ΔT from steam to condenser is distributed across all effects.
  // Each effect loses BPE + NEA + demister + duct losses from the vapour.
  // TBT = steam_temp - (total_loss_per_effect) where the working ΔT for E1
  // equals the working ΔT for all other effects (even distribution).
  const lastEffectVapourT = condenserSWOutlet + condenserApproach;
  // Total range: steam temp → last effect vapour (before BPE/NEA distribution)
  const totalRangeDT = input.steamTemperature - lastEffectVapourT;
  // TBT will be computed after we know nEff and avg losses — use preliminary estimate
  const TBT = input.steamTemperature; // will be refined per-effect below
  const totalAvailDT = totalRangeDT; // full range from steam to last vapour
  const areaPerTubePerM = Math.PI * (tubeOD / 1000);

  const maxTubeLength = Math.max(...availableLengths);

  if (totalAvailDT <= 0) {
    throw new Error(
      `No temperature driving force: TBT (${TBT.toFixed(1)}°C) must be > last effect vapour (${lastEffectVapourT.toFixed(1)}°C)`
    );
  }

  // Shell ID will be auto-calculated from the largest effect's tube requirement.
  // The user-provided shellID is treated as an override — if not provided, we compute it.

  // ── Average brine salinity for BPE estimation ────────────────────────
  // In parallel feed: spray = mix of make-up + recycled brine
  const avgBrineS = (swSalinity + maxBrineSalinity) / 2;
  const avgTemp = (TBT + lastEffectVapourT) / 2;
  const avgBPE = getBoilingPointElevation(avgBrineS, avgTemp);
  const avgLossPerEffect = avgBPE + NEA + demLoss + pdLoss;

  // ── Scenario comparison ──────────────────────────────────────────────
  const scenarios: MEDScenarioRow[] = [];
  const Q1 = (input.steamFlow * 1000 * getLatentHeat(input.steamTemperature)) / 3600; // kW

  for (let n = 3; n <= 12; n++) {
    const totalWorkDT = totalAvailDT - n * avgLossPerEffect;
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

    // Calculate tubes needed for the largest effect (uses max tube length)
    const tubesNeeded = Math.ceil(reqAreaPerEff / (areaPerTubePerM * maxTubeLength));

    // Calculate shell ID that fits those tubes
    const requiredShellID = findMinShellID(tubesNeeded, tubeOD, pitch, false);
    const availableArea =
      countLateralTubes(requiredShellID, tubeOD, pitch, false) * areaPerTubePerM * maxTubeLength;

    // GOR: all effects are adequately sized when shell fits the tubes
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

  // ── Select optimal number of effects ─────────────────────────────────
  let recommendedEffects: number;
  if (input.numberOfEffects) {
    recommendedEffects = input.numberOfEffects;
  } else {
    // Pick the feasible scenario with highest GOR
    const feasible = scenarios.filter((s) => s.feasible);
    if (feasible.length === 0) {
      // Fallback: pick the one with best GOR even if not fully feasible
      const best = scenarios.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      recommendedEffects = best.effects;
      warnings.push(
        `No scenario achieves ≥70% area coverage. Using ${recommendedEffects} effects (best available GOR ${best.achievableGOR.toFixed(1)}).`
      );
    } else {
      const best = feasible.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      recommendedEffects = best.effects;
    }
  }

  // ── GOR configurations: effects × preheaters matrix ─────────────────
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

  const nEff = recommendedEffects;

  // ── Build effect-by-effect temperature profile ───────────────────────
  // The total temperature range from steam to last effect brine is distributed
  // evenly across all effects. Each effect's "total step" includes:
  //   working ΔT + BPE + NEA + demister loss + duct pressure drop loss
  //
  // E1 brine = steamTemp - totalStepPerEffect
  // The working ΔT must be EQUAL for all effects (including E1).
  // E1 is no different from E2 — steam condenses inside tubes just like
  // the vapour from a previous effect. The temperature drop per effect:
  //   total_step = working_ΔT + BPE + NEA + demister + duct losses
  //
  // Total range = steam_T - last_effect_vapour_T
  // N × (working_ΔT + avg_losses) = total_range
  // working_ΔT = total_range/N - avg_losses
  const totalRange = input.steamTemperature - lastEffectVapourT;
  const avgLoss = avgLossPerEffect; // BPE + NEA + demLoss + pdLoss
  const uniformWorkDT = totalRange / nEff - avgLoss;

  if (uniformWorkDT <= 0) {
    throw new Error(
      `No working ΔT available: ${nEff} effects consume all ${totalRange.toFixed(1)}°C in losses (${avgLoss.toFixed(2)}°C/effect). Reduce effects or increase steam temperature.`
    );
  }

  const effects: MEDEffectResult[] = [];

  // Build temperatures iteratively with equal working ΔT
  // E1: brine = steam_T - workDT, vapour_out = brine - BPE - losses
  // E2: brine = E1_vapour_out - workDT, vapour_out = brine - BPE - losses
  // etc.
  const brineTemps: number[] = [];
  let vapT = input.steamTemperature;
  for (let i = 0; i < nEff; i++) {
    const brineT = vapT - uniformWorkDT;
    const bpe = getBoilingPointElevation(maxBrineSalinity, brineT);
    const vapOutT = brineT - bpe - NEA - demLoss - pdLoss;
    brineTemps.push(brineT);
    vapT = vapOutT;
  }

  // ── Pre-calculate spray temperatures per effect ─────────────────────
  // Preheaters heat the feed progressively. In BARC scheme:
  //   E_last gets cold feed (condenser outlet)
  //   E_(last-1) through E_(last-numPH) get progressively warmer feed
  //   E1 through E_(last-numPH-1) get the hottest preheated feed
  const numPH = input.numberOfPreheaters ?? Math.max(0, Math.min(nEff - 2, 4));
  const phTempRise = numPH > 0 ? Math.min((TBT - condenserSWOutlet) * 0.7, numPH * 4) : 0;
  const phDTPerPH = numPH > 0 ? phTempRise / numPH : 0;

  const sprayTemps: number[] = [];
  for (let i = 0; i < nEff; i++) {
    const effectNum = i + 1; // 1-based
    if (effectNum === nEff) {
      // Last effect always gets cold feed
      sprayTemps.push(condenserSWOutlet);
    } else {
      // How many PHs are between this effect and the last?
      // E_(last-1) → PH-1 outlet (coldest PH)
      // E_(last-2) → PH-2 outlet
      // ...
      // E_(last-numPH) → PH-numPH outlet (hottest)
      // Effects earlier than E_(last-numPH) also get hottest PH outlet
      const stepsFromLast = nEff - effectNum; // E1→nEff-1, E_(last-1)→1
      if (stepsFromLast <= numPH) {
        // This effect is covered by a preheater
        // stepsFromLast=1 → PH-1 (coldest), stepsFromLast=numPH → PH-numPH (hottest)
        sprayTemps.push(condenserSWOutlet + stepsFromLast * phDTPerPH);
      } else {
        // Beyond PH coverage → gets hottest preheated feed
        sprayTemps.push(condenserSWOutlet + phTempRise);
      }
    }
  }

  // Feed per effect (fresh seawater make-up) — constant across effects
  const feedPerEffect =
    (((input.steamFlow * input.targetGOR) / nEff) * maxBrineSalinity) /
    (maxBrineSalinity - swSalinity);
  const cpSWFeed = getSeawaterSpecificHeat(
    swSalinity,
    (condenserSWOutlet + input.steamTemperature) / 2
  );

  // Now build effects with proper incoming vapour tracking
  let prevVapourT = input.steamTemperature;

  for (let i = 0; i < nEff; i++) {
    const brineT = brineTemps[i]!;

    // BPE at brine conditions (use max brine salinity — brine leaving the effect)
    const bpe = getBoilingPointElevation(maxBrineSalinity, brineT);

    // Vapour out temperature
    const vapourOutT = brineT - bpe - NEA - demLoss - pdLoss;

    // Working ΔT
    const workDT = prevVapourT - brineT;

    // Pressure
    const pressure = satPressureMbar(vapourOutT);

    // HTC
    const U = estimateU(brineT, tubeOD, tubeWall, kWall);

    // Latent heat at vapour out conditions
    const hfg = getLatentHeat(vapourOutT);
    const hfgIn = getLatentHeat(prevVapourT);

    // Duty calculation with distillate flashing contribution
    // Base duty: vapour from previous effect condenses inside tubes
    let duty: number;
    if (i === 0) {
      // E1: steam condenses, no flash contribution
      duty = Q1 * (1 - VENT_LOSS_FRACTION);
    } else {
      // E2+: vapour from previous effect condenses + distillate flash contributes
      // Accumulated distillate from all previous effects enters this effect via siphon
      // It flashes because pressure is lower (temperature drops by ~workDT + BPE + losses)
      const prevDistAccum = effects.reduce((s, e) => s + e.distillateFlow, 0);
      const prevBrineT = effects[i - 1]!.brineTemp;
      const flashDT = prevBrineT - brineT; // temperature drop across siphon
      const Cp = 4.18; // kJ/(kg·K) for distillate (pure water)
      const flashVapour = prevDistAccum > 0 ? (prevDistAccum * Cp * flashDT) / hfg : 0; // T/h
      const flashDuty = (flashVapour * hfg) / 3.6; // kW

      // Vapour from previous effect (condensation duty)
      const prevVapourFlow = effects[i - 1]!.distillateFlow; // T/h
      const condensDuty = ((prevVapourFlow * hfgIn) / 3.6) * (1 - VENT_LOSS_FRACTION); // kW

      duty = condensDuty + flashDuty;
    }

    // Required area
    const reqArea = workDT > 0 ? (duty * 1000) / (U * workDT) : Infinity;
    const desArea = reqArea * (1 + designMargin);

    // E1 gets vapour lanes, later effects do not
    const hasLanes = i === 0;

    // Check for user overrides
    const tubeLengthOverride = input.tubeLengthOverrides?.[i] ?? null;
    const tubeCountOverride = input.tubeCountOverrides?.[i] ?? null;
    const shellIDOverride = input.shellIDOverrides?.[i] ?? null;

    let bestTubes = 0;
    let selectedLength = maxTubeLength;
    let effShellID: number;

    if (tubeLengthOverride !== null && tubeCountOverride !== null) {
      // User specified both — use directly
      selectedLength = tubeLengthOverride;
      bestTubes = tubeCountOverride;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    } else if (tubeLengthOverride !== null) {
      // User specified tube length — auto-calculate tube count for design area
      selectedLength = tubeLengthOverride;
      bestTubes = Math.ceil(desArea / (areaPerTubePerM * selectedLength));
      if (bestTubes <= 0 || !isFinite(bestTubes)) bestTubes = 100;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    } else if (tubeCountOverride !== null) {
      // User specified tube count — auto-select shortest tube length that fits
      bestTubes = tubeCountOverride;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
      const minLengthNeeded = desArea / (bestTubes * areaPerTubePerM);
      selectedLength =
        availableLengths.sort((a, b) => a - b).find((L) => L >= minLengthNeeded - 0.01) ??
        maxTubeLength;
    } else {
      // Auto-calculate: try each available tube length (shortest first)
      // and find the tube count that provides the design area
      for (const L of availableLengths.sort((a, b) => a - b)) {
        const tubesForLength = Math.ceil(desArea / (areaPerTubePerM * L));
        if (tubesForLength > 0 && isFinite(tubesForLength)) {
          const testShellID = findMinShellID(tubesForLength, tubeOD, pitch, hasLanes);
          if (testShellID <= 6000) {
            bestTubes = tubesForLength;
            selectedLength = L;
            break;
          }
        }
      }
      if (bestTubes === 0) {
        bestTubes = Math.ceil(desArea / (areaPerTubePerM * maxTubeLength));
        selectedLength = maxTubeLength;
      }
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    }

    // Get actual tube count from geometry (may be slightly more than bestTubes)
    const tubes = tubeCountOverride ?? countLateralTubes(effShellID, tubeOD, pitch, hasLanes);
    const effTubesPerRow = getMaxTubesPerRow(effShellID, pitch);

    const instArea = tubes * areaPerTubePerM * selectedLength;
    // Margin = installed area vs REQUIRED area (not design area)
    // Design area already includes the design margin, so margin over reqArea shows true overdesign
    const margin = reqArea > 0 ? (instArea / reqArea - 1) * 100 : 0;

    // Distillate production in this effect
    // Duty is split between sensible heating of feed and evaporation
    const sprayT = sprayTemps[i]!;
    const sensibleDuty = (feedPerEffect * 1000 * cpSWFeed * Math.max(0, brineT - sprayT)) / 3600; // kW
    const evapDuty = Math.max(0, duty - sensibleDuty);
    const distFlow = (evapDuty * 3.6) / hfg; // T/h

    // Accumulated distillate cascade (this effect + all previous)
    const prevAccumDist = i > 0 ? effects[i - 1]!.accumDistillateFlow : 0;
    const accumDistillateFlow = prevAccumDist + distFlow;

    // Flash vapour from distillate cascade
    let flashVapourFlow = 0;
    if (i > 0) {
      const prevBrineT2 = effects[i - 1]!.brineTemp;
      const flashDT2 = prevBrineT2 - brineT;
      const Cp2 = 4.18; // kJ/(kg·K)
      flashVapourFlow = prevAccumDist > 0 ? (prevAccumDist * Cp2 * flashDT2) / hfg : 0;
    }

    // Brine: spray flow minus evaporated vapour = remaining brine
    // In each effect: spray in → some evaporates → remaining is brine
    // Brine from this effect = total spray - distillate produced
    const brineOutThisEffect = feedPerEffect - distFlow; // T/h (what doesn't evaporate)
    // Accumulated brine cascade (this effect brine + all previous brine flowing through)
    const prevAccumBrine = i > 0 ? effects[i - 1]!.accumBrineFlow : 0;
    const accumBrineFlow = prevAccumBrine + brineOutThisEffect;

    // Wetting / brine recirculation
    const minSpray = minGamma * 2 * effTubesPerRow * selectedLength * 3.6; // T/h
    const recirc = includeRecirc ? Math.max(0, minSpray - feedPerEffect) : 0;

    effects.push({
      effect: i + 1,
      incomingVapourTemp: prevVapourT,
      brineTemp: brineT,
      bpe,
      nea: NEA,
      demisterLoss: demLoss,
      pressureDropLoss: pdLoss,
      vapourOutTemp: vapourOutT,
      workingDeltaT: workDT,
      pressure,
      overallU: U,
      duty,
      requiredArea: reqArea,
      designArea: desArea,
      tubes,
      tubeLength: selectedLength,
      installedArea: instArea,
      areaMargin: margin,
      distillateFlow: distFlow,
      accumDistillateFlow,
      brineOutFlow: brineOutThisEffect,
      accumBrineFlow,
      flashVapourFlow,
      hfg,
      hasVapourLanes: hasLanes,
      minSprayFlow: minSpray,
      brineRecirculation: recirc,
      shellLengthMM: Math.round(selectedLength * 1000 + 2 * tubeSheetThkMM + tubeSheetAccessMM),
      shellODmm: Math.round(effShellID + 2 * shellThkMM),
      // Ti top rows for erosion protection (top 3 rows of lateral bundle)
      tiTopRows: 3,
      tiTubeCount: Math.min(3 * effTubesPerRow, tubes),
      // Spray nozzle installation space: depends on spray angle and bundle width
      // Reference drawings show 275-945mm above bundle top
      // Minimum = nozzle height (50mm) + spray cone development (spray angle × half-width)
      sprayNozzleSpaceMM: Math.round(Math.max(275, effShellID * 0.15)),
      // Drainage clearance below bundle (minimum 250mm for brine collection)
      drainageClearanceMM: Math.max(250, Math.round(effShellID * 0.12)),
      // Spray temperature for this effect
      sprayTemp: sprayT,
      // Vapour flow area check: open half of shell minus bundle cross-section
      // Shell cross-section area (full circle)
      ...(() => {
        const shellR = effShellID / 2;
        const shellArea = (Math.PI * shellR * shellR) / 1e6; // m²
        // Bundle occupies roughly half the shell (lateral bundle)
        // Approximate bundle cross-section from tube count × pitch²
        const bundleCrossSection = (tubes * pitch * pitch) / 1e6; // m² approximate
        const vapourFlowAreaM2 = Math.max(0.1, shellArea - bundleCrossSection * 0.5);
        // Vapour mass flow through this area
        const vapDensity = getDensityVapor(vapourOutT);
        const vapMassFlow = distFlow / 3.6; // kg/s
        const vapVolumetricFlow = vapDensity > 0 ? vapMassFlow / vapDensity : 0; // m³/s
        const vapVel = vapourFlowAreaM2 > 0 ? vapVolumetricFlow / vapourFlowAreaM2 : 0;
        const velStatus: 'ok' | 'high' | 'low' = vapVel > 40 ? 'high' : vapVel < 5 ? 'low' : 'ok';
        return { vapourFlowAreaM2, vapourVelocity: vapVel, vapourVelocityStatus: velStatus };
      })(),
    });

    prevVapourT = vapourOutT;
  }

  // ── Check for undersized effects ─────────────────────────────────────
  const undersized = effects.filter((e) => e.areaMargin < -10);
  if (undersized.length > 0) {
    warnings.push(
      `${undersized.length} effect(s) are undersized by >10%: ${undersized.map((e) => `E${e.effect} (${e.areaMargin.toFixed(0)}%)`).join(', ')}. Consider fewer effects or larger shell.`
    );
  }

  // ── Totals ───────────────────────────────────────────────────────────
  // Gross distillate = all vapour produced across all effects
  const grossDistillate = effects.reduce((sum, e) => sum + e.distillateFlow, 0);
  // E1 condensate is the original steam — returns to source (solar field), not product
  const e1Condensate = input.steamFlow * (1 - VENT_LOSS_FRACTION);
  // Net distillate = product water (E2+ condensate + flash contributions)
  // Preheater condensate will be added after preheater sizing below
  let totalDistillate = grossDistillate - e1Condensate;
  let achievedGOR = totalDistillate / input.steamFlow;
  const totalArea = effects.reduce((sum, e) => sum + e.installedArea, 0);
  const totalRecirc = effects.reduce((sum, e) => sum + e.brineRecirculation, 0);
  const makeUpFeed = (totalDistillate * maxBrineSalinity) / (maxBrineSalinity - swSalinity);
  const brineBlowdown = makeUpFeed - totalDistillate;

  // ── Shell ID warning ────────────────────────────────────────────────
  const largestShellOD = Math.max(...effects.map((e) => e.shellODmm));
  const largestShellID = largestShellOD - 2 * shellThkMM;
  if (largestShellID < 1800) {
    warnings.push(
      `Largest shell ID is ${largestShellID} mm (< 1,800 mm). A person cannot enter for tube maintenance. The designer may increase the shell to 1,800 mm ID minimum for access.`
    );
  }

  // ── Final Condenser ──────────────────────────────────────────────────
  const lastEffect = effects[nEff - 1]!;
  const fcVapFlow = lastEffect.distillateFlow;
  const fcVapT = lastEffect.vapourOutTemp;
  const fcDuty = (fcVapFlow * 1000 * getLatentHeat(fcVapT)) / 3600;
  const dT1 = fcVapT - condenserSWOutlet;
  const dT2 = fcVapT - input.seawaterTemperature;
  const fcLMTD = dT1 > 0 && dT2 > 0 ? (dT1 - dT2) / Math.log(dT1 / dT2) : 1;
  const fcU = input.condenserU ?? getDefaultCondenserU(input.tubeMaterialName ?? 'Al 5052');
  const fcArea = ((fcDuty * 1000) / (fcU * fcLMTD)) * (1 + designMargin);
  const cpSW = getSeawaterSpecificHeat(
    swSalinity,
    (input.seawaterTemperature + condenserSWOutlet) / 2
  );
  const fcSWflow = (fcDuty / (cpSW * (condenserSWOutlet - input.seawaterTemperature))) * 3.6;
  const swDensity = getSeawaterDensity(swSalinity, input.seawaterTemperature);
  const fcSWflowM3h = (fcSWflow * 1000) / swDensity;

  // Condenser/preheater tube sizing: standardised Ti SB338 Gr2, 17mm × 0.4mm
  const tiTubeOD = 17;
  const tiTubeID = 16.2;
  const tiTubeFlowArea = (Math.PI / 4) * (tiTubeID / 1000) ** 2;
  const tiTubeLengthM = input.tiTubeLength ?? 2.1;
  const tiTubeLengthMM = tiTubeLengthM * 1000;
  const tiTargetVel = input.tiTargetVelocity ?? 1.6;
  const tiVelMin = 1.4;
  const tiVelMax = 1.8;
  const tiPitch = 21.3;
  const tiAreaPerTube = Math.PI * (tiTubeOD / 1000) * tiTubeLengthM;

  // Calculate velocity-dependent U-value for Ti condenser/preheater
  // Uses Dittus-Boelter (tube side) + Nusselt condensation (shell side)
  function calculateTiU(velocity: number, swTemp: number, vapourTemp: number): number {
    try {
      const swDens = getSeawaterDensity(swSalinity, swTemp);
      const swVisc = getSeawaterViscosity(swSalinity, swTemp);
      const swCp = getSeawaterSpecificHeat(swSalinity, swTemp);
      const swK = getSeawaterThermalConductivity(swSalinity, swTemp);

      // Tube-side HTC (Dittus-Boelter: seawater flowing inside tubes)
      const tubeSide = calculateTubeSideHTC({
        density: swDens,
        velocity,
        diameter: tiTubeID / 1000, // m
        viscosity: swVisc,
        specificHeat: swCp,
        conductivity: swK,
        isHeating: true,
      });

      // Shell-side HTC (Nusselt condensation on horizontal tubes)
      const deltaT = Math.max(vapourTemp - swTemp, 1); // °C driving force
      const liqDens = getDensityLiquid(vapourTemp);
      const vapDens = getDensityVapor(vapourTemp);
      const hfgVal = getLatentHeat(vapourTemp);
      // Approximate liquid properties at condensation temperature
      const liqVisc = getSeawaterViscosity(0, vapourTemp); // pure water viscosity at vapour T
      const liqK = getSeawaterThermalConductivity(0, vapourTemp); // pure water conductivity

      const shellSide = calculateNusseltCondensation({
        liquidDensity: liqDens,
        vaporDensity: vapDens,
        latentHeat: hfgVal,
        liquidConductivity: liqK,
        liquidViscosity: liqVisc,
        dimension: tiTubeOD / 1000, // tube OD in m
        deltaT,
        orientation: 'horizontal',
      });

      // Apply real-world corrections (validated against BARC/Campiche):
      // 1. Kern bundle row correction (condensate dripping from upper rows)
      const nTubeRows = 10; // typical condenser/PH bundle
      const kernFactor = Math.pow(nTubeRows, -1 / 6); // ~0.68
      // 2. NCG degradation (mass transfer resistance from NCG boundary layer)
      const ncgDeg = 0.9; // 10% degradation for condenser (15% for FC with accumulated NCG)
      const hCondEffective = shellSide.htc * kernFactor * ncgDeg;

      // 3. Wall + fouling with OD/ID correction
      const Rwall = 0.0004 / 22; // Ti wall: 0.4mm / 22 W/(m·K)
      const odID = tiTubeOD / tiTubeID;
      const foulingTube = 0.00018; // m²·K/W (TEMA seawater)
      const foulingShell = 0.0001; // m²·K/W (condensate side)

      const Rtotal =
        1 / hCondEffective + foulingShell + Rwall + foulingTube * odID + (1 / tubeSide.htc) * odID;
      return 1 / Rtotal;
    } catch {
      // Fallback to default if correlation fails
      return 2200;
    }
  }

  // Generate pass options for a given flow, thermal duty, and temperatures
  // Includes 1-8 passes (odd passes allowed per user requirement)
  function generatePassOpts(
    flowM3s: number,
    dutyKW: number,
    lmtd: number,
    swTemp: number,
    vapourTemp: number
  ): PassOption[] {
    const opts: PassOption[] = [];
    for (let passes = 1; passes <= 8; passes++) {
      // Tubes/pass for target velocity
      const tppForVel = Math.ceil(flowM3s / (tiTargetVel * tiTubeFlowArea));
      const tubesForVel = tppForVel * passes;

      // Calculate U at target velocity
      const U = calculateTiU(tiTargetVel, swTemp, vapourTemp);
      const reqArea = dutyKW > 0 && lmtd > 0 ? ((dutyKW * 1000) / (U * lmtd)) * 1.15 : 0;
      const tubesFromArea = Math.ceil(reqArea / tiAreaPerTube);

      // Use the larger of thermal or velocity requirement
      const totalTubes = Math.max(tubesFromArea, tubesForVel);
      const tpp = Math.ceil(totalTubes / passes);
      const finalTubes = tpp * passes;
      const vel = flowM3s / (tpp * tiTubeFlowArea);

      // Recalculate U at actual velocity (not target)
      const actualU = calculateTiU(vel, swTemp, vapourTemp);
      const actualArea = finalTubes * tiAreaPerTube;
      const bundleDia = Math.sqrt((finalTubes * tiPitch * tiPitch * 4) / Math.PI);

      opts.push({
        passes,
        tubesPerPass: tpp,
        totalTubes: finalTubes,
        velocity: vel,
        inRange: vel >= tiVelMin && vel <= tiVelMax,
        area: actualArea,
        shellODmm: Math.round(bundleDia + 80),
        calculatedU: actualU,
      });
    }
    return opts;
  }

  // Select the best pass option (fewest passes within velocity range)
  function selectBestPass(opts: PassOption[]): PassOption {
    const inRange = opts.filter((o) => o.inRange);
    if (inRange.length > 0) return inRange[0]!; // fewest passes that's in range
    // If none in range, pick closest to target velocity
    return opts.reduce((best, o) =>
      Math.abs(o.velocity - tiTargetVel) < Math.abs(best.velocity - tiTargetVel) ? o : best
    );
  }

  const fcFlowM3s = fcSWflowM3h / 3600;
  const fcPassOpts = generatePassOpts(fcFlowM3s, fcDuty, fcLMTD, input.seawaterTemperature, fcVapT);
  const fcBest = selectBestPass(fcPassOpts);

  const condenser: MEDCondenserResult = {
    vapourFlow: fcVapFlow,
    vapourTemp: fcVapT,
    duty: fcDuty,
    lmtd: fcLMTD,
    overallU: fcBest.calculatedU ?? fcU,
    designArea: Math.max(fcArea, fcBest.area),
    seawaterFlow: fcSWflow,
    seawaterFlowM3h: fcSWflowM3h,
    tubes: fcBest.totalTubes,
    passes: fcBest.passes,
    velocity: fcBest.velocity,
    shellODmm: fcBest.shellODmm,
    tubeOD: tiTubeOD,
    tubeLengthMM: tiTubeLengthMM,
    passOptions: fcPassOpts,
  };

  if (fcLMTD < 2) {
    warnings.push(
      `Condenser LMTD is very low (${fcLMTD.toFixed(1)}°C). Consider increasing condenser approach or reducing number of effects.`
    );
  }

  // ── Preheaters ───────────────────────────────────────────────────────
  // BARC philosophy: full spray flow (make-up + recirc) goes through PH chain.
  // Flow path: recirc pump → spray E_last → PH-1 → spray E_(last-1) → PH-2 → ... → PH-N → spray E2 → E1
  // Flow DECREASES through each PH as spray is peeled off at each effect.
  // Tubes: 17mm OD × 0.4mm Ti SB338 Gr2, 21.3mm triangular pitch, 4 passes, target 1.5 m/s.
  // numPH, phTempRise, phDTPerPH already calculated above (before effect loop)
  const preheaters: MEDPreheaterResult[] = [];

  if (numPH > 0 && totalRecirc + makeUpFeed > 0) {
    // Total spray flow = total spray to all effects (make-up + recirc)
    const totalSprayFlow = effects.reduce((s, e) => s + e.minSprayFlow, 0); // T/h

    const phU = input.preheaterU ?? getDefaultPreheaterU(input.tubeMaterialName ?? 'Al 5052');

    // Spray per effect (average)
    const sprayPerEffect = totalSprayFlow / nEff;

    // Flow through PH chain decreases as spray is peeled off
    // E_last gets cold spray (before PH-1), so PH-1 gets: totalSpray - sprayPerEffect
    let phFlowTh = totalSprayFlow - sprayPerEffect; // after E_last spray peeled off

    for (let i = 0; i < numPH; i++) {
      const phIdx = numPH - i; // PH numbering: PH1 is hottest (last in chain)
      const swIn = condenserSWOutlet + i * phDTPerPH;
      const swOut = swIn + phDTPerPH;
      // Vapour source: start from Effect 2 going forward (not last effects)
      // Earlier effects have higher vapour multiplication — their preheater
      // condensate benefit cascades through more downstream effects.
      // BARC design: PH on Effects 2, 3, 4, 5 (for 6-effect plant)
      const vapSourceIdx = 1 + i; // 0-based: Effect 2, 3, 4, ... (skip E1 — it gets steam)
      const vapT =
        vapSourceIdx >= 0 && vapSourceIdx < nEff
          ? effects[vapSourceIdx]!.vapourOutTemp
          : lastEffect.vapourOutTemp;
      const vapSourceName = vapSourceIdx >= 0 ? `Effect ${vapSourceIdx + 1}` : 'Last Effect';

      // Duty based on the flow through THIS preheater (not make-up only)
      const phDuty = (phFlowTh * 1000 * cpSW * phDTPerPH) / 3600; // kW
      const phDT1 = vapT - swOut;
      const phDT2 = vapT - swIn;
      const phLMTD = phDT1 > 0 && phDT2 > 0 ? (phDT1 - phDT2) / Math.log(phDT1 / phDT2) : 1;
      const phArea = phLMTD > 0 ? ((phDuty * 1000) / (phU * phLMTD)) * (1 + designMargin) : 0;

      // Tube sizing using standardised Ti specs with pass selection
      const phFlowM3s = (phFlowTh * 1000) / (getSeawaterDensity(swSalinity, swIn) * 3600);
      const phPassOpts = generatePassOpts(phFlowM3s, phDuty, phLMTD, swIn, vapT);
      const phBest = selectBestPass(phPassOpts);

      preheaters.push({
        id: phIdx,
        vapourSource: vapSourceName,
        vapourTemp: vapT,
        swInlet: swIn,
        swOutlet: swOut,
        duty: phDuty,
        lmtd: phLMTD,
        designArea: Math.max(phArea, phBest.area),
        flowTh: phFlowTh,
        tubes: phBest.totalTubes,
        passes: phBest.passes,
        velocity: phBest.velocity,
        shellODmm: phBest.shellODmm,
        tubeOD: tiTubeOD,
        tubeLengthMM: tiTubeLengthMM,
        passOptions: phPassOpts,
      });

      // Peel off spray for this effect
      phFlowTh -= sprayPerEffect;
    }
  }

  // ── Add preheater condensate to product ────────────────────────────
  // Vapour condensed in preheaters is additional product water
  if (preheaters.length > 0) {
    const phCondensateTotal = preheaters.reduce((s, ph) => {
      const hfgPH = getLatentHeat(ph.vapourTemp);
      return s + (ph.duty * 3.6) / hfgPH; // T/h
    }, 0);
    totalDistillate += phCondensateTotal;
    achievedGOR = totalDistillate / input.steamFlow;
  }

  // ── GOR check ────────────────────────────────────────────────────────
  if (achievedGOR < input.targetGOR * 0.8) {
    warnings.push(
      `Achieved GOR (${achievedGOR.toFixed(1)}) is ${((1 - achievedGOR / input.targetGOR) * 100).toFixed(0)}% below target (${input.targetGOR}). ` +
        `Consider: fewer effects, larger shell, or longer tubes.`
    );
  }

  const result: MEDDesignerResult = {
    inputs: { ...input, resolvedDefaults },
    gorConfigurations,
    scenarios,
    recommendedEffects,
    effects,
    condenser,
    preheaters,
    totalDistillate,
    totalDistillateM3Day: totalDistillate * 24,
    achievedGOR,
    totalEvaporatorArea: totalArea,
    totalBrineRecirculation: totalRecirc,
    makeUpFeed,
    brineBlowdown,
    spraySalinity:
      totalRecirc + makeUpFeed > 0
        ? Math.round(
            (makeUpFeed * swSalinity + totalRecirc * maxBrineSalinity) / (makeUpFeed + totalRecirc)
          )
        : swSalinity,
    numberOfShells: nEff,
    swReject: fcSWflow - makeUpFeed,
    auxiliaryEquipment: computeAuxiliaryEquipment(effects, condenser, {
      swSalinity,
      maxBrineSalinity,
      // Blended spray TDS: (make-up × SW_TDS + recirc × brine_TDS) / total
      spraySalinity:
        totalRecirc + makeUpFeed > 0
          ? Math.round(
              (makeUpFeed * swSalinity + totalRecirc * maxBrineSalinity) /
                (makeUpFeed + totalRecirc)
            )
          : swSalinity,
      shellID,
      nEff,
      totalDistillate,
      makeUpFeed,
      brineBlowdown: brineBlowdown,
      totalRecirc,
      steamFlow: input.steamFlow,
      swTemp: input.seawaterTemperature,
      condenserSWFlowM3h: condenser.seawaterFlowM3h,
    }),
    // Dosing
    dosing: computeDosing(
      makeUpFeed,
      getSeawaterDensity(swSalinity, input.seawaterTemperature),
      input.antiscalantDoseMgL ?? 2
    ),
    // Vacuum system — NCG comes from make-up feed (not condenser SW)
    // All dissolved gases are released across all effects and accumulate
    // to the last effect where the vacuum system extracts them
    vacuumSystem: computeVacuumSystem(
      effects[nEff - 1]!.pressure,
      effects[nEff - 1]!.vapourOutTemp,
      makeUpFeed / (getSeawaterDensity(swSalinity, input.seawaterTemperature) / 1000), // make-up T/h → m³/h
      input.seawaterTemperature,
      swSalinity / 1000, // ppm → g/kg
      effects.reduce((sum, e) => {
        // Estimate shell volume: π/4 × D² × L (in m³)
        const dM = (e.shellODmm ?? shellID + 16) / 1000;
        const lM = e.shellLengthMM / 1000;
        return sum + (Math.PI / 4) * dM * dM * lM;
      }, 0),
      input.vacuumTrainConfig ??
        // Auto-select based on suction pressure
        (lastEffect.pressure > 100
          ? 'lrvp_only'
          : lastEffect.pressure > 50
            ? 'hybrid'
            : 'two_stage_ejector')
    ),
    overallDimensions: {
      // Overall train: sum of effect shell lengths + shared access spaces between effects
      // Each effect has 1× access (750mm). Between adjacent effects, one shared access (750mm).
      // Plus 200mm gap between shell flanges for piping/nozzles.
      // Total = Σ(shellLength) + (nEff-1)×(shared_access + gap)
      // But shellLength already includes 1× access, so shared access between effects
      // adds only the gap between shells.
      totalLengthMM:
        effects.reduce((sum, e) => sum + e.shellLengthMM, 0) +
        (nEff - 1) * 200 + // gaps between shells
        tubeSheetAccessMM, // one extra access on the far end of last effect
      shellODmm: largestShellOD,
      shellLengthRange: {
        min: Math.min(...effects.map((e) => e.shellLengthMM)),
        max: Math.max(...effects.map((e) => e.shellLengthMM)),
      },
    },
    warnings,
  };

  // Geometry comparisons
  result.geometryComparisons = computeGeometryComparisons(
    effects,
    nEff,
    tubeOD,
    pitch,
    tubeSheetAccessMM,
    shellThkMM,
    kWall,
    designMargin,
    Q1,
    availableLengths,
    areaPerTubePerM,
    input.seawaterTemperature,
    swSalinity,
    maxBrineSalinity
  );

  // Preheater contribution to distillate
  if (preheaters.length > 0) {
    result.preheaterContributions = computePreheaterContributions(
      preheaters,
      effects,
      input.steamFlow,
      condenserSWOutlet
    );
  }

  // Turndown analysis (opt-in)
  if (input.includeTurndown) {
    result.turndownAnalysis = computeTurndownAnalysis(input, result);
  }

  return result;
}

// ============================================================================
// Multi-Option Designer
// ============================================================================

/**
 * Generate multiple design options for comparison.
 *
 * Produces a range of options from "low GOR / compact / light" to
 * "high GOR / large area / heavy", allowing the designer to pick
 * the optimal trade-off.
 *
 * @param input Same minimal inputs as designMED
 * @returns Array of design options sorted by GOR (ascending)
 */
export function generateDesignOptions(input: MEDDesignerInput): MEDDesignOption[] {
  const options: MEDDesignOption[] = [];

  // Try 3 to 10 effects
  for (let n = 3; n <= 10; n++) {
    try {
      const result = designMED({ ...input, numberOfEffects: n });

      if (result.achievedGOR <= 0 || result.totalDistillate <= 0) continue;

      const weight = estimatePlantWeight(result);

      // Specific thermal energy: steam enthalpy / distillate volume
      const steamEnthalpy = getLatentHeat(input.steamTemperature); // kJ/kg
      const specificEnergy = (input.steamFlow * steamEnthalpy) / result.totalDistillate; // kJ/kg dist
      const specificEnergy_kWhM3 = specificEnergy / 3.6; // kJ/kg → kWh/m³

      // Label
      let label: string;
      if (result.achievedGOR >= input.targetGOR * 0.9) {
        label = `Option ${String.fromCharCode(65 + options.length)} — High GOR (${n} effects)`;
      } else if (result.achievedGOR >= input.targetGOR * 0.7) {
        label = `Option ${String.fromCharCode(65 + options.length)} — Balanced (${n} effects)`;
      } else {
        label = `Option ${String.fromCharCode(65 + options.length)} — Compact (${n} effects)`;
      }

      options.push({
        effects: n,
        gor: result.achievedGOR,
        distillateM3Day: result.totalDistillateM3Day,
        totalEvaporatorArea: result.totalEvaporatorArea,
        totalShells: n,
        condenserArea: result.condenser.designArea,
        totalPreheaterArea: result.preheaters.reduce((s, p) => s + p.designArea, 0),
        totalBrineRecirculation: result.totalBrineRecirculation,
        specificEnergy: specificEnergy_kWhM3,
        largestShellID: result.overallDimensions.shellODmm - 2 * (input.shellThickness ?? 8),
        trainLengthMM: result.overallDimensions.totalLengthMM,
        weight,
        feasible: result.warnings.length === 0,
        label,
        detail: result,
      });
    } catch {
      // Skip infeasible configurations (e.g. ΔT exhausted)
      continue;
    }
  }

  return options;
}
