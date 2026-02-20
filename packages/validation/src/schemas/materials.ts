// Material Database Validation Schemas

import { z } from 'zod';
import { moneySchema } from './common';

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
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED']).default('INR'),

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
