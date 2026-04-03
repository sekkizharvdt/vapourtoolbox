/**
 * Single-Effect Thermodynamic Model for MED Plant
 *
 * Calculates the heat and mass balance for a single evaporator effect with
 * explicit tube-side / shell-side separation:
 *
 *   TUBE SIDE (inside tubes):
 *     - Vapor from previous effect's demister condenses
 *     - Distillate from previous effect's tube side enters via siphon and flashes
 *     - NCGs are vented with carrier steam to the shell side
 *
 *   SHELL SIDE — SPRAY ZONE (falling film over tubes):
 *     - Seawater + recirculated brine from last effect sprayed over tube bundle
 *     - Sensible heating to saturation → evaporation
 *     - Dissolved gases released from seawater
 *
 *   SHELL SIDE — FLASH ZONE (bottom of shell):
 *     - Cascaded brine from previous effect(s) enters at lower pressure
 *     - A small fraction flashes to vapor
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
  getSeawaterDensity,
  getSaturationPressure,
  NEA_HOT_END,
  NEA_COLD_END,
  DELTA_T_PRESSURE_DROP,
  CARRIER_STEAM_FRACTION,
  TOTAL_DISSOLVED_GAS_MG_PER_LITRE,
} from '@vapour/constants';
import type {
  MEDStream,
  MEDEffectResult,
  MEDTubeSideBalance,
  MEDShellSprayZone,
  MEDShellFlashZone,
  PreheaterConfig,
} from '@vapour/types';

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
  /** Effect operating temperature in °C (pure-water saturation temperature) */
  effectTemp: number;
  /** Steam/vapor temperature feeding this effect's tube side in °C */
  steamTemp: number;

  // ---- Tube side inlets ----
  /** Vapor flow entering tube side in kg/hr */
  vaporInFlow: number;
  /** Distillate from previous effect tube side via siphon in kg/hr */
  distillateInFlow: number;
  /** Distillate inlet temperature in °C */
  distillateInTemp: number;
  /** NCG mass entering tube side in kg/hr (from previous effect's demister vapor) */
  ncgInFlow: number;

  // ---- Shell side spray inlets ----
  /** Fresh seawater spray flow in kg/hr */
  seawaterSprayFlow: number;
  /** Seawater spray temperature in °C */
  seawaterSprayTemp: number;
  /** Seawater salinity in ppm */
  seawaterSalinity: number;
  /** Recirculated brine from last effect for wetting rate in kg/hr */
  recircBrineFlow: number;
  /** Recirculated brine temperature in °C */
  recircBrineTemp: number;
  /** Recirculated brine salinity in ppm */
  recircBrineSalinity: number;

  // ---- Shell side flash inlet ----
  /** Cascaded brine from previous effect(s) in kg/hr — 0 for effect 1 */
  cascadedBrineFlow: number;
  /** Cascaded brine temperature in °C */
  cascadedBrineTemp: number;
  /** Cascaded brine salinity in ppm */
  cascadedBrineSalinity: number;

  /** Preheater config (if this effect has a preheater) */
  preheater: PreheaterConfig | null;

  /** Brine concentration factor */
  brineConcentrationFactor: number;
}

/**
 * Calculate the heat and mass balance for a single evaporator effect
 * with explicit tube-side / shell-side separation.
 */
export function calculateEffect(input: EffectInput): MEDEffectResult {
  const {
    index,
    totalEffects,
    effectTemp,
    steamTemp,
    vaporInFlow,
    distillateInFlow,
    distillateInTemp,
    ncgInFlow,
    seawaterSprayFlow,
    seawaterSprayTemp,
    seawaterSalinity,
    recircBrineFlow,
    recircBrineTemp,
    recircBrineSalinity,
    cascadedBrineFlow,
    cascadedBrineTemp,
    cascadedBrineSalinity,
    preheater,
    brineConcentrationFactor,
  } = input;

  const effectNumber = index + 1;

  // ---- Temperature losses ----
  const brineSalinityForBPE = seawaterSalinity * brineConcentrationFactor;
  const bpe = getBoilingPointElevation(Math.min(brineSalinityForBPE, 120000), effectTemp);
  const nea = getNEA(index, totalEffects);
  const deltaTP = DELTA_T_PRESSURE_DROP;

  // Brine boiling temperature (includes BPE above pure-water saturation)
  const brineBoilingTemp = effectTemp + bpe;

  // Temperature of vapor produced (pure water at effectTemp, minus NEA and ΔT_PD)
  const vaporOutTemp = effectTemp - nea - deltaTP;

  // Effective ΔT for heat transfer (tube side steam temp → shell side brine boiling)
  const effectiveDeltaT = steamTemp - brineBoilingTemp;

  // Effect operating pressure (pure water saturation at effectTemp)
  const effectPressure = getSaturationPressure(Math.max(effectTemp, 1));

  // ======================================================================
  // TUBE SIDE BALANCE
  // ======================================================================

  const h_vaporIn = getEnthalpyVapor(steamTemp);
  // Carrier steam loss (accompanies NCG vent from tube side to shell side)
  const carrierSteam = vaporInFlow * CARRIER_STEAM_FRACTION;
  const condensingVapor = vaporInFlow - carrierSteam;

  // Heat released by condensation: vapor condenses at steam temp conditions
  // The condensate cools to the effect temperature as it exits through the siphon
  const h_condensateOut = getEnthalpyLiquid(effectTemp);
  const Q_condensing = (condensingVapor * (h_vaporIn - h_condensateOut)) / 3600; // kW

  // Distillate flash: liquid from previous tube side enters at higher temp, flashes
  let distillateFlashVapor = 0;
  let Q_distillateFlash = 0;
  let distillateRemaining = distillateInFlow;

  if (distillateInFlow > 0 && distillateInTemp > effectTemp) {
    const h_distIn = getEnthalpyLiquid(distillateInTemp);
    const h_distAtEffect = getEnthalpyLiquid(effectTemp);
    const latentHeatEffect = getLatentHeat(effectTemp);

    // Flash fraction = Cp × ΔT / L (approximate)
    const flashFractionDist = Math.min(
      0.05, // cap at 5%
      (h_distIn - h_distAtEffect) / latentHeatEffect
    );
    distillateFlashVapor = distillateInFlow * Math.max(0, flashFractionDist);
    distillateRemaining = distillateInFlow - distillateFlashVapor;

    // Energy: the flash vapor takes latent heat from the liquid
    Q_distillateFlash = (distillateFlashVapor * latentHeatEffect) / 3600; // kW
  }

  // Condensate/distillate out = condensed vapor + remaining distillate from siphon
  const condensateOutFlow = condensingVapor + distillateRemaining;
  const condensateOutTemp = effectTemp;
  const h_condensateOutFinal = getEnthalpyLiquid(condensateOutTemp);

  // NCG: all tube-side NCG is vented to the shell side
  const ncgVent = ncgInFlow;

  // Net heat released from tube side to shell side
  // = condensation heat - distillate flash (flash vapor goes to shell vapor space)
  // Carrier steam also enters the shell side as vapor (accounted in shell balance)
  const tubeSideHeatReleased = Q_condensing - Q_distillateFlash;

  // Tube side energy balance
  const h_distIn = distillateInFlow > 0 ? getEnthalpyLiquid(distillateInTemp) : 0;
  const tubeEnergyIn = (vaporInFlow * h_vaporIn) / 3600 + (distillateInFlow * h_distIn) / 3600;
  const tubeEnergyOut =
    (condensateOutFlow * h_condensateOutFinal) / 3600 +
    (distillateFlashVapor * getEnthalpyVapor(effectTemp)) / 3600 +
    (carrierSteam * h_vaporIn) / 3600; // carrier steam leaves tube side as vapor

  const tubeSide: MEDTubeSideBalance = {
    vaporIn: makeStream(
      effectNumber === 1 ? 'Motive Steam' : `Vapor from Effect ${effectNumber - 1} Demister`,
      effectNumber === 1 ? 'STEAM' : 'VAPOR',
      vaporInFlow,
      steamTemp,
      h_vaporIn,
      0
    ),
    distillateIn:
      distillateInFlow > 0
        ? makeStream(
            `Distillate from Effect ${effectNumber - 1} Tube (Siphon)`,
            'DISTILLATE',
            distillateInFlow,
            distillateInTemp,
            h_distIn,
            0
          )
        : null,
    ncgIn: ncgInFlow,
    distillateFlashVapor,
    condensateOut: makeStream(
      `Condensate/Distillate to Effect ${effectNumber + 1} Tube`,
      'DISTILLATE',
      condensateOutFlow,
      condensateOutTemp,
      h_condensateOutFinal,
      0
    ),
    ncgVent,
    carrierSteam,
    heatReleased: tubeSideHeatReleased,
    massIn: vaporInFlow + distillateInFlow,
    massOut: condensateOutFlow + distillateFlashVapor + carrierSteam,
    energyIn: tubeEnergyIn,
    energyOut: tubeEnergyOut,
  };

  // ======================================================================
  // SHELL SIDE — SPRAY ZONE (falling film)
  // ======================================================================

  // Blended spray: seawater + recirculated brine
  const totalSprayFlow = seawaterSprayFlow + recircBrineFlow;
  const blendedSalinity =
    totalSprayFlow > 0
      ? (seawaterSprayFlow * seawaterSalinity + recircBrineFlow * recircBrineSalinity) /
        totalSprayFlow
      : seawaterSalinity;
  const blendedTemp =
    totalSprayFlow > 0
      ? (seawaterSprayFlow * seawaterSprayTemp + recircBrineFlow * recircBrineTemp) / totalSprayFlow
      : seawaterSprayTemp;

  // Heat absorbed from tube side (= tube side heat released)
  // Plus carrier steam energy and distillate flash vapor energy entering shell side
  const Q_fromTube = tubeSideHeatReleased;

  // Sensible heat to raise spray to brine boiling temperature
  const cp_spray = getSeawaterSpecificHeat(
    Math.min(blendedSalinity, 120000),
    (blendedTemp + brineBoilingTemp) / 2
  );
  const Q_sensible = (totalSprayFlow * cp_spray * (brineBoilingTemp - blendedTemp)) / 3600; // kW

  // Available heat for evaporation = tube side heat + carrier steam condensation
  // + distillate flash vapor condensation — sensible heating
  const Q_carrierToShell = (carrierSteam * (h_vaporIn - getEnthalpyLiquid(effectTemp))) / 3600;
  const Q_distFlashToShell = (distillateFlashVapor * getLatentHeat(effectTemp)) / 3600;
  const Q_available = Q_fromTube + Q_carrierToShell + Q_distFlashToShell - Q_sensible;

  // Vapor produced from spray zone
  const latentHeatEffect = getLatentHeat(effectTemp);
  const sprayVaporProduced = Math.max(0, (Q_available * 3600) / latentHeatEffect);

  // Brine remaining from spray
  const sprayBrineFlow = Math.max(0, totalSprayFlow - sprayVaporProduced);
  // Brine salinity (conservation of salt)
  const sprayBrineSalinity =
    sprayBrineFlow > 0
      ? (totalSprayFlow * blendedSalinity) / sprayBrineFlow
      : blendedSalinity * brineConcentrationFactor;

  // NCG released from seawater (dissolved gases) — only from the seawater portion
  // Brine from recirculation is already deaerated
  const seawaterDensity = getSeawaterDensity(seawaterSalinity, seawaterSprayTemp);
  const seawaterVolumeLitres = seawaterSprayFlow / seawaterDensity; // litres/hr (density ≈ kg/L)
  const ncgReleased = (seawaterVolumeLitres * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6; // kg/hr

  // Enthalpies for spray zone streams
  const h_swIn = getSeawaterEnthalpy(seawaterSalinity, seawaterSprayTemp);
  const h_recircIn = getSeawaterEnthalpy(Math.min(recircBrineSalinity, 120000), recircBrineTemp);
  const h_vaporOut = getEnthalpyVapor(Math.max(vaporOutTemp, 5));
  const h_sprayBrineOut = getSeawaterEnthalpy(
    Math.min(sprayBrineSalinity, 120000),
    brineBoilingTemp
  );

  const sprayEnergyIn =
    (seawaterSprayFlow * h_swIn) / 3600 +
    (recircBrineFlow * h_recircIn) / 3600 +
    Q_fromTube +
    Q_carrierToShell +
    Q_distFlashToShell;
  const sprayEnergyOut =
    (sprayVaporProduced * h_vaporOut) / 3600 + (sprayBrineFlow * h_sprayBrineOut) / 3600;

  const shellSprayZone: MEDShellSprayZone = {
    seawaterIn: makeStream(
      `Seawater Feed to Effect ${effectNumber}`,
      'SEAWATER',
      seawaterSprayFlow,
      seawaterSprayTemp,
      h_swIn,
      seawaterSalinity
    ),
    recircBrineIn: makeStream(
      `Recirc Brine to Effect ${effectNumber}`,
      'BRINE',
      recircBrineFlow,
      recircBrineTemp,
      h_recircIn,
      recircBrineSalinity
    ),
    heatAbsorbed: Q_fromTube + Q_carrierToShell + Q_distFlashToShell,
    vaporProduced: makeStream(
      `Spray Vapor from Effect ${effectNumber}`,
      'VAPOR',
      sprayVaporProduced,
      vaporOutTemp,
      h_vaporOut,
      0
    ),
    brineOut: makeStream(
      `Spray Brine from Effect ${effectNumber}`,
      'BRINE',
      sprayBrineFlow,
      brineBoilingTemp,
      h_sprayBrineOut,
      sprayBrineSalinity
    ),
    ncgReleased,
    sensibleHeat: Q_sensible,
    latentHeat: Q_available,
    massIn: totalSprayFlow,
    massOut: sprayVaporProduced + sprayBrineFlow,
    energyIn: sprayEnergyIn,
    energyOut: sprayEnergyOut,
  };

  // ======================================================================
  // SHELL SIDE — FLASH ZONE (cascaded brine)
  // ======================================================================

  let flashVaporFlow = 0;
  let flashBrineFlow = 0;
  let flashBrineSalinity = cascadedBrineSalinity;
  let flashFraction = 0;
  let flashEnergyIn = 0;
  let flashEnergyOut = 0;

  if (cascadedBrineFlow > 0 && cascadedBrineTemp > effectTemp) {
    const h_brineIn = getSeawaterEnthalpy(
      Math.min(cascadedBrineSalinity, 120000),
      cascadedBrineTemp
    );
    const h_brineAtEffect = getSeawaterEnthalpy(
      Math.min(cascadedBrineSalinity, 120000),
      brineBoilingTemp
    );

    // Flash fraction = (h_in - h_out) / L
    flashFraction = Math.max(0, Math.min(0.05, (h_brineIn - h_brineAtEffect) / latentHeatEffect));
    flashVaporFlow = cascadedBrineFlow * flashFraction;
    flashBrineFlow = cascadedBrineFlow - flashVaporFlow;
    flashBrineSalinity =
      flashBrineFlow > 0
        ? (cascadedBrineFlow * cascadedBrineSalinity) / flashBrineFlow
        : cascadedBrineSalinity;

    flashEnergyIn = (cascadedBrineFlow * h_brineIn) / 3600;
    flashEnergyOut =
      (flashVaporFlow * h_vaporOut) / 3600 + (flashBrineFlow * h_brineAtEffect) / 3600;
  } else if (cascadedBrineFlow > 0) {
    // Brine at same or lower temp — no flash, just passes through
    const h_brineIn = getSeawaterEnthalpy(
      Math.min(cascadedBrineSalinity, 120000),
      cascadedBrineTemp
    );
    flashBrineFlow = cascadedBrineFlow;
    flashEnergyIn = (cascadedBrineFlow * h_brineIn) / 3600;
    flashEnergyOut = flashEnergyIn;
  }

  const h_flashBrineOut = getSeawaterEnthalpy(
    Math.min(flashBrineSalinity, 120000),
    brineBoilingTemp
  );

  const shellFlashZone: MEDShellFlashZone = {
    brineIn:
      cascadedBrineFlow > 0
        ? makeStream(
            `Cascaded Brine from Effect ${effectNumber - 1}`,
            'BRINE',
            cascadedBrineFlow,
            cascadedBrineTemp,
            getSeawaterEnthalpy(Math.min(cascadedBrineSalinity, 120000), cascadedBrineTemp),
            cascadedBrineSalinity
          )
        : null,
    flashVapor:
      flashVaporFlow > 0
        ? makeStream(
            `Flash Vapor in Effect ${effectNumber}`,
            'VAPOR',
            flashVaporFlow,
            vaporOutTemp,
            h_vaporOut,
            0
          )
        : null,
    brineOut:
      flashBrineFlow > 0
        ? makeStream(
            `Flashed Brine in Effect ${effectNumber}`,
            'BRINE',
            flashBrineFlow,
            brineBoilingTemp,
            h_flashBrineOut,
            flashBrineSalinity
          )
        : null,
    flashFraction,
    massIn: cascadedBrineFlow,
    massOut: flashVaporFlow + flashBrineFlow,
    energyIn: flashEnergyIn,
    energyOut: flashEnergyOut,
  };

  // ======================================================================
  // COMBINED OUTPUTS
  // ======================================================================

  // Total vapor leaving through demister → next effect tube side
  const totalVaporOutFlow = sprayVaporProduced + flashVaporFlow + distillateFlashVapor;

  // Preheater: divert some vapor before it reaches next effect
  let vaporToPreheaterFlow = 0;
  if (preheater && preheater.vaporFlow > 0) {
    vaporToPreheaterFlow = preheater.vaporFlow;
  }
  const netVaporOut = Math.max(0, totalVaporOutFlow - vaporToPreheaterFlow);

  // Total brine leaving bottom pool → next effect shell side
  const totalBrineOutFlow = sprayBrineFlow + flashBrineFlow;
  // Weighted average salinity of combined brine pool
  const totalBrineOutSalinity =
    totalBrineOutFlow > 0
      ? (sprayBrineFlow * sprayBrineSalinity + flashBrineFlow * flashBrineSalinity) /
        totalBrineOutFlow
      : sprayBrineSalinity;
  const h_totalBrineOut = getSeawaterEnthalpy(
    Math.min(totalBrineOutSalinity, 120000),
    brineBoilingTemp
  );

  // Overall mass balance check
  const totalMassIn =
    vaporInFlow + distillateInFlow + seawaterSprayFlow + recircBrineFlow + cascadedBrineFlow;
  const totalMassOut =
    netVaporOut +
    vaporToPreheaterFlow +
    totalBrineOutFlow +
    condensateOutFlow +
    carrierSteam +
    ncgReleased; // NCG mass leaves with vapor
  const massBalance = totalMassIn - totalMassOut;

  // Overall energy balance check
  const totalEnergyIn = tubeEnergyIn + sprayEnergyIn + flashEnergyIn;
  const totalEnergyOut = tubeEnergyOut + sprayEnergyOut + flashEnergyOut;
  const energyBalanceError =
    totalEnergyIn !== 0
      ? (Math.abs(totalEnergyIn - totalEnergyOut) / Math.abs(totalEnergyIn)) * 100
      : 0;

  // ======================================================================
  // BUILD RESULT
  // ======================================================================

  const totalVaporOut = makeStream(
    `Vapor from Effect ${effectNumber} (Demister)`,
    'VAPOR',
    netVaporOut,
    vaporOutTemp,
    h_vaporOut,
    0
  );

  const totalBrineOut = makeStream(
    `Brine from Effect ${effectNumber}`,
    'BRINE',
    totalBrineOutFlow,
    brineBoilingTemp,
    h_totalBrineOut,
    totalBrineOutSalinity
  );

  return {
    effectNumber,
    temperature: effectTemp,
    pressure: effectPressure,
    bpe,
    nea,
    deltaTPressureDrop: deltaTP,
    effectiveDeltaT,

    // Detailed zone balances
    tubeSide,
    shellSprayZone,
    shellFlashZone,

    // Combined outputs
    totalVaporOut,
    totalBrineOut,
    distillateOut: tubeSide.condensateOut,

    // Backward-compatible flat fields
    vaporIn: tubeSide.vaporIn,
    sprayWater: shellSprayZone.seawaterIn,
    brineIn: shellFlashZone.brineIn,
    distillateIn: tubeSide.distillateIn,
    condensateIn: tubeSide.distillateIn, // alias for backward compat
    vaporOut: totalVaporOut,
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
    brineOut: totalBrineOut,

    // Performance
    heatTransferred: tubeSideHeatReleased + Q_carrierToShell + Q_distFlashToShell,
    massBalance,
    energyBalanceError: Math.round(energyBalanceError * 100) / 100,
  };
}
