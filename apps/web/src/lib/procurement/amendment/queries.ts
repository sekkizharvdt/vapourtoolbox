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
