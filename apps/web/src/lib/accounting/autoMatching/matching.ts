/**
 * Auto-Matching Engine Matching Operations
 *
 * Single and multi-transaction matching logic
 */

import { Timestamp } from 'firebase/firestore';
import type { BankTransaction } from '@vapour/types';
import type { MatchingConfig, EnhancedMatchSuggestion, MultiTransactionMatch } from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';
import { calculateEnhancedMatchScore } from './scoring';
import { isAmountMatch, isDateMatch, generateCombinations } from './utils';

/**
 * Find best matches for a bank transaction
 */
export function findBestMatches(
  bankTxn: BankTransaction,
  accountingTransactions: unknown[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): EnhancedMatchSuggestion[] {
  const suggestions: EnhancedMatchSuggestion[] = [];

  for (const accTxn of accountingTransactions) {
    const typedAccTxn = accTxn as {
      id?: string;
      amount?: number;
      totalAmount?: number;
      date?: Timestamp;
      description?: string;
      reference?: string;
      chequeNumber?: string;
    };

    const matchResult = calculateEnhancedMatchScore(bankTxn, typedAccTxn, config);

    if (matchResult.score >= config.minimumMatchScore) {
      const confidence =
        matchResult.score >= config.highConfidenceThreshold
          ? 'HIGH'
          : matchResult.score >= config.mediumConfidenceThreshold
            ? 'MEDIUM'
            : 'LOW';

      const suggestion: EnhancedMatchSuggestion = {
        bankTransactionId: bankTxn.id!,
        accountingTransactionId: typedAccTxn.id!,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        amountMatch: matchResult.details.amountScore >= config.amountWeight * 0.8,
        dateMatch: matchResult.details.dateScore >= config.dateWeight * 0.8,
        descriptionMatch: matchResult.details.descriptionScore >= config.descriptionWeight * 0.5,
        confidence,
        matchType: matchResult.details.amountScore === config.amountWeight ? 'EXACT' : 'FUZZY',
        amountVariance: matchResult.details.amountVariance,
        dateVarianceDays: matchResult.details.dateVarianceDays,
        descriptionSimilarity: matchResult.details.descriptionSimilarity,
        explanation: `Score: ${matchResult.score.toFixed(1)}/100 - ${matchResult.reasons.join(', ')}`,
      };

      suggestions.push(suggestion);
    }
  }

  // Sort by score descending
  return suggestions.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find multi-transaction matches (one bank transaction to multiple accounting transactions)
 * Useful for bulk payments, consolidated transfers, etc.
 */
export function findMultiTransactionMatches(
  bankTxn: BankTransaction,
  accountingTransactions: unknown[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MultiTransactionMatch[] {
  if (!config.enableMultiTransactionMatching) {
    return [];
  }

  const bankAmount = bankTxn.debitAmount || bankTxn.creditAmount;
  const matches: MultiTransactionMatch[] = [];

  // Try to find combinations of 2-5 transactions that sum to the bank amount
  const typedTxns = accountingTransactions.map(
    (t) =>
      t as {
        id?: string;
        amount?: number;
        totalAmount?: number;
        date?: Timestamp;
        description?: string;
      }
  );

  // Sort by date proximity to bank transaction
  const sortedTxns = typedTxns.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    const aDiff = Math.abs(bankTxn.transactionDate.toDate().getTime() - a.date.toDate().getTime());
    const bDiff = Math.abs(bankTxn.transactionDate.toDate().getTime() - b.date.toDate().getTime());
    return aDiff - bDiff;
  });

  // Try combinations of 2-5 transactions
  for (let size = 2; size <= Math.min(5, sortedTxns.length); size++) {
    // Only check first 10 transactions for performance
    const candidates = sortedTxns.slice(0, 10);

    // Generate combinations
    const combinations = generateCombinations(candidates, size);

    for (const combo of combinations) {
      const totalAmount = combo.reduce((sum, t) => sum + (t.amount || t.totalAmount || 0), 0);
      const amountMatch = isAmountMatch(bankAmount, totalAmount, config);

      if (amountMatch.close) {
        // Check if dates are within tolerance
        const allDatesMatch = combo.every((t) => {
          if (!t.date) return false;
          const dateMatch = isDateMatch(bankTxn.transactionDate, t.date, config);
          return dateMatch.close;
        });

        if (allDatesMatch) {
          const score = amountMatch.exact ? 90 : 75;
          const reasons = [
            `${combo.length} transactions totaling ${totalAmount.toFixed(2)}`,
            amountMatch.exact ? 'Exact total match' : 'Close total match',
            'All dates within tolerance',
          ];

          matches.push({
            bankTransactionId: bankTxn.id!,
            accountingTransactionIds: combo.map((t) => t.id!),
            matchScore: score,
            totalAmount,
            amountVariance: amountMatch.variance,
            matchReasons: reasons,
            confidence: score >= 80 ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }
  }

  // Return top 5 matches
  return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}
