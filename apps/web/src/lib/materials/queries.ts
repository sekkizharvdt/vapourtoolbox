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
  type QueryConstraint,
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
 * Get materials by vendor ID with pagination
 *
 * @param db - Firestore instance
 * @param vendorId - Vendor entity ID
 * @param limitResults - Maximum number of results (default 100)
 * @returns MaterialListResult with materials and pagination info
 */
export async function getMaterialsByVendor(
  db: Firestore,
  vendorId: string,
  limitResults: number = 100
): Promise<MaterialListResult> {
  try {
    logger.debug('Getting materials by vendor', { vendorId, limitResults });

    const q = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('preferredVendors', 'array-contains', vendorId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitResults + 1)
    );

    const snapshot = await getDocs(q);

    const materials: Material[] = snapshot.docs.slice(0, limitResults).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Material[];

    const hasMore = snapshot.size > limitResults;
    const lastMaterial = materials[materials.length - 1];

    return {
      materials,
      hasMore,
      lastDoc: lastMaterial?.id,
    };
  } catch (error) {
    logger.error('Failed to get materials by vendor', { vendorId, error });
    throw new Error(
      `Failed to get materials by vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Query flat piping materials by family code.
 *
 * Used by the material picker to load all sizes/ratings for a given
 * material family (e.g., all WN flanges for CS A105).
 *
 * @param db - Firestore instance
 * @param familyCode - Family grouping code (e.g., "FL-WN-CS-A105")
 * @returns Array of materials sorted by materialCode
 */
export async function queryMaterialsByFamily(
  db: Firestore,
  familyCode: string
): Promise<Material[]> {
  try {
    logger.debug('Querying materials by family', { familyCode });

    const constraints: QueryConstraint[] = [
      where('familyCode', '==', familyCode),
      orderBy('materialCode', 'asc'),
    ];

    const q = query(collection(db, COLLECTIONS.MATERIALS), ...constraints);
    const snapshot = await getDocs(q);

    const materials: Material[] = snapshot.docs
      .map((doc) => docToTyped<Material>(doc.id, doc.data()))
      .filter((m) => m.isActive !== false);

    logger.debug('Family query returned', { familyCode, count: materials.length });
    return materials;
  } catch (error) {
    logger.error('Failed to query materials by family', { familyCode, error });
    throw new Error(
      `Failed to query materials by family: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get unique family entries for piping categories.
 *
 * Returns one representative material per familyCode for display in the
 * material picker's left panel (family list).
 *
 * @param db - Firestore instance
 * @param categories - Material categories to query
 * @returns Array of unique family representatives
 */
export async function queryPipingFamilies(
  db: Firestore,
  categories: MaterialCategory[]
): Promise<Material[]> {
  try {
    logger.debug('Querying piping families', { categories });

    const constraints: QueryConstraint[] = [
      where('category', 'in', categories),
      orderBy('materialCode', 'asc'),
      limit(500),
    ];

    const q = query(collection(db, COLLECTIONS.MATERIALS), ...constraints);
    const snapshot = await getDocs(q);

    // Group by familyCode, take the first as representative
    const familyMap = new Map<string, Material>();
    for (const doc of snapshot.docs) {
      const material = docToTyped<Material>(doc.id, doc.data());
      if (material.isActive === false) continue;
      if (material.isMigrated === true) continue; // Skip old parent docs
      // Skip old parent docs that haven't been migrated yet (they have
      // hasVariants=true but no familyCode — their flat children don't exist)
      if (material.hasVariants === true && !material.familyCode) continue;

      const family = material.familyCode || material.materialCode;
      if (!familyMap.has(family)) {
        familyMap.set(family, material);
      }
    }

    return Array.from(familyMap.values());
  } catch (error) {
    logger.error('Failed to query piping families', { categories, error });
    throw new Error(
      `Failed to query piping families: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
