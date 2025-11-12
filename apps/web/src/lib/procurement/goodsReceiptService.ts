/**
 * Goods Receipt Service
 *
 * Handles goods inspection and receipt operations
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
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrder,
  PurchaseOrderItem,
  ItemCondition,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'goodsReceiptService' });
import {
  createBillFromGoodsReceipt,
  createPaymentFromApprovedReceipt,
} from './accountingIntegration';

// ============================================================================
// GR NUMBER GENERATION
// ============================================================================

async function generateGRNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastGR = snapshot.docs[0].data() as GoodsReceipt;
    const lastNumber = lastGR.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `GR/${year}/${month}/${sequenceStr}`;
}

// ============================================================================
// CREATE GR
// ============================================================================

export interface CreateGoodsReceiptInput {
  purchaseOrderId: string;
  packingListId?: string;
  projectId: string;
  projectName: string;
  inspectionType: 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY';
  inspectionLocation: string;
  inspectionDate: Date;
  overallNotes?: string;
  items: Array<{
    poItemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    condition: ItemCondition;
    conditionNotes?: string;
    testingRequired: boolean;
    testingCompleted?: boolean;
    testResult?: 'PASS' | 'FAIL' | 'CONDITIONAL';
    hasIssues: boolean;
    issues?: string[];
  }>;
}

export async function createGoodsReceipt(
  input: CreateGoodsReceiptInput,
  userId: string,
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Get PO
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, input.purchaseOrderId));
  if (!poDoc.exists()) {
    throw new Error('Purchase Order not found');
  }

  const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

  const grNumber = await generateGRNumber();
  const now = Timestamp.now();

  // Determine overall condition
  const allAccepted = input.items.every((item) => item.acceptedQuantity === item.receivedQuantity);
  const someRejected = input.items.some((item) => item.rejectedQuantity > 0);
  const hasIssues = input.items.some((item) => item.hasIssues);

  let overallCondition: 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED' | 'REJECTED' = 'ACCEPTED';
  if (someRejected || hasIssues) {
    overallCondition = 'CONDITIONALLY_ACCEPTED';
  }
  if (!allAccepted && input.items.every((item) => item.acceptedQuantity === 0)) {
    overallCondition = 'REJECTED';
  }

  // Create GR
  const grData: Omit<GoodsReceipt, 'id'> = {
    number: grNumber,
    purchaseOrderId: input.purchaseOrderId,
    poNumber: po.number,
    packingListId: input.packingListId,
    packingListNumber: undefined, // Could fetch if packingListId provided
    projectId: input.projectId,
    projectName: input.projectName,
    inspectionType: input.inspectionType,
    inspectionLocation: input.inspectionLocation,
    inspectionDate: Timestamp.fromDate(input.inspectionDate),
    overallCondition,
    overallNotes: input.overallNotes,
    hasIssues,
    issuesSummary: hasIssues
      ? input.items
          .filter((item) => item.hasIssues)
          .flatMap((item) => item.issues || [])
          .join('; ')
      : undefined,
    status: 'IN_PROGRESS',
    approvedForPayment: false,
    inspectedBy: userId,
    inspectedByName: userName,
    createdAt: now,
    updatedAt: now,
  };

  const grRef = await addDoc(collection(db, COLLECTIONS.GOODS_RECEIPTS), grData);

  // Create GR items
  const batch = writeBatch(db);

  // Get PO items to populate descriptions
  const poItemsQuery = query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where('purchaseOrderId', '==', input.purchaseOrderId)
  );
  const poItemsSnapshot = await getDocs(poItemsQuery);
  const poItems = poItemsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PurchaseOrderItem[];

  input.items.forEach((item, index) => {
    const poItem = poItems.find((pi) => pi.id === item.poItemId);

    const grItemData: Omit<GoodsReceiptItem, 'id'> = {
      goodsReceiptId: grRef.id,
      poItemId: item.poItemId,
      lineNumber: index + 1,
      description: poItem?.description || 'Unknown Item',
      equipmentId: poItem?.equipmentId,
      equipmentCode: poItem?.equipmentCode,
      orderedQuantity: poItem?.quantity || 0,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      unit: poItem?.unit || '',
      condition: item.condition,
      conditionNotes: item.conditionNotes,
      testingRequired: item.testingRequired,
      testingCompleted: item.testingCompleted || false,
      testResult: item.testResult,
      photoCount: 0,
      hasIssues: item.hasIssues,
      issues: item.issues,
      createdAt: now,
      updatedAt: now,
    };

    const itemRef = doc(collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS));
    batch.set(itemRef, grItemData);

    // Update PO item quantities
    if (poItem) {
      const newDelivered = poItem.quantityDelivered + item.receivedQuantity;
      const newAccepted = poItem.quantityAccepted + item.acceptedQuantity;
      const newRejected = poItem.quantityRejected + item.rejectedQuantity;

      let deliveryStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE' = 'PARTIAL';
      if (newDelivered >= poItem.quantity) {
        deliveryStatus = 'COMPLETE';
      } else if (newDelivered === 0) {
        deliveryStatus = 'PENDING';
      }

      batch.update(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, poItem.id), {
        quantityDelivered: newDelivered,
        quantityAccepted: newAccepted,
        quantityRejected: newRejected,
        deliveryStatus,
        updatedAt: now,
      });
    }
  });

  await batch.commit();

  logger.info('Goods Receipt created', { grId: grRef.id, grNumber });

  return grRef.id;
}

// ============================================================================
// READ GR
// ============================================================================

export async function getGRById(grId: string): Promise<GoodsReceipt | null> {
  const { db } = getFirebase();

  const grDoc = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId));

  if (!grDoc.exists()) {
    return null;
  }

  return { id: grDoc.id, ...grDoc.data() } as GoodsReceipt;
}

export async function getGRItems(grId: string): Promise<GoodsReceiptItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
    where('goodsReceiptId', '==', grId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GoodsReceiptItem[];
}

// ============================================================================
// GR WORKFLOW
// ============================================================================

export async function completeGR(grId: string, userId: string, userEmail: string): Promise<void> {
  const { db } = getFirebase();

  const gr = await getGRById(grId);
  if (!gr) {
    throw new Error('Goods Receipt not found');
  }

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId), {
    status: 'COMPLETED',
    updatedAt: Timestamp.now(),
  });

  // Automatically create bill in accounting
  try {
    await createBillFromGoodsReceipt(db, gr, userId, userEmail);
  } catch (err) {
    console.error('[goodsReceiptService] Error creating bill:', err);
    // Don't fail GR completion if bill creation fails
  }

  logger.info('Goods Receipt completed', { grId });
}

export async function approveGRForPayment(
  grId: string,
  bankAccountId: string,
  userId: string,
  userEmail: string
): Promise<void> {
  const { db } = getFirebase();

  const gr = await getGRById(grId);
  if (!gr) {
    throw new Error('Goods Receipt not found');
  }

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId), {
    approvedForPayment: true,
    paymentApprovedBy: userId,
    paymentApprovedAt: now,
    updatedAt: now,
  });

  // Automatically create payment in accounting
  try {
    await createPaymentFromApprovedReceipt(db, gr, bankAccountId, userId, userEmail);
  } catch (err) {
    console.error('[goodsReceiptService] Error creating payment:', err);
  }

  logger.info('Goods Receipt approved for payment', { grId });
}
