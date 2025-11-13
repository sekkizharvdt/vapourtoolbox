/**
 * Business Entity Service
 *
 * Provides server-side querying and filtering for business entities
 * with proper Firestore index optimization.
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
  type Firestore,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { BusinessEntity, Status, EntityRole } from '@vapour/types';

const logger = createLogger({ context: 'businessEntityService' });

/**
 * Entity search/filter options
 */
export interface EntityQueryOptions {
  status?: Status | Status[];
  role?: EntityRole | EntityRole[];
  isActive?: boolean;
  assignedToUserId?: string;
  orderByField?: 'createdAt' | 'name' | 'code';
  orderDirection?: 'asc' | 'desc';
  limitResults?: number;
}

/**
 * Query entities with server-side filtering
 *
 * This function builds optimized Firestore queries using composite indexes
 * to filter entities by status, role, and other criteria.
 *
 * **Required Firestore Composite Indexes:**
 * - entities: (isActive ASC, createdAt DESC)
 * - entities: (status ASC, createdAt DESC)
 * - entities: (status ASC, isActive ASC, createdAt DESC)
 *
 * @param db - Firestore instance
 * @param options - Query filtering options
 * @returns Array of matching business entities
 */
export async function queryEntities(
  db: Firestore,
  options: EntityQueryOptions = {}
): Promise<BusinessEntity[]> {
  try {
    const {
      status,
      role,
      isActive,
      assignedToUserId,
      orderByField = 'createdAt',
      orderDirection = 'desc',
      limitResults = 100,
    } = options;

    logger.debug('Querying entities', { options });

    // Build query with filters
    let entityQuery: Query<DocumentData> = collection(db, COLLECTIONS.ENTITIES);

    // Add where clauses
    const whereClauses: Array<Parameters<typeof where>> = [];

    if (status !== undefined) {
      if (Array.isArray(status)) {
        whereClauses.push(['status', 'in', status]);
      } else {
        whereClauses.push(['status', '==', status]);
      }
    }

    if (isActive !== undefined) {
      whereClauses.push(['isActive', '==', isActive]);
    }

    if (assignedToUserId) {
      whereClauses.push(['assignedToUserId', '==', assignedToUserId]);
    }

    // Apply where clauses
    whereClauses.forEach((whereClause) => {
      entityQuery = query(entityQuery, where(...whereClause));
    });

    // Add ordering
    entityQuery = query(entityQuery, orderBy(orderByField, orderDirection));

    // Add limit
    entityQuery = query(entityQuery, limit(limitResults));

    const snapshot = await getDocs(entityQuery);

    let entities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BusinessEntity[];

    // Filter out soft-deleted entities
    entities = entities.filter((entity) => entity.isDeleted !== true);

    // Client-side role filtering (Firestore doesn't support array-contains with IN)
    if (role !== undefined) {
      const roles = Array.isArray(role) ? role : [role];
      entities = entities.filter((entity) => roles.some((r) => entity.roles.includes(r)));
    }

    logger.info('Entities queried successfully', {
      count: entities.length,
      filters: options,
    });

    return entities;
  } catch (error) {
    logger.error('Error querying entities', { error, options: JSON.stringify(options) });
    throw new Error(
      `Failed to query entities: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get entity by ID
 */
export async function getEntityById(
  db: Firestore,
  entityId: string
): Promise<BusinessEntity | null> {
  try {
    const entityDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, entityId));

    if (!entityDoc.exists()) {
      return null;
    }

    const entity = {
      id: entityDoc.id,
      ...entityDoc.data(),
    } as unknown as BusinessEntity;

    // Check if soft-deleted
    if (entity.isDeleted === true) {
      return null;
    }

    return entity;
  } catch (error) {
    logger.error('Error getting entity by ID', { error, entityId });
    throw new Error(
      `Failed to get entity: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get active entities by role
 *
 * Common query for dropdowns and selectors
 *
 * @param db - Firestore instance
 * @param role - Entity role to filter by
 * @returns Array of active entities with the specified role
 */
export async function getActiveEntitiesByRole(
  db: Firestore,
  role: EntityRole
): Promise<BusinessEntity[]> {
  return queryEntities(db, {
    isActive: true,
    role,
    orderByField: 'name',
    orderDirection: 'asc',
  });
}

/**
 * Get vendors (active by default)
 */
export async function getVendors(db: Firestore, activeOnly = true): Promise<BusinessEntity[]> {
  return queryEntities(db, {
    role: 'VENDOR',
    ...(activeOnly && { isActive: true }),
    orderByField: 'name',
    orderDirection: 'asc',
  });
}

/**
 * Get customers (active by default)
 */
export async function getCustomers(db: Firestore, activeOnly = true): Promise<BusinessEntity[]> {
  return queryEntities(db, {
    role: 'CUSTOMER',
    ...(activeOnly && { isActive: true }),
    orderByField: 'name',
    orderDirection: 'asc',
  });
}

/**
 * Search entities by name or code (case-insensitive)
 *
 * Note: This still requires client-side filtering for text search
 * as Firestore doesn't support full-text search natively.
 * Consider using Algolia or Typesense for production full-text search.
 *
 * @param db - Firestore instance
 * @param searchTerm - Search term (searches in name and code)
 * @param options - Additional query options
 * @returns Filtered entities matching search term
 */
export async function searchEntities(
  db: Firestore,
  searchTerm: string,
  options: EntityQueryOptions = {}
): Promise<BusinessEntity[]> {
  // Get all entities matching the filter options
  const entities = await queryEntities(db, options);

  // Client-side text search (case-insensitive)
  const lowerSearchTerm = searchTerm.toLowerCase();

  return entities.filter(
    (entity) =>
      entity.nameNormalized?.includes(lowerSearchTerm) ||
      entity.name?.toLowerCase().includes(lowerSearchTerm) ||
      entity.code?.toLowerCase().includes(lowerSearchTerm) ||
      entity.contactPerson?.toLowerCase().includes(lowerSearchTerm) ||
      entity.email?.toLowerCase().includes(lowerSearchTerm)
  );
}

/**
 * Result of cascade delete check
 */
export interface CascadeCheckResult {
  canDelete: boolean;
  blockingReferences: {
    transactions: number;
    projects: number;
    purchaseOrders: number;
  };
  totalReferences: number;
  message: string;
}

/**
 * Check if an entity can be safely deleted
 *
 * Validates that no active references exist in:
 * - Transactions (vendor bills, customer invoices, etc.)
 * - Projects (as client entity)
 * - Purchase Orders (as vendor)
 *
 * @param db - Firestore instance
 * @param entityId - ID of entity to check
 * @returns Cascade check result with blocking references
 */
export async function checkEntityCascadeDelete(
  db: Firestore,
  entityId: string
): Promise<CascadeCheckResult> {
  try {
    logger.debug('Checking cascade delete for entity', { entityId });

    // Check transactions
    const transactionsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('entityId', '==', entityId),
      limit(1)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    const transactionCount = transactionsSnapshot.size;

    // Check projects (where this entity is the client)
    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('client.entityId', '==', entityId),
      limit(1)
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    const projectCount = projectsSnapshot.size;

    // Check purchase orders
    const purchaseOrdersQuery = query(
      collection(db, COLLECTIONS.PURCHASE_ORDERS),
      where('vendorId', '==', entityId),
      limit(1)
    );
    const purchaseOrdersSnapshot = await getDocs(purchaseOrdersQuery);
    const purchaseOrderCount = purchaseOrdersSnapshot.size;

    const totalReferences = transactionCount + projectCount + purchaseOrderCount;
    const canDelete = totalReferences === 0;

    let message = '';
    if (!canDelete) {
      const parts: string[] = [];
      if (transactionCount > 0) {
        parts.push(`${transactionCount} transaction(s)`);
      }
      if (projectCount > 0) {
        parts.push(`${projectCount} project(s)`);
      }
      if (purchaseOrderCount > 0) {
        parts.push(`${purchaseOrderCount} purchase order(s)`);
      }
      message = `Cannot delete entity: Referenced by ${parts.join(', ')}. Please remove or reassign these references first.`;
    } else {
      message = 'Entity can be safely deleted.';
    }

    const result: CascadeCheckResult = {
      canDelete,
      blockingReferences: {
        transactions: transactionCount,
        projects: projectCount,
        purchaseOrders: purchaseOrderCount,
      },
      totalReferences,
      message,
    };

    logger.info('Cascade delete check completed', { entityId, result });

    return result;
  } catch (error) {
    logger.error('Error checking cascade delete', { error, entityId });
    throw new Error(
      `Failed to check entity references: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
