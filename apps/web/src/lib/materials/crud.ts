/**
 * Material CRUD Operations
 *
 * Provides create, read, update, and delete operations for materials.
 */

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '../firebase/typeHelpers';
import type { Material, MaterialCategory } from '@vapour/types';
import { getMaterialCodeParts } from '@vapour/types';

const logger = createLogger({ context: 'materialService:crud' });

/**
 * Create a new material
 *
 * @param db - Firestore instance
 * @param materialData - Material data (without id)
 * @param userId - ID of user creating the material
 * @returns Created material with generated ID
 */
export async function createMaterial(
  db: Firestore,
  materialData: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<Material> {
  try {
    logger.info('Creating material', { name: materialData.name, category: materialData.category });

    // Generate material code if not provided
    // Requires grade from specification
    if (!materialData.materialCode && !materialData.specification.grade) {
      throw new Error('Material grade is required for code generation');
    }

    const materialCode =
      materialData.materialCode ||
      (await generateMaterialCode(
        db,
        materialData.category,
        materialData.specification.grade as string
      ));

    const now = Timestamp.now();
    const newMaterial: Omit<Material, 'id'> = {
      ...materialData,
      materialCode,
      priceHistory: [],
      preferredVendors: materialData.preferredVendors || [],
      tags: materialData.tags || [],
      certifications: materialData.certifications || [],
      isActive: materialData.isActive ?? true,
      isStandard: materialData.isStandard ?? false,
      trackInventory: materialData.trackInventory ?? false,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MATERIALS), newMaterial);

    logger.info('Material created successfully', { id: docRef.id, materialCode });

    return {
      ...newMaterial,
      id: docRef.id,
    };
  } catch (error) {
    logger.error('Failed to create material', { error });
    throw new Error(
      `Failed to create material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate material code (PL-SS-304 format)
 * Format: {FORM}-{MATERIAL}-{GRADE}
 * Example: PL-SS-304 (Plate - Stainless Steel - 304)
 *
 * Note: Each grade has exactly ONE material code.
 * All thickness/finish variations are stored as variants within that material.
 *
 * @param db - Firestore instance
 * @param category - Material category (e.g., PLATES_STAINLESS_STEEL)
 * @param grade - Material grade (e.g., "304", "304L", "316", "316L")
 * @returns Promise<string> - Generated material code
 */
async function generateMaterialCode(
  db: Firestore,
  category: MaterialCategory,
  grade: string
): Promise<string> {
  const codeParts = getMaterialCodeParts(category);

  if (!codeParts) {
    throw new Error(`Material code generation not supported for category: ${category}`);
  }

  const [form, material] = codeParts;

  // Normalize grade (remove spaces, convert to uppercase)
  const normalizedGrade = grade.replace(/\s+/g, '').toUpperCase();

  // Simple format: PL-SS-304 (no sequence number)
  const materialCode = `${form}-${material}-${normalizedGrade}`;

  // Check if this material code already exists
  const q = query(
    collection(db, COLLECTIONS.MATERIALS),
    where('materialCode', '==', materialCode),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    throw new Error(
      `Material code ${materialCode} already exists. Each grade should have only one material entry. Use variants for different thicknesses/finishes.`
    );
  }

  return materialCode;
}

/**
 * Update an existing material
 *
 * @param db - Firestore instance
 * @param materialId - Material ID to update
 * @param updates - Partial material data to update
 * @param userId - ID of user updating the material
 */
export async function updateMaterial(
  db: Firestore,
  materialId: string,
  updates: Partial<Omit<Material, 'id' | 'materialCode' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  try {
    logger.info('Updating material', { materialId });

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Material updated successfully', { materialId });
  } catch (error) {
    logger.error('Failed to update material', { materialId, error });
    throw new Error(
      `Failed to update material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get material by ID
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @returns Material or null if not found
 */
export async function getMaterialById(db: Firestore, materialId: string): Promise<Material | null> {
  try {
    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    const materialSnap = await getDoc(materialRef);

    if (!materialSnap.exists()) {
      return null;
    }

    return docToTyped<Material>(materialSnap.id, materialSnap.data());
  } catch (error) {
    logger.error('Failed to get material', { materialId, error });
    throw new Error(
      `Failed to get material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Soft delete a material (set isActive = false)
 *
 * @param db - Firestore instance
 * @param materialId - Material ID to delete
 * @param userId - ID of user deleting the material
 */
export async function deleteMaterial(
  db: Firestore,
  materialId: string,
  userId: string
): Promise<void> {
  try {
    logger.info('Soft deleting material', { materialId });

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      isActive: false,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Material soft deleted successfully', { materialId });
  } catch (error) {
    logger.error('Failed to delete material', { materialId, error });
    throw new Error(
      `Failed to delete material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
