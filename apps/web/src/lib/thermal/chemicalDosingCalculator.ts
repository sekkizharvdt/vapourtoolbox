/**
 * Chemical Dosing & CIP Calculator
 *
 * Calculates chemical dosing rates, pump sizing, storage tanks, dilution,
 * and acid clean-in-place (CIP) system design for thermal desalination plants.
 *
 * Supported chemicals:
 *   1. Antiscalant — Belgard EV 2050 (scale inhibitor)
 *   2. Anti-foam   — Belite M8 (for oily feed water)
 *
 * Acid CIP:
 *   Formic acid, citric acid, or HCl for heat exchanger cleaning.
 */

// ── Chemical Product Types ────────────────────────────────────────────────────

export type ChemicalType = 'antiscalant' | 'antifoam';

export interface ChemicalProduct {
  id: ChemicalType;
  productName: string;
  manufacturer: string;
  purpose: string;
  typicalDoseMin: number; // mg/L
  typicalDoseMax: number; // mg/L
  defaultDensity: number; // kg/L
  defaultNeatConcentration: number; // % w/w (100 = pure product)
  notes: string;
}

export const CHEMICAL_PRODUCTS: Record<ChemicalType, ChemicalProduct> = {
  antiscalant: {
    id: 'antiscalant',
    productName: 'Belgard EV 2050',
    manufacturer: 'Chemtreat / Nouryon',
    purpose: 'Scale inhibitor for CaCO₃, CaSO₄, Mg(OH)₂',
    typicalDoseMin: 1.0,
    typicalDoseMax: 4.0,
    defaultDensity: 1.1,
    defaultNeatConcentration: 100,
    notes: 'Dosed into feed seawater upstream of the first effect. Continuous dosing.',
  },
  antifoam: {
    id: 'antifoam',
    productName: 'Belite M8',
    manufacturer: 'Suez / Veolia',
    purpose: 'Anti-foam agent for oily feed water',
    typicalDoseMin: 0.05,
    typicalDoseMax: 0.5,
    defaultDensity: 1.0,
    defaultNeatConcentration: 100,
    notes: 'Used when feed contains traces of hydrocarbons or surfactants. Intermittent dosing.',
  },
};

// ── Acid CIP Product Types ────────────────────────────────────────────────────

export type AcidType = 'formic' | 'citric' | 'hydrochloric';

export interface AcidProduct {
  id: AcidType;
  name: string;
  formula: string;
  neatConcentration: number; // % w/w as supplied
  neatDensity: number; // kg/L
  typicalCleaningMin: number; // % w/w
  typicalCleaningMax: number; // % w/w
  defaultCleaningConc: number; // % w/w
  notes: string;
}

export const ACID_PRODUCTS: Record<AcidType, AcidProduct> = {
  formic: {
    id: 'formic',
    name: 'Formic Acid',
    formula: 'HCOOH',
    neatConcentration: 85,
    neatDensity: 1.22,
    typicalCleaningMin: 2,
    typicalCleaningMax: 5,
    defaultCleaningConc: 3,
    notes: 'Preferred for MED/TVC scale removal. Effective on CaCO₃ and Mg(OH)₂. Biodegradable.',
  },
  citric: {
    id: 'citric',
    name: 'Citric Acid',
    formula: 'C₆H₈O₇',
    neatConcentration: 50,
    neatDensity: 1.24,
    typicalCleaningMin: 2,
    typicalCleaningMax: 5,
    defaultCleaningConc: 3,
    notes: 'Mild organic acid. Used for light scale and passivation. Food-grade available.',
  },
  hydrochloric: {
    id: 'hydrochloric',
    name: 'Hydrochloric Acid',
    formula: 'HCl',
    neatConcentration: 33,
    neatDensity: 1.16,
    typicalCleaningMin: 2,
    typicalCleaningMax: 10,
    defaultCleaningConc: 5,
    notes:
      'Strong mineral acid. Very effective on hard CaSO₄ scale. Requires corrosion inhibitor for carbon steel.',
  },
};

// ── Tank Dimensions ───────────────────────────────────────────────────────────

export interface TankDimensions {
  volume: number; // m³
  volumeLitres: number; // L
  type: 'cylindrical' | 'rectangular';
  /** Cylindrical: internal diameter (m) */
  diameter?: number;
  /** Height (m) */
  height: number;
  /** Rectangular: length (m) */
  length?: number;
  /** Rectangular: width (m) */
  width?: number;
}

/**
 * Calculate tank dimensions from a required volume.
 *
 * Cylindrical: V = π/4 × D² × H, with H = aspectRatio × D
 *   → D = (4V / (π × aspectRatio))^(1/3)
 *
 * Rectangular: assume square base, H = aspectRatio × W
 *   → W = (V / aspectRatio)^(1/3)
 */
export function calculateTankDimensions(
  volumeM3: number,
  type: 'cylindrical' | 'rectangular' = 'cylindrical',
  aspectRatio: number = 1.5
): TankDimensions {
  if (volumeM3 <= 0) {
    return { volume: 0, volumeLitres: 0, type, height: 0 };
  }

  if (type === 'cylindrical') {
    const D = Math.pow((4 * volumeM3) / (Math.PI * aspectRatio), 1 / 3);
    const H = aspectRatio * D;
    return {
      volume: volumeM3,
      volumeLitres: volumeM3 * 1000,
      type: 'cylindrical',
      diameter: round3(D),
      height: round3(H),
    };
  } else {
    // Square base: V = W × W × H, H = aspectRatio × W
    const W = Math.pow(volumeM3 / aspectRatio, 1 / 3);
    const H = aspectRatio * W;
    return {
      volume: volumeM3,
      volumeLitres: volumeM3 * 1000,
      type: 'rectangular',
      length: round3(W),
      width: round3(W),
      height: round3(H),
    };
  }
}

// ── Dosing Line Sizing ────────────────────────────────────────────────────────

/** Standard dosing tubing sizes (OD in mm, wall thickness in mm) */
export const DOSING_TUBING_SIZES = [
  { od: 6, wall: 1.0, id: 4.0 },
  { od: 8, wall: 1.5, id: 5.0 },
  { od: 10, wall: 1.5, id: 7.0 },
  { od: 12, wall: 2.0, id: 8.0 },
  { od: 16, wall: 2.0, id: 12.0 },
] as const;

export interface DosingLineResult {
  /** Recommended tubing OD (mm) */
  tubingOD: number;
  /** Recommended tubing ID (mm) */
  tubingID: number;
  /** Flow velocity in tubing (m/s) */
  velocity: number;
  /** Velocity status */
  velocityStatus: 'low' | 'ok' | 'high';
}

/**
 * Select dosing line tubing size.
 * Target velocity: 0.5–1.5 m/s. Below 0.3 m/s → settling risk. Above 2.0 m/s → excessive ΔP.
 */
export function selectDosingLine(flowLh: number): DosingLineResult {
  const flowM3s = flowLh / (3600 * 1000); // L/h → m³/s

  // Try each size from smallest, pick first with velocity in range
  for (const tube of DOSING_TUBING_SIZES) {
    const areaM2 = (Math.PI / 4) * Math.pow(tube.id / 1000, 2);
    const velocity = flowM3s / areaM2;

    if (velocity <= 1.5) {
      const status: DosingLineResult['velocityStatus'] =
        velocity < 0.3 ? 'low' : velocity > 1.5 ? 'high' : 'ok';
      return {
        tubingOD: tube.od,
        tubingID: tube.id,
        velocity: round3(velocity),
        velocityStatus: status,
      };
    }
  }

  // All too small — use largest
  const largest = DOSING_TUBING_SIZES[DOSING_TUBING_SIZES.length - 1]!;
  const areaM2 = (Math.PI / 4) * Math.pow(largest.id / 1000, 2);
  const velocity = flowM3s / areaM2;
  return {
    tubingOD: largest.od,
    tubingID: largest.id,
    velocity: round3(velocity),
    velocityStatus: velocity > 2.0 ? 'high' : 'ok',
  };
}

// ── Dosing Pump Pressure ──────────────────────────────────────────────────────

export interface PumpPressureResult {
  /** Process line pressure at injection point (bar g) */
  linePressure: number;
  /** Back-pressure valve setting (bar) */
  backPressureValve: number;
  /** Injection nozzle / check valve losses (bar) */
  injectionLoss: number;
  /** Required pump discharge pressure (bar g) */
  requiredDischargePressure: number;
}

/** Default back-pressure valve differential (bar) */
const DEFAULT_BPV_BAR = 1.5;
/** Default injection loss (bar) */
const DEFAULT_INJECTION_LOSS_BAR = 0.5;

export function calculatePumpPressure(linePressureBarG: number): PumpPressureResult {
  const bpv = DEFAULT_BPV_BAR;
  const injLoss = DEFAULT_INJECTION_LOSS_BAR;
  return {
    linePressure: linePressureBarG,
    backPressureValve: bpv,
    injectionLoss: injLoss,
    requiredDischargePressure: round2(linePressureBarG + bpv + injLoss),
  };
}

// ── Dilution ──────────────────────────────────────────────────────────────────

export interface DilutionResult {
  /** Neat (as-supplied) concentration (% w/w) */
  neatConcentration: number;
  /** Working (diluted) concentration (% w/w) */
  workingConcentration: number;
  /** Dilution ratio (neat/working) */
  dilutionRatio: number;
  /** Flow of neat chemical (L/h) */
  neatChemicalFlowLh: number;
  /** Flow of dilution water (L/h) */
  dilutionWaterFlowLh: number;
  /** Total diluted solution flow (L/h) */
  dilutedSolutionFlowLh: number;
  /** Dilution/day tank dimensions (if dilutionTankDays provided) */
  dilutionTank?: TankDimensions;
  /** Dilution tank bund volume 110% (m³) */
  dilutionTankBund?: number;
}

// ── Dosing Input / Output ─────────────────────────────────────────────────────

export interface DosingInput {
  /** Feed seawater flow rate (m³/h) */
  feedFlowM3h: number;
  /** Chemical dose (mg/L = ppm by mass) */
  doseMgL: number;
  /** Solution density (kg/L) — of neat product */
  solutionDensityKgL: number;
  /** Number of days storage required (optional — for bulk tank sizing) */
  storageDays?: number;

  // Dilution (optional)
  /** Neat (as-supplied) concentration (% w/w). 100 = undiluted product. */
  neatConcentration?: number;
  /** Working (diluted) concentration (% w/w). If provided, dilution is calculated. */
  workingConcentration?: number;
  /** Days of diluted solution to store in day/dilution tank */
  dilutionTankDays?: number;

  // Dosing pump pressure (optional)
  /** Process line pressure at injection point (bar g) */
  linePressureBarG?: number;

  // Tank geometry (optional)
  /** Tank shape preference */
  tankType?: 'cylindrical' | 'rectangular';
  /** Tank height-to-diameter (or H/W) aspect ratio — default 1.5 */
  tankAspectRatio?: number;
}

export interface DosingResult {
  /** Chemical solution flow rate (L/h) — of neat product */
  chemicalFlowLh: number;
  /** Chemical solution flow rate (mL/min) — useful for dosing pump selection */
  chemicalFlowMlMin: number;
  /** Actual dose in treated stream (mg/L) — confirmation */
  doseConfirmMgL: number;
  /** Active chemical mass flow rate (g/h) */
  activeChemicalGh: number;
  /** Daily chemical consumption (kg/day) — of neat product */
  dailyConsumptionKg: number;
  /** Monthly chemical consumption (kg/month, 30.4 days) */
  monthlyConsumptionKg: number;
  /** Annual chemical consumption (kg/year) */
  annualConsumptionKg: number;

  // Storage tank (bulk, neat chemical)
  /** Storage tank volume (m³) — only if storageDays provided */
  storageTankM3?: number;
  /** Storage tank dimensions */
  storageTank?: TankDimensions;
  /** Bund volume 110% (m³) */
  bundVolume?: number;

  // Dilution
  /** Dilution results — only if workingConcentration provided */
  dilution?: DilutionResult;

  // Dosing pump
  /** Pump pressure results — only if linePressureBarG provided */
  pumpPressure?: PumpPressureResult;

  // Dosing line
  /** Dosing line tubing recommendation */
  dosingLine: DosingLineResult;

  /** Warnings */
  warnings: string[];
}

// ── CIP Input / Output ───────────────────────────────────────────────────────

export interface CIPInput {
  /** Acid type */
  acidType: AcidType;
  /** Heat exchanger tube/plate surface area (m²) */
  heatExchangerArea: number;
  /** Specific volume — litres of solution per m² of HX surface (default 3 L/m²) */
  specificVolume?: number;
  /** Additional piping hold-up volume (m³, default 0) */
  pipingHoldup?: number;
  /** Override: total system hold-up volume (m³). If provided, area-based calc is skipped. */
  systemHoldupOverride?: number;
  /** Target acid cleaning concentration (% w/w) */
  cleaningConcentration: number;
  /** Brine pump recirculation flow rate (m³/h) */
  recirculationFlowM3h: number;
  /** Cleaning duration per cycle (hours) */
  cleaningDurationHrs: number;
  /** Number of fresh water rinses after acid */
  numberOfRinses: number;
  /** Number of CIP cycles per year */
  cleaningsPerYear: number;
  /** Days of neat acid storage */
  storageDays?: number;
  /** Tank shape preference */
  tankType?: 'cylindrical' | 'rectangular';
  /** Tank aspect ratio — default 1.5 */
  tankAspectRatio?: number;
}

export interface CIPResult {
  // System volume
  /** Total system hold-up volume (m³) */
  systemVolume: number;
  /** Total system hold-up volume (L) */
  systemVolumeLitres: number;
  /** HX contribution to system volume (m³) */
  hxVolume: number;
  /** Piping contribution to system volume (m³) */
  pipingVolume: number;

  // Per-clean quantities
  /** Volume of dilute acid solution needed per clean (m³) */
  diluteSolutionVolume: number;
  /** Volume of neat (concentrated) acid per clean (L) */
  neatAcidLitres: number;
  /** Mass of neat acid per clean (kg) */
  neatAcidMassKg: number;
  /** Dilution water volume per clean (m³) */
  dilutionWaterVolume: number;

  // Rinse
  /** Rinse water per cycle (m³) — one rinse = one system volume */
  rinseWaterPerRinse: number;
  /** Total rinse water per clean (m³) */
  totalRinseWater: number;
  /** Total water per clean — dilution + rinse (m³) */
  totalWaterPerClean: number;

  // Recirculation
  /** Volume turnovers during cleaning */
  volumeTurnovers: number;
  /** Turnover status */
  turnoverStatus: 'low' | 'ok' | 'high';

  // Annual
  /** Neat acid per year (kg) */
  annualNeatAcidKg: number;
  /** Neat acid per year (L) */
  annualNeatAcidLitres: number;
  /** Total water per year (m³) */
  annualWaterM3: number;

  // Tank sizing
  /** CIP mixing tank — sized for dilute solution volume + 15% margin */
  cipTank: TankDimensions;
  /** Neat acid storage tank — if storageDays provided */
  storageTank?: TankDimensions;
  /** Storage tank bund volume 110% (m³) */
  bundVolume?: number;

  warnings: string[];
}

// ── Default Constants ─────────────────────────────────────────────────────────

/** Default specific volume for tube-type HX (L per m² of tube surface) */
export const DEFAULT_SPECIFIC_VOLUME_LPM2 = 3.0;

/** CIP tank margin factor (15% above system volume) */
export const CIP_TANK_MARGIN = 0.15;

/** Bund sizing factor (110% of tank volume) */
export const BUND_FACTOR = 1.1;

/** Minimum recommended volume turnovers for effective CIP */
export const MIN_TURNOVERS = 3;
/** Ideal volume turnovers */
export const IDEAL_MIN_TURNOVERS = 5;

// ── Dosing Calculation ────────────────────────────────────────────────────────

export function calculateDosing(input: DosingInput): DosingResult {
  const {
    feedFlowM3h,
    doseMgL,
    solutionDensityKgL,
    storageDays,
    neatConcentration,
    workingConcentration,
    dilutionTankDays,
    linePressureBarG,
    tankType = 'cylindrical',
    tankAspectRatio = 1.5,
  } = input;

  if (feedFlowM3h <= 0) throw new Error('Feed flow must be positive');
  if (doseMgL < 0) throw new Error('Dose must be non-negative');
  if (solutionDensityKgL <= 0) throw new Error('Solution density must be positive');

  const warnings: string[] = [];

  // ── Core dosing calc (same as before) ──────────────────────────────────
  // Active chemical mass flow (g/h) = feed [m³/h] × dose [mg/L]
  const activeChemicalGh = feedFlowM3h * doseMgL; // g/h

  // Chemical solution flow (L/h) = active mass (g/h) / density (kg/L) / 1000 (g/kg)
  const chemicalFlowLh = activeChemicalGh / (solutionDensityKgL * 1000);
  const chemicalFlowMlMin = (chemicalFlowLh / 60) * 1000;

  // Mass consumption (kg/day) — of neat product
  const chemicalMassFlowKgh = chemicalFlowLh * solutionDensityKgL;
  const dailyConsumptionKg = chemicalMassFlowKgh * 24;
  const monthlyConsumptionKg = dailyConsumptionKg * 30.4;
  const annualConsumptionKg = dailyConsumptionKg * 365;

  // ── Bulk storage tank ──────────────────────────────────────────────────
  let storageTankM3: number | undefined;
  let storageTank: TankDimensions | undefined;
  let bundVolume: number | undefined;

  if (storageDays !== undefined && storageDays > 0) {
    storageTankM3 = (dailyConsumptionKg * storageDays) / (solutionDensityKgL * 1000);
    storageTank = calculateTankDimensions(storageTankM3, tankType, tankAspectRatio);
    bundVolume = round3(storageTankM3 * BUND_FACTOR);
  }

  // ── Dilution ───────────────────────────────────────────────────────────
  let dilution: DilutionResult | undefined;

  if (
    neatConcentration !== undefined &&
    neatConcentration > 0 &&
    workingConcentration !== undefined &&
    workingConcentration > 0
  ) {
    if (workingConcentration >= neatConcentration) {
      warnings.push('Working concentration must be less than neat concentration for dilution.');
    } else {
      const dilutionRatio = neatConcentration / workingConcentration;
      // The flow of neat chemical needed to deliver the required active dose
      const neatChemicalFlowLh = chemicalFlowLh;
      // Total diluted solution flow
      const dilutedSolutionFlowLh = neatChemicalFlowLh * dilutionRatio;
      const dilutionWaterFlowLh = dilutedSolutionFlowLh - neatChemicalFlowLh;

      let dilutionTank: TankDimensions | undefined;
      let dilutionTankBund: number | undefined;
      if (dilutionTankDays !== undefined && dilutionTankDays > 0) {
        const dailyDilutedLitres = dilutedSolutionFlowLh * 24;
        const tankVolM3 = (dailyDilutedLitres * dilutionTankDays) / 1000;
        dilutionTank = calculateTankDimensions(tankVolM3, tankType, tankAspectRatio);
        dilutionTankBund = round3(tankVolM3 * BUND_FACTOR);
      }

      dilution = {
        neatConcentration,
        workingConcentration,
        dilutionRatio: round3(dilutionRatio),
        neatChemicalFlowLh: round4(neatChemicalFlowLh),
        dilutionWaterFlowLh: round4(dilutionWaterFlowLh),
        dilutedSolutionFlowLh: round4(dilutedSolutionFlowLh),
        dilutionTank,
        dilutionTankBund,
      };
    }
  }

  // ── Dosing pump pressure ───────────────────────────────────────────────
  let pumpPressure: PumpPressureResult | undefined;
  if (linePressureBarG !== undefined && linePressureBarG >= 0) {
    pumpPressure = calculatePumpPressure(linePressureBarG);
  }

  // ── Dosing line ────────────────────────────────────────────────────────
  // Use the actual flow that goes through the dosing line
  const actualDosingFlowLh = dilution ? dilution.dilutedSolutionFlowLh : chemicalFlowLh;
  const dosingLine = selectDosingLine(actualDosingFlowLh);

  if (dosingLine.velocityStatus === 'low') {
    warnings.push(
      `Dosing line velocity (${dosingLine.velocity} m/s) is below 0.3 m/s — risk of settling. Consider a smaller tubing size or pulsed dosing.`
    );
  }
  if (dosingLine.velocityStatus === 'high') {
    warnings.push(
      `Dosing line velocity (${dosingLine.velocity} m/s) exceeds 1.5 m/s — excessive pressure drop. Consider larger tubing.`
    );
  }

  return {
    chemicalFlowLh,
    chemicalFlowMlMin,
    doseConfirmMgL: doseMgL,
    activeChemicalGh,
    dailyConsumptionKg,
    monthlyConsumptionKg,
    annualConsumptionKg,
    storageTankM3,
    storageTank,
    bundVolume,
    dilution,
    pumpPressure,
    dosingLine,
    warnings,
  };
}

// ── CIP Calculation ──────────────────────────────────────────────────────────

export function calculateCIP(input: CIPInput): CIPResult {
  const {
    acidType,
    heatExchangerArea,
    specificVolume = DEFAULT_SPECIFIC_VOLUME_LPM2,
    pipingHoldup = 0,
    systemHoldupOverride,
    cleaningConcentration,
    recirculationFlowM3h,
    cleaningDurationHrs,
    numberOfRinses,
    cleaningsPerYear,
    storageDays,
    tankType = 'cylindrical',
    tankAspectRatio = 1.5,
  } = input;

  const acid = ACID_PRODUCTS[acidType];
  const warnings: string[] = [];

  // Validation
  if (heatExchangerArea <= 0 && systemHoldupOverride === undefined) {
    throw new Error('Heat exchanger area must be positive');
  }
  if (cleaningConcentration <= 0) throw new Error('Cleaning concentration must be positive');
  if (cleaningConcentration > acid.neatConcentration) {
    throw new Error(
      `Cleaning concentration (${cleaningConcentration}%) exceeds neat acid concentration (${acid.neatConcentration}%)`
    );
  }
  if (recirculationFlowM3h <= 0) throw new Error('Recirculation flow must be positive');
  if (cleaningDurationHrs <= 0) throw new Error('Cleaning duration must be positive');

  // ── System volume ──────────────────────────────────────────────────────
  let hxVolume: number;
  const pipingVolume = pipingHoldup;

  if (systemHoldupOverride !== undefined && systemHoldupOverride > 0) {
    // User override — split is unknown, assign all to HX for reporting
    hxVolume = systemHoldupOverride - pipingVolume;
    if (hxVolume < 0) hxVolume = 0;
  } else {
    // Estimate from surface area: L = area × specific volume
    hxVolume = (heatExchangerArea * specificVolume) / 1000; // m³
  }

  const systemVolume = hxVolume + pipingVolume;
  const systemVolumeLitres = systemVolume * 1000;

  // ── Per-clean acid quantities ──────────────────────────────────────────
  // Dilute solution volume = system volume (fill the system once)
  const diluteSolutionVolume = systemVolume;

  // Neat acid volume: V_neat = V_system × (C_target / C_neat) × (ρ_dilute / ρ_neat)
  // For dilute solutions, ρ_dilute ≈ ρ_water ≈ 1.0 kg/L (simplification, safe for 2-5%)
  const neatAcidLitres = (systemVolumeLitres * cleaningConcentration) / acid.neatConcentration;
  // neatAcidLitres is in L, neatDensity is kg/L → mass in kg
  const neatAcidMassKg = neatAcidLitres * acid.neatDensity;

  // Dilution water
  const dilutionWaterVolume = systemVolume - neatAcidLitres / 1000; // m³

  // ── Rinse ──────────────────────────────────────────────────────────────
  const rinseWaterPerRinse = systemVolume; // one system fill per rinse
  const totalRinseWater = rinseWaterPerRinse * numberOfRinses;
  const totalWaterPerClean = Math.max(0, dilutionWaterVolume) + totalRinseWater;

  // ── Recirculation turnovers ────────────────────────────────────────────
  const totalCirculatedVolume = recirculationFlowM3h * cleaningDurationHrs;
  const volumeTurnovers = systemVolume > 0 ? totalCirculatedVolume / systemVolume : 0;

  let turnoverStatus: CIPResult['turnoverStatus'] = 'ok';
  if (volumeTurnovers < MIN_TURNOVERS) {
    turnoverStatus = 'low';
    warnings.push(
      `Volume turnovers (${volumeTurnovers.toFixed(1)}) are below minimum ${MIN_TURNOVERS}. ` +
        'Increase recirculation flow or cleaning duration for effective cleaning.'
    );
  } else if (volumeTurnovers > 50) {
    turnoverStatus = 'high';
    warnings.push(
      `Volume turnovers (${volumeTurnovers.toFixed(0)}) are very high. ` +
        'Consider reducing cleaning duration or recirculation flow to avoid unnecessary pump wear.'
    );
  }

  if (cleaningConcentration < acid.typicalCleaningMin) {
    warnings.push(
      `Cleaning concentration (${cleaningConcentration}%) is below typical range (${acid.typicalCleaningMin}–${acid.typicalCleaningMax}%).`
    );
  }
  if (cleaningConcentration > acid.typicalCleaningMax) {
    warnings.push(
      `Cleaning concentration (${cleaningConcentration}%) exceeds typical range (${acid.typicalCleaningMin}–${acid.typicalCleaningMax}%). ` +
        'Verify material compatibility.'
    );
  }

  // ── Annual consumption ─────────────────────────────────────────────────
  const annualNeatAcidKg = neatAcidMassKg * cleaningsPerYear;
  const annualNeatAcidLitres = neatAcidLitres * cleaningsPerYear;
  const annualWaterM3 = totalWaterPerClean * cleaningsPerYear;

  // ── Tank sizing ────────────────────────────────────────────────────────
  // CIP mixing tank: system volume + margin
  const cipTankVolume = diluteSolutionVolume * (1 + CIP_TANK_MARGIN);
  const cipTank = calculateTankDimensions(cipTankVolume, tankType, tankAspectRatio);

  // Neat acid storage tank
  let storageTank: TankDimensions | undefined;
  let bundVolume: number | undefined;
  if (storageDays !== undefined && storageDays > 0 && cleaningsPerYear > 0) {
    // Storage = enough neat acid for storageDays worth of cleans
    // (cleans per day × storageDays × litres per clean)
    const cleansPerDay = cleaningsPerYear / 365;
    const storageLitres = cleansPerDay * storageDays * neatAcidLitres;
    const storageM3 = storageLitres / 1000;
    if (storageM3 > 0) {
      storageTank = calculateTankDimensions(storageM3, tankType, tankAspectRatio);
      bundVolume = round3(storageM3 * BUND_FACTOR);
    }
  }

  return {
    systemVolume: round3(systemVolume),
    systemVolumeLitres: round1(systemVolumeLitres),
    hxVolume: round3(hxVolume),
    pipingVolume: round3(pipingVolume),

    diluteSolutionVolume: round3(diluteSolutionVolume),
    neatAcidLitres: round2(neatAcidLitres),
    neatAcidMassKg: round2(neatAcidMassKg),
    dilutionWaterVolume: round3(Math.max(0, dilutionWaterVolume)),

    rinseWaterPerRinse: round3(rinseWaterPerRinse),
    totalRinseWater: round3(totalRinseWater),
    totalWaterPerClean: round3(totalWaterPerClean),

    volumeTurnovers: round1(volumeTurnovers),
    turnoverStatus,

    annualNeatAcidKg: round1(annualNeatAcidKg),
    annualNeatAcidLitres: round1(annualNeatAcidLitres),
    annualWaterM3: round1(annualWaterM3),

    cipTank,
    storageTank,
    bundVolume,

    warnings,
  };
}

// ── Utility ──────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
