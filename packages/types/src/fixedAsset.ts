/**
 * Fixed Asset Types
 * Asset register, depreciation tracking, and disposal management
 */

/**
 * Asset categories relevant to an Indian manufacturing/EPC company
 */
export type AssetCategory =
  | 'PLANT_AND_MACHINERY'
  | 'FURNITURE_AND_FIXTURES'
  | 'COMPUTERS_AND_IT'
  | 'VEHICLES'
  | 'OFFICE_EQUIPMENT'
  | 'ELECTRICAL_INSTALLATIONS'
  | 'LAND'
  | 'BUILDING'
  | 'OTHER';

/**
 * Depreciation methods per Indian Companies Act / Income Tax Act
 */
export type DepreciationMethod = 'SLM' | 'WDV';

/**
 * Asset lifecycle status
 */
export type AssetStatus = 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF';

/**
 * Fixed Asset document stored in Firestore
 */
export interface FixedAsset {
  id: string;
  assetNumber: string; // FA-2026-0001
  entityId: string; // Multi-tenancy

  // Basic info
  name: string;
  description?: string;
  category: AssetCategory;
  status: AssetStatus;

  // Purchase info
  purchaseDate: Date;
  purchaseAmount: number; // Cost excl. GST (capitalized value)
  vendor?: string; // Vendor name (denormalized)
  vendorId?: string; // Entity ID if purchased through system

  // Source linking (bill or standalone)
  sourceBillId?: string; // Transaction ID of the vendor bill
  sourceBillNumber?: string; // e.g., "BILL-0042"

  // Location & assignment
  location?: string;
  assignedTo?: string; // Employee name
  assignedToUserId?: string;
  costCentreId?: string;
  projectId?: string;

  // GL account mapping
  assetAccountId: string; // COA account (e.g., 1503 Computers)
  assetAccountCode: string;
  accumulatedDepAccountId: string; // Contra account (e.g., 1603)
  accumulatedDepAccountCode: string;
  depreciationExpenseAccountId: string; // Expense account (e.g., 5208)

  // Depreciation config
  depreciationMethod: DepreciationMethod;
  depreciationRatePercent: number; // e.g., 40 for computers (IT Act WDV)
  usefulLifeYears?: number; // For SLM: e.g., 3 years for computers
  residualValue: number; // Scrap value (default 0)

  // Depreciation tracking
  totalDepreciation: number; // Running total of all depreciation posted
  writtenDownValue: number; // purchaseAmount - totalDepreciation
  lastDepreciationDate?: Date;

  // Disposal
  disposalDate?: Date;
  disposalAmount?: number; // Sale proceeds
  disposalReason?: string;
  gainLossOnDisposal?: number; // disposalAmount - writtenDownValue

  // Metadata
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
  isDeleted?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default depreciation rates per Indian Income Tax Act (WDV) and Companies Act (SLM)
 */
export const DEPRECIATION_RATES: Record<
  AssetCategory,
  { wdv: number; slm: number; usefulLife: number }
> = {
  PLANT_AND_MACHINERY: { wdv: 15, slm: 6.33, usefulLife: 15 },
  FURNITURE_AND_FIXTURES: { wdv: 10, slm: 6.33, usefulLife: 10 },
  COMPUTERS_AND_IT: { wdv: 40, slm: 33.33, usefulLife: 3 },
  VEHICLES: { wdv: 15, slm: 12.5, usefulLife: 8 },
  OFFICE_EQUIPMENT: { wdv: 15, slm: 6.33, usefulLife: 5 },
  ELECTRICAL_INSTALLATIONS: { wdv: 10, slm: 6.33, usefulLife: 10 },
  LAND: { wdv: 0, slm: 0, usefulLife: 0 }, // Not depreciable
  BUILDING: { wdv: 10, slm: 3.17, usefulLife: 30 },
  OTHER: { wdv: 15, slm: 6.33, usefulLife: 10 },
};

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  PLANT_AND_MACHINERY: 'Plant & Machinery',
  FURNITURE_AND_FIXTURES: 'Furniture & Fixtures',
  COMPUTERS_AND_IT: 'Computers & IT Equipment',
  VEHICLES: 'Vehicles',
  OFFICE_EQUIPMENT: 'Office Equipment',
  ELECTRICAL_INSTALLATIONS: 'Electrical Installations',
  LAND: 'Land',
  BUILDING: 'Building',
  OTHER: 'Other',
};

/**
 * Maps asset categories to COA account codes
 * Asset accounts: 1501-1509, Accumulated depreciation accounts: 1601-1609
 */
export const ASSET_CATEGORY_ACCOUNTS: Record<AssetCategory, { asset: string; accumDep: string }> = {
  PLANT_AND_MACHINERY: { asset: '1501', accumDep: '1601' },
  FURNITURE_AND_FIXTURES: { asset: '1502', accumDep: '1602' },
  COMPUTERS_AND_IT: { asset: '1503', accumDep: '1603' },
  VEHICLES: { asset: '1504', accumDep: '1604' },
  OFFICE_EQUIPMENT: { asset: '1505', accumDep: '1605' },
  ELECTRICAL_INSTALLATIONS: { asset: '1506', accumDep: '1606' },
  LAND: { asset: '1507', accumDep: '1607' },
  BUILDING: { asset: '1508', accumDep: '1608' },
  OTHER: { asset: '1509', accumDep: '1609' },
};

/** Depreciation expense account code */
export const DEPRECIATION_EXPENSE_CODE = '5208';

// ---------------------------------------------------------------------------
// Input types for service functions
// ---------------------------------------------------------------------------

export interface CreateFixedAssetInput {
  name: string;
  description?: string;
  category: AssetCategory;
  purchaseDate: Date;
  purchaseAmount: number;
  vendor?: string;
  vendorId?: string;
  sourceBillId?: string;
  sourceBillNumber?: string;
  location?: string;
  assignedTo?: string;
  assignedToUserId?: string;
  costCentreId?: string;
  projectId?: string;
  depreciationMethod: DepreciationMethod;
  depreciationRatePercent?: number; // Override default rate
  usefulLifeYears?: number;
  residualValue?: number;
  notes?: string;
  tags?: string[];
}

export interface UpdateFixedAssetInput {
  name?: string;
  description?: string;
  location?: string;
  assignedTo?: string;
  assignedToUserId?: string;
  costCentreId?: string;
  projectId?: string;
  depreciationMethod?: DepreciationMethod;
  depreciationRatePercent?: number;
  usefulLifeYears?: number;
  residualValue?: number;
  notes?: string;
  tags?: string[];
}

export interface DisposeAssetInput {
  disposalDate: Date;
  disposalAmount: number;
  disposalReason: string;
}
