// BOM (Bill of Materials) / Estimation Module Types
// Week 1 Sprint - Simplified version for MVP

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money } from './common';

/**
 * BOM Status
 * Week 1: Only DRAFT status, workflow added in Week 3
 */
export type BOMStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'RELEASED' | 'ARCHIVED';

/**
 * BOM Category - Type of equipment/assembly
 */
export enum BOMCategory {
  HEAT_EXCHANGER = 'HEAT_EXCHANGER',
  PRESSURE_VESSEL = 'PRESSURE_VESSEL',
  STORAGE_TANK = 'STORAGE_TANK',
  PIPING_ASSEMBLY = 'PIPING_ASSEMBLY',
  PUMP_PACKAGE = 'PUMP_PACKAGE',
  STRUCTURE = 'STRUCTURE',
  ELECTRICAL = 'ELECTRICAL',
  INSTRUMENTATION_PACKAGE = 'INSTRUMENTATION_PACKAGE',
  HVAC = 'HVAC',
  GENERAL_EQUIPMENT = 'GENERAL_EQUIPMENT',
  OTHER = 'OTHER',
}

/**
 * BOM Category Labels for UI
 */
export const BOM_CATEGORY_LABELS: Record<BOMCategory, string> = {
  [BOMCategory.HEAT_EXCHANGER]: 'Heat Exchanger',
  [BOMCategory.PRESSURE_VESSEL]: 'Pressure Vessel',
  [BOMCategory.STORAGE_TANK]: 'Storage Tank',
  [BOMCategory.PIPING_ASSEMBLY]: 'Piping Assembly',
  [BOMCategory.PUMP_PACKAGE]: 'Pump Package',
  [BOMCategory.STRUCTURE]: 'Structure',
  [BOMCategory.ELECTRICAL]: 'Electrical',
  [BOMCategory.INSTRUMENTATION_PACKAGE]: 'Instrumentation Package',
  [BOMCategory.HVAC]: 'HVAC',
  [BOMCategory.GENERAL_EQUIPMENT]: 'General Equipment',
  [BOMCategory.OTHER]: 'Other',
};

/**
 * BOM Item Type
 */
export enum BOMItemType {
  ASSEMBLY = 'ASSEMBLY', // Group of parts
  PART = 'PART', // Individual component
  MATERIAL = 'MATERIAL', // Raw material (plate, pipe, etc.)
}

/**
 * BOM Item Type Labels
 */
export const BOM_ITEM_TYPE_LABELS: Record<BOMItemType, string> = {
  [BOMItemType.ASSEMBLY]: 'Assembly',
  [BOMItemType.PART]: 'Part',
  [BOMItemType.MATERIAL]: 'Material',
};

/**
 * Shape Parameters
 * Key-value pairs for shape dimensions (e.g., {D: 1000, L: 3000, t: 10})
 */
export type ShapeParameters = Record<string, number>;

/**
 * BOM Summary - Calculated totals
 */
export interface BOMSummary {
  totalWeight: number; // kg
  totalMaterialCost: Money; // Material cost only (Week 1)
  totalCost: Money; // Same as materialCost for Week 1
  itemCount: number;
}

/**
 * Main BOM Document
 * Simplified for Week 1 - focus on core functionality
 */
export interface BOM extends TimestampFields {
  id: string;
  bomCode: string; // EST-YYYY-NNNN (e.g., EST-2025-0001)
  name: string; // User-friendly name (e.g., "Heat Exchanger HX-101")
  description?: string;

  // Categorization
  category: BOMCategory;

  // Organization linkage
  entityId: string; // Company/entity this BOM belongs to

  // Project linkage (optional)
  projectId?: string;
  projectName?: string;

  // Summary (denormalized for quick access)
  summary: BOMSummary;

  // Status (Week 1: always DRAFT)
  status: BOMStatus;

  // Audit fields
  createdBy: string;
  updatedBy: string;

  // Version (Week 1: always 1, versioning added in Week 3)
  version: number;
}

/**
 * BOM Item - Individual component in the BOM
 * Stored in subcollection: /boms/{bomId}/items/{itemId}
 */
export interface BOMItem {
  id: string;
  bomId: string; // Parent BOM reference

  // Hierarchy
  itemNumber: string; // Hierarchical number: "1", "1.1", "1.2", "1.2.1"
  itemType: BOMItemType;
  parentItemId?: string; // null for root items
  level: number; // 0 for root, 1 for children, etc.
  sortOrder: number; // For maintaining order within same level

  // Basic info
  name: string;
  description?: string;

  // Quantity
  quantity: number;
  unit: string; // "nos", "kg", "m", "m²", etc.

  // Shape-based component (Week 1 focus)
  component?: {
    shapeId?: string; // Link to Shape Database
    shapeType?: string; // Shape type name (e.g., "Cylinder", "Plate")
    materialId?: string; // Link to Material Database
    materialCode?: string; // Material code for display
    materialGrade?: string; // Material grade for display
    parameters?: ShapeParameters; // Shape parameters {D: 1000, L: 3000}
  };

  // Calculated properties (auto-filled from shape calculations)
  calculatedProperties?: {
    weight?: number; // kg
    totalWeight?: number; // weight × quantity
    volume?: number; // m³
    surfaceArea?: number; // m²
  };

  // Cost (auto-calculated)
  cost?: {
    materialCostPerUnit?: Money; // Cost for 1 unit
    totalMaterialCost?: Money; // Cost × quantity
    // Week 2+: fabricationCost, totalCost
  };

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * BOM List Filter Options
 */
export interface BOMListFilters {
  entityId?: string;
  projectId?: string;
  category?: BOMCategory;
  status?: BOMStatus;
  searchTerm?: string; // Search in bomCode, name, description
  createdBy?: string;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
}

/**
 * BOM Item Cost Calculation Result
 */
export interface BOMItemCostCalculation {
  weight: number;
  totalWeight: number;
  materialCostPerUnit: Money;
  totalMaterialCost: Money;
}

/**
 * Create BOM Input
 */
export interface CreateBOMInput {
  name: string;
  description?: string;
  category: BOMCategory;
  projectId?: string;
  projectName?: string;
  entityId: string;
}

/**
 * Create BOM Item Input
 */
export interface CreateBOMItemInput {
  itemType: BOMItemType;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  parentItemId?: string;
  shapeId?: string;
  materialId?: string;
  parameters?: ShapeParameters;
}

/**
 * Update BOM Item Input
 */
export interface UpdateBOMItemInput {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  shapeId?: string;
  materialId?: string;
  parameters?: ShapeParameters;
}
