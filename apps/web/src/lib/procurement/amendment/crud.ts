/**
 * Amendment CRUD Operations
 *
 * Create, submit, approve, and reject amendments
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  type Firestore,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PurchaseOrder, PurchaseOrderChange, PurchaseOrderAmendment } from '@vapour/types';
import { determineAmendmentType } from './helpers';
import { getAmendmentHistory } from './queries';
import { createVersionSnapshot } from './versioning';

const logger = createLogger({ context: 'amendmentService' });

/**
 * Create a new purchase order amendment
 */
export async function createAmendment(
  db: Firestore,
  purchaseOrderId: string,
  changes: PurchaseOrderChange[],
  reason: string,
  userId: string,
  userName: string
): Promise<string> {
  try {
    // Get the current PO
    const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, purchaseOrderId));
    if (!poDoc.exists()) {
      throw new Error('Purchase order not found');
    }

    const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

    // Validate PO status
    if (po.status !== 'APPROVED' && po.status !== 'AMENDED') {
      throw new Error('Only approved purchase orders can be amended');
    }

    // Get the next amendment number
    const existingAmendments = await getAmendmentHistory(db, purchaseOrderId);
    const nextAmendmentNumber = existingAmendments.length + 1;

    // Calculate financial impact
    const financialChanges = changes.filter((c) => c.category === 'FINANCIAL');
    const previousGrandTotal = po.grandTotal;
    let newGrandTotal = po.grandTotal;

    // Calculate new grand total based on changes
    financialChanges.forEach((change) => {
      if (change.field.includes('grandTotal') || change.field.includes('subtotal')) {
        newGrandTotal = typeof change.newValue === 'number' ? change.newValue : newGrandTotal;
      }
    });

    const totalChange = newGrandTotal - previousGrandTotal;

    // Determine amendment type based on changes
    const amendmentType = determineAmendmentType(changes);

    // Create the amendment
    const amendmentData = {
      purchaseOrderId,
      purchaseOrderNumber: po.number,
      amendmentNumber: nextAmendmentNumber,
      amendmentDate: serverTimestamp(),
      amendmentType,
      reason,
      requestedBy: userId,
      requestedByName: userName,
      changes,
      previousGrandTotal,
      newGrandTotal,
      totalChange,
      status: 'DRAFT',
      applied: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    };

    const amendmentRef = await addDoc(
      collection(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS),
      amendmentData
    );

    logger.info('Amendment created', {
      amendmentId: amendmentRef.id,
      purchaseOrderId,
      amendmentNumber: nextAmendmentNumber,
    });

    return amendmentRef.id;
  } catch (error) {
    logger.error('Failed to create amendment', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Submit amendment for approval
 */
export async function submitAmendmentForApproval(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  comments?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);
    const amendmentDoc = await getDoc(amendmentRef);

    if (!amendmentDoc.exists()) {
      throw new Error('Amendment not found');
    }

    const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

    if (amendment.status !== 'DRAFT') {
      throw new Error('Only draft amendments can be submitted for approval');
    }

    const batch = writeBatch(db);

    // Update amendment status
    batch.update(amendmentRef, {
      status: 'PENDING_APPROVAL',
      submittedForApprovalAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create approval history entry
    const historyData = {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
      action: 'SUBMITTED',
      actionDate: serverTimestamp(),
      actionBy: userId,
      actionByName: userName,
      comments,
      previousStatus: 'DRAFT',
      newStatus: 'PENDING_APPROVAL',
      ipAddress,
      userAgent,
    };

    const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
    batch.set(historyRef, historyData);

    await batch.commit();

    logger.info('Amendment submitted for approval', { amendmentId });
  } catch (error) {
    logger.error('Failed to submit amendment for approval', { error, amendmentId });
    throw error;
  }
}

/**
 * Approve amendment and apply changes to PO
 */
export async function approveAmendment(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  comments?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);
    const amendmentDoc = await getDoc(amendmentRef);

    if (!amendmentDoc.exists()) {
      throw new Error('Amendment not found');
    }

    const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

    if (amendment.status !== 'PENDING_APPROVAL') {
      throw new Error('Only pending amendments can be approved');
    }

    // Create version snapshot before applying changes
    await createVersionSnapshot(db, amendment.purchaseOrderId, amendmentId, userId);

    const batch = writeBatch(db);

    // Update amendment status
    batch.update(amendmentRef, {
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: serverTimestamp(),
      applied: true,
      appliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Apply changes to PO
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, amendment.purchaseOrderId);
    const updateData: any = {
      status: 'AMENDED',
      lastAmendmentNumber: amendment.amendmentNumber,
      lastAmendmentDate: serverTimestamp(),
      grandTotal: amendment.newGrandTotal,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    // Apply individual field changes
    amendment.changes.forEach((change) => {
      if (!change.field.startsWith('items[')) {
        updateData[change.field] = change.newValue;
      }
    });

    batch.update(poRef, updateData);

    // Create approval history entry
    const historyData = {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
      action: 'APPROVED',
      actionDate: serverTimestamp(),
      actionBy: userId,
      actionByName: userName,
      comments,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'APPROVED',
      ipAddress,
      userAgent,
    };

    const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
    batch.set(historyRef, historyData);

    await batch.commit();

    logger.info('Amendment approved and applied', {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
    });
  } catch (error) {
    logger.error('Failed to approve amendment', { error, amendmentId });
    throw error;
  }
}

/**
 * Reject amendment
 */
export async function rejectAmendment(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);
    const amendmentDoc = await getDoc(amendmentRef);

    if (!amendmentDoc.exists()) {
      throw new Error('Amendment not found');
    }

    const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

    if (amendment.status !== 'PENDING_APPROVAL') {
      throw new Error('Only pending amendments can be rejected');
    }

    const batch = writeBatch(db);

    // Update amendment status
    batch.update(amendmentRef, {
      status: 'REJECTED',
      rejectedBy: userId,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create approval history entry
    const historyData = {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
      action: 'REJECTED',
      actionDate: serverTimestamp(),
      actionBy: userId,
      actionByName: userName,
      comments: reason,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'REJECTED',
      ipAddress,
      userAgent,
    };

    const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
    batch.set(historyRef, historyData);

    await batch.commit();

    logger.info('Amendment rejected', { amendmentId });
  } catch (error) {
    logger.error('Failed to reject amendment', { error, amendmentId });
    throw error;
  }
}
