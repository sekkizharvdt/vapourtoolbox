/**
 * Performance Ratio / GOR (Gain Output Ratio) Calculator
 *
 * Estimates the thermal performance of a Multi-Effect Distillation (MED) plant.
 *
 * GOR is the key metric for thermal desalination efficiency:
 *   GOR = mass of distillate produced / mass of motive steam consumed
 *
 * Typical values:
 *   - MED without TVC: GOR 4-8 (roughly 0.8-0.9 x number of effects)
 *   - MED-TVC: GOR 8-12
 *
 * Method (El-Dessouky & Ettouney, 2002):
 *   1. Distribute temperature across effects accounting for BPE and NEA losses
 *   2. Calculate concentration profile (parallel vs. forward feed)
 *   3. Estimate GOR from effective thermal driving force
 *   4. For MED-TVC, apply entrainment ratio boost
 *   5. Derive STE, cooling water, and feed requirements
 *
 * References:
 *   - El-Dessouky, H.T. & Ettouney, H.M. (2002) "Fundamentals of Salt Water
 *     Desalination," Elsevier
 *   - Sharqawy, M.H. et al. (2010) "Thermophysical properties of seawater"
 *   - Al-Shammiri, M. & Safar, M. (1999) "Multi-effect distillation plants:
 *     state of the art," Desalination, 126, 45-59
 */

import {
  getLatentHeat,
  getSaturationTemperature,
  getBoilingPointElevation,
  getSeawaterSpecificHeat,
} from '@vapour/constants';

// ============================================================================
// Types
// ============================================================================

/** MED plant feed configuration */
export type PlantConfiguration = 'MED_PARALLEL' | 'MED_FORWARD' | 'MED_TVC';

/** Input parameters for GOR calculation */
export interface GORInput {
  /** Number of effects (typically 4-16) */
  numberOfEffects: number;
  /** Plant feed configuration */
  configuration: PlantConfiguration;

  // Temperature parameters
  /** Top brine temperature in °C (typically 62-70°C) */
  topBrineTemperature: number;
  /** Temperature of the last effect in °C (typically 38-42°C) */
  lastEffectTemperature: number;
  /** Intake seawater temperature in °C (typically 25-35°C) */
  seawaterTemperature: number;

  // Steam supply
  /** Motive steam pressure in bar abs */
  steamPressure: number;

  // Feed
  /** Seawater feed salinity in ppm (typically 35000-45000) */
  feedSalinity: number;
  /** Maximum allowable brine concentration in ppm (typically 65000-72000) */
  maxBrineSalinity: number;

  // Condenser
  /** Temperature approach in final condenser in °C (typically 3-5°C) */
  condenserApproach: number;
  /** Terminal temperature difference in °C (typically 2.5-4°C) */
  condenserTTD: number;

  // TVC parameters (only used when configuration is MED_TVC)
  /** Entrainment ratio — kg entrained vapor / kg motive steam (typically 0.8-1.5) */
  tvcEntrainmentRatio?: number;
  /** Compression ratio — discharge pressure / suction pressure */
  tvcCompressionRatio?: number;

  // Plant capacity (optional — enables absolute flow calculations)
  /** Distillate production capacity in m³/day */
  distillateCapacity?: number;
}

/** Detail for a single evaporator effect */
export interface EffectDetail {
  /** Effect number (1 = first / hottest) */
  effectNumber: number;
  /** Brine temperature in this effect in °C */
  temperature: number;
  /** Condensing steam temperature feeding this effect in °C */
  steamTemperature: number;
  /** Boiling point elevation in °C */
  bpElevation: number;
  /** Non-equilibrium allowance in °C */
  neAllowance: number;
  /** Effective temperature driving force in °C */
  effectiveDeltaT: number;
  /** Latent heat of vaporisation at this effect temperature in kJ/kg */
  latentHeat: number;
  /** Brine salinity leaving this effect in ppm */
  salinity: number;
  /** Fraction of total distillate produced in this effect */
  distillateRate: number;
}

/** Complete result of the GOR calculation */
export interface GORResult {
  // Key performance metrics
  /** Gain Output Ratio (dimensionless) — gross (includes E1 condensate as product) */
  gor: number;
  /** Net GOR — excludes E1 condensate (returns to steam source, e.g. solar field).
   *  For plants where E1 condensate IS product water, use gross GOR instead. */
  netGOR: number;
  /** Specific thermal energy in kJ per kg of distillate */
  specificThermalEnergy: number;
  /** Specific thermal energy in kWh per m³ of distillate */
  specificThermalEnergy_kWh: number;
  /** Overall thermal efficiency (0-1) */
  thermalEfficiency: number;

  // Temperature profile
  /** Per-effect details */
  effects: EffectDetail[];
  /** Sum of BPE losses across all effects in °C */
  totalBPELoss: number;
  /** Sum of NEA losses across all effects in °C */
  totalNEALoss: number;
  /** TBT minus last-effect temperature in °C */
  availableDeltaT: number;
  /** Available minus total losses in °C */
  effectiveDeltaT: number;
  /** Mean effective ΔT per effect in °C */
  meanEffectiveDeltaT: number;

  // Absolute mass flows (only populated when distillateCapacity is provided)
  /** Motive steam flow in kg/s */
  steamFlow?: number;
  /** Total seawater feed flow in kg/s */
  feedFlow?: number;
  /** Distillate production flow in kg/s */
  distillateFlow?: number;
  /** Brine blowdown flow in kg/s */
  brineFlow?: number;
  /** Cooling water flow in kg/s */
  coolingWaterFlow?: number;

  // Specific consumption ratios
  /** kg of feed per kg of distillate */
  specificFeed: number;
  /** kg of cooling water per kg of distillate */
  specificCoolingWater: number;
  /** Overall recovery ratio (0-1) */
  totalRecovery: number;

  // TVC
  /** GOR multiplier attributable to the TVC (only for MED_TVC) */
  tvcBoost?: number;

  // Condenser
  /** Normalised condenser duty in kW per (kg/s of distillate) */
  condenserDuty: number;

  // Warnings
  /** Advisory messages about the design */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Plant configuration metadata */
export const PLANT_CONFIGURATIONS: Record<
  PlantConfiguration,
  { label: string; description: string }
> = {
  MED_PARALLEL: {
    label: 'MED \u2013 Parallel Feed',
    description: 'Feed distributed to all effects simultaneously',
  },
  MED_FORWARD: {
    label: 'MED \u2013 Forward Feed',
    description: 'Feed enters first effect, brine cascades to subsequent effects',
  },
  MED_TVC: {
    label: 'MED\u2013TVC',
    description: 'MED with thermo-vapour compressor for enhanced GOR',
  },
};

/** Typical design parameter ranges */
export const TYPICAL_RANGES = {
  TBT: { min: 55, max: 75, unit: '\u00B0C' },
  LAST_EFFECT_TEMP: { min: 35, max: 45, unit: '\u00B0C' },
  EFFECTS: { min: 2, max: 16 },
  GOR_MED: { min: 4, max: 8 },
  GOR_MED_TVC: { min: 8, max: 16 },
  CONDENSER_APPROACH: { min: 2, max: 6, unit: '\u00B0C' },
} as const;

/** Default non-equilibrium allowance per effect in °C */
const DEFAULT_NEA = 0.33;

/** Heat loss factor (accounts for radiation, piping losses, etc.) */
const HEAT_LOSS_FACTOR = 0.95;

/** Density of distillate (fresh water) in kg/m³ */
const DISTILLATE_DENSITY = 1000;

// ============================================================================
// Helpers
// ============================================================================

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to 4 decimal places */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Calculate the non-equilibrium allowance (NEA) for a given effect.
 *
 * NEA increases slightly for later (lower-temperature) effects due to
 * reduced driving force. Use a simple linear model: 0.2 at TBT end,
 * up to 0.5 at the cold end.
 */
function getNEA(effectIndex: number, totalEffects: number): number {
  if (totalEffects <= 1) return DEFAULT_NEA;
  const fraction = effectIndex / (totalEffects - 1); // 0 at first, 1 at last
  return round4(0.2 + 0.3 * fraction);
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate GOR and thermal performance of an MED plant.
 *
 * @param input - Plant design parameters
 * @returns Full performance result including effect-by-effect detail
 */
export function calculateGOR(input: GORInput): GORResult {
  const warnings: string[] = [];

  // ------------------------------------------------------------------
  // 1. Input validation
  // ------------------------------------------------------------------
  const {
    numberOfEffects: N,
    configuration,
    topBrineTemperature: TBT,
    lastEffectTemperature: TLast,
    seawaterTemperature: Tsw,
    steamPressure,
    feedSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserTTD,
    tvcEntrainmentRatio,
    distillateCapacity,
  } = input;

  if (N < 2 || N > 16) {
    throw new Error(`Number of effects (${N}) must be between 2 and 16`);
  }
  if (TBT <= TLast) {
    throw new Error(
      `Top brine temperature (${TBT}\u00B0C) must exceed last effect temperature (${TLast}\u00B0C)`
    );
  }
  if (feedSalinity >= maxBrineSalinity) {
    throw new Error(
      `Feed salinity (${feedSalinity} ppm) must be less than max brine salinity (${maxBrineSalinity} ppm)`
    );
  }
  if (Tsw >= TLast) {
    throw new Error(
      `Seawater temperature (${Tsw}\u00B0C) must be less than last effect temperature (${TLast}\u00B0C)`
    );
  }

  // Validate steam pressure gives a saturation temperature above TBT
  const Tsteam = getSaturationTemperature(steamPressure);
  if (Tsteam <= TBT) {
    throw new Error(
      `Steam saturation temperature (${round2(Tsteam)}\u00B0C at ${steamPressure} bar) must exceed TBT (${TBT}\u00B0C)`
    );
  }

  if (configuration === 'MED_TVC' && (tvcEntrainmentRatio == null || tvcEntrainmentRatio <= 0)) {
    throw new Error('TVC entrainment ratio must be provided and > 0 for MED_TVC configuration');
  }

  // ------------------------------------------------------------------
  // 2. Temperature distribution across effects
  // ------------------------------------------------------------------
  const deltaTTotal = TBT - TLast;
  const deltaTPerEffect = deltaTTotal / N;

  if (deltaTPerEffect < 1.0) {
    warnings.push(
      `\u0394T per effect is only ${round2(deltaTPerEffect)}\u00B0C — insufficient driving force (recommend \u2265 1.5\u00B0C)`
    );
  }

  // ------------------------------------------------------------------
  // 3. Recovery and concentration profile
  // ------------------------------------------------------------------
  const totalRecovery = round4(1 - feedSalinity / maxBrineSalinity);

  if (totalRecovery > 0.45) {
    warnings.push(
      `Recovery ratio ${round2(totalRecovery * 100)}% exceeds 45% — elevated scaling risk`
    );
  }

  const evapPerEffect = totalRecovery / N;

  // ------------------------------------------------------------------
  // 4. Build effect-by-effect detail
  // ------------------------------------------------------------------
  const effects: EffectDetail[] = [];
  let totalBPE = 0;
  let totalNEA = 0;

  for (let i = 0; i < N; i++) {
    const effectNum = i + 1;
    const temperature = round2(TBT - i * deltaTPerEffect);

    // Salinity depends on feed configuration
    let salinity: number;
    if (configuration === 'MED_PARALLEL') {
      // Parallel feed: every effect receives fresh seawater, each evaporates
      // the same fraction => same concentration factor everywhere
      const localRecovery = evapPerEffect; // fraction of feed that evaporates in each effect
      salinity = round2(feedSalinity / (1 - localRecovery));
    } else {
      // Forward feed (including MED_TVC): brine cascades, salinity rises
      const cumulativeEvap = effectNum * evapPerEffect;
      // Guard against division by zero at the boundary
      const denom = Math.max(1 - cumulativeEvap, 0.001);
      salinity = round2(feedSalinity / denom);
    }

    // Clamp salinity for BPE lookup to the correlation's valid range (120 000 ppm)
    const salinityForBPE = Math.min(salinity, 120000);
    const bpe = round4(getBoilingPointElevation(salinityForBPE, temperature));
    const nea = round4(getNEA(i, N));

    totalBPE += bpe;
    totalNEA += nea;

    const loss = bpe + nea;
    const effectiveDT = round4(Math.max(deltaTPerEffect - loss, 0));

    // Steam temperature feeding this effect: for effect 1 it is the motive
    // steam Tsat; for subsequent effects it is the vapour from the previous
    // effect (brine temp of previous effect minus its BPE — i.e. pure-water
    // boiling point).
    let steamTemp: number;
    if (i === 0) {
      steamTemp = round2(Tsteam);
    } else {
      const prev = effects[i - 1]!;
      steamTemp = round2(prev.temperature - prev.bpElevation);
    }

    const latentHeatVal = round2(getLatentHeat(temperature));

    effects.push({
      effectNumber: effectNum,
      temperature,
      steamTemperature: steamTemp,
      bpElevation: round2(bpe),
      neAllowance: round2(nea),
      effectiveDeltaT: round2(effectiveDT),
      latentHeat: latentHeatVal,
      salinity,
      distillateRate: round4(1 / N), // equal evaporation assumption
    });
  }

  totalBPE = round2(totalBPE);
  totalNEA = round2(totalNEA);

  const effectiveDeltaT = round2(deltaTTotal - totalBPE - totalNEA);
  const meanEffectiveDT = round2(effectiveDeltaT / N);

  // BPE penalty warning
  if (totalBPE + totalNEA > 0.3 * deltaTTotal) {
    warnings.push(
      `BPE + NEA losses (${round2(totalBPE + totalNEA)}\u00B0C) exceed 30% of available \u0394T (${deltaTTotal}\u00B0C)`
    );
  }

  // ------------------------------------------------------------------
  // 5. GOR estimation (El-Dessouky & Ettouney simplified model)
  // ------------------------------------------------------------------
  // Thermal efficiency: fraction of available ΔT that is effective
  const thermalEfficiency = round4(Math.max(effectiveDeltaT, 0) / Math.max(deltaTTotal, 0.01));

  // Base GOR for MED (without TVC)
  let gorBase = round4(N * thermalEfficiency * HEAT_LOSS_FACTOR);

  // Latent heat at steam supply temperature (first-effect heating steam)
  const latentHeatSteam = getLatentHeat(Tsteam);

  // For MED-TVC, the TVC recycles vapour from an intermediate effect,
  // reducing the net motive steam consumption.
  let tvcBoost: number | undefined;
  if (configuration === 'MED_TVC' && tvcEntrainmentRatio != null) {
    // GOR_TVC = GOR_base × (1 + Ra)
    // because only m_motive = m_total / (1 + Ra) is drawn from the boiler
    tvcBoost = round4(1 + tvcEntrainmentRatio);
    gorBase = round4(gorBase * tvcBoost);
  }

  const gor = round2(gorBase);

  // Net GOR: excludes E1 condensate (which returns to steam source in solar/waste-heat plants)
  // E1 condensate ≈ 1 unit of distillate per unit of steam (the steam that condenses in E1)
  // Net distillate = gross distillate - 1 (the E1 condensate)
  // Net GOR = GOR - 1 (simplified; exact value depends on vent losses)
  const ventLossFraction = 0.015; // ~1.5% vent loss
  const netGOR = round2(Math.max(0, gor - (1 - ventLossFraction)));

  // Warn if GOR is outside typical range
  if (configuration === 'MED_TVC') {
    if (gor < TYPICAL_RANGES.GOR_MED_TVC.min || gor > TYPICAL_RANGES.GOR_MED_TVC.max) {
      warnings.push(
        `GOR ${gor} is outside typical MED-TVC range (${TYPICAL_RANGES.GOR_MED_TVC.min}\u2013${TYPICAL_RANGES.GOR_MED_TVC.max})`
      );
    }
  } else {
    if (gor < TYPICAL_RANGES.GOR_MED.min || gor > TYPICAL_RANGES.GOR_MED.max) {
      warnings.push(
        `GOR ${gor} is outside typical MED range (${TYPICAL_RANGES.GOR_MED.min}\u2013${TYPICAL_RANGES.GOR_MED.max})`
      );
    }
  }

  // ------------------------------------------------------------------
  // 6. Specific thermal energy
  // ------------------------------------------------------------------
  const ste = round2(latentHeatSteam / Math.max(gor, 0.01)); // kJ/kg distillate
  const ste_kWh_m3 = round2((ste * DISTILLATE_DENSITY) / 3600); // kWh/m³

  // ------------------------------------------------------------------
  // 7. Cooling water requirement
  // ------------------------------------------------------------------
  const latentHeatLastEffect = getLatentHeat(TLast);
  const tCondOut = TLast - condenserTTD;
  const cpSw = getSeawaterSpecificHeat(feedSalinity, (Tsw + tCondOut) / 2);

  // Condenser duty: the full last-effect vapour (approx 1/N of distillate)
  // enters the condenser.  Normalised to kW per (kg/s of last-effect vapour).
  const condenserDutyNorm = round2(latentHeatLastEffect);

  const deltaTCooling = Math.max(tCondOut - Tsw, 0.1);
  // Specific CW per kg of total distillate
  const specificCW = round2(latentHeatLastEffect / (N * cpSw * deltaTCooling));

  // Validate condenser approach is achievable
  const condenserOutletTemp = TLast - condenserApproach;
  if (condenserOutletTemp <= Tsw) {
    warnings.push(
      `Condenser approach of ${condenserApproach}\u00B0C gives outlet temperature ${round2(condenserOutletTemp)}\u00B0C which is at or below seawater temperature (${Tsw}\u00B0C)`
    );
  }

  if (TLast < 38) {
    warnings.push(
      `Last effect temperature ${TLast}\u00B0C < 38\u00B0C \u2014 condenser will be very large`
    );
  }

  // ------------------------------------------------------------------
  // 8. Feed requirement
  // ------------------------------------------------------------------
  const specificFeed = round2(1 / Math.max(totalRecovery, 0.001));

  // ------------------------------------------------------------------
  // 9. Absolute flows (if capacity provided)
  // ------------------------------------------------------------------
  let steamFlow: number | undefined;
  let feedFlowAbs: number | undefined;
  let distillateFlowAbs: number | undefined;
  let brineFlowAbs: number | undefined;
  let coolingWaterFlowAbs: number | undefined;

  if (distillateCapacity != null && distillateCapacity > 0) {
    // Convert m³/day to kg/s (assume distillate density ≈ 1000 kg/m³)
    const mDistKgS = round4((distillateCapacity * DISTILLATE_DENSITY) / 86400);
    distillateFlowAbs = round4(mDistKgS);
    steamFlow = round4(mDistKgS / Math.max(gor, 0.01));
    feedFlowAbs = round4(mDistKgS * specificFeed);
    brineFlowAbs = round4(feedFlowAbs - mDistKgS);
    coolingWaterFlowAbs = round4(mDistKgS * specificCW);
  }

  // ------------------------------------------------------------------
  // 10. Assemble result
  // ------------------------------------------------------------------
  return {
    gor,
    netGOR,
    specificThermalEnergy: ste,
    specificThermalEnergy_kWh: ste_kWh_m3,
    thermalEfficiency,

    effects,
    totalBPELoss: totalBPE,
    totalNEALoss: totalNEA,
    availableDeltaT: round2(deltaTTotal),
    effectiveDeltaT: round2(effectiveDeltaT),
    meanEffectiveDeltaT: meanEffectiveDT,

    steamFlow,
    feedFlow: feedFlowAbs,
    distillateFlow: distillateFlowAbs,
    brineFlow: brineFlowAbs,
    coolingWaterFlow: coolingWaterFlowAbs,

    specificFeed,
    specificCoolingWater: specificCW,
    totalRecovery: round4(totalRecovery),

    ...(tvcBoost != null && { tvcBoost }),

    condenserDuty: condenserDutyNorm,

    warnings,
  };
}
