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
/** Reference seal water temperature for LRVP rating (°C) */
const LRVP_REF_SEAL_TEMP = 15;
/** Reference saturation pressure at LRVP rated conditions (bar) */
const LRVP_REF_SAT_PRESSURE = getSaturationPressure(LRVP_REF_SEAL_TEMP);

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

export type NCGLoadMode = 'manual' | 'hei_leakage' | 'seawater';
export type TrainConfig = 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid';

export interface VacuumSystemInput {
  // ── Operating conditions ──────────────────────────────────────────
  /** Suction pressure at condenser vent (mbar abs) */
  suctionPressureMbar: number;
  /** Suction temperature (°C) — typically close to saturation at suction P */
  suctionTemperatureC: number;
  /** Discharge pressure (mbar abs) — typically atmospheric ~1013 mbar */
  dischargePressureMbar: number;

  // ── NCG load ──────────────────────────────────────────────────────
  ncgMode: NCGLoadMode;
  /** Dry NCG mass flow (kg/h) — manual mode */
  dryNcgFlowKgH?: number;
  /** System vapour-side volume (m³) — HEI leakage mode */
  systemVolumeM3?: number;
  /** Additional leakage allowance per flanged connection (kg/h per joint) */
  leakagePerConnectionKgH?: number;
  /** Number of flanged connections / joints */
  connectionCount?: number;
  /** Seawater feed flow (m³/h) — seawater mode */
  seawaterFlowM3h?: number;
  /** Seawater temperature at deaeration point (°C) */
  seawaterTemperatureC?: number;
  /** Seawater salinity (g/kg), default 35 */
  salinityGkg?: number;

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
  /** Motor power (kW) */
  lrvpPowerKW?: number;

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
  _suctionTempC: number
): {
  motiveSteamKgH: number;
  entrainmentRatio: number;
  compressionRatio: number;
} {
  const totalEntrainedKgH = dryNcgKgH + vapourKgH;
  const CR = dischargePressureBar / suctionPressureBar;

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

  // CR correction factor: exponential decay
  const crFactor = CR <= 1 ? 1 : Math.exp(-1.0 * (CR - 1));

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
 * Size a liquid ring vacuum pump.
 *
 * LRVP actual capacity decreases as seal water temperature increases
 * because the vapour pressure of the seal water rises, reducing the
 * effective pumping capacity.
 *
 * Correction factor (Ryans & Roper):
 *   f = (P_sat(T_ref_high) - P_sat(T_seal)) / (P_sat(T_ref_high) - P_sat(T_ref_low))
 * where T_ref_high = 33 °C (upper catalogue reference), T_ref_low = 15 °C.
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
} {
  // Seal water temperature correction
  const tRefHigh = 33; // °C
  const pSatHigh = getSaturationPressure(tRefHigh);
  const pSatSeal = getSaturationPressure(sealWaterTempC);
  const pSatRef = LRVP_REF_SAT_PRESSURE;

  // Correction factor: how much capacity is lost due to warm seal water
  let correctionFactor: number;
  if (pSatHigh - pSatRef > 1e-6) {
    correctionFactor = Math.max(0.3, Math.min(1.0, (pSatHigh - pSatSeal) / (pSatHigh - pSatRef)));
  } else {
    correctionFactor = 1.0;
  }

  // Additional correction for deep vacuum (below ~100 mbar)
  // LRVP capacity drops significantly at very low suction pressures
  const suctionBar = suctionPressureMbar / 1000;
  const deepVacuumFactor =
    suctionBar < 0.1
      ? 0.5 + 5 * suctionBar // Linear ramp: 50% at 0 mbar, 100% at 100 mbar
      : 1.0;

  const effectiveFactor = correctionFactor * deepVacuumFactor;

  // Required rated capacity (at reference conditions)
  const requiredCorrectedCapacity = requiredCapacityM3h / effectiveFactor;

  // Select smallest frame that exceeds requirement
  const largest = LRVP_FRAME_SIZES[LRVP_FRAME_SIZES.length - 1]!;
  const selected =
    LRVP_FRAME_SIZES.find((f) => f.capacityM3h >= requiredCorrectedCapacity) ?? largest;

  return {
    model: selected.model,
    ratedCapacityM3h: selected.capacityM3h,
    correctionFactor: Math.round(effectiveFactor * 1000) / 1000,
    requiredCorrectedCapacity: Math.round(requiredCorrectedCapacity * 10) / 10,
    powerKW: selected.powerKW,
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
    suctionTemperatureC,
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
  if (suctionTemperatureC < 0 || suctionTemperatureC > 100) {
    throw new Error('Suction temperature must be between 0 and 100 °C.');
  }
  if (motivePressureBar <= 0) {
    throw new Error('Motive steam pressure must be positive.');
  }
  if (sealWaterTempC < 5 || sealWaterTempC > 45) {
    warnings.push('Seal water temperature outside typical range (5–45 °C).');
  }

  const suctionPressureBar = suctionPressureMbar / 1000;
  const dischargePressureBar = dischargePressureMbar / 1000;
  const satPressureAtSuction = getSaturationPressure(suctionTemperatureC);
  const satPressureAtSuctionMbar = satPressureAtSuction * 1000;

  // ── NCG load estimation ───────────────────────────────────────────────────

  let airLeakageKgH = 0;
  let dissolvedGasKgH = 0;

  switch (ncgMode) {
    case 'manual': {
      const ncg = input.dryNcgFlowKgH ?? 0;
      if (ncg <= 0) throw new Error('Dry NCG flow must be positive in manual mode.');
      airLeakageKgH = ncg;
      break;
    }
    case 'hei_leakage': {
      const vol = input.systemVolumeM3 ?? 0;
      if (vol <= 0) throw new Error('System volume must be positive in HEI leakage mode.');
      airLeakageKgH = heiAirLeakage(vol);
      // Additional per-connection leakage
      const perConn = input.leakagePerConnectionKgH ?? 0.05; // default 0.05 kg/h per joint
      const nConns = input.connectionCount ?? 0;
      airLeakageKgH += perConn * nConns;
      break;
    }
    case 'seawater': {
      const flow = input.seawaterFlowM3h ?? 0;
      if (flow <= 0) throw new Error('Seawater flow must be positive in seawater mode.');
      const swTemp = input.seawaterTemperatureC ?? 25;
      const salinity = input.salinityGkg ?? 35;
      const gasInfo = dissolvedGasContent(swTemp, salinity);
      // NCG from dissolved gas release: totalGasMgL × Q [m³/h] × 1000 [L/m³] × 1e-6 [kg/mg]
      dissolvedGasKgH = gasInfo.totalGasMgL * flow * 1e-3;
      // Air leakage is additional — assume HEI minimum or user-provided
      airLeakageKgH = input.dryNcgFlowKgH ?? 1.0; // default 1 kg/h leakage
      if (gasInfo.extrapolated) {
        warnings.push(
          `Seawater temperature (${swTemp} °C) is outside the Weiss (1970) valid range (0–36 °C). Dissolved gas values are extrapolated.`
        );
      }
      break;
    }
  }

  const totalDryNcgKgH = Math.round((airLeakageKgH + dissolvedGasKgH) * 100) / 100;

  // ── Vapour load at suction conditions ──────────────────────────────────────

  const vapourWithNcgKgH =
    Math.round(vapourWithNCG(totalDryNcgKgH, suctionTemperatureC, suctionPressureBar) * 100) / 100;
  const totalSuctionFlowKgH = Math.round((totalDryNcgKgH + vapourWithNcgKgH) * 100) / 100;
  const totalSuctionVolumeM3h =
    Math.round(
      volumetricFlow(
        totalSuctionFlowKgH,
        totalDryNcgKgH,
        vapourWithNcgKgH,
        suctionTemperatureC,
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
        suctionTemperatureC
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
        suctionTemperatureC
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
        stage2TempC
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
      // LRVP handles full compression from suction to discharge
      if (suctionPressureMbar < 50) {
        warnings.push(
          'Suction pressure below 50 mbar is challenging for LRVP. Consider a hybrid ejector + LRVP configuration.'
        );
      }
      const pump = sizeLRVP(designSuctionVolumeM3h, sealWaterTempC, suctionPressureMbar);
      totalPowerKW = pump.powerKW;

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
        suctionTemperatureC
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
      totalPowerKW = pump.powerKW;

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
      });
      break;
    }
  }

  // Round totals
  totalMotiveSteamKgH = Math.round(totalMotiveSteamKgH * 10) / 10;
  totalCoolingWaterM3h = Math.round(totalCoolingWaterM3h * 100) / 100;
  totalPowerKW = Math.round(totalPowerKW * 10) / 10;

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
    warnings.push(
      'Water vapour load is very high relative to NCG. This is typical at deep vacuum but verify suction conditions.'
    );
  }

  return {
    airLeakageKgH: Math.round(airLeakageKgH * 100) / 100,
    dissolvedGasKgH: Math.round(dissolvedGasKgH * 100) / 100,
    totalDryNcgKgH,
    vapourWithNcgKgH,
    totalSuctionFlowKgH,
    totalSuctionVolumeM3h,
    designSuctionVolumeM3h,
    suctionPressureMbar,
    suctionTemperatureC,
    dischargePressureMbar,
    satPressureAtSuctionMbar: Math.round(satPressureAtSuctionMbar * 10) / 10,
    stages,
    totalMotiveSteamKgH,
    totalCoolingWaterM3h,
    totalPowerKW,
    trainConfig,
    designMargin,
    warnings,
  };
}
