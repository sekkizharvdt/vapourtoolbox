/**
 * Purchase Request Service
 *
 * Handles all Purchase Request operations:
 * - Create (single line or bulk Excel upload)
 * - Read (list, get by ID)
 * - Update
 * - Submit for approval
 * - Approve/Reject
 * - Line item management
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
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestType,
  PurchaseRequestCategory,
  PurchaseRequestStatus,
} from '@vapour/types';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import {
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';

// ============================================================================
// PURCHASE REQUEST NUMBER GENERATION
// ============================================================================

/**
 * Generate PR number in format: PR/YYYY/MM/XXXX
 */
async function generatePRNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of PRs in current month
  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.PURCHASE_REQUESTS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastPR = snapshot.docs[0].data() as PurchaseRequest;
    // Extract sequence from last PR number (PR/2025/11/0001 -> 0001)
    const lastNumber = lastPR.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `PR/${year}/${month}/${sequenceStr}`;
}

// ============================================================================
// CREATE PURCHASE REQUEST
// ============================================================================

export interface CreatePurchaseRequestInput {
  // Classification
  type: PurchaseRequestType;
  category: PurchaseRequestCategory;

  // Project linkage
  projectId: string;
  projectName: string;

  // Header
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Date;

  // Bulk upload tracking
  isBulkUpload?: boolean;
  bulkUploadFileUrl?: string;

  // Line items
  items: CreatePurchaseRequestItemInput[];
}

export interface CreatePurchaseRequestItemInput {
  // Item details
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string;

  // Material linkage
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Equipment linkage
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;

  // Estimated cost
  estimatedUnitCost?: number;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery
  requiredBy?: Date;
  deliveryLocation?: string;
}

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
    throw new Error('Failed to create purchase request');
  }
}

// ============================================================================
// GET PURCHASE REQUEST
// ============================================================================

export async function getPurchaseRequestById(prId: string): Promise<PurchaseRequest | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as PurchaseRequest;
  } catch (error) {
    console.error('[getPurchaseRequestById] Error:', error);
    throw new Error('Failed to get purchase request');
  }
}

// ============================================================================
// GET PURCHASE REQUEST ITEMS
// ============================================================================

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

// ============================================================================
// LIST PURCHASE REQUESTS
// ============================================================================

export interface ListPurchaseRequestsFilters {
  projectId?: string;
  type?: PurchaseRequestType;
  category?: PurchaseRequestCategory;
  status?: PurchaseRequestStatus;
  createdBy?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  limit?: number;
}

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

// ============================================================================
// UPDATE PURCHASE REQUEST
// ============================================================================

export interface UpdatePurchaseRequestInput {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Date;
}

export async function updatePurchaseRequest(
  prId: string,
  updates: UpdatePurchaseRequestInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);

    const updateData: Partial<PurchaseRequest> = {
      ...updates,
      requiredBy: updates.requiredBy ? Timestamp.fromDate(updates.requiredBy) : undefined,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await updateDoc(docRef, updateData as any);
  } catch (error) {
    console.error('[updatePurchaseRequest] Error:', error);
    throw new Error('Failed to update purchase request');
  }
}

// ============================================================================
// SUBMIT PURCHASE REQUEST FOR APPROVAL
// ============================================================================

export async function submitPurchaseRequestForApproval(
  prId: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be submitted
    if (pr.status !== 'DRAFT') {
      throw new Error('Only draft purchase requests can be submitted');
    }

    if (pr.itemCount === 0) {
      throw new Error('Cannot submit purchase request with no items');
    }

    // Update status
    await updateDoc(docRef, {
      status: 'SUBMITTED',
      submittedAt: Timestamp.now(),
      submittedBy: userId,
      submittedByName: userName,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create task-notification for Engineering Head
    // NOTE: Engineering Head user ID should be obtained from project settings or user role query
    // For now, this functionality is ready but requires the engineeringHeadUserId parameter
    // TODO: Pass engineeringHeadUserId when calling this function, or implement getEngineeringHeadUserId() helper
    // Example:
    // await createTaskNotification({
    //   type: 'actionable',
    //   category: 'PR_SUBMITTED',
    //   userId: engineeringHeadUserId,
    //   assignedBy: userId,
    //   assignedByName: userName,
    //   title: `Review Purchase Request ${pr.number}`,
    //   message: `${userName} submitted a purchase request for your review`,
    //   entityType: 'PURCHASE_REQUEST',
    //   entityId: prId,
    //   linkUrl: `/procurement/purchase-requests/${prId}`,
    //   priority: 'MEDIUM',
    //   autoCompletable: true,
    //   projectId: pr.projectId,
    // });
  } catch (error) {
    console.error('[submitPurchaseRequestForApproval] Error:', error);
    throw error;
  }
}

// ============================================================================
// APPROVE PURCHASE REQUEST
// ============================================================================

export async function approvePurchaseRequest(
  prId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be approved
    if (pr.status !== 'SUBMITTED' && pr.status !== 'UNDER_REVIEW') {
      throw new Error('Purchase request is not in reviewable status');
    }

    // Update status
    await updateDoc(docRef, {
      status: 'APPROVED',
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      reviewComments: comments,
      approvedBy: userId,
      approvedByName: userName,
      approvedAt: Timestamp.now(),
      approvalComments: comments,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Update all items to approved
    const items = await getPurchaseRequestItems(prId);
    const batch = writeBatch(db);

    items.forEach((item) => {
      const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
      batch.update(itemRef, {
        status: 'APPROVED',
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PURCHASE_REQUEST',
      prId,
      'PR_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Create informational notification for submitter
    await createTaskNotification({
      type: 'informational',
      category: 'PR_APPROVED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Purchase Request ${pr.number} Approved`,
      message: comments
        ? `Your purchase request was approved by ${userName}: ${comments}`
        : `Your purchase request was approved by ${userName}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'HIGH',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[approvePurchaseRequest] Error:', error);
    throw error;
  }
}

// ============================================================================
// REJECT PURCHASE REQUEST
// ============================================================================

export async function rejectPurchaseRequest(
  prId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be rejected
    if (pr.status !== 'SUBMITTED' && pr.status !== 'UNDER_REVIEW') {
      throw new Error('Purchase request is not in reviewable status');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update status
    await updateDoc(docRef, {
      status: 'REJECTED',
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      rejectionReason: reason,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Update all items to rejected
    const items = await getPurchaseRequestItems(prId);
    const batch = writeBatch(db);

    items.forEach((item) => {
      const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
      batch.update(itemRef, {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PURCHASE_REQUEST',
      prId,
      'PR_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Create informational notification for submitter
    await createTaskNotification({
      type: 'informational',
      category: 'PR_REJECTED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Purchase Request ${pr.number} Rejected`,
      message: `Your purchase request was rejected by ${userName}: ${reason}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'HIGH',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[rejectPurchaseRequest] Error:', error);
    throw error;
  }
}

// ============================================================================
// ADD COMMENT TO PURCHASE REQUEST
// ============================================================================

export async function addPurchaseRequestComment(
  prId: string,
  userId: string,
  userName: string,
  comment: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Update review comments
    await updateDoc(docRef, {
      status: 'UNDER_REVIEW', // Move to under review if submitted
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      reviewComments: comment,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create informational notification for submitter
    const truncatedComment = comment.length > 100 ? comment.substring(0, 100) + '...' : comment;

    await createTaskNotification({
      type: 'informational',
      category: 'PR_COMMENTED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Comment on Purchase Request ${pr.number}`,
      message: `${userName} added a comment: ${truncatedComment}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'MEDIUM',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[addPurchaseRequestComment] Error:', error);
    throw error;
  }
}

// ============================================================================
// GET PENDING APPROVALS (FOR ENGINEERING HEAD)
// ============================================================================

export async function getPendingApprovals(): Promise<PurchaseRequest[]> {
  return listPurchaseRequests({
    status: 'SUBMITTED',
  });
}

// ============================================================================
// GET UNDER REVIEW (FOR ENGINEERING HEAD)
// ============================================================================

export async function getUnderReviewPRs(): Promise<PurchaseRequest[]> {
  return listPurchaseRequests({
    status: 'UNDER_REVIEW',
  });
}

// ============================================================================
// GET APPROVED PRS (FOR RFQ CREATION)
// ============================================================================

export async function getApprovedPRs(projectId?: string): Promise<PurchaseRequest[]> {
  return listPurchaseRequests({
    status: 'APPROVED',
    projectId,
  });
}

// ============================================================================
// HELPER: INCREMENT ATTACHMENT COUNT
// ============================================================================

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
