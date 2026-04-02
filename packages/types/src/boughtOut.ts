import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';

// ============================================================================
// Categories
// ============================================================================

/**
 * Bought-Out Item Categories
 *
 * These are PROCURED items (not manufactured in-house).
 * Each has its own typed specification interface.
 */
export type BoughtOutCategory =
  | 'PUMP'
  | 'VALVE'
  | 'INSTRUMENT'
  | 'MOTOR'
  | 'SAFETY'
  | 'GAUGE'
  | 'STEAM_TRAP'
  | 'ACCESSORY'
  | 'ELECTRICAL'
  | 'OTHER';

/**
 * Category Labels for UI
 */
export const BOUGHT_OUT_CATEGORY_LABELS: Record<BoughtOutCategory, string> = {
  PUMP: 'Pumps',
  VALVE: 'Valves',
  INSTRUMENT: 'Instruments',
  MOTOR: 'Motors',
  SAFETY: 'Safety Devices',
  GAUGE: 'Local Gauges',
  STEAM_TRAP: 'Steam Traps',
  ACCESSORY: 'Accessories',
  ELECTRICAL: 'Electrical',
  OTHER: 'Others',
};

// ============================================================================
// Specification Interfaces (one per category)
// ============================================================================

/**
 * Base Specifications shared by all categories
 */
export interface BaseSpecs {
  manufacturer?: string;
  model?: string;
  notes?: string;
  /** Material references: IDs from the materials collection */
  materialRefs?: {
    /** Primary construction material (body, casing, housing) */
    bodyMaterialId?: string;
    /** Secondary material (trim, impeller, wetted parts) */
    trimMaterialId?: string;
    /** Additional material references */
    otherMaterialIds?: string[];
  };
}

/**
 * Pump Specifications
 * Covers: centrifugal, positive displacement, dosing pumps
 */
export interface PumpSpecs extends BaseSpecs {
  pumpType?: 'CENTRIFUGAL' | 'GEAR' | 'DIAPHRAGM' | 'SCREW' | 'RECIPROCATING' | 'DOSING';
  /** Design flow rate in m³/h */
  flowRate?: number;
  /** Design head in metres */
  head?: number;
  /** NPSH required in metres */
  npshr?: number;
  /** Shaft power in kW */
  power?: number;
  /** Pump efficiency % */
  efficiency?: number;
  /** Speed in RPM */
  rpm?: number;
  /** Number of stages */
  stages?: number;
  /** Casing material description */
  casingMaterial?: string;
  /** Impeller material description */
  impellerMaterial?: string;
  /** Seal type */
  sealType?: 'MECHANICAL' | 'GLAND_PACKING' | 'SEALLESS' | 'MAGNETIC_DRIVE' | 'DIAPHRAGM';
  /** Design standard */
  standard?: string; // API 610, API 685, ISO 2858
  /** Suction connection */
  suctionSize?: string; // DN50, 2"
  /** Discharge connection */
  dischargeSize?: string;
  /** End connection type */
  endConnection?: 'FLANGED' | 'THREADED' | 'TRI_CLAMP';
  /** Fluid service description */
  service?: string;
  /** Fluid temperature range °C */
  temperatureRange?: string;
  /** Maximum allowable working pressure in bar */
  mawp?: number;
}

/**
 * Motor Specifications
 * Covers: electric motors for pumps, fans, compressors
 */
export interface MotorSpecs extends BaseSpecs {
  motorType?: 'INDUCTION' | 'SYNCHRONOUS' | 'DC' | 'SERVO';
  /** Rated power in kW */
  ratedPowerKW?: number;
  /** Voltage (V) */
  voltage?: number;
  /** Frequency (Hz) */
  frequency?: 50 | 60;
  /** Phase */
  phase?: '1' | '3';
  /** Speed RPM */
  rpm?: number;
  /** Number of poles */
  poles?: number;
  /** Frame size (IEC or NEMA) */
  frameSize?: string;
  /** Enclosure protection */
  ipRating?: string; // IP55, IP65
  /** Insulation class */
  insulationClass?: 'B' | 'F' | 'H';
  /** Efficiency class */
  efficiencyClass?: 'IE1' | 'IE2' | 'IE3' | 'IE4';
  /** Mounting */
  mounting?: 'B3' | 'B5' | 'B35' | 'V1';
  /** Variable speed drive required */
  vfd?: boolean;
  /** Hazardous area classification */
  hazardousArea?: string; // Ex e IIC T3, Zone 1
  /** Ambient temperature °C */
  ambientTemp?: number;
  /** Duty cycle */
  dutyCycle?: 'S1' | 'S2' | 'S3'; // Continuous, short time, intermittent
}

/**
 * Valve Specifications
 * Covers: gate, globe, ball, butterfly, check, control valves
 */
export interface ValveSpecs extends BaseSpecs {
  valveType?:
    | 'GATE'
    | 'GLOBE'
    | 'BALL'
    | 'BUTTERFLY'
    | 'CHECK_SWING'
    | 'CHECK_DUAL_PLATE'
    | 'CHECK_LIFT'
    | 'PLUG'
    | 'NEEDLE'
    | 'DIAPHRAGM'
    | 'CONTROL';
  /** Nominal size */
  size?: string; // DN50, 2"
  /** Pressure rating */
  pressureRating?: string; // PN10, PN16, 150#, 300#
  /** Body material description */
  bodyMaterial?: string; // CF8M, A216 WCB, Duplex SS
  /** Trim material description */
  trimMaterial?: string; // SS316, Stellite, Monel
  /** Seat material */
  seatMaterial?: string; // PTFE, Metal-to-metal, RPTFE
  /** End connection */
  endConnection?:
    | 'FLANGED_RF'
    | 'FLANGED_FF'
    | 'BUTT_WELD'
    | 'SOCKET_WELD'
    | 'THREADED'
    | 'WAFER'
    | 'LUG';
  /** Operation type */
  operation?: 'MANUAL' | 'GEAR' | 'PNEUMATIC' | 'ELECTRIC' | 'HYDRAULIC' | 'SELF_ACTUATED';
  /** Design standard */
  designStandard?: string; // API 600, API 602, ASME B16.34, BS 1868
  /** Flow coefficient */
  cv?: number;
  /** Bore type */
  bore?: 'FULL' | 'REDUCED';
  /** Fire safe certification */
  fireSafe?: boolean;
  /** Fugitive emission certification */
  fugitiveEmission?: boolean;
  /** Actuator fail position (for control/actuated) */
  failPosition?: 'OPEN' | 'CLOSE' | 'LAST';
}

/**
 * Safety Device Specifications
 * Covers: PSV, rupture disc, vacuum breaker
 */
export interface SafetySpecs extends BaseSpecs {
  deviceType?:
    | 'PSV_SPRING'
    | 'PSV_PILOT'
    | 'RUPTURE_DISC'
    | 'VACUUM_BREAKER'
    | 'PRESSURE_REGULATOR';
  /** Inlet size */
  inletSize?: string;
  /** Outlet size */
  outletSize?: string;
  /** Set pressure in bar(g) */
  setPressure?: number;
  /** Full lift pressure in bar(g) */
  fullLiftPressure?: number;
  /** Relieving capacity */
  capacity?: number;
  /** Capacity unit */
  capacityUnit?: 'kg/h' | 'm3/h' | 'Nm3/h';
  /** Body material */
  bodyMaterial?: string;
  /** Disc/seat material */
  discMaterial?: string;
  /** Inlet connection */
  inletConnection?: string;
  /** Outlet connection */
  outletConnection?: string;
  /** Design standard */
  standard?: string; // API 526, ASME VIII
  /** Burst pressure (rupture disc) */
  burstPressure?: number;
}

/**
 * Instrument Specifications
 * Covers: transmitters (TT, PT, FT, LT), switches, analysers
 */
export interface InstrumentSpecs extends BaseSpecs {
  instrumentType?: 'TRANSMITTER' | 'SWITCH' | 'ANALYSER' | 'INDICATOR' | 'RECORDER' | 'CONTROLLER';
  /** Measured variable */
  variable?:
    | 'PRESSURE'
    | 'TEMPERATURE'
    | 'FLOW'
    | 'LEVEL'
    | 'CONDUCTIVITY'
    | 'PH'
    | 'TURBIDITY'
    | 'DISSOLVED_O2';
  /** Measurement range minimum */
  rangeMin?: number;
  /** Measurement range maximum */
  rangeMax?: number;
  /** Range unit */
  unit?: string;
  /** Accuracy specification */
  accuracy?: string; // ±0.075%, ±0.1°C
  /** Output signal */
  outputSignal?:
    | '4_20MA'
    | '4_20MA_HART'
    | 'FOUNDATION_FIELDBUS'
    | 'PROFIBUS'
    | 'MODBUS'
    | 'DIGITAL';
  /** Process connection */
  processConnection?: string; // ½" NPT, DN50 flanged
  /** Enclosure rating */
  enclosureRating?: string; // IP65, IP67, NEMA 4X
  /** Wetted parts material */
  wettedPartsMaterial?: string; // SS316L, Hastelloy C-276, Ti
  /** Power supply */
  powerSupply?: string; // 24VDC, loop powered
  /** Hazardous area */
  hazardousArea?: string; // Ex ia IIC T4
  /** Sensor type (for temperature) */
  sensorType?: string; // PT100, K-type thermocouple
  /** Thermowell required */
  thermowellRequired?: boolean;
  /** Flow meter type (for flow) */
  flowMeterType?:
    | 'ELECTROMAGNETIC'
    | 'VORTEX'
    | 'CORIOLIS'
    | 'ULTRASONIC'
    | 'ORIFICE'
    | 'ROTAMETER';
  /** Level measurement type */
  levelType?: 'DP' | 'RADAR' | 'ULTRASONIC' | 'CAPACITANCE' | 'FLOAT' | 'MAGNETIC';
}

/**
 * Local Gauge Specifications (not transmitters — local indication only)
 * Covers: pressure gauges, temperature gauges, level gauges, sight glasses
 */
export interface GaugeSpecs extends BaseSpecs {
  gaugeType?:
    | 'PRESSURE'
    | 'TEMPERATURE'
    | 'LEVEL_MAGNETIC'
    | 'LEVEL_TUBULAR'
    | 'SIGHT_GLASS'
    | 'FLOW_INDICATOR';
  /** Dial size in mm (for pressure/temperature gauges) */
  dialSize?: number; // 100, 150
  /** Range */
  range?: string; // 0-10 bar, 0-100°C
  /** Connection */
  connection?: string; // ½" NPT, M20×1.5
  /** Mounting */
  mounting?: 'BOTTOM' | 'BACK' | 'PANEL' | 'FLANGED';
  /** Wetted material */
  wettedMaterial?: string;
  /** Case material */
  caseMaterial?: string; // SS304, Phenolic
  /** Accuracy class */
  accuracyClass?: string; // 1.0, 1.6 (EN 837)
  /** Filled (glycerine) */
  liquidFilled?: boolean;
}

/**
 * Steam Trap Specifications
 */
export interface SteamTrapSpecs extends BaseSpecs {
  trapType?: 'FLOAT' | 'THERMODYNAMIC' | 'THERMOSTATIC' | 'INVERTED_BUCKET';
  /** Connection size */
  size?: string;
  /** Pressure rating */
  pressureRating?: string;
  /** Body material */
  bodyMaterial?: string;
  /** End connection */
  endConnection?: 'THREADED' | 'FLANGED' | 'SOCKET_WELD';
  /** Max differential pressure bar */
  maxDifferentialPressure?: number;
  /** Condensate capacity kg/h */
  condensateCapacity?: number;
}

/**
 * Accessory Specifications
 * Covers: sight glasses, flexible hoses, expansion joints, cable trays, etc.
 */
export interface AccessorySpecs extends BaseSpecs {
  accessoryType?:
    | 'SIGHT_GLASS'
    | 'FLEXIBLE_HOSE'
    | 'EXPANSION_JOINT'
    | 'CABLE_TRAY'
    | 'PIPE_SUPPORT'
    | 'STRAINER_BASKET'
    | 'STRAINER_Y'
    | 'SILENCER';
  size?: string;
  material?: string;
  pressureRating?: string;
  endConnection?: string;
  specification?: string;
}

/**
 * Electrical Specifications
 * Covers: switchgear, MCCs, cables, transformers, UPS
 */
export interface ElectricalSpecs extends BaseSpecs {
  electricalType?:
    | 'MCC'
    | 'SWITCHGEAR'
    | 'CABLE'
    | 'TRANSFORMER'
    | 'UPS'
    | 'JUNCTION_BOX'
    | 'CABLE_TRAY';
  /** Voltage rating */
  voltage?: string;
  /** Power rating kW or kVA */
  powerRating?: string;
  /** Frequency Hz */
  frequency?: string;
  /** Phase */
  phase?: string;
  /** IP rating */
  ipRating?: string;
  /** Cable size (for cables) */
  cableSize?: string; // 4×2.5mm², 2×1.5mm²
  /** Cable type */
  cableType?: string; // XLPE, PVC, armoured
  /** Length in metres (for cables) */
  lengthM?: number;
}

/**
 * Other/General Specifications
 */
export interface OtherSpecs extends BaseSpecs {
  specification?: string;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Union of all specification types — discriminated by BoughtOutCategory
 */
export type BoughtOutSpecifications =
  | PumpSpecs
  | MotorSpecs
  | ValveSpecs
  | SafetySpecs
  | InstrumentSpecs
  | GaugeSpecs
  | SteamTrapSpecs
  | AccessorySpecs
  | ElectricalSpecs
  | OtherSpecs;

/**
 * Map category → specification type (for type-safe forms)
 */
export type SpecsForCategory<C extends BoughtOutCategory> = C extends 'PUMP'
  ? PumpSpecs
  : C extends 'MOTOR'
    ? MotorSpecs
    : C extends 'VALVE'
      ? ValveSpecs
      : C extends 'SAFETY'
        ? SafetySpecs
        : C extends 'INSTRUMENT'
          ? InstrumentSpecs
          : C extends 'GAUGE'
            ? GaugeSpecs
            : C extends 'STEAM_TRAP'
              ? SteamTrapSpecs
              : C extends 'ACCESSORY'
                ? AccessorySpecs
                : C extends 'ELECTRICAL'
                  ? ElectricalSpecs
                  : OtherSpecs;

// ============================================================================
// Bought-Out Item Entity
// ============================================================================

/**
 * Bought-Out Item Interface
 *
 * Represents a procured item with its full engineering specification.
 * References the materials collection for construction materials.
 */
export interface BoughtOutItem extends TimestampFields {
  id: string;
  tenantId: string;

  // Basic Info
  itemCode: string; // Auto-generated: BO-YYYY-NNNN
  name: string;
  description?: string;
  category: BoughtOutCategory;

  // Specifications - Dynamic based on category
  specifications: BoughtOutSpecifications;

  // Pricing
  pricing: {
    listPrice: Money;
    currency: CurrencyCode;
    leadTime?: number; // Days
    moq?: number; // Minimum order quantity
    vendorId?: string; // Link to entity
    lastUpdated: Timestamp;
  };

  // Documentation
  attachments?: {
    datasheetUrl?: string;
    catalogUrl?: string;
    drawingUrl?: string;
    certificationUrl?: string;
    testReportUrl?: string;
  };

  // Metadata
  tags?: string[];
  isActive: boolean;
  /** Link to project (if project-specific item) */
  projectId?: string;

  // Audit
  createdBy: string;
  updatedBy: string;
}

// ============================================================================
// CRUD Input Types
// ============================================================================

/**
 * Input for creating a new Bought-Out Item
 */
export interface CreateBoughtOutItemInput {
  tenantId: string;
  name: string;
  description?: string;
  category: BoughtOutCategory;
  specifications: BoughtOutSpecifications;
  pricing: Omit<BoughtOutItem['pricing'], 'lastUpdated'>;
  attachments?: BoughtOutItem['attachments'];
  tags?: string[];
  projectId?: string;
}

/**
 * Input for updating a Bought-Out Item
 */
export interface UpdateBoughtOutItemInput {
  name?: string;
  description?: string;
  category?: BoughtOutCategory;
  specifications?: Partial<BoughtOutSpecifications>;
  pricing?: Partial<Omit<BoughtOutItem['pricing'], 'lastUpdated'>>;
  attachments?: Partial<BoughtOutItem['attachments']>;
  tags?: string[];
  isActive?: boolean;
}

/**
 * Options for listing Bought-Out Items
 */
export interface ListBoughtOutItemsOptions {
  tenantId: string;
  category?: BoughtOutCategory;
  isActive?: boolean;
  limit?: number;
  startAfter?: string; // For pagination
  projectId?: string;
}
