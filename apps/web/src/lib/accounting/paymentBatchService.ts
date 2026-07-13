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
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { preventSelfApproval } from '@/lib/auth/authorizationService';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';
import { paymentBatchStateMachine } from '@/lib/workflow/stateMachines';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { createPaymentWithAllocationsAtomic } from './paymentHelpers';
import { createInterprojectLoan } from './interprojectLoanService';
import { roundToPaisa, getInrAmount } from './amountHelpers';
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
  PaymentAllocation,
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
  // rule8-exempt: sets the initial status on a brand-new document (no prior state to transition from) — state-machine validation only applies to transitions, not first-write
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
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
    // Only include optional fields if they have values (Firestore doesn't accept undefined)
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
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
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
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
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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

/**
 * Update a receipt within a batch
 */
export async function updateBatchReceipt(
  db: Firestore,
  batchId: string,
  receiptId: string,
  updates: Partial<AddBatchReceiptInput>
): Promise<void> {
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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

    const receiptIndex = currentReceipts.findIndex((r) => r.id === receiptId);
    if (receiptIndex === -1) {
      throw new Error(`Receipt not found: ${receiptId}`);
    }

    const existingReceipt = currentReceipts[receiptIndex]!;
    const updatedReceipt = removeUndefinedValues<BatchReceipt>({
      ...existingReceipt,
      ...updates,
      id: existingReceipt.id,
    });

    const updatedReceipts = [...currentReceipts];
    updatedReceipts[receiptIndex] = updatedReceipt;

    const totals = calculateBatchTotals({ receipts: updatedReceipts, payments: currentPayments });

    transaction.update(batchRef, {
      receipts: updatedReceipts,
      ...totals,
      updatedAt: Timestamp.now(),
    });
  });

  logger.info('[updateBatchReceipt] Receipt updated', { batchId, receiptId });
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
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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
    category: input.category,
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
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING — server-side gated
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

    // Remove undefined values - Firestore doesn't accept them
    const updatedPayment = removeUndefinedValues<BatchPayment>({
      ...existingPayment,
      ...updates,
      id: existingPayment.id, // Ensure id is always present
      entityName: updates.entityName || existingPayment.entityName,
      amount: updates.amount ?? existingPayment.amount,
      currency: updates.currency || existingPayment.currency,
      status: existingPayment.status,
      netPayable:
        updates.tdsAmount !== undefined
          ? (updates.amount ?? existingPayment.amount) - updates.tdsAmount
          : updates.amount
            ? updates.amount - (existingPayment.tdsAmount || 0)
            : existingPayment.netPayable,
    });

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
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  requireValidTransition(
    paymentBatchStateMachine,
    batch.status,
    'PENDING_APPROVAL',
    'PaymentBatch'
  );
  if (batch.receipts.length === 0) {
    throw new Error('Cannot submit a batch with no receipts');
  }
  if (batch.payments.length === 0) {
    throw new Error('Cannot submit a batch with no payments');
  }
  if (batch.totalPaymentAmount > batch.totalReceiptAmount) {
    throw new Error('Total payments exceed total receipts');
  }
  if (!batch.bankAccountId || batch.bankAccountId === 'primary-bank') {
    // 'primary-bank' is the legacy placeholder written before the account selector existed
    throw new Error('Select the bank account to pay from before submitting the batch');
  }

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'PENDING_APPROVAL',
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('[submitBatchForApproval] Batch submitted', { batchId });

  await logAuditEvent(
    db,
    createAuditContext(batch.createdBy, '', ''),
    'BATCH_SUBMITTED',
    'PAYMENT_BATCH',
    batchId,
    `Payment batch ${batch.batchNumber} submitted for approval`,
    {
      entityName: batch.batchNumber,
      metadata: {
        totalReceiptAmount: batch.totalReceiptAmount,
        totalPaymentAmount: batch.totalPaymentAmount,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

/**
 * Approve a payment batch
 */
export async function approveBatch(
  db: Firestore,
  batchId: string,
  approverId: string
): Promise<void> {
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  preventSelfApproval(approverId, batch.createdBy, 'approve payment batch');
  requireValidTransition(paymentBatchStateMachine, batch.status, 'APPROVED', 'PaymentBatch');

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'APPROVED',
    approvedBy: approverId,
    approvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('[approveBatch] Batch approved', { batchId, approverId });

  await logAuditEvent(
    db,
    createAuditContext(approverId, '', ''),
    'BATCH_APPROVED',
    'PAYMENT_BATCH',
    batchId,
    `Payment batch ${batch.batchNumber} approved`,
    {
      entityName: batch.batchNumber,
      severity: 'WARNING',
      metadata: {
        submittedBy: batch.createdBy,
        totalPaymentAmount: batch.totalPaymentAmount,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

/**
 * Reject a payment batch
 */
export async function rejectBatch(
  db: Firestore,
  batchId: string,
  reason: string,
  rejecterId: string
): Promise<void> {
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  preventSelfApproval(rejecterId, batch.createdBy, 'reject payment batch');
  requireValidTransition(paymentBatchStateMachine, batch.status, 'REJECTED', 'PaymentBatch');

  await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
    status: 'REJECTED',
    rejectionReason: reason,
    rejectedBy: rejecterId,
    rejectedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  logger.info('[rejectBatch] Batch rejected', { batchId, rejecterId, reason });

  await logAuditEvent(
    db,
    createAuditContext(rejecterId, '', ''),
    'BATCH_REJECTED',
    'PAYMENT_BATCH',
    batchId,
    `Payment batch ${batch.batchNumber} rejected: ${reason}`,
    {
      entityName: batch.batchNumber,
      severity: 'WARNING',
      metadata: {
        submittedBy: batch.createdBy,
        rejectionReason: reason,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

// ============================================
// Batch Execution
// ============================================

export interface ExecuteBatchResult {
  paid: number;
  failed: number;
  alreadyPaid: number;
  loansCreated: number;
  errors: Array<{ paymentId: string; entityName: string; error: string }>;
}

/**
 * Update a single payment entry inside the batch's payments array.
 * Firestore transaction because concurrent writers (retry, second tab)
 * would otherwise clobber each other's array writes (rule 19).
 */
async function updateBatchPaymentEntry(
  db: Firestore,
  batchId: string,
  paymentId: string,
  patch: Partial<BatchPayment>
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`Payment batch not found: ${batchId}`);
    }
    const payments = ((snap.data().payments as BatchPayment[]) || []).map((p) =>
      p.id === paymentId ? (removeUndefinedValues({ ...p, ...patch }) as BatchPayment) : p
    );
    tx.update(ref, { payments, updatedAt: Timestamp.now() });
  });
}

/**
 * Execute an approved payment batch: create one POSTED VENDOR_PAYMENT
 * transaction per pending payment (allocated to its bill when linked),
 * mark entries PAID/FAILED, create interproject loans for cross-project
 * payments, and complete the batch when nothing is left pending.
 *
 * Idempotent (rule 9): re-running skips PAID entries and retries FAILED
 * ones, so a double-click or a partial failure can always be resumed.
 */
export async function executeBatch(
  db: Firestore,
  batchId: string,
  executor: { uid: string; email?: string; displayName?: string; tenantId?: string }
): Promise<ExecuteBatchResult> {
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }

  if (!batch.bankAccountId || batch.bankAccountId === 'primary-bank') {
    throw new Error('Select the bank account to pay from before executing the batch');
  }
  const bankSnap = await retryOnStaleToken(() =>
    getDoc(doc(db, COLLECTIONS.ACCOUNTS, batch.bankAccountId))
  );
  if (!bankSnap.exists()) {
    throw new Error(
      `Bank account "${batch.bankAccountName || batch.bankAccountId}" not found in the chart of accounts`
    );
  }

  // Claim the batch: APPROVED -> EXECUTING exactly once; EXECUTING = resume.
  if (batch.status === 'APPROVED') {
    requireValidTransition(paymentBatchStateMachine, batch.status, 'EXECUTING', 'PaymentBatch');
    await runTransaction(db, async (tx) => {
      const ref = doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId);
      const snap = await tx.get(ref);
      const status = snap.data()?.status as PaymentBatchStatus | undefined;
      if (status === 'EXECUTING') return; // a concurrent click already claimed it
      if (status !== 'APPROVED') {
        throw new Error(`Cannot execute a payment batch in status ${status}`);
      }
      tx.update(ref, { status: 'EXECUTING', updatedAt: Timestamp.now() });
    });
  } else if (batch.status !== 'EXECUTING') {
    // Throws the standard descriptive invalid-transition error
    requireValidTransition(paymentBatchStateMachine, batch.status, 'EXECUTING', 'PaymentBatch');
  }

  const result: ExecuteBatchResult = {
    paid: 0,
    failed: 0,
    alreadyPaid: 0,
    loansCreated: 0,
    errors: [],
  };

  // Sequential on purpose: transaction-number generation and per-payment
  // batch-doc updates stay ordered, and a mid-run failure leaves a clean,
  // resumable trail.
  for (const payment of batch.payments) {
    if (payment.status === 'PAID') {
      result.alreadyPaid++;
      continue;
    }
    if (payment.status === 'SKIPPED') {
      continue;
    }

    try {
      if (!payment.entityId) {
        throw new Error(
          'Payment has no linked entity — link a vendor/employee entity to this payment before executing'
        );
      }

      const gross = roundToPaisa(payment.amount);
      const transactionNumber = await retryOnStaleToken(() =>
        generateTransactionNumber('VENDOR_PAYMENT')
      );
      const now = Timestamp.now();

      // One allocation against the linked bill; validated against the bill's
      // real outstanding inside createPaymentWithAllocationsAtomic (rule 23).
      let allocations: PaymentAllocation[] = [];
      if (payment.linkedType === 'VENDOR_BILL' && payment.linkedId) {
        const billSnap = await retryOnStaleToken(() =>
          getDoc(doc(db, COLLECTIONS.TRANSACTIONS, payment.linkedId!))
        );
        if (!billSnap.exists()) {
          throw new Error(
            `Linked bill ${payment.linkedReference || payment.linkedId} no longer exists`
          );
        }
        const billData = billSnap.data();
        const billTotal = getInrAmount(billData);
        const outstanding = roundToPaisa(billTotal - (billData.amountPaid ?? 0));
        allocations = [
          {
            invoiceId: payment.linkedId,
            invoiceNumber: payment.linkedReference || '',
            originalAmount: billTotal,
            allocatedAmount: gross,
            remainingAmount: roundToPaisa(outstanding - gross),
          },
        ];
      }

      const paymentData: Record<string, unknown> = {
        type: 'VENDOR_PAYMENT',
        transactionNumber,
        transactionDate: now,
        date: now,
        paymentDate: now,
        entityId: payment.entityId,
        entityName: payment.entityName,
        paymentMethod: 'BANK_TRANSFER',
        billAllocations: allocations,
        tdsDeducted: !!payment.tdsAmount,
        totalAmount: gross,
        amount: gross,
        baseAmount: gross,
        currency: payment.currency || 'INR',
        description: `${payment.linkedReference ? `${payment.linkedReference} — ` : ''}Payment to ${payment.entityName} (batch ${batch.batchNumber})`,
        reference: batch.batchNumber,
        status: 'POSTED',
        bankAccountId: batch.bankAccountId,
        attachments: [],
        createdAt: now,
        updatedAt: now,
        createdBy: executor.uid,
        paymentBatchId: batchId,
      };
      if (payment.tdsAmount) {
        paymentData.tdsAmount = payment.tdsAmount;
        if (payment.tdsSection) paymentData.tdsSection = payment.tdsSection;
      }
      if (payment.projectId) {
        paymentData.projectId = payment.projectId;
        paymentData.costCentreId = payment.projectId;
      }

      const txnId = await retryOnStaleToken(() =>
        createPaymentWithAllocationsAtomic(db, paymentData, allocations)
      );

      await updateBatchPaymentEntry(db, batchId, payment.id, {
        status: 'PAID',
        paidTransactionId: txnId,
        errorMessage: undefined, // clears a previous FAILED message on retry
      });
      result.paid++;

      await logAuditEvent(
        db,
        createAuditContext(executor.uid, executor.email || '', executor.displayName || ''),
        'PAYMENT_CREATED',
        'PAYMENT',
        txnId,
        `Vendor payment ${transactionNumber} to ${payment.entityName} executed from batch ${batch.batchNumber}`,
        {
          entityName: transactionNumber,
          metadata: {
            paymentBatchId: batchId,
            batchPaymentId: payment.id,
            amount: gross,
            billId: payment.linkedType === 'VENDOR_BILL' ? payment.linkedId : undefined,
          },
        }
      ).catch((err) => logger.error('Failed to log audit event', { error: err }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[executeBatch] Payment failed', {
        batchId,
        paymentId: payment.id,
        error,
      });
      await updateBatchPaymentEntry(db, batchId, payment.id, {
        status: 'FAILED',
        errorMessage: message,
      });
      result.failed++;
      result.errors.push({ paymentId: payment.id, entityName: payment.entityName, error: message });
    }
  }

  // Interproject loans for successfully paid cross-project payments.
  // Idempotent via interprojectLoanId stamped on the payment entry.
  const afterPayments = await getPaymentBatch(db, batchId);
  if (afterPayments) {
    for (const cross of detectCrossProjectPayments(afterPayments)) {
      const entry = afterPayments.payments.find((p) => p.id === cross.payment.id);
      if (!entry || entry.status !== 'PAID' || entry.interprojectLoanId) continue;
      try {
        const startDate = new Date();
        const maturityDate = new Date(startDate);
        maturityDate.setFullYear(maturityDate.getFullYear() + 1);
        const loan = await retryOnStaleToken(() =>
          createInterprojectLoan(db, {
            lendingProjectId: cross.lendingProjectId,
            borrowingProjectId: cross.borrowingProjectId,
            principalAmount: roundToPaisa(entry.amount),
            currency: entry.currency || 'INR',
            interestRate: 0, // internal funding: interest-free bullet loan by default
            interestCalculationMethod: 'SIMPLE',
            startDate,
            maturityDate,
            repaymentFrequency: 'BULLET',
            notes: `Auto-created from payment batch ${afterPayments.batchNumber} (payment to ${entry.entityName})`,
            userId: executor.uid,
            userName: executor.displayName || executor.email || executor.uid,
            tenantId: executor.tenantId || 'default-entity',
          })
        );
        if (!loan.success || !loan.loanId) {
          throw new Error(loan.error || 'Loan creation returned no id');
        }
        await updateBatchPaymentEntry(db, batchId, entry.id, {
          interprojectLoanId: loan.loanId,
        });
        result.loansCreated++;
      } catch (error) {
        // Degrade gracefully (rule 27): the payment itself succeeded; the loan
        // can be created manually from /accounting/interproject-loans.
        const message = error instanceof Error ? error.message : String(error);
        logger.error('[executeBatch] Interproject loan creation failed', {
          batchId,
          paymentId: entry.id,
          error,
        });
        result.errors.push({
          paymentId: entry.id,
          entityName: entry.entityName,
          error: `Payment succeeded but interproject loan was not created: ${message}`,
        });
      }
    }
  }

  // Complete the batch when nothing is left to pay
  const finalBatch = await getPaymentBatch(db, batchId);
  const unfinished = (finalBatch?.payments || []).filter(
    (p) => p.status === 'PENDING' || p.status === 'FAILED'
  );
  if (finalBatch && unfinished.length === 0) {
    requireValidTransition(paymentBatchStateMachine, 'EXECUTING', 'COMPLETED', 'PaymentBatch');
    await updateDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId), {
      status: 'COMPLETED',
      executedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  logger.info('[executeBatch] Batch execution finished', { batchId, ...result });

  await logAuditEvent(
    db,
    createAuditContext(executor.uid, executor.email || '', executor.displayName || ''),
    'BATCH_EXECUTED',
    'PAYMENT_BATCH',
    batchId,
    `Payment batch ${batch.batchNumber} executed: ${result.paid} paid, ${result.failed} failed, ${result.loansCreated} loans created`,
    {
      entityName: batch.batchNumber,
      severity: 'WARNING',
      metadata: { ...result, errors: result.errors.slice(0, 20) },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  return result;
}

/**
 * Cancel a payment batch
 */
export async function cancelBatch(db: Firestore, batchId: string): Promise<void> {
  // rule5-exempt: accounting workflow write; firestore.rules enforce MANAGE_ACCOUNTING on the affected collections — server-side gated
  const batch = await getPaymentBatch(db, batchId);
  if (!batch) {
    throw new Error(`Payment batch not found: ${batchId}`);
  }
  requireValidTransition(paymentBatchStateMachine, batch.status, 'CANCELLED', 'PaymentBatch');

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
  const constraints = [
    where('type', '==', 'VENDOR_BILL'),
    where('paymentStatus', 'in', ['UNPAID', 'PARTIALLY_PAID']),
    orderBy('dueDate', 'asc'),
  ];

  const q = query(collection(db, COLLECTIONS.TRANSACTIONS), ...constraints);

  // If projectId specified and not including all, filter by project
  // Note: Firestore doesn't support optional where clauses, so we filter in memory
  const snapshot = await getDocs(q);

  let bills: VendorBill[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<VendorBill, 'id'>;
    const rawBillDate = data.billDate ?? data.date;
    return {
      id: docSnap.id,
      ...data,
      billDate: rawBillDate instanceof Timestamp ? rawBillDate.toDate() : rawBillDate,
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
  const q = query(collection(db, COLLECTIONS.PAYMENT_BATCHES));
  const snapshot = await getDocs(q);

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
      const rawExecutedAt = data.executedAt;
      const executedAt =
        rawExecutedAt && typeof rawExecutedAt === 'object' && 'toDate' in rawExecutedAt
          ? (rawExecutedAt as { toDate: () => Date }).toDate()
          : rawExecutedAt instanceof Date
            ? rawExecutedAt
            : rawExecutedAt
              ? new Date(rawExecutedAt as string)
              : null;
      if (executedAt && executedAt >= startOfMonth) {
        stats.completedThisMonth++;
        stats.paidThisMonthAmount += totalPayment;
      }
    }
  }

  return stats;
}
