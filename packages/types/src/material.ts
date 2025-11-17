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
export type MaterialType = 'RAW_MATERIAL' | 'BOUGHT_OUT_COMPONENT' | 'CONSUMABLE';

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

  // Bought-Out Components - Other
  VALVES = 'VALVES', // ASME B16.34 (Gate, Globe, Check, Ball)
  FLANGES = 'FLANGES', // ASME B16.5, B16.47 (Slip-on, Weld neck, Blind)
  GASKETS = 'GASKETS', // ASME B16.20, B16.21
  PUMPS = 'PUMPS',
  MOTORS = 'MOTORS',
  INSTRUMENTATION = 'INSTRUMENTATION',
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
  [MaterialCategory.VALVES]: 'Valves',
  [MaterialCategory.FLANGES]: 'Flanges',
  [MaterialCategory.GASKETS]: 'Gaskets',
  [MaterialCategory.PUMPS]: 'Pumps',
  [MaterialCategory.MOTORS]: 'Motors',
  [MaterialCategory.INSTRUMENTATION]: 'Instrumentation',
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
    MaterialCategory.VALVES,
    MaterialCategory.FLANGES,
    MaterialCategory.GASKETS,
    MaterialCategory.PUMPS,
    MaterialCategory.MOTORS,
    MaterialCategory.INSTRUMENTATION,
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
  documentReference?: string; // Quote reference, PO number

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
};

/**
 * Helper to get form and material code from category
 */
export function getMaterialCodeParts(category: MaterialCategory): [string, string] | undefined {
  return PLATE_MATERIAL_CODES[category] || PIPE_MATERIAL_CODES[category];
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
