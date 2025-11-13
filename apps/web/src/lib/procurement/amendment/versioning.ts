/**
 * Amendment Versioning Operations
 *
 * Version snapshots and comparison functions
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
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderAmendment,
  PurchaseOrderVersion,
  PurchaseOrderChange,
} from '@vapour/types';
import { formatValue } from './helpers';

const logger = createLogger({ context: 'amendmentService' });

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
