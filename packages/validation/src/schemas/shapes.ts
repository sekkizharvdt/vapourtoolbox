// Shape Database Validation Schemas

import { z } from 'zod';

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
