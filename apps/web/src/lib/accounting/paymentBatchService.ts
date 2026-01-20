/**
 * Payment Batch Service
 *
 * Manages payment batches for fund allocation workflow:
 * 1. Create batch with receipts (fund sources)
 * 2. Add payments (allocations) against receipts
 * 3. Submit for approval
 * 4. Execute batch (create vendor payments, update bills, create interproject loans)
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
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { removeUndefinedValues } from '@/lib/firebase/typeHelpers';
import type {
  PaymentBatch,
  PaymentBatchStatus,
  BatchReceipt,
  BatchPayment,
  CreatePaymentBatchInput,
  AddBatchReceiptInput,
  AddBatchPaymentInput,
  ListPaymentBatchesOptions,
  PaymentBatchStats,
  VendorBill,
} from '@vapour/types';

const logger = createLogger({ context: 'paymentBatchService' });

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID for receipts/payments within a batch
 */
function generateItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate batch totals
 */
export function calculateBatchTotals(batch: Partial<PaymentBatch>): {
  totalReceiptAmount: number;
  totalPaymentAmount: number;
  remainingBalance: number;
} {
  const totalReceiptAmount = (batch.receipts || []).reduce((sum, r) => sum + r.amount, 0);
  const totalPaymentAmount = (batch.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = totalReceiptAmount - totalPaymentAmount;

  return { totalReceiptAmount, totalPaymentAmount, remainingBalance };
}

/**
 * Convert a date-like value (Timestamp, Date, string) to Date
 */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return undefined;
}

/**
 * Convert Firestore document to PaymentBatch
 */
function docToPaymentBatch(docData: Record<string, unknown>, id: string): PaymentBatch {
  // Convert receipts with proper date handling
  const rawReceipts = (docData.receipts as Array<Record<string, unknown>>) || [];
  const receipts: BatchReceipt[] = rawReceipts.map((r) => ({
    ...r,
    receiptDate: toDate(r.receiptDate) || new Date(),
  })) as BatchReceipt[];

  // Payments don't have dates that need conversion currently
  const payments = (docData.payments as BatchPayment[]) || [];

  return {
    id,
    batchNumber: (docData.batchNumber as string) || '',
    receipts,
    totalReceiptAmount: (docData.totalReceiptAmount as number) || 0,
    payments,
    totalPaymentAmount: (docData.totalPaymentAmount as number) || 0,
    remainingBalance: (docData.remainingBalance as number) || 0,
    bankBalanceAfter: docData.bankBalanceAfter as number | undefined,
    bankAccountId: (docData.bankAccountId as string) || '',
    bankAccountName: (docData.bankAccountName as string) || '',
    status: (docData.status as PaymentBatchStatus) || 'DRAFT',
    createdBy: (docData.createdBy as string) || '',
    createdAt: toDate(docData.createdAt) || new Date(),
    submittedAt: toDate(docData.submittedAt),
    approvedBy: docData.approvedBy as string | undefined,
    approvedAt: toDate(docData.approvedAt),
    executedAt: toDate(docData.executedAt),
    rejectionReason: docData.rejectionReason as string | undefined,
    notes: docData.notes as string | undefined,
    updatedAt: toDate(docData.updatedAt),
  };
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new payment batch
 */
/**
 * Generate a batch number for payment batches
 */
async function generateBatchNumber(db: Firestore): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const counterKey = `payment-batch-${year}`;
  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const batchNumber = await runTransaction(db, async (transaction) => {
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
      transaction.set(counterRef, {
        type: 'payment_batch',
        year,
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    const formattedNumber = sequence.toString().padStart(4, '0');
    return `PB-${year}-${formattedNumber}`;
  });

  return batchNumber;
}

/**
 * Create a new payment batch
 */
export async function createPaymentBatch(
  db: Firestore,
  input: CreatePaymentBatchInput,
  userId: string
): Promise<PaymentBatch> {
  logger.info('[createPaymentBatch] Creating new batch', { userId });

  // Generate batch number
  const batchNumber = await generateBatchNumber(db);

  const now = Timestamp.now();
  const batchData = {
    batchNumber,
    receipts: [],
    totalReceiptAmount: 0,
    payments: [],
    totalPaymentAmount: 0,
    remainingBalance: 0,
    bankAccountId: input.bankAccountId,
    bankAccountName: input.bankAccountName,
    status: 'DRAFT' as PaymentBatchStatus,
    createdBy: userId,
    createdAt: now,
    // Only include notes if it has a value (Firestore doesn't accept undefined)
    ...(input.notes ? { notes: input.notes } : {}),
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.PAYMENT_BATCHES), batchData);

  logger.info('[createPaymentBatch] Batch created', { batchId: docRef.id, batchNumber });

  return {
    id: docRef.id,
    ...batchData,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

/**
 * Get a payment batch by ID
 */
export async function getPaymentBatch(
  db: Firestore,
  batchId: string
): Promise<PaymentBatch | null> {
  const docRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docToPaymentBatch(docSnap.data(), docSnap.id);
}

/**
 * List payment batches with optional filters
 */
export async function listPaymentBatches(
  db: Firestore,
  options: ListPaymentBatchesOptions = {}
): Promise<PaymentBatch[]> {
  let q = query(
    collection(db, COLLECTIONS.PAYMENT_BATCHES),
    orderBy(options.orderBy || 'createdAt', options.orderDirection || 'desc')
  );

  // Apply status filter
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    q = query(q, where('status', 'in', statuses));
  }

  // Apply creator filter
  if (options.createdBy) {
    q = query(q, where('createdBy', '==', options.createdBy));
  }

  // Apply limit
  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docToPaymentBatch(docSnap.data(), docSnap.id));
}

/**
 * Update a payment batch
 */
export async function updatePaymentBatch(
  db: Firestore,
  batchId: string,
  updates: Partial<PaymentBatch>
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);

  // Recalculate totals if receipts or payments changed
  if (updates.receipts || updates.payments) {
    const batch = await getPaymentBatch(db, batchId);
    if (batch) {
      const merged = {
        receipts: updates.receipts || batch.receipts,
        payments: updates.payments || batch.payments,
      };
      const totals = calculateBatchTotals(merged);
      updates = { ...updates, ...totals };
    }
  }

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Receipt Management
// ============================================

/**
 * Add a receipt to a payment batch
 */
export async function addBatchReceipt(
  db: Firestore,
  batchId: string,
  input: AddBatchReceiptInput
): Promise<BatchReceipt> {
  // Remove undefined values - Firestore doesn't accept them
  const receipt = removeUndefinedValues<BatchReceipt>({
    id: generateItemId(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    projectId: input.projectId,
    projectName: input.projectName,
    entityId: input.entityId,
    entityName: input.entityName,
    receiptDate: input.receiptDate,
  });

  // Use runTransaction to prevent race conditions
  await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error('Payment batch not found');
    }

    const batchData = batchSnap.data();
    if (batchData.status !== 'DRAFT') {
      throw new Error('Cannot modify a batch that is not in DRAFT status');
    }

    const currentPayments = (batchData.payments || []) as BatchPayment[];
    const currentReceipts = (batchData.receipts || []) as BatchReceipt[];
    const updatedReceipts = [...currentReceipts, receipt];
    const totals = calculateBatchTotals({ receipts: updatedReceipts, payments: currentPayments });

    transaction.update(batchRef, {
      receipts: updatedReceipts,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[addBatchReceipt] Receipt added', { batchId, receiptId: receipt.id });

  return receipt;
}

/**
 * Remove a receipt from a payment batch
 */
export async function removeBatchReceipt(
  db: Firestore,
  batchId: string,
  receiptId: string
): Promise<void> {
  // Use runTransaction to prevent race conditions
  await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error('Payment batch not found');
    }

    const batchData = batchSnap.data();
    if (batchData.status !== 'DRAFT') {
      throw new Error('Cannot modify a batch that is not in DRAFT status');
    }

    const currentPayments = (batchData.payments || []) as BatchPayment[];
    const currentReceipts = (batchData.receipts || []) as BatchReceipt[];
    const updatedReceipts = currentReceipts.filter((r) => r.id !== receiptId);
    const totals = calculateBatchTotals({ receipts: updatedReceipts, payments: currentPayments });

    transaction.update(batchRef, {
      receipts: updatedReceipts,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[removeBatchReceipt] Receipt removed', { batchId, receiptId });
}

// ============================================
// Payment Management
// ============================================

/**
 * Add a payment to a payment batch
 */
export async function addBatchPayment(
  db: Firestore,
  batchId: string,
  input: AddBatchPaymentInput
): Promise<BatchPayment> {
  // Validate input amounts upfront (before transaction)
  if (input.amount <= 0) {
    throw new Error('Payment amount must be positive');
  }
  if (input.tdsAmount !== undefined && input.tdsAmount < 0) {
    throw new Error('TDS amount cannot be negative');
  }

  // Calculate net payable
  const netPayable = input.tdsAmount ? input.amount - input.tdsAmount : input.amount;

  if (netPayable <= 0) {
    throw new Error('Net payable amount must be positive (TDS cannot exceed payment amount)');
  }

  // Remove undefined values - Firestore doesn't accept them
  const payment = removeUndefinedValues<BatchPayment>({
    id: generateItemId(),
    linkedType: input.linkedType,
    linkedId: input.linkedId,
    linkedReference: input.linkedReference,
    payeeType: input.payeeType,
    entityId: input.entityId,
    entityName: input.entityName,
    amount: input.amount,
    currency: input.currency,
    tdsAmount: input.tdsAmount,
    tdsSection: input.tdsSection,
    netPayable,
    projectId: input.projectId,
    projectName: input.projectName,
    status: 'PENDING',
    notes: input.notes,
  });

  // Use runTransaction to prevent race conditions
  await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error('Payment batch not found');
    }

    const batchData = batchSnap.data();
    if (batchData.status !== 'DRAFT') {
      throw new Error('Cannot modify a batch that is not in DRAFT status');
    }

    const currentPayments = (batchData.payments || []) as BatchPayment[];
    const currentReceipts = (batchData.receipts || []) as BatchReceipt[];
    const updatedPayments = [...currentPayments, payment];
    const totals = calculateBatchTotals({ receipts: currentReceipts, payments: updatedPayments });

    transaction.update(batchRef, {
      payments: updatedPayments,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[addBatchPayment] Payment added', { batchId, paymentId: payment.id });

  return payment;
}

/**
 * Remove a payment from a payment batch
 */
export async function removeBatchPayment(
  db: Firestore,
  batchId: string,
  paymentId: string
): Promise<void> {
  // Use runTransaction to prevent race conditions
  await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error('Payment batch not found');
    }

    const batchData = batchSnap.data();
    if (batchData.status !== 'DRAFT') {
      throw new Error('Cannot modify a batch that is not in DRAFT status');
    }

    const currentPayments = (batchData.payments || []) as BatchPayment[];
    const currentReceipts = (batchData.receipts || []) as BatchReceipt[];
    const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);
    const totals = calculateBatchTotals({ receipts: currentReceipts, payments: updatedPayments });

    transaction.update(batchRef, {
      payments: updatedPayments,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[removeBatchPayment] Payment removed', { batchId, paymentId });
}

/**
 * Update a payment within a batch
 */
export async function updateBatchPayment(
  db: Firestore,
  batchId: string,
  paymentId: string,
  updates: Partial<AddBatchPaymentInput>
): Promise<void> {
  // Use runTransaction to prevent race conditions
  await runTransaction(db, async (transaction) => {
    const batchRef = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const batchSnap = await transaction.get(batchRef);

    if (!batchSnap.exists()) {
      throw new Error('Payment batch not found');
    }

    const batchData = batchSnap.data();
    if (batchData.status !== 'DRAFT') {
      throw new Error('Cannot modify a batch that is not in DRAFT status');
    }

    const currentPayments = (batchData.payments || []) as BatchPayment[];
    const currentReceipts = (batchData.receipts || []) as BatchReceipt[];

    const existingPayment = currentPayments.find((p) => p.id === paymentId);
    if (!existingPayment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const paymentIndex = currentPayments.findIndex((p) => p.id === paymentId);

    const updatedPayment: BatchPayment = {
      ...existingPayment,
      ...updates,
      id: existingPayment.id, // Ensure id is always present
      entityName: updates.entityName || existingPayment.entityName,
      amount: updates.amount || existingPayment.amount,
      currency: updates.currency || existingPayment.currency,
      status: existingPayment.status,
      netPayable:
        updates.tdsAmount !== undefined
          ? (updates.amount || existingPayment.amount) - updates.tdsAmount
          : updates.amount
            ? updates.amount - (existingPayment.tdsAmount || 0)
            : existingPayment.netPayable,
    };

    const updatedPayments = [...currentPayments];
    updatedPayments[paymentIndex] = updatedPayment;

    const totals = calculateBatchTotals({ receipts: currentReceipts, payments: updatedPayments });

    transaction.update(batchRef, {
      payments: updatedPayments,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[updateBatchPayment] Payment updated', { batchId, paymentId });
}

// ============================================
// Workflow Operations
// ============================================

/**
 * Submit a payment batch for approval
 */
export async function submitBatchForApproval(db: Firestore, batchId: string): Promise<void> {
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  if (batch.status !== 'DRAFT') {
    throw new Error('Only DRAFT batches can be submitted for approval');
  }
  if (batch.receipts.length === 0) {
    throw new Error('Cannot submit a batch with no receipts');
  }
  if (batch.payments.length === 0) {
    throw new Error('Cannot submit a batch with no payments');
  }
  if (batch.totalPaymentAmount > batch.totalReceiptAmount) {
    throw new Error('Total payments exceed total receipts');
  }

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'PENDING_APPROVAL',
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('[submitBatchForApproval] Batch submitted', { batchId });
}

/**
 * Approve a payment batch
 */
export async function approveBatch(
  db: Firestore,
  batchId: string,
  approverId: string
): Promise<void> {
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  if (batch.status !== 'PENDING_APPROVAL') {
    throw new Error('Only PENDING_APPROVAL batches can be approved');
  }

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'APPROVED',
    approvedBy: approverId,
    approvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('[approveBatch] Batch approved', { batchId, approverId });
}

/**
 * Reject a payment batch
 */
export async function rejectBatch(db: Firestore, batchId: string, reason: string): Promise<void> {
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  if (batch.status !== 'PENDING_APPROVAL') {
    throw new Error('Only PENDING_APPROVAL batches can be rejected');
  }

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'REJECTED',
    rejectionReason: reason,
    updatedAt: Timestamp.now(),
  });

  logger.info('[rejectBatch] Batch rejected', { batchId, reason });
}

/**
 * Cancel a payment batch
 */
export async function cancelBatch(db: Firestore, batchId: string): Promise<void> {
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  if (!['DRAFT', 'REJECTED'].includes(batch.status)) {
    throw new Error('Only DRAFT or REJECTED batches can be cancelled');
  }

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'CANCELLED',
    updatedAt: Timestamp.now(),
  });

  logger.info('[cancelBatch] Batch cancelled', { batchId });
}

// ============================================
// Bill/Recurring Lookup
// ============================================

/**
 * Get outstanding vendor bills for a project
 */
export async function getOutstandingBillsForProject(
  db: Firestore,
  projectId?: string,
  includeAllProjects: boolean = false
): Promise<VendorBill[]> {
  const q = query(
    collection(db, COLLECTIONS.TRANSACTIONS),
    where('type', '==', 'VENDOR_BILL'),
    where('paymentStatus', 'in', ['UNPAID', 'PARTIAL']),
    orderBy('dueDate', 'asc')
  );

  // If projectId specified and not including all, filter by project
  // Note: Firestore doesn't support optional where clauses, so we filter in memory
  const snapshot = await getDocs(q);

  let bills: VendorBill[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<VendorBill, 'id'>;
    return {
      id: docSnap.id,
      ...data,
      billDate: data.billDate instanceof Timestamp ? data.billDate.toDate() : data.billDate,
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
    };
  });

  // Filter by project if needed
  if (projectId && !includeAllProjects) {
    bills = bills.filter((b) => b.costCentreId === projectId || b.projectId === projectId);
  }

  return bills;
}

/**
 * Get outstanding bills for all projects (grouped by project)
 */
export async function getOutstandingBillsByProject(
  db: Firestore
): Promise<Map<string, VendorBill[]>> {
  const bills = await getOutstandingBillsForProject(db, undefined, true);
  const grouped = new Map<string, VendorBill[]>();

  for (const bill of bills) {
    const projectId = bill.projectId || bill.costCentreId || 'no-project';
    if (!grouped.has(projectId)) {
      grouped.set(projectId, []);
    }
    grouped.get(projectId)?.push(bill);
  }

  return grouped;
}

// ============================================
// Cross-Project Detection
// ============================================

/**
 * Detect cross-project payments that will create interproject loans
 */
export function detectCrossProjectPayments(batch: PaymentBatch): Array<{
  payment: BatchPayment;
  lendingProjectId: string;
  lendingProjectName: string;
  borrowingProjectId: string;
  borrowingProjectName: string;
}> {
  // Get source project IDs from receipts
  const sourceProjects = batch.receipts
    .filter((r) => r.projectId)
    .map((r) => ({ id: r.projectId!, name: r.projectName || r.projectId! }));

  if (sourceProjects.length === 0) {
    // No project-specific receipts, no cross-project loans needed
    return [];
  }

  const primarySource = sourceProjects[0];
  // This should never happen since we checked length above, but satisfy TypeScript
  if (!primarySource) {
    return [];
  }

  const sourceProjectIds = new Set(sourceProjects.map((p) => p.id));

  // Find payments to projects not in source
  return batch.payments
    .filter((p) => p.projectId && !sourceProjectIds.has(p.projectId))
    .map((p) => ({
      payment: p,
      lendingProjectId: primarySource.id,
      lendingProjectName: primarySource.name,
      borrowingProjectId: p.projectId!,
      borrowingProjectName: p.projectName || p.projectId!,
    }));
}

// ============================================
// Statistics
// ============================================

/**
 * Get payment batch statistics
 */
export async function getPaymentBatchStats(db: Firestore): Promise<PaymentBatchStats> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.PAYMENT_BATCHES));

  const stats: PaymentBatchStats = {
    byStatus: {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      EXECUTING: 0,
      COMPLETED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    },
    pendingApprovalAmount: 0,
    approvedAmount: 0,
    completedThisMonth: 0,
    paidThisMonthAmount: 0,
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const status = data.status as PaymentBatchStatus;
    const totalPayment = (data.totalPaymentAmount as number) || 0;

    stats.byStatus[status]++;

    if (status === 'PENDING_APPROVAL') {
      stats.pendingApprovalAmount += totalPayment;
    } else if (status === 'APPROVED') {
      stats.approvedAmount += totalPayment;
    } else if (status === 'COMPLETED') {
      const executedAt =
        data.executedAt instanceof Timestamp ? data.executedAt.toDate() : data.executedAt;
      if (executedAt && new Date(executedAt as string) >= startOfMonth) {
        stats.completedThisMonth++;
        stats.paidThisMonthAmount += totalPayment;
      }
    }
  }

  return stats;
}
