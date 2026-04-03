/**
 * MED Plant Iterative Solver
 *
 * Master solver that orchestrates the effect-by-effect calculation,
 * preheater integration, and final condenser to produce a complete
 * plant heat and mass balance.
 *
 * Physical model:
 *   - Parallel seawater feed: each effect receives fresh seawater spray
 *   - Forward brine cascade: brine accumulates from effect 1 → N
 *   - Last-effect brine recirculation: pumped back to each effect's spray
 *     nozzles to maintain adequate tube wetting rate
 *   - Tube side / shell side separation per effect
 *   - NCG tracking through the plant
 *
 * Algorithm:
 * 1. Establish temperature profile across effects
 * 2. Initial guess for steam flow from GOR target
 * 3. Two-level iteration:
 *    a. Outer loop: adjust steam flow to match target capacity (secant method)
 *    b. Inner loop: converge last-effect brine recirculation (need last-effect
 *       brine conditions before we can set recirculation for all effects)
 * 4. Solve all effects sequentially (forward pass)
 * 5. Solve final condenser → determine seawater intake
 * 6. Solve preheater chain → adjust seawater feed temperatures
 * 7. Build overall balance and performance summary
 *
 * References:
 * - El-Dessouky & Ettouney (2002) "Fundamentals of Salt Water Desalination"
 */

import {
  getSaturationTemperature,
  getSaturationPressure,
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getSeawaterEnthalpy,
  getSeawaterDensity,
  MED_SOLVER_CONFIG,
  TOTAL_DISSOLVED_GAS_MG_PER_LITRE,
  ROGNONI_REFERENCE,
} from '@vapour/constants';
import type {
  MEDPlantInputs,
  MEDPlantResult,
  MEDEffectResult,
  MEDFinalCondenserResult,
  MEDPreheaterResult,
  MEDOverallBalance,
} from '@vapour/types';
import { calculateEffect, makeStream, type EffectInput } from './effectModel';
import { calculatePreheaterChain } from './preheaterModel';
import { calculateFinalCondenser } from './finalCondenserModel';
import { solveTVCIntegration, type TVCIntegrationResult } from './tvcIntegration';

// ============================================================================
// Validation
// ============================================================================

export function validateMEDInputs(inputs: MEDPlantInputs): string[] {
  const errors: string[] = [];

  if (inputs.numberOfEffects < 2 || inputs.numberOfEffects > 16) {
    errors.push('Number of effects must be between 2 and 16');
  }
  if (inputs.capacity <= 0) {
    errors.push('Capacity must be greater than 0');
  }
  if (inputs.steamPressure <= 0) {
    errors.push('Steam pressure must be greater than 0');
  }
  if (inputs.topBrineTemp <= inputs.seawaterInletTemp) {
    errors.push('Top brine temperature must be above seawater inlet temperature');
  }
  if (inputs.brineConcentrationFactor < 1.1 || inputs.brineConcentrationFactor > 2.0) {
    errors.push('Brine concentration factor must be between 1.1 and 2.0');
  }

  // Steam temperature must be above TBT
  const tSatSteam = getSaturationTemperature(inputs.steamPressure);
  if (tSatSteam < inputs.topBrineTemp) {
    errors.push(
      `Steam saturation temperature (${tSatSteam.toFixed(1)}°C) is below top brine temperature (${inputs.topBrineTemp}°C). Increase steam pressure.`
    );
  }

  return errors;
}

// ============================================================================
// Temperature Profile
// ============================================================================

/**
 * Calculate the temperature profile across all effects.
 * Effects are numbered 1 (hottest) to N (coldest).
 *
 * The last effect temperature is determined from the condenser approach:
 *   T_last = T_sw_discharge + condenserApproachTemp
 *
 * Temperature spacing is approximately equal.
 */
function calculateTemperatureProfile(inputs: MEDPlantInputs): {
  effectTemps: number[];
  steamTemp: number;
  lastEffectTemp: number;
} {
  const N = inputs.numberOfEffects;
  const steamTemp = getSaturationTemperature(inputs.steamPressure);

  // Last effect temperature — set by condenser approach + discharge temp
  const lastEffectTemp = inputs.seawaterDischargeTemp + inputs.condenserApproachTemp;

  // Equal ΔT spacing between effects
  const totalDeltaT = inputs.topBrineTemp - lastEffectTemp;
  const deltaTPerEffect = totalDeltaT / (N - 1);

  const effectTemps: number[] = [];
  for (let i = 0; i < N; i++) {
    effectTemps.push(inputs.topBrineTemp - i * deltaTPerEffect);
  }

  return { effectTemps, steamTemp, lastEffectTemp };
}

// ============================================================================
// Wetting Rate — Recirculation Flow Calculation
// ============================================================================

/**
 * Calculate the recirculation brine flow needed per effect to satisfy
 * the minimum wetting rate on the tube bundle.
 *
 * Wetting rate Γ = total spray flow / (2 × N_tubes × L_tube)
 * Target: 1.5 × minimum wetting rate (0.045 kg/(m·s) by default)
 *
 * Returns the recirculation flow per effect in kg/hr.
 * If the seawater feed alone satisfies the wetting rate, returns 0.
 */
function calculateRecircFlowPerEffect(
  seawaterFlowPerEffect: number,
  inputs: MEDPlantInputs
): number {
  // Only calculate recirculation if explicitly enabled
  if (!inputs.brineRecirculation) return 0;

  const tubeSpec = inputs.evaporatorTubes;

  // Estimate tube count from typical area requirements
  // For a rough estimate, use Rognoni reference values
  const avgHeatDutyPerEffect =
    (inputs.capacity * 1000 * 2400) / (inputs.gorTarget * inputs.numberOfEffects); // kW approx
  const avgDeltaT =
    (inputs.topBrineTemp - (inputs.seawaterDischargeTemp + inputs.condenserApproachTemp)) /
    inputs.numberOfEffects;
  const avgU = ROGNONI_REFERENCE.evaporatorOverallHTC.midRange;
  const estArea = avgDeltaT > 0 ? avgHeatDutyPerEffect / ((avgU * avgDeltaT) / 1000) : 50;
  const tubeOuterArea = Math.PI * (tubeSpec.od / 1000) * tubeSpec.length;
  const estTubeCount = Math.max(100, Math.ceil(estArea / tubeOuterArea));

  const totalTubeLength = estTubeCount * tubeSpec.length;
  const minWettingRate = ROGNONI_REFERENCE.minimumWettingRate; // 0.03 kg/(m·s)
  const targetWettingRate = minWettingRate * 1.5; // 0.045 kg/(m·s)

  // Current wetting rate from seawater alone
  const seawaterFlowKgS = seawaterFlowPerEffect / 3600;
  const currentWettingRate = seawaterFlowKgS / (2 * totalTubeLength);

  if (currentWettingRate >= targetWettingRate) return 0;

  // Additional flow needed
  const requiredTotalFlow = targetWettingRate * 2 * totalTubeLength * 3600; // kg/hr
  return Math.max(0, requiredTotalFlow - seawaterFlowPerEffect);
}

// ============================================================================
// Single Forward Pass
// ============================================================================

/**
 * Perform one complete forward pass through all effects + condenser.
 *
 * Key differences from old solver:
 * - Each effect gets its own seawater spray (parallel feed)
 * - Brine cascades forward and accumulates (forward brine flow)
 * - Last-effect brine is recirculated to all effects for wetting rate
 * - NCG is tracked through the plant
 */
function solveForwardPass(
  inputs: MEDPlantInputs,
  steamFlow: number,
  effectTemps: number[],
  steamTemp: number,
  feedWaterTemp: number,
  recircBrineGuess: {
    flow: number;
    temp: number;
    salinity: number;
  }
): {
  effects: MEDEffectResult[];
  finalCondenser: MEDFinalCondenserResult;
  preheaters: MEDPreheaterResult[];
  tvcResult: TVCIntegrationResult | null;
  netProduction: number;
  lastEffectBrine: { flow: number; temp: number; salinity: number };
} {
  const N = inputs.numberOfEffects;
  const effects: MEDEffectResult[] = [];

  // ---- Feed distribution: parallel seawater to each effect ----
  // Total feed = capacity / (1 - 1/CF) — recovery fraction
  const feedFraction = 1 - 1 / inputs.brineConcentrationFactor;
  const totalFeedFlow = (inputs.capacity * 1000) / feedFraction; // kg/hr
  const seawaterPerEffect = totalFeedFlow / N;

  // Recirculation flow per effect (for wetting rate)
  const recircPerEffect = calculateRecircFlowPerEffect(seawaterPerEffect, inputs);

  // Build preheater lookup: effectNumber → config
  const preheaterMap = new Map<number, { effectNumber: number; vaporFlow: number }>();
  for (const ph of inputs.preheaters) {
    preheaterMap.set(ph.effectNumber, ph);
  }

  // ---- TVC integration (MED-TVC mode) ----
  let tvcResult: TVCIntegrationResult | null = null;
  let vaporToEffect1 = steamFlow;
  let effect1SteamTemp = steamTemp;

  if (inputs.plantType === 'MED_TVC' && inputs.tvcMotivePressure && inputs.tvcMotivePressure > 0) {
    const entrainedEffectIdx = (inputs.tvcEntrainedEffect ?? N) - 1;
    const entrainedVaporTemp = effectTemps[entrainedEffectIdx] ?? effectTemps[N - 1]!;
    const dischargePressure = getSaturationPressure(steamTemp);

    tvcResult = solveTVCIntegration({
      motivePressure: inputs.tvcMotivePressure,
      entrainedEffectNumber: inputs.tvcEntrainedEffect ?? N,
      entrainedVaporTemp,
      dischargePressure,
      requiredVaporToEffect1: steamFlow,
      sprayWaterTemp: feedWaterTemp,
    });

    vaporToEffect1 = tvcResult.dischargeFlow;
    effect1SteamTemp = tvcResult.vaporToEffect1Temp;
  }

  // ---- NCG in motive steam to effect 1 ----
  // Assumed equal to dissolved gases from the seawater sprayed into effect 1
  const swDensity = getSeawaterDensity(inputs.seawaterSalinity, feedWaterTemp);
  const swVolumeLitres = seawaterPerEffect / swDensity;
  const ncgFromSeawater = (swVolumeLitres * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6; // kg/hr
  let ncgAccum = ncgFromSeawater; // NCG entering effect 1 tube side

  // ---- Cascading state variables ----
  let prevVaporOut = vaporToEffect1;
  let prevSteamTemp = effect1SteamTemp;
  let distillateAccum = 0; // distillate accumulating on tube side
  let distillateTemp = effect1SteamTemp;
  let cascadedBrineFlow = 0; // brine accumulating on shell side bottom
  let cascadedBrineTemp = 0;
  let cascadedBrineSalinity = 0;

  for (let i = 0; i < N; i++) {
    const effectInput: EffectInput = {
      index: i,
      totalEffects: N,
      effectTemp: effectTemps[i]!,
      steamTemp: i === 0 ? effect1SteamTemp : prevSteamTemp,

      // Tube side
      vaporInFlow: prevVaporOut,
      distillateInFlow: distillateAccum,
      distillateInTemp: distillateTemp,
      ncgInFlow: ncgAccum,

      // Shell side spray
      seawaterSprayFlow: seawaterPerEffect,
      seawaterSprayTemp: feedWaterTemp,
      seawaterSalinity: inputs.seawaterSalinity,
      recircBrineFlow: recircPerEffect,
      recircBrineTemp: recircBrineGuess.temp,
      recircBrineSalinity: recircBrineGuess.salinity,

      // Shell side flash (cascaded brine from previous effects)
      cascadedBrineFlow: cascadedBrineFlow,
      cascadedBrineTemp: cascadedBrineTemp,
      cascadedBrineSalinity: cascadedBrineSalinity,

      preheater: preheaterMap.get(i + 1) ?? null,
      brineConcentrationFactor: inputs.brineConcentrationFactor,
    };

    const result = calculateEffect(effectInput);
    effects.push(result);

    // Update cascading values for next effect

    // Tube side → next effect tube side
    prevVaporOut = result.totalVaporOut.flow; // vapor through demister → next tube side
    prevSteamTemp = result.totalVaporOut.temperature;
    distillateAccum = result.distillateOut.flow; // condensate via siphon → next tube side
    distillateTemp = result.distillateOut.temperature;

    // NCG accumulates: previous NCG + NCG released from this effect's seawater
    // All NCGs exit through the demister with the vapor → next effect tube side
    ncgAccum = result.tubeSide.ncgVent + result.shellSprayZone.ncgReleased;

    // Shell side → next effect shell side (brine accumulates)
    cascadedBrineFlow = result.totalBrineOut.flow;
    cascadedBrineTemp = result.totalBrineOut.temperature;
    cascadedBrineSalinity = result.totalBrineOut.salinity;
  }

  // For MED-TVC: subtract entrained vapor from the selected effect's output
  if (tvcResult && inputs.tvcEntrainedEffect) {
    const entrainedIdx = inputs.tvcEntrainedEffect - 1;
    const entrainedEffect = effects[entrainedIdx];
    if (entrainedEffect) {
      const reducedVapor = Math.max(
        0,
        entrainedEffect.totalVaporOut.flow - tvcResult.entrainedFlow
      );
      effects[entrainedIdx] = {
        ...entrainedEffect,
        totalVaporOut: {
          ...entrainedEffect.totalVaporOut,
          flow: reducedVapor,
          energy: (reducedVapor * entrainedEffect.totalVaporOut.enthalpy) / 3600,
        },
        vaporOut: {
          ...entrainedEffect.vaporOut,
          flow: reducedVapor,
          energy: (reducedVapor * entrainedEffect.vaporOut.enthalpy) / 3600,
        },
      };
    }
  }

  // ---- Final condenser ----
  const lastEffect = effects[N - 1]!;
  const condensateFromFirstEffect = inputs.condensateExtraction === 'FIRST_EFFECT' ? steamFlow : 0;

  const finalCondenser = calculateFinalCondenser({
    vaporInFlow: lastEffect.totalVaporOut.flow,
    vaporInTemp: lastEffect.totalVaporOut.temperature,
    distillateInFlow: distillateAccum,
    distillateInTemp: distillateTemp,
    condensateInFlow: condensateFromFirstEffect,
    condensateInTemp: condensateFromFirstEffect > 0 ? steamTemp : 0,
    seawaterInletTemp: inputs.seawaterInletTemp,
    seawaterOutletTemp: inputs.seawaterDischargeTemp,
    seawaterSalinity: inputs.seawaterSalinity,
    distillateOutTemp: inputs.distillateTemp,
  });

  // ---- Preheaters ----
  const vaporTempMap = new Map<number, number>();
  for (const eff of effects) {
    vaporTempMap.set(eff.effectNumber, eff.totalVaporOut.temperature);
  }

  const preheaters = calculatePreheaterChain(
    inputs.preheaters,
    vaporTempMap,
    finalCondenser.seawaterIn.flow,
    inputs.seawaterDischargeTemp,
    inputs.seawaterSalinity
  );

  // Net production = total distillate out from final condenser
  const netProduction = finalCondenser.distillateOut.flow / 1000; // T/h

  // Last effect brine (for recirculation convergence)
  const lastEffectBrine = {
    flow: lastEffect.totalBrineOut.flow,
    temp: lastEffect.totalBrineOut.temperature,
    salinity: lastEffect.totalBrineOut.salinity,
  };

  return { effects, finalCondenser, preheaters, tvcResult, netProduction, lastEffectBrine };
}

// ============================================================================
// Main Solver
// ============================================================================

/**
 * Solve the complete MED plant heat and mass balance.
 *
 * Uses the secant method to converge on the correct steam flow
 * that produces the target distillate capacity.
 */
export function solveMEDPlant(inputs: MEDPlantInputs): MEDPlantResult {
  const warnings: string[] = [];

  // Validate inputs
  const errors = validateMEDInputs(inputs);
  if (errors.length > 0) {
    throw new Error(`Invalid MED plant inputs:\n${errors.join('\n')}`);
  }

  // Temperature profile
  const { effectTemps, steamTemp } = calculateTemperatureProfile(inputs);

  // Check working ΔT
  const avgDeltaT =
    (inputs.topBrineTemp - (inputs.seawaterDischargeTemp + inputs.condenserApproachTemp)) /
    inputs.numberOfEffects;
  if (avgDeltaT > 5.5) {
    warnings.push(
      `Average working ΔT per effect (${avgDeltaT.toFixed(1)}°C) exceeds 5.5°C — risk of over-boiling.`
    );
  }
  if (avgDeltaT < 1.0) {
    warnings.push(
      `Average working ΔT per effect (${avgDeltaT.toFixed(1)}°C) is very low — insufficient driving force.`
    );
  }

  // Initial guess for steam flow using GOR target
  const targetCapacity = inputs.capacity; // T/h
  let steamFlow = (targetCapacity * 1000) / inputs.gorTarget; // kg/hr

  // Feed water temperature: initially assume seawater discharge temp
  let feedWaterTemp = inputs.seawaterDischargeTemp;

  // Initial guess for recirculated brine (from last effect)
  // Start with seawater conditions as placeholder — will converge
  let recircBrineGuess = {
    flow: 0,
    temp: inputs.seawaterDischargeTemp + inputs.condenserApproachTemp,
    salinity: inputs.seawaterSalinity * inputs.brineConcentrationFactor,
  };

  // Secant method variables
  let steamFlow_prev = steamFlow * 0.9;
  let production_prev = 0;

  let converged = false;
  let iterations = 0;

  let bestResult: {
    effects: MEDEffectResult[];
    finalCondenser: MEDFinalCondenserResult;
    preheaters: MEDPreheaterResult[];
    tvcResult: TVCIntegrationResult | null;
    netProduction: number;
  } | null = null;

  const { maxIterations, capacityTolerance, relaxationFactor } = MED_SOLVER_CONFIG;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // Solve forward pass
    const result = solveForwardPass(
      inputs,
      steamFlow,
      effectTemps,
      steamTemp,
      feedWaterTemp,
      recircBrineGuess
    );

    bestResult = result;

    // Update recirculation guess from actual last-effect brine
    recircBrineGuess = {
      flow: result.lastEffectBrine.flow,
      temp: result.lastEffectBrine.temp,
      salinity: result.lastEffectBrine.salinity,
    };

    // Update feed water temp from preheaters (if any)
    if (result.preheaters.length > 0) {
      const hottestPH = result.preheaters.reduce((a, b) =>
        a.seawaterOutletTemp > b.seawaterOutletTemp ? a : b
      );
      feedWaterTemp = hottestPH.seawaterOutletTemp;
    } else {
      feedWaterTemp = inputs.seawaterDischargeTemp;
    }

    // Check convergence
    const productionError = Math.abs(result.netProduction - targetCapacity) / targetCapacity;

    if (productionError < capacityTolerance) {
      converged = true;
      break;
    }

    // Secant method update for steam flow
    if (iter === 0) {
      production_prev = result.netProduction;
      steamFlow_prev = steamFlow;
      steamFlow = steamFlow * (targetCapacity / result.netProduction);
    } else {
      const dP = result.netProduction - production_prev;
      const dS = steamFlow - steamFlow_prev;

      if (Math.abs(dP) > 1e-6) {
        const slope = dS / dP;
        const correction = (targetCapacity - result.netProduction) * slope;

        steamFlow_prev = steamFlow;
        production_prev = result.netProduction;

        steamFlow = steamFlow + correction * relaxationFactor;
      } else {
        steamFlow_prev = steamFlow;
        production_prev = result.netProduction;
        steamFlow = steamFlow * (targetCapacity / result.netProduction);
      }
    }

    // Clamp steam flow to reasonable range
    steamFlow = Math.max(steamFlow, 10);
    steamFlow = Math.min(steamFlow, targetCapacity * 1000 * 2);
  }

  if (!converged) {
    warnings.push(
      `Solver did not converge within ${maxIterations} iterations. Results are approximate.`
    );
  }

  if (!bestResult) {
    throw new Error('Solver failed to produce any result');
  }

  // ---- Build final result ----
  const { effects, finalCondenser, preheaters, tvcResult, netProduction } = bestResult;

  // Total brine from last effect (the accumulated brine from all effects)
  const lastEffect = effects[effects.length - 1]!;
  const totalBrineFlow = lastEffect.totalBrineOut.flow;
  const brineSalinity = lastEffect.totalBrineOut.salinity;
  const brineTemp = lastEffect.totalBrineOut.temperature;

  // GOR — for MED-TVC, GOR is based on motive steam consumption
  const actualSteamFlow = tvcResult ? tvcResult.netSteamConsumed : steamFlow;
  const gor = (netProduction * 1000) / actualSteamFlow;

  // Specific thermal energy
  const latentHeatSteam = getEnthalpyVapor(steamTemp) - getEnthalpyLiquid(steamTemp);
  const ste = latentHeatSteam / gor; // kJ/kg distillate
  const ste_kWh = (ste * 1000) / 3600; // kWh/m³

  // Gross production (effects only)
  const grossProduction =
    effects.reduce(
      (sum, eff) => sum + eff.totalVaporOut.flow + (eff.vaporToPreheater?.flow ?? 0),
      0
    ) / 1000; // T/h

  // Seawater intake
  const seawaterIntake = finalCondenser.seawaterIn.flow / 1000; // T/h

  // Cooling water = seawater intake - total feed
  const totalFeedFlow =
    effects.reduce((sum, eff) => sum + eff.shellSprayZone.seawaterIn.flow, 0) / 1000;
  const coolingWater = seawaterIntake - totalFeedFlow;

  // Overdesign
  const overdesign = (netProduction - inputs.capacity) / inputs.capacity;

  // Overall balance
  const overallBalance = buildOverallBalance(
    inputs,
    effects,
    finalCondenser,
    steamFlow,
    steamTemp,
    totalBrineFlow,
    brineTemp,
    brineSalinity,
    seawaterIntake * 1000,
    coolingWater * 1000
  );

  const performance = {
    gor: Math.round(gor * 100) / 100,
    specificThermalEnergy: Math.round(ste * 10) / 10,
    specificThermalEnergy_kWh: Math.round(ste_kWh * 10) / 10,
    grossProduction: Math.round(grossProduction * 1000) / 1000,
    netProduction: Math.round(netProduction * 1000) / 1000,
    steamFlow: Math.round(actualSteamFlow * 10) / 10,
    motiveFlow: tvcResult ? Math.round(tvcResult.motiveFlow * 10) / 10 : 0,
    seawaterIntake: Math.round(seawaterIntake * 100) / 100,
    coolingWater: Math.round(coolingWater * 100) / 100,
    makeupWater: Math.round(totalFeedFlow * 100) / 100,
    brineFlow: Math.round(totalBrineFlow / 10) / 100, // T/h
    brineSalinity: Math.round(brineSalinity),
    overdesign: Math.round(overdesign * 1000) / 1000,
  };

  return {
    inputs,
    effects,
    finalCondenser,
    preheaters,
    ...(tvcResult && {
      tvcResult: {
        motiveFlow: tvcResult.motiveFlow,
        entrainedFlow: tvcResult.entrainedFlow,
        dischargeFlow: tvcResult.dischargeFlow,
        entrainmentRatio: tvcResult.tvc.entrainmentRatio,
        compressionRatio: tvcResult.tvc.compressionRatio,
        isSuperheated: tvcResult.isSuperheated,
        sprayWaterFlow: tvcResult.sprayWaterFlow,
        vaporToEffect1Temp: tvcResult.vaporToEffect1Temp,
      },
    }),
    overallBalance,
    performance,
    warnings,
    converged,
    iterations,
  };
}

// ============================================================================
// Overall Balance Builder
// ============================================================================

function buildOverallBalance(
  inputs: MEDPlantInputs,
  _effects: MEDEffectResult[],
  finalCondenser: MEDFinalCondenserResult,
  steamFlow: number,
  steamTemp: number,
  totalBrineFlow: number,
  brineTemp: number,
  brineSalinity: number,
  seawaterFlow: number,
  coolingWaterFlow: number
): MEDOverallBalance {
  const h_steamIn = getEnthalpyVapor(steamTemp);
  const h_swIn = getSeawaterEnthalpy(inputs.seawaterSalinity, inputs.seawaterInletTemp);
  const h_swOut = getSeawaterEnthalpy(inputs.seawaterSalinity, inputs.seawaterDischargeTemp);

  const steamIn = makeStream('Steam In', 'STEAM', steamFlow, steamTemp, h_steamIn, 0);
  const seawaterIn = makeStream(
    'Sea Water In',
    'SEAWATER',
    seawaterFlow,
    inputs.seawaterInletTemp,
    h_swIn,
    inputs.seawaterSalinity
  );

  const seawaterOut = makeStream(
    'Sea Water Out',
    'SEAWATER',
    coolingWaterFlow,
    inputs.seawaterDischargeTemp,
    h_swOut,
    inputs.seawaterSalinity
  );

  const condensateOut =
    inputs.condensateExtraction === 'FIRST_EFFECT'
      ? makeStream(
          'Condensate Out',
          'CONDENSATE',
          steamFlow,
          inputs.distillateTemp,
          getEnthalpyLiquid(inputs.distillateTemp),
          0
        )
      : null;

  const distillateOut = finalCondenser.distillateOut;
  const brineOut = makeStream(
    'Brine Out',
    'BRINE',
    totalBrineFlow,
    brineTemp,
    getSeawaterEnthalpy(Math.min(brineSalinity, 120000), brineTemp),
    brineSalinity
  );
  const ventOut = finalCondenser.ventOut;

  const totalEnergyIn = steamIn.energy + seawaterIn.energy;
  const totalEnergyOut =
    seawaterOut.energy +
    (condensateOut?.energy ?? 0) +
    distillateOut.energy +
    brineOut.energy +
    ventOut.energy;
  const energyBalanceError =
    totalEnergyIn !== 0
      ? (Math.abs(totalEnergyIn - totalEnergyOut) / Math.abs(totalEnergyIn)) * 100
      : 0;

  return {
    totalIn: { seawater: seawaterIn, steam: steamIn },
    totalOut: {
      seawater: seawaterOut,
      condensate: condensateOut,
      distillate: distillateOut,
      brine: brineOut,
      vent: ventOut,
    },
    totalEnergyIn,
    totalEnergyOut,
    energyBalanceError: Math.round(energyBalanceError * 100) / 100,
  };
}
