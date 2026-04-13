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
  /** Preheater condensate entering tube side in kg/hr (routed from upstream preheater) */
  preheaterCondensateInFlow: number;
  /** Preheater condensate temperature in °C */
  preheaterCondensateInTemp: number;

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
  /** BPE safety factor (multiplier, default 1.0) */
  bpeSafetyFactor?: number;
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
    preheaterCondensateInFlow,
    preheaterCondensateInTemp,
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
  const bpeRaw = getBoilingPointElevation(Math.min(brineSalinityForBPE, 120000), effectTemp);
  const bpe = bpeRaw * (input.bpeSafetyFactor ?? 1.0);
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

  // Preheater condensate flash (same logic as distillate — enters tube side, flashes)
  let phCondensateFlashVapor = 0;
  let Q_phCondensateFlash = 0;
  let phCondensateRemaining = preheaterCondensateInFlow;

  if (preheaterCondensateInFlow > 0 && preheaterCondensateInTemp > effectTemp) {
    const h_phCondIn = getEnthalpyLiquid(preheaterCondensateInTemp);
    const h_phCondAtEffect = getEnthalpyLiquid(effectTemp);
    const latentHeatEff = getLatentHeat(effectTemp);

    const flashFractionPH = Math.min(0.05, (h_phCondIn - h_phCondAtEffect) / latentHeatEff);
    phCondensateFlashVapor = preheaterCondensateInFlow * Math.max(0, flashFractionPH);
    phCondensateRemaining = preheaterCondensateInFlow - phCondensateFlashVapor;
    Q_phCondensateFlash = (phCondensateFlashVapor * latentHeatEff) / 3600;
  }

  // Condensate/distillate out = condensed vapor + remaining distillate + remaining PH condensate
  const condensateOutFlow = condensingVapor + distillateRemaining + phCondensateRemaining;
  const condensateOutTemp = effectTemp;
  const h_condensateOutFinal = getEnthalpyLiquid(condensateOutTemp);

  // Total flash vapor from tube side (distillate + PH condensate)
  distillateFlashVapor = distillateFlashVapor + phCondensateFlashVapor;
  Q_distillateFlash = Q_distillateFlash + Q_phCondensateFlash;

  // NCG: all tube-side NCG is vented to the shell side
  const ncgVent = ncgInFlow;

  // Net heat released from tube side to shell side
  const tubeSideHeatReleased = Q_condensing - Q_distillateFlash;

  // Tube side energy balance
  const h_distIn = distillateInFlow > 0 ? getEnthalpyLiquid(distillateInTemp) : 0;
  const h_phCondIn =
    preheaterCondensateInFlow > 0 ? getEnthalpyLiquid(preheaterCondensateInTemp) : 0;
  const tubeEnergyIn =
    (vaporInFlow * h_vaporIn) / 3600 +
    (distillateInFlow * h_distIn) / 3600 +
    (preheaterCondensateInFlow * h_phCondIn) / 3600;
  const tubeEnergyOut =
    (condensateOutFlow * h_condensateOutFinal) / 3600 +
    (distillateFlashVapor * getEnthalpyVapor(effectTemp)) / 3600 +
    (carrierSteam * h_vaporIn) / 3600;

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
    massIn: vaporInFlow + distillateInFlow + preheaterCondensateInFlow,
    massOut: condensateOutFlow + distillateFlashVapor + carrierSteam,
    energyIn: tubeEnergyIn,
    energyOut: tubeEnergyOut,
  };

  // ======================================================================
  // SHELL SIDE — COMBINED ZONE (spray + cascaded brine)
  // ======================================================================
  // All shell-side liquid inputs are blended into one pool:
  //   - Fresh seawater spray (parallel feed)
  //   - Recirculated brine (if any)
  //   - Cascaded brine from previous effect (hot, high salinity)
  // The combined pool is heated to boiling by tube-side heat, then evaporates.
  // No separate "flash zone" — flashing is a side effect of the energy balance,
  // consistent with industry practice and WET Excel design programs.

  const totalSprayFlow = seawaterSprayFlow + recircBrineFlow + cascadedBrineFlow;
  const blendedSalinity =
    totalSprayFlow > 0
      ? (seawaterSprayFlow * seawaterSalinity +
          recircBrineFlow * recircBrineSalinity +
          cascadedBrineFlow * cascadedBrineSalinity) /
        totalSprayFlow
      : seawaterSalinity;

  // Heat absorbed from tube side (= tube side heat released)
  const Q_fromTube = tubeSideHeatReleased;

  // Carrier steam enters shell directly (bypasses tube wall via NCG vents)
  const Q_carrierToShell = (carrierSteam * (h_vaporIn - getEnthalpyLiquid(effectTemp))) / 3600;
  // Distillate flash vapor condenses on spray film
  const Q_distFlashToShell = (distillateFlashVapor * getLatentHeat(effectTemp)) / 3600;

  // ---- Vapor production via enthalpy balance (matches WET Excel methodology) ----
  // Energy in = Q_tube (through wall) + Q_carrier + Q_distFlash + shell inlet enthalpies
  // Energy out = m_vapor × h_vapor + m_brine × h_brine
  // Since m_brine = m_shell_in + distFlash_condensate - m_vapor:
  //   m_vapor = (Q_in_total + Σ(m_i × h_i)_in - m_shell_in × h_brine) / (h_vapor - h_brine)
  const latentHeatEffect = getLatentHeat(effectTemp);

  // Shell inlet enthalpy sum (all streams entering the shell)
  const h_swIn_shell = getSeawaterEnthalpy(seawaterSalinity, seawaterSprayTemp);
  const h_recircIn_shell = getSeawaterEnthalpy(
    Math.min(recircBrineSalinity, 120000),
    recircBrineTemp
  );
  const h_cascBrineIn =
    cascadedBrineFlow > 0
      ? getSeawaterEnthalpy(Math.min(cascadedBrineSalinity, 120000), cascadedBrineTemp)
      : 0;

  const shellInletEnthalpy =
    (seawaterSprayFlow * h_swIn_shell) / 3600 +
    (recircBrineFlow * h_recircIn_shell) / 3600 +
    (cascadedBrineFlow * h_cascBrineIn) / 3600;

  // Total energy into the shell
  const Q_shell_total = Q_fromTube + Q_carrierToShell + Q_distFlashToShell + shellInletEnthalpy;

  // Outlet enthalpies
  const h_vaporOut_shell = getEnthalpyVapor(Math.max(vaporOutTemp, 5));

  // Total shell inlet mass (including distillate flash condensate that re-enters the pool)
  const shellInletMass = totalSprayFlow + distillateFlashVapor;
  const totalInletSalt = totalSprayFlow * blendedSalinity; // salt mass flow (ppm × kg/hr)

  // Brine outlet salinity depends on vapor production (circular).
  // Pass 1: estimate with approximate salinity, then refine once.
  const estimatedOutletSalinity = Math.min(
    (blendedSalinity + blendedSalinity * brineConcentrationFactor) / 2,
    120000
  );
  let h_brineOut_shell = getSeawaterEnthalpy(estimatedOutletSalinity, brineBoilingTemp);

  // Enthalpy balance: m_vapor = (Q_total - m_in × h_brine) / (h_vapor - h_brine)
  let denominator = h_vaporOut_shell - h_brineOut_shell;
  let sprayVaporProduced =
    denominator > 0
      ? Math.max(0, (Q_shell_total * 3600 - shellInletMass * h_brineOut_shell) / denominator)
      : 0;

  // Pass 2: recompute with mass-balance-derived outlet salinity
  const pass1BrineFlow = Math.max(1, shellInletMass - sprayVaporProduced);
  const pass2Salinity = Math.min(totalInletSalt / pass1BrineFlow, 120000);
  const h_brineOut_refined = getSeawaterEnthalpy(pass2Salinity, brineBoilingTemp);
  if (Math.abs(h_brineOut_refined - h_brineOut_shell) > 0.1) {
    h_brineOut_shell = h_brineOut_refined;
    denominator = h_vaporOut_shell - h_brineOut_shell;
    sprayVaporProduced =
      denominator > 0
        ? Math.max(0, (Q_shell_total * 3600 - shellInletMass * h_brineOut_shell) / denominator)
        : 0;
  }

  // Brine remaining = total pool + distillate flash condensate - evaporated vapor
  const sprayBrineFlow = Math.max(0, totalSprayFlow + distillateFlashVapor - sprayVaporProduced);
  // Brine salinity (conservation of salt — all salt stays in the brine)
  const sprayBrineSalinity =
    sprayBrineFlow > 0
      ? totalInletSalt / sprayBrineFlow
      : blendedSalinity * brineConcentrationFactor;

  // NCG released from seawater (dissolved gases) — only from the seawater portion
  // Brine from recirculation is already deaerated
  const seawaterDensity = getSeawaterDensity(seawaterSalinity, seawaterSprayTemp);
  const seawaterVolumeLitres = seawaterSprayFlow / seawaterDensity; // litres/hr (density ≈ kg/L)
  const ncgReleased = (seawaterVolumeLitres * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6; // kg/hr

  // Enthalpies for spray zone streams (reuse shell inlet values)
  const h_vaporOut = getEnthalpyVapor(Math.max(vaporOutTemp, 5));
  const h_sprayBrineOut = getSeawaterEnthalpy(
    Math.min(sprayBrineSalinity, 120000),
    brineBoilingTemp
  );

  const sprayEnergyIn = shellInletEnthalpy + Q_fromTube + Q_carrierToShell + Q_distFlashToShell;
  const sprayEnergyOut =
    (sprayVaporProduced * h_vaporOut) / 3600 + (sprayBrineFlow * h_sprayBrineOut) / 3600;

  const shellSprayZone: MEDShellSprayZone = {
    seawaterIn: makeStream(
      `Seawater Feed to Effect ${effectNumber}`,
      'SEAWATER',
      seawaterSprayFlow,
      seawaterSprayTemp,
      h_swIn_shell,
      seawaterSalinity
    ),
    recircBrineIn: makeStream(
      `Recirc Brine to Effect ${effectNumber}`,
      'BRINE',
      recircBrineFlow,
      recircBrineTemp,
      h_recircIn_shell,
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
    sensibleHeat:
      Q_fromTube +
      Q_carrierToShell +
      Q_distFlashToShell -
      (sprayVaporProduced * latentHeatEffect) / 3600,
    latentHeat: (sprayVaporProduced * latentHeatEffect) / 3600,
    massIn: totalSprayFlow,
    massOut: sprayVaporProduced + sprayBrineFlow,
    energyIn: sprayEnergyIn,
    energyOut: sprayEnergyOut,
  };

  // ======================================================================
  // SHELL SIDE — FLASH ZONE (legacy — now merged into spray zone above)
  // Cascaded brine is blended with the spray pool. No separate flash vapor.
  // These variables are kept at zero for backward compatibility with the
  // result structure (MEDShellFlashZone).
  // ======================================================================

  const flashVaporFlow = 0;
  const flashBrineFlow = 0;
  const flashBrineSalinity = cascadedBrineSalinity;
  const flashFraction = 0;
  let flashEnergyIn = 0;
  let flashEnergyOut = 0;

  if (cascadedBrineFlow > 0) {
    const h_brineIn = getSeawaterEnthalpy(
      Math.min(cascadedBrineSalinity, 120000),
      cascadedBrineTemp
    );
    // Energy tracked for reporting but brine is handled in spray zone
    flashEnergyIn = (cascadedBrineFlow * h_brineIn) / 3600;
    flashEnergyOut = flashEnergyIn; // passes through to spray pool
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
  // distillateFlashVapor is NOT included: it re-condenses on the spray film
  // in the shell and its latent heat is already counted in Q_distFlashToShell
  // which contributes to sprayVaporProduced.
  const totalVaporOutFlow = sprayVaporProduced + flashVaporFlow;

  // Preheater: divert some vapor before it reaches next effect
  let vaporToPreheaterFlow = 0;
  if (preheater && preheater.vaporFlow > 0) {
    vaporToPreheaterFlow = preheater.vaporFlow;
  }
  const netVaporOut = Math.max(0, totalVaporOutFlow - vaporToPreheaterFlow);

  // Total brine leaving bottom pool → next effect shell side
  // (cascaded brine is already blended into the spray pool)
  const totalBrineOutFlow = sprayBrineFlow;
  const totalBrineOutSalinity = sprayBrineSalinity;
  const h_totalBrineOut = getSeawaterEnthalpy(
    Math.min(totalBrineOutSalinity, 120000),
    brineBoilingTemp
  );

  // Overall mass balance check
  const totalMassIn =
    vaporInFlow +
    distillateInFlow +
    preheaterCondensateInFlow +
    seawaterSprayFlow +
    recircBrineFlow +
    cascadedBrineFlow;
  const totalMassOut =
    netVaporOut +
    vaporToPreheaterFlow +
    totalBrineOutFlow +
    condensateOutFlow +
    carrierSteam +
    ncgReleased; // NCG mass leaves with vapor
  const massBalance = totalMassIn - totalMassOut;

  // Overall energy balance — computed from boundary streams only
  // (inter-zone heat transfer is internal and must not be double-counted)
  const boundaryEnergyIn =
    (vaporInFlow * h_vaporIn) / 3600 + // tube side: vapor in
    (distillateInFlow * h_distIn) / 3600 + // tube side: distillate siphon in
    (preheaterCondensateInFlow * h_phCondIn) / 3600 + // tube side: preheater condensate
    (seawaterSprayFlow * getSeawaterEnthalpy(seawaterSalinity, seawaterSprayTemp)) / 3600 + // shell: seawater
    (recircBrineFlow *
      getSeawaterEnthalpy(Math.min(recircBrineSalinity, 120000), recircBrineTemp)) /
      3600 + // shell: recirc brine
    (cascadedBrineFlow > 0
      ? (cascadedBrineFlow *
          getSeawaterEnthalpy(Math.min(cascadedBrineSalinity, 120000), cascadedBrineTemp)) /
        3600
      : 0); // shell: cascaded brine

  const boundaryEnergyOut =
    (condensateOutFlow * h_condensateOutFinal) / 3600 + // tube side: distillate out
    (netVaporOut * h_vaporOut) / 3600 + // shell: vapor through demister
    (vaporToPreheaterFlow * h_vaporOut) / 3600 + // shell: vapor to preheater
    (totalBrineOutFlow * h_totalBrineOut) / 3600 + // shell: brine out
    (carrierSteam * h_vaporIn) / 3600; // tube→shell: carrier steam (leaves the effect with shell vapor)

  const energyBalanceError =
    boundaryEnergyIn !== 0
      ? (Math.abs(boundaryEnergyIn - boundaryEnergyOut) / Math.abs(boundaryEnergyIn)) * 100
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
