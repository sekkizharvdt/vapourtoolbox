/**
 * Cloud Functions for Accounting Operations
 *
 * Provides server-side validation for accounting transactions
 * with double-entry validation and business rule enforcement.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { validateOrThrow } from './utils/validation';
import { PERMISSION_FLAGS } from './constants/permissions';
import { z } from 'zod';

const db = admin.firestore();

/**
 * Validation schema for ledger entries
 */
const ledgerEntrySchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  description: z.string().optional(),
  costCentreId: z.string().optional(),
});

/**
 * Validation schema for journal entry creation
 */
const createJournalEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  entries: z
    .array(ledgerEntrySchema)
    .min(2, 'At least 2 entries required for double-entry')
    .refine(
      (entries) => {
        // Validate each entry has either debit or credit, not both
        return entries.every((entry) => {
          const hasDebit = entry.debit !== undefined && entry.debit > 0;
          const hasCredit = entry.credit !== undefined && entry.credit > 0;
          return (hasDebit && !hasCredit) || (hasCredit && !hasDebit);
        });
      },
      {
        message: 'Each entry must have either debit or credit, not both',
      }
    )
    .refine(
      (entries) => {
        // Validate debits = credits (double-entry)
        const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

        // Allow 0.01 tolerance for floating point errors
        return Math.abs(totalDebits - totalCredits) < 0.01;
      },
      {
        message: 'Total debits must equal total credits',
      }
    ),
});

/**
 * Create Journal Entry (with double-entry validation)
 *
 * Validates that debits = credits and all business rules are met
 * before creating the journal entry in Firestore.
 *
 * Required permission: CREATE_JOURNAL_ENTRIES
 */
export const createJournalEntry = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  // 2. Permission check — requires MANAGE_ACCOUNTING
  const userPermissions = (request.auth.token.permissions as number) || 0;

  if (
    (userPermissions & PERMISSION_FLAGS.MANAGE_ACCOUNTING) !==
    PERMISSION_FLAGS.MANAGE_ACCOUNTING
  ) {
    throw new HttpsError('permission-denied', 'MANAGE_ACCOUNTING permission required');
  }

  // 3. Validate input data
  const validData = validateOrThrow(createJournalEntrySchema, request.data);

  // 4. Additional business rule validation
  const totalDebits = validData.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = validData.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);

  if (difference >= 0.01) {
    throw new HttpsError(
      'failed-precondition',
      `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)}). Difference: ${difference.toFixed(2)}`
    );
  }

  // 5. Verify all accounts exist
  try {
    const accountChecks = await Promise.all(
      validData.entries.map(async (entry) => {
        const accountDoc = await db.collection('accounts').doc(entry.accountId).get();
        return {
          accountId: entry.accountId,
          exists: accountDoc.exists,
        };
      })
    );

    const missingAccounts = accountChecks.filter((check) => !check.exists);
    if (missingAccounts.length > 0) {
      throw new HttpsError(
        'not-found',
        `Accounts not found: ${missingAccounts.map((a) => a.accountId).join(', ')}`
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error('Error validating accounts', { error });
    throw new HttpsError('internal', 'Failed to validate accounts');
  }

  // 6. Create transaction using Firestore batch (atomic operation)
  const batch = db.batch();

  try {
    // Create main transaction document
    const transactionRef = db.collection('transactions').doc();
    const transactionData = {
      type: 'JOURNAL_ENTRY',
      date: admin.firestore.Timestamp.fromDate(new Date(validData.date)),
      description: validData.description,
      reference: validData.reference,
      status: 'POSTED',
      totalAmount: totalDebits, // or totalCredits, they're equal
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      updatedBy: request.auth.uid,
    };
    batch.set(transactionRef, transactionData);

    // Create individual ledger entries
    validData.entries.forEach((entry) => {
      const entryRef = db.collection('glEntries').doc();
      const entryData = {
        transactionId: transactionRef.id,
        accountId: entry.accountId,
        date: admin.firestore.Timestamp.fromDate(new Date(validData.date)),
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        description: entry.description || validData.description,
        costCentreId: entry.costCentreId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth!.uid,
      };
      batch.set(entryRef, entryData);
    });

    // Commit the batch
    await batch.commit();

    logger.info('Journal entry created successfully', {
      transactionId: transactionRef.id,
      totalAmount: totalDebits,
      entriesCount: validData.entries.length,
      createdBy: request.auth.uid,
    });

    return {
      success: true,
      transactionId: transactionRef.id,
      message: 'Journal entry created successfully',
      summary: {
        totalDebits,
        totalCredits,
        entriesCount: validData.entries.length,
      },
    };
  } catch (error) {
    logger.error('Error creating journal entry', { error });
    throw new HttpsError('internal', 'Failed to create journal entry');
  }
});

/**
 * Validate Transaction Amount
 *
 * Server-side validation for transaction amounts to prevent
 * negative amounts, excessive amounts, or invalid values.
 *
 * Can be called before submitting transactions for validation feedback.
 */
export const validateTransactionAmount = onCall(async (request) => {
  const amountSchema = z.object({
    amount: z.number().positive('Amount must be positive').max(999999999, 'Amount too large'),
    currency: z.string().length(3, 'Currency must be 3-letter code'),
  });

  try {
    const validData = validateOrThrow(amountSchema, request.data);

    return {
      valid: true,
      amount: validData.amount,
      currency: validData.currency,
      formatted: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: validData.currency,
      }).format(validData.amount),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      return {
        valid: false,
        error: error.message,
      };
    }
    throw error;
  }
});
