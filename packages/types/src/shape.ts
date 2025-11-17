/**
 * Shape Database Module Types
 * Comprehensive types for managing fabricated components with parametric dimensions
 * Compliant with ASME/AISC standards
 */

import type { Timestamp } from 'firebase/firestore';
import type { CurrencyCode } from './common';
import type { MaterialCategory } from './material';

// ============================================================================
// Core Shape Types
// ============================================================================

/**
 * Main Shape entity representing parametric fabricated components
 */
export interface Shape {
  // Identity
  id: string;
  shapeCode: string; // Auto-generated: SHP-YYYY-NNNN
  customCode?: string; // User-defined code (e.g., "HX-SHELL-1000")
  name: string; // e.g., "Cylindrical Shell", "Hemispherical Head"
  description: string; // Detailed description

  // Classification
  category: ShapeCategory;
  subCategory?: string; // e.g., "Horizontal", "Vertical"
  shapeType: ShapeType;

  // Standard Reference (if applicable)
  standard?: ShapeStandard;

  // Dimensional Parameters
  parameters: ShapeParameter[]; // List of dimensional inputs (D, L, t, etc.)

  // Material Compatibility
  allowedMaterialCategories: MaterialCategory[]; // Which materials can be used
  defaultMaterialCategory?: MaterialCategory;

  // Calculation Formulas
  formulas: ShapeFormulas;

  // Fabrication Cost Estimation
  fabricationCost?: FabricationCost;

  // Visualization
  imageUrl?: string; // Shape diagram/drawing
  threeDModelUrl?: string; // 3D CAD model (optional)
  sketchUrl?: string; // Dimensional sketch with labels

  // Usage & Organization
  tags: string[]; // Searchable tags
  isStandard: boolean; // Frequently used shape
  isActive: boolean; // Soft delete flag
  usageCount: number; // Times used in BOMs

  // Validation Rules
  validationRules?: ValidationRule[];

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Shape Category - organized by fabrication type
 */
export enum ShapeCategory {
  // Plates & Sheets
  PLATE_RECTANGULAR = 'PLATE_RECTANGULAR', // ASME Section VIII
  PLATE_CIRCULAR = 'PLATE_CIRCULAR',
  PLATE_CUSTOM = 'PLATE_CUSTOM',

  // Tubes (Heat Exchanger)
  TUBE_STRAIGHT = 'TUBE_STRAIGHT', // Heat exchanger tubes

  // Pressure Vessel Components (ASME Section VIII)
  SHELL_CYLINDRICAL = 'SHELL_CYLINDRICAL', // UG-27 (Cylindrical shells)
  SHELL_CONICAL = 'SHELL_CONICAL', // UG-32 (Conical shells)
  HEAD_HEMISPHERICAL = 'HEAD_HEMISPHERICAL', // UG-32(c) (Hemisphere)
  HEAD_ELLIPSOIDAL = 'HEAD_ELLIPSOIDAL', // UG-32(d) (2:1 Elliptical)
  HEAD_TORISPHERICAL = 'HEAD_TORISPHERICAL', // UG-32(e) (Flanged & dished)
  HEAD_FLAT = 'HEAD_FLAT', // UG-34 (Flat heads)
  HEAD_CONICAL = 'HEAD_CONICAL', // UG-32(f) (Conical heads)

  // Heat Exchanger Components (TEMA Standards)
  HX_TUBE_BUNDLE = 'HX_TUBE_BUNDLE', // Tube bundle assembly
  HX_TUBE_SHEET = 'HX_TUBE_SHEET', // Tube sheet (plate with holes)
  HX_BAFFLE = 'HX_BAFFLE', // Baffle plate
  HX_TUBE_SUPPORT = 'HX_TUBE_SUPPORT', // Tube support plate

  // Nozzles & Connections
  NOZZLE_ASSEMBLY = 'NOZZLE_ASSEMBLY', // Standard nozzle with auto-reinforcement
  NOZZLE_CUSTOM_CIRCULAR = 'NOZZLE_CUSTOM_CIRCULAR', // Custom circular nozzle
  NOZZLE_CUSTOM_RECTANGULAR = 'NOZZLE_CUSTOM_RECTANGULAR', // Custom rectangular nozzle
  MANWAY_ASSEMBLY = 'MANWAY_ASSEMBLY', // Manway with cover
  REINFORCEMENT_PAD = 'REINFORCEMENT_PAD', // Standalone reinforcement pad

  // Custom Structural Shapes
  CUSTOM_BOX_SECTION = 'CUSTOM_BOX_SECTION', // Built-up box section
  CUSTOM_BRACKET = 'CUSTOM_BRACKET', // Custom bracket/support

  // Custom Assemblies
  CUSTOM_ASSEMBLY = 'CUSTOM_ASSEMBLY', // User-defined assembly
}

/**
 * Shape category labels for display
 */
export const SHAPE_CATEGORY_LABELS: Record<ShapeCategory, string> = {
  [ShapeCategory.PLATE_RECTANGULAR]: 'Rectangular Plate',
  [ShapeCategory.PLATE_CIRCULAR]: 'Circular Plate',
  [ShapeCategory.PLATE_CUSTOM]: 'Custom Plate Shape',
  [ShapeCategory.TUBE_STRAIGHT]: 'Heat Exchanger Tube',
  [ShapeCategory.SHELL_CYLINDRICAL]: 'Cylindrical Shell',
  [ShapeCategory.SHELL_CONICAL]: 'Conical Shell',
  [ShapeCategory.HEAD_HEMISPHERICAL]: 'Hemispherical Head',
  [ShapeCategory.HEAD_ELLIPSOIDAL]: 'Ellipsoidal Head (2:1)',
  [ShapeCategory.HEAD_TORISPHERICAL]: 'Torispherical Head (F&D)',
  [ShapeCategory.HEAD_FLAT]: 'Flat Head',
  [ShapeCategory.HEAD_CONICAL]: 'Conical Head',
  [ShapeCategory.HX_TUBE_BUNDLE]: 'Tube Bundle',
  [ShapeCategory.HX_TUBE_SHEET]: 'Tube Sheet (Drilled)',
  [ShapeCategory.HX_BAFFLE]: 'Baffle Plate (Segmental)',
  [ShapeCategory.HX_TUBE_SUPPORT]: 'Tube Support Plate',
  [ShapeCategory.NOZZLE_ASSEMBLY]: 'Nozzle Assembly (Standard)',
  [ShapeCategory.NOZZLE_CUSTOM_CIRCULAR]: 'Custom Circular Nozzle',
  [ShapeCategory.NOZZLE_CUSTOM_RECTANGULAR]: 'Custom Rectangular Nozzle',
  [ShapeCategory.MANWAY_ASSEMBLY]: 'Manway Assembly',
  [ShapeCategory.REINFORCEMENT_PAD]: 'Reinforcement Pad',
  [ShapeCategory.CUSTOM_BOX_SECTION]: 'Custom Box Section',
  [ShapeCategory.CUSTOM_BRACKET]: 'Custom Bracket/Support',
  [ShapeCategory.CUSTOM_ASSEMBLY]: 'Custom Assembly',
};

/**
 * Shape type classification
 */
export type ShapeType = 'STANDARD' | 'PARAMETRIC' | 'CUSTOM';

/**
 * Standard reference for shapes
 */
export interface ShapeStandard {
  code: string; // e.g., "ASME B16.9", "ASME Section VIII Div 1"
  figureNumber?: string; // e.g., "UG-27", "Figure 1-1"
  edition?: string; // Standard edition/year
}

/**
 * Shape parameter definition
 */
export interface ShapeParameter {
  name: string; // e.g., "D" (Diameter), "L" (Length), "t" (Thickness)
  label: string; // e.g., "Shell Diameter", "Length"
  description?: string; // "Inside diameter of the shell"
  unit: string; // e.g., "mm", "m", "inch"
  dataType: ParameterDataType;

  // For NUMBER type
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;

  // For SELECT type (e.g., pipe schedule)
  options?: ParameterOption[];

  // Display
  order: number; // Display order in form
  required: boolean;
  helpText?: string; // Guidance for user

  // Formula dependency
  usedInFormulas: string[]; // Which formulas use this parameter
}

/**
 * Parameter data type
 */
export type ParameterDataType = 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'TEXT';

/**
 * Parameter option for SELECT type
 */
export interface ParameterOption {
  value: string; // e.g., "Sch 40"
  label: string;
  numericValue?: number; // Wall thickness for calculation
}

/**
 * Shape formulas collection
 */
export interface ShapeFormulas {
  // Core calculations
  volume?: FormulaDefinition; // Volume calculation (material volume)
  weight?: FormulaDefinition; // Weight = Volume × Density

  // Surface Area Calculations
  surfaceArea?: FormulaDefinition; // Total surface area (for coating/painting)
  innerSurfaceArea?: FormulaDefinition; // Internal surface (for process contact)
  outerSurfaceArea?: FormulaDefinition; // External surface (for insulation)
  wettedArea?: FormulaDefinition; // Process-side surface (for heat transfer)

  // Blank/Stock Material Calculations (for cutting from stock)
  blankDimensions?: BlankDefinition; // Blank shape required
  blankArea?: FormulaDefinition; // Blank area (before cutting)
  finishedArea?: FormulaDefinition; // Finished part area (after cutting)
  scrapPercentage?: FormulaDefinition; // (Blank area - Finished area) / Blank area × 100

  // Edge preparation and welding
  edgeLength?: FormulaDefinition; // Perimeter/edge length (for beveling)
  weldLength?: FormulaDefinition; // Weld length estimation

  // Custom formulas
  customFormulas?: CustomFormula[];
}

/**
 * Formula definition
 */
export interface FormulaDefinition {
  expression: string; // Math expression (e.g., "PI * D * D / 4 * L")
  variables: string[]; // Variables used (e.g., ["D", "L"])
  constants?: FormulaConstant[];
  unit: string; // Result unit (e.g., "m³", "kg", "m²")
  description?: string; // Formula explanation

  // For weight calculation
  requiresDensity?: boolean; // If true, material density is multiplied

  // Validation
  expectedRange?: ExpectedRange;
}

/**
 * Formula constant
 */
export interface FormulaConstant {
  name: string; // e.g., "PI"
  value: number; // 3.14159
}

/**
 * Expected range for validation
 */
export interface ExpectedRange {
  min: number;
  max: number;
  warning?: string; // Warning if outside range
}

/**
 * Custom formula definition
 */
export interface CustomFormula {
  name: string; // e.g., "Moment of Inertia", "Weld Length"
  formula: FormulaDefinition;
  unit: string;
}

/**
 * Blank definition for material procurement
 */
export interface BlankDefinition {
  blankType: BlankType;

  // For RECTANGULAR blank
  blankLength?: FormulaDefinition; // Length of rectangular blank (mm)
  blankWidth?: FormulaDefinition; // Width of rectangular blank (mm)

  // For CIRCULAR blank
  blankDiameter?: FormulaDefinition; // Diameter of circular blank (mm)

  // Thickness (usually same as part thickness)
  blankThickness?: string; // Parameter name (e.g., "t")

  // Scrap calculation
  scrapFormula?: FormulaDefinition; // Scrap percentage calculation

  // Explanation
  description?: string; // "Circular head cut from square plate"
  diagram?: string; // URL to diagram showing blank layout
}

/**
 * Blank type
 */
export type BlankType = 'RECTANGULAR' | 'CIRCULAR' | 'CUSTOM';

/**
 * Fabrication cost estimation
 */
export interface FabricationCost {
  baseCost?: number; // Fixed cost component
  costPerKg?: number; // Cost per kg of material
  costPerSurfaceArea?: number; // Cost per m² of surface (for welding, painting)
  laborHours?: number; // Estimated fabrication hours
  setupCost?: number; // One-time setup cost
  formula?: string; // Custom cost formula
}

/**
 * Validation rule
 */
export interface ValidationRule {
  parameterName: string;
  rule: ValidationRuleType;
  value: number | number[] | string;
  errorMessage: string;
}

/**
 * Validation rule type
 */
export type ValidationRuleType = 'MIN' | 'MAX' | 'RANGE' | 'REQUIRED' | 'CUSTOM';

// ============================================================================
// Shape Instance (Used in BOM)
// ============================================================================

/**
 * Shape Instance - When a shape is used in a BOM with specific parameters
 */
export interface ShapeInstance {
  id: string;
  shapeId: string; // Reference to Shape
  shapeName: string; // Denormalized
  shapeCategory: ShapeCategory; // Denormalized

  // Material Selection
  materialId: string; // Selected material
  materialName: string; // Denormalized
  materialDensity: number; // kg/m³ (from material)
  materialPricePerKg: number; // Latest price

  // Dimensional Values (User Input)
  parameterValues: ParameterValue[];

  // Calculated Results
  calculatedValues: CalculatedValues;

  // Cost Estimation
  costEstimate: CostEstimate;

  // Quantity
  quantity: number; // Number of this shape instance
  totalWeight: number; // Weight × Quantity
  totalCost: number; // Cost × Quantity

  // Notes
  remarks?: string;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
}

/**
 * Parameter value (user input)
 */
export interface ParameterValue {
  parameterName: string;
  value: number | string | boolean;
  unit: string;
}

/**
 * Calculated values from formulas
 */
export interface CalculatedValues {
  volume: number; // m³ (material volume)
  weight: number; // kg

  // Surface Areas
  surfaceArea?: number; // m² (total surface)
  innerSurfaceArea?: number; // m² (internal)
  outerSurfaceArea?: number; // m² (external)
  wettedArea?: number; // m² (process-side, for heat transfer)

  // Blank/Stock Material
  blankDimensions?: BlankDimensions;
  finishedArea?: number; // mm² (part area after cutting)
  scrapPercentage?: number; // % (material waste)
  scrapWeight?: number; // kg (weight of scrap material)

  // Edge preparation
  edgeLength?: number; // m (perimeter for beveling)
  weldLength?: number; // m (total weld length)

  // Custom calculations
  customCalculations?: CustomCalculation[];
}

/**
 * Blank dimensions calculated
 */
export interface BlankDimensions {
  type: BlankType;
  length?: number; // mm (for rectangular)
  width?: number; // mm (for rectangular)
  diameter?: number; // mm (for circular)
  thickness?: number; // mm
  area: number; // mm² (blank area)
}

/**
 * Custom calculation result
 */
export interface CustomCalculation {
  name: string;
  value: number;
  unit: string;
}

/**
 * Cost estimate breakdown
 */
export interface CostEstimate {
  materialCost: number; // Weight × Price per kg
  materialCostActual: number; // Blank weight × Price per kg (including scrap)
  scrapRecoveryValue: number; // Scrap weight × Recovery rate (negative)
  fabricationCost: number; // Calculated using fabrication formula
  surfaceTreatmentCost: number; // Blasting + painting
  edgePreparationCost: number; // Beveling, machining
  cuttingCost: number; // Plasma/oxy-fuel/laser cutting
  weldingCost: number; // Based on weld length
  totalCost: number; // Sum of all costs
  currency: CurrencyCode;
  effectiveCostPerKg: number; // Total cost / Finished weight
}

// ============================================================================
// Shape Calculator & Filters
// ============================================================================

/**
 * Shape filter for search/listing
 */
export interface ShapeFilter {
  category?: ShapeCategory[];
  shapeType?: ShapeType[];
  materialCompatibility?: MaterialCategory[];
  standard?: string[];
  isStandard?: boolean;
  isActive?: boolean;
  tags?: string[];
  searchText?: string;
}

/**
 * Calculation request
 */
export interface CalculationRequest {
  shapeId: string;
  parameterValues: ParameterValue[];
  materialId: string;
  quantity: number;
}

/**
 * Calculation result
 */
export interface CalculationResult {
  success: boolean;
  shapeInstance?: ShapeInstance;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// Nozzle-Specific Types
// ============================================================================

/**
 * Nozzle orientation
 */
export type NozzleOrientation = 'RADIAL' | 'TANGENTIAL' | 'HILLSIDE';

/**
 * Nozzle neck type
 */
export type NozzleNeckType = 'SET_IN' | 'SET_ON' | 'INTEGRAL';

/**
 * ASME reinforcement calculation result
 */
export interface ReinforcementCalculation {
  isReinforcementRequired: boolean;
  areaRequired: number; // mm²
  areaAvailable: number; // mm²
  padDiameter?: number; // mm (if pad required)
  padThickness?: number; // mm (if pad required)
  calculation: string; // Explanation of ASME UG-37 calculation
}

/**
 * Bolt clearance check result
 */
export interface BoltClearanceCheck {
  isAdequate: boolean;
  minimumProjection: number; // mm
  actualProjection: number; // mm
  shortage?: number; // mm (if inadequate)
  recommendation: string;
}

// ============================================================================
// Nozzle Assembly Component
// ============================================================================

/**
 * Nozzle assembly component (part of nozzle assembly)
 */
export interface NozzleComponent {
  type: NozzleComponentType;
  name: string;
  materialId?: string; // If from materials DB
  weight: number; // kg
  cost: number; // Currency
  quantity: number;
}

/**
 * Nozzle component type
 */
export type NozzleComponentType =
  | 'NOZZLE_NECK'
  | 'REINFORCEMENT_PAD'
  | 'FLANGE'
  | 'GASKET'
  | 'MATING_FLANGE'
  | 'FASTENERS';

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Standard plate sizes (for blank optimization)
 */
export interface StandardPlateSize {
  name: string; // e.g., "1.5m × 6m", "2m × 6m"
  width: number; // mm
  length: number; // mm
}

/**
 * Shape code generation pattern
 */
export const SHAPE_CODE_PREFIX = 'SHP';

/**
 * Shape code format: SHP-YYYY-NNNN
 */
export type ShapeCode = `${typeof SHAPE_CODE_PREFIX}-${number}-${number}`;
