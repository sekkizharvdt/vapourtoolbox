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

// ============================================================================
// PO NUMBER GENERATION
// ============================================================================

async function generatePONumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.PURCHASE_ORDERS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastPO = snapshot.docs[0].data() as PurchaseOrder;
    const lastNumber = lastPO.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `PO/${year}/${month}/${sequenceStr}`;
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
  // First, fetch RFQ items to get projectId for each item
  const rfqItemMap = new Map<
    string,
    { projectId: string; equipmentId?: string; equipmentCode?: string }
  >();

  for (const item of offerItems) {
    if (!rfqItemMap.has(item.rfqItemId)) {
      try {
        const rfqItemDoc = await getDoc(doc(db, COLLECTIONS.RFQ_ITEMS, item.rfqItemId));
        if (rfqItemDoc.exists()) {
          const rfqItemData = rfqItemDoc.data();
          rfqItemMap.set(item.rfqItemId, {
            projectId: rfqItemData.projectId || '',
            equipmentId: rfqItemData.equipmentId,
            equipmentCode: rfqItemData.equipmentCode,
          });
        } else {
          console.warn(`[purchaseOrderService] RFQ item not found: ${item.rfqItemId}`);
          rfqItemMap.set(item.rfqItemId, { projectId: '' });
        }
      } catch (err) {
        console.error(`[purchaseOrderService] Error fetching RFQ item ${item.rfqItemId}:`, err);
        rfqItemMap.set(item.rfqItemId, { projectId: '' });
      }
    }
  }

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

  console.log('[purchaseOrderService] PO created:', poRef.id, poNumber);

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

export async function submitPOForApproval(poId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'PENDING_APPROVAL',
    submittedForApprovalAt: Timestamp.now(),
    submittedBy: userId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  console.log('[purchaseOrderService] PO submitted for approval:', poId);
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

  console.log('[purchaseOrderService] PO approved:', poId);

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

      console.log('[purchaseOrderService] Advance payment created:', paymentId);
    } catch (err) {
      console.error('[purchaseOrderService] Error creating advance payment:', err);
      // Note: PO is already approved, advance payment can be created manually
      // We don't fail the approval if payment creation fails
    }
  } else if (po.advancePaymentRequired && !bankAccountId) {
    console.warn('[purchaseOrderService] Advance payment required but no bank account provided');
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

  console.log('[purchaseOrderService] PO rejected:', poId);
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

  console.log('[purchaseOrderService] PO issued:', poId);
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

  console.log('[purchaseOrderService] PO status updated:', poId, status);
}
