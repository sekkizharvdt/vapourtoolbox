/**
 * Auto-Matching Utils Tests
 */

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import { Timestamp } from 'firebase/firestore';
import {
  calculateDescriptionSimilarity,
  isAmountMatch,
  isDateMatch,
  generateCombinations,
} from './utils';
import type { MatchingConfig } from './types';

const defaultConfig: MatchingConfig = {
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

describe('Auto-Matching Utils', () => {
  describe('calculateDescriptionSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const score = calculateDescriptionSimilarity(
        'Payment from Vendor ABC',
        'Payment from Vendor ABC'
      );
      expect(score).toBe(1);
    });

    it('should return high score for very similar strings', () => {
      const score = calculateDescriptionSimilarity(
        'Payment from Vendor ABC',
        'Payment from Vendor ABCD'
      );
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return low score for very different strings', () => {
      const score = calculateDescriptionSimilarity(
        'Payment from Vendor ABC',
        'Salary expense January'
      );
      expect(score).toBeLessThan(0.5);
    });

    it('should be case insensitive', () => {
      const score1 = calculateDescriptionSimilarity('PAYMENT RECEIVED', 'payment received');
      expect(score1).toBe(1);
    });

    it('should handle empty strings', () => {
      const score = calculateDescriptionSimilarity('', '');
      // Levenshtein returns 1.0, keyword overlap returns 0 (empty sets)
      // Weighted: 1.0 * 0.5 + 0 * 0.5 = 0.5
      expect(score).toBe(0.5);
    });

    it('should handle one empty string', () => {
      const score = calculateDescriptionSimilarity('Hello world', '');
      expect(score).toBeLessThan(0.5);
    });

    it('should use keyword overlap for partial matching', () => {
      // Same keywords in different order
      const score = calculateDescriptionSimilarity(
        'Invoice payment received client',
        'Client payment invoice received'
      );
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('isAmountMatch', () => {
    it('should return exact match for identical amounts', () => {
      const result = isAmountMatch(1000, 1000, defaultConfig);
      expect(result.exact).toBe(true);
      expect(result.close).toBe(true);
      expect(result.variance).toBe(0);
    });

    it('should return exact match when within fixed tolerance', () => {
      const result = isAmountMatch(1000, 1000.005, defaultConfig);
      expect(result.exact).toBe(true);
    });

    it('should not return exact match when beyond fixed tolerance', () => {
      const result = isAmountMatch(1000, 1001, defaultConfig);
      expect(result.exact).toBe(false);
    });

    it('should return close match when within percentage tolerance', () => {
      const config = { ...defaultConfig, amountTolerancePercent: 0.05 }; // 5%
      const result = isAmountMatch(1000, 1040, config);
      expect(result.exact).toBe(false);
      expect(result.close).toBe(true);
    });

    it('should not return close match when beyond both tolerances', () => {
      const result = isAmountMatch(1000, 1100, defaultConfig);
      expect(result.exact).toBe(false);
      expect(result.close).toBe(false);
      expect(result.variance).toBe(100);
    });

    it('should calculate variance correctly', () => {
      const result = isAmountMatch(500, 750, defaultConfig);
      expect(result.variance).toBe(250);
    });
  });

  describe('isDateMatch', () => {
    function makeTimestamp(dateStr: string) {
      return Timestamp.fromDate(new Date(dateStr));
    }

    it('should return exact match for same date', () => {
      const d1 = makeTimestamp('2024-01-15');
      const d2 = makeTimestamp('2024-01-15');
      const result = isDateMatch(d1, d2, defaultConfig);
      expect(result.exact).toBe(true);
      expect(result.close).toBe(true);
      expect(result.varianceDays).toBeLessThan(1);
    });

    it('should return close match within tolerance days', () => {
      const d1 = makeTimestamp('2024-01-15');
      const d2 = makeTimestamp('2024-01-18');
      const result = isDateMatch(d1, d2, defaultConfig);
      expect(result.exact).toBe(false);
      expect(result.close).toBe(true);
      expect(result.varianceDays).toBeCloseTo(3, 0);
    });

    it('should not return close match beyond tolerance days', () => {
      const d1 = makeTimestamp('2024-01-01');
      const d2 = makeTimestamp('2024-01-20');
      const result = isDateMatch(d1, d2, defaultConfig);
      expect(result.exact).toBe(false);
      expect(result.close).toBe(false);
    });

    it('should respect custom tolerance config', () => {
      const config = { ...defaultConfig, dateToleranceDays: 30 };
      const d1 = makeTimestamp('2024-01-01');
      const d2 = makeTimestamp('2024-01-20');
      const result = isDateMatch(d1, d2, config);
      expect(result.close).toBe(true);
    });
  });

  describe('generateCombinations', () => {
    it('should generate combinations of given size', () => {
      const result = generateCombinations([1, 2, 3], 2);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual([1, 2]);
      expect(result).toContainEqual([1, 3]);
      expect(result).toContainEqual([2, 3]);
    });

    it('should return single element arrays for size 1', () => {
      const result = generateCombinations(['a', 'b', 'c'], 1);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(['a']);
      expect(result).toContainEqual(['b']);
      expect(result).toContainEqual(['c']);
    });

    it('should return empty array with empty element for size 0', () => {
      const result = generateCombinations([1, 2, 3], 0);
      expect(result).toEqual([[]]);
    });

    it('should return empty array when array is empty', () => {
      const result = generateCombinations([], 2);
      expect(result).toEqual([]);
    });

    it('should return full array for size equal to array length', () => {
      const result = generateCombinations([1, 2, 3], 3);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual([1, 2, 3]);
    });

    it('should return empty array when size exceeds array length', () => {
      const result = generateCombinations([1, 2], 3);
      expect(result).toHaveLength(0);
    });
  });
});
