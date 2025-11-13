/**
 * Auto-Matching Engine Utilities
 *
 * String similarity and helper functions for transaction matching
 */

import { Timestamp } from 'firebase/firestore';
import type { MatchingConfig } from './types';

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
export function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
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
export function isAmountMatch(
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
export function isDateMatch(
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
 * Generate combinations of array elements
 */
export function generateCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];

  const [first, ...rest] = arr;
  const withoutFirst = generateCombinations(rest, size);
  const withFirst = generateCombinations(rest, size - 1).map((combo) => [first!, ...combo]);

  return [...withFirst, ...withoutFirst];
}
