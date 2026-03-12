/**
 * Thermal Desalination Module Types
 *
 * Type definitions for flash chamber and other thermal desalination
 * equipment design calculations.
 */

// ============================================================================
// Flash Chamber Types
// ============================================================================

/**
 * Input mode for flash chamber calculation
 * - WATER_FLOW: User specifies inlet water flow rate, vapor is calculated
 * - VAPOR_QUANTITY: User specifies desired vapor output, water flow is calculated
 */
export type FlashChamberInputMode = 'WATER_FLOW' | 'VAPOR_QUANTITY';

/**
 * How the flashing operating condition is specified
 * - PRESSURE: User enters operating pressure (mbar abs); saturation temperature is derived
 * - TEMPERATURE: User enters flashing temperature (°C); operating pressure is derived and synced
 */
export type FlashingInputMode = 'PRESSURE' | 'TEMPERATURE';

/**
 * Water type for flash chamber calculation
 * - SEAWATER: Seawater with salinity (default 35000 ppm)
 * - DM_WATER: Demineralized/pure water (salinity = 0)
 */
export type FlashChamberWaterType = 'SEAWATER' | 'DM_WATER';

/**
 * Demister / mist eliminator type — controls the Souders-Brown K factor used
 * for the vapour-velocity diameter criterion.
 * - NONE:      No demister  (K = 0.05 m/s — conservative, larger vessel)
 * - WIRE_MESH: Wire-mesh pad (K = 0.09 m/s — common default)
 * - VANE:      Vane-type    (K = 0.15 m/s — compact, higher capacity)
 * Source: Perry's Chemical Engineers' Handbook; El-Dessouky & Ettouney
 */
export type DemisterType = 'NONE' | 'WIRE_MESH' | 'VANE';

/**
 * Flow rate unit options
 * - KG_SEC: kg/sec
 * - KG_HR: kg/hr
 * - TON_HR: ton/hr (metric tonnes per hour)
 */
export type FlowRateUnit = 'KG_SEC' | 'KG_HR' | 'TON_HR';

/**
 * Process inputs for flash chamber design
 */
export interface FlashChamberInput {
  /** Calculation mode */
  mode: FlashChamberInputMode;

  /** Water type: seawater or DM water */
  waterType: FlashChamberWaterType;

  /** Flow rate unit for input/display */
  flowRateUnit: FlowRateUnit;

  /** Operating pressure inside flash chamber in mbar (absolute) */
  operatingPressure: number;

  /** Inlet water flow rate (unit specified by flowRateUnit, required if mode = WATER_FLOW) */
  waterFlowRate?: number;

  /** Desired vapor output (unit specified by flowRateUnit, required if mode = VAPOR_QUANTITY) */
  vaporQuantity?: number;

  /** Water inlet temperature in °C */
  inletTemperature: number;

  /** Water salinity in ppm (default: 35000 for seawater, 0 for DM water) */
  salinity: number;

  /** Liquid retention time in minutes (typical: 2-3 min) */
  retentionTime: number;

  /** Flashing zone height in mm (default: 500) */
  flashingZoneHeight: number;

  /** Spray nozzle cone angle in degrees (for spray zone height calculation) */
  sprayAngle: number;

  /** Inlet water nozzle velocity in m/s (typical: 2-3 m/s) */
  inletWaterVelocity: number;

  /** Outlet brine nozzle velocity in m/s (max 0.1 m/s to minimize vortexing) */
  outletWaterVelocity: number;

  /** Vapor outlet nozzle velocity in m/s (typical: 10-30 m/s) */
  vaporVelocity: number;

  /** Pump centerline elevation above FFL (Finished Floor Level) in meters (typical: 0.5-0.75m) */
  pumpCenterlineAboveFFL: number;

  /** Operating level elevation above pump centerline in meters (typical: 4m or higher) */
  operatingLevelAbovePump: number;

  /** Ratio determining where operating level sits within retention zone (0-1, e.g., 0.5 = midpoint) */
  operatingLevelRatio: number;

  /** Gap between LG-L (Low Level) and BTL (Bottom Tangent Line) in meters (typical: ~0.1m) */
  btlGapBelowLGL: number;

  /** User-specified diameter in mm (optional - if provided, overrides auto-calculation) */
  userDiameter?: number;

  /** Whether to use auto-calculated diameter or user-specified */
  autoCalculateDiameter?: boolean;

  /**
   * Whether the operating condition is specified by pressure or temperature.
   * Defaults to 'PRESSURE' when not set.
   */
  flashingInputMode?: FlashingInputMode;

  /**
   * Flashing (saturation) temperature in °C — used when flashingInputMode = 'TEMPERATURE'.
   * Always kept in sync with operatingPressure so the calculator always reads operatingPressure.
   */
  flashingTemperature?: number;

  /**
   * Mist eliminator / demister type — determines the Souders-Brown K factor used when
   * auto-calculating the vapour-velocity diameter criterion.
   * Defaults to 'WIRE_MESH' when not set.
   */
  demisterType?: DemisterType;
}

/**
 * Single row in heat and mass balance table
 */
export interface HeatMassBalanceRow {
  /** Stream name (e.g., "Seawater Inlet", "Vapor Out", "Brine Out") */
  stream: string;

  /** Mass flow rate in ton/hr */
  flowRate: number;

  /** Temperature in °C */
  temperature: number;

  /** Pressure in mbar (absolute) */
  pressure: number;

  /** Specific enthalpy in kJ/kg */
  enthalpy: number;

  /** Heat duty in kW */
  heatDuty: number;
}

/**
 * Complete heat and mass balance for flash chamber
 */
export interface HeatMassBalance {
  /** Seawater inlet stream */
  inlet: HeatMassBalanceRow;

  /** Vapor (steam) outlet stream */
  vapor: HeatMassBalanceRow;

  /** Concentrated brine outlet stream */
  brine: HeatMassBalanceRow;

  /** Total heat input in kW */
  heatInput: number;

  /** Total heat output in kW */
  heatOutput: number;

  /** Balance error as percentage (ideally < 1%) */
  balanceError: number;

  /** Whether the balance is within acceptable tolerance */
  isBalanced: boolean;
}

/**
 * Chamber sizing calculation results
 */
export interface ChamberSizing {
  /** Chamber inside diameter in mm */
  diameter: number;

  /** Cross-sectional area in m² */
  crossSectionArea: number;

  /** Retention zone height in mm (based on retention time) */
  retentionZoneHeight: number;

  /** Flashing zone height in mm (typically 500mm) */
  flashingZoneHeight: number;

  /** Spray zone height in mm (from spray angle triangle calculation) */
  sprayZoneHeight: number;

  /** Total chamber height (T/T) in mm */
  totalHeight: number;

  /** Total chamber volume in m³ */
  totalVolume: number;

  /** Liquid holdup volume in m³ */
  liquidHoldupVolume: number;

  /** Vapor velocity through chamber cross-section in m/s */
  vaporVelocity: number;

  /** Vapor velocity status relative to Souders-Brown maximum allowable velocity */
  vaporVelocityStatus: 'OK' | 'HIGH' | 'VERY_HIGH';

  /** Vapor loading - vapor flow rate per unit cross-section area in ton/hr/m² */
  vaporLoading: number;

  /** Vapour-loading criterion diameter in mm (D_VL) — from vaporFlow / 2.0 ton/hr/m² */
  vaporLoadingDiameter: number;

  /** Actual vapour cross-section loading at design diameter in ton/hr/m² (vapour flow / area) */
  crossSectionLoading: number;

  /** Souders-Brown maximum allowable vapour velocity in m/s (u_SB = K × √((ρL−ρV)/ρV)) */
  sbMaxVelocity: number;

  /** Souders-Brown vapour-velocity criterion diameter in mm (D_SB) */
  vaporVelocityDiameter: number;
}

/**
 * Nozzle sizing result for a single nozzle
 */
export interface NozzleSizing {
  /** Nozzle type/service */
  type: 'inlet' | 'outlet' | 'vapor';

  /** Display name for the nozzle */
  name: string;

  /** Required flow area based on velocity in mm² */
  requiredArea: number;

  /** Calculated diameter from required area in mm */
  calculatedDiameter: number;

  /** Selected standard pipe size (e.g., "6 inch Sch 40") */
  selectedPipeSize: string;

  /** Nominal Pipe Size designation */
  nps: string;

  /** Actual inside diameter from pipe schedule in mm */
  actualID: number;

  /** Actual velocity with selected pipe size in m/s */
  actualVelocity: number;

  /** Velocity status indicator */
  velocityStatus: 'OK' | 'HIGH' | 'LOW';

  /** Velocity limits for reference */
  velocityLimits: {
    min: number;
    max: number;
  };
}

/**
 * NPSHa calculation at a specific level
 */
export interface NPSHaAtLevel {
  /** Level name (e.g., "LG-L (Low Level)", "Operating Level", "LG-H (High Level)") */
  levelName: string;

  /** Level elevation above FFL in meters */
  elevation: number;

  /** Static head - level elevation minus pump centerline in m */
  staticHead: number;

  /** Calculated NPSHa in m */
  npshAvailable: number;
}

/**
 * NPSHa (Net Positive Suction Head Available) calculation at three levels
 */
export interface NPSHaCalculation {
  /** NPSHa at LG-L (lowest level - worst case) */
  atLGL: NPSHaAtLevel;

  /** NPSHa at Operating Level (normal operation) */
  atOperating: NPSHaAtLevel;

  /** NPSHa at LG-H (highest level - best case) */
  atLGH: NPSHaAtLevel;

  /** Chamber operating pressure converted to head in m */
  chamberPressureHead: number;

  /** Vapor pressure head at operating temperature in m (negative contribution) */
  vaporPressureHead: number;

  /** Estimated friction loss in suction piping in m */
  frictionLoss: number;

  /** Recommended minimum NPSH margin in m (typically 1-2m above NPSHr) */
  recommendedNpshMargin: number;

  /** Recommendation text for pump selection */
  recommendation: string;
}

/**
 * Elevation data for flash chamber engineering diagram
 * All elevations are in meters, with FFL (Finished Floor Level) as reference (0.000)
 */
export interface FlashChamberElevations {
  /** Finished Floor Level - reference elevation (always 0.000) */
  ffl: number;

  /** Pump centerline elevation above FFL */
  pumpCenterline: number;

  /** Bottom Tangent Line - calculated from LG-L minus gap */
  btl: number;

  /** Level Gauge Low Tapping - minimum operating level */
  lgLow: number;

  /** Operating Level - normal liquid level (user-specified position within retention zone) */
  operatingLevel: number;

  /** Level Gauge High Tapping - maximum operating level (top of retention zone) */
  lgHigh: number;

  /** Bottom of flashing zone (same as lgHigh) */
  flashingZoneBottom: number;

  /** Top of flashing zone */
  flashingZoneTop: number;

  /** Top Tangent Line - total chamber height above FFL */
  ttl: number;

  /** Nozzle elevation positions */
  nozzleElevations: {
    /** Inlet nozzle (N1) - in spray zone */
    inlet: number;
    /** Vapor outlet nozzle (N2) - at top */
    vaporOutlet: number;
    /** Brine outlet nozzle (N3) - at bottom (BTL level) */
    brineOutlet: number;
  };

  /** Height of retention zone (between LG-L and LG-H) in meters */
  retentionZoneHeightM: number;

  /** Height of flashing zone in meters */
  flashingZoneHeightM: number;

  /** Height of spray zone in meters */
  sprayZoneHeightM: number;
}

/**
 * Complete flash chamber calculation result
 */
export interface FlashChamberResult {
  /** Optional document ID if saved to database */
  id?: string;

  /** Input parameters used for calculation */
  inputs: FlashChamberInput;

  /** Heat and mass balance results */
  heatMassBalance: HeatMassBalance;

  /** Chamber sizing results */
  chamberSizing: ChamberSizing;

  /** Nozzle sizing results for all nozzles */
  nozzles: NozzleSizing[];

  /** NPSHa calculation for bottom pump */
  npsha: NPSHaCalculation;

  /** Elevation data for engineering diagram */
  elevations: FlashChamberElevations;

  /** Timestamp of calculation */
  calculatedAt: Date;

  /** Any warnings or notes from the calculation */
  warnings: string[];

  /** Calculation metadata */
  metadata?: {
    /** Steam table source */
    steamTableSource: 'IAPWS-IF97';
    /** Seawater property source */
    seawaterSource: 'MIT';
    /** Version of calculation engine */
    calculatorVersion: string;
  };
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default input values for flash chamber calculator
 * Default pressure of 200 mbar abs corresponds to ~60°C saturation temperature
 */
export const DEFAULT_FLASH_CHAMBER_INPUT: FlashChamberInput = {
  mode: 'WATER_FLOW',
  waterType: 'SEAWATER',
  flowRateUnit: 'TON_HR',
  operatingPressure: 200, // mbar (absolute) - ~60°C saturation temp
  waterFlowRate: 100, // ton/hr (default unit)
  inletTemperature: 70, // °C
  salinity: 35000, // ppm (seawater default)
  retentionTime: 2.5, // minutes
  flashingZoneHeight: 500, // mm
  sprayAngle: 90, // degrees (wider angle = shorter spray zone)
  inletWaterVelocity: 2.5, // m/s
  outletWaterVelocity: 0.05, // m/s (max 0.1 to minimize vortexing)
  vaporVelocity: 20, // m/s
  pumpCenterlineAboveFFL: 0.6, // 600mm typical
  operatingLevelAbovePump: 4.0, // 4m typical
  operatingLevelRatio: 0.5, // Operating level at midpoint of retention zone
  btlGapBelowLGL: 0.1, // 100mm gap
  userDiameter: 1000, // Default 1000mm if user wants to specify
  autoCalculateDiameter: true, // Auto-calculate by default
  flashingInputMode: 'PRESSURE' as const, // Default: specify by pressure
  flashingTemperature: 60, // °C — ~200 mbar abs saturation temp
  demisterType: 'WIRE_MESH' as const, // Wire-mesh demister as default (K = 0.09)
};

// ============================================================================
// Validation Limits
// ============================================================================

/**
 * Validation limits for flash chamber inputs
 * Pressure range: 10-500 mbar abs covers ~7°C to ~81°C saturation temperatures
 */
export const FLASH_CHAMBER_LIMITS = {
  operatingPressure: { min: 10, max: 500, unit: 'mbar abs' },
  waterFlowRate: { min: 1, max: 10000, unit: 'ton/hr' }, // Base unit, converted from user selection
  vaporQuantity: { min: 0.1, max: 1000, unit: 'ton/hr' }, // Base unit, converted from user selection
  inletTemperature: { min: 10, max: 120, unit: '°C' },
  salinity: { min: 0, max: 70000, unit: 'ppm' }, // 0 for DM water, up to 70000 for brine
  retentionTime: { min: 1, max: 5, unit: 'minutes' },
  flashingZoneHeight: { min: 300, max: 1000, unit: 'mm' },
  sprayAngle: { min: 70, max: 100, unit: 'degrees' }, // Wider angle = shorter spray zone
  inletWaterVelocity: { min: 1.5, max: 4.0, unit: 'm/s' },
  outletWaterVelocity: { min: 0.01, max: 0.1, unit: 'm/s' }, // Very low to minimize vortexing
  vaporVelocity: { min: 5, max: 40, unit: 'm/s' },
  pumpCenterlineAboveFFL: { min: 0.3, max: 2.0, unit: 'm' },
  operatingLevelAbovePump: { min: 2.0, max: 15.0, unit: 'm' },
  operatingLevelRatio: { min: 0.2, max: 0.8, unit: '' },
  btlGapBelowLGL: { min: 0.05, max: 0.5, unit: 'm' },
  userDiameter: { min: 500, max: 5000, unit: 'mm' },
  // 10°C ≈ 12 mbar, 80°C ≈ 474 mbar — covers the full 50–500 mbar operating range
  flashingTemperature: { min: 10, max: 80, unit: '°C' },
} as const;

/**
 * Flow rate conversion factors to ton/hr (base unit for calculations)
 */
export const FLOW_RATE_CONVERSIONS = {
  /** kg/sec to ton/hr */
  KG_SEC_TO_TON_HR: 3.6,
  /** kg/hr to ton/hr */
  KG_HR_TO_TON_HR: 0.001,
  /** ton/hr to ton/hr (identity) */
  TON_HR_TO_TON_HR: 1,
} as const;

/**
 * Get flow rate unit display label
 */
export const FLOW_RATE_UNIT_LABELS: Record<FlowRateUnit, string> = {
  KG_SEC: 'kg/sec',
  KG_HR: 'kg/hr',
  TON_HR: 'ton/hr',
} as const;

// ============================================================================
// Saved Calculations
// ============================================================================

/**
 * Saved calculator inputs for personal use.
 * Personal scope: each user sees only their own saves (no entityId).
 */
export interface SavedCalculation {
  id: string;
  userId: string;
  calculatorType:
    | 'SIPHON_SIZING'
    | 'SIPHON_SIZING_BATCH'
    | 'FLASH_CHAMBER'
    | 'DESUPERHEATING'
    | 'TVC'
    | 'HEAT_TRANSFER'
    | 'NCG_PROPERTIES'
    | 'SPRAY_NOZZLE'
    | 'SPRAY_NOZZLE_LAYOUT'
    | 'VACUUM_SYSTEM'
    | 'HEAT_DUTY'
    | 'HEAT_EXCHANGER'
    | 'CHEMICAL_DOSING'
    | 'DEMISTER'
    | 'MVC'
    | 'NPSHA'
    | 'PIPE_SIZING'
    | 'PRESSURE_DROP'
    | 'PUMP_SIZING'
    | 'FOULING_SCALING'
    | 'FALLING_FILM'
    | 'GOR'
    | 'VACUUM_BREAKER'
    | 'MED_PLANT';
  name: string;
  inputs: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
}

// ============================================================================
// Unit Conversion Constants
// ============================================================================

/**
 * Pressure conversion factors
 */
export const PRESSURE_CONVERSIONS = {
  /** kg/cm² to bar */
  KG_CM2_TO_BAR: 0.980665,
  /** bar to kg/cm² */
  BAR_TO_KG_CM2: 1.01972,
  /** Atmospheric pressure in kg/cm²(a) */
  ATM_KG_CM2: 1.033,
  /** Atmospheric pressure in bar */
  ATM_BAR: 1.01325,
  /** Atmospheric pressure in millibar */
  ATM_MBAR: 1013.25,
  /** Atmospheric pressure head in meters of water */
  ATM_M_WATER: 10.33,
  /** mbar to bar */
  MBAR_TO_BAR: 0.001,
  /** bar to mbar */
  BAR_TO_MBAR: 1000,
} as const;

// ============================================================================
// MED Plant Design Types
// ============================================================================

/** MED plant type — the high-level configuration */
export type MEDPlantType = 'MED' | 'MED_TVC';

/** Where condensate is extracted from the plant */
export type CondensateExtraction = 'FINAL_CONDENSER' | 'FIRST_EFFECT';

/** Tube material key for looking up thermal conductivity */
export type TubeMaterial =
  | 'titanium'
  | 'al_brass'
  | 'cu_ni_90_10'
  | 'cu_ni_70_30'
  | 'al_alloy'
  | 'ss_316l'
  | 'duplex_2205';

/**
 * A single stream in the H&M balance (vapor, brine, distillate, etc.)
 */
export interface MEDStream {
  /** Stream label */
  label: string;
  /** Fluid type */
  fluid: 'STEAM' | 'VAPOR' | 'BRINE' | 'SEAWATER' | 'DISTILLATE' | 'CONDENSATE' | 'VENT';
  /** Mass flow in kg/hr */
  flow: number;
  /** Temperature in °C */
  temperature: number;
  /** Specific enthalpy in kJ/kg */
  enthalpy: number;
  /** Energy flow in kW ( = flow × enthalpy / 3600 ) */
  energy: number;
  /** Salinity in ppm (0 for pure water streams) */
  salinity: number;
}

/**
 * Preheater configuration — which effect supplies vapor and how much
 */
export interface PreheaterConfig {
  /** The effect number whose vapor feeds this preheater (1-based) */
  effectNumber: number;
  /** Vapor flow diverted to preheater in kg/hr */
  vaporFlow: number;
}

/**
 * Tube specification for a class of equipment
 */
export interface TubeSpec {
  /** Outer diameter in mm */
  od: number;
  /** Wall thickness in mm */
  thickness: number;
  /** Effective tube length in m (excluding tube sheets) */
  length: number;
  /** Tube material key */
  material: TubeMaterial;
}

/**
 * Complete input set for MED plant design
 */
export interface MEDPlantInputs {
  // --- Plant configuration ---
  /** Plant type */
  plantType: MEDPlantType;
  /** Number of evaporator effects (2–16) */
  numberOfEffects: number;
  /** Preheater configurations (can be empty) */
  preheaters: PreheaterConfig[];

  // --- Capacity ---
  /** Net distillate capacity in T/h */
  capacity: number;
  /** Target GOR (informational — solver iterates steam flow to match capacity) */
  gorTarget: number;

  // --- Steam conditions ---
  /** Motive steam pressure in bar abs */
  steamPressure: number;
  /** Motive steam temperature in °C (if superheated, else leave equal to Tsat) */
  steamTemperature: number;

  // --- Seawater conditions ---
  /** Seawater intake temperature in °C */
  seawaterInletTemp: number;
  /** Maximum allowable discharge temperature in °C */
  seawaterDischargeTemp: number;
  /** Feed seawater salinity in ppm */
  seawaterSalinity: number;

  // --- Design parameters ---
  /** Top brine temperature in °C */
  topBrineTemp: number;
  /** Brine concentration factor (feedSalinity × K = maxBrineSalinity) */
  brineConcentrationFactor: number;
  /** Approach temperature to final condenser in °C (Tcw_out - Tvapor_last) */
  condenserApproachTemp: number;
  /** Distillate output temperature in °C (after final condenser) */
  distillateTemp: number;
  /** Condensate extraction point */
  condensateExtraction: CondensateExtraction;
  /** Fouling factor for evaporator in m²·°C/W */
  foulingFactor: number;

  // --- Tube specs ---
  /** Evaporator tube specification */
  evaporatorTubes: TubeSpec;
  /** Final condenser tube specification */
  condenserTubes: TubeSpec;

  // --- TVC parameters (only when plantType = 'MED_TVC') ---
  /** Motive steam pressure for TVC in bar abs */
  tvcMotivePressure?: number;
  /** Effect from which vapor is entrained (1-based) */
  tvcEntrainedEffect?: number;
}

/**
 * Result for a single evaporator effect
 */
export interface MEDEffectResult {
  /** Effect number (1 = hottest) */
  effectNumber: number;
  /** Effect operating temperature in °C (brine boiling temperature) */
  temperature: number;
  /** Saturation pressure at this temperature in bar abs */
  pressure: number;
  /** Boiling point elevation in °C */
  bpe: number;
  /** Non-equilibrium allowance in °C */
  nea: number;
  /** Temperature loss from demister/duct pressure drop in °C */
  deltaTPressureDrop: number;
  /** Net working ΔT for heat transfer in °C */
  effectiveDeltaT: number;

  // --- Streams ---
  /** Vapor entering tube side (from previous effect or steam) */
  vaporIn: MEDStream;
  /** Feed water sprayed on shell side */
  sprayWater: MEDStream;
  /** Brine entering (reserved, always null — parallel feed only) */
  brineIn: MEDStream | null;
  /** Distillate cascading in from previous effects */
  distillateIn: MEDStream | null;
  /** Condensate cascading in from previous effects */
  condensateIn: MEDStream | null;
  /** Vapor produced → next effect */
  vaporOut: MEDStream;
  /** Vapor diverted to preheater (if preheater on this effect) */
  vaporToPreheater: MEDStream | null;
  /** Brine leaving */
  brineOut: MEDStream;
  /** Accumulated distillate leaving */
  distillateOut: MEDStream;

  // --- Performance ---
  /** Heat transferred in this effect in kW */
  heatTransferred: number;
  /** Mass balance error in kg/hr (should be ≈ 0) */
  massBalance: number;
}

/**
 * Result for the final condenser
 */
export interface MEDFinalCondenserResult {
  /** Seawater in */
  seawaterIn: MEDStream;
  /** Vapor from last effect */
  vaporIn: MEDStream;
  /** Distillate entering (cascade from effects) */
  distillateIn: MEDStream | null;
  /** Condensate entering */
  condensateIn: MEDStream | null;
  /** Seawater out (heated) */
  seawaterOut: MEDStream;
  /** Distillate out (total product) */
  distillateOut: MEDStream;
  /** Condensate out */
  condensateOut: MEDStream | null;
  /** Vent out (NCG) */
  ventOut: MEDStream;
  /** Heat transferred in kW */
  heatTransferred: number;
  /** Mass balance error in kg/hr */
  massBalance: number;
}

/**
 * Result for a single preheater
 */
export interface MEDPreheaterResult {
  /** Associated effect number */
  effectNumber: number;
  /** Vapor flow condensed in preheater in kg/hr */
  vaporFlow: number;
  /** Vapor inlet temperature in °C */
  vaporTemperature: number;
  /** Seawater flow through preheater in kg/hr */
  seawaterFlow: number;
  /** Seawater inlet temperature in °C */
  seawaterInletTemp: number;
  /** Seawater outlet temperature in °C */
  seawaterOutletTemp: number;
  /** Heat exchanged in kW */
  heatExchanged: number;
  /** LMTD in °C */
  lmtd: number;
  /** Condensate produced in kg/hr */
  condensateFlow: number;
  /** Condensate temperature in °C */
  condensateTemperature: number;
}

/**
 * Overall H&M balance summary
 */
export interface MEDOverallBalance {
  /** All inlet streams */
  totalIn: { seawater: MEDStream; steam: MEDStream };
  /** All outlet streams */
  totalOut: {
    seawater: MEDStream;
    condensate: MEDStream | null;
    distillate: MEDStream;
    brine: MEDStream;
    vent: MEDStream;
  };
  /** Total energy in (kW) */
  totalEnergyIn: number;
  /** Total energy out (kW) */
  totalEnergyOut: number;
  /** Energy balance error (%) */
  energyBalanceError: number;
}

/**
 * Complete MED plant calculation result
 */
export interface MEDPlantResult {
  /** Input parameters used */
  inputs: MEDPlantInputs;
  /** Per-effect results */
  effects: MEDEffectResult[];
  /** Final condenser result */
  finalCondenser: MEDFinalCondenserResult;
  /** Preheater results (may be empty) */
  preheaters: MEDPreheaterResult[];
  /** TVC result (null for plain MED) */
  tvcResult?: {
    /** Motive steam flow in kg/hr */
    motiveFlow: number;
    /** Entrained vapor flow in kg/hr */
    entrainedFlow: number;
    /** Discharge flow in kg/hr */
    dischargeFlow: number;
    /** Entrainment ratio */
    entrainmentRatio: number;
    /** Compression ratio */
    compressionRatio: number;
    /** Whether discharge is superheated */
    isSuperheated: boolean;
    /** Desuperheating spray water flow in kg/hr (0 if saturated) */
    sprayWaterFlow: number;
    /** Vapor temperature to effect 1 in °C */
    vaporToEffect1Temp: number;
  };
  /** Overall plant balance */
  overallBalance: MEDOverallBalance;
  /** Performance summary */
  performance: {
    /** Gain Output Ratio */
    gor: number;
    /** Specific thermal energy in kJ/kg */
    specificThermalEnergy: number;
    /** Specific thermal energy in kWh/m³ */
    specificThermalEnergy_kWh: number;
    /** Gross production from effects only in T/h */
    grossProduction: number;
    /** Net production (effects + condenser) in T/h */
    netProduction: number;
    /** Steam flow in kg/hr (for MED-TVC: motive steam to TVC) */
    steamFlow: number;
    /** Motive steam flow to TVC in kg/hr (0 for plain MED) */
    motiveFlow: number;
    /** Total seawater intake in T/h */
    seawaterIntake: number;
    /** Cooling water (seawater rejected after condenser) in T/h */
    coolingWater: number;
    /** Makeup water (seawater used as feed) in T/h */
    makeupWater: number;
    /** Total brine flow in T/h */
    brineFlow: number;
    /** Brine salinity in ppm */
    brineSalinity: number;
    /** Overdesign fraction (e.g. 0.18 = 18%) */
    overdesign: number;
  };
  /** Warnings and notes */
  warnings: string[];
  /** Whether the solver converged */
  converged: boolean;
  /** Number of iterations used */
  iterations: number;
}
