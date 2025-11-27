/**
 * Amendment Query Operations
 *
 * Query functions for amendments and approval history
 */

import { collection, getDocs, query, where, orderBy, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PurchaseOrderAmendment, AmendmentApprovalHistory } from '@vapour/types';

const logger = createLogger({ context: 'amendmentService' });

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
 * List all amendments with optional filters
 */
export interface ListAmendmentsFilters {
  status?: PurchaseOrderAmendment['status'];
  purchaseOrderId?: string;
  amendmentType?: PurchaseOrderAmendment['amendmentType'];
}

export async function listAmendments(
  db: Firestore,
  filters: ListAmendmentsFilters = {}
): Promise<PurchaseOrderAmendment[]> {
  try {
    const amendmentsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS);
    const constraints: ReturnType<typeof where>[] = [];

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.purchaseOrderId) {
      constraints.push(where('purchaseOrderId', '==', filters.purchaseOrderId));
    }
    if (filters.amendmentType) {
      constraints.push(where('amendmentType', '==', filters.amendmentType));
    }

    const q = query(amendmentsRef, ...constraints, orderBy('amendmentDate', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseOrderAmendment[];
  } catch (error) {
    logger.error('Failed to list amendments', { error, filters });
    throw error;
  }
}

/**
 * Get a single amendment by ID
 */
export async function getAmendmentById(
  db: Firestore,
  amendmentId: string
): Promise<PurchaseOrderAmendment | null> {
  try {
    const { doc: docRef, getDoc } = await import('firebase/firestore');
    const amendmentDoc = await getDoc(
      docRef(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId)
    );

    if (!amendmentDoc.exists()) {
      return null;
    }

    return {
      id: amendmentDoc.id,
      ...amendmentDoc.data(),
    } as PurchaseOrderAmendment;
  } catch (error) {
    logger.error('Failed to get amendment', { error, amendmentId });
    throw error;
  }
}
