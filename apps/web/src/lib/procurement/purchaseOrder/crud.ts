/**
 * Purchase Order CRUD Operations
 *
 * Handles core PO operations:
 * - Create PO from offer
 * - Read PO by ID
 * - Read PO items
 * - List POs with filters
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
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';

const logger = createLogger({ context: 'purchaseOrder/crud' });

// ============================================================================
// PO NUMBER GENERATION (ATOMIC)
// ============================================================================

/**
 * Generate PO number using atomic transaction
 * Uses a counter document to prevent race conditions
 * Format: PO/YYYY/MM/XXXX
 */
export async function generatePONumber(): Promise<string> {
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

export interface CreatePOFromOfferTerms {
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms?: string;
  penaltyClause?: string;
  otherClauses?: string[];
  deliveryAddress: string;
  expectedDeliveryDate?: Date;
  advancePaymentRequired?: boolean;
  advancePercentage?: number;
}

export async function createPOFromOffer(
  offerId: string,
  terms: CreatePOFromOfferTerms,
  userId: string,
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Generate idempotency key based on offer ID and user
  // This prevents duplicate PO creation from double-clicks or network retries
  const idempotencyKey = generateIdempotencyKey('create-po-from-offer', offerId, userId);

  return withIdempotency(
    db,
    idempotencyKey,
    'create-po-from-offer',
    async () => {
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
      const offerItems = offerItemsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
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

      // Create PO - build with only defined fields to prevent Firestore errors
      // Firestore throws "Unsupported field value: undefined" if any field is undefined
      const poData: Record<string, unknown> = {
        // Required fields
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
        otherClauses: terms.otherClauses || [],
        deliveryAddress: terms.deliveryAddress,
        pdfVersion: 1,
        status: 'DRAFT',
        advancePaymentRequired: terms.advancePaymentRequired || false,
        deliveryProgress: 0,
        paymentProgress: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      // Add optional fields only if they have values
      if (terms.warrantyTerms) poData.warrantyTerms = terms.warrantyTerms;
      if (terms.penaltyClause) poData.penaltyClause = terms.penaltyClause;
      if (terms.expectedDeliveryDate) {
        poData.expectedDeliveryDate = Timestamp.fromDate(terms.expectedDeliveryDate);
      }
      if (terms.advancePercentage !== undefined) {
        poData.advancePercentage = terms.advancePercentage;
      }
      if (advanceAmount) poData.advanceAmount = advanceAmount;
      if (terms.advancePaymentRequired) poData.advancePaymentStatus = 'PENDING';

      const poRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), poData);

      // Create PO items from offer items
      // Batch fetch RFQ items to get projectId for each item (avoid N+1 query)
      const rfqItemMap = new Map<
        string,
        { projectId: string; equipmentId?: string; equipmentCode?: string }
      >();

      // Get unique RFQ item IDs
      const uniqueRfqItemIds = [...new Set(offerItems.map((item) => item.rfqItemId))];

      // Batch fetch all RFQ items in parallel
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

        // Build PO item with only defined fields to prevent Firestore errors
        const poItemData: Record<string, unknown> = {
          purchaseOrderId: poRef.id,
          offerItemId: item.id,
          rfqItemId: item.rfqItemId,
          lineNumber: item.lineNumber,
          description: item.description,
          projectId: rfqItemInfo.projectId,
          quantity: item.quotedQuantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          amount: item.amount,
          gstRate: item.gstRate || 0,
          gstAmount: item.gstAmount || 0,
          quantityDelivered: 0,
          quantityAccepted: 0,
          quantityRejected: 0,
          deliveryStatus: 'PENDING',
          createdAt: now,
          updatedAt: now,
        };

        // Add optional fields only if they have values
        if (rfqItemInfo.equipmentId) poItemData.equipmentId = rfqItemInfo.equipmentId;
        if (rfqItemInfo.equipmentCode) poItemData.equipmentCode = rfqItemInfo.equipmentCode;
        if (item.makeModel) poItemData.makeModel = item.makeModel;
        if (item.deliveryDate) poItemData.deliveryDate = item.deliveryDate;

        const itemRef = doc(collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS));
        batch.set(itemRef, poItemData);
      });

      await batch.commit();

      // Audit log: PO created
      const auditContext = createAuditContext(userId, '', userName);
      await logAuditEvent(
        db,
        auditContext,
        'PO_CREATED',
        'PURCHASE_ORDER',
        poRef.id,
        `Created Purchase Order ${poNumber} for ${offer.vendorName}`,
        {
          entityName: poNumber,
          metadata: {
            vendorId: offer.vendorId,
            vendorName: offer.vendorName,
            offerId: offer.id,
            offerNumber: offer.number,
            grandTotal: grandTotal,
            currency: offer.currency,
            itemCount: offerItems.length,
          },
        }
      );

      logger.info('PO created', { poId: poRef.id, poNumber });

      return poRef.id;
    },
    { userId, metadata: { offerId, userName } }
  );
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
