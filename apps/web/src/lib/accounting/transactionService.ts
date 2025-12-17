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
import type { LedgerEntry } from '@vapour/types';
import { validateLedgerEntries } from './ledgerValidator';

const logger = createLogger({ context: 'transactionService' });

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
 * Transaction data with entries
 */
export interface TransactionWithEntries extends DocumentData {
  entries?: LedgerEntry[];
  type: string;
  [key: string]: unknown;
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
 * Save a transaction with double-entry validation
 *
 * This is the ONLY sanctioned way to create accounting transactions.
 * It enforces that all entries are balanced before saving.
 *
 * @param db - Firestore instance
 * @param transactionData - Transaction data with entries
 * @returns Created transaction ID
 * @throws UnbalancedEntriesError if entries don't balance
 */
export async function saveTransaction(
  db: Firestore,
  transactionData: TransactionWithEntries
): Promise<string> {
  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Add validation timestamp
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), dataWithValidation);

  logger.info('Transaction saved with double-entry validation', {
    transactionId: docRef.id,
    type: transactionData.type,
    entriesCount: transactionData.entries?.length || 0,
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
 * @returns Document reference (ID available after commit)
 * @throws UnbalancedEntriesError if entries don't balance
 */
export function saveTransactionAtomic(
  transaction: Transaction,
  db: Firestore,
  transactionData: TransactionWithEntries
): DocumentReference {
  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Add validation timestamp
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
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
 * @returns Document reference (ID available after commit)
 * @throws UnbalancedEntriesError if entries don't balance
 */
export function saveTransactionBatch(
  batch: WriteBatch,
  db: Firestore,
  transactionData: TransactionWithEntries
): DocumentReference {
  // Enforce double-entry before save
  enforceDoubleEntry(transactionData.entries);

  // Add validation timestamp
  const dataWithValidation = {
    ...transactionData,
    doubleEntryValidatedAt: Timestamp.now(),
    createdAt: transactionData.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
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
 * @returns Created transaction ID
 * @throws UnbalancedEntriesError if entries don't balance
 */
export async function createTransactionWithUpdates(
  db: Firestore,
  transactionData: TransactionWithEntries,
  additionalUpdates?: (transaction: Transaction, txRef: DocumentReference) => void | Promise<void>
): Promise<string> {
  // Pre-validate outside transaction (faster failure)
  enforceDoubleEntry(transactionData.entries);

  const transactionId = await runTransaction(db, async (firestoreTransaction) => {
    // Create transaction document
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
