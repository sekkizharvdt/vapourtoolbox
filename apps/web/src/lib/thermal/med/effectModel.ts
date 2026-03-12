/**
 * Single-Effect Thermodynamic Model for MED Plant
 *
 * Calculates the heat and mass balance for a single evaporator effect.
 * Each effect receives fresh seawater as spray (parallel feed).
 *
 * References:
 * - El-Dessouky & Ettouney (2002) "Fundamentals of Salt Water Desalination"
 * - Sharqawy et al. (2010) seawater property correlations
 */

import {
  getBoilingPointElevation,
  getLatentHeat,
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getSeawaterEnthalpy,
  getSeawaterSpecificHeat,
  getSaturationPressure,
} from '@vapour/constants';
import { NEA_HOT_END, NEA_COLD_END, DELTA_T_PRESSURE_DROP } from '@vapour/constants';
import type { MEDStream, MEDEffectResult, PreheaterConfig } from '@vapour/types';

// ============================================================================
// Helper — build a stream object
// ============================================================================

export function makeStream(
  label: string,
  fluid: MEDStream['fluid'],
  flow: number,
  temperature: number,
  enthalpy: number,
  salinity: number
): MEDStream {
  return {
    label,
    fluid,
    flow,
    temperature,
    enthalpy,
    energy: (flow * enthalpy) / 3600, // kW
    salinity,
  };
}

// ============================================================================
// NEA Interpolation
// ============================================================================

/**
 * Interpolate Non-Equilibrium Allowance between hot and cold ends.
 */
export function getNEA(effectIndex: number, totalEffects: number): number {
  if (totalEffects <= 1) return NEA_HOT_END;
  const fraction = effectIndex / (totalEffects - 1);
  return NEA_HOT_END + (NEA_COLD_END - NEA_HOT_END) * fraction;
}

// ============================================================================
// Single Effect Solver
// ============================================================================

export interface EffectInput {
  /** Effect index (0-based) */
  index: number;
  /** Total number of effects */
  totalEffects: number;
  /** Effect operating temperature in °C (brine boiling point, pure-water basis) */
  effectTemp: number;
  /** Steam/vapor temperature feeding this effect in °C */
  steamTemp: number;

  // Inlet streams
  /** Vapor flow entering tube side in kg/hr */
  vaporInFlow: number;
  /** Spray water flow in kg/hr */
  sprayWaterFlow: number;
  /** Spray water temperature in °C */
  sprayWaterTemp: number;
  /** Spray water salinity in ppm */
  sprayWaterSalinity: number;

  // Distillate & condensate cascade from previous effects
  /** Accumulated distillate flow in kg/hr */
  distillateInFlow: number;
  /** Distillate temperature in °C */
  distillateInTemp: number;
  /** Accumulated condensate flow in kg/hr */
  condensateInFlow: number;
  /** Condensate temperature in °C */
  condensateInTemp: number;

  /** Preheater config (if this effect has a preheater) */
  preheater: PreheaterConfig | null;

  /** Brine concentration factor */
  brineConcentrationFactor: number;

  /** Seawater salinity in ppm (for brine calculation) */
  seawaterSalinity: number;
}

/**
 * Calculate the heat and mass balance for a single evaporator effect.
 *
 * The energy balance:
 *   Q_condensing = Q_evaporation + Q_sensible_heating + Q_distillate_flash
 *
 * Where:
 *   Q_condensing = vaporIn × (h_vapor - h_condensate) — latent heat released by condensing vapor
 *   Q_evaporation = vaporOut × latent_heat_at_effect_temp
 *   Q_sensible = sprayWater × Cp × (effectTemp - sprayWaterTemp) — heating spray water to boiling
 */
export function calculateEffect(input: EffectInput): MEDEffectResult {
  const {
    index,
    totalEffects,
    effectTemp,
    steamTemp,
    sprayWaterFlow,
    sprayWaterTemp,
    sprayWaterSalinity,
    distillateInFlow,
    distillateInTemp,
    condensateInFlow,
    condensateInTemp,
    preheater,
    brineConcentrationFactor,
    seawaterSalinity,
  } = input;

  let vaporInFlow = input.vaporInFlow;

  // ---- Temperature losses ----
  const brineSalinityForBPE = seawaterSalinity * brineConcentrationFactor;

  const bpe = getBoilingPointElevation(
    Math.min(brineSalinityForBPE, 120000),
    effectTemp
  );
  const nea = getNEA(index, totalEffects);
  const deltaTP = DELTA_T_PRESSURE_DROP;

  // Actual brine boiling temperature (includes BPE)
  const brineBoilingTemp = effectTemp + bpe;

  // Temperature of vapor produced (pure water saturation at effectTemp, minus NEA and ΔT_PD)
  const vaporOutTemp = effectTemp - nea - deltaTP;

  // Effective ΔT for heat transfer (steam condensing temp → brine boiling)
  const effectiveDeltaT = steamTemp - brineBoilingTemp;

  // Effect operating pressure (pure water saturation at effectTemp)
  const effectPressure = getSaturationPressure(Math.max(effectTemp, 1));

  // ---- Preheater: divert vapor before it reaches next effect ----
  let vaporToPreheaterFlow = 0;
  if (preheater && preheater.vaporFlow > 0) {
    vaporToPreheaterFlow = preheater.vaporFlow;
  }

  // ---- Enthalpies ----
  const h_vaporIn = getEnthalpyVapor(steamTemp); // kJ/kg — saturated vapor at steam temp
  const h_condensateOut = getEnthalpyLiquid(steamTemp); // kJ/kg — condensate at steam temp
  const h_sprayWater = getSeawaterEnthalpy(sprayWaterSalinity, sprayWaterTemp); // kJ/kg
  const h_distillateIn = distillateInFlow > 0 ? getEnthalpyLiquid(distillateInTemp) : 0;
  const h_condensateIn = condensateInFlow > 0 ? getEnthalpyLiquid(condensateInTemp) : 0;

  // Latent heat of evaporation at effect temperature
  const latentHeatEffect = getLatentHeat(effectTemp);

  // Brine enthalpy at effect boiling conditions
  const brineSalinity = seawaterSalinity * brineConcentrationFactor;
  const h_brineOut = getSeawaterEnthalpy(Math.min(brineSalinity, 120000), brineBoilingTemp);

  // Vapor out enthalpy (saturated vapor at vaporOutTemp)
  const h_vaporOut = getEnthalpyVapor(Math.max(vaporOutTemp, 5));

  // ---- Energy balance → solve for vapor produced ----
  // Heat available from condensing the inlet vapor (tube side):
  const Q_condensing = (vaporInFlow * (h_vaporIn - h_condensateOut)) / 3600; // kW

  // Heat from distillate & condensate flashing (they cool as they cascade):
  const Q_distillateFlash =
    distillateInFlow > 0
      ? (distillateInFlow * (h_distillateIn - getEnthalpyLiquid(effectTemp))) / 3600
      : 0;
  const Q_condensateFlash =
    condensateInFlow > 0
      ? (condensateInFlow * (h_condensateIn - getEnthalpyLiquid(effectTemp))) / 3600
      : 0;

  // Sensible heat needed to raise spray water to boiling:
  const cp_spray = getSeawaterSpecificHeat(sprayWaterSalinity, (sprayWaterTemp + brineBoilingTemp) / 2);
  const Q_sensible = (sprayWaterFlow * cp_spray * (brineBoilingTemp - sprayWaterTemp)) / 3600; // kW

  // Total available heat for evaporation:
  const Q_available = Q_condensing + Q_distillateFlash + Q_condensateFlash - Q_sensible;

  // Vapor produced:
  const vaporProduced = Math.max(0, (Q_available * 3600) / latentHeatEffect); // kg/hr
  const heatTransferred = Q_condensing + Q_distillateFlash + Q_condensateFlash;

  // ---- Mass balance ----
  // Brine out = spray water in - vapor produced
  const brineOutFlow = Math.max(0, sprayWaterFlow - vaporProduced);

  // Distillate accumulation: previous distillate + condensate from this effect's tube side
  // The inlet vapor condenses to become condensate/distillate
  const condensateFromThisEffect = vaporInFlow; // all inlet vapor condenses
  const distillateOutFlow = distillateInFlow + condensateFromThisEffect;
  const distillateOutTemp = effectTemp; // cools to effect temperature

  // Condensate out — in this model, condensate merges with distillate
  // For the first effect, the condensate is the steam condensate
  // We track it as distillate accumulation

  // Vapor out = vapor produced - vapor to preheater
  const netVaporOut = Math.max(0, vaporProduced - vaporToPreheaterFlow);

  // Mass balance check
  const totalIn = vaporInFlow + sprayWaterFlow + distillateInFlow + condensateInFlow;
  const totalOut = netVaporOut + vaporToPreheaterFlow + brineOutFlow + distillateOutFlow;
  const massBalance = totalIn - totalOut;

  // ---- Build result ----
  const effectNumber = index + 1;

  const result: MEDEffectResult = {
    effectNumber,
    temperature: effectTemp,
    pressure: effectPressure,
    bpe,
    nea,
    deltaTPressureDrop: deltaTP,
    effectiveDeltaT,

    vaporIn: makeStream(
      `Steam to Effect ${effectNumber}`,
      index === 0 ? 'STEAM' : 'VAPOR',
      vaporInFlow,
      steamTemp,
      h_vaporIn,
      0
    ),
    sprayWater: makeStream(
      `Feed Water to Effect ${effectNumber}`,
      'SEAWATER',
      sprayWaterFlow,
      sprayWaterTemp,
      h_sprayWater,
      sprayWaterSalinity
    ),
    brineIn: null,
    distillateIn:
      distillateInFlow > 0
        ? makeStream(
            `Distillate In to Effect ${effectNumber}`,
            'DISTILLATE',
            distillateInFlow,
            distillateInTemp,
            h_distillateIn,
            0
          )
        : null,
    condensateIn:
      condensateInFlow > 0
        ? makeStream(
            `Condensate In to Effect ${effectNumber}`,
            'CONDENSATE',
            condensateInFlow,
            condensateInTemp,
            h_condensateIn,
            0
          )
        : null,
    vaporOut: makeStream(
      `Vapor from Effect ${effectNumber}`,
      'VAPOR',
      netVaporOut,
      vaporOutTemp,
      h_vaporOut,
      0
    ),
    vaporToPreheater:
      vaporToPreheaterFlow > 0
        ? makeStream(
            `Vapor to PH from Effect ${effectNumber}`,
            'VAPOR',
            vaporToPreheaterFlow,
            vaporOutTemp,
            h_vaporOut,
            0
          )
        : null,
    brineOut: makeStream(
      `Brine from Effect ${effectNumber}`,
      'BRINE',
      brineOutFlow,
      brineBoilingTemp,
      h_brineOut,
      brineSalinity
    ),
    distillateOut: makeStream(
      `Distillate from Effect ${effectNumber}`,
      'DISTILLATE',
      distillateOutFlow,
      distillateOutTemp,
      getEnthalpyLiquid(distillateOutTemp),
      0
    ),

    heatTransferred,
    massBalance,
  };

  return result;
}
