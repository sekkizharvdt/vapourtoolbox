/**
 * Purchase Order Service
 *
 * Handles PO operations:
 * - Create PO from selected offer
 * - CRUD operations
 * - Approval workflow
 * - Status tracking
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Offer,
  OfferItem,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { formatCurrency } from './purchaseOrderHelpers';

const logger = createLogger({ context: 'purchaseOrderService' });

// ============================================================================
// PO NUMBER GENERATION (ATOMIC)
// ============================================================================

/**
 * Generate PO number using atomic transaction
 * Uses a counter document to prevent race conditions
 * Format: PO/YYYY/MM/XXXX
 */
async function generatePONumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const counterKey = `po-${year}-${month}`;

  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const poNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let sequence = 1;
    if (counterDoc.exists()) {
      const data = counterDoc.data();
      sequence = (data.value || 0) + 1;
      transaction.update(counterRef, {
        value: sequence,
        updatedAt: Timestamp.now(),
      });
    } else {
      // Initialize counter for this month
      transaction.set(counterRef, {
        type: 'purchase_order',
        year,
        month: parseInt(month, 10),
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `PO/${year}/${month}/${sequenceStr}`;
  });

  return poNumber;
}

// ============================================================================
// CREATE PO
// ============================================================================

export async function createPOFromOffer(
  offerId: string,
  terms: {
    paymentTerms: string;
    deliveryTerms: string;
    warrantyTerms?: string;
    penaltyClause?: string;
    otherClauses?: string[];
    deliveryAddress: string;
    expectedDeliveryDate?: Date;
    advancePaymentRequired?: boolean;
    advancePercentage?: number;
  },
  userId: string,
  _userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Get offer and its items
  const offerDoc = await getDoc(doc(db, COLLECTIONS.OFFERS, offerId));
  if (!offerDoc.exists()) {
    throw new Error('Offer not found');
  }

  const offer = { id: offerDoc.id, ...offerDoc.data() } as Offer;

  const offerItemsQuery = query(
    collection(db, COLLECTIONS.OFFER_ITEMS),
    where('offerId', '==', offerId),
    orderBy('lineNumber', 'asc')
  );
  const offerItemsSnapshot = await getDocs(offerItemsQuery);
  const offerItems = offerItemsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as OfferItem[];

  const poNumber = await generatePONumber();
  const now = Timestamp.now();

  // Calculate totals
  const subtotal = offer.subtotal;
  const totalTax = offer.taxAmount;

  // For now, split tax equally into CGST and SGST (intra-state)
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const igst = 0; // Inter-state

  const grandTotal = offer.totalAmount;

  // Calculate advance amount if required
  let advanceAmount = 0;
  if (terms.advancePaymentRequired && terms.advancePercentage) {
    advanceAmount = (grandTotal * terms.advancePercentage) / 100;
  }

  // Create PO
  const poData: Omit<PurchaseOrder, 'id'> = {
    number: poNumber,
    rfqId: offer.rfqId,
    offerId: offer.id,
    selectedOfferNumber: offer.number,
    vendorId: offer.vendorId,
    vendorName: offer.vendorName,
    projectIds: [], // Will be populated from items
    projectNames: [],
    title: `Purchase Order for ${offer.vendorName}`,
    description: `PO created from offer ${offer.number}`,
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    currency: offer.currency,
    paymentTerms: terms.paymentTerms,
    deliveryTerms: terms.deliveryTerms,
    warrantyTerms: terms.warrantyTerms,
    penaltyClause: terms.penaltyClause,
    otherClauses: terms.otherClauses || [],
    deliveryAddress: terms.deliveryAddress,
    expectedDeliveryDate: terms.expectedDeliveryDate
      ? Timestamp.fromDate(terms.expectedDeliveryDate)
      : undefined,
    pdfVersion: 1,
    status: 'DRAFT',
    advancePaymentRequired: terms.advancePaymentRequired || false,
    advancePercentage: terms.advancePercentage,
    advanceAmount: advanceAmount || undefined,
    advancePaymentStatus: terms.advancePaymentRequired ? 'PENDING' : undefined,
    deliveryProgress: 0,
    paymentProgress: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  const poRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), poData);

  // Create PO items from offer items
  // Batch fetch RFQ items to get projectId for each item (avoid N+1 query)
  const rfqItemMap = new Map<
    string,
    { projectId: string; equipmentId?: string; equipmentCode?: string }
  >();

  // Get unique RFQ item IDs
  const uniqueRfqItemIds = [...new Set(offerItems.map((item) => item.rfqItemId))];

  // Batch fetch all RFQ items in parallel (Firestore doesn't support 'in' for document refs,
  // but we can use Promise.all for parallel fetching)
  const rfqItemPromises = uniqueRfqItemIds.map(async (rfqItemId) => {
    try {
      const rfqItemDoc = await getDoc(doc(db, COLLECTIONS.RFQ_ITEMS, rfqItemId));
      if (rfqItemDoc.exists()) {
        const rfqItemData = rfqItemDoc.data();
        return {
          id: rfqItemId,
          data: {
            projectId: rfqItemData.projectId || '',
            equipmentId: rfqItemData.equipmentId,
            equipmentCode: rfqItemData.equipmentCode,
          },
        };
      } else {
        logger.warn('RFQ item not found', { rfqItemId });
        return { id: rfqItemId, data: { projectId: '' } };
      }
    } catch (err) {
      logger.error('Error fetching RFQ item', { rfqItemId, error: err });
      return { id: rfqItemId, data: { projectId: '' } };
    }
  });

  const rfqItemResults = await Promise.all(rfqItemPromises);
  rfqItemResults.forEach(({ id, data }) => {
    rfqItemMap.set(id, data);
  });

  const batch = writeBatch(db);

  offerItems.forEach((item) => {
    const rfqItemInfo = rfqItemMap.get(item.rfqItemId) || { projectId: '' };

    const poItemData: Omit<PurchaseOrderItem, 'id'> = {
      purchaseOrderId: poRef.id,
      offerItemId: item.id,
      rfqItemId: item.rfqItemId,
      lineNumber: item.lineNumber,
      description: item.description,
      projectId: rfqItemInfo.projectId,
      equipmentId: rfqItemInfo.equipmentId,
      equipmentCode: rfqItemInfo.equipmentCode,
      quantity: item.quotedQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      amount: item.amount,
      gstRate: item.gstRate || 0,
      gstAmount: item.gstAmount || 0,
      makeModel: item.makeModel,
      deliveryDate: item.deliveryDate,
      quantityDelivered: 0,
      quantityAccepted: 0,
      quantityRejected: 0,
      deliveryStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const itemRef = doc(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS));
    batch.set(itemRef, poItemData);
  });

  await batch.commit();

  logger.info('PO created', { poId: poRef.id, poNumber });

  return poRef.id;
}

// ============================================================================
// READ PO
// ============================================================================

export async function getPOById(poId: string): Promise<PurchaseOrder | null> {
  const { db } = getFirebase();

  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));

  if (!poDoc.exists()) {
    return null;
  }

  return { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;
}

export async function getPOItems(poId: string): Promise<PurchaseOrderItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where('purchaseOrderId', '==', poId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PurchaseOrderItem[];
}

export async function listPOs(
  filters: {
    status?: PurchaseOrderStatus;
    projectId?: string;
    vendorId?: string;
    limit?: number;
  } = {}
): Promise<PurchaseOrder[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  if (filters.projectId) {
    constraints.push(where('projectIds', 'array-contains', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.PURCHASE_ORDERS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PurchaseOrder[];
}

// ============================================================================
// PO WORKFLOW
// ============================================================================

export async function submitPOForApproval(
  poId: string,
  userId: string,
  userName: string,
  approverId?: string
): Promise<void> {
  const { db } = getFirebase();

  // Get PO for notification details
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'PENDING_APPROVAL',
    submittedForApprovalAt: Timestamp.now(),
    submittedBy: userId,
    ...(approverId && { approverId }),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Create task notification for selected approver
  if (approverId) {
    const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
    await createTaskNotification({
      type: 'actionable',
      category: 'PO_PENDING_APPROVAL',
      userId: approverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Review Purchase Order ${po.number}`,
      message: `${userName} submitted a purchase order for your approval: ${po.vendorName} - ${formatCurrency(po.grandTotal, po.currency)}`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/pos/${poId}`,
      priority: 'HIGH',
      autoCompletable: true,
      projectId: po.projectIds[0], // Use first project ID
    });
  }

  logger.info('PO submitted for approval', { poId, approverId });
}

export async function approvePO(
  poId: string,
  userId: string,
  userName: string,
  comments?: string,
  bankAccountId?: string
): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  // Get PO to check if advance payment is required
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'APPROVED',
    approvedBy: userId,
    approvedByName: userName,
    approvedAt: now,
    approvalComments: comments,
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('PO approved', { poId });

  // Create advance payment if required
  if (po.advancePaymentRequired && bankAccountId) {
    try {
      const { createAdvancePaymentFromPO } = await import('./accountingIntegration');
      const userEmail = userName; // Use userName as fallback for email
      const paymentId = await createAdvancePaymentFromPO(db, po, bankAccountId, userId, userEmail);

      // Update PO with payment reference and status
      await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
        advancePaymentId: paymentId,
        advancePaymentStatus: 'REQUESTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      logger.info('Advance payment created', { paymentId });
    } catch (err) {
      logger.error('Error creating advance payment', { poId, error: err });
      // Note: PO is already approved, advance payment can be created manually
      // We don't fail the approval if payment creation fails
    }
  } else if (po.advancePaymentRequired && !bankAccountId) {
    logger.warn('Advance payment required but no bank account provided');
    // Update status to show advance payment is pending
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      advancePaymentStatus: 'PENDING',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
}

export async function rejectPO(
  poId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'REJECTED',
    rejectedBy: userId,
    rejectedByName: userName,
    rejectedAt: now,
    rejectionReason: reason,
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('PO rejected', { poId });
}

export async function issuePO(poId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'ISSUED',
    issuedAt: now,
    issuedBy: userId,
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('PO issued', { poId });
}

export async function updatePOStatus(
  poId: string,
  status: PurchaseOrderStatus,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('PO status updated', { poId, status });
}
