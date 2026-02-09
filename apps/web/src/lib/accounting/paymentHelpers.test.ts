/**
 * Payment Helpers Tests
 *
 * Tests for payment allocation and GL entry validation
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  doc: jest.fn((_db, collection, id) => ({ id, path: `${collection}/${id || 'new'}` })),
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn((...args: unknown[]) => args[0]),
  where: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({
      totalAmount: 10000,
      amountPaid: 0,
      status: 'UNPAID',
    }),
  }),
  getDocs: jest.fn().mockResolvedValue({ forEach: jest.fn() }),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

// Mock GL entry generator
jest.mock('./glEntry', () => ({
  generateVendorPaymentGLEntries: jest.fn(),
  generateCustomerPaymentGLEntries: jest.fn(),
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

import { createPaymentWithAllocationsAtomic } from './paymentHelpers';
import { generateVendorPaymentGLEntries } from './glEntry';
import { Timestamp, type Firestore } from 'firebase/firestore';

describe('paymentHelpers', () => {
  describe('createPaymentWithAllocationsAtomic', () => {
    const mockDb = {} as unknown as Firestore;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('generates and validates GL entries before creating payment', async () => {
      const mockGLResult = {
        success: true,
        entries: [
          {
            accountId: 'acc-payable',
            accountCode: '2100',
            accountName: 'Accounts Payable',
            debit: 10000,
            credit: 0,
            description: 'Payment to vendor',
          },
          {
            accountId: 'bank-account',
            accountCode: '1100',
            accountName: 'Bank Account',
            debit: 0,
            credit: 10000,
            description: 'Payment made',
          },
        ],
        totalDebit: 10000,
        totalCredit: 10000,
        isBalanced: true,
        errors: [],
      };

      (generateVendorPaymentGLEntries as jest.Mock).mockResolvedValue(mockGLResult);

      const paymentData = {
        type: 'VENDOR_PAYMENT',
        transactionNumber: 'PAY-001',
        transactionDate: Timestamp.now(),
        amount: 10000,
        currency: 'INR',
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: 'bank-001',
        entityId: 'vendor-001',
        description: 'Test payment',
        status: 'POSTED',
        date: Timestamp.now(),
      };

      const allocations = [
        {
          invoiceId: 'bill-001',
          invoiceNumber: 'BILL-001',
          originalAmount: 10000,
          allocatedAmount: 10000,
          remainingAmount: 0,
        },
      ];

      await createPaymentWithAllocationsAtomic(mockDb, paymentData, allocations);

      // Verify GL entry generation was called
      expect(generateVendorPaymentGLEntries).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          amount: 10000,
          transactionNumber: 'PAY-001',
          bankAccountId: 'bank-001',
        })
      );
    });

    it('rejects payment when GL entries are unbalanced', async () => {
      const mockGLResult = {
        success: false,
        entries: [
          {
            accountId: 'acc-payable',
            accountCode: '2100',
            accountName: 'Accounts Payable',
            debit: 10000,
            credit: 0,
            description: 'Payment to vendor',
          },
          {
            accountId: 'bank-account',
            accountCode: '1100',
            accountName: 'Bank Account',
            debit: 0,
            credit: 9000, // UNBALANCED!
            description: 'Payment made',
          },
        ],
        totalDebit: 10000,
        totalCredit: 9000,
        isBalanced: false,
        errors: ['GL entries are not balanced: Debits (10000.00) ≠ Credits (9000.00)'],
      };

      (generateVendorPaymentGLEntries as jest.Mock).mockResolvedValue(mockGLResult);

      const paymentData = {
        type: 'VENDOR_PAYMENT',
        transactionNumber: 'PAY-002',
        amount: 10000,
        currency: 'INR',
        entityId: 'vendor-001',
        status: 'POSTED',
      };

      // Should throw error due to unbalanced entries
      await expect(createPaymentWithAllocationsAtomic(mockDb, paymentData, [])).rejects.toThrow(
        /GL entry generation failed/
      );
    });

    it('prevents payment creation without GL validation', async () => {
      // This test ensures that payments MUST go through GL validation
      // Before the fix, RecordVendorPaymentDialog bypassed this by using addDoc directly

      const paymentData = {
        type: 'VENDOR_PAYMENT',
        transactionNumber: 'PAY-003',
        amount: 5000,
        currency: 'INR',
        entityId: 'vendor-001',
        entries: [], // Empty entries array (what the old code was doing)
        status: 'POSTED',
      };

      // The atomic function should ALWAYS generate GL entries
      const mockGLResult = {
        success: true,
        entries: [
          { accountId: 'acc-1', debit: 5000, credit: 0, description: 'Test' },
          { accountId: 'acc-2', debit: 0, credit: 5000, description: 'Test' },
        ],
        totalDebit: 5000,
        totalCredit: 5000,
        isBalanced: true,
        errors: [],
      };

      (generateVendorPaymentGLEntries as jest.Mock).mockResolvedValue(mockGLResult);

      await createPaymentWithAllocationsAtomic(mockDb, paymentData, []);

      // Verify that GL generation was called even though entries[] was empty
      expect(generateVendorPaymentGLEntries).toHaveBeenCalled();
    });
  });
});
