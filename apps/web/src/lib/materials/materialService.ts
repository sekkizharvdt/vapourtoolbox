/**
 * Material Database Service
 *
 * Provides server-side querying, CRUD operations, and filtering for materials database
 * with proper Firestore index optimization and ASME/ASTM standards compliance.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
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
import type {
  Material,
  MaterialCategory,
  MaterialType,
  MaterialPrice,
  MaterialSortField,
  MaterialSortDirection,
  StockMovement,
} from '@vapour/types';
import { getMaterialCodeParts } from '@vapour/types';

const logger = createLogger({ context: 'materialService' });

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

export interface PriceHistoryOptions {
  vendorId?: string;
  startDate?: Date;
  endDate?: Date;
  limitResults?: number;
}

// ============================================================================
// Material CRUD Operations
// ============================================================================

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
    const materialCode =
      materialData.materialCode || (await generateMaterialCode(db, materialData.category));

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
 * Generate unique material code (PL-SS-XX format)
 * Format: {FORM}-{MATERIAL}-{XX}
 * Example: PL-SS-01 (Plate - Stainless Steel #01)
 *
 * @param db - Firestore instance
 * @param category - Material category (e.g., PLATES_STAINLESS_STEEL)
 * @returns Promise<string> - Generated material code
 */
async function generateMaterialCode(
  db: Firestore,
  category: MaterialCategory
): Promise<string> {
  const codeParts = getMaterialCodeParts(category);

  if (!codeParts) {
    throw new Error(`Material code generation not supported for category: ${category}`);
  }

  const [form, material] = codeParts;
  const baseCode = `${form}-${material}`;

  // Query for the latest material code with this base code
  // Example: Query for all codes starting with "PL-SS-"
  const q = query(
    collection(db, COLLECTIONS.MATERIALS),
    where('materialCode', '>=', baseCode),
    where('materialCode', '<', `${baseCode}-ZZ`), // Exclude codes from other materials
    orderBy('materialCode', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  // If no materials exist for this type, start at 01
  if (snapshot.empty) {
    return `${baseCode}-01`;
  }

  const firstDoc = snapshot.docs[0];
  if (!firstDoc) {
    return `${baseCode}-01`;
  }

  const data = firstDoc.data();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const lastCode = data.materialCode as string;
  if (!lastCode) {
    return `${baseCode}-01`;
  }

  // Extract sequence number from last code
  // Example: "PL-SS-05" -> parts = ["PL", "SS", "05"]
  const parts = lastCode.split('-');
  const lastNumberStr = parts[2];
  if (!lastNumberStr) {
    return `${baseCode}-01`;
  }

  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;

  // Validate sequence limit (max 99 for 2-digit format)
  if (nextNumber > 99) {
    throw new Error(`Maximum material code limit reached for ${baseCode} (max: 99)`);
  }

  const nextNumberPadded = nextNumber.toString().padStart(2, '0');

  return `${baseCode}-${nextNumberPadded}`;
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

    const data = materialSnap.data();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      id: materialSnap.id,
      ...data,
    } as Material;
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

// ============================================================================
// Material Querying & Search
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
    const materials: Material[] = snapshot.docs.slice(0, limitResults).map((doc) => {
      const data = doc.data();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const material: Material = {
        id: doc.id,
        ...data,
      } as Material;
      return material;
    });

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
      const data = doc.data();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const material: Material = {
        id: doc.id,
        ...data,
      } as Material;

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

// ============================================================================
// Price Management
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

// ============================================================================
// Vendor Management
// ============================================================================

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

// ============================================================================
// Stock Management
// ============================================================================

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
