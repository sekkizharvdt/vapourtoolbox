/**
 * MED Designer Type Definitions
 *
 * Types for the MED plant designer workflow — geometry, auxiliary equipment,
 * BOM, weight, cost estimation, and design optimization.
 *
 * These are distinct from the core solver types in @vapour/types (which define
 * the thermodynamic H&M balance). The designer types compose H&M results with
 * equipment sizing and geometry data for the complete design deliverable.
 *
 * Naming convention:
 *   - MEDDesignerEffect   — rich per-effect record (H&M + sizing + geometry)
 *   - MEDDesignerCondenser — condenser with geometry/pass options
 *   - MEDDesignerPreheater — preheater with geometry/pass options
 *   (These were previously named MEDEffectResult / MEDCondenserResult /
 *    MEDPreheaterResult, renamed to avoid collision with @vapour/types)
 */

// ============================================================================
// Input
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
  /** Ti tube length for condenser and preheaters in m (default 2.1) — standardised for procurement */
  tiTubeLength?: number;
  /** Target tube-side velocity for Ti equipment in m/s (default 1.6, range 1.4-1.8) */
  tiTargetVelocity?: number;
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
  /** Route recirculated brine through preheater chain before spraying (default false) */
  brineRecircThroughPreheaters?: boolean;
  /** Number of evaporator effects per physical shell (default 1; BARC uses 2) */
  effectsPerShell?: number;

  // ── TVC (Thermo Vapor Compressor) ────────────────────────────────────
  /** Enable TVC mode (default false — plain MED) */
  tvcEnabled?: boolean;
  /** Motive steam pressure in bar abs (required when tvcEnabled) */
  tvcMotivePressure?: number;
  /** Motive steam superheat in °C above saturation (default 0) */
  tvcSuperheat?: number;
  /** Effect from which vapor is entrained by the TVC (1-based, default: last effect) */
  tvcEntrainedEffect?: number;

  // ── Per-effect overrides (user refinement after initial auto-design) ──
  /** Override tube length per effect (array indexed by effect 0..n-1) */
  tubeLengthOverrides?: (number | null)[];
  /** Override tube count per effect (array indexed by effect 0..n-1) */
  tubeCountOverrides?: (number | null)[];
  /** Override shell ID per effect in mm (array indexed by effect 0..n-1) */
  shellIDOverrides?: (number | null)[];
}

// ============================================================================
// Per-Effect Result (Designer variant — H&M + sizing + geometry combined)
// ============================================================================

/** Per-effect result — combines H&M balance data with equipment sizing and geometry.
 *  Previously named `MEDEffectResult` in medDesigner.ts; renamed to avoid collision
 *  with the core solver's `MEDEffectResult` in @vapour/types. */
export interface MEDDesignerEffect {
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
  /** Shell length mm (tube + 2×tubesheet + access) */
  shellLengthMM: number;
  /** Shell OD mm (ID + 2×thickness) */
  shellODmm: number;
  /** Number of Ti top rows for erosion protection (typically 3) */
  tiTopRows: number;
  /** Number of Ti tubes in top rows */
  tiTubeCount: number;
  /** Spray nozzle installation space above bundle mm */
  sprayNozzleSpaceMM: number;
  /** Drainage clearance below bundle mm */
  drainageClearanceMM: number;
  /** Vapour flow area in open half of shell m² */
  vapourFlowAreaM2: number;
  /** Maximum vapour velocity through open area m/s */
  vapourVelocity: number;
  /** Vapour velocity status */
  vapourVelocityStatus: 'ok' | 'high' | 'low';
  /** Spray temperature entering this effect °C */
  sprayTemp: number;
  /** Which physical shell this effect belongs to (1-based, when effectsPerShell > 1) */
  shellGroup?: number;
  /** How many effects share this physical shell */
  effectsInShell?: number;
  /** Tube bundle geometry from full layout engine (when available) */
  bundleGeometry?: {
    /** OTL diameter mm */
    otlDiameter: number;
    /** Number of tube rows in drip direction */
    numberOfRows: number;
    /** Actual tube count from layout (may differ from TEMA estimate) */
    actualTubeCount: number;
    /** Bundle width mm */
    bundleWidthMM: number;
    /** Bundle height mm */
    bundleHeightMM: number;
    /** Tubes removed by vapour lanes */
    tubesRemovedByLanes: number;
    /** Bottom clearance mm (brine pool) */
    bottomClearance: number;
    /** Spray zone clearance mm */
    sprayZoneClearance: number;
  };
}

// ============================================================================
// Condenser & Preheater (Designer variants with geometry)
// ============================================================================

/** Pass option for condenser/preheater */
export interface PassOption {
  passes: number;
  tubesPerPass: number;
  totalTubes: number;
  velocity: number; // m/s
  inRange: boolean; // velocity 1.4-1.8 m/s
  area: number; // m²
  shellODmm: number;
  /** Calculated overall U at this velocity, W/(m²·K) */
  calculatedU?: number;
}

/** Final condenser result — designer variant with geometry. */
export interface MEDDesignerCondenser {
  vapourFlow: number; // T/h
  vapourTemp: number; // °C
  duty: number; // kW
  lmtd: number; // °C
  overallU: number; // W/(m²·K)
  designArea: number; // m²
  seawaterFlow: number; // T/h
  seawaterFlowM3h: number; // m³/h
  /** Number of tubes */
  tubes: number;
  /** Number of passes */
  passes: number;
  /** Tube-side velocity m/s */
  velocity: number;
  /** Shell OD mm */
  shellODmm: number;
  /** Tube OD mm */
  tubeOD: number;
  /** Tube length mm */
  tubeLengthMM: number;
  /** All even-pass options for user decision */
  passOptions: PassOption[];
}

/** Preheater result — designer variant with geometry. */
export interface MEDDesignerPreheater {
  id: number;
  vapourSource: string; // e.g. "Effect 2"
  vapourTemp: number; // °C
  swInlet: number; // °C
  swOutlet: number; // °C
  duty: number; // kW
  lmtd: number; // °C
  designArea: number; // m²
  /** Flow through this PH (decreasing as spray peeled off) T/h */
  flowTh: number;
  /** Number of tubes */
  tubes: number;
  /** Number of passes */
  passes: number;
  /** Tube-side velocity m/s */
  velocity: number;
  /** Shell OD mm */
  shellODmm: number;
  /** Tube OD mm */
  tubeOD: number;
  /** Tube length mm */
  tubeLengthMM: number;
  /** All even-pass options for user decision */
  passOptions: PassOption[];
}

// ============================================================================
// Auxiliary Equipment
// ============================================================================

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
  sprayHeight: number; // mm
  /** Coverage width per nozzle row (mm) — used for tube field wetting cutback */
  coverageWidth: number; // mm
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
  service: string;
  flowRate: number; // T/h
  pipeSize: string;
  dn: string;
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
  pipeSize: string;
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

// ============================================================================
// Analysis & Optimization
// ============================================================================

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
  wettingAdequacy: {
    effect: number;
    gamma: number;
    gammaMin: number;
    adequate: boolean;
  }[];
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

/** Per-effect row in geometry comparison */
export interface GeometryComparisonEffect {
  effect: number;
  tubeLength: number; // m
  tubes: number;
  installedArea: number; // m²
  requiredArea: number; // m²
  margin: number; // %
  shellID: number; // mm
  shellLength: number; // mm
  brineRecirc: number; // T/h
  hasVapourLanes: boolean;
}

/** A geometry comparison option */
export interface GeometryComparisonOption {
  mode: 'fixed_length' | 'fixed_tubes' | 'optimised';
  label: string;
  description: string;
  effects: GeometryComparisonEffect[];
  maxShellID: number; // mm
  totalArea: number; // m²
  totalRecirc: number; // T/h
  trainLength: number; // mm
  feasible: boolean;
  warnings: string[];
}

/** Preheater contribution to distillate production */
export interface PreheaterContribution {
  phId: number;
  tempRise: number; // °C
  extraDistillatePercent: number; // %
  cumulativePercent: number; // %
}

// ============================================================================
// Weight & Cost
// ============================================================================

/** Weight breakdown for a single shell */
export interface ShellWeight {
  shell: number; // kg
  dishedHeads: number; // kg
  tubeSheets: number; // kg
  tubes: number; // kg
  waterBoxes: number; // kg
  internals: number; // kg
  total: number; // kg
}

/** Weight summary for the entire plant */
export interface MEDWeightEstimate {
  evaporatorShells: ShellWeight[];
  condenserWeight: number; // kg
  preheatersWeight: number; // kg
  totalDryWeight: number; // kg
  totalOperatingWeight: number; // kg
}

// ============================================================================
// Design Options & Scenarios
// ============================================================================

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
  specificEnergy: number; // kWh_thermal / m³
  largestShellID: number; // mm
  trainLengthMM: number; // mm
  weight: MEDWeightEstimate;
  feasible: boolean;
  label: string;
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

/** GOR configuration: effects × preheaters combination to achieve target GOR */
export interface GORConfigRow {
  effects: number;
  preheaters: number;
  feedTemp: number; // °C
  workDTPerEffect: number; // °C
  gor: number;
  distillate: number; // T/h
  outputM3Day: number;
  gorDeviation: number;
  feasible: boolean;
  recommended: boolean;
}

// ============================================================================
// Complete Result
// ============================================================================

/** Complete MED design result */
export interface MEDDesignerResult {
  // ── Input echo ───────────────────────────────────────────────────────
  inputs: MEDDesignerInput & {
    resolvedDefaults: Record<string, number | string | boolean>;
  };

  // ── GOR configurations (effects × preheaters to achieve target GOR) ──
  gorConfigurations: GORConfigRow[];

  // ── Scenario comparison (reference — all effect counts) ────────────
  scenarios: MEDScenarioRow[];
  recommendedEffects: number;

  // ── Design ───────────────────────────────────────────────────────────
  effects: MEDDesignerEffect[];
  condenser: MEDDesignerCondenser;
  preheaters: MEDDesignerPreheater[];

  // ── Summary ──────────────────────────────────────────────────────────
  totalDistillate: number; // T/h
  totalDistillateM3Day: number;
  achievedGOR: number;
  totalEvaporatorArea: number; // m²
  totalBrineRecirculation: number; // T/h
  makeUpFeed: number; // T/h
  brineBlowdown: number; // T/h
  spraySalinity: number; // ppm
  numberOfShells: number;

  auxiliaryEquipment: MEDAuxiliaryEquipment;
  dosing?: MEDDosingResult;
  vacuumSystem?: MEDVacuumResult;
  costEstimate?: MEDCostEstimate;
  turndownAnalysis?: MEDTurndownAnalysis;
  geometryComparisons?: GeometryComparisonOption[];
  preheaterContributions?: PreheaterContribution[];
  swReject: number; // T/h

  /** TVC result (present when tvcEnabled) */
  tvc?: {
    motiveFlow: number; // kg/hr
    entrainedFlow: number; // kg/hr
    dischargeFlow: number; // kg/hr
    compressionRatio: number;
    entrainmentRatio: number;
  };

  overallDimensions: {
    totalLengthMM: number;
    shellODmm: number;
    shellLengthRange: { min: number; max: number };
  };

  warnings: string[];
}

// ============================================================================
// Backward-compatible aliases (used by medDesigner.ts internally)
// ============================================================================

/** @deprecated Use MEDDesignerEffect instead */
export type MEDEffectResult = MEDDesignerEffect;
/** @deprecated Use MEDDesignerCondenser instead */
export type MEDCondenserResult = MEDDesignerCondenser;
/** @deprecated Use MEDDesignerPreheater instead */
export type MEDPreheaterResult = MEDDesignerPreheater;
