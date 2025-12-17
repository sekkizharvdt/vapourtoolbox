/**
 * Bank Reconciliation CRUD Tests
 *
 * Tests for bank statement and transaction CRUD operations.
 */

import {
  createBankStatement,
  addBankTransactions,
  getUnmatchedAccountingTransactions,
  getUnmatchedBankTransactions,
} from './crud';
import { Timestamp } from 'firebase/firestore';

// Mock Firestore
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, dir: string) => ({ field, dir })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
  })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Helper to create mock Firestore instance
function createMockDb(): import('firebase/firestore').Firestore {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {} as import('firebase/firestore').Firestore;
}

// Helper to create mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

describe('bankReconciliation/crud', () => {
  let mockDb: import('firebase/firestore').Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe('createBankStatement', () => {
    const validStatementData = {
      accountId: 'account-123',
      accountName: 'Test Bank Account',
      accountNumber: '1234567890',
      bankName: 'Test Bank',
      statementDate: createMockTimestamp(new Date('2024-12-01')),
      startDate: createMockTimestamp(new Date('2024-12-01')),
      endDate: createMockTimestamp(new Date('2024-12-31')),
      openingBalance: 10000,
      closingBalance: 15000,
      totalDebits: 5000,
      totalCredits: 10000,
    };

    it('should create a bank statement with DRAFT status', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-statement-id' });

      const result = await createBankStatement(mockDb, validStatementData, 'user-123');

      expect(result).toBe('new-statement-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);

      const calledWith = mockAddDoc.mock.calls[0][1];
      expect(calledWith.status).toBe('DRAFT');
      expect(calledWith.uploadedBy).toBe('user-123');
      expect(calledWith.accountId).toBe('account-123');
      expect(calledWith.openingBalance).toBe(10000);
      expect(calledWith.closingBalance).toBe(15000);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-statement-id' });

      await createBankStatement(mockDb, validStatementData, 'user-123');

      const calledWith = mockAddDoc.mock.calls[0][1];
      expect(calledWith.createdAt).toBeDefined();
      expect(calledWith.updatedAt).toBeDefined();
    });

    it('should throw error when addDoc fails', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(createBankStatement(mockDb, validStatementData, 'user-123')).rejects.toThrow(
        'Failed to create bank statement: Firestore error'
      );
    });

    it('should handle unknown errors', async () => {
      mockAddDoc.mockRejectedValue('Non-Error rejection');

      await expect(createBankStatement(mockDb, validStatementData, 'user-123')).rejects.toThrow(
        'Failed to create bank statement: Unknown error'
      );
    });

    it('should preserve all provided statement data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-statement-id' });

      const dataWithOptionalFields = {
        ...validStatementData,
        bankName: 'Test Bank',
        notes: 'Monthly statement',
      };

      await createBankStatement(mockDb, dataWithOptionalFields, 'user-123');

      const calledWith = mockAddDoc.mock.calls[0][1];
      expect(calledWith.bankName).toBe('Test Bank');
      expect(calledWith.notes).toBe('Monthly statement');
    });
  });

  describe('addBankTransactions', () => {
    const validTransactions = [
      {
        statementId: 'statement-123',
        accountId: 'account-123',
        transactionDate: createMockTimestamp(new Date('2024-12-15')),
        description: 'Payment received',
        debitAmount: 0,
        creditAmount: 5000,
        balance: 15000,
        reference: 'REF-001',
      },
      {
        statementId: 'statement-123',
        accountId: 'account-123',
        transactionDate: createMockTimestamp(new Date('2024-12-16')),
        description: 'Transfer out',
        debitAmount: 2000,
        creditAmount: 0,
        balance: 13000,
        reference: 'REF-002',
      },
    ];

    it('should add all transactions with statement ID', async () => {
      await addBankTransactions(mockDb, 'statement-123', validTransactions);

      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('should set isReconciled to false for all transactions', async () => {
      await addBankTransactions(mockDb, 'statement-123', validTransactions);

      // Check both calls to batchSet
      validTransactions.forEach((_, index) => {
        const setCall = mockBatchSet.mock.calls[index][1];
        expect(setCall.isReconciled).toBe(false);
      });
    });

    it('should set statementId on all transactions', async () => {
      await addBankTransactions(mockDb, 'statement-123', validTransactions);

      validTransactions.forEach((_, index) => {
        const setCall = mockBatchSet.mock.calls[index][1];
        expect(setCall.statementId).toBe('statement-123');
      });
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      await addBankTransactions(mockDb, 'statement-123', validTransactions);

      const firstSetCall = mockBatchSet.mock.calls[0][1];
      expect(firstSetCall.createdAt).toBeDefined();
      expect(firstSetCall.updatedAt).toBeDefined();
    });

    it('should handle empty transaction array', async () => {
      await addBankTransactions(mockDb, 'statement-123', []);

      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('should throw error when batch commit fails', async () => {
      mockBatchCommit.mockRejectedValue(new Error('Batch commit error'));

      await expect(addBankTransactions(mockDb, 'statement-123', validTransactions)).rejects.toThrow(
        'Failed to add bank transactions: Batch commit error'
      );
    });

    it('should handle unknown errors in batch operations', async () => {
      mockBatchCommit.mockRejectedValue('Non-Error rejection');

      await expect(addBankTransactions(mockDb, 'statement-123', validTransactions)).rejects.toThrow(
        'Failed to add bank transactions: Unknown error'
      );
    });

    it('should preserve transaction data', async () => {
      await addBankTransactions(mockDb, 'statement-123', validTransactions);

      const firstSetCall = mockBatchSet.mock.calls[0][1];
      expect(firstSetCall.description).toBe('Payment received');
      expect(firstSetCall.creditAmount).toBe(5000);
      expect(firstSetCall.debitAmount).toBe(0);
      expect(firstSetCall.reference).toBe('REF-001');
    });
  });

  describe('getUnmatchedAccountingTransactions', () => {
    const startDate = createMockTimestamp(new Date('2024-12-01'));
    const endDate = createMockTimestamp(new Date('2024-12-31'));

    it('should return unreconciled transactions', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-15')),
            status: 'POSTED',
            isReconciled: false,
            amount: 5000,
            description: 'Payment',
            type: 'RECEIPT',
            reference: 'REF-001',
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-16')),
            status: 'POSTED',
            isReconciled: false,
            amount: 3000,
            description: 'Transfer',
            type: 'PAYMENT',
            reference: 'REF-002',
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedAccountingTransactions(
        mockDb,
        'account-123',
        startDate,
        endDate
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('txn-1');
      expect(result[0]!.amount).toBe(5000);
      expect(result[1]!.id).toBe('txn-2');
      expect(result[1]!.amount).toBe(3000);
    });

    it('should filter out reconciled transactions', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-15')),
            status: 'POSTED',
            isReconciled: true, // Already reconciled
            amount: 5000,
          }),
        },
        {
          id: 'txn-2',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-16')),
            status: 'POSTED',
            isReconciled: false,
            amount: 3000,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedAccountingTransactions(
        mockDb,
        'account-123',
        startDate,
        endDate
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('txn-2');
    });

    it('should return empty array when no unmatched transactions', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: () => {}, // Empty snapshot
      });

      const result = await getUnmatchedAccountingTransactions(
        mockDb,
        'account-123',
        startDate,
        endDate
      );

      expect(result).toHaveLength(0);
    });

    it('should include all transaction fields', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-15')),
            status: 'POSTED',
            isReconciled: false,
            amount: 5000,
            description: 'Test payment',
            type: 'RECEIPT',
            reference: 'REF-123',
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedAccountingTransactions(
        mockDb,
        'account-123',
        startDate,
        endDate
      );

      expect(result[0]).toEqual({
        id: 'txn-1',
        bankAccountId: 'account-123',
        date: expect.any(Object),
        status: 'POSTED',
        isReconciled: false,
        amount: 5000,
        description: 'Test payment',
        type: 'RECEIPT',
        reference: 'REF-123',
      });
    });

    it('should handle transactions with undefined isReconciled (treat as unreconciled)', async () => {
      const mockDocs = [
        {
          id: 'txn-1',
          data: () => ({
            bankAccountId: 'account-123',
            date: createMockTimestamp(new Date('2024-12-15')),
            status: 'POSTED',
            // isReconciled not set
            amount: 5000,
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedAccountingTransactions(
        mockDb,
        'account-123',
        startDate,
        endDate
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('getUnmatchedBankTransactions', () => {
    it('should return unreconciled bank transactions', async () => {
      const mockDocs = [
        {
          id: 'bank-txn-1',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-15')),
            valueDate: createMockTimestamp(new Date('2024-12-15')),
            description: 'Payment received',
            reference: 'REF-001',
            debitAmount: 0,
            creditAmount: 5000,
            balance: 15000,
            isReconciled: false,
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('bank-txn-1');
      expect(result[0]!.creditAmount).toBe(5000);
    });

    it('should map debit/credit field aliases', async () => {
      const mockDocs = [
        {
          id: 'bank-txn-1',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-15')),
            description: 'Payment',
            // Using alias fields
            debit: 1000,
            credit: 0,
            balance: 14000,
            isReconciled: false,
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result[0]!.debitAmount).toBe(1000);
      expect(result[0]!.creditAmount).toBe(0);
    });

    it('should default debit/credit to 0 when not present', async () => {
      const mockDocs = [
        {
          id: 'bank-txn-1',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-15')),
            description: 'Entry',
            // No debit/credit fields
            balance: 14000,
            isReconciled: false,
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result[0]!.debitAmount).toBe(0);
      expect(result[0]!.creditAmount).toBe(0);
    });

    it('should return empty array when no unmatched transactions', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: () => {},
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result).toHaveLength(0);
    });

    it('should include reconciledWith field when present', async () => {
      const mockDocs = [
        {
          id: 'bank-txn-1',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-15')),
            description: 'Payment',
            debitAmount: 0,
            creditAmount: 5000,
            balance: 15000,
            isReconciled: false,
            reconciledWith: ['txn-1', 'txn-2'],
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result[0]!.reconciledWith).toEqual(['txn-1', 'txn-2']);
    });

    it('should return transactions in correct order (by date desc)', async () => {
      const mockDocs = [
        {
          id: 'bank-txn-1',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-20')),
            description: 'Later payment',
            creditAmount: 5000,
            balance: 20000,
            isReconciled: false,
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
        {
          id: 'bank-txn-2',
          data: () => ({
            statementId: 'statement-123',
            accountId: 'account-123',
            transactionDate: createMockTimestamp(new Date('2024-12-15')),
            description: 'Earlier payment',
            creditAmount: 3000,
            balance: 15000,
            isReconciled: false,
            createdAt: createMockTimestamp(new Date()),
            updatedAt: createMockTimestamp(new Date()),
          }),
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      // First should be later date (desc order)
      expect(result[0]!.id).toBe('bank-txn-1');
      expect(result[1]!.id).toBe('bank-txn-2');
    });

    it('should handle multiple transactions', async () => {
      const mockDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `bank-txn-${i}`,
        data: () => ({
          statementId: 'statement-123',
          accountId: 'account-123',
          transactionDate: createMockTimestamp(new Date(`2024-12-${10 + i}`)),
          description: `Transaction ${i}`,
          creditAmount: 1000 * (i + 1),
          balance: 10000 + 1000 * (i + 1),
          isReconciled: false,
          createdAt: createMockTimestamp(new Date()),
          updatedAt: createMockTimestamp(new Date()),
        }),
      }));

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: unknown) => void) => mockDocs.forEach(callback),
      });

      const result = await getUnmatchedBankTransactions(mockDb, 'statement-123');

      expect(result).toHaveLength(10);
    });
  });
});
