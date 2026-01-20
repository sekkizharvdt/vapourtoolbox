/**
 * Payment Batch Service Tests
 *
 * Tests for payment batch operations: create, add receipts/payments, validation
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PAYMENT_BATCHES: 'paymentBatches',
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-batch-id' });
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

// Transaction mock data holder
let transactionMockDocData: { exists: boolean; data?: () => Record<string, unknown> } | null = null;
const mockTransactionUpdate = jest.fn();

const mockRunTransaction = jest.fn(async (_db, callback) => {
  const transaction = {
    get: jest.fn(() => {
      if (transactionMockDocData) {
        return {
          exists: () => transactionMockDocData!.exists,
          data: transactionMockDocData!.data,
        };
      }
      return { exists: () => false, data: () => ({}) };
    }),
    update: mockTransactionUpdate,
    set: jest.fn(),
  };
  return callback(transaction);
});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `paymentBatches/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  limit: jest.fn((n) => ({ limit: n })),
  runTransaction: (db: unknown, callback: unknown) => mockRunTransaction(db, callback),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
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

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  removeUndefinedValues: <T>(obj: T): T => {
    if (obj === null || obj === undefined) return obj;
    return Object.fromEntries(
      Object.entries(obj as object).filter(([, v]) => v !== undefined)
    ) as T;
  },
}));

import { addBatchPayment, calculateBatchTotals } from './paymentBatchService';
import type { Firestore } from 'firebase/firestore';
import type { PaymentBatch, AddBatchPaymentInput } from '@vapour/types';

describe('paymentBatchService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionMockDocData = null;
  });

  describe('calculateBatchTotals', () => {
    // Helper to create mock receipt/payment objects for testing
    const mockReceipt = (data: { id: string; amount: number; currency: string }) =>
      data as unknown as PaymentBatch['receipts'][0];
    const mockPayment = (data: { id: string; amount: number; currency: string }) =>
      data as unknown as PaymentBatch['payments'][0];

    it('calculates totals correctly for batch with receipts and payments', () => {
      const batch: Partial<PaymentBatch> = {
        receipts: [
          mockReceipt({ id: 'r1', amount: 100000, currency: 'INR' }),
          mockReceipt({ id: 'r2', amount: 50000, currency: 'INR' }),
        ],
        payments: [
          mockPayment({ id: 'p1', amount: 75000, currency: 'INR' }),
          mockPayment({ id: 'p2', amount: 25000, currency: 'INR' }),
        ],
      };

      const result = calculateBatchTotals(batch);

      expect(result.totalReceiptAmount).toBe(150000);
      expect(result.totalPaymentAmount).toBe(100000);
      expect(result.remainingBalance).toBe(50000);
    });

    it('handles empty receipts and payments', () => {
      const batch: Partial<PaymentBatch> = {
        receipts: [],
        payments: [],
      };

      const result = calculateBatchTotals(batch);

      expect(result.totalReceiptAmount).toBe(0);
      expect(result.totalPaymentAmount).toBe(0);
      expect(result.remainingBalance).toBe(0);
    });

    it('handles undefined receipts and payments', () => {
      const batch: Partial<PaymentBatch> = {};

      const result = calculateBatchTotals(batch);

      expect(result.totalReceiptAmount).toBe(0);
      expect(result.totalPaymentAmount).toBe(0);
      expect(result.remainingBalance).toBe(0);
    });

    it('calculates negative balance when payments exceed receipts', () => {
      const batch: Partial<PaymentBatch> = {
        receipts: [mockReceipt({ id: 'r1', amount: 50000, currency: 'INR' })],
        payments: [mockPayment({ id: 'p1', amount: 75000, currency: 'INR' })],
      };

      const result = calculateBatchTotals(batch);

      expect(result.totalReceiptAmount).toBe(50000);
      expect(result.totalPaymentAmount).toBe(75000);
      expect(result.remainingBalance).toBe(-25000);
    });
  });

  describe('addBatchPayment validation', () => {
    const validPaymentInput: AddBatchPaymentInput = {
      payeeType: 'VENDOR',
      entityId: 'vendor-1',
      entityName: 'Test Vendor',
      amount: 50000,
      currency: 'INR',
    };

    it('throws error when batch is not found', async () => {
      transactionMockDocData = {
        exists: false,
      };

      await expect(addBatchPayment(mockDb, 'batch-123', validPaymentInput)).rejects.toThrow(
        'Payment batch not found'
      );
    });

    it('throws error when batch is not in DRAFT status', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          batchNumber: 'PB-2024-001',
          receipts: [],
          payments: [],
        }),
      };

      await expect(addBatchPayment(mockDb, 'batch-123', validPaymentInput)).rejects.toThrow(
        'Cannot modify a batch that is not in DRAFT status'
      );
    });

    it('throws error when payment amount is zero', async () => {
      // Amount validation happens before transaction
      const zeroAmountInput = { ...validPaymentInput, amount: 0 };

      await expect(addBatchPayment(mockDb, 'batch-123', zeroAmountInput)).rejects.toThrow(
        'Payment amount must be positive'
      );
    });

    it('throws error when payment amount is negative', async () => {
      const negativeAmountInput = { ...validPaymentInput, amount: -5000 };

      await expect(addBatchPayment(mockDb, 'batch-123', negativeAmountInput)).rejects.toThrow(
        'Payment amount must be positive'
      );
    });

    it('throws error when TDS amount is negative', async () => {
      const negativeTdsInput = { ...validPaymentInput, tdsAmount: -500 };

      await expect(addBatchPayment(mockDb, 'batch-123', negativeTdsInput)).rejects.toThrow(
        'TDS amount cannot be negative'
      );
    });

    it('throws error when TDS exceeds payment amount', async () => {
      const excessiveTdsInput = { ...validPaymentInput, amount: 10000, tdsAmount: 15000 };

      await expect(addBatchPayment(mockDb, 'batch-123', excessiveTdsInput)).rejects.toThrow(
        'Net payable amount must be positive'
      );
    });

    it('throws error when TDS equals payment amount (zero net payable)', async () => {
      const zeroNetPayableInput = { ...validPaymentInput, amount: 10000, tdsAmount: 10000 };

      await expect(addBatchPayment(mockDb, 'batch-123', zeroNetPayableInput)).rejects.toThrow(
        'Net payable amount must be positive'
      );
    });

    it('successfully adds payment with valid TDS', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'DRAFT',
          batchNumber: 'PB-2024-001',
          receipts: [{ id: 'r1', amount: 100000, currency: 'INR' }],
          payments: [],
          totalReceiptAmount: 100000,
          totalPaymentAmount: 0,
          remainingBalance: 100000,
        }),
      };

      const validTdsInput = {
        ...validPaymentInput,
        amount: 10000,
        tdsAmount: 1000,
        tdsSection: '194C',
      };

      const result = await addBatchPayment(mockDb, 'batch-123', validTdsInput);

      expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockTransactionUpdate.mock.calls[0][1];

      // Verify the payment was added with correct netPayable
      expect(updateCall.payments).toHaveLength(1);
      expect(updateCall.payments[0].amount).toBe(10000);
      expect(updateCall.payments[0].tdsAmount).toBe(1000);
      expect(updateCall.payments[0].netPayable).toBe(9000);
      expect(updateCall.payments[0].tdsSection).toBe('194C');

      // Verify returned payment object
      expect(result.amount).toBe(10000);
      expect(result.tdsAmount).toBe(1000);
      expect(result.netPayable).toBe(9000);
    });

    it('successfully adds payment without TDS', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'DRAFT',
          batchNumber: 'PB-2024-001',
          receipts: [{ id: 'r1', amount: 100000, currency: 'INR' }],
          payments: [],
          totalReceiptAmount: 100000,
          totalPaymentAmount: 0,
          remainingBalance: 100000,
        }),
      };

      const result = await addBatchPayment(mockDb, 'batch-123', validPaymentInput);

      expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockTransactionUpdate.mock.calls[0][1];

      // Verify the payment was added with netPayable = amount
      expect(updateCall.payments).toHaveLength(1);
      expect(updateCall.payments[0].amount).toBe(50000);
      expect(updateCall.payments[0].netPayable).toBe(50000);

      // Verify returned payment object
      expect(result.amount).toBe(50000);
      expect(result.netPayable).toBe(50000);
    });
  });

  describe('batch status transitions', () => {
    it('prevents modification of APPROVED batch', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'APPROVED',
          batchNumber: 'PB-2024-001',
          receipts: [],
          payments: [],
        }),
      };

      await expect(
        addBatchPayment(mockDb, 'batch-123', {
          payeeType: 'VENDOR',
          entityId: 'vendor-1',
          entityName: 'Test Vendor',
          amount: 50000,
          currency: 'INR',
        })
      ).rejects.toThrow('Cannot modify a batch that is not in DRAFT status');
    });

    it('prevents modification of COMPLETED batch', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'COMPLETED',
          batchNumber: 'PB-2024-001',
          receipts: [],
          payments: [],
        }),
      };

      await expect(
        addBatchPayment(mockDb, 'batch-123', {
          payeeType: 'VENDOR',
          entityId: 'vendor-1',
          entityName: 'Test Vendor',
          amount: 50000,
          currency: 'INR',
        })
      ).rejects.toThrow('Cannot modify a batch that is not in DRAFT status');
    });

    it('prevents modification of EXECUTING batch', async () => {
      transactionMockDocData = {
        exists: true,
        data: () => ({
          status: 'EXECUTING',
          batchNumber: 'PB-2024-001',
          receipts: [],
          payments: [],
        }),
      };

      await expect(
        addBatchPayment(mockDb, 'batch-123', {
          payeeType: 'VENDOR',
          entityId: 'vendor-1',
          entityName: 'Test Vendor',
          amount: 50000,
          currency: 'INR',
        })
      ).rejects.toThrow('Cannot modify a batch that is not in DRAFT status');
    });
  });
});
