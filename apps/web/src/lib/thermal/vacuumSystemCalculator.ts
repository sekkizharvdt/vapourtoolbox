/**
 * Vacuum System Design Calculator
 *
 * Sizes steam ejector trains and liquid ring vacuum pumps (LRVP) for
 * maintaining vacuum in MED / MSF thermal desalination condensers.
 *
 * The calculator handles:
 *   1. NCG load estimation (manual, HEI air leakage, seawater dissolved gas)
 *   2. Vapour load accompanying NCG at vent conditions (Dalton's law)
 *   3. Single-stage and two-stage steam ejector sizing
 *   4. LRVP sizing with seal-water temperature correction
 *   5. Hybrid trains (ejector first stage + LRVP second stage)
 *   6. Inter-condenser duty between stages
 *
 * References
 * ──────────
 *  HEI Standards for Steam Surface Condensers, 11th Edition — air leakage
 *  Huang B.J. et al. (1999) — 1-D ejector model (via tvcCalculator.ts)
 *  Ryans & Roper (1986) — LRVP capacity correction
 *  El-Dessouky & Ettouney (2002) — vacuum system sizing for MED plants
 */

import {
  getSaturationPressure,
  getSaturationTemperature,
  getEnthalpyVapor,
  getLatentHeat,
} from '@vapour/constants';
import { dissolvedGasContent } from './ncgCalculator';

// ── Constants ────────────────────────────────────────────────────────────────

/** Molar mass of dry air (g/mol) */
const M_AIR = 28.97;
/** Molar mass of water (g/mol) */
const M_H2O = 18.015;
/** Universal gas constant (J / mol·K) */
const R_UNIV = 8.314;

/**
 * Vent-gas approach: the NCG offtake nozzle sits at the condenser's first-pass
 * (cold) tube entry, so the extracted gas is cooled to within a couple of °C of
 * the tube-side coolant inlet temperature. Vent gas ≈ coolant inlet + this Δ,
 * capped at the vapour-space saturation temperature.
 */
const VENT_APPROACH_C = 2;

/**
 * LRVP frame-table rating basis. The `capacityM3h` values in LRVP_FRAME_SIZES are
 * the actual suction capacity at this reference suction pressure and seal-water
 * temperature. Capacity at other conditions is scaled by the blank-off formula
 * in sizeLRVP(). (Documented assumption — re-anchor if real single-stage
 * catalogue curves are obtained; the *form* of the correction is the physics.)
 */
const LRVP_RATING_SUCTION_MBAR = 100;
const LRVP_RATING_SEAL_TEMP_C = 15;

// ── HEI Air Leakage Table ────────────────────────────────────────────────────

/**
 * HEI Standards air leakage rates (kg/h dry air) based on system volume.
 * Interpolated linearly between breakpoints.
 * Source: HEI Standards for Steam Surface Condensers, Table 7.1
 */
const HEI_LEAKAGE_TABLE: { volumeM3: number; leakageKgH: number }[] = [
  { volumeM3: 0.5, leakageKgH: 0.5 },
  { volumeM3: 1, leakageKgH: 0.7 },
  { volumeM3: 3, leakageKgH: 1.0 },
  { volumeM3: 5, leakageKgH: 1.5 },
  { volumeM3: 10, leakageKgH: 2.5 },
  { volumeM3: 20, leakageKgH: 4.0 },
  { volumeM3: 50, leakageKgH: 7.5 },
  { volumeM3: 100, leakageKgH: 12.0 },
  { volumeM3: 200, leakageKgH: 20.0 },
  { volumeM3: 500, leakageKgH: 35.0 },
];

/**
 * Standard LRVP frame sizes (m³/h actual suction capacity at 15 °C seal water).
 * Typical commercial sizes from Nash / Siemens / Busch catalogues.
 */
const LRVP_FRAME_SIZES: { model: string; capacityM3h: number; powerKW: number }[] = [
  { model: 'LRVP-25', capacityM3h: 25, powerKW: 2.2 },
  { model: 'LRVP-50', capacityM3h: 50, powerKW: 4.0 },
  { model: 'LRVP-100', capacityM3h: 100, powerKW: 7.5 },
  { model: 'LRVP-150', capacityM3h: 150, powerKW: 11.0 },
  { model: 'LRVP-250', capacityM3h: 250, powerKW: 15.0 },
  { model: 'LRVP-400', capacityM3h: 400, powerKW: 22.0 },
  { model: 'LRVP-600', capacityM3h: 600, powerKW: 30.0 },
  { model: 'LRVP-1000', capacityM3h: 1000, powerKW: 45.0 },
  { model: 'LRVP-1500', capacityM3h: 1500, powerKW: 55.0 },
  { model: 'LRVP-2000', capacityM3h: 2000, powerKW: 75.0 },
  { model: 'LRVP-3000', capacityM3h: 3000, powerKW: 110.0 },
];

// ── Types ────────────────────────────────────────────────────────────────────

export type NCGLoadMode = 'manual' | 'hei_leakage' | 'seawater' | 'combined';
export type TrainConfig = 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid';

export interface VacuumSystemInput {
  // ── Operating conditions ──────────────────────────────────────────
  /** Suction pressure at condenser vent (mbar abs) */
  suctionPressureMbar: number;
  /**
   * Tube-side coolant inlet temperature (°C) — seawater/cooling-water entering
   * the condenser. The vent-gas temperature (and hence the vapour carried with
   * the NCG) is derived from this via ventGasTemperatureC(), not entered directly.
   */
  coolantInletTempC: number;
  /** Discharge pressure (mbar abs) — typically atmospheric ~1013 mbar */
  dischargePressureMbar: number;

  // ── NCG load ──────────────────────────────────────────────────────
  /**
   * NCG estimation mode:
   * - 'manual': user provides dry NCG flow directly
   * - 'hei_leakage': estimate from system volume per HEI Standards
   * - 'seawater': estimate from dissolved gas release + air leakage
   * - 'combined': additive — sum of manual + HEI leakage + seawater dissolved gas
   */
  ncgMode: NCGLoadMode;
  /** Dry NCG mass flow (kg/h) — manual / combined mode */
  dryNcgFlowKgH?: number;
  /** System vapour-side volume (m³) — HEI leakage / combined mode */
  systemVolumeM3?: number;
  /** Additional leakage allowance per flanged connection (kg/h per joint) */
  leakagePerConnectionKgH?: number;
  /** Number of flanged connections / joints */
  connectionCount?: number;
  /** Seawater feed flow (m³/h) — seawater / combined mode */
  seawaterFlowM3h?: number;
  /** Seawater temperature at deaeration point (°C) */
  seawaterTemperatureC?: number;
  /** Seawater salinity (g/kg), default 35 */
  salinityGkg?: number;

  // ── Combined NCG source toggles ───────────────────────────────────
  /** Include manual NCG flow (combined mode) */
  includeManualNcg?: boolean;
  /** Include HEI air leakage estimate (combined mode) */
  includeHeiLeakage?: boolean;
  /** Include seawater dissolved gas (combined mode) */
  includeSeawaterGas?: boolean;

  // ── Ejector parameters ────────────────────────────────────────────
  /** Motive steam pressure (bar abs) */
  motivePressureBar: number;
  /** Cooling water temperature for inter-condensers (°C) */
  coolingWaterTempC: number;
  /** Inter-condenser approach temperature (°C), default 5 */
  interCondenserApproachC?: number;

  // ── LRVP parameters ───────────────────────────────────────────────
  /** Seal water temperature (°C) */
  sealWaterTempC: number;

  // ── Configuration ─────────────────────────────────────────────────
  trainConfig: TrainConfig;
  /** Design margin on suction volume (fraction, e.g. 0.1 = 10%), default 0.1 */
  designMargin?: number;

  // ── Evacuation ────────────────────────────────────────────────────
  /** Vessel volume for evacuation time calculation (m³) */
  evacuationVolumeM3?: number;
}

/** Result for a single compression stage (ejector or LRVP) */
export interface StageResult {
  stageNumber: number;
  type: 'ejector' | 'lrvp' | 'inter_condenser';

  // ── Pressures ─────────────────────────────────────────────────────
  suctionPressureMbar: number;
  dischargePressureMbar: number;
  compressionRatio: number;

  // ── Flows ─────────────────────────────────────────────────────────
  /** Dry NCG flow entering this stage (kg/h) */
  dryNcgInKgH: number;
  /** Water vapour flow entering this stage (kg/h) */
  vapourInKgH: number;
  /** Total suction flow (kg/h) */
  totalSuctionKgH: number;
  /** Suction volumetric flow (m³/h at suction conditions) */
  suctionVolumeM3h: number;

  // ── Ejector-specific ──────────────────────────────────────────────
  /** Motive steam consumption (kg/h) — ejector only */
  motiveSteamKgH?: number;
  /** Entrainment ratio (kg entrained / kg motive) — ejector only */
  entrainmentRatio?: number;

  // ── LRVP-specific ─────────────────────────────────────────────────
  /** Selected LRVP model — LRVP only */
  lrvpModel?: string;
  /** LRVP rated capacity at ref conditions (m³/h) */
  lrvpRatedCapacityM3h?: number;
  /** Capacity correction factor for seal water temperature */
  lrvpCorrectionFactor?: number;
  /** Required actual capacity after correction (m³/h) */
  lrvpRequiredCapacityM3h?: number;
  /** Motor power per pump (kW) */
  lrvpPowerKW?: number;
  /** Number of parallel LRVP pumps */
  lrvpCount?: number;
  /** Total LRVP power (kW) — lrvpPowerKW × lrvpCount */
  lrvpTotalPowerKW?: number;

  // ── Inter-condenser ───────────────────────────────────────────────
  /** Condensation duty (kW) — inter-condenser only */
  condenserDutyKW?: number;
  /** Cooling water flow (m³/h) — inter-condenser only */
  coolingWaterM3h?: number;
  /** Vapour condensed (kg/h) — inter-condenser only */
  vapourCondensedKgH?: number;
}

export interface VacuumSystemResult {
  // ── NCG load breakdown ────────────────────────────────────────────
  /** Air leakage into the system (kg/h dry air) */
  airLeakageKgH: number;
  /** HEI leakage estimate (kg/h) — from system volume */
  heiLeakageKgH: number;
  /** Manual NCG input (kg/h) */
  manualNcgKgH: number;
  /** NCG from dissolved gas release (kg/h) — seawater mode only */
  dissolvedGasKgH: number;
  /** Total dry NCG load (kg/h) */
  totalDryNcgKgH: number;
  /** Water vapour accompanying NCG at suction conditions (kg/h) */
  vapourWithNcgKgH: number;
  /** Total suction mixture flow (kg/h) */
  totalSuctionFlowKgH: number;
  /** Total suction volumetric flow (m³/h at suction conditions) */
  totalSuctionVolumeM3h: number;
  /** Design suction volume including margin (m³/h) */
  designSuctionVolumeM3h: number;

  // ── Conditions ────────────────────────────────────────────────────
  suctionPressureMbar: number;
  /** Computed vent-gas temperature (°C) — coolant inlet + approach, capped at Tsat */
  suctionTemperatureC: number;
  dischargePressureMbar: number;
  satPressureAtSuctionMbar: number;

  // ── Stage results ─────────────────────────────────────────────────
  stages: StageResult[];

  // ── Totals ────────────────────────────────────────────────────────
  totalMotiveSteamKgH: number;
  totalCoolingWaterM3h: number;
  totalPowerKW: number;
  trainConfig: TrainConfig;
  designMargin: number;

  // ── Evacuation time ──────────────────────────────────────────────
  /** Evacuation volume (m³) — if specified */
  evacuationVolumeM3?: number;
  /** Estimated evacuation time from atmospheric to operating pressure (minutes) */
  evacuationTimeMinutes?: number;
  /** Evacuation time breakdown by pressure step */
  evacuationSteps?: { pressureMbar: number; capacityM3h: number; cumulativeMinutes: number }[];

  // ── Warnings ──────────────────────────────────────────────────────
  warnings: string[];
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Interpolate HEI air leakage rate from system volume.
 */
function heiAirLeakage(volumeM3: number): number {
  if (volumeM3 <= 0) return 0;
  const table = HEI_LEAKAGE_TABLE;
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (volumeM3 <= first.volumeM3) return first.leakageKgH;
  if (volumeM3 >= last.volumeM3) {
    // Extrapolate linearly using last segment slope
    const prev = table[table.length - 2]!;
    const slope = (last.leakageKgH - prev.leakageKgH) / (last.volumeM3 - prev.volumeM3);
    return last.leakageKgH + slope * (volumeM3 - last.volumeM3);
  }
  // Linear interpolation
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i]!;
    const hi = table[i + 1]!;
    if (volumeM3 <= hi.volumeM3) {
      const frac = (volumeM3 - lo.volumeM3) / (hi.volumeM3 - lo.volumeM3);
      return lo.leakageKgH + frac * (hi.leakageKgH - lo.leakageKgH);
    }
  }
  return last.leakageKgH;
}

/**
 * Vent-gas temperature at the NCG offtake.
 *
 * The offtake nozzle is located at the condenser's cold (first-pass tube entry)
 * end, so the extracted gas is cooled to roughly the tube-side coolant inlet
 * temperature plus a small approach — never above the vapour-space saturation
 * temperature at suction pressure. This sets how much water vapour rides with
 * the NCG (Dalton's law) and therefore the volumetric load the pump/ejector sees.
 */
function ventGasTemperatureC(suctionPressureMbar: number, coolantInletTempC: number): number {
  const tSat = getSaturationTemperature(suctionPressureMbar / 1000);
  return Math.min(tSat, coolantInletTempC + VENT_APPROACH_C);
}

/**
 * Calculate water vapour mass flow accompanying dry NCG at given T and P.
 * Uses Dalton's law: y_H2O = P_sat(T) / P_total.
 */
function vapourWithNCG(dryNcgKgH: number, temperatureC: number, totalPressureBar: number): number {
  const pSat = getSaturationPressure(temperatureC);
  if (pSat >= totalPressureBar) {
    // Pressure is at or below saturation — essentially all vapour
    // Return a large ratio but capped
    return dryNcgKgH * 100;
  }
  // Mole fraction of water vapour
  const yH2O = pSat / totalPressureBar;
  const yNCG = 1 - yH2O;
  if (yNCG < 1e-9) return dryNcgKgH * 100;

  // Mass ratio: (m_H2O / m_NCG) = (y_H2O × M_H2O) / (y_NCG × M_AIR)
  const massRatio = (yH2O * M_H2O) / (yNCG * M_AIR);
  return dryNcgKgH * massRatio;
}

/**
 * Calculate volumetric flow of gas mixture at given T and P.
 * Ideal gas: V = m × R × T / (P × M)
 * Returns m³/h.
 */
function volumetricFlow(
  totalMassKgH: number,
  dryNcgKgH: number,
  vapourKgH: number,
  temperatureC: number,
  totalPressureBar: number
): number {
  if (totalMassKgH <= 0) return 0;
  // Mixture molar mass (mass-weighted harmonic)
  const ncgFrac = dryNcgKgH / totalMassKgH;
  const vapFrac = vapourKgH / totalMassKgH;
  // Mass fractions → number-average molar mass
  // 1/M_mix = sum(x_i / M_i)
  const invMmix = ncgFrac / M_AIR + vapFrac / M_H2O;
  const Mmix = invMmix > 0 ? 1 / invMmix : M_AIR; // g/mol
  const TK = temperatureC + 273.15;
  const Ppa = totalPressureBar * 1e5;
  // PV = nRT  →  V = (m / M) × R × T / P
  // m in kg, M in kg/mol → n in mol
  const MmixKg = Mmix * 1e-3; // kg/mol
  // V(m³/h) = totalMassKgH × R × TK / (MmixKg × Ppa)
  return (totalMassKgH * R_UNIV * TK) / (MmixKg * Ppa);
}

/**
 * Size a single-stage steam ejector.
 *
 * Uses simplified entrainment ratio model from TVC theory:
 *   Ra_theo = (h_m - h_d_sat) / (h_d_sat - h_s)
 *   Ra_actual = Ra_theo × η_nozzle × η_mixing × η_diffuser × f(CR)
 *
 * For vacuum system ejectors handling NCG+vapour mixtures, the entrainment
 * ratio is reduced because the mixture has a higher molecular weight than
 * pure steam. We apply a correction factor of (M_steam / M_mix)^0.5.
 */
function sizeEjectorStage(
  suctionPressureBar: number,
  dischargePressureBar: number,
  motivePressureBar: number,
  dryNcgKgH: number,
  vapourKgH: number,
  _suctionTempC: number,
  warnings?: string[]
): {
  motiveSteamKgH: number;
  entrainmentRatio: number;
  compressionRatio: number;
} {
  const pushWarning = (w: string) => {
    if (warnings && !warnings.includes(w)) warnings.push(w);
  };

  const totalEntrainedKgH = dryNcgKgH + vapourKgH;
  const CR = dischargePressureBar / suctionPressureBar;

  if (motivePressureBar <= dischargePressureBar) {
    pushWarning(
      `Motive steam pressure (${motivePressureBar} bar) is at or below the ejector discharge ` +
        `pressure (${dischargePressureBar} bar) — the ejector cannot operate; increase motive ` +
        'steam pressure. Results are not meaningful.'
    );
  }

  // Enthalpies from steam tables
  const motiveSatTempC = getSaturationTemperature(motivePressureBar);
  const suctionSatTempC = getSaturationTemperature(suctionPressureBar);
  const dischargeSatTempC = getSaturationTemperature(dischargePressureBar);

  const hMotive = getEnthalpyVapor(motiveSatTempC);
  const hSuction = getEnthalpyVapor(suctionSatTempC);
  const hDischargeSat = getEnthalpyVapor(dischargeSatTempC);

  // Theoretical entrainment ratio (pure steam)
  const num = hMotive - hDischargeSat;
  const den = hDischargeSat - hSuction;
  if (den <= 0 || num <= 0) {
    // Fallback for extreme conditions
    pushWarning(
      'Ejector operating conditions are outside the entrainment model range — a fixed fallback ' +
        'entrainment ratio (Ra = 0.2) was assumed; motive steam figures are rough estimates only.'
    );
    return {
      motiveSteamKgH: totalEntrainedKgH * 5,
      entrainmentRatio: 0.2,
      compressionRatio: CR,
    };
  }
  const raTheo = num / den;

  // Component efficiencies (typical vacuum ejector values)
  const etaNozzle = 0.9;
  const etaMixing = 0.82;
  const etaDiffuser = 0.75;

  // CR correction factor: entrainment falls as compression ratio rises, but not
  // to zero across a realistic per-stage CR range (~2–8). The old exp(-(CR-1))
  // decayed far too fast (CR=4 → 0.05), forcing the Ra clamp floor on every deep-
  // vacuum stage. Gentler decay with a floor is a simplified interim correlation
  // pending a proper ejector rebuild against the Huang model in tvcCalculator.ts.
  const crFactor = CR <= 1 ? 1 : Math.max(0.2, Math.exp(-0.35 * (CR - 1)));

  const etaEjector = etaNozzle * etaMixing * etaDiffuser * crFactor;
  let raActual = raTheo * etaEjector;

  // NCG molecular weight correction: heavier mixture → lower Ra
  // Mixture molar mass at suction
  const totalMass = dryNcgKgH + vapourKgH;
  if (totalMass > 0) {
    const ncgMassFrac = dryNcgKgH / totalMass;
    const vapMassFrac = vapourKgH / totalMass;
    const invMmix = ncgMassFrac / M_AIR + vapMassFrac / M_H2O;
    const Mmix = invMmix > 0 ? 1 / invMmix : M_H2O;
    // Correction: sqrt(M_steam / M_mix) — lighter mixtures entrain more easily
    const mwCorrection = Math.sqrt(M_H2O / Mmix);
    raActual *= mwCorrection;
  }

  // Clamp to reasonable range
  raActual = Math.max(0.05, Math.min(raActual, 3.0));

  const motiveSteamKgH = totalEntrainedKgH / raActual;

  return {
    motiveSteamKgH,
    entrainmentRatio: Math.round(raActual * 1000) / 1000,
    compressionRatio: Math.round(CR * 100) / 100,
  };
}

/**
 * LRVP capacity fraction at a given suction pressure and seal-water temperature,
 * relative to the frame-table rating point.
 *
 * A liquid ring pump's capacity is limited by how close the suction pressure is
 * to the seal water's own vapour pressure: as P_suction → P_sat(T_seal) the seal
 * water flashes into the swept volume and the pump blanks off (zero capacity).
 * This single vapour-pressure-difference relation captures both the warm-seal
 * derate AND the deep-vacuum roll-off (they are the same physics):
 *
 *   fraction = (P_suction − P_sat(T_seal)) / (P_ref − P_sat(T_ref))
 *
 * At P_suction = P_sat(T_seal) the fraction is 0 — the physical blank-off /
 * ultimate-vacuum limit for a single-stage LRVP.
 */
function lrvpCapacityFraction(suctionPressureMbar: number, sealWaterTempC: number): number {
  const pBlankMbar = getSaturationPressure(sealWaterTempC) * 1000;
  const pRefNum = LRVP_RATING_SUCTION_MBAR - getSaturationPressure(LRVP_RATING_SEAL_TEMP_C) * 1000;
  return Math.max(0, (suctionPressureMbar - pBlankMbar) / pRefNum);
}

/**
 * Size a liquid ring vacuum pump.
 *
 * Capacity at the operating point is scaled from the frame rating by the
 * blank-off relation in lrvpCapacityFraction(). Throws when the suction pressure
 * is at or below the seal-water blank-off pressure — a single-stage LRVP
 * physically cannot reach that vacuum with that seal temperature.
 */
function sizeLRVP(
  requiredCapacityM3h: number,
  sealWaterTempC: number,
  suctionPressureMbar: number
): {
  model: string;
  ratedCapacityM3h: number;
  correctionFactor: number;
  requiredCorrectedCapacity: number;
  powerKW: number;
  count: number;
  totalPowerKW: number;
} {
  const pBlankMbar = Math.round(getSaturationPressure(sealWaterTempC) * 1000 * 10) / 10;
  const effectiveFactor = lrvpCapacityFraction(suctionPressureMbar, sealWaterTempC);

  if (effectiveFactor <= 0.02) {
    throw new Error(
      `Single-stage LRVP cannot reach ${suctionPressureMbar} mbar with ${sealWaterTempC}°C seal water ` +
        `(blank-off ≈ ${pBlankMbar} mbar). Use colder seal water or a two-stage LRVP / hybrid train.`
    );
  }

  // Required rated capacity (at the frame rating point)
  const requiredCorrectedCapacity = requiredCapacityM3h / effectiveFactor;

  // Select the best frame size — minimize total power for the required capacity.
  // For each frame, calculate how many pumps in parallel are needed.
  let bestModel = LRVP_FRAME_SIZES[LRVP_FRAME_SIZES.length - 1]!;
  let bestCount = Math.ceil(requiredCorrectedCapacity / bestModel.capacityM3h);
  let bestTotalPower = bestCount * bestModel.powerKW;

  for (const frame of LRVP_FRAME_SIZES) {
    if (frame.capacityM3h < requiredCorrectedCapacity) {
      // Multiple pumps needed
      const count = Math.ceil(requiredCorrectedCapacity / frame.capacityM3h);
      const totalPower = count * frame.powerKW;
      if (totalPower < bestTotalPower || (totalPower === bestTotalPower && count < bestCount)) {
        bestModel = frame;
        bestCount = count;
        bestTotalPower = totalPower;
      }
    } else {
      // Single pump sufficient
      if (frame.powerKW < bestTotalPower) {
        bestModel = frame;
        bestCount = 1;
        bestTotalPower = frame.powerKW;
      }
      break; // Frames are sorted by size — no need to check larger ones
    }
  }

  return {
    model: bestModel.model,
    ratedCapacityM3h: bestModel.capacityM3h,
    correctionFactor: Math.round(effectiveFactor * 1000) / 1000,
    requiredCorrectedCapacity: Math.round(requiredCorrectedCapacity * 10) / 10,
    powerKW: bestModel.powerKW,
    count: bestCount,
    totalPowerKW: Math.round(bestTotalPower * 10) / 10,
  };
}

/**
 * Calculate inter-condenser duty and cooling water flow.
 *
 * Between ejector stages, an inter-condenser removes most of the water
 * vapour from the ejector discharge, reducing the load on the next stage.
 * The NCG passes through uncondensed.
 */
function calculateInterCondenser(
  dryNcgKgH: number,
  totalVapourInKgH: number,
  motiveSteamKgH: number,
  dischargePressureMbar: number,
  coolingWaterTempC: number,
  approachC: number
): {
  vapourCondensedKgH: number;
  vapourOutKgH: number;
  condenserDutyKW: number;
  coolingWaterM3h: number;
  outletTempC: number;
} {
  // Total vapour entering inter-condenser = suction vapour + motive steam
  const totalVapourIn = totalVapourInKgH + motiveSteamKgH;

  // Inter-condenser outlet temperature = CW temp + approach
  const outletTempC = coolingWaterTempC + approachC;

  // At inter-condenser outlet, NCG is re-saturated with vapour at outlet T and P
  const icPressureBar = dischargePressureMbar / 1000;
  const vapourOut = vapourWithNCG(dryNcgKgH, outletTempC, icPressureBar);

  // Vapour condensed
  const vapourCondensedKgH = Math.max(0, totalVapourIn - vapourOut);

  // Condensation duty: Q = m × hfg at outlet temperature
  const hfg = getLatentHeat(outletTempC); // kJ/kg
  const condenserDutyKW = (vapourCondensedKgH * hfg) / 3600; // kJ/h → kW

  // Cooling water flow: Q = m_cw × Cp × ΔT
  // Assume CW rise of 10 °C, Cp = 4.18 kJ/(kg·K), density ~1000 kg/m³
  const cwRiseC = 10;
  const cwFlowKgH = condenserDutyKW > 0 ? (condenserDutyKW * 3600) / (4.18 * cwRiseC) : 0;
  const coolingWaterM3h = cwFlowKgH / 1000;

  return {
    vapourCondensedKgH: Math.round(vapourCondensedKgH * 100) / 100,
    vapourOutKgH: Math.round(vapourOut * 100) / 100,
    condenserDutyKW: Math.round(condenserDutyKW * 10) / 10,
    coolingWaterM3h: Math.round(coolingWaterM3h * 100) / 100,
    outletTempC,
  };
}

/**
 * Calculate evacuation time from atmospheric pressure to operating vacuum.
 *
 * Uses numerical integration: at each pressure step, the pump's effective
 * capacity at that pressure is evaluated via `capacityAtPressureM3h` and the
 * time to pump down through the increment is computed.
 *
 * For an ideal gas in a constant-volume vessel:
 *   dt = V × dP / (S(P) × P_step)
 * where S(P) is the pump's volumetric capacity at pressure P.
 *
 * Integrated numerically in 20 equal log-spaced pressure steps. The
 * capacity-vs-pressure function is supplied by the caller so pump-down uses the
 * same blank-off physics as the steady-state sizing (capacity rises toward
 * atmospheric, falls to zero at blank-off).
 */
function calculateEvacuationTime(
  vesselVolumeM3: number,
  startPressureMbar: number,
  endPressureMbar: number,
  capacityAtPressureM3h: (pressureMbar: number) => number
): {
  totalMinutes: number;
  steps: { pressureMbar: number; capacityM3h: number; cumulativeMinutes: number }[];
} {
  const nSteps = 20;
  const logStart = Math.log(startPressureMbar);
  const logEnd = Math.log(endPressureMbar);
  const dLog = (logStart - logEnd) / nSteps;

  let cumulativeMinutes = 0;
  const steps: { pressureMbar: number; capacityM3h: number; cumulativeMinutes: number }[] = [];

  for (let i = 0; i < nSteps; i++) {
    const pHigh = Math.exp(logStart - i * dLog);
    const pLow = Math.exp(logStart - (i + 1) * dLog);
    const pMid = (pHigh + pLow) / 2;

    // Effective capacity at this pressure (caller-supplied physics)
    const effectiveCapacity = capacityAtPressureM3h(pMid);

    if (effectiveCapacity <= 0) {
      cumulativeMinutes = Infinity;
      break;
    }

    // Time for this pressure step: dt = V × ln(pHigh/pLow) / S_effective
    // Derived from: V × dP/dt = -S × P  =>  dt = V × dP / (S × P)
    // Integrating: t = V × ln(P1/P2) / S
    const dt = (vesselVolumeM3 * Math.log(pHigh / pLow)) / effectiveCapacity; // hours
    cumulativeMinutes += dt * 60;

    steps.push({
      pressureMbar: Math.round(pLow * 10) / 10,
      capacityM3h: Math.round(effectiveCapacity * 10) / 10,
      cumulativeMinutes: Math.round(cumulativeMinutes * 10) / 10,
    });
  }

  return {
    totalMinutes: Math.round(cumulativeMinutes * 10) / 10,
    steps,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculate vacuum system design for a thermal desalination condenser.
 *
 * @throws When input conditions are physically invalid.
 */
export function calculateVacuumSystem(input: VacuumSystemInput): VacuumSystemResult {
  const warnings: string[] = [];
  const {
    suctionPressureMbar,
    coolantInletTempC,
    dischargePressureMbar,
    ncgMode,
    motivePressureBar,
    coolingWaterTempC,
    sealWaterTempC,
    trainConfig,
  } = input;
  const designMargin = input.designMargin ?? 0.1;
  const approachC = input.interCondenserApproachC ?? 5;

  // ── Validate inputs ────────────────────────────────────────────────────────

  if (suctionPressureMbar <= 0 || suctionPressureMbar >= dischargePressureMbar) {
    throw new Error(
      `Suction pressure (${suctionPressureMbar} mbar) must be positive and less than discharge pressure (${dischargePressureMbar} mbar).`
    );
  }
  if (coolantInletTempC < 0 || coolantInletTempC > 100) {
    throw new Error('Coolant inlet temperature must be between 0 and 100 °C.');
  }
  if (motivePressureBar <= 0) {
    throw new Error('Motive steam pressure must be positive.');
  }
  if (sealWaterTempC < 5 || sealWaterTempC > 45) {
    warnings.push('Seal water temperature outside typical range (5–45 °C).');
  }

  const suctionPressureBar = suctionPressureMbar / 1000;
  const dischargePressureBar = dischargePressureMbar / 1000;
  // Vent-gas temperature (offtake at cold end) drives the vapour carried with NCG.
  const ventTempC = ventGasTemperatureC(suctionPressureMbar, coolantInletTempC);
  const satPressureAtSuction = getSaturationPressure(ventTempC);
  const satPressureAtSuctionMbar = satPressureAtSuction * 1000;

  // ── NCG load estimation ───────────────────────────────────────────────────

  let manualNcgKgH = 0;
  let heiLeakageKgH = 0;
  let dissolvedGasKgH = 0;

  switch (ncgMode) {
    case 'manual': {
      const ncg = input.dryNcgFlowKgH ?? 0;
      if (ncg <= 0) throw new Error('Dry NCG flow must be positive in manual mode.');
      manualNcgKgH = ncg;
      break;
    }
    case 'hei_leakage': {
      const vol = input.systemVolumeM3 ?? 0;
      if (vol <= 0) throw new Error('System volume must be positive in HEI leakage mode.');
      heiLeakageKgH = heiAirLeakage(vol);
      // Additional per-connection leakage
      const perConn = input.leakagePerConnectionKgH ?? 0.05; // default 0.05 kg/h per joint
      const nConns = input.connectionCount ?? 0;
      heiLeakageKgH += perConn * nConns;
      break;
    }
    case 'seawater': {
      const flow = input.seawaterFlowM3h ?? 0;
      if (flow <= 0) throw new Error('Seawater flow must be positive in seawater mode.');
      const swTemp = input.seawaterTemperatureC ?? 25;
      const salinity = input.salinityGkg ?? 35;
      const gasInfo = dissolvedGasContent(swTemp, salinity);
      dissolvedGasKgH = gasInfo.totalGasMgL * flow * 1e-3;
      // Air leakage is additional — assume HEI minimum or user-provided
      manualNcgKgH = input.dryNcgFlowKgH ?? 1.0; // default 1 kg/h leakage
      if (gasInfo.extrapolated) {
        warnings.push(
          `Seawater temperature (${swTemp} °C) is outside the Weiss (1970) valid range (0–36 °C). Dissolved gas values are extrapolated.`
        );
      }
      break;
    }
    case 'combined': {
      // Additive NCG sources — sum all enabled contributions
      if (input.includeManualNcg !== false && (input.dryNcgFlowKgH ?? 0) > 0) {
        manualNcgKgH = input.dryNcgFlowKgH ?? 0;
      }
      if (input.includeHeiLeakage) {
        const vol = input.systemVolumeM3 ?? 0;
        if (vol > 0) {
          heiLeakageKgH = heiAirLeakage(vol);
          const perConn = input.leakagePerConnectionKgH ?? 0.05;
          const nConns = input.connectionCount ?? 0;
          heiLeakageKgH += perConn * nConns;
        }
      }
      if (input.includeSeawaterGas) {
        const flow = input.seawaterFlowM3h ?? 0;
        if (flow > 0) {
          const swTemp = input.seawaterTemperatureC ?? 25;
          const salinity = input.salinityGkg ?? 35;
          const gasInfo = dissolvedGasContent(swTemp, salinity);
          dissolvedGasKgH = gasInfo.totalGasMgL * flow * 1e-3;
          if (gasInfo.extrapolated) {
            warnings.push(
              `Seawater temperature (${swTemp} °C) is outside the Weiss (1970) valid range (0–36 °C). Dissolved gas values are extrapolated.`
            );
          }
        }
      }
      // Combined mode must have at least some NCG
      if (manualNcgKgH + heiLeakageKgH + dissolvedGasKgH <= 0) {
        throw new Error('At least one NCG source must provide a positive flow in combined mode.');
      }
      break;
    }
  }

  const airLeakageKgH = manualNcgKgH + heiLeakageKgH;
  const totalDryNcgKgH = Math.round((airLeakageKgH + dissolvedGasKgH) * 100) / 100;

  // ── Vapour load at suction conditions ──────────────────────────────────────

  const vapourWithNcgKgH =
    Math.round(vapourWithNCG(totalDryNcgKgH, ventTempC, suctionPressureBar) * 100) / 100;
  const totalSuctionFlowKgH = Math.round((totalDryNcgKgH + vapourWithNcgKgH) * 100) / 100;
  const totalSuctionVolumeM3h =
    Math.round(
      volumetricFlow(
        totalSuctionFlowKgH,
        totalDryNcgKgH,
        vapourWithNcgKgH,
        ventTempC,
        suctionPressureBar
      ) * 10
    ) / 10;
  const designSuctionVolumeM3h = Math.round(totalSuctionVolumeM3h * (1 + designMargin) * 10) / 10;

  // ── Size the vacuum train ──────────────────────────────────────────────────

  const stages: StageResult[] = [];
  let totalMotiveSteamKgH = 0;
  let totalCoolingWaterM3h = 0;
  let totalPowerKW = 0;

  const overallCR = dischargePressureBar / suctionPressureBar;

  switch (trainConfig) {
    case 'single_ejector': {
      if (overallCR > 6) {
        warnings.push(
          `Overall compression ratio (${overallCR.toFixed(1)}) is very high for a single-stage ejector. Consider a two-stage configuration.`
        );
      }
      const ej = sizeEjectorStage(
        suctionPressureBar,
        dischargePressureBar,
        motivePressureBar,
        totalDryNcgKgH,
        vapourWithNcgKgH,
        ventTempC,
        warnings
      );
      totalMotiveSteamKgH = Math.round(ej.motiveSteamKgH * 10) / 10;
      stages.push({
        stageNumber: 1,
        type: 'ejector',
        suctionPressureMbar,
        dischargePressureMbar,
        compressionRatio: ej.compressionRatio,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH,
        totalSuctionKgH: totalSuctionFlowKgH,
        suctionVolumeM3h: designSuctionVolumeM3h,
        motiveSteamKgH: totalMotiveSteamKgH,
        entrainmentRatio: ej.entrainmentRatio,
      });
      break;
    }

    case 'two_stage_ejector': {
      // Optimal intermediate pressure: geometric mean
      const pIntBar = Math.sqrt(suctionPressureBar * dischargePressureBar);
      const pIntMbar = Math.round(pIntBar * 1000 * 10) / 10;

      // Stage 1: suction → intermediate
      const ej1 = sizeEjectorStage(
        suctionPressureBar,
        pIntBar,
        motivePressureBar,
        totalDryNcgKgH,
        vapourWithNcgKgH,
        ventTempC,
        warnings
      );
      const stage1MotiveSteam = Math.round(ej1.motiveSteamKgH * 10) / 10;
      totalMotiveSteamKgH += stage1MotiveSteam;

      stages.push({
        stageNumber: 1,
        type: 'ejector',
        suctionPressureMbar,
        dischargePressureMbar: pIntMbar,
        compressionRatio: ej1.compressionRatio,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH,
        totalSuctionKgH: totalSuctionFlowKgH,
        suctionVolumeM3h: designSuctionVolumeM3h,
        motiveSteamKgH: stage1MotiveSteam,
        entrainmentRatio: ej1.entrainmentRatio,
      });

      // Inter-condenser between stages
      const ic = calculateInterCondenser(
        totalDryNcgKgH,
        vapourWithNcgKgH,
        stage1MotiveSteam,
        pIntMbar,
        coolingWaterTempC,
        approachC
      );
      totalCoolingWaterM3h += ic.coolingWaterM3h;

      stages.push({
        stageNumber: 2,
        type: 'inter_condenser',
        suctionPressureMbar: pIntMbar,
        dischargePressureMbar: pIntMbar,
        compressionRatio: 1,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH + stage1MotiveSteam,
        totalSuctionKgH: totalDryNcgKgH + vapourWithNcgKgH + stage1MotiveSteam,
        suctionVolumeM3h: 0,
        condenserDutyKW: ic.condenserDutyKW,
        coolingWaterM3h: ic.coolingWaterM3h,
        vapourCondensedKgH: ic.vapourCondensedKgH,
      });

      // Stage 2: intermediate → discharge
      const stage2NcgKgH = totalDryNcgKgH;
      const stage2VapourKgH = ic.vapourOutKgH;
      const stage2TotalKgH = stage2NcgKgH + stage2VapourKgH;
      const stage2TempC = ic.outletTempC;
      const stage2VolumeM3h =
        Math.round(
          volumetricFlow(stage2TotalKgH, stage2NcgKgH, stage2VapourKgH, stage2TempC, pIntBar) *
            (1 + designMargin) *
            10
        ) / 10;

      const ej2 = sizeEjectorStage(
        pIntBar,
        dischargePressureBar,
        motivePressureBar,
        stage2NcgKgH,
        stage2VapourKgH,
        stage2TempC,
        warnings
      );
      const stage2MotiveSteam = Math.round(ej2.motiveSteamKgH * 10) / 10;
      totalMotiveSteamKgH += stage2MotiveSteam;

      stages.push({
        stageNumber: 3,
        type: 'ejector',
        suctionPressureMbar: pIntMbar,
        dischargePressureMbar,
        compressionRatio: ej2.compressionRatio,
        dryNcgInKgH: stage2NcgKgH,
        vapourInKgH: stage2VapourKgH,
        totalSuctionKgH: stage2TotalKgH,
        suctionVolumeM3h: stage2VolumeM3h,
        motiveSteamKgH: stage2MotiveSteam,
        entrainmentRatio: ej2.entrainmentRatio,
      });
      break;
    }

    case 'lrvp_only': {
      // LRVP handles full compression from suction to discharge. The vapour load
      // (from the computed vent-gas temperature) and volumetric flow are the
      // shared values computed above — the same every train config uses. The
      // blank-off feasibility limit is enforced inside sizeLRVP().
      const pump = sizeLRVP(designSuctionVolumeM3h, sealWaterTempC, suctionPressureMbar);
      totalPowerKW = pump.totalPowerKW;

      stages.push({
        stageNumber: 1,
        type: 'lrvp',
        suctionPressureMbar,
        dischargePressureMbar,
        compressionRatio: Math.round(overallCR * 100) / 100,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH,
        totalSuctionKgH: totalSuctionFlowKgH,
        suctionVolumeM3h: designSuctionVolumeM3h,
        lrvpModel: pump.model,
        lrvpRatedCapacityM3h: pump.ratedCapacityM3h,
        lrvpCorrectionFactor: pump.correctionFactor,
        lrvpRequiredCapacityM3h: pump.requiredCorrectedCapacity,
        lrvpPowerKW: pump.powerKW,
        lrvpCount: pump.count,
        lrvpTotalPowerKW: pump.totalPowerKW,
      });
      break;
    }

    case 'hybrid': {
      // Stage 1: ejector from suction to intermediate pressure
      // Stage 2: LRVP from intermediate to discharge
      // Intermediate pressure chosen where LRVP operates efficiently (~100–200 mbar)
      const lrvpMinSuction = 100; // mbar — LRVP works well above this
      const pIntMbar = Math.max(
        lrvpMinSuction,
        Math.round(Math.sqrt(suctionPressureMbar * dischargePressureMbar))
      );
      const pIntBar = pIntMbar / 1000;

      // Stage 1: ejector
      const ej = sizeEjectorStage(
        suctionPressureBar,
        pIntBar,
        motivePressureBar,
        totalDryNcgKgH,
        vapourWithNcgKgH,
        ventTempC,
        warnings
      );
      const ejMotiveSteam = Math.round(ej.motiveSteamKgH * 10) / 10;
      totalMotiveSteamKgH = ejMotiveSteam;

      stages.push({
        stageNumber: 1,
        type: 'ejector',
        suctionPressureMbar,
        dischargePressureMbar: pIntMbar,
        compressionRatio: ej.compressionRatio,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH,
        totalSuctionKgH: totalSuctionFlowKgH,
        suctionVolumeM3h: designSuctionVolumeM3h,
        motiveSteamKgH: ejMotiveSteam,
        entrainmentRatio: ej.entrainmentRatio,
      });

      // Inter-condenser
      const ic = calculateInterCondenser(
        totalDryNcgKgH,
        vapourWithNcgKgH,
        ejMotiveSteam,
        pIntMbar,
        coolingWaterTempC,
        approachC
      );
      totalCoolingWaterM3h += ic.coolingWaterM3h;

      stages.push({
        stageNumber: 2,
        type: 'inter_condenser',
        suctionPressureMbar: pIntMbar,
        dischargePressureMbar: pIntMbar,
        compressionRatio: 1,
        dryNcgInKgH: totalDryNcgKgH,
        vapourInKgH: vapourWithNcgKgH + ejMotiveSteam,
        totalSuctionKgH: totalDryNcgKgH + vapourWithNcgKgH + ejMotiveSteam,
        suctionVolumeM3h: 0,
        condenserDutyKW: ic.condenserDutyKW,
        coolingWaterM3h: ic.coolingWaterM3h,
        vapourCondensedKgH: ic.vapourCondensedKgH,
      });

      // Stage 2: LRVP from intermediate to discharge
      const stage2NcgKgH = totalDryNcgKgH;
      const stage2VapourKgH = ic.vapourOutKgH;
      const stage2TotalKgH = stage2NcgKgH + stage2VapourKgH;
      const stage2TempC = ic.outletTempC;
      const stage2VolumeM3h =
        Math.round(
          volumetricFlow(stage2TotalKgH, stage2NcgKgH, stage2VapourKgH, stage2TempC, pIntBar) *
            (1 + designMargin) *
            10
        ) / 10;

      const pump = sizeLRVP(stage2VolumeM3h, sealWaterTempC, pIntMbar);
      totalPowerKW = pump.totalPowerKW;

      stages.push({
        stageNumber: 3,
        type: 'lrvp',
        suctionPressureMbar: pIntMbar,
        dischargePressureMbar,
        compressionRatio: Math.round((dischargePressureBar / pIntBar) * 100) / 100,
        dryNcgInKgH: stage2NcgKgH,
        vapourInKgH: stage2VapourKgH,
        totalSuctionKgH: stage2TotalKgH,
        suctionVolumeM3h: stage2VolumeM3h,
        lrvpModel: pump.model,
        lrvpRatedCapacityM3h: pump.ratedCapacityM3h,
        lrvpCorrectionFactor: pump.correctionFactor,
        lrvpRequiredCapacityM3h: pump.requiredCorrectedCapacity,
        lrvpPowerKW: pump.powerKW,
        lrvpCount: pump.count,
        lrvpTotalPowerKW: pump.totalPowerKW,
      });
      break;
    }
  }

  // Round totals
  totalMotiveSteamKgH = Math.round(totalMotiveSteamKgH * 10) / 10;
  totalCoolingWaterM3h = Math.round(totalCoolingWaterM3h * 100) / 100;
  totalPowerKW = Math.round(totalPowerKW * 10) / 10;

  // ── Evacuation time ─────────────────────────────────────────────────────────

  let evacuationVolumeM3: number | undefined;
  let evacuationTimeMinutes: number | undefined;
  let evacuationSteps:
    | { pressureMbar: number; capacityM3h: number; cumulativeMinutes: number }[]
    | undefined;

  if (input.evacuationVolumeM3 && input.evacuationVolumeM3 > 0) {
    evacuationVolumeM3 = input.evacuationVolumeM3;
    // Pump-down capacity at each pressure uses the same blank-off physics as the
    // steady-state sizing: capacity rises toward atmospheric (capped at 1.5×
    // rating for realistic open-suction displacement) and falls to zero at
    // blank-off. Capacity fraction is evaluated per-pressure during integration.
    const evacCapacityFn = (totalRatedCapacityM3h: number) => (pMbar: number) =>
      totalRatedCapacityM3h * Math.min(1.5, lrvpCapacityFraction(pMbar, sealWaterTempC));

    const lrvpStage = stages.find((s) => s.type === 'lrvp');
    if (lrvpStage && lrvpStage.lrvpRatedCapacityM3h) {
      const totalRated = lrvpStage.lrvpRatedCapacityM3h * (lrvpStage.lrvpCount ?? 1);
      const evac = calculateEvacuationTime(
        evacuationVolumeM3,
        dischargePressureMbar, // start from atmospheric
        suctionPressureMbar, // pump down to operating vacuum
        evacCapacityFn(totalRated)
      );
      evacuationTimeMinutes = evac.totalMinutes;
      evacuationSteps = evac.steps;
    } else if (trainConfig === 'single_ejector' || trainConfig === 'two_stage_ejector') {
      // For ejector-only configs, size a temporary LRVP for evacuation. If the
      // operating vacuum is below the temp LRVP's blank-off, sizeLRVP throws —
      // skip the estimate and flag that a hogging ejector is needed instead.
      try {
        const evacPump = sizeLRVP(designSuctionVolumeM3h, sealWaterTempC, suctionPressureMbar);
        const totalRated = evacPump.ratedCapacityM3h * evacPump.count;
        const evac = calculateEvacuationTime(
          evacuationVolumeM3,
          dischargePressureMbar,
          suctionPressureMbar,
          evacCapacityFn(totalRated)
        );
        evacuationTimeMinutes = evac.totalMinutes;
        evacuationSteps = evac.steps;
        warnings.push(
          `Evacuation time estimated using ${evacPump.count > 1 ? `${evacPump.count}× ` : ''}${evacPump.model} (${evacPump.totalPowerKW} kW). Ejector trains require a separate pump or hogging ejector for initial evacuation.`
        );
      } catch {
        warnings.push(
          'Evacuation time not estimated: operating vacuum is below the blank-off of a liquid-ring evacuation pump at this seal-water temperature. A hogging ejector or colder seal water is required for initial evacuation.'
        );
      }
    }
  }

  // ── Validation warnings ─────────────────────────────────────────────────────

  if (overallCR > 20) {
    warnings.push(
      `Very high overall compression ratio (${overallCR.toFixed(0)}:1). Verify system pressures.`
    );
  }
  if (totalDryNcgKgH < 0.1) {
    warnings.push('Very low NCG load. Verify input values.');
  }
  if (vapourWithNcgKgH > totalDryNcgKgH * 50) {
    const tSat = getSaturationTemperature(suctionPressureBar);
    const subcooling = Math.round((tSat - ventTempC) * 10) / 10;
    if (subcooling < 3) {
      warnings.push(
        `Water vapour load is very high relative to NCG. Vent gas (${ventTempC}\u00B0C, from coolant inlet ${coolantInletTempC}\u00B0C) is within ${subcooling}\u00B0C of saturation (${Math.round(tSat * 10) / 10}\u00B0C). ` +
          'A colder tube-side coolant inlet would subcool the vent gas further and reduce vapour carry-over.'
      );
    } else {
      warnings.push(
        'Water vapour load is very high relative to NCG. This is typical at deep vacuum but verify suction conditions.'
      );
    }
  }

  // Warn about multiple parallel LRVP pumps
  const lrvpStages = stages.filter((s) => s.type === 'lrvp');
  for (const s of lrvpStages) {
    if (s.lrvpCount && s.lrvpCount > 1) {
      warnings.push(
        `Required capacity exceeds single pump. Sized as ${s.lrvpCount}× ${s.lrvpModel} in parallel (${s.lrvpTotalPowerKW} kW total).`
      );
    }
  }

  return {
    airLeakageKgH: Math.round(airLeakageKgH * 100) / 100,
    heiLeakageKgH: Math.round(heiLeakageKgH * 100) / 100,
    manualNcgKgH: Math.round(manualNcgKgH * 100) / 100,
    dissolvedGasKgH: Math.round(dissolvedGasKgH * 100) / 100,
    totalDryNcgKgH,
    vapourWithNcgKgH,
    totalSuctionFlowKgH,
    totalSuctionVolumeM3h,
    designSuctionVolumeM3h,
    suctionPressureMbar,
    suctionTemperatureC: Math.round(ventTempC * 10) / 10,
    dischargePressureMbar,
    satPressureAtSuctionMbar: Math.round(satPressureAtSuctionMbar * 10) / 10,
    stages,
    totalMotiveSteamKgH,
    totalCoolingWaterM3h,
    totalPowerKW,
    trainConfig,
    designMargin,
    evacuationVolumeM3,
    evacuationTimeMinutes,
    evacuationSteps,
    warnings,
  };
}
