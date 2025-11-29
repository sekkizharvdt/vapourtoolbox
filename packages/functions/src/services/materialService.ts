/**
 * Material Service Layer
 * CRUD operations for materials collection in Firestore (Cloud Functions)
 */

import { getFirestore } from 'firebase-admin/firestore';
import type { Material, MaterialCategory } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';

const db = getFirestore();

/**
 * Get a material by ID
 */
export async function getMaterialById(materialId: string): Promise<Material | null> {
  try {
    const doc = await db.collection(COLLECTIONS.MATERIALS).doc(materialId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Material;
  } catch (error) {
    throw new Error(
      `Failed to get material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a material by code
 */
export async function getMaterialByCode(materialCode: string): Promise<Material | null> {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.MATERIALS)
      .where('code', '==', materialCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Material;
  } catch (error) {
    throw new Error(
      `Failed to get material by code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * List materials with optional filters
 */
export async function listMaterials(options?: {
  category?: MaterialCategory;
  isActive?: boolean;
  limit?: number;
}): Promise<Material[]> {
  try {
    let query = db.collection(COLLECTIONS.MATERIALS) as FirebaseFirestore.Query;

    if (options?.category) {
      query = query.where('category', '==', options.category);
    }

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    const materials: Material[] = [];
    snapshot.forEach((doc) => {
      materials.push({
        id: doc.id,
        ...doc.data(),
      } as Material);
    });

    return materials;
  } catch (error) {
    throw new Error(
      `Failed to list materials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search materials by name or code
 */
export async function searchMaterials(
  searchTerm: string,
  options?: {
    category?: MaterialCategory;
    isActive?: boolean;
    limit?: number;
  }
): Promise<Material[]> {
  try {
    let query = db.collection(COLLECTIONS.MATERIALS) as FirebaseFirestore.Query;

    if (options?.category) {
      query = query.where('category', '==', options.category);
    }

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    // Firestore doesn't support full-text search natively
    // We'll get all matching documents and filter in memory
    const snapshot = await query.get();

    const materials: Material[] = [];
    const searchLower = searchTerm.toLowerCase();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const code = (data.code || '').toLowerCase();
      const grade = (data.grade || '').toLowerCase();

      if (name.includes(searchLower) || code.includes(searchLower) || grade.includes(searchLower)) {
        materials.push({
          id: doc.id,
          ...data,
        } as Material);
      }
    });

    // Apply limit
    const limit = options?.limit || 50;
    return materials.slice(0, limit);
  } catch (error) {
    throw new Error(
      `Failed to search materials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
