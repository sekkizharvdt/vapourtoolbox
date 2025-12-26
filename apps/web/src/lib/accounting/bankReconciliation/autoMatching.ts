/**
 * Bank Reconciliation Auto-Matching
 *
 * Enhanced auto-matching using the advanced matching engine
 * Provides configurable matching with high/medium/low confidence levels
 */

import { doc, getDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { BankStatement, BankStatementStatus } from '@vapour/types';
import {
  batchAutoMatch,
  getMatchStatistics,
  type MatchingConfig,
  type EnhancedMatchSuggestion,
  type MultiTransactionMatch,
  DEFAULT_MATCHING_CONFIG,
} from '../autoMatching';
import { getUnmatchedAccountingTransactions, getUnmatchedBankTransactions } from './crud';
import { matchTransactions } from './matching';

const logger = createLogger({ context: 'bankReconciliation/autoMatching' });

/**
 * Get enhanced suggested matches using advanced matching algorithm
 * @param db - Firestore instance
 * @param statementId - Bank statement ID
 * @param config - Optional matching configuration (uses defaults if not provided)
 * @returns Enhanced match suggestions with detailed scoring
 */
export async function getEnhancedSuggestedMatches(
  db: Firestore,
  statementId: string,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<EnhancedMatchSuggestion[]> {
  try {
    // Get unmatched bank transactions
    const bankTransactions = await getUnmatchedBankTransactions(db, statementId);

    // Get statement to fetch account and date range
    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));
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

    // Use enhanced matching algorithm
    const result = batchAutoMatch(bankTransactions, accountingTransactions, config);

    // Combine all suggestions
    const allSuggestions = [
      ...result.highConfidence,
      ...result.mediumConfidence,
      ...result.lowConfidence,
    ];

    return allSuggestions;
  } catch (error) {
    logger.error('getEnhancedSuggestedMatches failed', { statementId, error });
    throw error;
  }
}

/**
 * Get enhanced match statistics for a statement
 * Provides detailed breakdown of matchable transactions
 */
export async function getEnhancedMatchStatistics(
  db: Firestore,
  statementId: string,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<{
  totalBankTransactions: number;
  totalAccountingTransactions: number;
  matchableTransactions: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  multiTransactionMatches: number;
  unmatchable: number;
  estimatedMatchRate: number;
}> {
  try {
    const bankTransactions = await getUnmatchedBankTransactions(db, statementId);

    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));
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

    return getMatchStatistics(bankTransactions, accountingTransactions, config);
  } catch (error) {
    logger.error('getEnhancedMatchStatistics failed', { statementId, error });
    throw error;
  }
}

/**
 * Auto-match transactions with configurable confidence threshold
 * @param db - Firestore instance
 * @param statementId - Bank statement ID
 * @param userId - User ID performing the match
 * @param options - Matching options
 * @returns Number of transactions matched
 */
export async function autoMatchTransactions(
  db: Firestore,
  statementId: string,
  userId: string,
  options: {
    matchHighConfidence?: boolean; // Default: true
    matchMediumConfidence?: boolean; // Default: false
    config?: MatchingConfig;
  } = {}
): Promise<{
  matched: number;
  skipped: number;
  errors: string[];
}> {
  const {
    matchHighConfidence = true,
    matchMediumConfidence = false,
    config = DEFAULT_MATCHING_CONFIG,
  } = options;

  try {
    const bankTransactions = await getUnmatchedBankTransactions(db, statementId);

    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));
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

    const result = batchAutoMatch(bankTransactions, accountingTransactions, config);

    const toMatch: EnhancedMatchSuggestion[] = [];

    if (matchHighConfidence) {
      toMatch.push(...result.highConfidence);
    }

    if (matchMediumConfidence) {
      toMatch.push(...result.mediumConfidence);
    }

    let matched = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Match transactions
    for (const suggestion of toMatch) {
      try {
        await matchTransactions(
          db,
          {
            bankTransactionId: suggestion.bankTransactionId,
            accountingTransactionId: suggestion.accountingTransactionId,
            notes: `Auto-matched (${suggestion.confidence}): ${suggestion.explanation}`,
          },
          'SUGGESTED',
          userId
        );
        matched++;
      } catch (error) {
        errors.push(
          `Failed to match ${suggestion.bankTransactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        skipped++;
      }
    }

    // Update statement status if there were matches
    if (matched > 0) {
      await updateDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId), {
        status: 'IN_PROGRESS' as BankStatementStatus,
        updatedAt: Timestamp.now(),
      });
    }

    return { matched, skipped, errors };
  } catch (error) {
    logger.error('autoMatchTransactions failed', { statementId, error });
    throw error;
  }
}

/**
 * Get multi-transaction match suggestions
 * Finds cases where one bank transaction matches multiple accounting transactions
 */
export async function getMultiTransactionMatches(
  db: Firestore,
  statementId: string,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): Promise<MultiTransactionMatch[]> {
  try {
    const bankTransactions = await getUnmatchedBankTransactions(db, statementId);

    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));
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

    const result = batchAutoMatch(bankTransactions, accountingTransactions, config);
    return result.multiMatches;
  } catch (error) {
    logger.error('getMultiTransactionMatches failed', { statementId, error });
    throw error;
  }
}
