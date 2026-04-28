/**
 * Material Database Module Types
 * Comprehensive types for managing raw materials, bought-out components, and consumables
 * Compliant with ASME/ASTM standards
 */

import type { Timestamp } from 'firebase/firestore';
import type { Money, CurrencyCode } from './common';

// ============================================================================
// Core Material Types
// ============================================================================

/**
 * Main Material entity representing materials database
 */
export interface Material {
  // Identity
  id: string;
  materialCode: string; // Format: PL-SS-304 (Form-Material-Grade)
  customCode?: string; // User-defined code or legacy code
  name: string; // e.g., "Stainless Steel 316L Plate"
  description: string; // Detailed description

  // Classification
  category: MaterialCategory;
  subCategory?: string; // e.g., "Plates", "Pipes", "Fasteners"
  materialType: MaterialType;

  // Specifications (ASME/ASTM Standards)
  specification: MaterialSpecification;

  // Physical Properties (for non-variant materials)
  properties: MaterialProperties;

  // Variants Support (NEW - for materials with size/thickness variations)
  hasVariants: boolean; // True if material has thickness/size variants
  variants?: MaterialVariant[]; // Array of variants (e.g., different thicknesses)

  // Unit of Measurement
  baseUnit: string; // e.g., "kg", "nos", "meter", "liter"
  alternateUnits?: UnitConversion[]; // e.g., kg ↔ ton, meter ↔ feet

  // Procurement
  preferredVendors: string[]; // Array of vendor entity IDs
  leadTimeDays?: number; // Typical lead time
  minimumOrderQuantity?: number;

  // Pricing
  currentPrice?: MaterialPrice; // Latest price (denormalized)
  priceHistory: string[]; // References to MaterialPrice document IDs

  // Stock Management (Optional)
  trackInventory: boolean;
  currentStock?: number;
  reorderLevel?: number;
  reorderQuantity?: number;

  // Documentation
  datasheetUrl?: string; // Link to datasheet document
  imageUrl?: string; // Material image
  certifications?: string[]; // e.g., "EN 10204 3.1", "Mill Test Certificate"

  // Search & Organization
  tags: string[]; // Searchable tags
  isActive: boolean; // Soft delete flag
  isStandard: boolean; // Frequently used material

  // Substitution
  substituteMaterials?: string[]; // Alternative material IDs
  substituteNotes?: string; // When to use substitutes

  // Equipment specification — populated for valves, pumps, and instruments.
  // The deterministic equipment-code generator uses this block as input
  // (see `generateEquipmentCode`); auto-creation flows from the AI quote
  // parser stash the structured spec here too. Plates/pipes/flanges/etc
  // continue to use `specification` (grade/standard/etc).
  equipmentSpec?: EquipmentSpec;

  // Auto-creation review flag. Set `true` when a material is created
  // automatically from a parsed vendor quote — a human should look it
  // over (verify the spec extraction was accurate) and clear the flag.
  // Materials list/picker UIs surface this as a "Review" badge.
  needsReview?: boolean;

  // Piping Dimensions (for flanges, pipes, fittings — flat model, no variants)
  nps?: string; // Nominal Pipe Size: "1/2", "2", "4"
  dn?: string; // DN metric designation: "15", "50", "100"
  pressureClass?: string; // Flanges: "150#", "300#", "600#"
  schedule?: string; // Pipes: "10", "40", "80", "STD", "XS"
  fittingType?: string; // Fittings: "90° Elbow Long Radius", "Tee"

  // Engineering Data (piping)
  outsideDiameter_mm?: number; // OD in mm
  wallThickness_mm?: number; // Pipes: wall thickness in mm
  thickness_mm?: number; // Flanges: flange thickness in mm
  boltCircle_mm?: number; // Flanges: bolt circle diameter
  boltHoles?: number; // Flanges: number of bolt holes
  boltSize_inch?: string; // Flanges: bolt size e.g. "5/8"
  raisedFace_mm?: number; // Flanges: raised face height
  centerToEnd_mm?: number; // Fittings: center-to-end dimension
  weightPerPiece_kg?: number; // Flanges, fittings: weight per piece
  weightPerMeter_kg?: number; // Pipes: weight per meter

  // Family Grouping (groups all sizes/ratings of same base material)
  familyCode?: string; // e.g. "FL-WN-CS-A105" for all WN flanges CS A105

  // Migration flag (old subcollection-based parent docs)
  isMigrated?: boolean;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  lastPriceUpdate?: Timestamp;
}

/**
 * Material Variant (for materials with size/thickness variations)
 * Example: Different thicknesses of same grade plate
 */
export interface MaterialVariant {
  id: string; // Unique variant ID
  variantCode: string; // e.g., "3MM", "5MM", "10MM", "SCH40"
  displayName: string; // e.g., "3mm thickness", "Schedule 40"

  // Dimensional Properties (vary by variant)
  dimensions: {
    thickness?: number; // mm (for plates, sheets)
    length?: number; // mm
    width?: number; // mm
    diameter?: number; // mm (for pipes, rods)
    schedule?: string; // For pipes: "Sch 10", "Sch 40", etc.
    nominalSize?: string; // DN/NPS for pipes/fittings
  };

  // Weight per unit (varies with dimensions)
  weightPerUnit?: number; // kg/m² for plates, kg/m for pipes

  // Variant-specific procurement
  preferredVendors?: string[]; // Can differ by size
  leadTimeDays?: number; // Lead time for this specific size
  minimumOrderQuantity?: number;

  // Variant-specific pricing
  currentPrice?: MaterialPrice;
  priceHistory: string[]; // MaterialPrice document IDs

  // Variant-specific stock (if tracked)
  currentStock?: number;
  reorderLevel?: number;
  reorderQuantity?: number;

  // Availability
  isAvailable: boolean; // In stock or orderable
  discontinuedDate?: Timestamp; // If variant discontinued

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * Material type classification
 */
export type MaterialType = 'RAW_MATERIAL' | 'BOUGHT_OUT_COMPONENT' | 'CONSUMABLE' | 'EQUIPMENT';

/**
 * Material specification details (ASME/ASTM Standards)
 */
export interface MaterialSpecification {
  standard?: string; // e.g., "ASTM A240", "IS 2062", "DIN 17440"
  grade?: string; // e.g., "316L", "304", "A36"
  finish?: string; // e.g., "2B", "BA", "No. 4"
  form?: string; // e.g., "Plate", "Sheet", "Bar", "Rod"
  schedule?: string; // For pipes: "Sch 10", "Sch 40", "Sch 80", etc.
  nominalSize?: string; // For pipes/fittings: "DN 50", "NPS 2"
  customSpecs?: string; // Additional specifications
}

// ============================================================================
// Equipment Specification (valves, pumps, instruments)
// ============================================================================

/**
 * Per-family attributes that drive deterministic equipment material codes.
 *
 * Format conventions (the code generator depends on these short codes):
 *   Valves:      `VLV-{TYPE}-{MATL}-{SIZE}-{RATING}-{ACT}`
 *   Pumps:       `PUMP-{TYPE}-{FLOW}M3H-{HEAD}M`
 *   Instruments: `INST-{SUBTYPE}-{seq}`
 *
 * Same spec → same code, every time. Two parsed valve lines with identical
 * (type, material, size, rating, actuation) collapse to one material record.
 */
export interface EquipmentSpec {
  family: 'VALVE' | 'PUMP' | 'INSTRUMENT';

  // --- Valves ---
  valveType?: 'GATE' | 'GLOBE' | 'BALL' | 'BUTTERFLY' | 'CHECK' | 'OTHER';
  /** Body material grade. Short form used in the code: SS316, SS304, CS, CI, DI, BRZ. */
  valveMaterial?: string;
  /** Free-text size — the code uses it verbatim, e.g. `DN50`, `2IN`, `100MM`. */
  valveSize?: string;
  /** Pressure class or PN rating — `150`, `300`, `600`, `PN16`, `PN25`. */
  valveRating?: string;
  valveActuation?: 'MAN' | 'PNE' | 'ELE' | 'HYD';

  // --- Pumps ---
  pumpType?: 'CF' | 'PD' | 'OTHER';
  /** Flow rate in m³/hr. Standardized — codes use `{N}M3H`. */
  pumpFlowM3H?: number;
  /** Head in metres. Codes use `{N}M`. */
  pumpHeadM?: number;

  // --- Instruments ---
  /** Short subtype used in the code: PG, TS, FM, LT, CV, OTH. */
  instrumentSubtype?: string;
}

// ============================================================================
// Material Categories (ASME/ASTM Standards)
// ============================================================================

export enum MaterialCategory {
  // Raw Materials - Plates (ASME/ASTM Standards)
  PLATES_CARBON_STEEL = 'PLATES_CARBON_STEEL', // ASTM A36, A516, etc.
  PLATES_STAINLESS_STEEL = 'PLATES_STAINLESS_STEEL', // ASTM A240 (304, 316, etc.)
  PLATES_DUPLEX_STEEL = 'PLATES_DUPLEX_STEEL', // ASTM A240 (2205, 2507, etc.)
  PLATES_ALLOY_STEEL = 'PLATES_ALLOY_STEEL', // ASTM A387, etc.

  // Raw Materials - Pipes (ASME/ASTM by Material and Schedule)
  PIPES_CARBON_STEEL = 'PIPES_CARBON_STEEL', // ASTM A106 (Seamless), A53 (Welded) - Sch 10, 40, 80
  PIPES_STAINLESS_304L = 'PIPES_STAINLESS_304L', // ASTM A312 Grade 304L (Seamless/Welded) - Sch 10S, 40S, 80S
  PIPES_STAINLESS_316L = 'PIPES_STAINLESS_316L', // ASTM A312 Grade 316L (Seamless/Welded) - Sch 10S, 40S, 80S
  PIPES_ALLOY_STEEL = 'PIPES_ALLOY_STEEL', // ASTM A335 (P11, P22, P91) - Sch 40, 80, 160
  PIPES_DUPLEX_2205 = 'PIPES_DUPLEX_2205', // ASTM A790 UNS S31803 - Sch 10, 20, 40, 60, 80
  PIPES_SUPER_DUPLEX_2507 = 'PIPES_SUPER_DUPLEX_2507', // ASTM A790 UNS S32750 - Sch 10, 20, 40, 60, 80

  // Bought-Out Components - Fittings (ASME B16.9, B16.11)
  FITTINGS_BUTT_WELD = 'FITTINGS_BUTT_WELD', // ASME B16.9 (Elbows, Tees, Reducers)
  FITTINGS_SOCKET_WELD = 'FITTINGS_SOCKET_WELD', // ASME B16.11
  FITTINGS_THREADED = 'FITTINGS_THREADED', // ASME B16.11
  FITTINGS_FLANGED = 'FITTINGS_FLANGED', // ASME B16.5 (Elbows, Tees)

  // Bought-Out Components - Fasteners (ASME/ASTM Standards)
  FASTENERS_BOLTS = 'FASTENERS_BOLTS', // ASTM A193, A320 (Hex bolts, Stud bolts)
  FASTENERS_NUTS = 'FASTENERS_NUTS', // ASTM A194 (Hex nuts, Heavy hex nuts)
  FASTENERS_WASHERS = 'FASTENERS_WASHERS', // ASME B18.21.1 (Flat, Lock, Spring)
  FASTENERS_BOLT_NUT_WASHER_SETS = 'FASTENERS_BOLT_NUT_WASHER_SETS', // Complete sets
  FASTENERS_STUDS = 'FASTENERS_STUDS', // ASTM A193 (Threaded rods)
  FASTENERS_SCREWS = 'FASTENERS_SCREWS', // ASME B18.3 (Cap screws, Set screws)

  // Bought-Out Components - Valves (ASME B16.34)
  VALVE_GATE = 'VALVE_GATE', // Gate valves (OS&Y, Rising stem)
  VALVE_GLOBE = 'VALVE_GLOBE', // Globe valves (Angle, Straight)
  VALVE_BALL = 'VALVE_BALL', // Ball valves (Full port, Reduced port)
  VALVE_BUTTERFLY = 'VALVE_BUTTERFLY', // Butterfly valves (Wafer, Lug, Flanged)
  VALVE_CHECK = 'VALVE_CHECK', // Check valves (Swing, Lift, Tilting disc)
  VALVE_OTHER = 'VALVE_OTHER', // Plug, Diaphragm, Needle valves

  // Bought-Out Components - Pumps
  PUMP_CENTRIFUGAL = 'PUMP_CENTRIFUGAL', // End suction, Split case, Multistage
  PUMP_POSITIVE_DISPLACEMENT = 'PUMP_POSITIVE_DISPLACEMENT', // Gear, Lobe, Screw, Diaphragm

  // Bought-Out Components - Instrumentation
  INSTRUMENT_PRESSURE_GAUGE = 'INSTRUMENT_PRESSURE_GAUGE', // Analog, Digital, Differential
  INSTRUMENT_TEMPERATURE_SENSOR = 'INSTRUMENT_TEMPERATURE_SENSOR', // RTD, Thermocouple, Thermometer
  INSTRUMENT_FLOW_METER = 'INSTRUMENT_FLOW_METER', // Orifice, Magnetic, Vortex, Ultrasonic
  INSTRUMENT_LEVEL_TRANSMITTER = 'INSTRUMENT_LEVEL_TRANSMITTER', // Radar, Ultrasonic, Capacitance
  INSTRUMENT_CONTROL_VALVE = 'INSTRUMENT_CONTROL_VALVE', // Pneumatic, Electric actuators
  INSTRUMENT_OTHER = 'INSTRUMENT_OTHER', // Switches, Indicators, Analyzers

  // Instrumentation Accessories
  INSTRUMENT_ACCESSORY_THERMOWELL = 'INSTRUMENT_ACCESSORY_THERMOWELL', // SS316L, Ti, Duplex
  INSTRUMENT_ACCESSORY_CABLE_GLAND = 'INSTRUMENT_ACCESSORY_CABLE_GLAND', // Brass, SS, IP68
  INSTRUMENT_ACCESSORY_MANIFOLD = 'INSTRUMENT_ACCESSORY_MANIFOLD', // 3-valve, 5-valve
  INSTRUMENT_ACCESSORY_FERRULE = 'INSTRUMENT_ACCESSORY_FERRULE', // Bootlace, ring, pin
  INSTRUMENT_ACCESSORY_JUNCTION_BOX = 'INSTRUMENT_ACCESSORY_JUNCTION_BOX', // IP65/66, SS/GRP

  // Desalination-Specific Components
  RUBBER_GROMMET = 'RUBBER_GROMMET', // EPDM/Neoprene, tube fixing for MED evaporators
  DEMISTER_PAD = 'DEMISTER_PAD', // Wire mesh (SS316), vane type, structured packing
  SPRAY_NOZZLE = 'SPRAY_NOZZLE', // Full cone, hollow cone, Ti Gr2 / SS316L
  EXPANSION_BELLOWS = 'EXPANSION_BELLOWS', // Rubber/metallic, flanged, for thermal movement

  // Bought-Out Components - Other
  FLANGES = 'FLANGES', // ASME B16.5, B16.47 (Slip-on, Weld neck, Blind)
  FLANGES_WELD_NECK = 'FLANGES_WELD_NECK', // ASME B16.5 (Weld Neck Flanges)
  FLANGES_SLIP_ON = 'FLANGES_SLIP_ON', // ASME B16.5 (Slip-On Flanges)
  FLANGES_BLIND = 'FLANGES_BLIND', // ASME B16.5 (Blind Flanges)
  GASKETS = 'GASKETS', // ASME B16.20, B16.21
  MOTORS = 'MOTORS',
  STRAINERS = 'STRAINERS', // Y-type, Basket, Duplex strainers
  SEPARATORS = 'SEPARATORS', // Demisters, Grommets
  ELECTRICAL = 'ELECTRICAL',

  // Other Metals
  BARS_AND_RODS = 'BARS_AND_RODS', // ASTM A276 (SS bars), A36 (CS bars)
  SHEETS = 'SHEETS', // ASTM A240, A167
  STRUCTURAL_SHAPES = 'STRUCTURAL_SHAPES', // ASTM A992 (I-beams, Channels, Angles)

  // Plastics & Polymers
  PLASTICS = 'PLASTICS',
  RUBBER = 'RUBBER',
  COMPOSITES = 'COMPOSITES',

  // Consumables
  WELDING_CONSUMABLES = 'WELDING_CONSUMABLES', // AWS D1.1 (Electrodes, Filler wire)
  PAINTS_COATINGS = 'PAINTS_COATINGS',
  LUBRICANTS = 'LUBRICANTS',
  CHEMICALS = 'CHEMICALS',

  // Other
  OTHER = 'OTHER',
}

/**
 * Helper to get display name for material category
 */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: 'Plates - Carbon Steel',
  [MaterialCategory.PLATES_STAINLESS_STEEL]: 'Plates - Stainless Steel',
  [MaterialCategory.PLATES_DUPLEX_STEEL]: 'Plates - Duplex Steel',
  [MaterialCategory.PLATES_ALLOY_STEEL]: 'Plates - Alloy Steel',
  [MaterialCategory.PIPES_CARBON_STEEL]: 'Pipes - Carbon Steel',
  [MaterialCategory.PIPES_STAINLESS_304L]: 'Pipes - Stainless Steel 304L',
  [MaterialCategory.PIPES_STAINLESS_316L]: 'Pipes - Stainless Steel 316L',
  [MaterialCategory.PIPES_ALLOY_STEEL]: 'Pipes - Alloy Steel',
  [MaterialCategory.PIPES_DUPLEX_2205]: 'Pipes - Duplex 2205',
  [MaterialCategory.PIPES_SUPER_DUPLEX_2507]: 'Pipes - Super Duplex 2507',
  [MaterialCategory.FITTINGS_BUTT_WELD]: 'Fittings - Butt Weld',
  [MaterialCategory.FITTINGS_SOCKET_WELD]: 'Fittings - Socket Weld',
  [MaterialCategory.FITTINGS_THREADED]: 'Fittings - Threaded',
  [MaterialCategory.FITTINGS_FLANGED]: 'Fittings - Flanged',
  [MaterialCategory.FASTENERS_BOLTS]: 'Fasteners - Bolts',
  [MaterialCategory.FASTENERS_NUTS]: 'Fasteners - Nuts',
  [MaterialCategory.FASTENERS_WASHERS]: 'Fasteners - Washers',
  [MaterialCategory.FASTENERS_BOLT_NUT_WASHER_SETS]: 'Fasteners - Complete Sets',
  [MaterialCategory.FASTENERS_STUDS]: 'Fasteners - Studs',
  [MaterialCategory.FASTENERS_SCREWS]: 'Fasteners - Screws',
  [MaterialCategory.VALVE_GATE]: 'Valve - Gate',
  [MaterialCategory.VALVE_GLOBE]: 'Valve - Globe',
  [MaterialCategory.VALVE_BALL]: 'Valve - Ball',
  [MaterialCategory.VALVE_BUTTERFLY]: 'Valve - Butterfly',
  [MaterialCategory.VALVE_CHECK]: 'Valve - Check',
  [MaterialCategory.VALVE_OTHER]: 'Valve - Other',
  [MaterialCategory.PUMP_CENTRIFUGAL]: 'Pump - Centrifugal',
  [MaterialCategory.PUMP_POSITIVE_DISPLACEMENT]: 'Pump - Positive Displacement',
  [MaterialCategory.INSTRUMENT_PRESSURE_GAUGE]: 'Instrument - Pressure Gauge',
  [MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR]: 'Instrument - Temperature Sensor',
  [MaterialCategory.INSTRUMENT_FLOW_METER]: 'Instrument - Flow Meter',
  [MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER]: 'Instrument - Level Transmitter',
  [MaterialCategory.INSTRUMENT_CONTROL_VALVE]: 'Instrument - Control Valve',
  [MaterialCategory.INSTRUMENT_OTHER]: 'Instrument - Other',
  [MaterialCategory.INSTRUMENT_ACCESSORY_THERMOWELL]: 'Thermowell',
  [MaterialCategory.INSTRUMENT_ACCESSORY_CABLE_GLAND]: 'Cable Gland',
  [MaterialCategory.INSTRUMENT_ACCESSORY_MANIFOLD]: 'Valve Manifold',
  [MaterialCategory.INSTRUMENT_ACCESSORY_FERRULE]: 'Ferrule / Lug',
  [MaterialCategory.INSTRUMENT_ACCESSORY_JUNCTION_BOX]: 'Junction Box',
  [MaterialCategory.RUBBER_GROMMET]: 'Rubber Grommet',
  [MaterialCategory.DEMISTER_PAD]: 'Demister Pad',
  [MaterialCategory.SPRAY_NOZZLE]: 'Spray Nozzle',
  [MaterialCategory.EXPANSION_BELLOWS]: 'Expansion Bellows',
  [MaterialCategory.FLANGES]: 'Flanges',
  [MaterialCategory.FLANGES_WELD_NECK]: 'Flanges - Weld Neck',
  [MaterialCategory.FLANGES_SLIP_ON]: 'Flanges - Slip-On',
  [MaterialCategory.FLANGES_BLIND]: 'Flanges - Blind',
  [MaterialCategory.GASKETS]: 'Gaskets',
  [MaterialCategory.MOTORS]: 'Motors',
  [MaterialCategory.STRAINERS]: 'Strainers & Filters',
  [MaterialCategory.SEPARATORS]: 'Separators & Demisters',
  [MaterialCategory.ELECTRICAL]: 'Electrical',
  [MaterialCategory.BARS_AND_RODS]: 'Bars and Rods',
  [MaterialCategory.SHEETS]: 'Sheets',
  [MaterialCategory.STRUCTURAL_SHAPES]: 'Structural Shapes',
  [MaterialCategory.PLASTICS]: 'Plastics',
  [MaterialCategory.RUBBER]: 'Rubber',
  [MaterialCategory.COMPOSITES]: 'Composites',
  [MaterialCategory.WELDING_CONSUMABLES]: 'Welding Consumables',
  [MaterialCategory.PAINTS_COATINGS]: 'Paints & Coatings',
  [MaterialCategory.LUBRICANTS]: 'Lubricants',
  [MaterialCategory.CHEMICALS]: 'Chemicals',
  [MaterialCategory.OTHER]: 'Other',
};

/**
 * Grouped categories for UI dropdowns
 */
export const MATERIAL_CATEGORY_GROUPS = {
  'Raw Materials - Plates': [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  'Raw Materials - Pipes': [
    MaterialCategory.PIPES_CARBON_STEEL,
    MaterialCategory.PIPES_STAINLESS_304L,
    MaterialCategory.PIPES_STAINLESS_316L,
    MaterialCategory.PIPES_ALLOY_STEEL,
    MaterialCategory.PIPES_DUPLEX_2205,
    MaterialCategory.PIPES_SUPER_DUPLEX_2507,
  ],
  Fittings: [
    MaterialCategory.FITTINGS_BUTT_WELD,
    MaterialCategory.FITTINGS_SOCKET_WELD,
    MaterialCategory.FITTINGS_THREADED,
    MaterialCategory.FITTINGS_FLANGED,
  ],
  Fasteners: [
    MaterialCategory.FASTENERS_BOLTS,
    MaterialCategory.FASTENERS_NUTS,
    MaterialCategory.FASTENERS_WASHERS,
    MaterialCategory.FASTENERS_BOLT_NUT_WASHER_SETS,
    MaterialCategory.FASTENERS_STUDS,
    MaterialCategory.FASTENERS_SCREWS,
  ],
  Components: [
    MaterialCategory.VALVE_GATE,
    MaterialCategory.VALVE_GLOBE,
    MaterialCategory.VALVE_BALL,
    MaterialCategory.VALVE_BUTTERFLY,
    MaterialCategory.VALVE_CHECK,
    MaterialCategory.VALVE_OTHER,
    MaterialCategory.PUMP_CENTRIFUGAL,
    MaterialCategory.PUMP_POSITIVE_DISPLACEMENT,
    MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
    MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
    MaterialCategory.INSTRUMENT_FLOW_METER,
    MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
    MaterialCategory.INSTRUMENT_CONTROL_VALVE,
    MaterialCategory.INSTRUMENT_OTHER,
    MaterialCategory.FLANGES,
    MaterialCategory.FLANGES_WELD_NECK,
    MaterialCategory.FLANGES_SLIP_ON,
    MaterialCategory.FLANGES_BLIND,
    MaterialCategory.GASKETS,
    MaterialCategory.MOTORS,
    MaterialCategory.STRAINERS,
    MaterialCategory.SEPARATORS,
    MaterialCategory.ELECTRICAL,
  ],
  'Bought-Out Components': [
    MaterialCategory.VALVE_GATE,
    MaterialCategory.VALVE_GLOBE,
    MaterialCategory.VALVE_BALL,
    MaterialCategory.VALVE_BUTTERFLY,
    MaterialCategory.VALVE_CHECK,
    MaterialCategory.VALVE_OTHER,
    MaterialCategory.PUMP_CENTRIFUGAL,
    MaterialCategory.PUMP_POSITIVE_DISPLACEMENT,
    MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
    MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
    MaterialCategory.INSTRUMENT_FLOW_METER,
    MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
    MaterialCategory.INSTRUMENT_CONTROL_VALVE,
    MaterialCategory.INSTRUMENT_OTHER,
    MaterialCategory.FLANGES,
    MaterialCategory.FLANGES_WELD_NECK,
    MaterialCategory.FLANGES_SLIP_ON,
    MaterialCategory.FLANGES_BLIND,
    MaterialCategory.GASKETS,
    MaterialCategory.MOTORS,
    MaterialCategory.STRAINERS,
    MaterialCategory.SEPARATORS,
    MaterialCategory.ELECTRICAL,
  ],
  'Other Materials': [
    MaterialCategory.BARS_AND_RODS,
    MaterialCategory.SHEETS,
    MaterialCategory.STRUCTURAL_SHAPES,
    MaterialCategory.PLASTICS,
    MaterialCategory.RUBBER,
    MaterialCategory.COMPOSITES,
  ],
  Consumables: [
    MaterialCategory.WELDING_CONSUMABLES,
    MaterialCategory.PAINTS_COATINGS,
    MaterialCategory.LUBRICANTS,
    MaterialCategory.CHEMICALS,
  ],
  Other: [MaterialCategory.OTHER],
};

/**
 * Picker-specific category groups for the MaterialPickerDialog.
 * Each group defines a top-level card in the category-first landing view.
 */
export const PICKER_CATEGORY_GROUPS: Array<{
  key: string;
  label: string;
  categories: MaterialCategory[];
  pipingMode: boolean;
}> = [
  {
    key: 'flanges',
    label: 'Flanges',
    categories: [
      MaterialCategory.FLANGES,
      MaterialCategory.FLANGES_WELD_NECK,
      MaterialCategory.FLANGES_SLIP_ON,
      MaterialCategory.FLANGES_BLIND,
    ],
    pipingMode: true,
  },
  {
    key: 'pipes',
    label: 'Pipes',
    categories: [
      MaterialCategory.PIPES_CARBON_STEEL,
      MaterialCategory.PIPES_STAINLESS_304L,
      MaterialCategory.PIPES_STAINLESS_316L,
      MaterialCategory.PIPES_ALLOY_STEEL,
      MaterialCategory.PIPES_DUPLEX_2205,
      MaterialCategory.PIPES_SUPER_DUPLEX_2507,
    ],
    pipingMode: true,
  },
  {
    key: 'fittings',
    label: 'Fittings',
    categories: [
      MaterialCategory.FITTINGS_BUTT_WELD,
      MaterialCategory.FITTINGS_SOCKET_WELD,
      MaterialCategory.FITTINGS_THREADED,
      MaterialCategory.FITTINGS_FLANGED,
    ],
    pipingMode: true,
  },
  {
    key: 'plates',
    label: 'Plates',
    categories: [
      MaterialCategory.PLATES_CARBON_STEEL,
      MaterialCategory.PLATES_STAINLESS_STEEL,
      MaterialCategory.PLATES_DUPLEX_STEEL,
      MaterialCategory.PLATES_ALLOY_STEEL,
    ],
    pipingMode: false,
  },
  {
    key: 'fasteners',
    label: 'Fasteners',
    categories: [
      MaterialCategory.FASTENERS_BOLTS,
      MaterialCategory.FASTENERS_NUTS,
      MaterialCategory.FASTENERS_WASHERS,
      MaterialCategory.FASTENERS_BOLT_NUT_WASHER_SETS,
      MaterialCategory.FASTENERS_STUDS,
      MaterialCategory.FASTENERS_SCREWS,
    ],
    pipingMode: false,
  },
  {
    key: 'valves',
    label: 'Valves',
    categories: [
      MaterialCategory.VALVE_GATE,
      MaterialCategory.VALVE_GLOBE,
      MaterialCategory.VALVE_BALL,
      MaterialCategory.VALVE_BUTTERFLY,
      MaterialCategory.VALVE_CHECK,
      MaterialCategory.VALVE_OTHER,
    ],
    pipingMode: false,
  },
  {
    key: 'gaskets',
    label: 'Gaskets',
    categories: [MaterialCategory.GASKETS],
    pipingMode: false,
  },
  {
    key: 'instruments',
    label: 'Instruments',
    categories: [
      MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
      MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
      MaterialCategory.INSTRUMENT_FLOW_METER,
      MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
      MaterialCategory.INSTRUMENT_CONTROL_VALVE,
      MaterialCategory.INSTRUMENT_OTHER,
    ],
    pipingMode: false,
  },
  {
    key: 'instrument-accessories',
    label: 'Instrument Accessories',
    categories: [
      MaterialCategory.INSTRUMENT_ACCESSORY_THERMOWELL,
      MaterialCategory.INSTRUMENT_ACCESSORY_CABLE_GLAND,
      MaterialCategory.INSTRUMENT_ACCESSORY_MANIFOLD,
      MaterialCategory.INSTRUMENT_ACCESSORY_FERRULE,
      MaterialCategory.INSTRUMENT_ACCESSORY_JUNCTION_BOX,
    ],
    pipingMode: false,
  },
  {
    key: 'desalination',
    label: 'Desalination Components',
    categories: [
      MaterialCategory.RUBBER_GROMMET,
      MaterialCategory.DEMISTER_PAD,
      MaterialCategory.SPRAY_NOZZLE,
      MaterialCategory.EXPANSION_BELLOWS,
    ],
    pipingMode: false,
  },
  {
    key: 'other',
    label: 'Other',
    categories: [
      MaterialCategory.PUMP_CENTRIFUGAL,
      MaterialCategory.PUMP_POSITIVE_DISPLACEMENT,
      MaterialCategory.MOTORS,
      MaterialCategory.STRAINERS,
      MaterialCategory.SEPARATORS,
      MaterialCategory.ELECTRICAL,
      MaterialCategory.BARS_AND_RODS,
      MaterialCategory.SHEETS,
      MaterialCategory.STRUCTURAL_SHAPES,
      MaterialCategory.PLASTICS,
      MaterialCategory.RUBBER,
      MaterialCategory.COMPOSITES,
      MaterialCategory.WELDING_CONSUMABLES,
      MaterialCategory.PAINTS_COATINGS,
      MaterialCategory.LUBRICANTS,
      MaterialCategory.CHEMICALS,
      MaterialCategory.OTHER,
    ],
    pipingMode: false,
  },
];

// ============================================================================
// Material Properties
// ============================================================================

export interface MaterialProperties {
  // Physical Properties
  density?: number; // kg/m³ or g/cm³
  densityUnit?: 'kg/m3' | 'g/cm3';

  // Mechanical Properties
  tensileStrength?: number; // MPa
  yieldStrength?: number; // MPa
  elongation?: number; // %
  hardness?: string; // e.g., "150 HB", "45 HRC"

  // Thermal Properties
  thermalConductivity?: number; // W/(m·K)
  specificHeat?: number; // J/(kg·K)
  meltingPoint?: number; // °C
  maxOperatingTemp?: number; // °C

  // Chemical Properties
  composition?: ChemicalComposition[];
  corrosionResistance?: string; // Descriptive

  // Electrical Properties
  electricalResistivity?: number; // Ω·m

  // Dimensional Properties (for bought-out components)
  nominalSize?: string; // e.g., "DN 50", "M8", "1/2 inch"
  length?: number; // mm
  width?: number; // mm
  thickness?: number; // mm
  diameter?: number; // mm

  // Custom Properties
  customProperties?: CustomProperty[];
}

export interface ChemicalComposition {
  element: string; // e.g., "C", "Cr", "Ni"
  percentage: number; // %
}

export interface CustomProperty {
  propertyName: string;
  value: string | number;
  unit?: string;
}

// ============================================================================
// Material Pricing
// ============================================================================

export interface MaterialPrice {
  id: string;
  materialId: string; // Parent material

  // Price Details
  pricePerUnit: Money; // Price in base currency
  unit: string; // Must match material baseUnit
  currency: CurrencyCode; // Usually INR

  // Vendor & Source
  vendorId?: string; // If from specific vendor
  vendorName?: string; // Denormalized for display
  sourceType: PriceSourceType;

  // Validity
  effectiveDate: Timestamp; // When price becomes effective
  expiryDate?: Timestamp; // Quote validity

  // Quantity Tiers (optional)
  quantityBreaks?: QuantityBreak[];

  // Context
  remarks?: string; // e.g., "Annual contract rate", "Spot market"
  documentReference?: string; // Human-readable number — quote number, PO number
  /** Firestore doc id of the source — lets the UI link back to the quote / PO. */
  sourceQuoteId?: string;

  // Status
  isActive: boolean; // Current price?
  isForecast: boolean; // Future estimated price?

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type PriceSourceType =
  | 'VENDOR_QUOTE'
  | 'VENDOR_INVOICE' // Landed cost captured when a vendor bill is posted
  | 'MARKET_RATE'
  | 'HISTORICAL'
  | 'ESTIMATED'
  | 'CONTRACT_RATE';

export interface QuantityBreak {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: Money;
}

// ============================================================================
// Unit Conversions
// ============================================================================

export interface UnitConversion {
  fromUnit: string; // e.g., "kg"
  toUnit: string; // e.g., "ton"
  conversionFactor: number; // e.g., 1000 (1 ton = 1000 kg)
}

// ============================================================================
// Stock Management
// ============================================================================

export interface StockMovement {
  id: string;
  materialId: string;
  movementType: StockMovementType;
  quantity: number;
  unit: string;
  reason: string;
  documentReference?: string; // PO, GRN, etc.
  createdAt: Timestamp;
  createdBy: string;
}

export type StockMovementType =
  | 'INCREASE_PURCHASE'
  | 'INCREASE_PRODUCTION'
  | 'DECREASE_CONSUMPTION'
  | 'DECREASE_WASTAGE'
  | 'ADJUSTMENT';

// ============================================================================
// Search & Filter Types
// ============================================================================

export interface MaterialFilter {
  searchText?: string; // Full-text search
  categories?: MaterialCategory[];
  materialTypes?: MaterialType[];
  vendorIds?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  standards?: string[]; // e.g., ["ASTM", "IS", "DIN"]
  hasDatasheet?: boolean;
  isActive?: boolean;
  isStandard?: boolean;
  propertyFilters?: PropertyFilter[];
}

export interface PropertyFilter {
  propertyName: keyof MaterialProperties;
  min?: number;
  max?: number;
}

export type MaterialSortField =
  | 'materialCode'
  | 'name'
  | 'category'
  | 'currentPrice'
  | 'updatedAt'
  | 'createdAt';

export type MaterialSortDirection = 'asc' | 'desc';

export interface MaterialSearchQuery {
  filter: MaterialFilter;
  sortField: MaterialSortField;
  sortDirection: MaterialSortDirection;
  limit: number;
  offset: number;
}

// ============================================================================
// UI Display Types
// ============================================================================

export interface MaterialListItem {
  id: string;
  materialCode: string;
  customCode?: string;
  name: string;
  category: MaterialCategory;
  categoryLabel: string;
  specification: string; // Formatted spec string
  currentPrice?: string; // Formatted price string
  priceDate?: string; // Formatted date
  vendors: number; // Count
  imageUrl?: string;
  isActive: boolean;
  isStandard: boolean;
  updatedAt: string; // Formatted date
}

// ============================================================================
// Material Code Generator
// ============================================================================

/**
 * Material Code Format: {FORM}-{MATERIAL}-{GRADE}
 * Example: PL-SS-304 (Plate - Stainless Steel - 304)
 *
 * Note: No sequence number needed - each grade has ONE material code.
 * All thickness and finish variations are stored as variants.
 */

export interface MaterialCodeConfig {
  form: string; // "PL" for Plate
  material: string; // "SS" for Stainless Steel
  grade: string; // "304", "304L", "316", "316L", etc.
}

/**
 * Plate Material Code Mappings
 * Format: PL-{MATERIAL}-{GRADE}
 */
export const PLATE_MATERIAL_CODES: Partial<Record<MaterialCategory, [string, string]>> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: ['PL', 'CS'],
  [MaterialCategory.PLATES_STAINLESS_STEEL]: ['PL', 'SS'],
  [MaterialCategory.PLATES_DUPLEX_STEEL]: ['PL', 'DS'],
  [MaterialCategory.PLATES_ALLOY_STEEL]: ['PL', 'AS'],
};

/**
 * Pipe Material Code Mappings
 * Format: PP-{MATERIAL}-{GRADE}-{CONSTRUCTION}
 * Example: PP-CS-A106-SMLS, PP-SS-304L-SMLS
 */
export const PIPE_MATERIAL_CODES: Partial<Record<MaterialCategory, [string, string]>> = {
  [MaterialCategory.PIPES_CARBON_STEEL]: ['PP', 'CS'],
  [MaterialCategory.PIPES_STAINLESS_304L]: ['PP', 'SS304L'],
  [MaterialCategory.PIPES_STAINLESS_316L]: ['PP', 'SS316L'],
  [MaterialCategory.PIPES_ALLOY_STEEL]: ['PP', 'AS'],
  [MaterialCategory.PIPES_DUPLEX_2205]: ['PP', 'DX2205'],
  [MaterialCategory.PIPES_SUPER_DUPLEX_2507]: ['PP', 'SDX2507'],
};

/**
 * Flange Material Code Mappings
 * Format: FL-{TYPE}-{MATERIAL}-{GRADE}
 * Example: FL-WN-CS-A105, FL-SO-SS-A182
 */
export const FLANGE_MATERIAL_CODES: Partial<Record<MaterialCategory, [string, string]>> = {
  [MaterialCategory.FLANGES_WELD_NECK]: ['FL', 'WN'],
  [MaterialCategory.FLANGES_SLIP_ON]: ['FL', 'SO'],
  [MaterialCategory.FLANGES_BLIND]: ['FL', 'BL'],
  [MaterialCategory.FLANGES]: ['FL', 'GEN'],
};

/**
 * Fitting Material Code Mappings
 * Format: FT-{TYPE}-{MATERIAL}-{GRADE}
 * Example: FT-BW-CS-A234, FT-SW-SS-A182
 */
export const FITTING_MATERIAL_CODES: Partial<Record<MaterialCategory, [string, string]>> = {
  [MaterialCategory.FITTINGS_BUTT_WELD]: ['FT', 'BW'],
  [MaterialCategory.FITTINGS_SOCKET_WELD]: ['FT', 'SW'],
  [MaterialCategory.FITTINGS_THREADED]: ['FT', 'TH'],
  [MaterialCategory.FITTINGS_FLANGED]: ['FT', 'FL'],
};

/**
 * Piping material category type — determines selection UI and data model
 */
export type PipingCategory = 'PLATE' | 'FLANGE' | 'PIPE' | 'FITTING' | 'OTHER';

/**
 * Determine the piping category from a MaterialCategory.
 * Plates use variants (thickness). Flanges/pipes/fittings use flat documents.
 */
export function getPipingCategory(category: MaterialCategory): PipingCategory {
  const cat = category as string;
  if (cat.startsWith('PLATES_')) return 'PLATE';
  if (cat.startsWith('FLANGES') || cat === 'FLANGES') return 'FLANGE';
  if (cat.startsWith('PIPES_')) return 'PIPE';
  if (cat.startsWith('FITTINGS_')) return 'FITTING';
  return 'OTHER';
}

/**
 * Check if a category uses flat material documents (one doc per size/rating)
 * as opposed to variants (one parent doc with variant sub-items).
 */
export function isFlatPipingCategory(category: MaterialCategory): boolean {
  const pc = getPipingCategory(category);
  return pc === 'FLANGE' || pc === 'PIPE' || pc === 'FITTING';
}

/**
 * Helper to get form and material code from category
 */
export function getMaterialCodeParts(category: MaterialCategory): [string, string] | undefined {
  return (
    PLATE_MATERIAL_CODES[category] ||
    PIPE_MATERIAL_CODES[category] ||
    FLANGE_MATERIAL_CODES[category] ||
    FITTING_MATERIAL_CODES[category]
  );
}

// ============================================================================
// Validation Error Types
// ============================================================================

export interface MaterialValidationError {
  field: keyof Material;
  message: string;
}

// ============================================================================
// Helper type guards
// ============================================================================

export function isMaterial(obj: unknown): obj is Material {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'materialCode' in obj &&
    'name' in obj &&
    'category' in obj
  );
}

export function isMaterialPrice(obj: unknown): obj is MaterialPrice {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'materialId' in obj &&
    'pricePerUnit' in obj
  );
}
