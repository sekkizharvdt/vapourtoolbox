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
import type { MaterialPrice } from '@vapour/types';
import { getMaterialById } from './crud';

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
  userId: string
): Promise<MaterialPrice> {
  try {
    logger.info('Adding material price', { materialId: price.materialId });

    const now = Timestamp.now();
    const newPrice: Omit<MaterialPrice, 'id'> = {
      ...price,
      isActive: price.effectiveDate <= now,
      isForecast: price.effectiveDate > now,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    // Add price document
    const priceRef = await addDoc(collection(db, COLLECTIONS.MATERIAL_PRICES), newPrice);

    // Update material's current price if this is the latest active price
    if (newPrice.isActive) {
      const materialRef = doc(db, COLLECTIONS.MATERIALS, price.materialId);
      await updateDoc(materialRef, {
        currentPrice: { ...newPrice, id: priceRef.id },
        lastPriceUpdate: now,
        updatedAt: now,
        updatedBy: userId,
      });
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
