/**
 * Material Querying & Search
 *
 * Provides server-side querying, filtering, and search for materials.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type Firestore,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '../firebase/typeHelpers';
import type {
  Material,
  MaterialCategory,
  MaterialType,
  MaterialSortField,
  MaterialSortDirection,
} from '@vapour/types';

const logger = createLogger({ context: 'materialService:queries' });

// ============================================================================
// Query Options & Interfaces
// ============================================================================

export interface MaterialQueryOptions {
  searchText?: string;
  categories?: MaterialCategory[];
  materialTypes?: MaterialType[];
  vendorIds?: string[];
  hasDatasheet?: boolean;
  isActive?: boolean;
  isStandard?: boolean;
  sortField?: MaterialSortField;
  sortDirection?: MaterialSortDirection;
  limitResults?: number;
  startAfterDoc?: string;
}

export interface MaterialListResult {
  materials: Material[];
  hasMore: boolean;
  lastDoc?: string;
}

// ============================================================================
// Querying Functions
// ============================================================================

/**
 * Query materials with server-side filtering
 *
 * This function builds optimized Firestore queries using composite indexes
 * to filter materials by category, type, vendor, and other criteria.
 *
 * **Required Firestore Composite Indexes:**
 * - materials: (category ASC, updatedAt DESC)
 * - materials: (isActive ASC, isStandard DESC)
 * - materials: (preferredVendors ARRAY_CONTAINS, updatedAt DESC)
 * - materials: (category ASC, isActive ASC, updatedAt DESC)
 *
 * @param db - Firestore instance
 * @param options - Query filtering options
 * @returns MaterialListResult with materials and pagination info
 */
export async function queryMaterials(
  db: Firestore,
  options: MaterialQueryOptions = {}
): Promise<MaterialListResult> {
  try {
    const {
      categories,
      materialTypes,
      isActive,
      isStandard,
      sortField = 'updatedAt',
      sortDirection = 'desc',
      limitResults = 50,
    } = options;

    logger.debug('Querying materials', { options });

    // Build query with filters
    let materialQuery: Query<DocumentData> = collection(db, COLLECTIONS.MATERIALS);

    // Add where clauses
    if (categories && categories.length > 0) {
      if (categories.length === 1) {
        materialQuery = query(materialQuery, where('category', '==', categories[0]));
      } else {
        materialQuery = query(materialQuery, where('category', 'in', categories));
      }
    }

    if (materialTypes && materialTypes.length > 0) {
      if (materialTypes.length === 1) {
        materialQuery = query(materialQuery, where('materialType', '==', materialTypes[0]));
      } else {
        materialQuery = query(materialQuery, where('materialType', 'in', materialTypes));
      }
    }

    if (isActive !== undefined) {
      materialQuery = query(materialQuery, where('isActive', '==', isActive));
    }

    if (isStandard !== undefined) {
      materialQuery = query(materialQuery, where('isStandard', '==', isStandard));
    }

    // Add ordering
    materialQuery = query(materialQuery, orderBy(sortField, sortDirection));

    // Add limit (fetch one extra to check if there are more results)
    materialQuery = query(materialQuery, limit(limitResults + 1));

    // Execute query
    const snapshot = await getDocs(materialQuery);

    logger.debug('Materials query executed', { resultsCount: snapshot.size });

    // Extract materials
    const materials: Material[] = snapshot.docs
      .slice(0, limitResults)
      .map((doc) => docToTyped<Material>(doc.id, doc.data()));

    // Check if there are more results
    const hasMore = snapshot.size > limitResults;

    const lastMaterial = materials[materials.length - 1];
    return {
      materials,
      hasMore,
      lastDoc: lastMaterial?.id,
    };
  } catch (error) {
    logger.error('Failed to query materials', { error });
    throw new Error(
      `Failed to query materials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search materials by text (name, description, custom code, tags)
 *
 * Note: This is a client-side filter after fetching results.
 * For production, consider using Algolia or similar for full-text search.
 *
 * @param db - Firestore instance
 * @param searchText - Text to search for
 * @param limitResults - Maximum number of results
 * @returns Array of matching materials
 */
export async function searchMaterials(
  db: Firestore,
  searchText: string,
  limitResults: number = 50
): Promise<Material[]> {
  try {
    logger.debug('Searching materials', { searchText });

    // Fetch all active materials (consider adding pagination for large datasets)
    const q = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitResults * 2) // Fetch more to account for filtering
    );

    const snapshot = await getDocs(q);

    // Client-side filter
    const searchLower = searchText.toLowerCase();
    const materials: Material[] = [];

    snapshot.docs.forEach((doc) => {
      const material = docToTyped<Material>(doc.id, doc.data());

      const matchesSearch =
        material.name.toLowerCase().includes(searchLower) ||
        material.description.toLowerCase().includes(searchLower) ||
        material.materialCode.toLowerCase().includes(searchLower) ||
        material.customCode?.toLowerCase().includes(searchLower) ||
        material.tags.some((tag) => tag.toLowerCase().includes(searchLower));

      if (matchesSearch) {
        materials.push(material);
      }
    });

    return materials.slice(0, limitResults);
  } catch (error) {
    logger.error('Failed to search materials', { error });
    throw new Error(
      `Failed to search materials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get materials by vendor ID
 *
 * @param db - Firestore instance
 * @param vendorId - Vendor entity ID
 * @returns Array of materials supplied by this vendor
 */
export async function getMaterialsByVendor(db: Firestore, vendorId: string): Promise<Material[]> {
  try {
    logger.debug('Getting materials by vendor', { vendorId });

    const q = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('preferredVendors', 'array-contains', vendorId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Material[];
  } catch (error) {
    logger.error('Failed to get materials by vendor', { vendorId, error });
    throw new Error(
      `Failed to get materials by vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
