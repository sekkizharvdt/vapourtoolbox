/**
 * MED Plant Designer — Integrated Multi-Effect Distillation Calculator
 *
 * Designs a complete MED plant from minimal inputs:
 *   Required: vapour flow, vapour temperature, seawater temperature, target GOR
 *   Everything else: auto-calculated with sensible defaults, user-overridable
 *
 * Uses validated correlations from Sharqawy (2010), El-Dessouky & Ettouney (2002),
 * calibrated against Campiche, CADAFE, BARC, and Case 6 as-built data.
 */

import {
  getBoilingPointElevation,
  getLatentHeat,
  getSeawaterDensity,
  getSeawaterSpecificHeat,
  MED_TUBE_GEOMETRY,
  getDensityVapor,
  getDensityLiquid,
} from '@vapour/constants';

import { calculateDemisterSizing } from './demisterCalculator';
import { calculateNozzleLayout } from './sprayNozzleCalculator';
import { selectPipeByVelocity } from './pipeService';
import { calculateSiphonSizing } from './siphonSizingCalculator';
import { calculateTDH } from './pumpSizing';
import { calculateDosing } from './chemicalDosingCalculator';
import { calculateVacuumSystem } from './vacuumSystemCalculator';

// ============================================================================
// Types
// ============================================================================

/** Minimum required inputs — everything else has defaults */
export interface MEDDesignerInput {
  // ── Required (no defaults) ───────────────────────────────────────────
  /** Heating steam/vapour flow rate in T/h */
  steamFlow: number;
  /** Heating steam/vapour temperature in °C (saturated) */
  steamTemperature: number;
  /** Seawater inlet temperature in °C */
  seawaterTemperature: number;
  /** Target GOR (gain output ratio) */
  targetGOR: number;

  // ── Auto-calculated with override ────────────────────────────────────
  /** Number of effects (auto-optimised if not provided) */
  numberOfEffects?: number;
  /** Seawater salinity in ppm (default 35,000) */
  seawaterSalinity?: number;
  /** Maximum brine salinity in ppm (default 65,000) */
  maxBrineSalinity?: number;
  /** Condenser approach temperature in °C (default 4) */
  condenserApproach?: number;
  /** Condenser SW outlet temperature in °C (default seawater + 5) */
  condenserSWOutlet?: number;
  /** Shell inner diameter in mm (auto-sized if not set; warns if < 1,800 for man-entry) */
  shellID?: number;
  /** Tube OD in mm (default 25.4) */
  tubeOD?: number;
  /** Tube wall thickness in mm (default 1.0 for Al, 0.4 for Ti) */
  tubeWallThickness?: number;
  /** Tube material thermal conductivity in W/(m·K) (default 138 for Al 5052) */
  tubeConductivity?: number;
  /** Tube material name (default 'Al 5052') */
  tubeMaterialName?: string;
  /** Triangular pitch in mm (default 33.4) */
  tubePitch?: number;
  /** Available tube lengths in m (default [0.8, 1.0, 1.2, 1.5]) */
  availableTubeLengths?: number[];
  /** Design margin fraction (default 0.15) */
  designMargin?: number;
  /** Non-equilibrium allowance per effect in °C (default 0.25) */
  NEA?: number;
  /** Demister pressure drop temperature loss per effect in °C (default 0.15) */
  demisterLoss?: number;
  /** Vapour duct pressure drop temperature loss per effect in °C (default 0.30) */
  pressureDropLoss?: number;
  /** Fouling resistance in m²·K/W (default 0.00015) */
  foulingResistance?: number;
  /** Number of preheaters (auto if not set) */
  numberOfPreheaters?: number;
  /** Include brine recirculation calculation (default true) */
  includeBrineRecirculation?: boolean;
  /** Minimum wetting rate Γ in kg/(m·s) (default 0.035) */
  minimumWettingRate?: number;
  /** Shell thickness in mm (default 8) */
  shellThickness?: number;
  /** Tube sheet thickness in mm (default 8) */
  tubeSheetThickness?: number;
  /** Tube sheet access clearance inside shell in mm (default 750 — for tube removal/insertion) */
  tubeSheetAccess?: number;
  /** Override condenser U-value W/(m²·K) — default derived from tube material */
  condenserU?: number;
  /** Override preheater U-value W/(m²·K) — default derived from tube material */
  preheaterU?: number;
  /** Anti-scalant dose in mg/L (default 2) */
  antiscalantDoseMgL?: number;
  /** Vacuum system train configuration (default 'hybrid') */
  vacuumTrainConfig?: 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid';
  /** Include turndown analysis at 30/50/70/100% load (default false — computationally expensive) */
  includeTurndown?: boolean;

  // ── Per-effect overrides (user refinement after initial auto-design) ──
  /** Override tube length per effect (array indexed by effect 0..n-1) */
  tubeLengthOverrides?: (number | null)[];
  /** Override tube count per effect (array indexed by effect 0..n-1) */
  tubeCountOverrides?: (number | null)[];
  /** Override shell ID per effect in mm (array indexed by effect 0..n-1) */
  shellIDOverrides?: (number | null)[];
}

/** Per-effect result */
export interface MEDEffectResult {
  effect: number;
  /** Incoming vapour temperature °C */
  incomingVapourTemp: number;
  /** Brine temperature °C */
  brineTemp: number;
  /** BPE at brine conditions °C */
  bpe: number;
  /** NEA °C */
  nea: number;
  /** Demister loss °C */
  demisterLoss: number;
  /** Vapour duct pressure drop loss °C */
  pressureDropLoss: number;
  /** Outgoing vapour saturation temperature °C */
  vapourOutTemp: number;
  /** Working temperature difference °C */
  workingDeltaT: number;
  /** Pressure in mbar abs */
  pressure: number;
  /** Overall HTC W/(m²·K) */
  overallU: number;
  /** Heat duty kW */
  duty: number;
  /** Required area m² */
  requiredArea: number;
  /** Design area (with margin) m² */
  designArea: number;
  /** Number of tubes */
  tubes: number;
  /** Selected tube length m */
  tubeLength: number;
  /** Installed area m² */
  installedArea: number;
  /** Area margin % */
  areaMargin: number;
  /** Distillate produced in this effect T/h */
  distillateFlow: number;
  /** Accumulated distillate flowing out via siphon T/h (sum of this + all previous) */
  accumDistillateFlow: number;
  /** Brine produced in this effect T/h (spray in - vapour out) */
  brineOutFlow: number;
  /** Accumulated brine flowing out via siphon T/h (sum of this + all previous) */
  accumBrineFlow: number;
  /** Flash vapour from distillate cascade T/h */
  flashVapourFlow: number;
  /** Latent heat of vaporisation kJ/kg */
  hfg: number;
  /** Has vapour lanes */
  hasVapourLanes: boolean;
  /** Minimum spray flow T/h */
  minSprayFlow: number;
  /** Required brine recirculation T/h */
  brineRecirculation: number;
  /** Shell length mm (tube + 2×tubesheet + 2×750mm access) */
  shellLengthMM: number;
  /** Shell OD mm (ID + 2×thickness) */
  shellODmm: number;
}

/** Final condenser result */
export interface MEDCondenserResult {
  vapourFlow: number; // T/h
  vapourTemp: number; // °C
  duty: number; // kW
  lmtd: number; // °C
  overallU: number; // W/(m²·K)
  designArea: number; // m²
  seawaterFlow: number; // T/h
  seawaterFlowM3h: number; // m³/h
}

/** Preheater result */
export interface MEDPreheaterResult {
  id: number;
  vapourSource: string; // e.g. "Effect 2"
  vapourTemp: number; // °C
  swInlet: number; // °C
  swOutlet: number; // °C
  duty: number; // kW
  lmtd: number; // °C
  designArea: number; // m²
}

/** Per-effect demister sizing result */
export interface MEDDemisterResult {
  effect: number;
  requiredArea: number; // m²
  designVelocity: number; // m/s
  loadingStatus: string;
  pressureDrop: number; // Pa
}

/** Per-effect spray nozzle result */
export interface MEDSprayNozzleResult {
  effect: number;
  nozzleModel: string;
  nozzleCount: number;
  flowPerNozzle: number; // lpm
  sprayAngle: number; // degrees
  sprayHeight: number; // mm — vertical distance from nozzle to tube bundle top
  nozzlesAlongLength: number;
  rowsAcrossWidth: number;
}

/** Siphon between effects */
export interface MEDSiphonResult {
  fromEffect: number;
  toEffect: number;
  fluidType: string; // 'distillate' | 'brine'
  flowRate: number; // T/h
  pipeSize: string; // e.g. "DN25"
  minimumHeight: number; // m
  velocity: number; // m/s
}

/** Line sizing result for a header */
export interface MEDLineSizing {
  service: string; // e.g. 'Steam Header', 'Distillate Header'
  flowRate: number; // T/h
  pipeSize: string; // e.g. "4\" Sch 40"
  dn: string; // e.g. "DN100"
  velocity: number; // m/s
  velocityStatus: string;
}

/** Pump sizing result */
export interface MEDPumpResult {
  service: string;
  flowRate: number; // T/h (or m³/h)
  flowRateM3h: number;
  totalHead: number; // m
  hydraulicPower: number; // kW
  motorPower: number; // kW (standard size)
  quantity: string; // e.g. "1+1" or "6"
}

/** Shell nozzle for a single service on one effect */
export interface MEDShellNozzle {
  effect: number;
  service:
    | 'vapour_inlet'
    | 'vapour_outlet'
    | 'brine_inlet'
    | 'brine_outlet'
    | 'distillate_outlet'
    | 'vent';
  flowRate: number; // T/h
  pipeSize: string; // e.g. "DN200"
  dn: string;
  velocity: number; // m/s
  velocityStatus: string;
}

/** Nozzle schedule for all effects */
export interface MEDNozzleSchedule {
  nozzles: MEDShellNozzle[];
  warnings: string[];
}

/** Anti-scalant dosing result */
export interface MEDDosingResult {
  feedFlowM3h: number;
  doseMgL: number;
  chemicalFlowLh: number;
  dailyConsumptionKg: number;
  monthlyConsumptionKg: number;
  storageTankM3: number;
  dosingLineOD: string;
}

/** Vacuum system result (wraps VacuumSystemResult) */
export interface MEDVacuumResult {
  lastEffectPressureMbar: number;
  systemVolumeM3: number;
  totalDryNcgKgH: number;
  totalMotiveSteamKgH: number;
  totalPowerKW: number;
  trainConfig: string;
  evacuationTimeMinutes: number;
}

/** Cost estimation line item */
export interface MEDCostItem {
  item: string;
  material: string;
  weightKg: number;
  ratePerKg: number;
  cost: number;
}

/** Cost estimate summary */
export interface MEDCostEstimate {
  equipmentItems: MEDCostItem[];
  totalEquipmentCost: number;
  pipingCost: number;
  instrumentationCost: number;
  electricalCost: number;
  civilCost: number;
  installationCost: number;
  subtotal: number;
  contingency: number;
  totalInstalledCost: number;
  accuracy: string;
  costPerM3Day: number;
}

/** Turndown point */
export interface MEDTurndownPoint {
  loadPercent: number;
  steamFlow: number;
  distillateFlow: number;
  distillateM3Day: number;
  gor: number;
  wettingAdequacy: { effect: number; gamma: number; gammaMin: number; adequate: boolean }[];
  siphonsSealOk: boolean;
  condenserMarginPct: number;
  feasible: boolean;
  warnings: string[];
}

/** Turndown analysis */
export interface MEDTurndownAnalysis {
  points: MEDTurndownPoint[];
  minimumLoadPercent: number;
  warnings: string[];
}

/** All auxiliary equipment results */
export interface MEDAuxiliaryEquipment {
  demisters: MEDDemisterResult[];
  sprayNozzles: MEDSprayNozzleResult[];
  siphons: MEDSiphonResult[];
  lineSizing: MEDLineSizing[];
  pumps: MEDPumpResult[];
  nozzleSchedule?: MEDNozzleSchedule;
  /** Collected warnings/errors from auxiliary equipment sizing */
  auxWarnings: string[];
}

/** Weight breakdown for a single shell */
export interface ShellWeight {
  shell: number; // kg — cylindrical shell
  dishedHeads: number; // kg — 2 × 2:1 SE heads
  tubeSheets: number; // kg — 2 tube sheets
  tubes: number; // kg — all tubes in this shell
  waterBoxes: number; // kg — estimated
  internals: number; // kg — demisters, spray pipes, baffles
  total: number; // kg
}

/** Weight summary for the entire plant */
export interface MEDWeightEstimate {
  evaporatorShells: ShellWeight[];
  condenserWeight: number; // kg
  preheatersWeight: number; // kg
  totalDryWeight: number; // kg
  totalOperatingWeight: number; // kg (dry + water hold-up)
}

/** A single design option for comparison */
export interface MEDDesignOption {
  effects: number;
  gor: number;
  distillateM3Day: number;
  totalEvaporatorArea: number; // m²
  totalShells: number;
  condenserArea: number; // m²
  totalPreheaterArea: number; // m²
  totalBrineRecirculation: number; // T/h
  specificEnergy: number; // kWh_thermal / m³ distillate
  /** Largest shell ID across all effects (mm) — auto-calculated */
  largestShellID: number;
  /** Overall train length (mm) — sum of all shell lengths + gaps */
  trainLengthMM: number;
  weight: MEDWeightEstimate;
  feasible: boolean;
  label: string; // e.g. "Option A — High GOR"
  /** Full detailed result (only for the recommended/selected option) */
  detail?: MEDDesignerResult;
}

/** Scenario comparison row */
export interface MEDScenarioRow {
  effects: number;
  totalWorkingDT: number;
  workingDTPerEffect: number;
  requiredAreaPerEffect: number;
  availableArea: number;
  areaMargin: number;
  achievableGOR: number;
  distillate: number;
  feasible: boolean;
}

/** Complete MED design result */
export interface MEDDesignerResult {
  // ── Input echo ───────────────────────────────────────────────────────
  inputs: MEDDesignerInput & {
    resolvedDefaults: Record<string, number | string | boolean>;
  };

  // ── Scenario comparison ──────────────────────────────────────────────
  scenarios: MEDScenarioRow[];
  recommendedEffects: number;

  // ── Design ───────────────────────────────────────────────────────────
  effects: MEDEffectResult[];
  condenser: MEDCondenserResult;
  preheaters: MEDPreheaterResult[];

  // ── Summary ──────────────────────────────────────────────────────────
  totalDistillate: number; // T/h
  totalDistillateM3Day: number;
  achievedGOR: number;
  totalEvaporatorArea: number; // m²
  totalBrineRecirculation: number; // T/h
  makeUpFeed: number; // T/h
  brineBlowdown: number; // T/h
  /** Blended spray TDS (ppm) — mix of make-up seawater + recycled brine */
  spraySalinity: number;
  numberOfShells: number;

  /** Auxiliary equipment sizing */
  auxiliaryEquipment: MEDAuxiliaryEquipment;

  /** Anti-scalant dosing results */
  dosing?: MEDDosingResult;
  /** Vacuum system sizing results */
  vacuumSystem?: MEDVacuumResult;
  /** Cost estimation */
  costEstimate?: MEDCostEstimate;
  /** Turndown analysis (opt-in) */
  turndownAnalysis?: MEDTurndownAnalysis;

  /** Overall evaporator train dimensions (all shells in line) */
  overallDimensions: {
    /** Total train length mm (sum of all shell lengths + gaps between shells) */
    totalLengthMM: number;
    /** Shell OD mm */
    shellODmm: number;
    /** Per-effect shell length range mm */
    shellLengthRange: { min: number; max: number };
  };

  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

const VENT_LOSS_FRACTION = 0.015; // 1.5% vapour loss per effect (vent/NCG)

/** Default condenser U-value by tube material name */
function getDefaultCondenserU(materialName: string): number {
  const m = (materialName ?? '').toLowerCase();
  if (m.includes('ti')) return 2200;
  if (m.includes('al')) return 1800;
  if (m.includes('cu') || m.includes('brass')) return 2400;
  return 2000; // SS316L / default
}

/** Default preheater U-value by tube material name */
function getDefaultPreheaterU(materialName: string): number {
  const m = (materialName ?? '').toLowerCase();
  if (m.includes('ti')) return 2100;
  if (m.includes('al')) return 1700;
  if (m.includes('cu') || m.includes('brass')) return 2300;
  return 1900;
}

/** Material cost rates in USD/kg for budgetary estimation */
/** Material cost rates in USD/kg — used by computeCostEstimate() */
/** Material cost rates in USD/kg — used by computeCostEstimate() */
export const MATERIAL_COST_RATES: { [key: string]: number } = {
  duplex_ss: 8,
  al_5052: 6,
  ti_gr2: 30,
  ss_316l: 5,
  carbon_steel: 3,
};

/** Approximate saturation pressure from temperature (Antoine-like) */
function satPressureMbar(tempC: number): number {
  // Simplified: P_sat(mbar) from T(°C) using Buck equation
  const P_kPa = 0.61121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  return P_kPa * 10; // kPa to mbar
}

/** Estimate overall HTC for falling film evaporator (W/m²·K)
 *
 * Calibrated against as-built projects:
 *   BARC Ti 0.4mm:  U ≈ 3,000 W/m²·K @ 58°C (validated within 0.1%)
 *   Case 6 Al 1mm:  U ≈ 2,800–3,550 W/m²·K
 *   Campiche:       U ≈ 2,082 W/m²·K (condenser, not evaporator)
 */
function estimateU(tempC: number, _od: number, wallThk: number, kWall: number): number {
  // Resistance-based U-value estimation
  // Validated against BARC (3,003 W/m²·K), Campiche, CADAFE as-built data
  // and single tube calculator (Nusselt condensation + Chun-Seban evaporation)

  // Wall resistance (negligible for Al k=138, significant for Ti k=22)
  const Rwall = wallThk / 1000 / kWall;

  // Condensation inside tube: Nusselt horizontal in-tube, 8,000-15,000 W/m²·K
  const hCond = 10000 + 100 * (tempC - 40);
  const Rcond = 1 / hCond;

  // Evaporation outside tube: Chun-Seban falling film on horizontal tube
  // BARC validation: overall U = 3,003 at Ti 0.4mm → hEvap ≈ 18,000 W/m²·K
  // At MED conditions (thin film, low Re), Chun-Seban gives very high HTCs
  const hEvap = 15000 + 100 * (tempC - 40); // ~13,000 at 40°C, ~17,000 at 60°C
  const Revap = 1 / hEvap;

  // Fouling resistance
  const Rfouling = 0.00015; // m²·K/W (TEMA standard for seawater)

  const Rtotal = Rcond + Revap + Rfouling + Rwall;
  const U = 1 / Rtotal;

  // Clamp to validated range: 2,400–3,500 W/m²·K
  return Math.max(2400, Math.min(3500, U));
}

/** Count tubes in lateral half-circle bundle */
/**
 * Find the minimum shell ID that fits at least `requiredTubes` in a lateral bundle.
 * Searches from 800mm upward in 50mm increments, then refines to 10mm.
 */
function findMinShellID(
  requiredTubes: number,
  tubeOD: number,
  pitch: number,
  withVapourLanes: boolean
): number {
  // Coarse search
  let shellID = 800;
  while (shellID <= 6000) {
    const count = countLateralTubes(shellID, tubeOD, pitch, withVapourLanes);
    if (count >= requiredTubes) break;
    shellID += 50;
  }
  // Refine downward
  shellID -= 50;
  while (shellID <= 6000) {
    const count = countLateralTubes(shellID, tubeOD, pitch, withVapourLanes);
    if (count >= requiredTubes) return shellID;
    shellID += 10;
  }
  return shellID;
}

function countLateralTubes(
  shellID: number,
  _tubeOD: number,
  pitch: number,
  withVapourLanes: boolean
): number {
  const tubeHoleDia = MED_TUBE_GEOMETRY.tubeHoleDiameter;
  const edgeClearance = MED_TUBE_GEOMETRY.edgeClearance;
  const tubeHoleR = tubeHoleDia / 2;
  const rowSpacing = pitch * Math.sin((60 * Math.PI) / 180);
  const maxR = shellID / 2 - edgeClearance - tubeHoleR;

  let total = 0;
  let rowIndex = 0;

  for (let y = maxR; y >= -maxR; y -= rowSpacing) {
    const isStaggered = rowIndex % 2 === 1;
    const xOffset = isStaggered ? pitch / 2 : 0;
    const chord = maxR * maxR - y * y;
    if (chord < 0) {
      rowIndex++;
      continue;
    }
    const halfChord = Math.sqrt(chord);
    const xMin = -halfChord;
    const xMax = tubeHoleR;
    const startX = Math.ceil((xMin - xOffset) / pitch) * pitch + xOffset;

    for (let x = startX; x <= xMax; x += pitch) {
      if (x * x + y * y <= maxR * maxR) total++;
    }
    rowIndex++;
  }

  // Apply vapour lane reduction
  return withVapourLanes ? Math.round(total * 0.85) : total;
}

/** Get max tubes per row for wetting calculation */
function getMaxTubesPerRow(shellID: number, pitch: number): number {
  const tubeHoleDia = MED_TUBE_GEOMETRY.tubeHoleDiameter;
  const edgeClearance = MED_TUBE_GEOMETRY.edgeClearance;
  const maxR = shellID / 2 - edgeClearance - tubeHoleDia / 2;
  return Math.floor(maxR / pitch) + 1;
}

// ============================================================================
// Main Designer
// ============================================================================

export function designMED(input: MEDDesignerInput): MEDDesignerResult {
  const warnings: string[] = [];

  // ── Resolve defaults ─────────────────────────────────────────────────
  const swSalinity = input.seawaterSalinity ?? 35000;
  const maxBrineSalinity = input.maxBrineSalinity ?? 65000;
  const condenserApproach = input.condenserApproach ?? 4;
  const condenserSWOutlet = input.condenserSWOutlet ?? input.seawaterTemperature + 5;
  const shellID = input.shellID ?? 1800;
  const tubeOD = input.tubeOD ?? 25.4;
  const tubeWall = input.tubeWallThickness ?? 1.0;
  const kWall = input.tubeConductivity ?? 138;
  const tubeMaterialName = input.tubeMaterialName ?? 'Al 5052';
  const pitch = input.tubePitch ?? 33.4;
  const availableLengths = input.availableTubeLengths ?? [0.8, 1.0, 1.2, 1.5];
  const designMargin = input.designMargin ?? 0.15;
  const NEA = input.NEA ?? 0.25;
  const demLoss = input.demisterLoss ?? 0.15;
  const pdLoss = input.pressureDropLoss ?? 0.3;
  const minGamma = input.minimumWettingRate ?? 0.035;
  const includeRecirc = input.includeBrineRecirculation ?? true;
  const shellThkMM = input.shellThickness ?? 8;
  const tubeSheetThkMM = input.tubeSheetThickness ?? 8;
  const tubeSheetAccessMM = input.tubeSheetAccess ?? 750;

  const resolvedDefaults: Record<string, number | string | boolean> = {
    seawaterSalinity: swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserSWOutlet,
    shellID: shellID, // user input (may be overridden by auto-calc)
    tubeOD,
    tubeWallThickness: tubeWall,
    tubeConductivity: kWall,
    tubeMaterialName,
    tubePitch: pitch,
    designMargin,
    NEA,
    demisterLoss: demLoss,
    pressureDropLoss: pdLoss,
  };

  // ── Derived values ───────────────────────────────────────────────────
  const steamApproach = 2.0; // °C approach from steam to TBT
  const TBT = input.steamTemperature - steamApproach;
  const lastEffectVapourT = condenserSWOutlet + condenserApproach;
  const totalAvailDT = TBT - lastEffectVapourT;
  const areaPerTubePerM = Math.PI * (tubeOD / 1000);

  const maxTubeLength = Math.max(...availableLengths);

  if (totalAvailDT <= 0) {
    throw new Error(
      `No temperature driving force: TBT (${TBT.toFixed(1)}°C) must be > last effect vapour (${lastEffectVapourT.toFixed(1)}°C)`
    );
  }

  // Shell ID will be auto-calculated from the largest effect's tube requirement.
  // The user-provided shellID is treated as an override — if not provided, we compute it.

  // ── Average brine salinity for BPE estimation ────────────────────────
  // In parallel feed: spray = mix of make-up + recycled brine
  const avgBrineS = (swSalinity + maxBrineSalinity) / 2;
  const avgTemp = (TBT + lastEffectVapourT) / 2;
  const avgBPE = getBoilingPointElevation(avgBrineS, avgTemp);
  const avgLossPerEffect = avgBPE + NEA + demLoss + pdLoss;

  // ── Scenario comparison ──────────────────────────────────────────────
  const scenarios: MEDScenarioRow[] = [];
  const Q1 = (input.steamFlow * 1000 * getLatentHeat(input.steamTemperature)) / 3600; // kW

  for (let n = 3; n <= 12; n++) {
    const totalWorkDT = totalAvailDT - n * avgLossPerEffect;
    if (totalWorkDT <= 0) {
      scenarios.push({
        effects: n,
        totalWorkingDT: totalWorkDT,
        workingDTPerEffect: 0,
        requiredAreaPerEffect: Infinity,
        availableArea: 0,
        areaMargin: -100,
        achievableGOR: 0,
        distillate: 0,
        feasible: false,
      });
      continue;
    }

    const workDTPerEff = totalWorkDT / n;
    const avgU = estimateU(avgTemp, tubeOD, tubeWall, kWall);
    const reqAreaPerEff = ((Q1 * 1000) / (avgU * workDTPerEff)) * (1 + designMargin);

    // Calculate tubes needed for the largest effect (uses max tube length)
    const tubesNeeded = Math.ceil(reqAreaPerEff / (areaPerTubePerM * maxTubeLength));

    // Calculate shell ID that fits those tubes
    const requiredShellID = findMinShellID(tubesNeeded, tubeOD, pitch, false);
    const availableArea =
      countLateralTubes(requiredShellID, tubeOD, pitch, false) * areaPerTubePerM * maxTubeLength;

    // GOR: all effects are adequately sized when shell fits the tubes
    const gorRaw = n * (1 - VENT_LOSS_FRACTION * n);
    const achievableGOR = Math.max(0, gorRaw);
    const distillate = input.steamFlow * achievableGOR;

    scenarios.push({
      effects: n,
      totalWorkingDT: totalWorkDT,
      workingDTPerEffect: workDTPerEff,
      requiredAreaPerEffect: reqAreaPerEff,
      availableArea,
      areaMargin: availableArea > 0 ? (availableArea / reqAreaPerEff - 1) * 100 : -100,
      achievableGOR,
      distillate,
      feasible: totalWorkDT > 0,
    });
  }

  // ── Select optimal number of effects ─────────────────────────────────
  let recommendedEffects: number;
  if (input.numberOfEffects) {
    recommendedEffects = input.numberOfEffects;
  } else {
    // Pick the feasible scenario with highest GOR
    const feasible = scenarios.filter((s) => s.feasible);
    if (feasible.length === 0) {
      // Fallback: pick the one with best GOR even if not fully feasible
      const best = scenarios.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      recommendedEffects = best.effects;
      warnings.push(
        `No scenario achieves ≥70% area coverage. Using ${recommendedEffects} effects (best available GOR ${best.achievableGOR.toFixed(1)}).`
      );
    } else {
      const best = feasible.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      recommendedEffects = best.effects;
    }
  }

  const nEff = recommendedEffects;

  // ── Build effect-by-effect temperature profile ───────────────────────
  // Distribute brine temperatures evenly from TBT to last-effect brine temp
  // Last effect brine temp ≈ lastEffectVapourT + BPE + NEA + pdLoss
  const lastBPE = getBoilingPointElevation(maxBrineSalinity, lastEffectVapourT + 2);
  const lastEffectBrineT = lastEffectVapourT + lastBPE + NEA + demLoss + pdLoss;

  const effects: MEDEffectResult[] = [];

  // Compute all brine temperatures first, then derive vapour temps
  const brineTemps: number[] = [];
  for (let i = 0; i < nEff; i++) {
    brineTemps.push(TBT - (i / Math.max(nEff - 1, 1)) * (TBT - lastEffectBrineT));
  }

  // Now build effects with proper incoming vapour tracking
  let prevVapourT = input.steamTemperature;

  for (let i = 0; i < nEff; i++) {
    const brineT = brineTemps[i]!;

    // BPE at brine conditions (use max brine salinity — brine leaving the effect)
    const bpe = getBoilingPointElevation(maxBrineSalinity, brineT);

    // Vapour out temperature
    const vapourOutT = brineT - bpe - NEA - demLoss - pdLoss;

    // Working ΔT
    const workDT = prevVapourT - brineT;

    // Pressure
    const pressure = satPressureMbar(vapourOutT);

    // HTC
    const U = estimateU(brineT, tubeOD, tubeWall, kWall);

    // Latent heat at vapour out conditions
    const hfg = getLatentHeat(vapourOutT);
    const hfgIn = getLatentHeat(prevVapourT);

    // Duty calculation with distillate flashing contribution
    // Base duty: vapour from previous effect condenses inside tubes
    let duty: number;
    if (i === 0) {
      // E1: steam condenses, no flash contribution
      duty = Q1 * (1 - VENT_LOSS_FRACTION);
    } else {
      // E2+: vapour from previous effect condenses + distillate flash contributes
      // Accumulated distillate from all previous effects enters this effect via siphon
      // It flashes because pressure is lower (temperature drops by ~workDT + BPE + losses)
      const prevDistAccum = effects.reduce((s, e) => s + e.distillateFlow, 0);
      const prevBrineT = effects[i - 1]!.brineTemp;
      const flashDT = prevBrineT - brineT; // temperature drop across siphon
      const Cp = 4.18; // kJ/(kg·K) for distillate (pure water)
      const flashVapour = prevDistAccum > 0 ? (prevDistAccum * Cp * flashDT) / hfg : 0; // T/h
      const flashDuty = (flashVapour * hfg) / 3.6; // kW

      // Vapour from previous effect (condensation duty)
      const prevVapourFlow = effects[i - 1]!.distillateFlow; // T/h
      const condensDuty = ((prevVapourFlow * hfgIn) / 3.6) * (1 - VENT_LOSS_FRACTION); // kW

      duty = condensDuty + flashDuty;
    }

    // Required area
    const reqArea = workDT > 0 ? (duty * 1000) / (U * workDT) : Infinity;
    const desArea = reqArea * (1 + designMargin);

    // E1 gets vapour lanes, later effects do not
    const hasLanes = i === 0;

    // Check for user overrides
    const tubeLengthOverride = input.tubeLengthOverrides?.[i] ?? null;
    const tubeCountOverride = input.tubeCountOverrides?.[i] ?? null;
    const shellIDOverride = input.shellIDOverrides?.[i] ?? null;

    let bestTubes = 0;
    let selectedLength = maxTubeLength;
    let effShellID: number;

    if (tubeLengthOverride !== null && tubeCountOverride !== null) {
      // User specified both — use directly
      selectedLength = tubeLengthOverride;
      bestTubes = tubeCountOverride;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    } else if (tubeLengthOverride !== null) {
      // User specified tube length — auto-calculate tube count for design area
      selectedLength = tubeLengthOverride;
      bestTubes = Math.ceil(desArea / (areaPerTubePerM * selectedLength));
      if (bestTubes <= 0 || !isFinite(bestTubes)) bestTubes = 100;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    } else if (tubeCountOverride !== null) {
      // User specified tube count — auto-select shortest tube length that fits
      bestTubes = tubeCountOverride;
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
      const minLengthNeeded = desArea / (bestTubes * areaPerTubePerM);
      selectedLength =
        availableLengths.sort((a, b) => a - b).find((L) => L >= minLengthNeeded - 0.01) ??
        maxTubeLength;
    } else {
      // Auto-calculate: try each available tube length (shortest first)
      // and find the tube count that provides the design area
      for (const L of availableLengths.sort((a, b) => a - b)) {
        const tubesForLength = Math.ceil(desArea / (areaPerTubePerM * L));
        if (tubesForLength > 0 && isFinite(tubesForLength)) {
          const testShellID = findMinShellID(tubesForLength, tubeOD, pitch, hasLanes);
          if (testShellID <= 6000) {
            bestTubes = tubesForLength;
            selectedLength = L;
            break;
          }
        }
      }
      if (bestTubes === 0) {
        bestTubes = Math.ceil(desArea / (areaPerTubePerM * maxTubeLength));
        selectedLength = maxTubeLength;
      }
      effShellID = shellIDOverride ?? findMinShellID(bestTubes, tubeOD, pitch, hasLanes);
    }

    // Get actual tube count from geometry (may be slightly more than bestTubes)
    const tubes = tubeCountOverride ?? countLateralTubes(effShellID, tubeOD, pitch, hasLanes);
    const effTubesPerRow = getMaxTubesPerRow(effShellID, pitch);

    const instArea = tubes * areaPerTubePerM * selectedLength;
    const margin = desArea > 0 ? (instArea / desArea - 1) * 100 : 0;

    // Distillate production in this effect
    const distFlow = (duty * 3.6) / hfg; // T/h

    // Accumulated distillate cascade (this effect + all previous)
    const prevAccumDist = i > 0 ? effects[i - 1]!.accumDistillateFlow : 0;
    const accumDistillateFlow = prevAccumDist + distFlow;

    // Flash vapour from distillate cascade
    let flashVapourFlow = 0;
    if (i > 0) {
      const prevBrineT2 = effects[i - 1]!.brineTemp;
      const flashDT2 = prevBrineT2 - brineT;
      const Cp2 = 4.18; // kJ/(kg·K)
      flashVapourFlow = prevAccumDist > 0 ? (prevAccumDist * Cp2 * flashDT2) / hfg : 0;
    }

    // Brine: spray flow minus evaporated vapour = remaining brine
    // In each effect: spray in → some evaporates → remaining is brine
    // Brine from this effect = total spray - distillate produced
    // Feed per effect (fresh SW portion)
    const feedPerEffectCalc =
      (((input.steamFlow * input.targetGOR) / nEff) * maxBrineSalinity) /
      (maxBrineSalinity - swSalinity);
    const brineOutThisEffect = feedPerEffectCalc - distFlow; // T/h (what doesn't evaporate)
    // Accumulated brine cascade (this effect brine + all previous brine flowing through)
    const prevAccumBrine = i > 0 ? effects[i - 1]!.accumBrineFlow : 0;
    const accumBrineFlow = prevAccumBrine + brineOutThisEffect;

    // Wetting / brine recirculation
    const minSpray = minGamma * 2 * effTubesPerRow * selectedLength * 3.6; // T/h
    const recirc = includeRecirc ? Math.max(0, minSpray - feedPerEffectCalc) : 0;

    effects.push({
      effect: i + 1,
      incomingVapourTemp: prevVapourT,
      brineTemp: brineT,
      bpe,
      nea: NEA,
      demisterLoss: demLoss,
      pressureDropLoss: pdLoss,
      vapourOutTemp: vapourOutT,
      workingDeltaT: workDT,
      pressure,
      overallU: U,
      duty,
      requiredArea: reqArea,
      designArea: desArea,
      tubes,
      tubeLength: selectedLength,
      installedArea: instArea,
      areaMargin: margin,
      distillateFlow: distFlow,
      accumDistillateFlow,
      brineOutFlow: brineOutThisEffect,
      accumBrineFlow,
      flashVapourFlow,
      hfg,
      hasVapourLanes: hasLanes,
      minSprayFlow: minSpray,
      brineRecirculation: recirc,
      shellLengthMM: Math.round(
        selectedLength * 1000 + 2 * shellThkMM + 2 * tubeSheetThkMM + 2 * tubeSheetAccessMM
      ),
      shellODmm: Math.round(effShellID + 2 * shellThkMM),
    });

    prevVapourT = vapourOutT;
  }

  // ── Check for undersized effects ─────────────────────────────────────
  const undersized = effects.filter((e) => e.areaMargin < -10);
  if (undersized.length > 0) {
    warnings.push(
      `${undersized.length} effect(s) are undersized by >10%: ${undersized.map((e) => `E${e.effect} (${e.areaMargin.toFixed(0)}%)`).join(', ')}. Consider fewer effects or larger shell.`
    );
  }

  // ── Totals ───────────────────────────────────────────────────────────
  // Gross distillate = all vapour produced across all effects
  const grossDistillate = effects.reduce((sum, e) => sum + e.distillateFlow, 0);
  // E1 condensate is the original steam — returns to source (solar field), not product
  const e1Condensate = input.steamFlow * (1 - VENT_LOSS_FRACTION);
  // Net distillate = product water (E2+ condensate + flash contributions)
  const totalDistillate = grossDistillate - e1Condensate;
  const achievedGOR = totalDistillate / input.steamFlow;
  const totalArea = effects.reduce((sum, e) => sum + e.installedArea, 0);
  const totalRecirc = effects.reduce((sum, e) => sum + e.brineRecirculation, 0);
  const makeUpFeed = (totalDistillate * maxBrineSalinity) / (maxBrineSalinity - swSalinity);
  const brineBlowdown = makeUpFeed - totalDistillate;

  // ── Shell ID warning ────────────────────────────────────────────────
  const largestShellOD = Math.max(...effects.map((e) => e.shellODmm));
  const largestShellID = largestShellOD - 2 * shellThkMM;
  if (largestShellID < 1800) {
    warnings.push(
      `Largest shell ID is ${largestShellID} mm (< 1,800 mm). A person cannot enter for tube maintenance. The designer may increase the shell to 1,800 mm ID minimum for access.`
    );
  }

  // ── Final Condenser ──────────────────────────────────────────────────
  const lastEffect = effects[nEff - 1]!;
  const fcVapFlow = lastEffect.distillateFlow;
  const fcVapT = lastEffect.vapourOutTemp;
  const fcDuty = (fcVapFlow * 1000 * getLatentHeat(fcVapT)) / 3600;
  const dT1 = fcVapT - condenserSWOutlet;
  const dT2 = fcVapT - input.seawaterTemperature;
  const fcLMTD = dT1 > 0 && dT2 > 0 ? (dT1 - dT2) / Math.log(dT1 / dT2) : 1;
  const fcU = input.condenserU ?? getDefaultCondenserU(input.tubeMaterialName ?? 'Al 5052');
  const fcArea = ((fcDuty * 1000) / (fcU * fcLMTD)) * (1 + designMargin);
  const cpSW = getSeawaterSpecificHeat(
    swSalinity,
    (input.seawaterTemperature + condenserSWOutlet) / 2
  );
  const fcSWflow = (fcDuty / (cpSW * (condenserSWOutlet - input.seawaterTemperature))) * 3.6;
  const swDensity = getSeawaterDensity(swSalinity, input.seawaterTemperature);
  const fcSWflowM3h = (fcSWflow * 1000) / swDensity;

  const condenser: MEDCondenserResult = {
    vapourFlow: fcVapFlow,
    vapourTemp: fcVapT,
    duty: fcDuty,
    lmtd: fcLMTD,
    overallU: fcU,
    designArea: fcArea,
    seawaterFlow: fcSWflow,
    seawaterFlowM3h: fcSWflowM3h,
  };

  if (fcLMTD < 2) {
    warnings.push(
      `Condenser LMTD is very low (${fcLMTD.toFixed(1)}°C). Consider increasing condenser approach or reducing number of effects.`
    );
  }

  // ── Preheaters ───────────────────────────────────────────────────────
  // Auto-determine: use preheaters from effects 2..N-1 (skip E1 and last)
  const numPH = input.numberOfPreheaters ?? Math.max(0, Math.min(nEff - 2, 4));
  const preheaters: MEDPreheaterResult[] = [];

  if (numPH > 0 && makeUpFeed > 0) {
    // Preheat SW from condenserSWOutlet to ~TBT-5 (approaching E1 spray temp)
    const phTempRise = Math.min((TBT - condenserSWOutlet) * 0.7, numPH * 4); // limit rise
    const phDTPerPH = phTempRise / numPH;
    const phU = input.preheaterU ?? getDefaultPreheaterU(input.tubeMaterialName ?? 'Al 5052');

    for (let i = 0; i < numPH; i++) {
      const phIdx = numPH - i; // PH numbering: PH1 is hottest
      const swIn = condenserSWOutlet + i * phDTPerPH;
      const swOut = swIn + phDTPerPH;
      // Vapour source: effect i+2 (skip E1)
      const vapSourceIdx = i + 1; // effect index (0-based), so effect 2, 3, 4...
      const vapT =
        vapSourceIdx < nEff ? effects[vapSourceIdx]!.vapourOutTemp : lastEffect.vapourOutTemp;
      const vapSourceName = `Effect ${vapSourceIdx + 1}`;

      const phDuty = (makeUpFeed * 1000 * cpSW * phDTPerPH) / 3600;
      const phDT1 = vapT - swOut;
      const phDT2 = vapT - swIn;
      const phLMTD = phDT1 > 0 && phDT2 > 0 ? (phDT1 - phDT2) / Math.log(phDT1 / phDT2) : 1;
      const phArea = phLMTD > 0 ? ((phDuty * 1000) / (phU * phLMTD)) * (1 + designMargin) : 0;

      preheaters.push({
        id: phIdx,
        vapourSource: vapSourceName,
        vapourTemp: vapT,
        swInlet: swIn,
        swOutlet: swOut,
        duty: phDuty,
        lmtd: phLMTD,
        designArea: phArea,
      });
    }
  }

  // ── GOR check ────────────────────────────────────────────────────────
  if (achievedGOR < input.targetGOR * 0.8) {
    warnings.push(
      `Achieved GOR (${achievedGOR.toFixed(1)}) is ${((1 - achievedGOR / input.targetGOR) * 100).toFixed(0)}% below target (${input.targetGOR}). ` +
        `Consider: fewer effects, larger shell, or longer tubes.`
    );
  }

  const result: MEDDesignerResult = {
    inputs: { ...input, resolvedDefaults },
    scenarios,
    recommendedEffects,
    effects,
    condenser,
    preheaters,
    totalDistillate,
    totalDistillateM3Day: totalDistillate * 24,
    achievedGOR,
    totalEvaporatorArea: totalArea,
    totalBrineRecirculation: totalRecirc,
    makeUpFeed,
    brineBlowdown,
    spraySalinity:
      totalRecirc + makeUpFeed > 0
        ? Math.round(
            (makeUpFeed * swSalinity + totalRecirc * maxBrineSalinity) / (makeUpFeed + totalRecirc)
          )
        : swSalinity,
    numberOfShells: nEff,
    auxiliaryEquipment: computeAuxiliaryEquipment(effects, condenser, {
      swSalinity,
      maxBrineSalinity,
      // Blended spray TDS: (make-up × SW_TDS + recirc × brine_TDS) / total
      spraySalinity:
        totalRecirc + makeUpFeed > 0
          ? Math.round(
              (makeUpFeed * swSalinity + totalRecirc * maxBrineSalinity) /
                (makeUpFeed + totalRecirc)
            )
          : swSalinity,
      shellID,
      nEff,
      totalDistillate,
      makeUpFeed,
      brineBlowdown: brineBlowdown,
      totalRecirc,
      steamFlow: input.steamFlow,
      swTemp: input.seawaterTemperature,
      condenserSWFlowM3h: condenser.seawaterFlowM3h,
    }),
    // Dosing
    dosing: computeDosing(
      makeUpFeed,
      getSeawaterDensity(swSalinity, input.seawaterTemperature),
      input.antiscalantDoseMgL ?? 2
    ),
    // Vacuum system
    vacuumSystem: computeVacuumSystem(
      effects[nEff - 1]!.pressure,
      effects[nEff - 1]!.vapourOutTemp,
      condenser.seawaterFlowM3h,
      input.seawaterTemperature,
      swSalinity / 1000, // ppm → g/kg
      effects.reduce((sum, e) => {
        // Estimate shell volume: π/4 × D² × L (in m³)
        const dM = (e.shellODmm ?? shellID + 16) / 1000;
        const lM = e.shellLengthMM / 1000;
        return sum + (Math.PI / 4) * dM * dM * lM;
      }, 0),
      input.vacuumTrainConfig ?? 'hybrid'
    ),
    overallDimensions: {
      totalLengthMM: effects.reduce((sum, e) => sum + e.shellLengthMM, 0) + (nEff - 1) * 200,
      shellODmm: largestShellOD,
      shellLengthRange: {
        min: Math.min(...effects.map((e) => e.shellLengthMM)),
        max: Math.max(...effects.map((e) => e.shellLengthMM)),
      },
    },
    warnings,
  };

  // Turndown analysis (opt-in)
  if (input.includeTurndown) {
    result.turndownAnalysis = computeTurndownAnalysis(input, result);
  }

  return result;
}

// ============================================================================
// Auxiliary Equipment Sizing
// ============================================================================

interface AuxContext {
  swSalinity: number;
  maxBrineSalinity: number;
  spraySalinity: number; // blended TDS of make-up + recycled brine
  shellID: number;
  nEff: number;
  totalDistillate: number;
  makeUpFeed: number;
  brineBlowdown: number;
  totalRecirc: number;
  steamFlow: number;
  swTemp: number;
  condenserSWFlowM3h: number;
}

function computeAuxiliaryEquipment(
  effects: MEDEffectResult[],
  condenser: MEDCondenserResult,
  ctx: AuxContext
): MEDAuxiliaryEquipment {
  const nEff = ctx.nEff;
  const auxWarnings: string[] = [];

  // ── 1. Demisters per effect ─────────────────────────────────────────
  const demisters: MEDDemisterResult[] = effects.map((e) => {
    try {
      const vapDensity = getDensityVapor(e.vapourOutTemp);
      const liqDensity = getDensityLiquid(e.brineTemp);
      const vapMassFlow = e.distillateFlow / 3.6; // T/h → kg/s

      const dem = calculateDemisterSizing({
        vaporMassFlow: vapMassFlow,
        vaporDensity: vapDensity,
        liquidDensity: liqDensity,
        demisterType: 'wire_mesh',
        orientation: 'horizontal',
        designMargin: 0.8,
        geometry: 'circular',
      });

      return {
        effect: e.effect,
        requiredArea: dem.requiredArea,
        designVelocity: dem.designVelocity,
        loadingStatus: dem.loadingStatus,
        pressureDrop: dem.pressureDrop,
      };
    } catch (err) {
      auxWarnings.push(
        `Demister E${e.effect}: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      return {
        effect: e.effect,
        requiredArea: 0,
        designVelocity: 0,
        loadingStatus: 'error',
        pressureDrop: 0,
      };
    }
  });

  // ── 2. Spray nozzles per effect (using layout calculator for height) ──
  const sprayNozzles: MEDSprayNozzleResult[] = effects.map((e) => {
    try {
      // Total spray flow = feed + recirculation, convert T/h → lpm
      const sprayFlowTh = e.minSprayFlow; // T/h
      const avgSalinity = (ctx.swSalinity + ctx.maxBrineSalinity) / 2;
      const density = getSeawaterDensity(avgSalinity, e.brineTemp);
      // T/h → lpm: (T/h × 1000 kg/T) / (density kg/m³) = m³/h, × 1000/60 = lpm
      const sprayFlowLpm = ((sprayFlowTh * 1000) / density) * (1000 / 60);

      // Use layout calculator — gives nozzle height, count, and positioning
      const bundleLengthMM = e.tubeLength * 1000; // tube length in mm
      // Bundle width ≈ half-shell width for lateral bundle
      const bundleWidthMM = ctx.shellID * 0.85; // approx usable width

      const layoutResult = calculateNozzleLayout({
        category: 'full_cone_square',
        totalFlow: sprayFlowLpm,
        operatingPressure: 1.5, // bar
        bundleLength: bundleLengthMM,
        bundleWidth: bundleWidthMM,
        targetHeight: 400, // mm — typical for MED spray
        minHeight: 250,
        maxHeight: 600,
      });

      const best = layoutResult.matches[0];
      return {
        effect: e.effect,
        nozzleModel: best?.modelNumber ?? 'N/A',
        nozzleCount: best?.totalNozzles ?? 0,
        flowPerNozzle: best ? best.flowAtPressure : 0,
        sprayAngle: best?.sprayAngle ?? 0,
        sprayHeight: best?.derivedHeight ?? 400,
        nozzlesAlongLength: best?.nozzlesAlongLength ?? 0,
        rowsAcrossWidth: best?.rowsAcrossWidth ?? 0,
      };
    } catch (err) {
      auxWarnings.push(
        `Spray nozzle E${e.effect}: ${err instanceof Error ? err.message : 'selection failed'}`
      );
      return {
        effect: e.effect,
        nozzleModel: 'N/A',
        nozzleCount: 0,
        flowPerNozzle: 0,
        sprayAngle: 0,
        sprayHeight: 400, // default fallback
        nozzlesAlongLength: 0,
        rowsAcrossWidth: 0,
      };
    }
  });

  // ── 3. Siphons between effects ──────────────────────────────────────
  const siphons: MEDSiphonResult[] = [];
  for (let i = 0; i < nEff - 1; i++) {
    const eFrom = effects[i]!;
    const eTo = effects[i + 1]!;

    // Distillate siphon — accumulated distillate cascade
    try {
      const distFlowAccum = eFrom.accumDistillateFlow;
      const distSiphon = calculateSiphonSizing({
        upstreamPressure: eFrom.pressure,
        downstreamPressure: eTo.pressure,
        pressureUnit: 'mbar_abs',
        fluidType: 'distillate',
        salinity: 5,
        flowRate: distFlowAccum,
        elbowConfig: '2_elbows',
        horizontalDistance: 1.0,
        offsetDistance: 0.5,
        targetVelocity: 0.3,
        safetyFactor: 20,
      });
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'distillate',
        flowRate: distFlowAccum,
        pipeSize: distSiphon.pipe.displayName,
        minimumHeight: distSiphon.minimumHeight,
        velocity: distSiphon.velocity,
      });
    } catch (err) {
      auxWarnings.push(
        `Siphon E${eFrom.effect}→E${eTo.effect} distillate: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'distillate',
        flowRate: 0,
        pipeSize: 'N/A',
        minimumHeight: 0,
        velocity: 0,
      });
    }

    // Brine siphon — accumulated brine cascade (brine from all effects up to this one)
    try {
      const brineFlow = eFrom.accumBrineFlow;
      const brineSiphon = calculateSiphonSizing({
        upstreamPressure: eFrom.pressure,
        downstreamPressure: eTo.pressure,
        pressureUnit: 'mbar_abs',
        fluidType: 'brine',
        salinity: ctx.maxBrineSalinity,
        flowRate: brineFlow,
        elbowConfig: '2_elbows',
        horizontalDistance: 1.0,
        offsetDistance: 0.5,
        targetVelocity: 0.3,
        safetyFactor: 20,
      });
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'brine',
        flowRate: brineFlow,
        pipeSize: brineSiphon.pipe.displayName,
        minimumHeight: brineSiphon.minimumHeight,
        velocity: brineSiphon.velocity,
      });
    } catch (err) {
      auxWarnings.push(
        `Siphon E${eFrom.effect}→E${eTo.effect} brine: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'brine',
        flowRate: 0,
        pipeSize: 'N/A',
        minimumHeight: 0,
        velocity: 0,
      });
    }
  }

  // ── 4. Line sizing for main headers ─────────────────────────────────
  const lineSizing: MEDLineSizing[] = [];
  const swDensity = getSeawaterDensity(ctx.swSalinity, ctx.swTemp);

  const lineSpecs: {
    service: string;
    flowTh: number;
    density: number;
    targetVel: number;
    velLimits: { min: number; max: number };
  }[] = [
    {
      service: 'Seawater to Condenser',
      flowTh: (ctx.condenserSWFlowM3h * swDensity) / 1000,
      density: swDensity,
      targetVel: 2.0,
      velLimits: { min: 1.0, max: 3.0 },
    },
    {
      service: 'Feed Water Header',
      flowTh: ctx.makeUpFeed,
      density: swDensity,
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
    {
      service: 'Distillate Header',
      flowTh: ctx.totalDistillate,
      density: 998,
      targetVel: 1.0,
      velLimits: { min: 0.5, max: 2.0 },
    },
    {
      service: 'Brine Blowdown Header',
      flowTh: ctx.brineBlowdown,
      density: getSeawaterDensity(ctx.maxBrineSalinity, 40),
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
    {
      service: 'Spray Header (total)',
      flowTh: ctx.totalRecirc + ctx.makeUpFeed, // total spray = recirc + make-up
      density: getSeawaterDensity(
        ctx.spraySalinity ?? (ctx.swSalinity + ctx.maxBrineSalinity) / 2,
        45
      ),
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
  ];

  for (const spec of lineSpecs) {
    try {
      const volFlow = (spec.flowTh * 1000) / (spec.density * 3600); // T/h → m³/s
      const pipe = selectPipeByVelocity(volFlow, spec.targetVel, spec.velLimits);
      lineSizing.push({
        service: spec.service,
        flowRate: spec.flowTh,
        pipeSize: pipe.displayName,
        dn: pipe.dn,
        velocity: pipe.actualVelocity,
        velocityStatus: pipe.velocityStatus,
      });
    } catch (err) {
      auxWarnings.push(
        `Line sizing ${spec.service}: ${err instanceof Error ? err.message : 'failed'}`
      );
      lineSizing.push({
        service: spec.service,
        flowRate: spec.flowTh,
        pipeSize: 'N/A',
        dn: 'N/A',
        velocity: 0,
        velocityStatus: 'error',
      });
    }
  }

  // ── 5. Pump sizing ──────────────────────────────────────────────────
  const pumps: MEDPumpResult[] = [];

  const pumpSpecs: {
    service: string;
    flowTh: number;
    density: number;
    staticHead: number;
    dischargePressure: number; // bar abs
    suctionPressure: number; // bar abs
    qty: string;
  }[] = [
    {
      service: 'Seawater Pump',
      flowTh: (ctx.condenserSWFlowM3h * swDensity) / 1000,
      density: swDensity,
      staticHead: 5,
      dischargePressure: 2.0,
      suctionPressure: 1.013,
      qty: '1+1',
    },
    {
      service: 'Distillate Pump',
      flowTh: ctx.totalDistillate,
      density: 998,
      staticHead: 3,
      dischargePressure: 2.0,
      suctionPressure: condenser.vapourTemp > 40 ? 0.08 : 0.06, // vacuum
      qty: '1+1',
    },
    {
      service: 'Brine Blowdown Pump',
      flowTh: ctx.brineBlowdown,
      density: getSeawaterDensity(ctx.maxBrineSalinity, 40),
      staticHead: 3,
      dischargePressure: 2.0,
      suctionPressure: effects[nEff - 1]?.pressure ? effects[nEff - 1]!.pressure / 1000 : 0.07,
      qty: '1+1',
    },
    {
      service: 'Brine Recirculation Pump',
      flowTh: ctx.totalRecirc + ctx.makeUpFeed, // total spray: make-up + recycled brine
      density: getSeawaterDensity(ctx.spraySalinity, 45),
      staticHead: 3,
      dischargePressure: 1.5,
      suctionPressure: 0.1, // ~100 mbar vacuum
      qty: '1+1',
    },
  ];

  for (const spec of pumpSpecs) {
    try {
      const result = calculateTDH({
        flowRate: spec.flowTh,
        fluidDensity: spec.density,
        suctionPressureDrop: 0.3, // estimated 0.3 bar suction friction
        dischargePressureDrop: 0.5, // estimated 0.5 bar discharge friction
        staticHead: spec.staticHead,
        dischargeVesselPressure: spec.dischargePressure,
        suctionVesselPressure: spec.suctionPressure,
      });
      pumps.push({
        service: spec.service,
        flowRate: spec.flowTh,
        flowRateM3h: result.volumetricFlowM3Hr,
        totalHead: result.totalDifferentialHead,
        hydraulicPower: result.hydraulicPower,
        motorPower: result.recommendedMotorKW,
        quantity: spec.qty,
      });
    } catch (err) {
      auxWarnings.push(
        `Pump ${spec.service}: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      pumps.push({
        service: spec.service,
        flowRate: spec.flowTh,
        flowRateM3h: 0,
        totalHead: 0,
        hydraulicPower: 0,
        motorPower: 0,
        quantity: spec.qty,
      });
    }
  }

  // ── 6. Nozzle schedule ───────────────────────────────────────────────
  const nozzleSchedule = computeNozzleSchedule(effects, ctx);
  auxWarnings.push(...nozzleSchedule.warnings);

  return { demisters, sprayNozzles, siphons, lineSizing, pumps, nozzleSchedule, auxWarnings };
}

// ============================================================================
// Anti-scalant Dosing
// ============================================================================

function computeDosing(
  makeUpFeedTh: number,
  swDensity: number,
  doseMgL: number
): MEDDosingResult | undefined {
  try {
    const feedFlowM3h = (makeUpFeedTh * 1000) / swDensity;
    const result = calculateDosing({
      feedFlowM3h,
      doseMgL,
      solutionDensityKgL: 1.05, // Belgard EV 2050 typical
      storageDays: 30,
    });
    return {
      feedFlowM3h,
      doseMgL,
      chemicalFlowLh: result.chemicalFlowLh,
      dailyConsumptionKg: result.dailyConsumptionKg,
      monthlyConsumptionKg: result.monthlyConsumptionKg,
      storageTankM3: result.storageTankM3 ?? 0,
      dosingLineOD: result.dosingLine ? `${result.dosingLine.tubingOD}mm OD` : 'N/A',
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// Vacuum System Sizing
// ============================================================================

function computeVacuumSystem(
  lastEffectPressureMbar: number,
  lastEffectTempC: number,
  swFlowM3h: number,
  swTempC: number,
  salinityGkg: number,
  systemVolumeM3: number,
  trainConfig: 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid'
): MEDVacuumResult | undefined {
  try {
    const result = calculateVacuumSystem({
      suctionPressureMbar: lastEffectPressureMbar - 2, // 2 mbar vent line ΔP
      suctionTemperatureC: lastEffectTempC,
      dischargePressureMbar: 1013,
      ncgMode: 'combined',
      includeHeiLeakage: true,
      includeSeawaterGas: true,
      systemVolumeM3,
      seawaterFlowM3h: swFlowM3h,
      seawaterTemperatureC: swTempC,
      salinityGkg,
      motivePressureBar: 8, // 8 bar motive steam
      coolingWaterTempC: swTempC,
      sealWaterTempC: swTempC,
      trainConfig,
      evacuationVolumeM3: systemVolumeM3,
    });
    return {
      lastEffectPressureMbar,
      systemVolumeM3,
      totalDryNcgKgH: result.totalDryNcgKgH,
      totalMotiveSteamKgH: result.totalMotiveSteamKgH,
      totalPowerKW: result.totalPowerKW,
      trainConfig,
      evacuationTimeMinutes: result.evacuationTimeMinutes ?? 0,
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// Nozzle Sizing for Shell Connections
// ============================================================================

function computeNozzleSchedule(effects: MEDEffectResult[], ctx: AuxContext): MEDNozzleSchedule {
  const nozzles: MEDShellNozzle[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]!;

    // Flow rates for this effect
    const vapourFlowTh = e.distillateFlow; // vapour produced ≈ distillate
    const brineFlowTh = e.minSprayFlow; // total spray flow
    const distillateFlowTh = e.distillateFlow;
    const ventFlowTh = vapourFlowTh * 0.02; // ~2% vent

    // Vapour density at effect conditions
    const vapDensity = getDensityVapor(e.vapourOutTemp);

    const nozzleSpecs: {
      service: MEDShellNozzle['service'];
      flowTh: number;
      density: number;
      targetVel: number;
      velLimits: { min: number; max: number };
    }[] = [
      {
        service: 'vapour_inlet',
        flowTh: i === 0 ? ctx.steamFlow : effects[i - 1]!.distillateFlow,
        density: getDensityVapor(e.incomingVapourTemp),
        targetVel: 30,
        velLimits: { min: 15, max: 50 },
      },
      {
        service: 'vapour_outlet',
        flowTh: vapourFlowTh,
        density: vapDensity,
        targetVel: 30,
        velLimits: { min: 15, max: 50 },
      },
      {
        service: 'brine_inlet',
        flowTh: brineFlowTh,
        density: getSeawaterDensity(ctx.swSalinity, e.brineTemp),
        targetVel: 1.0,
        velLimits: { min: 0.5, max: 1.5 },
      },
      {
        service: 'brine_outlet',
        flowTh: ctx.brineBlowdown / ctx.nEff,
        density: getSeawaterDensity(ctx.maxBrineSalinity, e.brineTemp),
        targetVel: 1.0,
        velLimits: { min: 0.5, max: 1.5 },
      },
      {
        service: 'distillate_outlet',
        flowTh: distillateFlowTh,
        density: 998,
        targetVel: 0.8,
        velLimits: { min: 0.3, max: 1.5 },
      },
      {
        service: 'vent',
        flowTh: ventFlowTh,
        density: vapDensity,
        targetVel: 20,
        velLimits: { min: 10, max: 30 },
      },
    ];

    for (const spec of nozzleSpecs) {
      try {
        const volFlow = (spec.flowTh * 1000) / (spec.density * 3600); // m³/s
        if (volFlow <= 0 || !isFinite(volFlow)) {
          nozzles.push({
            effect: e.effect,
            service: spec.service,
            flowRate: spec.flowTh,
            pipeSize: 'N/A',
            dn: 'N/A',
            velocity: 0,
            velocityStatus: 'N/A',
          });
          continue;
        }
        const pipe = selectPipeByVelocity(volFlow, spec.targetVel, spec.velLimits);
        nozzles.push({
          effect: e.effect,
          service: spec.service,
          flowRate: spec.flowTh,
          pipeSize: pipe.displayName,
          dn: pipe.dn,
          velocity: pipe.actualVelocity,
          velocityStatus: pipe.velocityStatus,
        });
      } catch (err) {
        warnings.push(
          `Nozzle E${e.effect} ${spec.service}: ${err instanceof Error ? err.message : 'failed'}`
        );
        nozzles.push({
          effect: e.effect,
          service: spec.service,
          flowRate: spec.flowTh,
          pipeSize: 'N/A',
          dn: 'N/A',
          velocity: 0,
          velocityStatus: 'error',
        });
      }
    }
  }

  return { nozzles, warnings };
}

// Cost estimation — on hold, will be implemented later

// ============================================================================
// Turndown Analysis
// ============================================================================

function computeTurndownAnalysis(
  input: MEDDesignerInput,
  baseResult: MEDDesignerResult
): MEDTurndownAnalysis {
  const loadPoints = [30, 50, 70, 100];
  const points: MEDTurndownPoint[] = [];
  const analysisWarnings: string[] = [];

  for (const loadPct of loadPoints) {
    const scaledSteamFlow = input.steamFlow * (loadPct / 100);

    try {
      // Re-run design at reduced load — prevent recursion
      const turndownInput: MEDDesignerInput = {
        ...input,
        steamFlow: scaledSteamFlow,
        includeTurndown: false, // CRITICAL: prevent infinite recursion
        numberOfEffects: baseResult.effects.length, // keep same number of effects
        // Use same tube lengths and counts as base design
        tubeLengthOverrides: baseResult.effects.map((e) => e.tubeLength),
        tubeCountOverrides: baseResult.effects.map((e) => e.tubes),
      };

      const result = designMED(turndownInput);

      // Wetting adequacy check per effect
      const wettingAdequacy = result.effects.map((e) => {
        // At reduced load, the recirculation pump still runs
        // but feed flow is reduced proportionally
        const feedPerEffect = result.makeUpFeed / result.effects.length;
        const totalSpray = feedPerEffect + e.brineRecirculation;
        // Wetting rate: spray flow / (2 × tubes_per_row × tube_length)
        // We need tubes per row — approximate from tube count and rows
        const approxRows = Math.max(1, Math.round(Math.sqrt(e.tubes / 2)));
        const approxTubesPerRow = Math.max(1, Math.round(e.tubes / approxRows));
        const gamma = (totalSpray * 1000) / 3600 / (2 * approxTubesPerRow * e.tubeLength);
        const gammaMin = input.minimumWettingRate ?? 0.035;

        return {
          effect: e.effect,
          gamma: Math.round(gamma * 10000) / 10000,
          gammaMin,
          adequate: gamma >= gammaMin,
        };
      });

      // Siphon seal check: at low loads, the pressure difference between
      // effects is smaller, which may cause siphons to lose seal
      const siphonsSealOk = result.effects.every((e) => e.pressure > 30); // > 30 mbar abs

      // Condenser capacity margin: at reduced load, condenser has excess capacity
      const baseCondenserDuty = baseResult.condenser.duty;
      const condenserMarginPct =
        baseCondenserDuty > 0
          ? ((baseCondenserDuty - result.condenser.duty) / baseCondenserDuty) * 100
          : 0;

      const pointWarnings: string[] = [];
      const allWet = wettingAdequacy.every((w) => w.adequate);
      if (!allWet) {
        const dryEffects = wettingAdequacy
          .filter((w) => !w.adequate)
          .map((w) => `E${w.effect}`)
          .join(', ');
        pointWarnings.push(`Wetting inadequate at ${loadPct}% load: ${dryEffects}`);
      }
      if (!siphonsSealOk) {
        pointWarnings.push(`Siphon seal risk at ${loadPct}% load`);
      }

      points.push({
        loadPercent: loadPct,
        steamFlow: scaledSteamFlow,
        distillateFlow: result.totalDistillate,
        distillateM3Day: result.totalDistillateM3Day,
        gor: result.achievedGOR,
        wettingAdequacy,
        siphonsSealOk,
        condenserMarginPct,
        feasible: allWet && siphonsSealOk,
        warnings: pointWarnings,
      });
    } catch (err) {
      analysisWarnings.push(
        `Turndown ${loadPct}%: ${err instanceof Error ? err.message : 'calculation failed'}`
      );
      points.push({
        loadPercent: loadPct,
        steamFlow: scaledSteamFlow,
        distillateFlow: 0,
        distillateM3Day: 0,
        gor: 0,
        wettingAdequacy: [],
        siphonsSealOk: false,
        condenserMarginPct: 0,
        feasible: false,
        warnings: [`Calculation failed at ${loadPct}% load`],
      });
    }
  }

  // Find minimum feasible load
  const feasiblePoints = points.filter((p) => p.feasible);
  const minimumLoadPercent =
    feasiblePoints.length > 0 ? Math.min(...feasiblePoints.map((p) => p.loadPercent)) : 100;

  return { points, minimumLoadPercent, warnings: analysisWarnings };
}

// ============================================================================
// Weight Estimation
// ============================================================================

/** Material densities in kg/m³ */
const DENSITY = {
  duplex_ss: 7800, // UNS S32304
  al_5052: 2680,
  ti_gr2: 4510,
  ss_316l: 8000,
  water: 1000,
};

/**
 * Weight of a 2:1 semi-ellipsoidal dished head (ASME standard)
 *
 * Approximate formula: W ≈ (π/4) × D² × t × ρ × K
 * where K ≈ 1.084 for 2:1 SE (accounts for knuckle region)
 *
 * @param diameterMM Inside diameter in mm
 * @param thicknessMM Thickness in mm
 * @param density Material density in kg/m³
 */
function dishedHeadWeight(diameterMM: number, thicknessMM: number, density: number): number {
  const D = diameterMM / 1000; // m
  const t = thicknessMM / 1000; // m
  const K = 1.084; // 2:1 SE factor
  return (Math.PI / 4) * D * D * t * density * K;
}

/**
 * Estimate weight for a single evaporator shell
 */
function estimateShellWeight(
  shellIDmm: number,
  shellLengthMM: number,
  shellThkMM: number,
  tubeSheetThkMM: number,
  tubes: number,
  tubeODmm: number,
  tubeWallMM: number,
  tubeLengthM: number,
  tubeDensity: number
): ShellWeight {
  const D = shellIDmm / 1000;
  const shellT = shellThkMM / 1000;
  const shellL = shellLengthMM / 1000;
  const tsT = tubeSheetThkMM / 1000;
  const tubeOD = tubeODmm / 1000;
  const tubeID = (tubeODmm - 2 * tubeWallMM) / 1000;
  const shellDensity = DENSITY.duplex_ss;

  // Cylindrical shell
  const shellOD = D + 2 * shellT;
  const shellWt = Math.PI * ((shellOD * shellOD - D * D) / 4) * shellL * shellDensity;

  // 2 × 2:1 SE dished heads
  const headWt = 2 * dishedHeadWeight(shellIDmm, shellThkMM, shellDensity);

  // 2 × tube sheets (flat circular plates with holes — approximate as solid)
  const tsWt = 2 * (Math.PI / 4) * D * D * tsT * shellDensity;

  // Tubes
  const tubeWt =
    tubes * (Math.PI / 4) * (tubeOD * tubeOD - tubeID * tubeID) * tubeLengthM * tubeDensity;

  // Water boxes (estimated as ~15% of shell weight)
  const wbWt = shellWt * 0.15;

  // Internals (demisters, spray pipes, baffles — ~10% of shell)
  const intWt = shellWt * 0.1;

  const total = shellWt + headWt + tsWt + tubeWt + wbWt + intWt;

  return {
    shell: Math.round(shellWt),
    dishedHeads: Math.round(headWt),
    tubeSheets: Math.round(tsWt),
    tubes: Math.round(tubeWt),
    waterBoxes: Math.round(wbWt),
    internals: Math.round(intWt),
    total: Math.round(total),
  };
}

/**
 * Estimate total plant weight
 */
function estimatePlantWeight(
  result: MEDDesignerResult,
  shellThkMM: number = 8,
  tubeSheetThkMM: number = 8
): MEDWeightEstimate {
  const shellIDmm = result.inputs.shellID ?? 1800;
  const tubeOD = result.inputs.tubeOD ?? 25.4;
  const tubeWall = result.inputs.tubeWallThickness ?? 1.0;
  const tubeMat = (result.inputs.tubeMaterialName ?? 'Al 5052').toLowerCase();
  const tubeDensity = tubeMat.includes('ti') ? DENSITY.ti_gr2 : DENSITY.al_5052;

  const evaporatorShells: ShellWeight[] = result.effects.map((e) => {
    const shellLength = e.shellLengthMM; // includes tube + sheets + 2×750mm access
    return estimateShellWeight(
      shellIDmm,
      shellLength,
      shellThkMM,
      tubeSheetThkMM,
      e.tubes,
      tubeOD,
      tubeWall,
      e.tubeLength,
      tubeDensity
    );
  });

  // Condenser weight (rough estimate: area × 50 kg/m² for Ti S&T)
  const condenserWeight = Math.round(result.condenser.designArea * 50);

  // Preheaters weight (area × 60 kg/m² for small S&T)
  const preheatersWeight = Math.round(
    result.preheaters.reduce((sum, ph) => sum + ph.designArea, 0) * 60
  );

  const totalDry =
    evaporatorShells.reduce((sum, s) => sum + s.total, 0) + condenserWeight + preheatersWeight;

  // Operating weight: dry + water hold-up (~30% of shell volume)
  const shellVolume = result.effects.reduce((sum, e) => {
    const D = shellIDmm / 1000;
    const L = e.tubeLength + 0.2;
    return sum + (Math.PI / 4) * D * D * L * 0.3;
  }, 0);
  const waterHoldUp = shellVolume * DENSITY.water;
  const totalOperating = totalDry + waterHoldUp;

  return {
    evaporatorShells,
    condenserWeight,
    preheatersWeight,
    totalDryWeight: Math.round(totalDry),
    totalOperatingWeight: Math.round(totalOperating),
  };
}

// ============================================================================
// Multi-Option Designer
// ============================================================================

/**
 * Generate multiple design options for comparison.
 *
 * Produces a range of options from "low GOR / compact / light" to
 * "high GOR / large area / heavy", allowing the designer to pick
 * the optimal trade-off.
 *
 * @param input Same minimal inputs as designMED
 * @returns Array of design options sorted by GOR (ascending)
 */
export function generateDesignOptions(input: MEDDesignerInput): MEDDesignOption[] {
  const options: MEDDesignOption[] = [];

  // Try 3 to 10 effects
  for (let n = 3; n <= 10; n++) {
    try {
      const result = designMED({ ...input, numberOfEffects: n });

      if (result.achievedGOR <= 0 || result.totalDistillate <= 0) continue;

      const weight = estimatePlantWeight(result);

      // Specific thermal energy: steam enthalpy / distillate volume
      const steamEnthalpy = getLatentHeat(input.steamTemperature); // kJ/kg
      const specificEnergy = (input.steamFlow * steamEnthalpy) / result.totalDistillate; // kJ/kg dist
      const specificEnergy_kWhM3 = specificEnergy / 3.6; // kJ/kg → kWh/m³

      // Label
      let label: string;
      if (result.achievedGOR >= input.targetGOR * 0.9) {
        label = `Option ${String.fromCharCode(65 + options.length)} — High GOR (${n} effects)`;
      } else if (result.achievedGOR >= input.targetGOR * 0.7) {
        label = `Option ${String.fromCharCode(65 + options.length)} — Balanced (${n} effects)`;
      } else {
        label = `Option ${String.fromCharCode(65 + options.length)} — Compact (${n} effects)`;
      }

      options.push({
        effects: n,
        gor: result.achievedGOR,
        distillateM3Day: result.totalDistillateM3Day,
        totalEvaporatorArea: result.totalEvaporatorArea,
        totalShells: n,
        condenserArea: result.condenser.designArea,
        totalPreheaterArea: result.preheaters.reduce((s, p) => s + p.designArea, 0),
        totalBrineRecirculation: result.totalBrineRecirculation,
        specificEnergy: specificEnergy_kWhM3,
        largestShellID: result.overallDimensions.shellODmm - 2 * (input.shellThickness ?? 8),
        trainLengthMM: result.overallDimensions.totalLengthMM,
        weight,
        feasible: result.warnings.length === 0,
        label,
        detail: result,
      });
    } catch {
      // Skip infeasible configurations (e.g. ΔT exhausted)
      continue;
    }
  }

  return options;
}
