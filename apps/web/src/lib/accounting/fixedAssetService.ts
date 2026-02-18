/**
 * Fixed Asset Service
 * CRUD operations, asset number generation, and depreciation calculations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { requirePermission } from '@/lib/auth/authorizationService';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type {
  FixedAsset,
  CreateFixedAssetInput,
  UpdateFixedAssetInput,
  DisposeAssetInput,
  AssetCategory,
  AssetStatus,
} from '@vapour/types';
import {
  DEPRECIATION_RATES,
  ASSET_CATEGORY_ACCOUNTS,
  DEPRECIATION_EXPENSE_CODE,
} from '@vapour/types';

const logger = createLogger({ context: 'fixedAssetService' });

// ---------------------------------------------------------------------------
// Asset Number Generation
// ---------------------------------------------------------------------------

/**
 * Generate next asset number using atomic Firestore counter
 * Format: FA-YYYY-NNNN (e.g., FA-2026-0001)
 */
async function generateAssetNumber(): Promise<string> {
  const { db } = getFirebase();
  const year = new Date().getFullYear();
  const counterKey = `fixed-asset-${year}`;
  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const assetNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let sequence = 1;
    if (counterDoc.exists()) {
      const data = counterDoc.data();
      sequence = (data.value || 0) + 1;
      transaction.update(counterRef, {
        value: sequence,
        updatedAt: Timestamp.now(),
      });
    } else {
      transaction.set(counterRef, {
        value: 1,
        type: 'fixed-asset',
        year,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return `FA-${year}-${String(sequence).padStart(4, '0')}`;
  });

  return assetNumber;
}

// ---------------------------------------------------------------------------
// GL Account Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve GL account IDs from COA by account code
 */
async function resolveAccountByCode(
  code: string
): Promise<{ id: string; code: string; name: string } | null> {
  const { db } = getFirebase();
  const q = query(collection(db, COLLECTIONS.ACCOUNTS), where('code', '==', code), limit(1));
  const snapshot = await getDocs(q);

  const docSnap = snapshot.docs[0];
  if (!docSnap) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    code: data.code as string,
    name: data.name as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new fixed asset
 */
export async function createFixedAsset(
  input: CreateFixedAssetInput,
  userId: string,
  userPermissions: number,
  entityId: string
): Promise<{ id: string; assetNumber: string }> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    userId,
    'create fixed asset'
  );

  const { db } = getFirebase();

  // Generate asset number
  const assetNumber = await generateAssetNumber();

  // Resolve GL accounts by category
  const categoryAccounts = ASSET_CATEGORY_ACCOUNTS[input.category];
  const assetAccount = await resolveAccountByCode(categoryAccounts.asset);
  const accumDepAccount = await resolveAccountByCode(categoryAccounts.accumDep);
  const depExpenseAccount = await resolveAccountByCode(DEPRECIATION_EXPENSE_CODE);

  if (!assetAccount) {
    throw new Error(
      `Asset account ${categoryAccounts.asset} not found in Chart of Accounts. Please add it first.`
    );
  }

  // Get default depreciation rate for category
  const defaults = DEPRECIATION_RATES[input.category];
  const method = input.depreciationMethod;
  const rate = input.depreciationRatePercent ?? (method === 'WDV' ? defaults.wdv : defaults.slm);
  const usefulLife = input.usefulLifeYears ?? defaults.usefulLife;
  const residualValue = input.residualValue ?? 0;

  const now = Timestamp.now();

  const assetData: Omit<FixedAsset, 'id'> = {
    assetNumber,
    entityId,
    name: input.name,
    ...(input.description && { description: input.description }),
    category: input.category,
    status: 'ACTIVE' as AssetStatus,
    purchaseDate: input.purchaseDate,
    purchaseAmount: input.purchaseAmount,
    ...(input.vendor && { vendor: input.vendor }),
    ...(input.vendorId && { vendorId: input.vendorId }),
    ...(input.sourceBillId && { sourceBillId: input.sourceBillId }),
    ...(input.sourceBillNumber && { sourceBillNumber: input.sourceBillNumber }),
    ...(input.location && { location: input.location }),
    ...(input.assignedTo && { assignedTo: input.assignedTo }),
    ...(input.assignedToUserId && { assignedToUserId: input.assignedToUserId }),
    ...(input.costCentreId && { costCentreId: input.costCentreId }),
    ...(input.projectId && { projectId: input.projectId }),

    // GL account mapping
    assetAccountId: assetAccount.id,
    assetAccountCode: assetAccount.code,
    accumulatedDepAccountId: accumDepAccount?.id ?? '',
    accumulatedDepAccountCode: accumDepAccount?.code ?? categoryAccounts.accumDep,
    depreciationExpenseAccountId: depExpenseAccount?.id ?? '',

    // Depreciation config
    depreciationMethod: method,
    depreciationRatePercent: rate,
    ...(usefulLife > 0 && { usefulLifeYears: usefulLife }),
    residualValue,

    // Depreciation tracking (initial)
    totalDepreciation: 0,
    writtenDownValue: input.purchaseAmount,

    // Metadata
    ...(input.notes && { notes: input.notes }),
    ...(input.tags && input.tags.length > 0 && { tags: input.tags }),
    createdBy: userId,
    createdAt: now as unknown as Date,
    updatedAt: now as unknown as Date,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.FIXED_ASSETS), assetData);

  logger.info('Fixed asset created', { id: docRef.id, assetNumber, category: input.category });

  return { id: docRef.id, assetNumber };
}

/**
 * Get a fixed asset by ID
 */
export async function getFixedAssetById(id: string): Promise<FixedAsset | null> {
  const { db } = getFirebase();

  const docSnap = await getDoc(doc(db, COLLECTIONS.FIXED_ASSETS, id));
  if (!docSnap.exists()) return null;

  return docToTyped<FixedAsset>(docSnap.id, docSnap.data());
}

/**
 * Filter options for listing fixed assets
 */
export interface ListFixedAssetsFilters {
  entityId: string;
  status?: AssetStatus;
  category?: AssetCategory;
  search?: string;
  limitCount?: number;
}

/**
 * List fixed assets with filters
 */
export async function listFixedAssets(filters: ListFixedAssetsFilters): Promise<FixedAsset[]> {
  const { db } = getFirebase();

  const constraints = [
    where('entityId', '==', filters.entityId),
    ...(filters.status ? [where('status', '==', filters.status)] : []),
    ...(filters.category ? [where('category', '==', filters.category)] : []),
    orderBy('createdAt', 'desc'),
    ...(filters.limitCount ? [limit(filters.limitCount)] : []),
  ];

  const q = query(collection(db, COLLECTIONS.FIXED_ASSETS), ...constraints);
  const snapshot = await getDocs(q);

  let assets = snapshot.docs.map((d) => docToTyped<FixedAsset>(d.id, d.data()));

  // Client-side search filter (Firestore doesn't support full-text search)
  if (filters.search) {
    const term = filters.search.toLowerCase();
    assets = assets.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.assetNumber.toLowerCase().includes(term) ||
        a.vendor?.toLowerCase().includes(term) ||
        a.location?.toLowerCase().includes(term) ||
        a.assignedTo?.toLowerCase().includes(term)
    );
  }

  // Client-side soft-delete filter
  return assets.filter((a) => !a.isDeleted);
}

/**
 * Update a fixed asset (non-financial fields only)
 */
export async function updateFixedAsset(
  id: string,
  input: UpdateFixedAssetInput,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    userId,
    'update fixed asset'
  );

  const { db } = getFirebase();

  const updates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  // Only include defined fields (Firestore rejects undefined)
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.location !== undefined) updates.location = input.location;
  if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
  if (input.assignedToUserId !== undefined) updates.assignedToUserId = input.assignedToUserId;
  if (input.costCentreId !== undefined) updates.costCentreId = input.costCentreId;
  if (input.projectId !== undefined) updates.projectId = input.projectId;
  if (input.depreciationMethod !== undefined) updates.depreciationMethod = input.depreciationMethod;
  if (input.depreciationRatePercent !== undefined)
    updates.depreciationRatePercent = input.depreciationRatePercent;
  if (input.usefulLifeYears !== undefined) updates.usefulLifeYears = input.usefulLifeYears;
  if (input.residualValue !== undefined) updates.residualValue = input.residualValue;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.tags !== undefined) updates.tags = input.tags;

  await updateDoc(doc(db, COLLECTIONS.FIXED_ASSETS, id), updates);
  logger.info('Fixed asset updated', { id });
}

/**
 * Dispose an asset (mark as DISPOSED)
 */
export async function disposeAsset(
  id: string,
  input: DisposeAssetInput,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    userId,
    'dispose fixed asset'
  );

  const asset = await getFixedAssetById(id);
  if (!asset) throw new Error('Asset not found');
  if (asset.status !== 'ACTIVE') throw new Error('Only ACTIVE assets can be disposed');

  const gainLoss = input.disposalAmount - asset.writtenDownValue;

  const { db } = getFirebase();
  await updateDoc(doc(db, COLLECTIONS.FIXED_ASSETS, id), {
    status: 'DISPOSED',
    disposalDate: input.disposalDate,
    disposalAmount: input.disposalAmount,
    disposalReason: input.disposalReason,
    gainLossOnDisposal: gainLoss,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Fixed asset disposed', { id, gainLoss });
  // TODO (Phase 2): Post disposal journal entry
}

/**
 * Write off an asset
 */
export async function writeOffAsset(
  id: string,
  reason: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    userId,
    'write off fixed asset'
  );

  const asset = await getFixedAssetById(id);
  if (!asset) throw new Error('Asset not found');
  if (asset.status !== 'ACTIVE') throw new Error('Only ACTIVE assets can be written off');

  const { db } = getFirebase();
  await updateDoc(doc(db, COLLECTIONS.FIXED_ASSETS, id), {
    status: 'WRITTEN_OFF',
    disposalDate: new Date(),
    disposalAmount: 0,
    disposalReason: reason,
    gainLossOnDisposal: -asset.writtenDownValue,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Fixed asset written off', { id, writtenDownValue: asset.writtenDownValue });
  // TODO (Phase 2): Post write-off journal entry
}

// ---------------------------------------------------------------------------
// Summary / Statistics
// ---------------------------------------------------------------------------

export interface AssetSummary {
  totalAssets: number;
  totalCost: number;
  totalDepreciation: number;
  netBookValue: number;
  byCategory: Record<string, { count: number; cost: number; depreciation: number; nbv: number }>;
}

/**
 * Get summary statistics for all active assets
 */
export async function getAssetSummary(entityId: string): Promise<AssetSummary> {
  const assets = await listFixedAssets({ entityId, status: 'ACTIVE' });

  const summary: AssetSummary = {
    totalAssets: 0,
    totalCost: 0,
    totalDepreciation: 0,
    netBookValue: 0,
    byCategory: {},
  };

  for (const asset of assets) {
    summary.totalAssets++;
    summary.totalCost += asset.purchaseAmount;
    summary.totalDepreciation += asset.totalDepreciation;
    summary.netBookValue += asset.writtenDownValue;

    const cat = asset.category;
    if (!summary.byCategory[cat]) {
      summary.byCategory[cat] = { count: 0, cost: 0, depreciation: 0, nbv: 0 };
    }
    summary.byCategory[cat].count++;
    summary.byCategory[cat].cost += asset.purchaseAmount;
    summary.byCategory[cat].depreciation += asset.totalDepreciation;
    summary.byCategory[cat].nbv += asset.writtenDownValue;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Depreciation Calculation (Pure Functions)
// ---------------------------------------------------------------------------

/**
 * Calculate monthly depreciation for an asset
 *
 * WDV: (WDV at start of year × rate%) / 12
 * SLM: (purchaseAmount - residualValue) / (usefulLifeYears × 12)
 */
export function calculateMonthlyDepreciation(asset: FixedAsset): number {
  if (asset.status !== 'ACTIVE') return 0;
  if (asset.category === 'LAND') return 0; // Land is not depreciable

  const rate = asset.depreciationRatePercent;

  if (asset.depreciationMethod === 'WDV') {
    // WDV method: rate applied on current written-down value
    const annualDep = (asset.writtenDownValue * rate) / 100;
    const monthlyDep = annualDep / 12;
    // Don't depreciate below residual value
    const maxDepreciation = Math.max(0, asset.writtenDownValue - asset.residualValue);
    return Math.min(monthlyDep, maxDepreciation);
  } else {
    // SLM method: fixed amount per month
    const usefulLife = asset.usefulLifeYears ?? 10;
    if (usefulLife === 0) return 0;
    const annualDep = (asset.purchaseAmount - asset.residualValue) / usefulLife;
    const monthlyDep = annualDep / 12;
    const maxDepreciation = Math.max(0, asset.writtenDownValue - asset.residualValue);
    return Math.min(monthlyDep, maxDepreciation);
  }
}

/**
 * Generate a depreciation schedule for an asset
 * Returns year-by-year projection until fully depreciated
 */
export function getDepreciationSchedule(asset: FixedAsset): Array<{
  year: number;
  openingWDV: number;
  depreciation: number;
  closingWDV: number;
}> {
  if (asset.category === 'LAND') return [];

  const schedule: Array<{
    year: number;
    openingWDV: number;
    depreciation: number;
    closingWDV: number;
  }> = [];

  const rate = asset.depreciationRatePercent;
  const residual = asset.residualValue;
  let wdv = asset.purchaseAmount;
  const purchaseYear =
    asset.purchaseDate instanceof Date
      ? asset.purchaseDate.getFullYear()
      : new Date().getFullYear();

  for (let year = purchaseYear; year < purchaseYear + 50; year++) {
    if (wdv <= residual + 0.01) break; // Fully depreciated

    let annualDep: number;
    if (asset.depreciationMethod === 'WDV') {
      annualDep = (wdv * rate) / 100;
    } else {
      const usefulLife = asset.usefulLifeYears ?? 10;
      annualDep = usefulLife > 0 ? (asset.purchaseAmount - residual) / usefulLife : 0;
    }

    // Cap at WDV minus residual
    annualDep = Math.min(annualDep, wdv - residual);
    annualDep = Math.round(annualDep * 100) / 100;

    schedule.push({
      year,
      openingWDV: Math.round(wdv * 100) / 100,
      depreciation: annualDep,
      closingWDV: Math.round((wdv - annualDep) * 100) / 100,
    });

    wdv -= annualDep;
  }

  return schedule;
}
