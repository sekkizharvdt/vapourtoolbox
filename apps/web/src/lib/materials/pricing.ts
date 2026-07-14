/**
 * Material Price Management
 *
 * Provides functions for adding, retrieving, and managing material prices.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  type Firestore,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { MaterialPrice, CurrencyCode } from '@vapour/types';
import { getMaterialById } from './crud';
import { addBoughtOutPrice } from '@/lib/boughtOut/pricing';

const logger = createLogger({ context: 'materialService:pricing' });

// ============================================================================
// Interfaces
// ============================================================================

export interface PriceHistoryOptions {
  vendorId?: string;
  startDate?: Date;
  endDate?: Date;
  limitResults?: number;
}

// ============================================================================
// Price Management Functions
// ============================================================================

/**
 * Add a new price for a material
 *
 * @param db - Firestore instance
 * @param price - Material price data
 * @param userId - ID of user adding the price
 * @returns Created price with ID
 */
export async function addMaterialPrice(
  db: Firestore,
  price: Omit<MaterialPrice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string,
  tenantId: string
): Promise<MaterialPrice> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred to a future hardening pass (the static-export build can't make client-side gates load-bearing)
  try {
    logger.info('Adding material price', { materialId: price.materialId });

    const now = Timestamp.now();
    const newPrice: Omit<MaterialPrice, 'id'> & { tenantId: string } = {
      ...price,
      tenantId, // firestore.rules require this on materialPrices.create
      isActive: price.effectiveDate <= now,
      isForecast: price.effectiveDate > now,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    // Add price document
    const priceRef = await addDoc(collection(db, COLLECTIONS.MATERIAL_PRICES), newPrice);

    // Update material's current price only if this is newer than the existing price
    if (newPrice.isActive) {
      const material = await getMaterialById(db, price.materialId);
      const existingDate = material?.currentPrice?.effectiveDate;
      const isNewer = !existingDate || newPrice.effectiveDate.toMillis() >= existingDate.toMillis();

      if (isNewer) {
        const materialRef = doc(db, COLLECTIONS.MATERIALS, price.materialId);
        await updateDoc(materialRef, {
          currentPrice: { ...newPrice, id: priceRef.id },
          lastPriceUpdate: now,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    logger.info('Material price added successfully', { priceId: priceRef.id });

    return {
      ...newPrice,
      id: priceRef.id,
    };
  } catch (error) {
    logger.error('Failed to add material price', { error });
    throw new Error(
      `Failed to add material price: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get price history for a material
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @param options - Filter options
 * @returns Array of material prices sorted by effective date (newest first)
 */
export async function getMaterialPriceHistory(
  db: Firestore,
  materialId: string,
  options: PriceHistoryOptions = {}
): Promise<MaterialPrice[]> {
  try {
    logger.debug('Getting price history', { materialId });

    let priceQuery: Query<DocumentData> = query(
      collection(db, COLLECTIONS.MATERIAL_PRICES),
      where('materialId', '==', materialId),
      orderBy('effectiveDate', 'desc')
    );

    if (options.vendorId) {
      priceQuery = query(priceQuery, where('vendorId', '==', options.vendorId));
    }

    if (options.limitResults) {
      priceQuery = query(priceQuery, limit(options.limitResults));
    }

    const snapshot = await getDocs(priceQuery);

    let prices = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MaterialPrice[];

    // Client-side date filtering if needed
    if (options.startDate) {
      prices = prices.filter((p) => p.effectiveDate.toDate() >= options.startDate!);
    }
    if (options.endDate) {
      prices = prices.filter((p) => p.effectiveDate.toDate() <= options.endDate!);
    }

    return prices;
  } catch (error) {
    logger.error('Failed to get price history', { materialId, error });
    throw new Error(
      `Failed to get price history: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get current price for a material
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @returns Current material price or null
 */
export async function getCurrentPrice(
  db: Firestore,
  materialId: string
): Promise<MaterialPrice | null> {
  try {
    const material = await getMaterialById(db, materialId);
    return material?.currentPrice || null;
  } catch (error) {
    logger.error('Failed to get current price', { materialId, error });
    throw new Error(
      `Failed to get current price: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Procurement Price Feedback
// ============================================================================

export interface ProcurementPriceItem {
  materialId?: string;
  /** Bought-out catalog link — priced into bought_out_prices (A2 bridge). */
  boughtOutItemId?: string;
  /**
   * Service catalog link. Service rates flow through the explicit
   * accept-price action (serviceRates), not this bulk feedback — but a line
   * with a serviceId is still LINKED, so it isn't counted as leakage.
   */
  serviceId?: string;
  unitPrice: number;
  unit: string;
}

/**
 * Count lines with no catalog linkage at all — the "free-text leakage" whose
 * prices can't feed future estimates. NOTE lines are ignored (they carry no
 * price). Shared by recordProcurementPrices and the UI nudges after PO
 * creation / quote evaluation.
 */
export function countUnlinkedPriceLines(
  items: Array<{
    materialId?: string;
    boughtOutItemId?: string;
    serviceId?: string;
    itemType?: string;
  }>
): number {
  return items.filter(
    (item) =>
      item.itemType !== 'NOTE' && !item.materialId && !item.boughtOutItemId && !item.serviceId
  ).length;
}

/** Result of a procurement price feedback pass. */
export interface RecordProcurementPricesResult {
  /** Lines written to materialPrices / bought_out_prices. */
  recorded: number;
  /**
   * Lines with no catalog linkage at all (no materialId, boughtOutItemId, or
   * serviceId) — their prices are lost to future estimates. Surfaced so UIs
   * can nudge the user to link items.
   */
  unlinked: number;
}

/**
 * Record prices from procurement events back to the material and bought-out
 * catalogs (materialPrices + material.currentPrice; bought_out_prices +
 * bought_out_items.pricing.listPrice).
 *
 * Fire-and-forget — errors are logged but never thrown, so procurement
 * operations are not blocked by pricing failures.
 *
 * @param db - Firestore instance
 * @param items - Line items (those with materialId or boughtOutItemId are processed)
 * @param vendorId - Vendor entity ID
 * @param vendorName - Vendor display name
 * @param documentRef - Source document reference (PO number or offer ref)
 * @param currency - Currency code
 * @param priceType - 'budgetary' (offer evaluation) or 'confirmed' (PO creation)
 * @param userId - User performing the action
 * @returns Counts of recorded and unlinked lines (see RecordProcurementPricesResult)
 */
export async function recordProcurementPrices(
  db: Firestore,
  items: ProcurementPriceItem[],
  vendorId: string,
  vendorName: string,
  documentRef: string,
  currency: CurrencyCode,
  priceType: 'budgetary' | 'confirmed',
  userId: string,
  tenantId: string
): Promise<RecordProcurementPricesResult> {
  const itemsWithMaterial = items.filter((item) => item.materialId);
  // materialId wins when both are present (mirrors BOM costing priority)
  const itemsWithBoughtOut = items.filter((item) => !item.materialId && item.boughtOutItemId);
  const unlinked = countUnlinkedPriceLines(items);

  if (unlinked > 0) {
    logger.warn('Procurement lines not linked to any catalog item — prices not recorded', {
      unlinked,
      total: items.length,
      documentRef,
    });
  }

  const toRecord = itemsWithMaterial.length + itemsWithBoughtOut.length;
  if (toRecord === 0) return { recorded: 0, unlinked };

  const now = Timestamp.now();
  const isForecast = priceType === 'budgetary';
  const remarks = isForecast
    ? `Budgetary price from vendor quote (${documentRef})`
    : `Confirmed price from PO (${documentRef})`;

  const results = await Promise.allSettled([
    ...itemsWithMaterial.map((item) =>
      addMaterialPrice(
        db,
        {
          materialId: item.materialId!,
          pricePerUnit: { amount: item.unitPrice, currency },
          unit: item.unit,
          currency,
          vendorId,
          vendorName,
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: now,
          isActive: !isForecast,
          isForecast,
          documentReference: documentRef,
          remarks,
        },
        userId,
        tenantId
      )
    ),
    // Mirror of the material path for bought-out catalog lines (A2 bridge).
    // Budgetary prices are history-only (isActive false → no listPrice
    // denorm); confirmed prices also update the catalog's current price.
    ...itemsWithBoughtOut.map((item) =>
      addBoughtOutPrice(
        db,
        {
          boughtOutItemId: item.boughtOutItemId!,
          unitPrice: item.unitPrice,
          unit: item.unit,
          currency,
          vendorId,
          vendorName,
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: now,
          isActive: !isForecast,
          documentReference: documentRef,
          remarks,
          tenantId,
        },
        userId
      )
    ),
  ]);

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    logger.error('Some procurement prices failed to record', {
      total: toRecord,
      failed: failed.length,
      documentRef,
    });
  } else {
    logger.info('Procurement prices recorded', {
      count: toRecord,
      materials: itemsWithMaterial.length,
      boughtOut: itemsWithBoughtOut.length,
      priceType,
      documentRef,
    });
  }

  return { recorded: toRecord - failed.length, unlinked };
}
