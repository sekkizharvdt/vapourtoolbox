/**
 * Bank Reconciliation Matching Logic
 *
 * Core matching algorithms and manual matching operations.
 * Uses the advanced matching engine from autoMatching/ for scoring.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { calculateEnhancedMatchScore, DEFAULT_MATCHING_CONFIG } from '../autoMatching';

const logger = createLogger({ context: 'bankReconciliation/matching' });
import type {
  BankStatement,
  BankTransaction,
  ReconciliationMatch,
  MatchSuggestion,
  ManualMatchInput,
  MatchType,
} from '@vapour/types';
import { getUnmatchedAccountingTransactions, getUnmatchedBankTransactions } from './crud';

/**
 * Shape of accounting transaction fields used for matching
 */
interface AccountingTransactionMatchFields {
  amount?: number;
  totalAmount?: number;
  date?: Timestamp;
  description?: string;
  reference?: string;
  chequeNumber?: string;
}

/**
 * Check if a value is a Firestore Timestamp-like object
 * Uses duck-typing to work with both real Timestamps and mocks in tests
 */
function isTimestampLike(value: unknown): value is Timestamp {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  // Duck-type check: Timestamp has toDate method and seconds/nanoseconds properties
  return (
    typeof obj.toDate === 'function' &&
    typeof obj.seconds === 'number' &&
    typeof obj.nanoseconds === 'number'
  );
}

/**
 * Type guard to safely extract matching fields from accounting transaction
 */
function extractMatchFields(txn: unknown): AccountingTransactionMatchFields {
  if (txn === null || typeof txn !== 'object') {
    return {};
  }

  const obj = txn as Record<string, unknown>;

  return {
    amount: typeof obj.amount === 'number' ? obj.amount : undefined,
    totalAmount: typeof obj.totalAmount === 'number' ? obj.totalAmount : undefined,
    date: isTimestampLike(obj.date) ? (obj.date as Timestamp) : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    reference: typeof obj.reference === 'string' ? obj.reference : undefined,
    chequeNumber: typeof obj.chequeNumber === 'string' ? obj.chequeNumber : undefined,
  };
}

/**
 * Calculate match score between bank transaction and accounting transaction
 * Returns a score from 0-100 indicating match quality.
 *
 * This function delegates to calculateEnhancedMatchScore from the autoMatching
 * module, which provides configurable weights and detailed scoring. This wrapper
 * maintains backward compatibility with the simpler return type.
 *
 * For advanced usage with configurable weights and detailed score breakdown,
 * use calculateEnhancedMatchScore directly from '../autoMatching'.
 */
export function calculateMatchScore(
  bankTxn: BankTransaction,
  accountingTxn: unknown
): { score: number; reasons: string[] } {
  const accTxn = extractMatchFields(accountingTxn);

  // Use the enhanced scoring engine for consistent matching logic
  const result = calculateEnhancedMatchScore(bankTxn, accTxn, DEFAULT_MATCHING_CONFIG);

  return {
    score: result.score,
    reasons: result.reasons,
  };
}

/**
 * Get suggested matches for unmatched bank transactions
 */
export async function getSuggestedMatches(
  db: Firestore,
  statementId: string
): Promise<MatchSuggestion[]> {
  try {
    // Get unmatched bank transactions
    const bankTransactions = await getUnmatchedBankTransactions(db, statementId);

    // Get statement to fetch account and date range
    const statementDoc = await getDoc(doc(db, 'bankStatements', statementId));
    if (!statementDoc.exists()) {
      throw new Error('Bank statement not found');
    }

    const statement = statementDoc.data() as BankStatement;
    const accountingTransactions = await getUnmatchedAccountingTransactions(
      db,
      statement.accountId,
      statement.startDate,
      statement.endDate
    );

    const suggestions: MatchSuggestion[] = [];

    // For each bank transaction, find best matching accounting transaction
    for (const bankTxn of bankTransactions) {
      let bestMatch: MatchSuggestion | null = null;

      for (const accTxn of accountingTransactions) {
        const accTxnTyped = accTxn as { id?: string };
        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        // Only suggest matches with score >= 50
        if (score >= 50) {
          const suggestion: MatchSuggestion = {
            bankTransactionId: bankTxn.id!,
            accountingTransactionId: accTxnTyped.id!,
            matchScore: score,
            matchReasons: reasons,
            amountMatch: reasons.includes('Exact amount match'),
            dateMatch: reasons.includes('Same date'),
            descriptionMatch: reasons.includes('Description similarity'),
            confidence: score >= 80 ? 'HIGH' : score >= 65 ? 'MEDIUM' : 'LOW',
          };

          if (!bestMatch || score > bestMatch.matchScore) {
            bestMatch = suggestion;
          }
        }
      }

      if (bestMatch) {
        suggestions.push(bestMatch);
      }
    }

    return suggestions;
  } catch (error) {
    logger.error('Error getting suggested matches', { statementId, error });
    throw error;
  }
}

/**
 * Match a bank transaction with an accounting transaction
 */
export async function matchTransactions(
  db: Firestore,
  input: ManualMatchInput,
  matchType: MatchType,
  userId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Create reconciliation match record
    const matchRef = doc(collection(db, 'reconciliationMatches'));
    const matchData: Omit<ReconciliationMatch, 'id'> = {
      statementId: '', // Will be set from bank transaction
      accountId: '', // Will be set from bank transaction
      bankTransactionId: input.bankTransactionId,
      accountingTransactionId: input.accountingTransactionId,
      matchType,
      matchDate: now,
      matchedBy: userId,
      notes: input.notes,
      createdAt: now,
    };

    batch.set(matchRef, matchData);

    // Update bank transaction as reconciled
    const bankTxnRef = doc(db, 'bankTransactions', input.bankTransactionId);
    batch.update(bankTxnRef, {
      isReconciled: true,
      reconciledWith: input.accountingTransactionId,
      reconciledAt: now,
      reconciledBy: userId,
      matchType,
      updatedAt: now,
    });

    // Update accounting transaction as reconciled
    const accTxnRef = doc(db, COLLECTIONS.TRANSACTIONS, input.accountingTransactionId);
    batch.update(accTxnRef, {
      isReconciled: true,
      reconciledWith: input.bankTransactionId,
      reconciledAt: now,
      reconciledBy: userId,
      updatedAt: now,
    });

    await batch.commit();
  } catch (error) {
    logger.error('Error matching transactions', { input, matchType, error });
    throw new Error('Failed to match transactions');
  }
}

/**
 * Unmatch a reconciled transaction
 */
export async function unmatchTransaction(db: Firestore, bankTransactionId: string): Promise<void> {
  try {
    // Get bank transaction to find accounting transaction ID
    const bankTxnDoc = await getDoc(doc(db, 'bankTransactions', bankTransactionId));
    if (!bankTxnDoc.exists()) {
      throw new Error('Bank transaction not found');
    }

    const bankTxn = bankTxnDoc.data() as BankTransaction;
    const accountingTxnId = bankTxn.reconciledWith;

    if (!accountingTxnId) {
      throw new Error('Transaction is not matched');
    }

    const batch = writeBatch(db);

    // Update bank transaction
    batch.update(doc(db, 'bankTransactions', bankTransactionId), {
      isReconciled: false,
      reconciledWith: null,
      reconciledAt: null,
      reconciledBy: null,
      matchType: null,
      updatedAt: Timestamp.now(),
    });

    // Update accounting transaction
    batch.update(doc(db, COLLECTIONS.TRANSACTIONS, accountingTxnId), {
      isReconciled: false,
      reconciledWith: null,
      reconciledAt: null,
      reconciledBy: null,
      updatedAt: Timestamp.now(),
    });

    // Delete reconciliation match record
    const matchesRef = collection(db, 'reconciliationMatches');
    const q = query(matchesRef, where('bankTransactionId', '==', bankTransactionId));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    logger.error('Error unmatching transaction', { bankTransactionId, error });
    throw new Error('Failed to unmatch transaction');
  }
}

/**
 * Match a bank transaction to multiple accounting transactions (bulk payment scenario)
 */
export async function matchMultipleTransactions(
  db: Firestore,
  bankTransactionId: string,
  accountingTransactionIds: string[],
  userId: string,
  notes?: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Create reconciliation match records for each accounting transaction
    for (const accTxnId of accountingTransactionIds) {
      const matchRef = doc(collection(db, 'reconciliationMatches'));
      const matchData: Omit<ReconciliationMatch, 'id'> = {
        statementId: '', // Will be set from bank transaction
        accountId: '', // Will be set from bank transaction
        bankTransactionId,
        accountingTransactionId: accTxnId,
        matchType: 'MANUAL',
        matchDate: now,
        matchedBy: userId,
        notes: notes || 'Multi-transaction match',
        createdAt: now,
      };

      batch.set(matchRef, matchData);

      // Update accounting transaction as reconciled
      const accTxnRef = doc(db, COLLECTIONS.TRANSACTIONS, accTxnId);
      batch.update(accTxnRef, {
        isReconciled: true,
        reconciledWith: bankTransactionId,
        reconciledAt: now,
        reconciledBy: userId,
        updatedAt: now,
      });
    }

    // Update bank transaction as reconciled with multiple matches
    const bankTxnRef = doc(db, 'bankTransactions', bankTransactionId);
    batch.update(bankTxnRef, {
      isReconciled: true,
      reconciledWith: accountingTransactionIds.join(','), // Store multiple IDs
      reconciledAt: now,
      reconciledBy: userId,
      matchType: 'MANUAL',
      notes: `Matched to ${accountingTransactionIds.length} transactions`,
      updatedAt: now,
    });

    await batch.commit();
  } catch (error) {
    logger.error('Error matching multiple transactions', {
      bankTransactionId,
      accountingTransactionCount: accountingTransactionIds.length,
      error,
    });
    throw new Error('Failed to match multiple transactions');
  }
}
