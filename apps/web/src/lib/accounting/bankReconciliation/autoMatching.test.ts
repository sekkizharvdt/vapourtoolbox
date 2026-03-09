/**
 * Bank Reconciliation Auto-Matching Tests
 *
 * Tests for enhanced auto-matching with Firestore integration
 */

import type { BankStatement, BankTransaction } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
    BANK_STATEMENTS: 'bankStatements',
  },
}));

// Mock Firestore
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock CRUD functions
const mockGetUnmatchedBankTransactions = jest.fn();
const mockGetUnmatchedAccountingTransactions = jest.fn();

jest.mock('./crud', () => ({
  getUnmatchedBankTransactions: (...args: unknown[]) => mockGetUnmatchedBankTransactions(...args),
  getUnmatchedAccountingTransactions: (...args: unknown[]) =>
    mockGetUnmatchedAccountingTransactions(...args),
}));

// Mock matching function
const mockMatchTransactions = jest.fn();

jest.mock('./matching', () => ({
  matchTransactions: (...args: unknown[]) => mockMatchTransactions(...args),
}));

// Mock auto-matching engine
const mockBatchAutoMatch = jest.fn();
const mockGetMatchStatistics = jest.fn();

jest.mock('../autoMatching', () => ({
  batchAutoMatch: (...args: unknown[]) => mockBatchAutoMatch(...args),
  getMatchStatistics: (...args: unknown[]) => mockGetMatchStatistics(...args),
  DEFAULT_MATCHING_CONFIG: {
    exactAmountWeight: 40,
    dateWeight: 30,
    referenceWeight: 15,
    descriptionWeight: 10,
    chequeWeight: 20,
    highConfidenceThreshold: 80,
    mediumConfidenceThreshold: 60,
    lowConfidenceThreshold: 40,
    dateToleranceDays: 7,
    amountTolerancePercent: 0.05,
  },
}));

import {
  getEnhancedSuggestedMatches,
  getEnhancedMatchStatistics,
  autoMatchTransactions,
  getMultiTransactionMatches,
} from './autoMatching';
import type { Firestore } from 'firebase/firestore';

// Helper to create mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Helper to create mock statement
function createMockStatement(overrides: Partial<BankStatement> = {}): BankStatement {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id: 'statement-1',
    accountId: 'account-1',
    accountName: 'Test Account',
    startDate: createMockTimestamp(new Date('2024-06-01')),
    endDate: createMockTimestamp(new Date('2024-06-30')),
    openingBalance: 10000,
    closingBalance: 15000,
    status: 'IN_PROGRESS',
    transactionCount: 10,
    reconciledCount: 0,
    uploadedAt: createMockTimestamp(new Date()),
    createdBy: 'user-1',
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  } as BankStatement;
}

// Helper to create mock bank transaction
function createMockBankTransaction(overrides: Partial<BankTransaction> = {}): BankTransaction {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
    isReconciled: false,
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  } as BankTransaction;
}

describe('bankReconciliation/autoMatching', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockMatchTransactions.mockResolvedValue(undefined);
  });

  describe('getEnhancedSuggestedMatches', () => {
    it('returns enhanced match suggestions', async () => {
      const mockStatement = createMockStatement();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStatement,
      });

      const bankTxns = [createMockBankTransaction()];
      const accTxns = [{ id: 'acc-1', amount: 1000 }];

      mockGetUnmatchedBankTransactions.mockResolvedValue(bankTxns);
      mockGetUnmatchedAccountingTransactions.mockResolvedValue(accTxns);

      const mockSuggestions = [
        {
          bankTransactionId: 'bank-txn-1',
          accountingTransactionId: 'acc-1',
          score: 90,
          confidence: 'HIGH',
          explanation: 'Exact amount and date match',
        },
      ];

      mockBatchAutoMatch.mockReturnValue({
        highConfidence: mockSuggestions,
        mediumConfidence: [],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      const result = await getEnhancedSuggestedMatches(mockDb, 'statement-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.bankTransactionId).toBe('bank-txn-1');
      expect(result[0]!.confidence).toBe('HIGH');
      expect(mockBatchAutoMatch).toHaveBeenCalledWith(bankTxns, accTxns, expect.any(Object));
    });

    it('combines all confidence levels in results', async () => {
      const mockStatement = createMockStatement();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStatement,
      });

      mockGetUnmatchedBankTransactions.mockResolvedValue([]);
      mockGetUnmatchedAccountingTransactions.mockResolvedValue([]);

      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [{ bankTransactionId: 'high-1', confidence: 'HIGH' }],
        mediumConfidence: [{ bankTransactionId: 'med-1', confidence: 'MEDIUM' }],
        lowConfidence: [{ bankTransactionId: 'low-1', confidence: 'LOW' }],
        multiMatches: [],
        unmatched: [],
      });

      const result = await getEnhancedSuggestedMatches(mockDb, 'statement-1');

      expect(result).toHaveLength(3);
      expect(result.map((s) => s.confidence)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    });

    it('throws error when statement not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getEnhancedSuggestedMatches(mockDb, 'missing-statement')).rejects.toThrow(
        'Bank statement not found'
      );
    });

    it('propagates errors from getUnmatchedBankTransactions', async () => {
      mockGetUnmatchedBankTransactions.mockRejectedValue(new Error('Database error'));

      await expect(getEnhancedSuggestedMatches(mockDb, 'statement-1')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getEnhancedMatchStatistics', () => {
    it('returns match statistics', async () => {
      const mockStatement = createMockStatement();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStatement,
      });

      mockGetUnmatchedBankTransactions.mockResolvedValue([]);
      mockGetUnmatchedAccountingTransactions.mockResolvedValue([]);

      const mockStats = {
        totalBankTransactions: 10,
        totalAccountingTransactions: 15,
        matchableTransactions: 8,
        highConfidenceMatches: 5,
        mediumConfidenceMatches: 2,
        lowConfidenceMatches: 1,
        multiTransactionMatches: 0,
        unmatchable: 2,
        estimatedMatchRate: 0.8,
      };

      mockGetMatchStatistics.mockReturnValue(mockStats);

      const result = await getEnhancedMatchStatistics(mockDb, 'statement-1');

      expect(result).toEqual(mockStats);
      expect(mockGetMatchStatistics).toHaveBeenCalled();
    });

    it('throws error when statement not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getEnhancedMatchStatistics(mockDb, 'missing-statement')).rejects.toThrow(
        'Bank statement not found'
      );
    });
  });

  describe('autoMatchTransactions', () => {
    beforeEach(() => {
      const mockStatement = createMockStatement();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStatement,
      });

      mockGetUnmatchedBankTransactions.mockResolvedValue([]);
      mockGetUnmatchedAccountingTransactions.mockResolvedValue([]);
    });

    it('auto-matches high confidence transactions by default', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [
          {
            bankTransactionId: 'bank-1',
            accountingTransactionId: 'acc-1',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
          {
            bankTransactionId: 'bank-2',
            accountingTransactionId: 'acc-2',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
        ],
        mediumConfidence: [
          {
            bankTransactionId: 'bank-3',
            accountingTransactionId: 'acc-3',
            confidence: 'MEDIUM',
            explanation: 'Partial match',
          },
        ],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      const result = await autoMatchTransactions(mockDb, 'statement-1', 'user-1');

      expect(result.matched).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockMatchTransactions).toHaveBeenCalledTimes(2);
    });

    it('includes medium confidence when enabled', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [
          {
            bankTransactionId: 'bank-1',
            accountingTransactionId: 'acc-1',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
        ],
        mediumConfidence: [
          {
            bankTransactionId: 'bank-2',
            accountingTransactionId: 'acc-2',
            confidence: 'MEDIUM',
            explanation: 'Partial match',
          },
        ],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      const result = await autoMatchTransactions(mockDb, 'statement-1', 'user-1', {
        matchMediumConfidence: true,
      });

      expect(result.matched).toBe(2);
      expect(mockMatchTransactions).toHaveBeenCalledTimes(2);
    });

    it('excludes high confidence when disabled', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [
          {
            bankTransactionId: 'bank-1',
            accountingTransactionId: 'acc-1',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
        ],
        mediumConfidence: [
          {
            bankTransactionId: 'bank-2',
            accountingTransactionId: 'acc-2',
            confidence: 'MEDIUM',
            explanation: 'Partial match',
          },
        ],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      const result = await autoMatchTransactions(mockDb, 'statement-1', 'user-1', {
        matchHighConfidence: false,
        matchMediumConfidence: true,
      });

      expect(result.matched).toBe(1);
      expect(mockMatchTransactions).toHaveBeenCalledTimes(1);
    });

    it('updates statement status when matches are made', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [
          {
            bankTransactionId: 'bank-1',
            accountingTransactionId: 'acc-1',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
        ],
        mediumConfidence: [],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      await autoMatchTransactions(mockDb, 'statement-1', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'IN_PROGRESS' })
      );
    });

    it('does not update statement when no matches', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [],
        mediumConfidence: [],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      await autoMatchTransactions(mockDb, 'statement-1', 'user-1');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('tracks errors and continues matching', async () => {
      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [
          {
            bankTransactionId: 'bank-1',
            accountingTransactionId: 'acc-1',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
          {
            bankTransactionId: 'bank-2',
            accountingTransactionId: 'acc-2',
            confidence: 'HIGH',
            explanation: 'Exact match',
          },
        ],
        mediumConfidence: [],
        lowConfidence: [],
        multiMatches: [],
        unmatched: [],
      });

      mockMatchTransactions
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Match failed'));

      const result = await autoMatchTransactions(mockDb, 'statement-1', 'user-1');

      expect(result.matched).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('bank-2');
      expect(result.errors[0]).toContain('Match failed');
    });

    it('throws error when statement not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(autoMatchTransactions(mockDb, 'missing-statement', 'user-1')).rejects.toThrow(
        'Bank statement not found'
      );
    });
  });

  describe('getMultiTransactionMatches', () => {
    it('returns multi-transaction matches', async () => {
      const mockStatement = createMockStatement();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockStatement,
      });

      mockGetUnmatchedBankTransactions.mockResolvedValue([]);
      mockGetUnmatchedAccountingTransactions.mockResolvedValue([]);

      const mockMultiMatches = [
        {
          bankTransactionId: 'bank-1',
          accountingTransactionIds: ['acc-1', 'acc-2'],
          combinedScore: 95,
          confidence: 'HIGH',
          explanation: 'Bank amount equals sum of two accounting transactions',
        },
      ];

      mockBatchAutoMatch.mockReturnValue({
        highConfidence: [],
        mediumConfidence: [],
        lowConfidence: [],
        multiMatches: mockMultiMatches,
        unmatched: [],
      });

      const result = await getMultiTransactionMatches(mockDb, 'statement-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.accountingTransactionIds).toEqual(['acc-1', 'acc-2']);
    });

    it('throws error when statement not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getMultiTransactionMatches(mockDb, 'missing-statement')).rejects.toThrow(
        'Bank statement not found'
      );
    });
  });
});
