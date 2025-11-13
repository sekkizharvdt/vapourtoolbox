/**
 * Auto-Matching Engine Batch Operations
 *
 * Batch matching and statistics
 */

import type { BankTransaction } from '@vapour/types';
import type { MatchingConfig, EnhancedMatchSuggestion, MultiTransactionMatch } from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';
import { findBestMatches, findMultiTransactionMatches } from './matching';

/**
 * Batch match all unmatched transactions
 * Returns matches grouped by confidence level
 */
export function batchAutoMatch(
  bankTransactions: BankTransaction[],
  accountingTransactions: unknown[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): {
  highConfidence: EnhancedMatchSuggestion[];
  mediumConfidence: EnhancedMatchSuggestion[];
  lowConfidence: EnhancedMatchSuggestion[];
  multiMatches: MultiTransactionMatch[];
} {
  const highConfidence: EnhancedMatchSuggestion[] = [];
  const mediumConfidence: EnhancedMatchSuggestion[] = [];
  const lowConfidence: EnhancedMatchSuggestion[] = [];
  const multiMatches: MultiTransactionMatch[] = [];

  const usedAccountingIds = new Set<string>();

  for (const bankTxn of bankTransactions) {
    if (bankTxn.isReconciled) continue;

    // Try single-transaction matching first
    const availableAccTxns = accountingTransactions.filter((t) => {
      const typedT = t as { id?: string };
      return !usedAccountingIds.has(typedT.id || '');
    });

    const suggestions = findBestMatches(bankTxn, availableAccTxns, config);

    if (suggestions.length > 0) {
      const bestMatch = suggestions[0]!;

      if (bestMatch.confidence === 'HIGH') {
        highConfidence.push(bestMatch);
        usedAccountingIds.add(bestMatch.accountingTransactionId);
      } else if (bestMatch.confidence === 'MEDIUM') {
        mediumConfidence.push(bestMatch);
        // Don't mark as used for medium confidence
      } else {
        lowConfidence.push(bestMatch);
      }
    } else {
      // Try multi-transaction matching
      const multiSuggestions = findMultiTransactionMatches(bankTxn, availableAccTxns, config);

      if (multiSuggestions.length > 0) {
        multiMatches.push(multiSuggestions[0]!);
      }
    }
  }

  return {
    highConfidence,
    mediumConfidence,
    lowConfidence,
    multiMatches,
  };
}

/**
 * Get match statistics for a batch
 */
export function getMatchStatistics(
  bankTransactions: BankTransaction[],
  accountingTransactions: unknown[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): {
  totalBankTransactions: number;
  totalAccountingTransactions: number;
  matchableTransactions: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  multiTransactionMatches: number;
  unmatchable: number;
  estimatedMatchRate: number;
} {
  const result = batchAutoMatch(bankTransactions, accountingTransactions, config);

  const matchableTransactions =
    result.highConfidence.length +
    result.mediumConfidence.length +
    result.lowConfidence.length +
    result.multiMatches.length;

  const estimatedMatchRate =
    bankTransactions.length > 0 ? (matchableTransactions / bankTransactions.length) * 100 : 0;

  return {
    totalBankTransactions: bankTransactions.length,
    totalAccountingTransactions: accountingTransactions.length,
    matchableTransactions,
    highConfidenceMatches: result.highConfidence.length,
    mediumConfidenceMatches: result.mediumConfidence.length,
    lowConfidenceMatches: result.lowConfidence.length,
    multiTransactionMatches: result.multiMatches.length,
    unmatchable: bankTransactions.length - matchableTransactions,
    estimatedMatchRate,
  };
}
