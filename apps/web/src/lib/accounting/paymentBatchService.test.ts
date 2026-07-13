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
    ACCOUNTS: 'accounts',
  },
}));

// Mocks for executeBatch collaborators
const mockCreatePaymentAtomic = jest.fn();
const mockCreateLoan = jest.fn();
const mockGenerateTransactionNumber = jest.fn();

jest.mock('@/lib/firebase/retryOnStaleToken', () => ({
  retryOnStaleToken: <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('@/lib/accounting/transactionNumberGenerator', () => ({
  generateTransactionNumber: (...args: unknown[]) => mockGenerateTransactionNumber(...args),
}));
jest.mock('./paymentHelpers', () => ({
  createPaymentWithAllocationsAtomic: (...args: unknown[]) => mockCreatePaymentAtomic(...args),
}));
jest.mock('./interprojectLoanService', () => ({
  createInterprojectLoan: (...args: unknown[]) => mockCreateLoan(...args),
}));
jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn(() => ({})),
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
  // A real class so `value instanceof Timestamp` is valid (returns false for mock data)
  Timestamp: class MockTimestamp {
    static now() {
      return { seconds: Date.now() / 1000, nanoseconds: 0 };
    }
    static fromDate(date: Date) {
      return { seconds: date.getTime() / 1000, nanoseconds: 0 };
    }
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

import {
  addBatchPayment,
  calculateBatchTotals,
  detectCrossProjectPayments,
  executeBatch,
} from './paymentBatchService';
import type { Firestore } from 'firebase/firestore';
import type { PaymentBatch, AddBatchPaymentInput, BatchPayment } from '@vapour/types';

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

  describe('detectCrossProjectPayments', () => {
    it('detects payments to projects not in receipt sources', () => {
      const batch = {
        receipts: [{ id: 'r1', projectId: 'proj-A', projectName: 'Alpha', amount: 100000 }],
        payments: [{ id: 'p1', projectId: 'proj-B', projectName: 'Beta', amount: 50000 }],
      } as unknown as PaymentBatch;

      const result = detectCrossProjectPayments(batch);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        lendingProjectId: 'proj-A',
        lendingProjectName: 'Alpha',
        borrowingProjectId: 'proj-B',
        borrowingProjectName: 'Beta',
      });
    });

    it('returns empty when all payments match source projects', () => {
      const batch = {
        receipts: [{ id: 'r1', projectId: 'proj-A', projectName: 'Alpha', amount: 100000 }],
        payments: [{ id: 'p1', projectId: 'proj-A', projectName: 'Alpha', amount: 50000 }],
      } as unknown as PaymentBatch;

      expect(detectCrossProjectPayments(batch)).toHaveLength(0);
    });

    it('returns empty when receipts have no project IDs', () => {
      const batch = {
        receipts: [{ id: 'r1', amount: 100000 }],
        payments: [{ id: 'p1', projectId: 'proj-B', amount: 50000 }],
      } as unknown as PaymentBatch;

      expect(detectCrossProjectPayments(batch)).toHaveLength(0);
    });

    it('returns empty when payments have no project IDs', () => {
      const batch = {
        receipts: [{ id: 'r1', projectId: 'proj-A', projectName: 'A', amount: 100000 }],
        payments: [{ id: 'p1', amount: 50000 }],
      } as unknown as PaymentBatch;

      expect(detectCrossProjectPayments(batch)).toHaveLength(0);
    });

    it('handles multiple source projects - only flags outside set', () => {
      const batch = {
        receipts: [
          { id: 'r1', projectId: 'proj-A', projectName: 'A', amount: 50000 },
          { id: 'r2', projectId: 'proj-B', projectName: 'B', amount: 50000 },
        ],
        payments: [
          { id: 'p1', projectId: 'proj-A', amount: 30000 },
          { id: 'p2', projectId: 'proj-B', amount: 30000 },
          { id: 'p3', projectId: 'proj-C', projectName: 'C', amount: 20000 },
        ],
      } as unknown as PaymentBatch;

      const result = detectCrossProjectPayments(batch);
      expect(result).toHaveLength(1);
      expect(result[0]!.borrowingProjectId).toBe('proj-C');
      expect(result[0]!.lendingProjectId).toBe('proj-A');
    });

    it('uses projectId as fallback when projectName is missing', () => {
      const batch = {
        receipts: [{ id: 'r1', projectId: 'proj-A', amount: 100000 }],
        payments: [{ id: 'p1', projectId: 'proj-B', amount: 50000 }],
      } as unknown as PaymentBatch;

      const result = detectCrossProjectPayments(batch);
      expect(result[0]!.lendingProjectName).toBe('proj-A');
      expect(result[0]!.borrowingProjectName).toBe('proj-B');
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

  describe('executeBatch', () => {
    const executor = { uid: 'executor-1', email: 'x@y.z', displayName: 'Executor' };

    /** Live in-memory batch doc that getDoc/runTransaction/updateDoc all share */
    let batchDoc: Record<string, unknown>;

    const basePayment = (overrides: Partial<BatchPayment>): BatchPayment => ({
      id: 'p1',
      payeeType: 'VENDOR',
      entityId: 'vendor-1',
      entityName: 'Vendor One',
      amount: 10000,
      currency: 'INR',
      status: 'PENDING',
      ...overrides,
    });

    const setupBatch = (overrides: Partial<Record<string, unknown>> = {}) => {
      batchDoc = {
        batchNumber: 'PB-2026-0001',
        status: 'APPROVED',
        bankAccountId: 'bank-1',
        bankAccountName: 'HDFC Current',
        receipts: [],
        payments: [basePayment({ id: 'p1' })],
        totalReceiptAmount: 50000,
        totalPaymentAmount: 10000,
        remainingBalance: 40000,
        createdBy: 'creator-1',
        createdAt: { seconds: 1, nanoseconds: 0 },
        ...overrides,
      };

      // getDoc serves the batch doc, the bank account, and any linked bill
      mockGetDoc.mockImplementation((ref: { id: string }) => {
        if (ref.id === 'batch-1') {
          return Promise.resolve({ exists: () => true, id: 'batch-1', data: () => batchDoc });
        }
        if (ref.id === 'bank-1') {
          return Promise.resolve({
            exists: () => true,
            id: 'bank-1',
            data: () => ({ name: 'HDFC Current', isBankAccount: true }),
          });
        }
        if (ref.id === 'bill-1') {
          return Promise.resolve({
            exists: () => true,
            id: 'bill-1',
            data: () => ({ baseAmount: 10000, totalAmount: 10000, amountPaid: 0 }),
          });
        }
        return Promise.resolve({ exists: () => false, data: () => ({}) });
      });

      // runTransaction reads/writes the live batch doc
      transactionMockDocData = { exists: true, data: () => batchDoc };
      mockTransactionUpdate.mockImplementation((_ref, patch) => Object.assign(batchDoc, patch));
      mockUpdateDoc.mockImplementation((_ref, patch) => {
        Object.assign(batchDoc, patch);
        return Promise.resolve(undefined);
      });

      mockGenerateTransactionNumber.mockResolvedValue('VP/2026/0042');
      mockCreatePaymentAtomic.mockResolvedValue('txn-1');
      mockCreateLoan.mockResolvedValue({ success: true, loanId: 'loan-1' });
    };

    it('rejects execution from an invalid status', async () => {
      setupBatch({ status: 'DRAFT' });
      await expect(executeBatch(mockDb, 'batch-1', executor)).rejects.toThrow(/DRAFT/);
      expect(mockCreatePaymentAtomic).not.toHaveBeenCalled();
    });

    it('rejects execution without a real bank account', async () => {
      setupBatch({ bankAccountId: 'primary-bank' });
      await expect(executeBatch(mockDb, 'batch-1', executor)).rejects.toThrow(
        /Select the bank account/
      );
    });

    it('executes pending payments, marks them PAID, and completes the batch', async () => {
      setupBatch({
        payments: [
          basePayment({ id: 'p1', linkedType: 'VENDOR_BILL', linkedId: 'bill-1' }),
          basePayment({ id: 'p2', entityId: 'vendor-2', entityName: 'Vendor Two' }),
        ],
      });

      const result = await executeBatch(mockDb, 'batch-1', executor);

      expect(result.paid).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockCreatePaymentAtomic).toHaveBeenCalledTimes(2);

      // Bill-linked payment carries a validated allocation
      const [, paymentData, allocations] = mockCreatePaymentAtomic.mock.calls[0]!;
      expect(paymentData.type).toBe('VENDOR_PAYMENT');
      expect(paymentData.status).toBe('POSTED');
      expect(paymentData.bankAccountId).toBe('bank-1');
      expect(allocations).toHaveLength(1);
      expect(allocations[0].invoiceId).toBe('bill-1');
      expect(allocations[0].allocatedAmount).toBe(10000);

      const payments = batchDoc.payments as BatchPayment[];
      expect(payments.every((p) => p.status === 'PAID')).toBe(true);
      expect(payments.every((p) => p.paidTransactionId === 'txn-1')).toBe(true);
      expect(batchDoc.status).toBe('COMPLETED');
    });

    it('marks a failing payment FAILED with the real error and does not complete the batch', async () => {
      setupBatch({
        payments: [
          basePayment({ id: 'p1' }),
          basePayment({ id: 'p2', entityId: 'vendor-2', entityName: 'Vendor Two' }),
        ],
      });
      mockCreatePaymentAtomic
        .mockResolvedValueOnce('txn-1')
        .mockRejectedValueOnce(new Error('Invalid allocation for bill-9: exceeds outstanding'));

      const result = await executeBatch(mockDb, 'batch-1', executor);

      expect(result.paid).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]!.error).toContain('exceeds outstanding');

      const payments = batchDoc.payments as BatchPayment[];
      expect(payments.find((p) => p.id === 'p2')!.status).toBe('FAILED');
      expect(payments.find((p) => p.id === 'p2')!.errorMessage).toContain('exceeds outstanding');
      expect(batchDoc.status).toBe('EXECUTING'); // resumable, not COMPLETED
    });

    it('is idempotent: resuming skips PAID entries and only pays the rest', async () => {
      setupBatch({
        status: 'EXECUTING',
        payments: [
          basePayment({ id: 'p1', status: 'PAID', paidTransactionId: 'txn-old' }),
          basePayment({ id: 'p2', entityId: 'vendor-2', entityName: 'Vendor Two' }),
        ],
      });

      const result = await executeBatch(mockDb, 'batch-1', executor);

      expect(result.alreadyPaid).toBe(1);
      expect(result.paid).toBe(1);
      expect(mockCreatePaymentAtomic).toHaveBeenCalledTimes(1);
      const payments = batchDoc.payments as BatchPayment[];
      expect(payments.find((p) => p.id === 'p1')!.paidTransactionId).toBe('txn-old');
      expect(batchDoc.status).toBe('COMPLETED');
    });

    it('fails a payment with no linked entity instead of creating an unattributable transaction', async () => {
      setupBatch({
        payments: [basePayment({ id: 'p1', entityId: undefined })],
      });

      const result = await executeBatch(mockDb, 'batch-1', executor);

      expect(result.failed).toBe(1);
      expect(result.errors[0]!.error).toContain('no linked entity');
      expect(mockCreatePaymentAtomic).not.toHaveBeenCalled();
    });

    it('creates an interproject loan for a paid cross-project payment', async () => {
      setupBatch({
        receipts: [
          {
            id: 'r1',
            sourceType: 'CUSTOMER_PAYMENT',
            description: 'Receipt from Project A',
            amount: 50000,
            currency: 'INR',
            projectId: 'proj-A',
            projectName: 'Project A',
            receiptDate: '2026-07-01',
          },
        ],
        payments: [basePayment({ id: 'p1', projectId: 'proj-B', projectName: 'Project B' })],
      });

      const result = await executeBatch(mockDb, 'batch-1', executor);

      expect(result.loansCreated).toBe(1);
      expect(mockCreateLoan).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          lendingProjectId: 'proj-A',
          borrowingProjectId: 'proj-B',
          principalAmount: 10000,
          interestRate: 0,
        })
      );
      const payments = batchDoc.payments as BatchPayment[];
      expect(payments[0]!.interprojectLoanId).toBe('loan-1');
    });
  });
});
