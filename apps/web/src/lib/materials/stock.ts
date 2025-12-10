/**
 * Material Stock Management
 *
 * Provides functions for tracking inventory and stock movements.
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
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { StockMovement } from '@vapour/types';
import { getMaterialById } from './crud';

const logger = createLogger({ context: 'materialService:stock' });

/**
 * Update material stock level
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @param movement - Stock movement data
 * @param userId - ID of user making the adjustment
 */
export async function updateMaterialStock(
  db: Firestore,
  materialId: string,
  movement: Omit<StockMovement, 'id' | 'materialId' | 'createdAt' | 'createdBy'>,
  userId: string
): Promise<void> {
  try {
    logger.info('Updating material stock', { materialId, movementType: movement.movementType });

    const material = await getMaterialById(db, materialId);
    if (!material) {
      throw new Error('Material not found');
    }

    if (!material.trackInventory) {
      throw new Error('Inventory tracking is not enabled for this material');
    }

    const currentStock = material.currentStock || 0;
    const quantity = movement.quantity;

    // Calculate new stock level
    let newStock = currentStock;
    if (
      movement.movementType === 'INCREASE_PURCHASE' ||
      movement.movementType === 'INCREASE_PRODUCTION' ||
      movement.movementType === 'ADJUSTMENT'
    ) {
      newStock += Math.abs(quantity);
    } else {
      newStock -= Math.abs(quantity);
    }

    if (newStock < 0) {
      throw new Error('Stock cannot be negative');
    }

    // Create stock movement record
    const stockMovement: Omit<StockMovement, 'id'> = {
      materialId,
      ...movement,
      createdAt: Timestamp.now(),
      createdBy: userId,
    };

    const movementRef = await addDoc(collection(db, COLLECTIONS.STOCK_MOVEMENTS), stockMovement);

    // Update material stock level
    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      currentStock: newStock,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Material stock updated successfully', {
      materialId,
      oldStock: currentStock,
      newStock,
      movementId: movementRef.id,
    });
  } catch (error) {
    logger.error('Failed to update material stock', { materialId, error });
    throw new Error(
      `Failed to update material stock: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get stock movement history for a material
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @param limitResults - Maximum number of results
 * @returns Array of stock movements sorted by date (newest first)
 */
export async function getStockMovementHistory(
  db: Firestore,
  materialId: string,
  limitResults: number = 50
): Promise<StockMovement[]> {
  try {
    logger.debug('Getting stock movement history', { materialId });

    const q = query(
      collection(db, COLLECTIONS.STOCK_MOVEMENTS),
      where('materialId', '==', materialId),
      orderBy('createdAt', 'desc'),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StockMovement[];
  } catch (error) {
    logger.error('Failed to get stock movement history', { materialId, error });
    throw new Error(
      `Failed to get stock movement history: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
