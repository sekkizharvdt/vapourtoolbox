/**
 * Transaction Service
 *
 * Centralized service for saving accounting transactions with double-entry enforcement.
 * This module ensures that ALL transactions saved to the database have balanced ledger entries.
 *
 * Key Principles:
 * 1. Every transaction MUST have balanced entries (total debits = total credits)
 * 2. Validation happens at the database layer, not just at generation time
 * 3. All saves are atomic using Firestore transactions/batches
 * 4. Unbalanced transactions are REJECTED - they cannot be saved
 *
 * Usage:
 * ```typescript
 * import { saveTransaction, saveTransactionAtomic } from '@/lib/accounting/transactionService';
 *
 * // Save with validation
 * const txId = await saveTransaction(db, transactionData);
 *
 * // Save atomically with other operations
 * await runTransaction(db, async (tx) => {
 *   saveTransactionAtomic(tx, transactionData);
 *   // Other operations in same transaction
 * });
 * ```
 */

import {
  doc,
  addDoc,
  collection,
  runTransaction,
  Timestamp,
  type Firestore,
  type Transaction,
  type WriteBatch,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { LedgerEntry } from '@vapour/types';
import { validateLedgerEntries } from './ledgerValidator';
import { requirePermission, type AuthorizationContext } from '@/lib/auth/authorizationService';
import { isPeriodOpen } from './fiscalYearService';

// Re-export AuthorizationContext for consumers
export type { AuthorizationContext } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'transactionService' });

/**
 * Validate user has permission to create accounting transactions
 *
 * @param auth - Authorization context with user permissions
 * @param operation - Operation description for error messages
 * @throws AuthorizationError if user lacks CREATE_TRANSACTIONS permission
 */
function requireTransactionPermission(auth: AuthorizationContext, operation: string): void {
  requirePermission(
    auth.userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    auth.userId,
    operation
  );
}

/**
 * Error thrown when transaction entries don't balance
 */
export class UnbalancedEntriesError extends Error {
  constructor(
    message: string,
    public readonly totalDebit: number,
    public readonly totalCredit: number,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'UnbalancedEntriesError';
  }
}

/**
 * Error thrown when transaction date falls in a closed/locked period
 */
export class ClosedPeriodError extends Error {
  constructor(
    message: string,
    public readonly transactionDate: Date
  ) {
    super(message);
    this.name = 'ClosedPeriodError';
  }
}

/**
 * Transaction data with entries
 */
export interface TransactionWithEntries extends DocumentData {
  entries?: LedgerEntry[];
  type: string;
  date?: Date | Timestamp;
  [key: string]: unknown;
}

/**
 * Options for saving transactions
 */
export interface SaveTransactionOptions {
  /**
   * Skip period validation (use only for system operations like opening balances)
   * Default: false
   */
  skipPeriodValidation?: boolean;
}

/**
 * Validate transaction date falls within an open accounting period
 *
 * @param db - Firestore instance
 * @param transactionDate - Date of the transaction
 * @throws ClosedPeriodError if period is closed or locked
 */
async function validatePeriodIsOpen(
  db: Firestore,
  transactionDate: Date | Timestamp | undefined
): Promise<void> {
  if (!transactionDate) {
    // If no date provided, skip validation (will use current date which should be in open period)
    return;
  }

  const date = transactionDate instanceof Timestamp ? transactionDate.toDate() : transactionDate;

  try {
    const isOpen = await isPeriodOpen(db, date);

    if (!isOpen) {
      logger.warn('Transaction rejected: period is closed', { transactionDate: date });
      throw new ClosedPeriodError(
        `Cannot save transaction: The accounting period for ${date.toLocaleDateString()} is closed or locked. Please contact your accountant to reopen the period.`,
        date
      );
    }
  } catch (error) {
    // If it's already a ClosedPeriodError, rethrow it
    if (error instanceof ClosedPeriodError) {
      throw error;
    }
    // For other errors (like no fiscal year found), log and allow transaction
    // This handles cases where fiscal years haven't been set up yet
    logger.warn('Period validation skipped - could not determine period status', { error });
  }
}

/**
 * Validate ledger entries are balanced before save
 *
 * @param entries - Ledger entries to validate
 * @throws UnbalancedEntriesError if entries don't balance
 */
export function enforceDoubleEntry(entries: LedgerEntry[] | undefined): void {
  // Empty entries are allowed for some transactions (e.g., payments without bank account)
  if (!entries || entries.length === 0) {
    return;
  }

  const validation = validateLedgerEntries(entries);

  if (!validation.isValid) {
    // Calculate totals for error message
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    logger.error('Transaction rejected: unbalanced entries', {
      totalDebit,
      totalCredit,
      difference: Math.abs(totalDebit - totalCredit),
      errors: validation.errors,
    });

    throw new UnbalancedEntriesError(
      `Cannot save transaction: ${validation.errors.join('; ')}`,
      totalDebit,
      totalCredit,
      validation.errors
    );
  }
}

/**
 * Save a transaction with double-entry validation and period validation
 *
 * This is the ONLY sanctioned way to create accounting transactions.
 * It enforces that all entries are balanced and the transaction date
 * falls within an open accounting period before saving.
 *
 * @param db - Firestore instance
 * @param transactionData - Transaction data with entries
 * @param auth - Authorization context (optional for backward compatibility, will be required in future)
 * @param options - Optional save options (e.g., skip period validation)
 * @returns Created transaction ID
 * @throws UnbalancedEntriesError if entries don't balance
 * @throws ClosedPeriodError if transaction date is in a closed period
 * @throws AuthorizationError if user lacks CREATE_TRANSACTIONS permission
 */
export async function saveTransaction(
  db: Firestore,
  transactionData: TransactionWithEntries,
  auth?: AuthorizationContext,
  options?: SaveTransactionOptions
): Promise<string> {
  // Check permission if auth context provided
  if (auth) {
    requireTransactionPermission(auth, 'create accounting transaction');
  }

  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Validate transaction date is in an open period (unless skipped)
  if (!options?.skipPeriodValidation) {
    await validatePeriodIsOpen(db, transactionData.date);
  }

  // Add validation timestamp and creator info
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    periodValidatedAt: options?.skipPeriodValidation ? undefined : Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...(auth && { createdBy: auth.userId }),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), dataWithValidation);

  logger.info('Transaction saved with double-entry and period validation', {
    transactionId: docRef.id,
    type: transactionData.type,
    entriesCount: transactionData.entries?.length || 0,
    userId: auth?.userId,
    periodValidationSkipped: options?.skipPeriodValidation,
  });

  return docRef.id;
}

/**
 * Save a transaction atomically within a Firestore transaction
 *
 * Use this when you need to save a transaction as part of a larger atomic operation.
 *
 * @param transaction - Firestore transaction
 * @param db - Firestore instance
 * @param transactionData - Transaction data with entries
 * @param auth - Authorization context (optional for backward compatibility, will be required in future)
 * @returns Document reference (ID available after commit)
 * @throws UnbalancedEntriesError if entries don't balance
 * @throws AuthorizationError if user lacks CREATE_TRANSACTIONS permission
 */
export function saveTransactionAtomic(
  transaction: Transaction,
  db: Firestore,
  transactionData: TransactionWithEntries,
  auth?: AuthorizationContext
): DocumentReference {
  // Check permission if auth context provided
  if (auth) {
    requireTransactionPermission(auth, 'create accounting transaction');
  }

  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Add validation timestamp and creator info
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...(auth && { createdBy: auth.userId }),
  };

  const docRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
  transaction.set(docRef, dataWithValidation);

  return docRef;
}

/**
 * Save a transaction atomically within a WriteBatch
 *
 * Use this when you need to save a transaction as part of a batch write.
 *
 * @param batch - Firestore write batch
 * @param db - Firestore instance
 * @param transactionData - Transaction data with entries
 * @param auth - Authorization context (optional for backward compatibility, will be required in future)
 * @returns Document reference (ID available after commit)
 * @throws UnbalancedEntriesError if entries don't balance
 * @throws AuthorizationError if user lacks CREATE_TRANSACTIONS permission
 */
export function saveTransactionBatch(
  batch: WriteBatch,
  db: Firestore,
  transactionData: TransactionWithEntries,
  auth?: AuthorizationContext
): DocumentReference {
  // Check permission if auth context provided
  if (auth) {
    requireTransactionPermission(auth, 'create accounting transaction');
  }

  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Add validation timestamp and creator info
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...(auth && { createdBy: auth.userId }),
  };

  const docRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
  batch.set(docRef, dataWithValidation);

  return docRef;
}

/**
 * Wrap transaction creation with validation and atomic save
 *
 * This function creates a transaction and performs related updates atomically.
 * If any validation or update fails, all changes are rolled back.
 *
 * @param db - Firestore instance
 * @param transactionData - Transaction data with entries
 * @param additionalUpdates - Optional callback to perform additional updates in same transaction
 * @param auth - Authorization context (optional for backward compatibility, will be required in future)
 * @param options - Optional save options (e.g., skip period validation)
 * @returns Created transaction ID
 * @throws UnbalancedEntriesError if entries don't balance
 * @throws ClosedPeriodError if transaction date is in a closed period
 * @throws AuthorizationError if user lacks CREATE_TRANSACTIONS permission
 */
export async function createTransactionWithUpdates(
  db: Firestore,
  transactionData: TransactionWithEntries,
  additionalUpdates?: (transaction: Transaction, txRef: DocumentReference) => void | Promise<void>,
  auth?: AuthorizationContext,
  options?: SaveTransactionOptions
): Promise<string> {
  // Check permission if auth context provided
  if (auth) {
    requireTransactionPermission(auth, 'create accounting transaction');
  }

  // Pre-validate outside transaction (faster failure)
  enforceDoubleEntry(transactionData.entries);

  // Validate transaction date is in an open period (unless skipped)
  if (!options?.skipPeriodValidation) {
    await validatePeriodIsOpen(db, transactionData.date);
  }

  const transactionId = await runTransaction(db, async (firestoreTransaction) => {
    // Create transaction document (skip auth check here since we already checked above)
    const txRef = saveTransactionAtomic(firestoreTransaction, db, transactionData);

    // Perform additional updates if provided
    if (additionalUpdates) {
      await additionalUpdates(firestoreTransaction, txRef);
    }

    return txRef.id;
  });

  logger.info('Transaction created with atomic updates', {
    transactionId,
    type: transactionData.type,
    userId: auth?.userId,
    periodValidationSkipped: options?.skipPeriodValidation,
  });

  return transactionId;
}

/**
 * Re-validate existing transaction entries
 *
 * Use this to check if an existing transaction's entries are still balanced.
 * Useful for audit and data integrity checks.
 *
 * @param entries - Ledger entries to validate
 * @returns Validation result
 */
export function validateTransactionEntries(entries: LedgerEntry[]): {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  errors: string[];
  warnings: string[];
} {
  const validation = validateLedgerEntries(entries);
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  return {
    isValid: validation.isValid,
    totalDebit,
    totalCredit,
    difference: Math.abs(totalDebit - totalCredit),
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
