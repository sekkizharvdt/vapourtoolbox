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
  Timestamp,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseRequest, PurchaseRequestItem } from '@vapour/types';
import { generatePRNumber } from './utils';
import type {
  CreatePurchaseRequestInput,
  UpdatePurchaseRequestInput,
  ListPurchaseRequestsFilters,
} from './types';

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
    const prData: Omit<PurchaseRequest, 'id'> = {
      number: prNumber,

      // Classification
      type: input.type,
      category: input.category,

      // Project linkage
      projectId: input.projectId,
      projectName: input.projectName,

      // Header
      title: input.title,
      description: input.description,
      priority: input.priority || 'MEDIUM',
      requiredBy: input.requiredBy ? Timestamp.fromDate(input.requiredBy) : undefined,

      // Line items
      itemCount: input.items.length,

      // Bulk upload
      isBulkUpload: input.isBulkUpload || false,
      bulkUploadFileUrl: input.bulkUploadFileUrl,

      // Workflow
      status: 'DRAFT',

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
    input.items.forEach((item, index) => {
      const itemData: Omit<PurchaseRequestItem, 'id'> = {
        purchaseRequestId: prRef.id,

        // Item details
        lineNumber: index + 1,
        description: item.description,
        specification: item.specification,

        // Quantity
        quantity: item.quantity,
        unit: item.unit,

        // Material linkage
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,

        // Equipment linkage
        equipmentId: item.equipmentId,
        equipmentCode: item.equipmentCode,
        equipmentName: item.equipmentName,

        // Estimated cost
        estimatedUnitCost: item.estimatedUnitCost,
        estimatedTotalCost: item.estimatedUnitCost
          ? item.estimatedUnitCost * item.quantity
          : undefined,

        // Technical requirements
        technicalSpec: item.technicalSpec,
        drawingNumbers: item.drawingNumbers,
        makeModel: item.makeModel,

        // Delivery
        requiredBy: item.requiredBy ? Timestamp.fromDate(item.requiredBy) : undefined,
        deliveryLocation: item.deliveryLocation,

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

    return {
      prId: prRef.id,
      prNumber,
    };
  } catch (error) {
    console.error('[createPurchaseRequest] Error:', error);

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

    const request: PurchaseRequest = {
      id: docSnap.id,
      ...docSnap.data(),
    } as unknown as PurchaseRequest;
    return request;
  } catch (error) {
    console.error('[getPurchaseRequestById] Error:', error);
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
    console.error('[getPurchaseRequestItems] Error:', error);
    throw new Error('Failed to get purchase request items');
  }
}

/**
 * List Purchase Requests with optional filters
 */
export async function listPurchaseRequests(
  filters: ListPurchaseRequestsFilters = {}
): Promise<PurchaseRequest[]> {
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

    // Limit
    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }

    const q = query(collection(db, COLLECTIONS.PURCHASE_REQUESTS), ...constraints);
    const snapshot = await getDocs(q);

    const prs: PurchaseRequest[] = [];
    snapshot.forEach((doc) => {
      prs.push({
        id: doc.id,
        ...doc.data(),
      } as PurchaseRequest);
    });

    return prs;
  } catch (error) {
    console.error('[listPurchaseRequests] Error:', error);
    throw new Error('Failed to list purchase requests');
  }
}

/**
 * Update Purchase Request header fields
 */
export async function updatePurchaseRequest(
  prId: string,
  updates: UpdatePurchaseRequestInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);

    const updateData = {
      ...updates,
      requiredBy: updates.requiredBy ? Timestamp.fromDate(updates.requiredBy) : undefined,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('[updatePurchaseRequest] Error:', error);
    throw new Error('Failed to update purchase request');
  }
}

/**
 * Increment attachment count for a PR item
 */
export async function incrementAttachmentCount(itemId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error('Purchase request item not found');
    }

    const item = itemSnap.data() as PurchaseRequestItem;

    await updateDoc(itemRef, {
      attachmentCount: (item.attachmentCount || 0) + 1,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[incrementAttachmentCount] Error:', error);
    // Don't throw - attachment count is not critical
  }
}
