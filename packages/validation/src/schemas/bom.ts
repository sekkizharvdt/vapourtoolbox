// BOM (Bill of Materials) Validation Schemas

import { z } from 'zod';

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
