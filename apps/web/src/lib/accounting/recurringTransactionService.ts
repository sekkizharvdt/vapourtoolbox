/**
 * Recurring Transaction Service
 *
 * Manages recurring transactions (invoices, bills, salaries, journal entries)
 * and their generated occurrences.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
  type QueryConstraint,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  RecurringTransaction,
  RecurringTransactionType,
  RecurringTransactionStatus,
  RecurrenceFrequency,
  RecurringOccurrence,
  OccurrenceStatus,
  RecurringTransactionInput,
  RecurringTransactionSummary,
  RecurringTransactionFilters,
  CurrencyCode,
} from '@vapour/types';

const logger = createLogger({ context: 'recurringTransactionService' });

/**
 * Calculate the next occurrence date based on frequency and current date
 */
export function calculateNextOccurrence(
  frequency: RecurrenceFrequency,
  startDate: Date,
  lastOccurrence?: Date,
  dayOfMonth?: number,
  dayOfWeek?: number
): Date {
  const baseDate = lastOccurrence ? new Date(lastOccurrence) : new Date(startDate);
  const result = new Date(baseDate);

  switch (frequency) {
    case 'DAILY':
      result.setDate(result.getDate() + 1);
      break;

    case 'WEEKLY':
      result.setDate(result.getDate() + 7);
      if (dayOfWeek !== undefined) {
        // Adjust to the specific day of week
        const currentDay = result.getDay();
        const diff = dayOfWeek - currentDay;
        result.setDate(result.getDate() + diff);
      }
      break;

    case 'BIWEEKLY':
      result.setDate(result.getDate() + 14);
      break;

    case 'MONTHLY': {
      // Store original day before changing month to avoid JS date overflow
      const originalDay = result.getDate();
      const targetMonth = result.getMonth() + 1;
      const targetYear = targetMonth > 11 ? result.getFullYear() + 1 : result.getFullYear();
      const normalizedMonth = targetMonth % 12;

      if (dayOfMonth !== undefined) {
        if (dayOfMonth === 0) {
          // Last day of month - set to day 0 of next month
          result.setFullYear(targetYear, normalizedMonth + 1, 0);
        } else {
          // Specific day, handle months with fewer days
          const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
          result.setFullYear(targetYear, normalizedMonth, Math.min(dayOfMonth, lastDay));
        }
      } else {
        // No specific day, preserve original day but handle month overflow
        // E.g., Jan 31 -> Feb 28 (not Mar 3)
        const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const safeDay = Math.min(originalDay, lastDayOfTargetMonth);
        result.setFullYear(targetYear, normalizedMonth, safeDay);
      }
      break;
    }

    case 'QUARTERLY':
      result.setMonth(result.getMonth() + 3);
      if (dayOfMonth !== undefined && dayOfMonth !== 0) {
        const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        result.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;

    case 'YEARLY':
      result.setFullYear(result.getFullYear() + 1);
      break;
  }

  return result;
}

/**
 * Get all recurring transactions with optional filters
 */
export async function getRecurringTransactions(
  db: Firestore,
  filters?: RecurringTransactionFilters
): Promise<RecurringTransaction[]> {
  const constraints: QueryConstraint[] = [];

  if (filters?.type) {
    constraints.push(where('type', '==', filters.type));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters?.frequency) {
    constraints.push(where('frequency', '==', filters.frequency));
  }

  if (filters?.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  if (filters?.customerId) {
    constraints.push(where('customerId', '==', filters.customerId));
  }

  constraints.push(orderBy('name', 'asc'));

  const q = query(collection(db, COLLECTIONS.RECURRING_TRANSACTIONS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecurringTransaction[];
}

/**
 * Get a single recurring transaction by ID
 */
export async function getRecurringTransaction(
  db: Firestore,
  id: string
): Promise<RecurringTransaction | null> {
  const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return docToTyped<RecurringTransaction>(snapshot.id, snapshot.data());
}

/**
 * Create a new recurring transaction
 */
export async function createRecurringTransaction(
  db: Firestore,
  input: RecurringTransactionInput,
  userId: string,
  userName?: string
): Promise<string> {
  const now = Timestamp.now();
  const startDate = Timestamp.fromDate(input.startDate);

  // Calculate first occurrence
  const firstOccurrence = input.startDate;

  // Build data object with only defined values (Firestore doesn't accept undefined)
  const data: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    type: input.type,
    status: 'ACTIVE',

    frequency: input.frequency,
    startDate,
    nextOccurrence: Timestamp.fromDate(firstOccurrence),

    amount: {
      amount: input.amount,
      currency: input.currency,
    },
    currency: input.currency,

    // Settings
    autoGenerate: input.autoGenerate,
    daysBeforeToGenerate: input.daysBeforeToGenerate,
    requiresApproval: input.requiresApproval,

    // Tracking
    totalOccurrences: 0,

    // Audit
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
  };

  // Add optional fields only if they have values
  if (input.endDate) data.endDate = Timestamp.fromDate(input.endDate);
  if (input.dayOfMonth !== undefined) data.dayOfMonth = input.dayOfMonth;
  if (input.dayOfWeek !== undefined) data.dayOfWeek = input.dayOfWeek;
  if (input.employeeIds) data.employeeIds = input.employeeIds;
  if (input.vendorId) data.vendorId = input.vendorId;
  if (input.customerId) data.customerId = input.customerId;
  if (input.expenseAccountId) data.expenseAccountId = input.expenseAccountId;
  if (input.revenueAccountId) data.revenueAccountId = input.revenueAccountId;
  if (input.paymentTermDays !== undefined) data.paymentTermDays = input.paymentTermDays;
  if (input.lineItems) {
    data.lineItems = input.lineItems.map((item, index) => ({
      ...item,
      id: `line-${index + 1}`,
    }));
  }
  if (input.journalTemplate) data.journalTemplate = input.journalTemplate;

  const docRef = await addDoc(collection(db, COLLECTIONS.RECURRING_TRANSACTIONS), data);

  logger.info('Created recurring transaction', {
    id: docRef.id,
    name: input.name,
    type: input.type,
    frequency: input.frequency,
    userId,
  });

  return docRef.id;
}

/**
 * Update an existing recurring transaction
 */
export async function updateRecurringTransaction(
  db: Firestore,
  id: string,
  updates: Partial<RecurringTransactionInput>,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, id);

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.startDate !== undefined) updateData.startDate = Timestamp.fromDate(updates.startDate);
  if (updates.endDate !== undefined)
    updateData.endDate = updates.endDate ? Timestamp.fromDate(updates.endDate) : null;
  if (updates.dayOfMonth !== undefined) updateData.dayOfMonth = updates.dayOfMonth;
  if (updates.dayOfWeek !== undefined) updateData.dayOfWeek = updates.dayOfWeek;
  if (updates.amount !== undefined) {
    updateData.amount = {
      amount: updates.amount,
      currency: updates.currency || 'INR',
    };
  }
  if (updates.autoGenerate !== undefined) updateData.autoGenerate = updates.autoGenerate;
  if (updates.daysBeforeToGenerate !== undefined)
    updateData.daysBeforeToGenerate = updates.daysBeforeToGenerate;
  if (updates.requiresApproval !== undefined)
    updateData.requiresApproval = updates.requiresApproval;

  await updateDoc(docRef, updateData);

  logger.info('Updated recurring transaction', { id, userId });
}

/**
 * Update recurring transaction status
 */
export async function updateRecurringTransactionStatus(
  db: Firestore,
  id: string,
  status: RecurringTransactionStatus,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, id);

  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now(),
  });

  logger.info('Updated recurring transaction status', { id, status, userId });
}

/**
 * Delete a recurring transaction
 */
export async function deleteRecurringTransaction(
  db: Firestore,
  id: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, id);
  await deleteDoc(docRef);

  logger.info('Deleted recurring transaction', { id, userId });
}

/**
 * Get upcoming occurrences for a date range
 */
export async function getUpcomingOccurrences(
  db: Firestore,
  startDate: Date,
  endDate: Date,
  type?: RecurringTransactionType
): Promise<RecurringOccurrence[]> {
  const constraints: QueryConstraint[] = [
    where('scheduledDate', '>=', Timestamp.fromDate(startDate)),
    where('scheduledDate', '<=', Timestamp.fromDate(endDate)),
    orderBy('scheduledDate', 'asc'),
  ];

  if (type) {
    constraints.push(where('type', '==', type));
  }

  const q = query(collection(db, COLLECTIONS.RECURRING_OCCURRENCES), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecurringOccurrence[];
}

/**
 * Get occurrences for a specific recurring transaction
 */
export async function getOccurrencesForTransaction(
  db: Firestore,
  recurringTransactionId: string,
  limitCount = 50
): Promise<RecurringOccurrence[]> {
  const q = query(
    collection(db, COLLECTIONS.RECURRING_OCCURRENCES),
    where('recurringTransactionId', '==', recurringTransactionId),
    orderBy('scheduledDate', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecurringOccurrence[];
}

/**
 * Generate pending occurrences for all active recurring transactions
 * This should be called by a scheduled job
 */
export async function generatePendingOccurrences(
  db: Firestore,
  asOfDate: Date = new Date()
): Promise<{ created: number; errors: string[] }> {
  const activeTransactions = await getRecurringTransactions(db, { status: 'ACTIVE' });
  let created = 0;
  const errors: string[] = [];

  for (const transaction of activeTransactions) {
    try {
      // Check if we need to generate an occurrence
      const nextOccurrence = transaction.nextOccurrence.toDate();
      const generateDate = new Date(nextOccurrence);
      generateDate.setDate(generateDate.getDate() - transaction.daysBeforeToGenerate);

      if (asOfDate >= generateDate) {
        // Check if end date has passed
        if (transaction.endDate && asOfDate > transaction.endDate.toDate()) {
          // Mark as completed
          await updateRecurringTransactionStatus(db, transaction.id, 'COMPLETED', 'system');
          continue;
        }

        // Create occurrence
        await createOccurrence(db, transaction);
        created++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${transaction.name}: ${message}`);
      logger.error('Failed to generate occurrence', { transactionId: transaction.id, error });
    }
  }

  logger.info('Generated pending occurrences', { created, errors: errors.length });

  return { created, errors };
}

/**
 * Create an occurrence for a recurring transaction
 */
async function createOccurrence(db: Firestore, transaction: RecurringTransaction): Promise<string> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  // Create occurrence
  const occurrenceData: Omit<RecurringOccurrence, 'id'> = {
    recurringTransactionId: transaction.id,
    recurringTransactionName: transaction.name,
    type: transaction.type,
    scheduledDate: transaction.nextOccurrence,
    occurrenceNumber: transaction.totalOccurrences + 1,
    originalAmount: transaction.amount,
    finalAmount: transaction.amount,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  const occurrenceRef = doc(collection(db, COLLECTIONS.RECURRING_OCCURRENCES));
  batch.set(occurrenceRef, occurrenceData);

  // Update transaction with next occurrence
  const nextDate = calculateNextOccurrence(
    transaction.frequency,
    transaction.startDate.toDate(),
    transaction.nextOccurrence.toDate(),
    transaction.dayOfMonth,
    transaction.dayOfWeek
  );

  const transactionRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, transaction.id);
  batch.update(transactionRef, {
    nextOccurrence: Timestamp.fromDate(nextDate),
    totalOccurrences: transaction.totalOccurrences + 1,
    lastGeneratedAt: now,
    lastGeneratedOccurrenceId: occurrenceRef.id,
    updatedAt: now,
  });

  await batch.commit();

  logger.info('Created occurrence', {
    occurrenceId: occurrenceRef.id,
    transactionId: transaction.id,
    scheduledDate: transaction.nextOccurrence.toDate(),
  });

  return occurrenceRef.id;
}

/**
 * Skip an occurrence
 */
export async function skipOccurrence(
  db: Firestore,
  occurrenceId: string,
  reason: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_OCCURRENCES, occurrenceId);
  const now = Timestamp.now();

  await updateDoc(docRef, {
    status: 'SKIPPED' as OccurrenceStatus,
    skipReason: reason,
    skippedBy: userId,
    skippedAt: now,
    updatedAt: now,
  });

  logger.info('Skipped occurrence', { occurrenceId, reason, userId });
}

/**
 * Modify an occurrence amount
 */
export async function modifyOccurrence(
  db: Firestore,
  occurrenceId: string,
  newAmount: number,
  currency: CurrencyCode,
  reason: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_OCCURRENCES, occurrenceId);
  const now = Timestamp.now();

  await updateDoc(docRef, {
    status: 'MODIFIED' as OccurrenceStatus,
    finalAmount: { amount: newAmount, currency },
    modifications: {
      amountChanged: true,
      reason,
      modifiedBy: userId,
      modifiedAt: now,
    },
    updatedAt: now,
  });

  logger.info('Modified occurrence', { occurrenceId, newAmount, reason, userId });
}

/**
 * Mark occurrence as generated (after actual transaction is created)
 */
export async function markOccurrenceGenerated(
  db: Firestore,
  occurrenceId: string,
  generatedTransactionId: string,
  generatedTransactionType: 'INVOICE' | 'BILL' | 'JOURNAL_ENTRY' | 'SALARY_PAYMENT',
  generatedTransactionNumber: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.RECURRING_OCCURRENCES, occurrenceId);
  const now = Timestamp.now();

  await updateDoc(docRef, {
    status: 'GENERATED' as OccurrenceStatus,
    generatedTransactionId,
    generatedTransactionType,
    generatedTransactionNumber,
    processedAt: now,
    processedBy: userId,
    updatedAt: now,
  });

  logger.info('Marked occurrence as generated', {
    occurrenceId,
    generatedTransactionId,
    generatedTransactionType,
    userId,
  });
}

/**
 * Get summary of recurring transactions for dashboard
 */
export async function getRecurringTransactionSummary(
  db: Firestore
): Promise<RecurringTransactionSummary> {
  const transactions = await getRecurringTransactions(db);

  const summary: RecurringTransactionSummary = {
    totalActive: 0,
    totalPaused: 0,
    byType: {
      salary: 0,
      vendorBill: 0,
      customerInvoice: 0,
      journalEntry: 0,
    },
    upcomingThisWeek: 0,
    upcomingThisMonth: 0,
    monthlyOutflow: { amount: 0, currency: 'INR' },
    monthlyInflow: { amount: 0, currency: 'INR' },
  };

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  for (const tx of transactions) {
    // Count by status
    if (tx.status === 'ACTIVE') summary.totalActive++;
    if (tx.status === 'PAUSED') summary.totalPaused++;

    // Count by type
    switch (tx.type) {
      case 'SALARY':
        summary.byType.salary++;
        break;
      case 'VENDOR_BILL':
        summary.byType.vendorBill++;
        break;
      case 'CUSTOMER_INVOICE':
        summary.byType.customerInvoice++;
        break;
      case 'JOURNAL_ENTRY':
        summary.byType.journalEntry++;
        break;
    }

    if (tx.status !== 'ACTIVE') continue;

    // Check upcoming dates
    const nextDate = tx.nextOccurrence.toDate();
    if (nextDate <= endOfWeek) summary.upcomingThisWeek++;
    if (nextDate <= endOfMonth) summary.upcomingThisMonth++;

    // Calculate monthly flows (simplified - assumes monthly frequency)
    const monthlyAmount = calculateMonthlyEquivalent(tx.amount.amount, tx.frequency);

    if (tx.type === 'CUSTOMER_INVOICE') {
      summary.monthlyInflow.amount += monthlyAmount;
    } else if (tx.type === 'VENDOR_BILL' || tx.type === 'SALARY') {
      summary.monthlyOutflow.amount += monthlyAmount;
    }
  }

  return summary;
}

/**
 * Convert any frequency to monthly equivalent for comparison
 */
function calculateMonthlyEquivalent(amount: number, frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'DAILY':
      return amount * 30;
    case 'WEEKLY':
      return amount * 4.33;
    case 'BIWEEKLY':
      return amount * 2.17;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'YEARLY':
      return amount / 12;
    default:
      return amount;
  }
}
