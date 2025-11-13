/**
 * Auto-Matching Engine Scoring
 *
 * Match score calculation logic
 */

import { Timestamp } from 'firebase/firestore';
import type { BankTransaction } from '@vapour/types';
import type { MatchingConfig } from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';
import { calculateDescriptionSimilarity, isAmountMatch, isDateMatch } from './utils';

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
