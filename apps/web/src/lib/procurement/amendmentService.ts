/**
 * Purchase Order Amendment Service
 *
 * Manages amendments to approved purchase orders with full version history,
 * approval workflow, and audit trail.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Firestore,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderAmendment,
  PurchaseOrderChange,
  PurchaseOrderVersion,
  AmendmentApprovalHistory,
} from '@vapour/types';

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

/**
 * Get amendment history for a purchase order
 */
export async function getAmendmentHistory(
  db: Firestore,
  purchaseOrderId: string
): Promise<PurchaseOrderAmendment[]> {
  try {
    const amendmentsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS);
    const q = query(
      amendmentsRef,
      where('purchaseOrderId', '==', purchaseOrderId),
      orderBy('amendmentNumber', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseOrderAmendment[];
  } catch (error) {
    logger.error('Failed to get amendment history', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Get version history for a purchase order
 */
export async function getPurchaseOrderVersions(
  db: Firestore,
  purchaseOrderId: string
): Promise<PurchaseOrderVersion[]> {
  try {
    const versionsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_VERSIONS);
    const q = query(
      versionsRef,
      where('purchaseOrderId', '==', purchaseOrderId),
      orderBy('versionNumber', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseOrderVersion[];
  } catch (error) {
    logger.error('Failed to get version history', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Create version snapshot of current PO state
 */
export async function createVersionSnapshot(
  db: Firestore,
  purchaseOrderId: string,
  amendmentId: string | null,
  userId: string,
  notes?: string
): Promise<string> {
  try {
    // Get current PO state
    const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, purchaseOrderId));
    if (!poDoc.exists()) {
      throw new Error('Purchase order not found');
    }

    const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

    // Get PO items
    const itemsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS);
    const itemsQuery = query(itemsRef, where('purchaseOrderId', '==', purchaseOrderId));
    const itemsSnapshot = await getDocs(itemsQuery);
    const items = itemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseOrderItem[];

    // Determine version number
    const existingVersions = await getPurchaseOrderVersions(db, purchaseOrderId);
    const versionNumber = existingVersions.length + 1;

    // Get amendment number if this is triggered by an amendment
    let amendmentNumber: number | undefined;
    if (amendmentId) {
      const amendmentDoc = await getDoc(
        doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId)
      );
      if (amendmentDoc.exists()) {
        const amendment = amendmentDoc.data() as PurchaseOrderAmendment;
        amendmentNumber = amendment.amendmentNumber;
      }
    }

    // Create version snapshot
    const versionData = {
      purchaseOrderId,
      versionNumber,
      createdByAmendmentId: amendmentId || undefined,
      amendmentNumber,
      snapshot: po,
      snapshotItems: items,
      createdAt: serverTimestamp(),
      createdBy: userId,
      notes,
    };

    const versionRef = await addDoc(
      collection(db, COLLECTIONS.PURCHASE_ORDER_VERSIONS),
      versionData
    );

    logger.info('Version snapshot created', {
      versionId: versionRef.id,
      purchaseOrderId,
      versionNumber,
    });

    return versionRef.id;
  } catch (error) {
    logger.error('Failed to create version snapshot', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Compare two versions and generate diff
 */
export async function compareVersions(
  db: Firestore,
  purchaseOrderId: string,
  fromVersionNumber: number,
  toVersionNumber: number
): Promise<PurchaseOrderChange[]> {
  try {
    const versions = await getPurchaseOrderVersions(db, purchaseOrderId);

    const fromVersion = versions.find((v) => v.versionNumber === fromVersionNumber);
    const toVersion = versions.find((v) => v.versionNumber === toVersionNumber);

    if (!fromVersion || !toVersion) {
      throw new Error('Version not found');
    }

    const changes: PurchaseOrderChange[] = [];

    // Compare key fields
    const fieldsToCompare: Array<{
      key: keyof PurchaseOrder;
      label: string;
      category: PurchaseOrderChange['category'];
    }> = [
      { key: 'subtotal', label: 'Subtotal', category: 'FINANCIAL' },
      { key: 'grandTotal', label: 'Grand Total', category: 'FINANCIAL' },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery Date', category: 'SCHEDULE' },
      { key: 'paymentTerms', label: 'Payment Terms', category: 'TERMS' },
      { key: 'deliveryAddress', label: 'Delivery Address', category: 'TERMS' },
    ];

    fieldsToCompare.forEach(({ key, label, category }) => {
      const oldValue = fromVersion.snapshot[key];
      const newValue = toVersion.snapshot[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          fieldLabel: label,
          oldValue,
          newValue,
          oldValueDisplay: formatValue(oldValue),
          newValueDisplay: formatValue(newValue),
          category,
        });
      }
    });

    // Compare line items
    const fromItems = fromVersion.snapshotItems;
    const toItems = toVersion.snapshotItems;

    fromItems.forEach((fromItem, index) => {
      const toItem = toItems.find((i) => i.id === fromItem.id);
      if (toItem) {
        if (fromItem.quantity !== toItem.quantity) {
          changes.push({
            field: `items[${index}].quantity`,
            fieldLabel: `Item ${index + 1} Quantity`,
            oldValue: fromItem.quantity,
            newValue: toItem.quantity,
            oldValueDisplay: fromItem.quantity.toString(),
            newValueDisplay: toItem.quantity.toString(),
            category: 'SCOPE',
          });
        }

        if (fromItem.unitPrice !== toItem.unitPrice) {
          changes.push({
            field: `items[${index}].unitPrice`,
            fieldLabel: `Item ${index + 1} Unit Price`,
            oldValue: fromItem.unitPrice,
            newValue: toItem.unitPrice,
            oldValueDisplay: `₹${fromItem.unitPrice.toFixed(2)}`,
            newValueDisplay: `₹${toItem.unitPrice.toFixed(2)}`,
            category: 'FINANCIAL',
          });
        }
      }
    });

    return changes;
  } catch (error) {
    logger.error('Failed to compare versions', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Get approval history for an amendment
 */
export async function getAmendmentApprovalHistory(
  db: Firestore,
  amendmentId: string
): Promise<AmendmentApprovalHistory[]> {
  try {
    const historyRef = collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY);
    const q = query(
      historyRef,
      where('amendmentId', '==', amendmentId),
      orderBy('actionDate', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AmendmentApprovalHistory[];
  } catch (error) {
    logger.error('Failed to get approval history', { error, amendmentId });
    throw error;
  }
}

/**
 * Helper: Determine amendment type based on changes
 */
function determineAmendmentType(
  changes: PurchaseOrderChange[]
): PurchaseOrderAmendment['amendmentType'] {
  const hasQuantityChange = changes.some((c) => c.field.includes('quantity'));
  const hasPriceChange = changes.some(
    (c) => c.field.includes('Price') || c.field.includes('Total')
  );
  const hasDeliveryChange = changes.some((c) => c.field.includes('delivery'));
  const hasTermsChange = changes.some((c) => c.category === 'TERMS');

  if (hasQuantityChange) return 'QUANTITY_CHANGE';
  if (hasPriceChange) return 'PRICE_CHANGE';
  if (hasDeliveryChange) return 'DELIVERY_CHANGE';
  if (hasTermsChange) return 'TERMS_CHANGE';

  return 'GENERAL';
}

/**
 * Helper: Format value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') return value.toFixed(2);
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    const date = value instanceof Date ? value : (value as Timestamp).toDate();
    return date.toLocaleDateString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
