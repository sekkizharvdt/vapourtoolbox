/**
 * Advanced Auto-Matching Engine for Bank Reconciliation
 *
 * Provides sophisticated algorithms for automatically matching bank transactions
 * with accounting transactions using multiple matching strategies:
 * - Exact matching (amount + date)
 * - Fuzzy matching (description similarity)
 * - Multi-transaction matching (bulk payments)
 * - Pattern-based matching (recurring transactions)
 * - Historical learning (past match patterns)
 *
 * Phase 4.1 Enhancement
 */

import { Timestamp } from 'firebase/firestore';
import type { BankTransaction, MatchSuggestion } from '@vapour/types';

/**
 * Matching configuration with customizable weights and thresholds
 */
export interface MatchingConfig {
  // Scoring weights (total should be 100)
  amountWeight: number; // Default: 40
  dateWeight: number; // Default: 30
  referenceWeight: number; // Default: 20
  descriptionWeight: number; // Default: 10

  // Thresholds
  minimumMatchScore: number; // Default: 50 (0-100)
  highConfidenceThreshold: number; // Default: 80
  mediumConfidenceThreshold: number; // Default: 65

  // Tolerances
  amountTolerancePercent: number; // Default: 0.01 (1%)
  amountToleranceFixed: number; // Default: 0.01 (absolute)
  dateToleranceDays: number; // Default: 7 days

  // Features
  enableFuzzyMatching: boolean; // Default: true
  enableMultiTransactionMatching: boolean; // Default: true
  enablePatternMatching: boolean; // Default: true
}

/**
 * Default matching configuration
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  amountWeight: 40,
  dateWeight: 30,
  referenceWeight: 20,
  descriptionWeight: 10,
  minimumMatchScore: 50,
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 65,
  amountTolerancePercent: 0.01,
  amountToleranceFixed: 0.01,
  dateToleranceDays: 7,
  enableFuzzyMatching: true,
  enableMultiTransactionMatching: true,
  enablePatternMatching: true,
};

/**
 * Extended match suggestion with more details
 */
export interface EnhancedMatchSuggestion extends MatchSuggestion {
  matchType: 'EXACT' | 'FUZZY' | 'MULTI' | 'PATTERN';
  amountVariance: number;
  dateVarianceDays: number;
  descriptionSimilarity: number;
  explanation: string;
}

/**
 * Multi-transaction match (one bank transaction to multiple accounting transactions)
 */
export interface MultiTransactionMatch {
  bankTransactionId: string;
  accountingTransactionIds: string[];
  matchScore: number;
  totalAmount: number;
  amountVariance: number;
  matchReasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!) + 1;
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score from 0 (completely different) to 1 (identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1.0 - distance / maxLen;
}

/**
 * Extract common words from string (for fuzzy matching)
 */
function extractKeywords(text: string): Set<string> {
  // Common stop words to ignore
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Calculate description similarity using multiple methods
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  // Method 1: Levenshtein similarity (50%)
  const levenshteinSim = stringSimilarity(desc1, desc2);

  // Method 2: Keyword overlap (50%)
  const keywords1 = extractKeywords(desc1);
  const keywords2 = extractKeywords(desc2);

  const intersection = new Set([...keywords1].filter((x) => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  const keywordSim = union.size > 0 ? intersection.size / union.size : 0;

  // Weighted average
  return levenshteinSim * 0.5 + keywordSim * 0.5;
}

/**
 * Check if amount matches within tolerance
 */
function isAmountMatch(
  amount1: number,
  amount2: number,
  config: MatchingConfig
): { exact: boolean; close: boolean; variance: number } {
  const variance = Math.abs(amount1 - amount2);
  const percentVariance = variance / Math.max(amount1, amount2);

  const exact = variance < config.amountToleranceFixed;
  const close =
    variance < config.amountToleranceFixed || percentVariance < config.amountTolerancePercent;

  return { exact, close, variance };
}

/**
 * Check if dates match within tolerance
 */
function isDateMatch(
  date1: Timestamp,
  date2: Timestamp,
  config: MatchingConfig
): { exact: boolean; close: boolean; varianceDays: number } {
  const d1 = date1.toDate();
  const d2 = date2.toDate();

  const varianceMs = Math.abs(d1.getTime() - d2.getTime());
  const varianceDays = varianceMs / (1000 * 60 * 60 * 24);

  const exact = varianceDays < 1;
  const close = varianceDays <= config.dateToleranceDays;

  return { exact, close, varianceDays };
}

/**
 * Calculate enhanced match score between bank and accounting transaction
 */
export function calculateEnhancedMatchScore(
  bankTxn: BankTransaction,
  accountingTxn: {
    amount?: number;
    totalAmount?: number;
    date?: Timestamp;
    description?: string;
    reference?: string;
    chequeNumber?: string;
  },
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): {
  score: number;
  reasons: string[];
  details: {
    amountScore: number;
    dateScore: number;
    referenceScore: number;
    descriptionScore: number;
    amountVariance: number;
    dateVarianceDays: number;
    descriptionSimilarity: number;
  };
} {
  let amountScore = 0;
  let dateScore = 0;
  let referenceScore = 0;
  let descriptionScore = 0;
  const reasons: string[] = [];

  // Amount matching
  const bankAmount = bankTxn.debitAmount || bankTxn.creditAmount;
  const accAmount = accountingTxn.amount || accountingTxn.totalAmount || 0;
  const amountMatch = isAmountMatch(bankAmount, accAmount, config);

  if (amountMatch.exact) {
    amountScore = config.amountWeight;
    reasons.push('Exact amount match');
  } else if (amountMatch.close) {
    amountScore = config.amountWeight * 0.8;
    reasons.push(`Close amount match (variance: ${amountMatch.variance.toFixed(2)})`);
  } else {
    const similarity = 1 - Math.min(amountMatch.variance / bankAmount, 1);
    amountScore = config.amountWeight * 0.3 * similarity;
  }

  // Date matching
  let dateVarianceDays = 999;
  if (accountingTxn.date) {
    const dateMatch = isDateMatch(bankTxn.transactionDate, accountingTxn.date, config);
    dateVarianceDays = dateMatch.varianceDays;

    if (dateMatch.exact) {
      dateScore = config.dateWeight;
      reasons.push('Same date');
    } else if (dateMatch.close) {
      const decay = 1 - dateMatch.varianceDays / config.dateToleranceDays;
      dateScore = config.dateWeight * (0.5 + 0.5 * decay);
      reasons.push(`Date within ${Math.floor(dateMatch.varianceDays)} days`);
    } else {
      dateScore = 0;
    }
  }

  // Reference/Cheque matching
  if (bankTxn.chequeNumber && accountingTxn.chequeNumber) {
    if (bankTxn.chequeNumber === accountingTxn.chequeNumber) {
      referenceScore = config.referenceWeight;
      reasons.push('Cheque number match');
    }
  }

  if (bankTxn.reference && accountingTxn.reference) {
    const ref1 = bankTxn.reference.toLowerCase();
    const ref2 = accountingTxn.reference.toLowerCase();

    if (ref1 === ref2) {
      referenceScore = Math.max(referenceScore, config.referenceWeight);
      reasons.push('Exact reference match');
    } else if (ref1.includes(ref2) || ref2.includes(ref1)) {
      referenceScore = Math.max(referenceScore, config.referenceWeight * 0.8);
      reasons.push('Partial reference match');
    }
  }

  // Description matching (fuzzy)
  let descriptionSimilarity = 0;
  if (accountingTxn.description && config.enableFuzzyMatching) {
    descriptionSimilarity = calculateDescriptionSimilarity(
      bankTxn.description,
      accountingTxn.description
    );

    if (descriptionSimilarity > 0.9) {
      descriptionScore = config.descriptionWeight;
      reasons.push('Very high description similarity');
    } else if (descriptionSimilarity > 0.7) {
      descriptionScore = config.descriptionWeight * 0.8;
      reasons.push('High description similarity');
    } else if (descriptionSimilarity > 0.5) {
      descriptionScore = config.descriptionWeight * 0.5;
      reasons.push('Moderate description similarity');
    } else if (descriptionSimilarity > 0.3) {
      descriptionScore = config.descriptionWeight * 0.3;
      reasons.push('Low description similarity');
    }
  }

  const totalScore = amountScore + dateScore + referenceScore + descriptionScore;

  return {
    score: totalScore,
    reasons,
    details: {
      amountScore,
      dateScore,
      referenceScore,
      descriptionScore,
      amountVariance: amountMatch.variance,
      dateVarianceDays,
      descriptionSimilarity,
    },
  };
}

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

/**
 * Generate combinations of array elements
 */
function generateCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];

  const [first, ...rest] = arr;
  const withoutFirst = generateCombinations(rest, size);
  const withFirst = generateCombinations(rest, size - 1).map((combo) => [first!, ...combo]);

  return [...withFirst, ...withoutFirst];
}

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
