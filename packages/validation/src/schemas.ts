// Zod validation schemas

import { z } from 'zod';
import { PHONE_REGEX, PINCODE_REGEX, IFSC_REGEX } from './regex';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeDisplayName,
  sanitizeEntityName,
  sanitizeCode,
} from './sanitize';
import { validatePAN, validateGSTIN, validateTaxIdentifiers } from './taxValidation';

/**
 * Common field schemas with sanitization
 * Using Zod's built-in email validation which is more robust than regex
 */
export const emailSchema = z
  .string()
  .transform(sanitizeEmail)
  .pipe(z.string().email('Invalid email format'));

export const phoneSchema = z
  .string()
  .transform(sanitizePhone)
  .pipe(z.string().regex(PHONE_REGEX, 'Invalid phone number'));

export const panSchema = z
  .string()
  .transform(sanitizeCode)
  .pipe(
    z.string().superRefine((val, ctx) => {
      if (!val || val.trim() === '') {
        return; // Allow empty for optional fields
      }
      const validation = validatePAN(val);
      if (!validation.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.error || 'Invalid PAN',
        });
      }
    })
  )
  .optional();

export const gstSchema = z
  .string()
  .transform(sanitizeCode)
  .pipe(
    z.string().superRefine((val, ctx) => {
      if (!val || val.trim() === '') {
        return; // Allow empty for optional fields
      }
      const validation = validateGSTIN(val);
      if (!validation.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.error || 'Invalid GSTIN',
        });
      }
    })
  )
  .optional();

export const pincodeSchema = z.string().regex(PINCODE_REGEX, 'Invalid postal code');

export const ifscSchema = z.string().regex(IFSC_REGEX, 'Invalid IFSC code').optional();

/**
 * Address schema
 */
export const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: pincodeSchema,
  country: z.string().default('India'),
});

/**
 * Money schema
 */
export const moneySchema = z.object({
  amount: z.number().min(0, 'Amount must be positive'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED']).default('INR'),
});

/**
 * User schema
 */
export const userSchema = z.object({
  email: emailSchema,
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .transform(sanitizeDisplayName)
    .pipe(z.string().min(1, 'Display name cannot be empty after sanitization')),
  phone: phoneSchema.optional(),
  mobile: phoneSchema.optional(),
  department: z
    .enum(['MANAGEMENT', 'FINANCE', 'HR', 'ENGINEERING', 'PROCUREMENT', 'OPERATIONS', 'SALES'])
    .optional(),
  jobTitle: z.string().optional(),
});

/**
 * Entity schema
 */
/**
 * Tax identifiers schema with cross-validation
 * Validates that GSTIN contains the same PAN if both are provided
 */
export const taxIdentifiersSchema = z
  .object({
    gstin: gstSchema,
    pan: panSchema,
  })
  .superRefine((data, ctx) => {
    // Skip if both are empty
    if (!data.gstin && !data.pan) {
      return;
    }

    // Cross-validate if both are provided
    if (data.gstin && data.pan) {
      const validation = validateTaxIdentifiers(data.pan, data.gstin);
      if (!validation.valid) {
        validation.errors.forEach((error) => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error,
            path: error.toLowerCase().includes('pan') ? ['pan'] : ['gstin'],
          });
        });
      }
    }
  })
  .optional();

export const entitySchema = z.object({
  name: z
    .string()
    .min(1, 'Entity name is required')
    .transform(sanitizeEntityName)
    .pipe(z.string().min(1, 'Entity name cannot be empty after sanitization')),
  legalName: z.string().transform(sanitizeEntityName).optional(),
  contactPerson: z
    .string()
    .min(1, 'Contact person is required')
    .transform(sanitizeDisplayName)
    .pipe(z.string().min(1, 'Contact person cannot be empty after sanitization')),
  email: emailSchema,
  phone: phoneSchema,
  mobile: phoneSchema.optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  taxIdentifiers: taxIdentifiersSchema,
});

/**
 * Project schema
 */
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: z.enum(['PROPOSAL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  client: z.object({
    entityId: z.string().min(1, 'Client is required'),
    entityName: z.string(),
    contactPerson: z.string(),
    contactEmail: emailSchema,
    contactPhone: phoneSchema,
  }),
});

// ============================================================================
// Material Database Schemas
// ============================================================================

/**
 * Material specification schema (ASME/ASTM Standards)
 */
export const materialSpecificationSchema = z.object({
  standard: z.string().optional(), // e.g., "ASTM A240", "IS 2062"
  grade: z.string().optional(), // e.g., "316L", "304", "A36"
  finish: z.string().optional(), // e.g., "2B", "BA", "No. 4"
  form: z.string().optional(), // e.g., "Plate", "Sheet", "Bar"
  schedule: z.string().optional(), // For pipes: "Sch 10", "Sch 40"
  nominalSize: z.string().optional(), // For pipes/fittings: "DN 50"
  customSpecs: z.string().optional(),
});

/**
 * Chemical composition schema
 */
export const chemicalCompositionSchema = z.object({
  element: z.string().min(1, 'Element symbol is required'),
  percentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100'),
});

/**
 * Custom property schema
 */
export const customPropertySchema = z.object({
  propertyName: z.string().min(1, 'Property name is required'),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
});

/**
 * Material properties schema
 */
export const materialPropertiesSchema = z.object({
  // Physical Properties
  density: z.number().positive('Density must be positive').optional(),
  densityUnit: z.enum(['kg/m3', 'g/cm3']).default('kg/m3').optional(),

  // Mechanical Properties
  tensileStrength: z.number().positive().optional(), // MPa
  yieldStrength: z.number().positive().optional(), // MPa
  elongation: z.number().min(0).max(100).optional(), // %
  hardness: z.string().optional(),

  // Thermal Properties
  thermalConductivity: z.number().positive().optional(), // W/(m·K)
  specificHeat: z.number().positive().optional(), // J/(kg·K)
  meltingPoint: z.number().optional(), // °C
  maxOperatingTemp: z.number().optional(), // °C

  // Chemical Properties
  composition: z.array(chemicalCompositionSchema).optional(),
  corrosionResistance: z.string().optional(),

  // Electrical Properties
  electricalResistivity: z.number().positive().optional(), // Ω·m

  // Dimensional Properties (for bought-out components)
  nominalSize: z.string().optional(),
  length: z.number().positive().optional(), // mm
  width: z.number().positive().optional(), // mm
  thickness: z.number().positive().optional(), // mm
  diameter: z.number().positive().optional(), // mm

  // Custom Properties
  customProperties: z.array(customPropertySchema).optional(),
});

/**
 * Unit conversion schema
 */
export const unitConversionSchema = z.object({
  fromUnit: z.string().min(1, 'From unit is required'),
  toUnit: z.string().min(1, 'To unit is required'),
  conversionFactor: z.number().positive('Conversion factor must be positive'),
});

/**
 * Material schema (main entity)
 */
export const materialSchema = z.object({
  // Identity (optional for creation, required for update)
  id: z.string().optional(),
  materialCode: z.string().optional(), // Auto-generated if not provided
  customCode: z.string().optional(),
  name: z
    .string()
    .min(3, 'Material name must be at least 3 characters')
    .max(200, 'Material name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),

  // Classification
  category: z.string().min(1, 'Material category is required'),
  subCategory: z.string().optional(),
  materialType: z.enum(['RAW_MATERIAL', 'BOUGHT_OUT_COMPONENT', 'CONSUMABLE']),

  // Specifications
  specification: materialSpecificationSchema.optional(),

  // Properties
  properties: materialPropertiesSchema.optional(),

  // Units
  baseUnit: z.string().min(1, 'Base unit is required'),
  alternateUnits: z.array(unitConversionSchema).optional(),

  // Procurement
  preferredVendors: z.array(z.string()).default([]),
  leadTimeDays: z.number().int().positive().optional(),
  minimumOrderQuantity: z.number().positive().optional(),

  // Stock Management
  trackInventory: z.boolean().default(false),
  currentStock: z.number().min(0).optional(),
  reorderLevel: z.number().positive().optional(),
  reorderQuantity: z.number().positive().optional(),

  // Documentation
  datasheetUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  certifications: z.array(z.string()).default([]),

  // Search & Organization
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isStandard: z.boolean().default(false),

  // Substitution
  substituteMaterials: z.array(z.string()).optional(),
  substituteNotes: z.string().optional(),
});

/**
 * Quantity break schema
 */
export const quantityBreakSchema = z.object({
  minQuantity: z.number().positive('Minimum quantity must be positive'),
  maxQuantity: z.number().positive().optional(),
  pricePerUnit: moneySchema,
});

/**
 * Material price schema
 */
export const materialPriceSchema = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1, 'Material ID is required'),

  // Price Details
  pricePerUnit: moneySchema,
  unit: z.string().min(1, 'Unit is required'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED']).default('INR'),

  // Vendor & Source
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  sourceType: z.enum(['VENDOR_QUOTE', 'MARKET_RATE', 'HISTORICAL', 'ESTIMATED', 'CONTRACT_RATE']),

  // Validity
  effectiveDate: z.date(),
  expiryDate: z.date().optional(),

  // Quantity Tiers
  quantityBreaks: z.array(quantityBreakSchema).optional(),

  // Context
  remarks: z.string().optional(),
  documentReference: z.string().optional(),

  // Status
  isActive: z.boolean().default(false),
  isForecast: z.boolean().default(false),
});

/**
 * Stock movement schema
 */
export const stockMovementSchema = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1, 'Material ID is required'),
  movementType: z.enum([
    'INCREASE_PURCHASE',
    'INCREASE_PRODUCTION',
    'DECREASE_CONSUMPTION',
    'DECREASE_WASTAGE',
    'ADJUSTMENT',
  ]),
  quantity: z.number().refine((val) => val !== 0, 'Quantity cannot be zero'),
  unit: z.string().min(1, 'Unit is required'),
  reason: z.string().min(1, 'Reason is required'),
  documentReference: z.string().optional(),
});

// ============================================================================
// Shape Database Validation Schemas
// ============================================================================

/**
 * Formula constant schema
 */
export const formulaConstantSchema = z.object({
  name: z.string().min(1, 'Constant name is required'),
  value: z.number(),
});

/**
 * Expected range schema
 */
export const expectedRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  warning: z.string().optional(),
});

/**
 * Formula definition schema
 */
export const formulaDefinitionSchema = z.object({
  expression: z.string().min(1, 'Formula expression is required'),
  variables: z.array(z.string()),
  constants: z.array(formulaConstantSchema).optional(),
  unit: z.string().min(1, 'Result unit is required'),
  description: z.string().optional(),
  requiresDensity: z.boolean().optional(),
  expectedRange: expectedRangeSchema.optional(),
});

/**
 * Blank definition schema
 */
export const blankDefinitionSchema = z.object({
  blankType: z.enum(['RECTANGULAR', 'CIRCULAR', 'CUSTOM']),
  blankLength: formulaDefinitionSchema.optional(),
  blankWidth: formulaDefinitionSchema.optional(),
  blankDiameter: formulaDefinitionSchema.optional(),
  blankThickness: z.string().optional(),
  scrapFormula: formulaDefinitionSchema.optional(),
  description: z.string().optional(),
  diagram: z.string().url('Invalid diagram URL').optional().or(z.literal('')),
});

/**
 * Custom formula schema
 */
export const customFormulaSchema = z.object({
  name: z.string().min(1, 'Formula name is required'),
  formula: formulaDefinitionSchema,
  unit: z.string().min(1, 'Unit is required'),
});

/**
 * Shape formulas schema
 */
export const shapeFormulasSchema = z.object({
  volume: formulaDefinitionSchema.optional(),
  weight: formulaDefinitionSchema.optional(),
  surfaceArea: formulaDefinitionSchema.optional(),
  innerSurfaceArea: formulaDefinitionSchema.optional(),
  outerSurfaceArea: formulaDefinitionSchema.optional(),
  wettedArea: formulaDefinitionSchema.optional(),
  blankDimensions: blankDefinitionSchema.optional(),
  blankArea: formulaDefinitionSchema.optional(),
  finishedArea: formulaDefinitionSchema.optional(),
  scrapPercentage: formulaDefinitionSchema.optional(),
  edgeLength: formulaDefinitionSchema.optional(),
  weldLength: formulaDefinitionSchema.optional(),
  customFormulas: z.array(customFormulaSchema).optional(),
});

/**
 * Parameter option schema (for SELECT type parameters)
 */
export const parameterOptionSchema = z.object({
  value: z.string().min(1, 'Option value is required'),
  label: z.string().min(1, 'Option label is required'),
  numericValue: z.number().optional(),
});

/**
 * Shape parameter schema
 */
export const shapeParameterSchema = z.object({
  name: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Invalid parameter name (must start with letter)'),
  label: z.string().min(1, 'Parameter label is required'),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  dataType: z.enum(['NUMBER', 'SELECT', 'BOOLEAN', 'TEXT']),
  defaultValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  options: z.array(parameterOptionSchema).optional(),
  order: z.number().int().positive('Order must be positive'),
  required: z.boolean().default(true),
  helpText: z.string().optional(),
  usedInFormulas: z.array(z.string()).default([]),
});

/**
 * Shape standard reference schema
 */
export const shapeStandardSchema = z.object({
  code: z.string().min(1, 'Standard code is required'),
  figureNumber: z.string().optional(),
  edition: z.string().optional(),
});

/**
 * Fabrication cost schema
 */
export const fabricationCostSchema = z.object({
  baseCost: z.number().min(0).optional(),
  costPerKg: z.number().min(0).optional(),
  costPerSurfaceArea: z.number().min(0).optional(),
  laborHours: z.number().min(0).optional(),
  setupCost: z.number().min(0).optional(),
  formula: z.string().optional(),
});

/**
 * Validation rule schema
 */
export const validationRuleSchema = z.object({
  parameterName: z.string().min(1, 'Parameter name is required'),
  rule: z.enum(['MIN', 'MAX', 'RANGE', 'REQUIRED', 'CUSTOM']),
  value: z.union([z.number(), z.array(z.number()), z.string()]),
  errorMessage: z.string().min(1, 'Error message is required'),
});

/**
 * Shape schema (main entity)
 */
export const shapeSchema = z.object({
  // Identity (optional for creation, required for update)
  id: z.string().optional(),
  shapeCode: z.string().optional(), // Auto-generated if not provided
  customCode: z.string().optional(),
  name: z
    .string()
    .min(3, 'Shape name must be at least 3 characters')
    .max(200, 'Shape name too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),

  // Classification
  category: z.string().min(1, 'Shape category is required'),
  subCategory: z.string().optional(),
  shapeType: z.enum(['STANDARD', 'PARAMETRIC', 'CUSTOM']),

  // Standard Reference
  standard: shapeStandardSchema.optional(),

  // Parameters (at least one required)
  parameters: z.array(shapeParameterSchema).min(1, 'At least one parameter is required'),

  // Material Compatibility (at least one material category required)
  allowedMaterialCategories: z
    .array(z.string())
    .min(1, 'At least one compatible material category is required'),
  defaultMaterialCategory: z.string().optional(),

  // Formulas (at least volume formula required for most shapes)
  formulas: shapeFormulasSchema,

  // Fabrication Cost
  fabricationCost: fabricationCostSchema.optional(),

  // Visualization
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  threeDModelUrl: z.string().url('Invalid 3D model URL').optional().or(z.literal('')),
  sketchUrl: z.string().url('Invalid sketch URL').optional().or(z.literal('')),

  // Organization
  tags: z.array(z.string()).default([]),
  isStandard: z.boolean().default(false),
  isActive: z.boolean().default(true),
  usageCount: z.number().int().min(0).default(0),

  // Validation Rules
  validationRules: z.array(validationRuleSchema).optional(),
});

/**
 * Parameter value schema (for shape instances)
 */
export const parameterValueSchema = z.object({
  parameterName: z.string().min(1, 'Parameter name is required'),
  value: z.union([z.number(), z.string(), z.boolean()]),
  unit: z.string().min(1, 'Unit is required'),
});

/**
 * Shape instance schema (used in BOM)
 */
export const shapeInstanceSchema = z.object({
  id: z.string().optional(),
  shapeId: z.string().min(1, 'Shape ID is required'),
  shapeName: z.string().min(1, 'Shape name is required'),
  shapeCategory: z.string().min(1, 'Shape category is required'),

  // Material Selection
  materialId: z.string().min(1, 'Material ID is required'),
  materialName: z.string().min(1, 'Material name is required'),
  materialDensity: z.number().positive('Material density must be positive'),
  materialPricePerKg: z.number().min(0, 'Material price must be non-negative'),

  // Parameters
  parameterValues: z.array(parameterValueSchema).min(1, 'At least one parameter value is required'),

  // Quantity
  quantity: z.number().int().positive('Quantity must be positive'),

  // Notes
  remarks: z.string().optional(),
});

/**
 * Calculation request schema
 */
export const calculationRequestSchema = z.object({
  shapeId: z.string().min(1, 'Shape ID is required'),
  parameterValues: z.array(parameterValueSchema).min(1, 'Parameter values are required'),
  materialId: z.string().min(1, 'Material ID is required'),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
});

// ========================================
// BOM (Bill of Materials) Validation Schemas
// ========================================

/**
 * BOM Category enum schema
 */
export const bomCategorySchema = z.enum([
  'HEAT_EXCHANGER',
  'PRESSURE_VESSEL',
  'STORAGE_TANK',
  'PIPING_ASSEMBLY',
  'PUMP_PACKAGE',
  'STRUCTURE',
  'ELECTRICAL',
  'INSTRUMENTATION_PACKAGE',
  'HVAC',
  'GENERAL_EQUIPMENT',
  'OTHER',
]);

/**
 * BOM Status enum schema
 */
export const bomStatusSchema = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'RELEASED',
  'ARCHIVED',
]);

/**
 * BOM Item Type enum schema
 */
export const bomItemTypeSchema = z.enum(['ASSEMBLY', 'PART', 'MATERIAL']);

/**
 * Shape parameters schema (key-value pairs)
 */
export const shapeParametersSchema = z.record(z.string(), z.number());

/**
 * BOM Summary schema
 */
export const bomSummarySchema = z.object({
  totalWeight: z.number().min(0, 'Total weight must be non-negative'),
  totalMaterialCost: z.number().min(0, 'Total material cost must be non-negative'),
  totalCost: z.number().min(0, 'Total cost must be non-negative'),
  itemCount: z.number().int().min(0, 'Item count must be non-negative'),
});

/**
 * BOM Item Component schema
 */
export const bomItemComponentSchema = z.object({
  shapeId: z.string().optional(),
  shapeType: z.string().optional(),
  materialId: z.string().optional(),
  materialCode: z.string().optional(),
  materialGrade: z.string().optional(),
  parameters: shapeParametersSchema.optional(),
});

/**
 * BOM Item Calculated Properties schema
 */
export const bomItemCalculatedPropertiesSchema = z.object({
  weight: z.number().min(0).optional(),
  totalWeight: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
  surfaceArea: z.number().min(0).optional(),
});

/**
 * BOM Item Cost schema
 */
export const bomItemCostSchema = z.object({
  materialCostPerUnit: z.number().min(0).optional(),
  totalMaterialCost: z.number().min(0).optional(),
});

/**
 * Create BOM Input schema
 */
export const createBOMInputSchema = z.object({
  name: z
    .string()
    .min(1, 'BOM name is required')
    .max(200, 'BOM name must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: bomCategorySchema,
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  entityId: z.string().min(1, 'Entity ID is required'),
});

/**
 * Update BOM Input schema
 */
export const updateBOMInputSchema = z.object({
  name: z.string().min(1, 'BOM name is required').max(200).optional(),
  description: z.string().max(1000).optional(),
  category: bomCategorySchema.optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  status: bomStatusSchema.optional(),
});

/**
 * Create BOM Item Input schema
 */
export const createBOMItemInputSchema = z.object({
  itemType: bomItemTypeSchema,
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be less than 200 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(20, 'Unit must be less than 20 characters'),
  parentItemId: z.string().optional(),
  shapeId: z.string().optional(),
  materialId: z.string().optional(),
  parameters: shapeParametersSchema.optional(),
});

/**
 * Update BOM Item Input schema
 */
export const updateBOMItemInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).max(20).optional(),
  shapeId: z.string().optional(),
  materialId: z.string().optional(),
  parameters: shapeParametersSchema.optional(),
});

/**
 * BOM List Filters schema
 */
export const bomListFiltersSchema = z.object({
  entityId: z.string().optional(),
  projectId: z.string().optional(),
  category: bomCategorySchema.optional(),
  status: bomStatusSchema.optional(),
  searchTerm: z.string().optional(),
  createdBy: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});
