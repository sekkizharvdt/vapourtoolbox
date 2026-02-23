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
 * Water type for flash chamber calculation
 * - SEAWATER: Seawater with salinity (default 35000 ppm)
 * - DM_WATER: Demineralized/pure water (salinity = 0)
 */
export type FlashChamberWaterType = 'SEAWATER' | 'DM_WATER';

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

  /** Vapor velocity status indicator */
  vaporVelocityStatus: 'OK' | 'HIGH' | 'VERY_HIGH';

  /** Vapor loading - vapor flow rate per unit cross-section area in ton/hr/m² */
  vaporLoading: number;
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
  calculatorType: 'SIPHON_SIZING' | 'SIPHON_SIZING_BATCH' | 'FLASH_CHAMBER';
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
