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
  Timestamp,
  writeBatch,
  runTransaction,
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
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

const logger = createLogger({ context: 'goodsReceiptService' });
import {
  createBillFromGoodsReceipt,
  createPaymentFromApprovedReceipt,
} from './accountingIntegration';

// ============================================================================
// GR NUMBER GENERATION (ATOMIC)
// ============================================================================

/**
 * Generate GR number using atomic transaction
 * Uses a counter document to prevent race conditions
 * Format: GR/YYYY/MM/XXXX
 */
async function generateGRNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const counterKey = `gr-${year}-${month}`;

  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const grNumber = await runTransaction(db, async (transaction) => {
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
        type: 'goods_receipt',
        year,
        month: parseInt(month, 10),
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `GR/${year}/${month}/${sequenceStr}`;
  });

  return grNumber;
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

  // Audit log: GR created
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'GR_CREATED',
    'GOODS_RECEIPT',
    grRef.id,
    `Created Goods Receipt ${grNumber} for PO ${po.number}`,
    {
      entityName: grNumber,
      metadata: {
        purchaseOrderId: po.id,
        poNumber: po.number,
        vendorName: po.vendorName,
        overallCondition,
        itemCount: input.items.length,
        hasIssues,
      },
    }
  );

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

export async function completeGR(
  grId: string,
  userId: string,
  userEmail: string,
  userName?: string
): Promise<void> {
  const { db } = getFirebase();

  const gr = await getGRById(grId);
  if (!gr) {
    throw new Error('Goods Receipt not found');
  }

  // Get PO to find creator for task notification
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, gr.purchaseOrderId));
  const po = poDoc.exists() ? (poDoc.data() as PurchaseOrder) : null;

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId), {
    status: 'COMPLETED',
    updatedAt: Timestamp.now(),
  });

  // Audit log: GR completed
  const auditContext = createAuditContext(userId, '', userName || userEmail);
  await logAuditEvent(
    db,
    auditContext,
    'GR_COMPLETED',
    'GOODS_RECEIPT',
    grId,
    `Completed Goods Receipt ${gr.number}`,
    {
      entityName: gr.number,
      metadata: {
        poNumber: gr.poNumber,
        overallCondition: gr.overallCondition,
      },
    }
  );

  // Create task notification for PO creator to approve payment
  if (po?.createdBy) {
    try {
      await createTaskNotification({
        type: 'actionable',
        category: 'GR_READY_FOR_PAYMENT',
        userId: po.createdBy,
        assignedBy: userId,
        assignedByName: userName || userEmail,
        title: `Approve Payment for GR ${gr.number}`,
        message: `Goods Receipt ${gr.number} for PO ${gr.poNumber} (${po.vendorName || 'vendor'}) is complete. Please review and approve for payment.`,
        entityType: 'GOODS_RECEIPT',
        entityId: grId,
        linkUrl: `/procurement/goods-receipts/${grId}`,
        priority: gr.overallCondition === 'ACCEPTED' ? 'MEDIUM' : 'HIGH',
        autoCompletable: true,
        projectId: gr.projectId,
      });
    } catch (err) {
      logger.error('Failed to create GR payment approval task', { error: err, grId });
      // Don't fail main operation
    }
  }

  // Automatically create bill in accounting
  try {
    await createBillFromGoodsReceipt(db, gr, userId, userEmail);
  } catch (err) {
    logger.error('Error creating bill from GR', { error: err, grId });
    // Don't fail GR completion if bill creation fails
  }

  logger.info('Goods Receipt completed', { grId });
}

export async function approveGRForPayment(
  grId: string,
  bankAccountId: string,
  userId: string,
  userEmail: string,
  userName?: string
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

  // Complete the GR_READY_FOR_PAYMENT task
  try {
    const { findTaskNotificationByEntity, completeActionableTask } =
      await import('@/lib/tasks/taskNotificationService');
    const task = await findTaskNotificationByEntity('GOODS_RECEIPT', grId, 'GR_READY_FOR_PAYMENT', [
      'pending',
      'in_progress',
    ]);
    if (task) {
      await completeActionableTask(task.id, userId, true);
    }
  } catch (err) {
    logger.error('Failed to complete GR payment task', { error: err, grId });
    // Don't fail main operation
  }

  // Create informational notification for the inspector
  if (gr.inspectedBy && gr.inspectedBy !== userId) {
    try {
      await createTaskNotification({
        type: 'informational',
        category: 'GR_PAYMENT_APPROVED',
        userId: gr.inspectedBy,
        assignedBy: userId,
        assignedByName: userName || userEmail,
        title: `Payment Approved for GR ${gr.number}`,
        message: `Payment has been approved for Goods Receipt ${gr.number} (PO ${gr.poNumber}). Vendor payment will be processed.`,
        entityType: 'GOODS_RECEIPT',
        entityId: grId,
        linkUrl: `/procurement/goods-receipts/${grId}`,
        priority: 'LOW',
        projectId: gr.projectId,
      });
    } catch (err) {
      logger.error('Failed to create GR payment approved notification', { error: err, grId });
      // Don't fail main operation
    }
  }

  // Automatically create payment in accounting
  try {
    await createPaymentFromApprovedReceipt(db, gr, bankAccountId, userId, userEmail);
  } catch (err) {
    logger.error('Error creating payment from GR', { error: err, grId });
  }

  logger.info('Goods Receipt approved for payment', { grId });
}

// ============================================================================
// LIST GOODS RECEIPTS
// ============================================================================

export interface ListGoodsReceiptsFilters {
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUES_FOUND';
  purchaseOrderId?: string;
  projectId?: string;
  approvedForPayment?: boolean;
}

export async function listGoodsReceipts(
  filters: ListGoodsReceiptsFilters = {}
): Promise<GoodsReceipt[]> {
  const { db } = getFirebase();

  const constraints: ReturnType<typeof where>[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.purchaseOrderId) {
    constraints.push(where('purchaseOrderId', '==', filters.purchaseOrderId));
  }
  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }
  if (filters.approvedForPayment !== undefined) {
    constraints.push(where('approvedForPayment', '==', filters.approvedForPayment));
  }

  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    ...constraints,
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GoodsReceipt[];
}

export async function getGoodsReceiptsByPO(purchaseOrderId: string): Promise<GoodsReceipt[]> {
  return listGoodsReceipts({ purchaseOrderId });
}
