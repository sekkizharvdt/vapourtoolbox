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
  TOTAL_DISSOLVED_GAS_MG_PER_LITRE,
} from '@vapour/constants';
import type { MEDEffectResult, MEDFinalCondenserResult, PreheaterConfig } from '@vapour/types';
import { calculateEffect, type EffectInput } from './effectModel';
import { calculatePreheater } from './preheaterModel';
import { calculateFinalCondenser } from './finalCondenserModel';

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
  const ductLoss = input.ductLoss ?? 0.3;
  const condenserOutlet = input.condenserOutletTemp ?? input.seawaterInletTemp + 5;
  const maxBrineSalinity = input.maxBrineSalinity;
  const swSalinity = input.seawaterSalinity;
  const concentrationFactor = maxBrineSalinity / swSalinity;

  // Temperature profile
  const { effectTemps, steamTemp } = buildTemperatureProfile(input);

  // Feed per effect: parallel feed, each effect gets equal seawater
  // Total feed = distillate × CF / (CF - 1) — but we don't know distillate yet.
  // Initial estimate: assume GOR ≈ N × 0.8 (rough), refine through iteration.
  const estimatedDistillate = input.steamFlow * N * 0.8;
  let feedPerEffect = (estimatedDistillate * concentrationFactor) / ((concentrationFactor - 1) * N);

  // Preheater configuration
  const phEffects = input.preheaterEffects ?? [];

  // Initial feed temperature = condenser outlet (no preheaters on first pass)
  let feedWaterTemp = condenserOutlet;

  // NCG in steam to Effect 1 (= dissolved gases from seawater in Effect 1)
  const swDensity = getSeawaterDensity(swSalinity, feedWaterTemp);
  const ncgFromSeawater = ((feedPerEffect / swDensity) * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6;

  let converged = false;
  let iterations = 0;
  let prevTotalDistillate = 0;

  let effects: MEDEffectResult[] = [];
  let preheaterDetails: PreheaterDetail[] = [];
  let finalCondenser: MEDFinalCondenserResult | null = null;

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

    // ---- Cascade through effects ----
    let prevVaporOut = input.steamFlow; // kg/hr — steam entering Effect 1
    let prevVaporTemp = steamTemp;
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

      const effectInput: EffectInput = {
        index: i,
        totalEffects: N,
        effectTemp: effectTemps[i]!,
        steamTemp: i === 0 ? steamTemp : prevVaporTemp,

        // Tube side
        vaporInFlow: prevVaporOut,
        distillateInFlow: distillateAccum,
        distillateInTemp: distillateTemp,
        ncgInFlow: ncgAccum,
        preheaterCondensateInFlow: phCond.flow,
        preheaterCondensateInTemp: phCond.temp,

        // Shell side spray
        seawaterSprayFlow: feedPerEffect,
        seawaterSprayTemp: feedWaterTemp,
        seawaterSalinity: swSalinity,
        recircBrineFlow: 0, // Recirculation added in later iteration when tube count is known
        recircBrineTemp: 0,
        recircBrineSalinity: 0,

        // Shell side flash
        cascadedBrineFlow,
        cascadedBrineTemp,
        cascadedBrineSalinity,

        preheater: preheaterMap.get(effectNumber) ?? null,
        brineConcentrationFactor: concentrationFactor,
      };

      const result = calculateEffect(effectInput);
      effects.push(result);

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

    // ---- Final condenser ----
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
        const targetTempRise = Math.min(4.0, vaporTemp - currentSWTemp - 2.0); // leave 2°C approach
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

      // Update feed water temperature from preheater chain outlet
      feedWaterTemp = currentSWTemp;
    } else {
      feedWaterTemp = condenserOutlet;
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
        converged = true;
        prevTotalDistillate = netDistillate;
        break;
      }
    }
    prevTotalDistillate = netDistillate;
  }

  if (!converged && iterations >= MAX_ITERATIONS) {
    warnings.push(
      `Engine did not converge within ${MAX_ITERATIONS} iterations. Results are approximate.`
    );
  }

  // ======================================================================
  // BUILD RESULT
  // ======================================================================

  const netDistillate = prevTotalDistillate;
  const gor = netDistillate / input.steamFlow;
  const latentHeatSteam = getEnthalpyVapor(steamTemp) - getEnthalpyLiquid(steamTemp);
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
    demisterLoss: eff.deltaTPressureDrop,
    ductLoss: ductLoss,
    workingDeltaT: eff.effectiveDeltaT,
    pressure: getSaturationPressure(eff.temperature) * 1000, // bar → mbar
  }));

  return {
    effects,
    finalCondenser: finalCondenser!,
    preheaters: preheaterDetails,
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
    iterations,
    converged,
    warnings,
  };
}
