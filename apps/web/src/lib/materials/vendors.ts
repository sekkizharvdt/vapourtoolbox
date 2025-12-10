/**
 * Material Vendor Management
 *
 * Provides functions for managing preferred vendors for materials.
 */

import { doc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { getMaterialById } from './crud';

const logger = createLogger({ context: 'materialService:vendors' });

/**
 * Add a vendor to material's preferred vendors list
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @param vendorId - Vendor entity ID
 * @param userId - ID of user adding the vendor
 */
export async function addPreferredVendor(
  db: Firestore,
  materialId: string,
  vendorId: string,
  userId: string
): Promise<void> {
  try {
    logger.info('Adding preferred vendor', { materialId, vendorId });

    const material = await getMaterialById(db, materialId);
    if (!material) {
      throw new Error('Material not found');
    }

    if (material.preferredVendors.includes(vendorId)) {
      logger.warn('Vendor already in preferred list', { materialId, vendorId });
      return;
    }

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      preferredVendors: [...material.preferredVendors, vendorId],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Preferred vendor added successfully', { materialId, vendorId });
  } catch (error) {
    logger.error('Failed to add preferred vendor', { materialId, vendorId, error });
    throw new Error(
      `Failed to add preferred vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Remove a vendor from material's preferred vendors list
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @param vendorId - Vendor entity ID
 * @param userId - ID of user removing the vendor
 */
export async function removePreferredVendor(
  db: Firestore,
  materialId: string,
  vendorId: string,
  userId: string
): Promise<void> {
  try {
    logger.info('Removing preferred vendor', { materialId, vendorId });

    const material = await getMaterialById(db, materialId);
    if (!material) {
      throw new Error('Material not found');
    }

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      preferredVendors: material.preferredVendors.filter((id) => id !== vendorId),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Preferred vendor removed successfully', { materialId, vendorId });
  } catch (error) {
    logger.error('Failed to remove preferred vendor', { materialId, vendorId, error });
    throw new Error(
      `Failed to remove preferred vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
