/**
 * Service Types — Unified Service Catalog
 *
 * Services used across both estimation (BOM costing) and procurement:
 * - Engineering/Drawing Generation
 * - Fabrication Services
 * - Inspection & QC
 * - Testing & Certification (lab tests, NDT, material analysis)
 * - Transportation
 * - Erection & Installation
 * - Commissioning
 * - Consulting (technical advisory, design review)
 * - Calibration (instrument calibration, gauge verification)
 * - Maintenance (preventive, corrective, AMC)
 * - Training (operator training, safety training)
 * - Other
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';
import { BOMCategory, BOMItemType, BOMComponentType } from './bom';

/**
 * Service Category
 */
export enum ServiceCategory {
  ENGINEERING = 'ENGINEERING',
  FABRICATION = 'FABRICATION',
  INSPECTION = 'INSPECTION',
  TESTING = 'TESTING',
  TRANSPORTATION = 'TRANSPORTATION',
  ERECTION = 'ERECTION',
  COMMISSIONING = 'COMMISSIONING',
  CONSULTING = 'CONSULTING',
  CALIBRATION = 'CALIBRATION',
  MAINTENANCE = 'MAINTENANCE',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER',
}

/**
 * Service Category Labels for UI
 */
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  [ServiceCategory.ENGINEERING]: 'Engineering/Drawing Generation',
  [ServiceCategory.FABRICATION]: 'Fabrication Services',
  [ServiceCategory.INSPECTION]: 'Inspection & QC',
  [ServiceCategory.TESTING]: 'Testing & Certification',
  [ServiceCategory.TRANSPORTATION]: 'Transportation',
  [ServiceCategory.ERECTION]: 'Erection & Installation',
  [ServiceCategory.COMMISSIONING]: 'Commissioning',
  [ServiceCategory.CONSULTING]: 'Consulting & Advisory',
  [ServiceCategory.CALIBRATION]: 'Calibration',
  [ServiceCategory.MAINTENANCE]: 'Maintenance & AMC',
  [ServiceCategory.TRAINING]: 'Training',
  [ServiceCategory.OTHER]: 'Other',
};

/**
 * Service Calculation Method
 * Determines how the service cost is calculated
 */
export enum ServiceCalculationMethod {
  PERCENTAGE_OF_MATERIAL = 'PERCENTAGE_OF_MATERIAL', // % of material cost only
  PERCENTAGE_OF_TOTAL = 'PERCENTAGE_OF_TOTAL', // % of (material + fabrication)
  FIXED_AMOUNT = 'FIXED_AMOUNT', // Fixed price per item
  PER_UNIT = 'PER_UNIT', // Rate × quantity
  CUSTOM_FORMULA = 'CUSTOM_FORMULA', // Custom calculation expression
}

/**
 * Service Calculation Method Labels
 */
export const SERVICE_CALCULATION_METHOD_LABELS: Record<ServiceCalculationMethod, string> = {
  [ServiceCalculationMethod.PERCENTAGE_OF_MATERIAL]: 'Percentage of Material Cost',
  [ServiceCalculationMethod.PERCENTAGE_OF_TOTAL]:
    'Percentage of Total Cost (Material + Fabrication)',
  [ServiceCalculationMethod.FIXED_AMOUNT]: 'Fixed Amount per Item',
  [ServiceCalculationMethod.PER_UNIT]: 'Rate per Unit',
  [ServiceCalculationMethod.CUSTOM_FORMULA]: 'Custom Formula',
};

/**
 * Service Master Catalog
 * Reusable service definitions
 */
export interface Service extends TimestampFields {
  id: string;
  serviceCode: string; // e.g., "ENG-DWG-001"
  name: string; // e.g., "Engineering Drawing Generation"
  description?: string;

  // Classification
  category: ServiceCategory;

  // Calculation Method
  calculationMethod: ServiceCalculationMethod;

  // Default Rate (can be overridden at BOM or item level)
  defaultRateValue?: number; // Percentage (15 = 15%) or amount depending on method
  defaultCurrency?: CurrencyCode; // For FIXED_AMOUNT and PER_UNIT methods
  defaultCustomFormula?: string; // For CUSTOM_FORMULA method

  // Applicability Rules (filter which items can use this service)
  applicableToCategories?: BOMCategory[]; // Empty = all categories
  applicableToItemTypes?: BOMItemType[]; // Empty = all types
  applicableToComponentTypes?: BOMComponentType[]; // Empty = all component types

  // Procurement Fields (optional — used when service is procured externally)
  preferredVendors?: string[]; // Entity IDs of preferred labs/vendors/consultants
  estimatedTurnaroundDays?: number; // Expected delivery time in days
  unit?: string; // e.g., "per test", "per sample", "per day", "lump sum"
  requiredAccreditations?: string[]; // e.g., "NABL", "ISO 17025", "BIS"
  testMethodStandard?: string; // e.g., "ASTM D3172", "ISO 11722"
  sampleRequirements?: string; // Description of sample needed for testing
  deliverables?: string[]; // e.g., "Test Certificate", "Analysis Report"
  tags?: string[]; // Searchable tags

  // Organization
  entityId: string; // Multi-tenant support
  isActive: boolean;
  isStandard: boolean; // Standard services vs. custom

  // Audit
  createdBy: string;
  updatedBy: string;
}

/**
 * Service Rate
 * Historical rates and overrides
 */
export interface ServiceRate extends TimestampFields {
  id: string;
  serviceId: string; // Parent service reference

  // Rate Configuration
  rateValue: number; // Percentage or amount depending on calculation method
  currency?: CurrencyCode; // Only for FIXED_AMOUNT and PER_UNIT
  customFormula?: string; // For CUSTOM_FORMULA method

  // Applicability Overrides
  applicableToCategories?: BOMCategory[];
  minOrderValue?: Money; // Apply only if order value >= this
  maxOrderValue?: Money; // Apply only if order value <= this

  // Validity Period
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
  isActive: boolean;

  // Audit
  createdBy: string;
  updatedBy: string;
}

/**
 * BOM Item Service Assignment
 * Links a service to a specific BOM item with optional rate override
 */
export interface BOMItemService {
  serviceId: string;
  serviceName: string; // Denormalized for display
  serviceCategory: ServiceCategory;
  calculationMethod: ServiceCalculationMethod;

  // Rate Override (if different from master rate)
  rateOverride?: {
    rateValue: number;
    currency?: CurrencyCode;
    customFormula?: string;
    reason?: string; // Why was the rate overridden?
  };

  // Calculated Cost (populated during cost calculation)
  calculatedCost?: Money;

  // Metadata
  isManualOverride: boolean; // True if rate was manually overridden
  addedBy: string;
  addedAt: Timestamp;
  notes?: string;
}

/**
 * Service Cost Breakdown
 * Detailed breakdown of service cost calculation
 */
export interface ServiceCostBreakdown {
  serviceId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  calculationMethod: ServiceCalculationMethod;

  // Calculation Details
  rateApplied: number; // The actual rate used (master or override)
  baseCost?: Money; // Base cost used for percentage calculations
  costPerUnit: Money;
  totalCost: Money;

  // Human-readable explanation
  calculationDetails: string; // e.g., "15% of material cost (₹10,000) = ₹1,500"

  // Metadata
  isOverridden: boolean;
  calculatedAt: Timestamp;
}

/**
 * Service Cost Calculation Input
 */
export interface ServiceCostCalculationInput {
  service: BOMItemService;
  materialCost: number; // Material cost per unit
  fabricationCost: number; // Fabrication cost per unit
  quantity: number;
  currency: CurrencyCode;
}

/**
 * Service Cost Calculation Result
 */
export interface ServiceCostCalculationResult {
  serviceId: string;
  serviceName: string;
  costPerUnit: Money;
  totalCost: Money;
  breakdown: ServiceCostBreakdown;
}

/**
 * Create Service Input
 */
export interface CreateServiceInput {
  serviceCode: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  calculationMethod: ServiceCalculationMethod;
  defaultRateValue?: number;
  defaultCurrency?: CurrencyCode;
  defaultCustomFormula?: string;
  applicableToCategories?: BOMCategory[];
  applicableToItemTypes?: BOMItemType[];
  applicableToComponentTypes?: BOMComponentType[];
  isStandard?: boolean;
}

/**
 * Update Service Input
 */
export interface UpdateServiceInput {
  name?: string;
  description?: string;
  calculationMethod?: ServiceCalculationMethod;
  defaultRateValue?: number;
  defaultCurrency?: CurrencyCode;
  defaultCustomFormula?: string;
  applicableToCategories?: BOMCategory[];
  applicableToItemTypes?: BOMItemType[];
  applicableToComponentTypes?: BOMComponentType[];
  isActive?: boolean;
  isStandard?: boolean;
}

/**
 * Create Service Rate Input
 */
export interface CreateServiceRateInput {
  serviceId: string;
  rateValue: number;
  currency?: CurrencyCode;
  customFormula?: string;
  applicableToCategories?: BOMCategory[];
  minOrderValue?: Money;
  maxOrderValue?: Money;
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
}

/**
 * Update Service Rate Input
 */
export interface UpdateServiceRateInput {
  rateValue?: number;
  currency?: CurrencyCode;
  customFormula?: string;
  applicableToCategories?: BOMCategory[];
  minOrderValue?: Money;
  maxOrderValue?: Money;
  effectiveDate?: Timestamp;
  expiryDate?: Timestamp;
  isActive?: boolean;
}
