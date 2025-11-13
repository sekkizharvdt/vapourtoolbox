/**
 * Auto-Matching Engine Types
 *
 * Type definitions for the advanced auto-matching engine
 */

import type { MatchSuggestion } from '@vapour/types';

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
