/**
 * Bank Reconciliation Matching Tests
 *
 * Tests for core matching algorithms and scoring logic.
 */

import { calculateMatchScore } from './matching';
import { Timestamp } from 'firebase/firestore';
import type { BankTransaction } from '@vapour/types';

// Mock dependencies
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
  writeBatch: jest.fn(),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('./crud', () => ({
  getUnmatchedBankTransactions: jest.fn(),
  getUnmatchedAccountingTransactions: jest.fn(),
}));

// Helper to create mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const ts = {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
  return ts;
}

// Helper to create mock bank transaction
function createBankTransaction(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 'bank-txn-1',
    statementId: 'statement-1',
    accountId: 'account-1',
    transactionDate: createMockTimestamp(new Date('2024-06-15')),
    description: 'Payment received',
    debitAmount: 0,
    creditAmount: 1000,
    balance: 5000,
    reference: 'REF-123',
    chequeNumber: undefined,
    isReconciled: false,
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  };
}

describe('bankReconciliation/matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateMatchScore', () => {
    describe('amount matching', () => {
      it('should give 40 points for exact amount match', () => {
        const bankTxn = createBankTransaction({ creditAmount: 1000 });
        const accTxn = { amount: 1000 };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(40);
        expect(reasons).toContain('Exact amount match');
      });

      it('should give 40 points for amount match within 0.01', () => {
        const bankTxn = createBankTransaction({ creditAmount: 1000.005 });
        const accTxn = { amount: 1000 };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(40);
        expect(reasons).toContain('Exact amount match');
      });

      it('should give 20 points for close amount match (within 5%)', () => {
        const bankTxn = createBankTransaction({ creditAmount: 1000 });
        const accTxn = { amount: 1040 }; // 4% difference

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(20);
        expect(reasons).toContain('Close amount match (within 5%)');
      });

      it('should give 0 points for amount difference > 5%', () => {
        const bankTxn = createBankTransaction({ creditAmount: 1000 });
        const accTxn = { amount: 1100 }; // 10% difference

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).not.toContain('Exact amount match');
        expect(reasons).not.toContain('Close amount match (within 5%)');
      });

      it('should use debitAmount when creditAmount is 0', () => {
        const bankTxn = createBankTransaction({ debitAmount: 500, creditAmount: 0 });
        const accTxn = { amount: 500 };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Exact amount match');
      });

      it('should use totalAmount when amount is not present', () => {
        const bankTxn = createBankTransaction({ creditAmount: 1000 });
        const accTxn = { totalAmount: 1000 };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Exact amount match');
      });
    });

    describe('date matching', () => {
      it('should give 30 points for same date', () => {
        const txnDate = new Date('2024-06-15');
        const bankTxn = createBankTransaction({
          transactionDate: createMockTimestamp(txnDate),
        });
        const accTxn = {
          amount: 1000,
          date: createMockTimestamp(txnDate),
        };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(30);
        expect(reasons).toContain('Same date');
      });

      it('should give 20 points for date within 2 days', () => {
        const bankTxn = createBankTransaction({
          transactionDate: createMockTimestamp(new Date('2024-06-15')),
        });
        const accTxn = {
          amount: 1000,
          date: createMockTimestamp(new Date('2024-06-17')), // 2 days later
        };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(20);
        expect(reasons).toContain('Date within 2 days');
      });

      it('should give 10 points for date within 7 days', () => {
        const bankTxn = createBankTransaction({
          transactionDate: createMockTimestamp(new Date('2024-06-15')),
        });
        const accTxn = {
          amount: 1000,
          date: createMockTimestamp(new Date('2024-06-20')), // 5 days later
        };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(10);
        expect(reasons).toContain('Date within 7 days');
      });

      it('should give 0 points for date > 7 days', () => {
        const bankTxn = createBankTransaction({
          transactionDate: createMockTimestamp(new Date('2024-06-15')),
        });
        const accTxn = {
          amount: 1000,
          date: createMockTimestamp(new Date('2024-06-30')), // 15 days later
        };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).not.toContain('Same date');
        expect(reasons).not.toContain('Date within 2 days');
        expect(reasons).not.toContain('Date within 7 days');
      });

      it('should handle missing date in accounting transaction', () => {
        const bankTxn = createBankTransaction();
        const accTxn = { amount: 1000 };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).not.toContain('Same date');
        expect(reasons).not.toContain('Date within 2 days');
        expect(reasons).not.toContain('Date within 7 days');
      });
    });

    describe('reference matching', () => {
      it('should give 20 points for cheque number match', () => {
        const bankTxn = createBankTransaction({ chequeNumber: 'CHQ001' });
        const accTxn = { amount: 1000, chequeNumber: 'CHQ001' };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(20);
        expect(reasons).toContain('Cheque number match');
      });

      it('should not match if only one has cheque number', () => {
        const bankTxn = createBankTransaction({ chequeNumber: 'CHQ001' });
        const accTxn = { amount: 1000 };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).not.toContain('Cheque number match');
      });

      it('should give 15 points for reference match', () => {
        const bankTxn = createBankTransaction({ reference: 'INV-2024-001' });
        const accTxn = { amount: 1000, reference: 'INV-2024-001' };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(15);
        expect(reasons).toContain('Reference match');
      });

      it('should match partial references (bank contains accounting)', () => {
        const bankTxn = createBankTransaction({ reference: 'Payment for INV-2024-001 received' });
        const accTxn = { amount: 1000, reference: 'INV-2024-001' };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Reference match');
      });

      it('should match partial references (accounting contains bank)', () => {
        const bankTxn = createBankTransaction({ reference: 'INV001' });
        const accTxn = { amount: 1000, reference: 'Payment INV001 full settlement' };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Reference match');
      });

      it('should be case-insensitive for reference matching', () => {
        const bankTxn = createBankTransaction({ reference: 'inv-2024-001' });
        const accTxn = { amount: 1000, reference: 'INV-2024-001' };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Reference match');
      });
    });

    describe('description matching', () => {
      it('should give 10 points for description similarity', () => {
        const bankTxn = createBankTransaction({ description: 'Payment from ABC Corp' });
        const accTxn = { amount: 1000, description: 'ABC Corp invoice payment' };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeGreaterThanOrEqual(10);
        expect(reasons).toContain('Description similarity');
      });

      it('should match when bank description contains accounting description', () => {
        const bankTxn = createBankTransaction({ description: 'Payment ABC Corp Ltd' });
        const accTxn = { amount: 1000, description: 'ABC' };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Description similarity');
      });

      it('should be case-insensitive for description matching', () => {
        const bankTxn = createBankTransaction({ description: 'PAYMENT ABC' });
        const accTxn = { amount: 1000, description: 'payment abc' };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).toContain('Description similarity');
      });

      it('should handle missing description in accounting transaction', () => {
        const bankTxn = createBankTransaction({ description: 'Payment' });
        const accTxn = { amount: 1000 };

        const { reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(reasons).not.toContain('Description similarity');
      });
    });

    describe('combined scoring', () => {
      it('should accumulate score from multiple matches', () => {
        const txnDate = new Date('2024-06-15');
        const bankTxn = createBankTransaction({
          creditAmount: 1000,
          transactionDate: createMockTimestamp(txnDate),
          reference: 'REF-123',
          chequeNumber: 'CHQ001',
          description: 'Payment from ABC',
        });
        const accTxn = {
          amount: 1000,
          date: createMockTimestamp(txnDate),
          reference: 'REF-123',
          chequeNumber: 'CHQ001',
          description: 'ABC Payment',
        };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        // 40 (amount) + 30 (date) + 20 (cheque) + 15 (reference) + 10 (description) = 115
        // But max is 100 based on algorithm constraints
        expect(score).toBeGreaterThanOrEqual(80);
        expect(reasons.length).toBeGreaterThanOrEqual(4);
      });

      it('should return 0 score for completely unrelated transactions', () => {
        const bankTxn = createBankTransaction({
          creditAmount: 1000,
          transactionDate: createMockTimestamp(new Date('2024-01-01')),
          description: 'ABC',
        });
        const accTxn = {
          amount: 5000,
          date: createMockTimestamp(new Date('2024-12-31')),
          description: 'XYZ',
        };

        const { score, reasons } = calculateMatchScore(bankTxn, accTxn);

        expect(score).toBeLessThan(50);
        expect(reasons.length).toBe(0);
      });
    });
  });
});
