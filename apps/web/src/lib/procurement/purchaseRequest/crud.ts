/**
 * Purchase Request CRUD Operations
 *
 * Create, Read, Update operations for Purchase Requests
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  increment,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PurchaseRequest, PurchaseRequestItem } from '@vapour/types';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { generatePRNumber } from './utils';
import type {
  CreatePurchaseRequestInput,
  UpdatePurchaseRequestInput,
  ListPurchaseRequestsFilters,
  PaginatedPurchaseRequestsResult,
} from './types';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'purchaseRequest/crud' });

/**
 * Create a new Purchase Request
 */
export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput,
  userId: string,
  userName: string
): Promise<{ prId: string; prNumber: string }> {
  const { db } = getFirebase();

  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Generate PR number
    const prNumber = await generatePRNumber();

    // Create PR document
    // Note: Firestore doesn't allow undefined values, so we conditionally add optional fields
    const prData: Omit<PurchaseRequest, 'id'> = {
      number: prNumber,

      // Classification
      type: input.type,
      category: input.category,

      // Project linkage
      ...(input.projectId && { projectId: input.projectId }),
      ...(input.projectName && { projectName: input.projectName }),

      // Header
      title: input.title,
      description: input.description,
      priority: input.priority || 'MEDIUM',
      ...(input.requiredBy && { requiredBy: Timestamp.fromDate(input.requiredBy) }),

      // Line items
      itemCount: input.items.length,

      // Bulk upload
      isBulkUpload: input.isBulkUpload || false,
      ...(input.bulkUploadFileUrl && { bulkUploadFileUrl: input.bulkUploadFileUrl }),

      // Workflow
      status: 'DRAFT',
      ...(input.approverId && { approverId: input.approverId }),
      ...(input.approverName && { approverName: input.approverName }),

      // Submitter
      submittedBy: userId,
      submittedByName: userName,

      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const prRef = doc(collection(db, COLLECTIONS.PURCHASE_REQUESTS));
    batch.set(prRef, prData);

    // Create line items
    // Note: Firestore doesn't allow undefined values, so we conditionally add optional fields
    input.items.forEach((item, index) => {
      const itemData: Omit<PurchaseRequestItem, 'id'> = {
        purchaseRequestId: prRef.id,

        // Item details
        lineNumber: index + 1,
        description: item.description,
        ...(item.specification && { specification: item.specification }),

        // Quantity
        quantity: item.quantity,
        unit: item.unit,

        // Material linkage (optional)
        ...(item.materialId && { materialId: item.materialId }),
        ...(item.materialCode && { materialCode: item.materialCode }),
        ...(item.materialName && { materialName: item.materialName }),

        // Equipment linkage (optional)
        ...(item.equipmentId && { equipmentId: item.equipmentId }),
        ...(item.equipmentCode && { equipmentCode: item.equipmentCode }),
        ...(item.equipmentName && { equipmentName: item.equipmentName }),

        // Estimated cost (optional)
        ...(item.estimatedUnitCost && {
          estimatedUnitCost: item.estimatedUnitCost,
          estimatedTotalCost: item.estimatedUnitCost * item.quantity,
        }),

        // Technical requirements (optional)
        ...(item.technicalSpec && { technicalSpec: item.technicalSpec }),
        ...(item.drawingNumbers && { drawingNumbers: item.drawingNumbers }),
        ...(item.makeModel && { makeModel: item.makeModel }),

        // Delivery (optional)
        ...(item.requiredBy && { requiredBy: Timestamp.fromDate(item.requiredBy) }),
        ...(item.deliveryLocation && { deliveryLocation: item.deliveryLocation }),

        // Documents
        attachmentCount: 0, // Will be updated when documents uploaded

        // Status
        status: 'PENDING',

        // Timestamps
        createdAt: now,
        updatedAt: now,
      };

      const itemRef = doc(collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS));
      batch.set(itemRef, itemData);
    });

    // Commit batch
    await batch.commit();

    // Audit log: PR created
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'PR_CREATED',
      'PURCHASE_REQUEST',
      prRef.id,
      `Created purchase request ${prNumber}: ${input.title}`,
      {
        entityName: prNumber,
        metadata: {
          type: input.type,
          category: input.category,
          itemCount: input.items.length,
          projectId: input.projectId,
          projectName: input.projectName,
          priority: input.priority || 'MEDIUM',
        },
      }
    );

    return {
      prId: prRef.id,
      prNumber,
    };
  } catch (error) {
    logger.error('Failed to create purchase request', { error });

    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for common Firestore permission errors
      if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
        throw new Error(
          'Permission denied: You need MANAGE_PROCUREMENT permission to create purchase requests. Please contact your administrator.'
        );
      }

      // Check for missing required fields
      if (error.message.includes('missing') || error.message.includes('required')) {
        throw new Error(`Invalid data: ${error.message}`);
      }

      // Preserve the original error message
      throw new Error(`Failed to create purchase request: ${error.message}`);
    }

    throw new Error('Failed to create purchase request: Unknown error occurred');
  }
}

/**
 * Get Purchase Request by ID
 */
export async function getPurchaseRequestById(prId: string): Promise<PurchaseRequest | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToTyped<PurchaseRequest>(docSnap.id, docSnap.data());
  } catch (error) {
    logger.error('Failed to get purchase request', { prId, error });
    throw new Error('Failed to get purchase request');
  }
}

/**
 * Get all line items for a Purchase Request
 */
export async function getPurchaseRequestItems(prId: string): Promise<PurchaseRequestItem[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS),
      where('purchaseRequestId', '==', prId),
      orderBy('lineNumber', 'asc')
    );

    const snapshot = await getDocs(q);
    const items: PurchaseRequestItem[] = [];

    snapshot.forEach((doc) => {
      items.push({
        id: doc.id,
        ...doc.data(),
      } as PurchaseRequestItem);
    });

    return items;
  } catch (error) {
    logger.error('Failed to get purchase request items', { prId, error });
    throw new Error('Failed to get purchase request items');
  }
}

/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 50;
/** Maximum allowed page size */
const MAX_PAGE_SIZE = 100;

/**
 * List Purchase Requests with optional filters and cursor-based pagination
 *
 * @param filters - Optional filters including pagination cursor
 * @returns Paginated result with items, cursor for next page, and hasMore flag
 */
export async function listPurchaseRequests(
  filters: ListPurchaseRequestsFilters = {}
): Promise<PaginatedPurchaseRequestsResult> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }

    if (filters.type) {
      constraints.push(where('type', '==', filters.type));
    }

    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    if (filters.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }

    // Order by creation date (newest first)
    constraints.push(orderBy('createdAt', 'desc'));

    // Handle cursor-based pagination
    if (filters.afterId) {
      const cursorDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, filters.afterId));
      if (cursorDoc.exists()) {
        constraints.push(startAfter(cursorDoc));
      } else {
        logger.warn('Pagination cursor document not found', { afterId: filters.afterId });
      }
    }

    // Apply limit (fetch one extra to determine hasMore)
    const pageSize = Math.min(filters.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    constraints.push(limit(pageSize + 1));

    const q = query(collection(db, COLLECTIONS.PURCHASE_REQUESTS), ...constraints);
    const snapshot = await getDocs(q);

    const prs: PurchaseRequest[] = [];
    snapshot.forEach((docSnap) => {
      prs.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as PurchaseRequest);
    });

    // Check if there are more results
    const hasMore = prs.length > pageSize;
    if (hasMore) {
      prs.pop(); // Remove the extra item used for hasMore check
    }

    return {
      items: prs,
      lastDocId: prs.length > 0 ? (prs[prs.length - 1]?.id ?? null) : null,
      hasMore,
    };
  } catch (error) {
    logger.error('Failed to list purchase requests', { filters, error });
    throw error;
  }
}

/**
 * Update Purchase Request header fields
 */
export async function updatePurchaseRequest(
  prId: string,
  updates: UpdatePurchaseRequestInput,
  userId: string,
  userName?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);

    // Get existing PR for audit log
    const existingSnap = await getDoc(docRef);
    const existingPR = existingSnap.exists() ? (existingSnap.data() as PurchaseRequest) : null;

    const updateData = {
      ...updates,
      requiredBy: updates.requiredBy ? Timestamp.fromDate(updates.requiredBy) : undefined,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await updateDoc(docRef, updateData);

    // Audit log: PR updated
    if (existingPR) {
      const auditContext = createAuditContext(userId, '', userName || userId);
      await logAuditEvent(
        db,
        auditContext,
        'PR_UPDATED',
        'PURCHASE_REQUEST',
        prId,
        `Updated purchase request ${existingPR.number}`,
        {
          entityName: existingPR.number,
          metadata: {
            updatedFields: Object.keys(updates),
          },
        }
      );
    }
  } catch (error) {
    logger.error('Failed to update purchase request', { prId, error });
    throw new Error('Failed to update purchase request');
  }
}

/**
 * Increment attachment count for a PR item
 * Uses atomic increment to prevent race conditions when multiple users upload simultaneously
 */
export async function incrementAttachmentCount(itemId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, itemId);

    // Use atomic increment - no read required, handles concurrent updates correctly
    await updateDoc(itemRef, {
      attachmentCount: increment(1),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to increment attachment count', { itemId, error });
    // Don't throw - attachment count is not critical
  }
}
