/**
 * Auto-Matching Scoring Tests
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
import { calculateEnhancedMatchScore } from './scoring';
import type { MatchingConfig } from './types';
import { DEFAULT_MATCHING_CONFIG } from './types';
import type { BankTransaction } from '@vapour/types';

function makeTimestamp(dateStr: string) {
  return Timestamp.fromDate(new Date(dateStr));
}

function createBankTxn(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 'bank-1',
    statementId: 'stmt-1',
    transactionDate: makeTimestamp('2024-01-15'),
    valueDate: makeTimestamp('2024-01-15'),
    description: 'Payment from Customer ABC',
    reference: 'REF-001',
    debitAmount: 0,
    creditAmount: 50000,
    balance: 150000,
    status: 'UNMATCHED' as const,
    ...overrides,
  } as unknown as BankTransaction;
}

describe('Auto-Matching Scoring', () => {
  describe('calculateEnhancedMatchScore', () => {
    it('should give high score for exact amount + date match', () => {
      const bankTxn = createBankTxn({ creditAmount: 50000 });
      const accTxn = {
        amount: 50000,
        date: makeTimestamp('2024-01-15'),
        description: 'Different description',
      };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      // Amount (40) + Date (30) = 70 minimum
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.reasons).toContain('Exact amount match');
      expect(result.reasons).toContain('Same date');
      expect(result.details.amountScore).toBe(DEFAULT_MATCHING_CONFIG.amountWeight);
      expect(result.details.dateScore).toBe(DEFAULT_MATCHING_CONFIG.dateWeight);
    });

    it('should give maximum score for perfect match on all criteria', () => {
      const bankTxn = createBankTxn({
        creditAmount: 50000,
        reference: 'INV-001',
        chequeNumber: 'CHQ-123',
        description: 'Payment from Vendor XYZ',
      });
      const accTxn = {
        amount: 50000,
        date: makeTimestamp('2024-01-15'),
        reference: 'INV-001',
        chequeNumber: 'CHQ-123',
        description: 'Payment from Vendor XYZ',
      };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.details.amountScore).toBe(40);
      expect(result.details.dateScore).toBe(30);
      expect(result.details.referenceScore).toBe(20);
    });

    it('should reduce score for close but not exact amount match', () => {
      // Variance must exceed amountToleranceFixed but stay within amountTolerancePercent
      const config: MatchingConfig = {
        ...DEFAULT_MATCHING_CONFIG,
        amountToleranceFixed: 10,
        amountTolerancePercent: 0.05, // 5%
      };
      const bankTxn = createBankTxn({ creditAmount: 50000 });
      const accTxn = { amount: 50500, date: makeTimestamp('2024-01-15') }; // 500 variance > 10 fixed

      const result = calculateEnhancedMatchScore(bankTxn, accTxn, config);

      expect(result.details.amountScore).toBeLessThan(40);
      expect(result.details.amountScore).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Close amount match'))).toBe(true);
    });

    it('should score date match with decay for close dates', () => {
      const bankTxn = createBankTxn();
      const accTxn = {
        amount: 50000,
        date: makeTimestamp('2024-01-18'), // 3 days apart
      };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.dateScore).toBeGreaterThan(0);
      expect(result.details.dateScore).toBeLessThan(30);
      expect(result.details.dateVarianceDays).toBeCloseTo(3, 0);
    });

    it('should give zero date score when beyond tolerance', () => {
      const bankTxn = createBankTxn();
      const accTxn = {
        amount: 50000,
        date: makeTimestamp('2024-02-15'), // 31 days apart
      };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.dateScore).toBe(0);
    });

    it('should score cheque number match', () => {
      const bankTxn = createBankTxn({ chequeNumber: '123456' });
      const accTxn = { amount: 50000, chequeNumber: '123456' };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.referenceScore).toBe(20);
      expect(result.reasons).toContain('Cheque number match');
    });

    it('should score exact reference match', () => {
      const bankTxn = createBankTxn({ reference: 'UTR123456' });
      const accTxn = { amount: 50000, reference: 'UTR123456' };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.referenceScore).toBe(20);
      expect(result.reasons).toContain('Exact reference match');
    });

    it('should score partial reference match', () => {
      const bankTxn = createBankTxn({ reference: 'UTR123456-EXTRA' });
      const accTxn = { amount: 50000, reference: 'UTR123456' };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.referenceScore).toBe(16); // 20 * 0.8
      expect(result.reasons).toContain('Partial reference match');
    });

    it('should use totalAmount when amount is not available', () => {
      const bankTxn = createBankTxn({ creditAmount: 75000 });
      const accTxn = { totalAmount: 75000, date: makeTimestamp('2024-01-15') };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.amountScore).toBe(40);
    });

    it('should use debitAmount when creditAmount is 0', () => {
      const bankTxn = createBankTxn({ debitAmount: 30000, creditAmount: 0 });
      const accTxn = { amount: 30000 };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.amountScore).toBe(40);
    });

    it('should handle missing date in accounting transaction', () => {
      const bankTxn = createBankTxn();
      const accTxn = { amount: 50000 };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn);

      expect(result.details.dateScore).toBe(0);
      expect(result.details.dateVarianceDays).toBe(999);
    });

    it('should disable fuzzy matching when config disables it', () => {
      const config: MatchingConfig = {
        ...DEFAULT_MATCHING_CONFIG,
        enableFuzzyMatching: false,
      };
      const bankTxn = createBankTxn({ description: 'Payment from Vendor' });
      const accTxn = { amount: 50000, description: 'Payment from Vendor' };

      const result = calculateEnhancedMatchScore(bankTxn, accTxn, config);

      expect(result.details.descriptionScore).toBe(0);
      expect(result.details.descriptionSimilarity).toBe(0);
    });
  });
});
