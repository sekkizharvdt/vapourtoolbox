/**
 * MED Plant Iterative Solver
 *
 * Master solver that orchestrates the effect-by-effect calculation,
 * preheater integration, and final condenser to produce a complete
 * plant heat and mass balance.
 *
 * Algorithm:
 * 1. Establish temperature profile across effects
 * 2. Initial guess for steam flow from GOR target
 * 3. Solve all effects sequentially (forward pass)
 * 4. Solve final condenser → determine seawater intake
 * 5. Solve preheater chain → adjust seawater feed temperatures
 * 6. Check convergence (net production vs target capacity)
 * 7. Adjust steam flow using secant method and repeat
 *
 * References:
 * - El-Dessouky & Ettouney (2002) "Fundamentals of Salt Water Desalination"
 */

import {
  getSaturationTemperature,
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getSeawaterEnthalpy,
  MED_SOLVER_CONFIG,
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
 * Temperature spacing is approximately equal, with small adjustments
 * for BPE variation.
 */
function calculateTemperatureProfile(inputs: MEDPlantInputs): {
  effectTemps: number[];
  steamTemp: number;
  lastEffectTemp: number;
} {
  const N = inputs.numberOfEffects;
  const steamTemp = getSaturationTemperature(inputs.steamPressure);

  // Last effect temperature — set by condenser approach + discharge temp
  const lastEffectTemp =
    inputs.seawaterDischargeTemp + inputs.condenserApproachTemp;

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
// Single Forward Pass
// ============================================================================

/**
 * Perform one complete forward pass through all effects + condenser.
 */
function solveForwardPass(
  inputs: MEDPlantInputs,
  steamFlow: number,
  effectTemps: number[],
  steamTemp: number,
  feedWaterTemp: number
): {
  effects: MEDEffectResult[];
  finalCondenser: MEDFinalCondenserResult;
  preheaters: MEDPreheaterResult[];
  netProduction: number;
} {
  const N = inputs.numberOfEffects;
  const effects: MEDEffectResult[] = [];

  // Spray water distribution: in parallel feed, spray water is split equally among effects
  // Total feed water = capacity / (1 - 1/K) where K = concentration factor
  // This is the makeup; total spray includes brine recirculation but for H&M balance
  // we track the feed portion
  const feedFraction = 1 - 1 / inputs.brineConcentrationFactor;
  const totalFeedFlow = (inputs.capacity * 1000) / feedFraction; // kg/hr (approx)
  const sprayPerEffect = totalFeedFlow / N;

  // Build preheater lookup: effectNumber → config
  const preheaterMap = new Map<number, { effectNumber: number; vaporFlow: number }>();
  for (const ph of inputs.preheaters) {
    preheaterMap.set(ph.effectNumber, ph);
  }

  // Track cascading streams
  let prevVaporOut = steamFlow; // first effect gets steam
  let prevSteamTemp = steamTemp;
  let distillateAccum = 0;
  let distillateTemp = steamTemp;
  let condensateAccum = 0;
  let condensateTemp = steamTemp;

  // For forward feed: track brine cascade
  let brineFlow = 0;
  let brineTemp = 0;
  let brineSalinity = inputs.seawaterSalinity;

  for (let i = 0; i < N; i++) {
    const effectInput: EffectInput = {
      index: i,
      totalEffects: N,
      effectTemp: effectTemps[i]!,
      steamTemp: i === 0 ? steamTemp : prevSteamTemp,

      vaporInFlow: prevVaporOut,
      sprayWaterFlow: sprayPerEffect,
      sprayWaterTemp: feedWaterTemp,
      sprayWaterSalinity: inputs.seawaterSalinity,

      brineInFlow:
        inputs.feedArrangement === 'FORWARD' && i > 0 ? brineFlow : 0,
      brineInTemp:
        inputs.feedArrangement === 'FORWARD' && i > 0 ? brineTemp : 0,
      brineInSalinity:
        inputs.feedArrangement === 'FORWARD' && i > 0
          ? brineSalinity
          : inputs.seawaterSalinity,

      distillateInFlow: distillateAccum,
      distillateInTemp: distillateTemp,
      condensateInFlow: condensateAccum,
      condensateInTemp: condensateTemp,

      preheater: preheaterMap.get(i + 1) ?? null,
      feedArrangement: inputs.feedArrangement,
      brineConcentrationFactor: inputs.brineConcentrationFactor,
      seawaterSalinity: inputs.seawaterSalinity,
    };

    const result = calculateEffect(effectInput);
    effects.push(result);

    // Update cascading values for next effect
    prevVaporOut = result.vaporOut.flow;
    prevSteamTemp = result.vaporOut.temperature;

    // Distillate accumulates: condensate from tube side + previous
    distillateAccum = result.distillateOut.flow;
    distillateTemp = result.distillateOut.temperature;

    // In this model, condensate merges with distillate cascade
    condensateAccum = 0;
    condensateTemp = result.temperature;

    // Forward feed brine cascade
    if (inputs.feedArrangement === 'FORWARD') {
      brineFlow = result.brineOut.flow;
      brineTemp = result.brineOut.temperature;
      brineSalinity = result.brineOut.salinity;
    }
  }

  // Final condenser
  const lastEffect = effects[N - 1]!;
  const condensateFromFirstEffect =
    inputs.condensateExtraction === 'FIRST_EFFECT' ? steamFlow : 0;

  const finalCondenser = calculateFinalCondenser({
    vaporInFlow: lastEffect.vaporOut.flow,
    vaporInTemp: lastEffect.vaporOut.temperature,
    distillateInFlow: distillateAccum,
    distillateInTemp: distillateTemp,
    condensateInFlow: condensateFromFirstEffect,
    condensateInTemp: condensateFromFirstEffect > 0 ? steamTemp : 0,
    seawaterInletTemp: inputs.seawaterInletTemp,
    seawaterOutletTemp: inputs.seawaterDischargeTemp,
    seawaterSalinity: inputs.seawaterSalinity,
    distillateOutTemp: inputs.distillateTemp,
  });

  // Preheaters
  const vaporTempMap = new Map<number, number>();
  for (const eff of effects) {
    vaporTempMap.set(eff.effectNumber, eff.vaporOut.temperature);
  }

  const preheaters = calculatePreheaterChain(
    inputs.preheaters,
    vaporTempMap,
    finalCondenser.seawaterIn.flow,
    inputs.seawaterDischargeTemp, // seawater enters preheaters after being heated in condenser
    inputs.seawaterSalinity
  );

  // Net production = total distillate out from final condenser
  const netProduction = finalCondenser.distillateOut.flow / 1000; // T/h

  return { effects, finalCondenser, preheaters, netProduction };
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
    (inputs.topBrineTemp -
      (inputs.seawaterDischargeTemp + inputs.condenserApproachTemp)) /
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
  // (preheaters will increase this, but we need a starting point)
  let feedWaterTemp = inputs.seawaterDischargeTemp;

  // Secant method variables
  let steamFlow_prev = steamFlow * 0.9;
  let production_prev = 0;

  let converged = false;
  let iterations = 0;

  let bestResult: {
    effects: MEDEffectResult[];
    finalCondenser: MEDFinalCondenserResult;
    preheaters: MEDPreheaterResult[];
    netProduction: number;
  } | null = null;

  const { maxIterations, capacityTolerance, relaxationFactor } =
    MED_SOLVER_CONFIG;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // Solve forward pass
    const result = solveForwardPass(
      inputs,
      steamFlow,
      effectTemps,
      steamTemp,
      feedWaterTemp
    );

    bestResult = result;

    // Update feed water temp from preheaters (if any)
    if (result.preheaters.length > 0) {
      // The last preheater in the chain (hottest) sets the spray water temp
      const hottestPH = result.preheaters.reduce((a, b) =>
        a.seawaterOutletTemp > b.seawaterOutletTemp ? a : b
      );
      feedWaterTemp = hottestPH.seawaterOutletTemp;
    } else {
      feedWaterTemp = inputs.seawaterDischargeTemp;
    }

    // Check convergence
    const productionError =
      Math.abs(result.netProduction - targetCapacity) / targetCapacity;

    if (productionError < capacityTolerance) {
      converged = true;
      break;
    }

    // Secant method update for steam flow
    if (iter === 0) {
      // First iteration — make a small perturbation for the second point
      production_prev = result.netProduction;
      steamFlow_prev = steamFlow;
      // Simple proportional adjustment
      steamFlow = steamFlow * (targetCapacity / result.netProduction);
    } else {
      const dP = result.netProduction - production_prev;
      const dS = steamFlow - steamFlow_prev;

      if (Math.abs(dP) > 1e-6) {
        const slope = dS / dP;
        const correction = (targetCapacity - result.netProduction) * slope;

        steamFlow_prev = steamFlow;
        production_prev = result.netProduction;

        // Apply with relaxation to prevent oscillation
        steamFlow = steamFlow + correction * relaxationFactor;
      } else {
        // Fallback: proportional
        steamFlow_prev = steamFlow;
        production_prev = result.netProduction;
        steamFlow = steamFlow * (targetCapacity / result.netProduction);
      }
    }

    // Clamp steam flow to reasonable range
    steamFlow = Math.max(steamFlow, 10); // minimum 10 kg/hr
    steamFlow = Math.min(steamFlow, targetCapacity * 1000 * 2); // max 2× capacity
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
  const { effects, finalCondenser, preheaters, netProduction } = bestResult;

  // Calculate brine from all effects
  let totalBrineFlow = 0;
  let brineSalinity = inputs.seawaterSalinity * inputs.brineConcentrationFactor;
  let brineTemp = 0;

  if (inputs.feedArrangement === 'PARALLEL') {
    // Each effect produces its own brine
    for (const eff of effects) {
      totalBrineFlow += eff.brineOut.flow;
    }
    brineTemp = effects[effects.length - 1]!.brineOut.temperature;
  } else {
    // Forward feed: only last effect produces final brine
    const lastEff = effects[effects.length - 1]!;
    totalBrineFlow = lastEff.brineOut.flow;
    brineTemp = lastEff.brineOut.temperature;
    brineSalinity = lastEff.brineOut.salinity;
  }

  // GOR
  const actualSteamFlow = steamFlow;
  const gor = (netProduction * 1000) / actualSteamFlow;

  // Specific thermal energy
  const latentHeatSteam =
    getEnthalpyVapor(steamTemp) - getEnthalpyLiquid(steamTemp);
  const ste = latentHeatSteam / gor; // kJ/kg distillate
  const ste_kWh = (ste * 1000) / 3600; // kWh/m³ (assuming distillate density ≈ 1000 kg/m³)

  // Gross production (effects only, before condenser)
  const grossProduction = effects.reduce(
    (sum, eff) => sum + eff.vaporOut.flow + (eff.vaporToPreheater?.flow ?? 0),
    0
  ) / 1000; // T/h — sum of all vapor produced

  // Seawater intake
  const seawaterIntake = finalCondenser.seawaterIn.flow / 1000; // T/h

  // Cooling water = seawater intake - makeup feed
  const totalFeedFlow =
    effects.reduce((sum, eff) => sum + eff.sprayWater.flow, 0) / 1000; // T/h
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
  const h_swIn = getSeawaterEnthalpy(
    inputs.seawaterSalinity,
    inputs.seawaterInletTemp
  );
  const h_swOut = getSeawaterEnthalpy(
    inputs.seawaterSalinity,
    inputs.seawaterDischargeTemp
  );

  const steamIn = makeStream(
    'Steam In',
    'STEAM',
    steamFlow,
    steamTemp,
    h_steamIn,
    0
  );
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
      ? Math.abs(totalEnergyIn - totalEnergyOut) / Math.abs(totalEnergyIn) * 100
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
