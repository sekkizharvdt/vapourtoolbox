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

  /** Outlet brine nozzle velocity in m/s (typical: 1-2 m/s) */
  outletWaterVelocity: number;

  /** Vapor outlet nozzle velocity in m/s (typical: 10-30 m/s) */
  vaporVelocity: number;
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
 * NPSHa (Net Positive Suction Head Available) calculation
 */
export interface NPSHaCalculation {
  /** Static head - liquid level above pump centerline in m */
  staticHead: number;

  /** Chamber operating pressure converted to head in m */
  chamberPressureHead: number;

  /** Vapor pressure head at operating temperature in m (negative contribution) */
  vaporPressureHead: number;

  /** Estimated friction loss in suction piping in m */
  frictionLoss: number;

  /** Calculated NPSHa in m */
  npshAvailable: number;

  /** Recommended minimum NPSH margin in m (typically 1-2m above NPSHr) */
  recommendedNpshMargin: number;

  /** Recommendation text for pump selection */
  recommendation: string;
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
  sprayAngle: 60, // degrees
  inletWaterVelocity: 2.5, // m/s
  outletWaterVelocity: 1.5, // m/s
  vaporVelocity: 20, // m/s
};

// ============================================================================
// Validation Limits
// ============================================================================

/**
 * Validation limits for flash chamber inputs
 * Pressure range: 50-500 mbar abs covers ~33°C to ~81°C saturation temperatures
 */
export const FLASH_CHAMBER_LIMITS = {
  operatingPressure: { min: 50, max: 500, unit: 'mbar abs' },
  waterFlowRate: { min: 1, max: 10000, unit: 'ton/hr' }, // Base unit, converted from user selection
  vaporQuantity: { min: 0.1, max: 1000, unit: 'ton/hr' }, // Base unit, converted from user selection
  inletTemperature: { min: 40, max: 120, unit: '°C' },
  salinity: { min: 0, max: 70000, unit: 'ppm' }, // 0 for DM water, up to 70000 for brine
  retentionTime: { min: 1, max: 5, unit: 'minutes' },
  flashingZoneHeight: { min: 300, max: 1000, unit: 'mm' },
  sprayAngle: { min: 30, max: 90, unit: 'degrees' },
  inletWaterVelocity: { min: 1.5, max: 4.0, unit: 'm/s' },
  outletWaterVelocity: { min: 0.5, max: 2.5, unit: 'm/s' },
  vaporVelocity: { min: 5, max: 40, unit: 'm/s' },
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
