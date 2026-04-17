/**
 * MED Calculation Engine
 *
 * Models an MED plant as it physically operates:
 *   Steam enters Effect 1 → cascades through all effects → product comes out.
 *
 * Input:  Steam flow + temperature, seawater conditions, number of effects
 * Output: GOR, distillate production, per-effect H&M balance — all as RESULTS
 *
 * The engine follows the physical flow:
 *   1. Establish temperature profile across effects
 *   2. Calculate Effect 1 from steam input
 *   3. Effect 1 outputs → Effect 2 inputs (vapor, condensate, brine cascade)
 *   4. Continue through all effects
 *   5. Final condenser
 *   6. Preheaters (if any) — coupled with effects through iteration
 *   7. Equipment sizing → wetting rate → recirculation (coupled iteration)
 *
 * Iteration handles the coupling:
 *   - Preheater feed temps depend on effect vapor temps (which depend on feed temps)
 *   - Recirculation flow depends on tube count (which depends on H&M balance)
 *   - These converge within a few iterations because the coupling is weak
 *
 * References:
 *   - El-Dessouky & Ettouney (2002) — sequential algorithm with 10 calc blocks
 *   - Sharqawy et al. (2010) — seawater property correlations
 *   - IAPWS-IF97 — steam properties
 */

import {
  getLatentHeat,
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getSeawaterDensity,
  getSeawaterSpecificHeat,
  getSaturationPressure,
  getDensityVapor,
  TOTAL_DISSOLVED_GAS_MG_PER_LITRE,
  DUCT_K_FACTOR,
} from '@vapour/constants';
import type { MEDEffectResult, MEDFinalCondenserResult, PreheaterConfig } from '@vapour/types';
import {
  calculateEffect,
  calculateDemisterDeltaTFromVelocity,
  pressureDropToTempDrop,
  type EffectInput,
} from './effectModel';
import { calculatePreheater } from './preheaterModel';
import { calculateFinalCondenser } from './finalCondenserModel';
import { solveTVCIntegration, type TVCIntegrationResult } from './tvcIntegration';
import { sizeEquipment, type EquipmentSizingResult } from './equipmentSizing';
import { findMinShellID, computeVaporPathGeometry, type VaporPathGeometry } from './shellGeometry';
import type { MEDPlantInputs, MEDPreheaterResult, TubeMaterial } from '@vapour/types';

// ============================================================================
// Engine Input — what the user provides
// ============================================================================

export interface MEDEngineInput {
  /** Heating steam/vapor flow in kg/hr */
  steamFlow: number;
  /** Steam temperature in °C (saturated) */
  steamTemperature: number;

  /** Number of evaporator effects */
  numberOfEffects: number;

  /** Seawater inlet temperature in °C */
  seawaterInletTemp: number;
  /** Seawater salinity in ppm */
  seawaterSalinity: number;
  /** Maximum brine salinity in ppm (determines concentration factor) */
  maxBrineSalinity: number;

  /** Condenser approach temperature in °C (default 4) */
  condenserApproach?: number;
  /** Condenser seawater outlet temperature in °C (default seawaterInletTemp + 5) */
  condenserOutletTemp?: number;

  /** Preheater configuration — which effects supply vapor to preheaters.
   *  The engine will size each preheater and route condensate automatically. */
  preheaterEffects?: number[];

  /** NEA per effect in °C (default 0.25) */
  nea?: number;
  /** Demister pressure drop loss per effect in °C (default 0.15) */
  demisterLoss?: number;
  /** Duct pressure drop loss per effect in °C (default 0.30) */
  ductLoss?: number;

  /** Fouling resistance in m²·K/W (default 0.00015) */
  foulingResistance?: number;

  /** BPE safety factor (multiplier on computed BPE, default 1.0 = no margin).
   *  Dr Rognoni recommends 1.1–1.2 to account for local concentration effects
   *  at the tube surface with brine recirculation. */
  bpeSafetyFactor?: number;

  // ---- Tube specifications (for equipment sizing) ----
  /** Evaporator tube OD in mm (default 25.4) */
  evapTubeOD?: number;
  /** Evaporator tube wall thickness in mm (default 1.0) */
  evapTubeWall?: number;
  /** Evaporator tube length in m (default 1.2) */
  evapTubeLength?: number;
  /** Evaporator tube material (default 'titanium') */
  evapTubeMaterial?:
    | 'titanium'
    | 'al_brass'
    | 'cu_ni_90_10'
    | 'cu_ni_70_30'
    | 'al_alloy'
    | 'ss_316l'
    | 'duplex_2205';
  /** Condenser tube OD in mm (default 17) */
  condTubeOD?: number;
  /** Condenser tube wall thickness in mm (default 0.4) */
  condTubeWall?: number;
  /** Condenser tube length in m (default 2.1) */
  condTubeLength?: number;

  // ---- TVC (Thermo Vapor Compressor) ----
  /** Motive steam pressure for TVC in bar abs (omit for plain MED) */
  tvcMotivePressure?: number;
  /** Motive steam temperature in °C (optional — defaults to saturated at tvcMotivePressure) */
  tvcMotiveTemperature?: number;
  /** Effect from which vapor is entrained by the TVC (1-based, default: last effect) */
  tvcEntrainedEffect?: number;

  // ---- Preheater tuning ----
  /** Default target temperature rise per preheater in °C (default 4). */
  preheaterTempRise?: number;
  /** Per-preheater target temp rise override. Key = effect number, value = °C. */
  preheaterTempRiseMap?: Record<number, number>;
}

// ============================================================================
// Engine Output — everything the plant produces
// ============================================================================

export interface MEDEngineResult {
  /** Per-effect H&M balance (tube side, shell side, combined) */
  effects: MEDEffectResult[];
  /** Final condenser result */
  finalCondenser: MEDFinalCondenserResult;
  /** Per-preheater results (each individually sized) */
  preheaters: PreheaterDetail[];
  /** Equipment sizing (null if tube specs not provided) */
  equipmentSizing: EquipmentSizingResult | null;
  /** Per-effect vapour path geometry (demister pad + steam flow cutout) */
  vaporPathGeometry: VaporPathGeometry[];
  /** Overall performance */
  performance: {
    /** Gain Output Ratio — distillate / steam */
    gor: number;
    /** Net distillate production in kg/hr */
    netDistillate: number;
    /** Net distillate in m³/day (assuming density ≈ 998 kg/m³) */
    netDistillateM3Day: number;
    /** Specific thermal energy in kJ/kg distillate */
    specificThermalEnergy: number;
    /** Specific thermal energy in kWh/m³ */
    specificThermalEnergy_kWh: number;
    /** Total seawater intake in kg/hr */
    seawaterIntake: number;
    /** Total brine blowdown in kg/hr */
    brineBlowdown: number;
    /** Brine blowdown salinity in ppm */
    brineSalinity: number;
    /** Cooling water (seawater rejected after condenser) in kg/hr */
    coolingWater: number;
    /** Feed water (seawater used as spray) in kg/hr */
    totalFeedWater: number;
  };
  /** Temperature profile across effects */
  temperatureProfile: {
    effectNumber: number;
    brineTemp: number;
    vaporOutTemp: number;
    bpe: number;
    nea: number;
    demisterLoss: number;
    ductLoss: number;
    workingDeltaT: number;
    pressure: number; // mbar abs
  }[];
  /** TVC result (null for plain MED) */
  tvc: {
    /** Motive steam flow to TVC in kg/hr */
    motiveFlow: number;
    /** Entrained vapor flow from selected effect in kg/hr */
    entrainedFlow: number;
    /** Total discharge flow to Effect 1 in kg/hr */
    dischargeFlow: number;
    /** Entrainment ratio (entrained / motive) */
    entrainmentRatio: number;
    /** Compression ratio */
    compressionRatio: number;
    /** Vapor temperature to Effect 1 in °C (after desuperheating if needed) */
    vaporToEffect1Temp: number;
    /** Is the TVC discharge superheated? */
    isSuperheated: boolean;
  } | null;
  /** Recirculation flows per effect in kg/hr (from last-effect brine) */
  recirculation: {
    /** Per-effect recirculation flow in kg/hr */
    flows: number[];
    /** Total recirculation flow in kg/hr */
    totalFlow: number;
    /** Source: last effect brine temperature in °C */
    sourceTemp: number;
    /** Source: last effect brine salinity in ppm */
    sourceSalinity: number;
  };
  /** Convergence info */
  iterations: number;
  converged: boolean;
  warnings: string[];
}

/** Detailed preheater result with LMTD and sizing data */
export interface PreheaterDetail {
  /** Which effect supplies vapor */
  effectNumber: number;
  /** Vapor temperature from that effect in °C */
  vaporTemp: number;
  /** Vapor flow condensed in this preheater in kg/hr */
  vaporFlow: number;
  /** Seawater inlet temperature in °C */
  swInletTemp: number;
  /** Seawater outlet temperature in °C */
  swOutletTemp: number;
  /** Temperature rise across this preheater in °C */
  tempRise: number;
  /** LMTD for this preheater in °C */
  lmtd: number;
  /** Heat duty in kW */
  duty: number;
  /** Condensate flow in kg/hr (= vaporFlow, all vapor condenses) */
  condensateFlow: number;
  /** Condensate temperature in °C */
  condensateTemp: number;
  /** Which effect receives the condensate (1-based) */
  condensateToEffect: number;
}

// ============================================================================
// Temperature Profile
// ============================================================================

function buildTemperatureProfile(input: MEDEngineInput): {
  effectTemps: number[]; // pure-water saturation temp per effect
  steamTemp: number;
  lastEffectVaporTemp: number;
} {
  const N = input.numberOfEffects;
  const steamTemp = input.steamTemperature;
  const condenserApproach = input.condenserApproach ?? 4;
  const condenserOutlet = input.condenserOutletTemp ?? input.seawaterInletTemp + 5;
  const lastEffectVaporTemp = condenserOutlet + condenserApproach;

  // Equal spacing of effect saturation temperatures
  const totalRange = steamTemp - lastEffectVaporTemp;
  if (totalRange <= 0) {
    throw new Error(
      `No temperature driving force: steam (${steamTemp}°C) must be > last effect vapor (${lastEffectVaporTemp.toFixed(1)}°C)`
    );
  }

  const deltaTPerEffect = totalRange / N;
  const effectTemps: number[] = [];
  for (let i = 0; i < N; i++) {
    // Effect 1 is hottest, Effect N is coldest
    effectTemps.push(steamTemp - (i + 1) * deltaTPerEffect);
  }

  return { effectTemps, steamTemp, lastEffectVaporTemp };
}

// ============================================================================
// Core Engine — Calculate the cascade
// ============================================================================

const MAX_ITERATIONS = 20;
const CONVERGENCE_TOLERANCE = 0.001; // 0.1% change in distillate

export function calculateMED(input: MEDEngineInput): MEDEngineResult {
  const warnings: string[] = [];
  const N = input.numberOfEffects;
  const condenserOutlet = input.condenserOutletTemp ?? input.seawaterInletTemp + 5;
  const maxBrineSalinity = input.maxBrineSalinity;
  const swSalinity = input.seawaterSalinity;
  const concentrationFactor = maxBrineSalinity / swSalinity;

  // CaSO4 scaling risk warning (per Dr Rognoni)
  if (maxBrineSalinity > 60000) {
    warnings.push(
      `Max brine salinity (${(maxBrineSalinity / 1000).toFixed(0)} g/L) exceeds 60 g/L. ` +
        `Risk of CaSO4 scaling — verify seawater Ca++ concentration before finalising design.`
    );
  }

  // Temperature profile
  const { effectTemps, steamTemp } = buildTemperatureProfile(input);

  // Recirculation flows per effect — initially zero, populated after first sizing pass
  const recircFlows: number[] = new Array(N).fill(0);

  // Feed per effect: parallel feed, each effect gets equal seawater
  // Total feed = distillate × CF / (CF - 1) — but we don't know distillate yet.
  // Initial estimate: assume GOR ≈ N × 0.8 (rough), refine through iteration.
  const estimatedDistillate = input.steamFlow * N * 0.8;
  let feedPerEffect = (estimatedDistillate * concentrationFactor) / ((concentrationFactor - 1) * N);

  // Preheater configuration — filter to valid effect range (2..N-1)
  const phEffects = (input.preheaterEffects ?? []).filter((e) => e >= 2 && e <= N - 1);

  // Per-effect spray temperatures (computed after preheater sizing each iteration)
  // Initially all effects get condenser outlet temperature
  const sprayTemps: number[] = Array.from({ length: N }, () => condenserOutlet);

  // NCG in steam to Effect 1 (= dissolved gases from seawater in Effect 1)
  const swDensity = getSeawaterDensity(swSalinity, condenserOutlet);
  const ncgFromSeawater = ((feedPerEffect / swDensity) * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6;

  let converged = false;
  let iterations = 0;
  let prevTotalDistillate = 0;
  let prevSprayTemps: number[] = [...sprayTemps];

  let effects: MEDEffectResult[] = [];
  let preheaterDetails: PreheaterDetail[] = [];
  let finalCondenser: MEDFinalCondenserResult | null = null;

  // Last effect brine properties for recirculation (updated after each convergence)
  let lastEffectBrineTemp = 0;
  let lastEffectBrineSalinity = maxBrineSalinity;

  // ======================================================================
  // ITERATION LOOP
  // Coupling: preheater feed temps ↔ effect vapor temps
  //           feed per effect ↔ total distillate
  // ======================================================================

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    effects = [];

    // ---- Build preheater condensate routing from previous iteration ----
    const phCondensateMap = new Map<number, { flow: number; temp: number }>();
    for (const ph of preheaterDetails) {
      const target = ph.condensateToEffect;
      const existing = phCondensateMap.get(target) ?? { flow: 0, temp: 0 };
      const totalFlow = existing.flow + ph.condensateFlow;
      const blendedTemp =
        totalFlow > 0
          ? (existing.flow * existing.temp + ph.condensateFlow * ph.condensateTemp) / totalFlow
          : ph.condensateTemp;
      phCondensateMap.set(target, { flow: totalFlow, temp: blendedTemp });
    }

    // ---- TVC integration (if configured) ----
    // When TVC is enabled, steamFlow is the MOTIVE steam at high pressure.
    // The TVC entrains a portion of last-effect vapor. Discharge → Effect 1.
    // Remaining last-effect vapor → condenser.
    let tvcResult: TVCIntegrationResult | null = null;
    let vaporToEffect1 = input.steamFlow;
    let effect1SteamTemp = steamTemp;

    if (input.tvcMotivePressure && input.tvcMotivePressure > 0) {
      const entrainedEffectIdx = (input.tvcEntrainedEffect ?? N) - 1;
      // Use vapor temp from previous iteration's effects (or estimate for first iter)
      const entrainedVaporTemp =
        effects.length > entrainedEffectIdx
          ? effects[entrainedEffectIdx]!.totalVaporOut.temperature
          : effectTemps[Math.min(entrainedEffectIdx, N - 1)]!;

      const dischargePressure = getSaturationPressure(steamTemp);

      try {
        tvcResult = solveTVCIntegration({
          motivePressure: input.tvcMotivePressure,
          ...(input.tvcMotiveTemperature !== undefined && {
            motiveTemperature: input.tvcMotiveTemperature,
          }),
          entrainedEffectNumber: input.tvcEntrainedEffect ?? N,
          entrainedVaporTemp,
          dischargePressure,
          motiveFlow: input.steamFlow, // motive steam IS the input
          sprayWaterTemp: sprayTemps[0]!,
        });

        // E1 receives TVC discharge (motive + entrained)
        vaporToEffect1 = tvcResult.dischargeFlow;
        effect1SteamTemp = tvcResult.vaporToEffect1Temp;
      } catch (err) {
        warnings.push(
          `TVC calculation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // ---- Cascade through effects ----
    let prevVaporOut = vaporToEffect1;
    let prevVaporTemp = effect1SteamTemp;
    let distillateAccum = 0;
    let distillateTemp = steamTemp;
    let cascadedBrineFlow = 0;
    let cascadedBrineTemp = 0;
    let cascadedBrineSalinity = 0;
    let ncgAccum = ncgFromSeawater;

    // Build preheater config map (effect number → divert vapor)
    const preheaterMap = new Map<number, PreheaterConfig>();
    for (const phEff of phEffects) {
      // Vapor flow to preheater estimated from previous iteration
      const prevPH = preheaterDetails.find((p) => p.effectNumber === phEff);
      preheaterMap.set(phEff, {
        effectNumber: phEff,
        vaporFlow: prevPH?.vaporFlow ?? 0, // 0 on first iteration — will be sized after
        condensateToEffect: Math.min(phEff + 2, N),
      });
    }

    for (let i = 0; i < N; i++) {
      const effectNumber = i + 1;
      const phCond = phCondensateMap.get(effectNumber) ?? { flow: 0, temp: 0 };
      const effTemp = effectTemps[i];
      if (effTemp === undefined) {
        throw new Error(`Effect ${effectNumber}: temperature not defined in profile`);
      }

      const effectInput: EffectInput = {
        index: i,
        totalEffects: N,
        effectTemp: effTemp,
        steamTemp: i === 0 ? steamTemp : prevVaporTemp,

        // Tube side
        vaporInFlow: prevVaporOut,
        distillateInFlow: distillateAccum,
        distillateInTemp: distillateTemp,
        ncgInFlow: ncgAccum,
        preheaterCondensateInFlow: phCond.flow,
        preheaterCondensateInTemp: phCond.temp,

        // Shell side spray — per-effect temperature from preheater chain
        seawaterSprayFlow: feedPerEffect,
        seawaterSprayTemp: sprayTemps[i]!,
        seawaterSalinity: swSalinity,
        recircBrineFlow: 0, // Recirc computed post-sizing (equipment concern, not process balance)
        recircBrineTemp: 0,
        recircBrineSalinity: 0,

        // Shell side flash
        cascadedBrineFlow,
        cascadedBrineTemp,
        cascadedBrineSalinity,

        preheater: preheaterMap.get(effectNumber) ?? null,
        brineConcentrationFactor: concentrationFactor,
        bpeSafetyFactor: input.bpeSafetyFactor,
      };

      const result = calculateEffect(effectInput);
      effects.push(result);

      // Flag per-effect energy balance errors > 0.5%
      if (result.energyBalanceError > 0.5) {
        warnings.push(
          `Effect ${i + 1}: Energy balance error ${result.energyBalanceError.toFixed(2)}% exceeds 0.5% threshold.`
        );
      }

      // Cascade outputs → next effect inputs
      prevVaporOut = result.totalVaporOut.flow;
      prevVaporTemp = result.totalVaporOut.temperature;
      distillateAccum = result.distillateOut.flow;
      distillateTemp = result.distillateOut.temperature;
      cascadedBrineFlow = result.totalBrineOut.flow;
      cascadedBrineTemp = result.totalBrineOut.temperature;
      cascadedBrineSalinity = result.totalBrineOut.salinity;
      ncgAccum = result.tubeSide.ncgVent + result.shellSprayZone.ncgReleased;
    }

    // ---- TVC: subtract entrained vapor from selected effect ----
    // The TVC entrains a portion of the last effect's vapor. The remainder
    // goes to the final condenser. If entrained > available, warn.
    if (tvcResult) {
      const entrainedIdx = (input.tvcEntrainedEffect ?? N) - 1;
      const entrainedEffect = effects[entrainedIdx];
      if (entrainedEffect) {
        const availableVapor = entrainedEffect.totalVaporOut.flow;
        if (tvcResult.entrainedFlow > availableVapor * 1.05) {
          warnings.push(
            `TVC wants to entrain ${Math.round(tvcResult.entrainedFlow)} kg/hr but Effect ${entrainedIdx + 1} only produces ${Math.round(availableVapor)} kg/hr. Reduce motive steam or motive pressure.`
          );
        }
        const actualEntrained = Math.min(tvcResult.entrainedFlow, availableVapor);
        const remainingVapor = availableVapor - actualEntrained;
        effects[entrainedIdx] = {
          ...entrainedEffect,
          totalVaporOut: {
            ...entrainedEffect.totalVaporOut,
            flow: remainingVapor,
            energy: (remainingVapor * entrainedEffect.totalVaporOut.enthalpy) / 3600,
          },
          vaporOut: {
            ...entrainedEffect.vaporOut,
            flow: remainingVapor,
            energy: (remainingVapor * entrainedEffect.vaporOut.enthalpy) / 3600,
          },
        };
      }
    }

    // ---- Final condenser ----
    if (effects.length < N) {
      throw new Error(
        `Only ${effects.length} of ${N} effects could be calculated. Check temperature range.`
      );
    }
    const lastEffect = effects[N - 1]!;
    finalCondenser = calculateFinalCondenser({
      vaporInFlow: lastEffect.totalVaporOut.flow,
      vaporInTemp: lastEffect.totalVaporOut.temperature,
      distillateInFlow: distillateAccum,
      distillateInTemp: distillateTemp,
      condensateInFlow: 0,
      condensateInTemp: 0,
      seawaterInletTemp: input.seawaterInletTemp,
      seawaterOutletTemp: condenserOutlet,
      seawaterSalinity: swSalinity,
      distillateOutTemp: condenserOutlet - 2,
    });

    // ---- Preheaters (individually sized) ----
    // Seawater flows through preheaters in series: coldest PH first → hottest last
    // The flow through preheaters = total FEED water (spray to effects), not
    // the full condenser seawater (which includes cooling water rejection).
    const totalSWFlow = feedPerEffect * N;
    preheaterDetails = [];

    if (phEffects.length > 0) {
      // Sort by descending effect number (coldest PH first in the chain)
      const sortedPHEffects = [...phEffects].sort((a, b) => b - a);
      let currentSWTemp = condenserOutlet;

      for (const phEff of sortedPHEffects) {
        const sourceEffect = effects[phEff - 1];
        if (!sourceEffect) continue;

        const vaporTemp = sourceEffect.totalVaporOut.temperature;
        const latentHeat = getLatentHeat(vaporTemp);

        // Estimate vapor flow to divert: enough to raise SW temp by ~3-4°C
        // Q = m_sw × Cp × ΔT = m_vapor × hfg
        const cpSW = getSeawaterSpecificHeat(swSalinity, currentSWTemp);
        const maxRise = input.preheaterTempRiseMap?.[phEff] ?? input.preheaterTempRise ?? 4.0;
        const targetTempRise = Math.min(maxRise, vaporTemp - currentSWTemp - 2.0); // leave 2°C approach
        if (targetTempRise <= 0.5) continue; // skip if no meaningful heating possible

        const qNeeded = (totalSWFlow * cpSW * targetTempRise) / 3600; // kW
        const vaporNeeded = (qNeeded * 3600) / latentHeat; // kg/hr

        // Calculate this preheater
        const phResult = calculatePreheater({
          config: { effectNumber: phEff, vaporFlow: vaporNeeded },
          vaporTemperature: vaporTemp,
          seawaterFlow: totalSWFlow,
          seawaterInletTemp: currentSWTemp,
          seawaterSalinity: swSalinity,
        });

        const condensateToEffect = Math.min(phEff + 2, N);

        preheaterDetails.push({
          effectNumber: phEff,
          vaporTemp,
          vaporFlow: phResult.vaporFlow,
          swInletTemp: phResult.seawaterInletTemp,
          swOutletTemp: phResult.seawaterOutletTemp,
          tempRise: phResult.seawaterOutletTemp - phResult.seawaterInletTemp,
          lmtd: phResult.lmtd,
          duty: phResult.heatExchanged,
          condensateFlow: phResult.condensateFlow,
          condensateTemp: phResult.condensateTemperature,
          condensateToEffect,
        });

        currentSWTemp = phResult.seawaterOutletTemp;
      }

      // ---- Compute per-effect spray temperatures from preheater chain ----
      // Seawater flows from condenser → PH (highest effect) → PH (next) → ... → PH (lowest effect)
      // Effects downstream of all preheaters get condenser outlet temp.
      // Each effect gets the seawater temperature AT the point it's peeled off.
      //
      // sortedPHEffects is [E7, E5, E3, E2] (descending) — the chain order.
      // After passing through PH on E7, SW temp rises. Effects E1-E6 get this temp.
      // After passing through PH on E5, SW temp rises more. Effects E1-E4 get this temp.
      // etc.
      //
      // Logic: start all at condenserOutlet. For each PH (in chain order, descending),
      // all effects with effectNumber < phEffectNumber get the outlet temperature.
      // The last effect and effects between preheaters get intermediate temperatures.

      // Start: all effects at condenser outlet
      for (let i = 0; i < N; i++) sprayTemps[i] = condenserOutlet;

      // Walk the preheater chain (sorted descending: coldest PH first)
      let chainTemp = condenserOutlet;
      for (const ph of preheaterDetails) {
        chainTemp = ph.swOutletTemp;
        // All effects UPSTREAM of this preheater (lower effect number) get this temp
        for (let i = 0; i < ph.effectNumber - 1; i++) {
          sprayTemps[i] = chainTemp;
        }
      }
    } else {
      // No preheaters: all effects get condenser outlet
      for (let i = 0; i < N; i++) sprayTemps[i] = condenserOutlet;
    }

    // ---- Cap spray temperature per effect ----
    // Spray must enter BELOW the effect's vapour saturation temperature
    // to avoid flashing at the spray nozzle. Maximum approach: 5°C below
    // vapour temperature. Ideally just below saturation for minimum
    // sensible heating.
    const SPRAY_APPROACH_MIN = 2.0; // °C below vapour saturation temperature
    for (let i = 0; i < N; i++) {
      const maxSprayTemp = effectTemps[i]! - SPRAY_APPROACH_MIN;
      if (sprayTemps[i]! > maxSprayTemp) {
        sprayTemps[i] = maxSprayTemp;
      }
    }

    // ---- Update preheater vapor diversion in effect calculation ----
    // The preheater configs now have actual vapor flows — update the map
    for (const ph of preheaterDetails) {
      preheaterMap.set(ph.effectNumber, {
        effectNumber: ph.effectNumber,
        vaporFlow: ph.vaporFlow,
        condensateToEffect: ph.condensateToEffect,
      });
    }

    // ---- Compute total distillate ----
    // Net distillate = condenser distillate output - Effect 1 condensate (returns to steam source)
    const totalDistillateOut = finalCondenser.distillateOut.flow;
    const effect1Condensate = input.steamFlow; // steam condensate returns to boiler
    const netDistillate = totalDistillateOut - effect1Condensate;

    // ---- Update feed per effect from actual distillate ----
    if (netDistillate > 0) {
      const totalFeed = (netDistillate * concentrationFactor) / (concentrationFactor - 1);
      feedPerEffect = totalFeed / N;
    }

    // ---- Check convergence ----
    if (iter > 0 && prevTotalDistillate > 0) {
      const change = Math.abs(netDistillate - prevTotalDistillate) / prevTotalDistillate;
      if (change < CONVERGENCE_TOLERANCE) {
        // Secondary check: spray temperatures should also have stabilized
        const maxSprayChange = sprayTemps.reduce(
          (mx, t, i) => Math.max(mx, Math.abs(t - prevSprayTemps[i]!)),
          0
        );
        if (maxSprayChange > 0.5) {
          warnings.push(
            `Spray temperatures still changing (max Δ ${maxSprayChange.toFixed(2)}°C) despite distillate convergence. Results may be approximate.`
          );
        }
        converged = true;
        prevTotalDistillate = netDistillate;
        break;
      }
    }
    prevTotalDistillate = netDistillate;
    prevSprayTemps = [...sprayTemps];
  }

  if (!converged && iterations >= MAX_ITERATIONS) {
    warnings.push(
      `Engine did not converge within ${MAX_ITERATIONS} iterations. Results are approximate.`
    );
  }

  // ======================================================================
  // EQUIPMENT SIZING + DEMISTER ΔT COUPLING
  //
  // The demister pad fills the shell cross-section, so its pressure drop
  // depends on the shell diameter which comes from equipment sizing. But
  // the equipment sizing depends on the H&M balance which depends on the
  // demister ΔT. This coupling is resolved by iterating:
  //
  //   1. Size equipment → get shell/bundle diameter per effect
  //   2. Compute actual demister velocity from shell geometry
  //   3. Compute actual demister ΔT at that velocity
  //   4. If ΔT changed significantly, re-run cascade with updated ΔT
  //   5. Re-size equipment, repeat until stable (typically 1–2 iterations)
  // ======================================================================

  let equipmentSizing: EquipmentSizingResult | null = null;
  const demisterDeltaTOverrides: (number | undefined)[] = new Array(N).fill(undefined);
  const ductDeltaTOverrides: (number | undefined)[] = new Array(N).fill(undefined);
  const vaporPathResults: VaporPathGeometry[] = [];

  const buildSizingInputs = (): MEDPlantInputs => ({
    plantType: input.tvcMotivePressure ? 'MED_TVC' : 'MED',
    numberOfEffects: N,
    preheaters: preheaterDetails.map((ph) => ({
      effectNumber: ph.effectNumber,
      vaporFlow: ph.vaporFlow,
    })),
    capacity: prevTotalDistillate / 1000,
    gorTarget: prevTotalDistillate / input.steamFlow,
    steamPressure: getSaturationPressure(steamTemp),
    steamTemperature: steamTemp,
    seawaterInletTemp: input.seawaterInletTemp,
    seawaterDischargeTemp: condenserOutlet,
    seawaterSalinity: swSalinity,
    topBrineTemp: effectTemps[0] ?? steamTemp - 3,
    brineConcentrationFactor: concentrationFactor,
    condenserApproachTemp: input.condenserApproach ?? 4,
    distillateTemp: condenserOutlet - 2,
    condensateExtraction: 'FINAL_CONDENSER',
    foulingFactor: input.foulingResistance ?? 0.00015,
    evaporatorTubes: {
      od: input.evapTubeOD ?? 25.4,
      thickness: input.evapTubeWall ?? 1.0,
      length: input.evapTubeLength ?? 1.2,
      material: (input.evapTubeMaterial ?? 'titanium') as TubeMaterial,
    },
    condenserTubes: {
      od: input.condTubeOD ?? 17,
      thickness: input.condTubeWall ?? 0.4,
      length: input.condTubeLength ?? 2.1,
      material: 'titanium',
    },
  });

  const buildPHForSizing = (): MEDPreheaterResult[] =>
    preheaterDetails.map((ph) => ({
      effectNumber: ph.effectNumber,
      vaporFlow: ph.vaporFlow,
      vaporTemperature: ph.vaporTemp,
      seawaterFlow: feedPerEffect * N,
      seawaterInletTemp: ph.swInletTemp,
      seawaterOutletTemp: ph.swOutletTemp,
      heatExchanged: ph.duty,
      lmtd: ph.lmtd,
      condensateFlow: ph.condensateFlow,
      condensateTemperature: ph.condensateTemp,
    }));

  const MAX_DP_ITERATIONS = 3;
  const DP_CONVERGENCE_THRESHOLD = 0.02; // °C — below this, ΔT change is negligible
  const tubeOD = input.evapTubeOD ?? 25.4;
  const pitch = tubeOD * 1.315; // triangular pitch

  for (let dpIter = 0; dpIter < MAX_DP_ITERATIONS; dpIter++) {
    // ---- Size equipment ----
    try {
      equipmentSizing = sizeEquipment(
        effects,
        finalCondenser!,
        buildPHForSizing(),
        buildSizingInputs()
      );
    } catch (err) {
      warnings.push(`Equipment sizing: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    // ---- Compute actual demister & duct ΔT from lateral shell geometry ----
    let maxDeltaTChange = 0;
    const tubeLength = input.evapTubeLength ?? 1.2;

    for (let i = 0; i < N; i++) {
      const ev = equipmentSizing.evaporators[i];
      if (!ev || ev.tubeCount <= 0) {
        // Effect failed sizing (negative working ΔT) — keep previous overrides
        // so the default doesn't revert to a potentially incorrect estimate
        continue;
      }

      const eff = effects[i]!;
      const effTemp = eff.temperature;
      const rhoV = getDensityVapor(Math.max(effTemp, 5));
      const rhoL = 998; // pure water density approx — for Souders-Brown ratio
      const vaporMassFlow = eff.totalVaporOut.flow / 3600; // kg/hr → kg/s
      const vaporVolFlow = rhoV > 0 ? vaporMassFlow / rhoV : 0; // m³/s

      // Shell ID from actual tube count using lateral bundle geometry
      const shellID_mm = findMinShellID(ev.tubeCount, tubeOD, pitch, true);

      // Compute demister & duct geometry in the free (right) semicircle
      const vpg = computeVaporPathGeometry(shellID_mm, tubeLength, vaporVolFlow, rhoV, rhoL);

      // Demister ΔT from actual velocity through pad
      const actualDemDT = calculateDemisterDeltaTFromVelocity(effTemp, vpg.demisterVelocity);

      // Duct ΔT from velocity-head model at actual steam flow area velocity
      const actualDuctDT =
        vpg.steamFlowArea > 0 && vpg.steamFlowVelocity > 0
          ? pressureDropToTempDrop(
              effTemp,
              DUCT_K_FACTOR * 0.5 * rhoV * vpg.steamFlowVelocity * vpg.steamFlowVelocity
            )
          : 0;

      // Track maximum change for convergence check
      const demChange = Math.abs(actualDemDT - eff.demisterDeltaT);
      const ductChange = Math.abs(actualDuctDT - eff.ductDeltaT);
      const change = Math.max(demChange, ductChange);
      if (change > maxDeltaTChange) maxDeltaTChange = change;

      demisterDeltaTOverrides[i] = actualDemDT;
      ductDeltaTOverrides[i] = actualDuctDT;
      vaporPathResults[i] = vpg;
    }

    // ---- Check convergence ----
    if (maxDeltaTChange < DP_CONVERGENCE_THRESHOLD) break; // converged

    // ---- Re-run cascade with updated demister ΔT overrides ----
    effects = [];
    let prevVaporOut = input.steamFlow;
    let prevVaporTemp = steamTemp;
    let distillateAccum = 0;
    let distillateTemp = steamTemp;
    let cascadedBrineFlow = 0;
    let cascadedBrineTemp = 0;
    let cascadedBrineSalinity = 0;
    let ncgAccum = ncgFromSeawater;

    // TVC re-integration (if configured)
    if (input.tvcMotivePressure && input.tvcMotivePressure > 0) {
      try {
        const entrainedIdx = (input.tvcEntrainedEffect ?? N) - 1;
        const entrainedVaporTemp = effectTemps[Math.min(entrainedIdx, N - 1)]!;
        const tvcR = solveTVCIntegration({
          motivePressure: input.tvcMotivePressure,
          ...(input.tvcMotiveTemperature !== undefined && {
            motiveTemperature: input.tvcMotiveTemperature,
          }),
          entrainedEffectNumber: input.tvcEntrainedEffect ?? N,
          entrainedVaporTemp,
          dischargePressure: getSaturationPressure(steamTemp),
          motiveFlow: input.steamFlow,
          sprayWaterTemp: sprayTemps[0]!,
        });
        prevVaporOut = tvcR.dischargeFlow;
        prevVaporTemp = tvcR.vaporToEffect1Temp;
      } catch {
        // TVC failed — use plain steam
      }
    }

    // Build preheater condensate map from last converged preheater details
    const phCondMap = new Map<number, { flow: number; temp: number }>();
    for (const ph of preheaterDetails) {
      const target = ph.condensateToEffect;
      const existing = phCondMap.get(target) ?? { flow: 0, temp: 0 };
      const totalFlow = existing.flow + ph.condensateFlow;
      const blendedTemp =
        totalFlow > 0
          ? (existing.flow * existing.temp + ph.condensateFlow * ph.condensateTemp) / totalFlow
          : ph.condensateTemp;
      phCondMap.set(target, { flow: totalFlow, temp: blendedTemp });
    }

    const preheaterMap = new Map<number, PreheaterConfig>();
    for (const ph of preheaterDetails) {
      preheaterMap.set(ph.effectNumber, {
        effectNumber: ph.effectNumber,
        vaporFlow: ph.vaporFlow,
        condensateToEffect: ph.condensateToEffect,
      });
    }

    for (let i = 0; i < N; i++) {
      const effectNumber = i + 1;
      const phCond = phCondMap.get(effectNumber) ?? { flow: 0, temp: 0 };
      const effTemp = effectTemps[i]!;

      const effectInput: EffectInput = {
        index: i,
        totalEffects: N,
        effectTemp: effTemp,
        steamTemp: i === 0 ? steamTemp : prevVaporTemp,
        vaporInFlow: prevVaporOut,
        distillateInFlow: distillateAccum,
        distillateInTemp: distillateTemp,
        ncgInFlow: ncgAccum,
        preheaterCondensateInFlow: phCond.flow,
        preheaterCondensateInTemp: phCond.temp,
        seawaterSprayFlow: feedPerEffect,
        seawaterSprayTemp: sprayTemps[i]!,
        seawaterSalinity: swSalinity,
        recircBrineFlow: 0,
        recircBrineTemp: 0,
        recircBrineSalinity: 0,
        cascadedBrineFlow,
        cascadedBrineTemp,
        cascadedBrineSalinity,
        preheater: preheaterMap.get(effectNumber) ?? null,
        brineConcentrationFactor: concentrationFactor,
        bpeSafetyFactor: input.bpeSafetyFactor,
        demisterDeltaTOverride: demisterDeltaTOverrides[i],
        ductDeltaTOverride: ductDeltaTOverrides[i],
      };

      const result = calculateEffect(effectInput);
      effects.push(result);

      prevVaporOut = result.totalVaporOut.flow;
      prevVaporTemp = result.totalVaporOut.temperature;
      distillateAccum = result.distillateOut.flow;
      distillateTemp = result.distillateOut.temperature;
      cascadedBrineFlow = result.totalBrineOut.flow;
      cascadedBrineTemp = result.totalBrineOut.temperature;
      cascadedBrineSalinity = result.totalBrineOut.salinity;
      ncgAccum = result.tubeSide.ncgVent + result.shellSprayZone.ncgReleased;
    }

    // Re-apply TVC entrainment subtraction (same logic as main loop)
    if (input.tvcMotivePressure && input.tvcMotivePressure > 0) {
      try {
        const entrainedIdx = (input.tvcEntrainedEffect ?? N) - 1;
        const entrainedEffect = effects[entrainedIdx];
        if (entrainedEffect) {
          const tvcR = solveTVCIntegration({
            motivePressure: input.tvcMotivePressure,
            ...(input.tvcMotiveTemperature !== undefined && {
              motiveTemperature: input.tvcMotiveTemperature,
            }),
            entrainedEffectNumber: input.tvcEntrainedEffect ?? N,
            entrainedVaporTemp: entrainedEffect.totalVaporOut.temperature,
            dischargePressure: getSaturationPressure(steamTemp),
            motiveFlow: input.steamFlow,
            sprayWaterTemp: sprayTemps[0]!,
          });
          const actualEntrained = Math.min(tvcR.entrainedFlow, entrainedEffect.totalVaporOut.flow);
          const remainingVapor = entrainedEffect.totalVaporOut.flow - actualEntrained;
          effects[entrainedIdx] = {
            ...entrainedEffect,
            totalVaporOut: {
              ...entrainedEffect.totalVaporOut,
              flow: remainingVapor,
              energy: (remainingVapor * entrainedEffect.totalVaporOut.enthalpy) / 3600,
            },
            vaporOut: {
              ...entrainedEffect.vaporOut,
              flow: remainingVapor,
              energy: (remainingVapor * entrainedEffect.vaporOut.enthalpy) / 3600,
            },
          };
        }
      } catch {
        // TVC re-application failed — proceed with uncorrected effects
      }
    }

    // Re-compute final condenser with updated cascade
    const lastEff = effects[N - 1]!;
    finalCondenser = calculateFinalCondenser({
      vaporInFlow: lastEff.totalVaporOut.flow,
      vaporInTemp: lastEff.totalVaporOut.temperature,
      distillateInFlow: distillateAccum,
      distillateInTemp: distillateTemp,
      condensateInFlow: 0,
      condensateInTemp: 0,
      seawaterInletTemp: input.seawaterInletTemp,
      seawaterOutletTemp: condenserOutlet,
      seawaterSalinity: swSalinity,
      distillateOutTemp: condenserOutlet - 2,
    });

    // Update distillate total for next sizing
    const totalDistOut = finalCondenser.distillateOut.flow;
    prevTotalDistillate = totalDistOut - input.steamFlow;
  }

  // ======================================================================
  // RECIRCULATION COMPUTATION
  // After sizing, compute the recirculation flow needed per effect to
  // achieve adequate wetting. Recirculation is pumped from the last effect
  // brine pool — it's an equipment concern, not a process balance change
  // (the recirc brine is at near-equilibrium temperature, so it doesn't
  // significantly affect evaporation rates or GOR).
  // ======================================================================

  const TARGET_WETTING_RATE = 0.045; // 1.5× minimum of 0.03 kg/(m·s)

  if (equipmentSizing) {
    const lastEff = effects[N - 1];
    if (lastEff) {
      lastEffectBrineTemp = lastEff.totalBrineOut.temperature;
      lastEffectBrineSalinity = lastEff.totalBrineOut.salinity;
    }

    for (let i = 0; i < N; i++) {
      const ev = equipmentSizing.evaporators[i];
      if (!ev || ev.tubeCount === 0) continue;

      const sprayFlow = effects[i]!.sprayWater.flow / 3600; // kg/s
      // VGB wetting rate: Γ = ṁ / (2 × L × n_rows)
      const nRows =
        ev.bundleDiameter > 0
          ? Math.floor(ev.bundleDiameter / (ev.tubeOD * 1.315 * Math.sin((60 * Math.PI) / 180)))
          : 1;
      const currentWetting =
        nRows > 0 && ev.tubeLength > 0 ? sprayFlow / (2 * ev.tubeLength * nRows) : 0;

      if (currentWetting < TARGET_WETTING_RATE) {
        // Required total flow: Γ_target × 2 × L × n_rows
        const requiredTotalFlow = TARGET_WETTING_RATE * 2 * ev.tubeLength * nRows * 3600; // kg/hr
        recircFlows[i] = Math.max(0, requiredTotalFlow - effects[i]!.sprayWater.flow);
      }
    }
  }

  // ======================================================================
  // BUILD RESULT
  // ======================================================================

  const netDistillate = prevTotalDistillate;
  // For MED-TVC, GOR is based on motive steam consumption (not total vapor to E1)
  const actualSteamConsumed = input.steamFlow; // motive steam is the input in both cases
  const gor = netDistillate / actualSteamConsumed;
  const latentHeatSteam = getEnthalpyVapor(steamTemp) - getEnthalpyLiquid(steamTemp);

  // Build TVC result for output
  const lastTvcResult = (() => {
    if (!input.tvcMotivePressure) return null;
    // Re-solve TVC with final effect temperatures for accurate result
    const entrainedIdx = (input.tvcEntrainedEffect ?? N) - 1;
    const entrainedEffect = effects[entrainedIdx];
    if (!entrainedEffect) return null;
    try {
      const tvr = solveTVCIntegration({
        motivePressure: input.tvcMotivePressure,
        ...(input.tvcMotiveTemperature !== undefined && {
          motiveTemperature: input.tvcMotiveTemperature,
        }),
        entrainedEffectNumber: input.tvcEntrainedEffect ?? N,
        entrainedVaporTemp: entrainedEffect.totalVaporOut.temperature,
        dischargePressure: getSaturationPressure(steamTemp),
        motiveFlow: input.steamFlow,
        sprayWaterTemp: sprayTemps[0]!,
      });
      return {
        motiveFlow: tvr.motiveFlow,
        entrainedFlow: tvr.entrainedFlow,
        dischargeFlow: tvr.dischargeFlow,
        entrainmentRatio: tvr.tvc.entrainmentRatio,
        compressionRatio: tvr.tvc.compressionRatio,
        vaporToEffect1Temp: tvr.vaporToEffect1Temp,
        isSuperheated: tvr.isSuperheated,
      };
    } catch (err) {
      warnings.push(`TVC output rebuild: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  })();
  const ste = latentHeatSteam / Math.max(gor, 0.01);
  const ste_kWh = (ste * 1000) / 3600;

  const lastEffect = effects[N - 1]!;
  const totalFeedWater = feedPerEffect * N;
  const seawaterIntake = finalCondenser!.seawaterIn.flow;
  const coolingWater = seawaterIntake - totalFeedWater;
  const brineBlowdown = lastEffect.totalBrineOut.flow;
  const brineSalinity = lastEffect.totalBrineOut.salinity;

  // Temperature profile
  const temperatureProfile = effects.map((eff) => ({
    effectNumber: eff.effectNumber,
    brineTemp: eff.temperature + eff.bpe,
    vaporOutTemp: eff.totalVaporOut.temperature,
    bpe: eff.bpe,
    nea: eff.nea,
    demisterLoss: eff.demisterDeltaT,
    ductLoss: eff.ductDeltaT,
    workingDeltaT: eff.effectiveDeltaT,
    pressure: getSaturationPressure(eff.temperature) * 1000, // bar → mbar
  }));

  return {
    effects,
    finalCondenser: finalCondenser!,
    preheaters: preheaterDetails,
    equipmentSizing,
    vaporPathGeometry: vaporPathResults,
    performance: {
      gor: Math.round(gor * 100) / 100,
      netDistillate: Math.round(netDistillate),
      netDistillateM3Day: Math.round((netDistillate / 998) * 24 * 10) / 10,
      specificThermalEnergy: Math.round(ste * 10) / 10,
      specificThermalEnergy_kWh: Math.round(ste_kWh * 10) / 10,
      seawaterIntake: Math.round(seawaterIntake),
      brineBlowdown: Math.round(brineBlowdown),
      brineSalinity: Math.round(brineSalinity),
      coolingWater: Math.round(coolingWater),
      totalFeedWater: Math.round(totalFeedWater),
    },
    temperatureProfile,
    tvc: lastTvcResult,
    recirculation: {
      flows: recircFlows.map((f) => Math.round(f)),
      totalFlow: Math.round(recircFlows.reduce((s, f) => s + f, 0)),
      sourceTemp: Math.round(lastEffectBrineTemp * 10) / 10,
      sourceSalinity: Math.round(lastEffectBrineSalinity),
    },
    iterations,
    converged,
    warnings: [...new Set(warnings)],
  };
}
