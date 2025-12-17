/**
 * Bill Void Service Tests
 *
 * Tests for voiding vendor bills and the void-and-recreate workflow
 */

import type { VendorBill, LedgerEntry } from '@vapour/types';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `transactions/${id}` })),
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

// Mock transaction number generator
jest.mock('./transactionNumberGenerator', () => ({
  generateTransactionNumber: jest.fn().mockResolvedValue('BILL-2024-0001'),
}));

// Mock audit logging
jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn().mockReturnValue({
    userId: 'user-1',
    tenantId: '',
    userName: 'Test User',
  }),
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

import {
  canVoidBill,
  voidBill,
  voidAndRecreateBill,
  getVoidAvailableActions,
} from './billVoidService';
import type { Firestore } from 'firebase/firestore';

describe('billVoidService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canVoidBill', () => {
    it('returns canVoid: true for DRAFT bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'DRAFT' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns canVoid: true for PENDING_APPROVAL bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'PENDING_APPROVAL' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(true);
    });

    it('returns canVoid: true for APPROVED bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'APPROVED' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(true);
    });

    it('returns canVoid: false for VOID bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'VOID' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Bill is already voided');
    });

    it('returns canVoid: false for PAID bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'PAID' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Cannot void a bill that has been fully paid');
    });

    it('returns canVoid: false for PARTIALLY_PAID bills', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'PARTIALLY_PAID' } as VendorBill;
      const result = canVoidBill(bill);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe(
        'Cannot void a bill with partial payments. Reverse payments first.'
      );
    });
  });

  describe('voidBill', () => {
    const mockInput = {
      billId: 'bill-123',
      reason: 'Wrong vendor selected',
      userId: 'user-1',
      userName: 'Test User',
    };

    it('returns error when bill is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await voidBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bill not found');
      expect(result.voidedBillId).toBe('bill-123');
    });

    it('returns error when bill cannot be voided (PAID status)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bill-123',
        data: () => ({
          status: 'PAID',
          transactionNumber: 'BILL-001',
        }),
      });

      const result = await voidBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot void a bill that has been fully paid');
    });

    it('successfully voids a DRAFT bill', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bill-123',
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'INV-001',
          entityName: 'Test Vendor',
          totalAmount: 10000,
          entries: [],
        }),
      });

      const result = await voidBill(mockDb, mockInput);

      expect(result.success).toBe(true);
      expect(result.voidedBillId).toBe('bill-123');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      // Check the update includes correct fields
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('VOID');
      expect(updateCall.voidedBy).toBe('user-1');
      expect(updateCall.voidedByName).toBe('Test User');
      expect(updateCall.voidReason).toBe('Wrong vendor selected');
    });

    it('generates reversing entries when voiding a bill with GL entries', async () => {
      const originalEntries: LedgerEntry[] = [
        {
          accountId: 'acc-1',
          accountCode: '2100',
          accountName: 'Accounts Payable',
          debit: 0,
          credit: 10000,
          description: 'Bill from vendor',
        },
        {
          accountId: 'acc-2',
          accountCode: '5100',
          accountName: 'Purchases',
          debit: 10000,
          credit: 0,
          description: 'Purchase expense',
        },
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bill-123',
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'BILL-001',
          entries: originalEntries,
        }),
      });

      const result = await voidBill(mockDb, mockInput);

      expect(result.success).toBe(true);

      // Check reversing entries were generated
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      const reversalEntries = updateCall.reversalEntries;

      expect(reversalEntries).toHaveLength(2);
      // First entry: credit becomes debit
      expect(reversalEntries[0].debit).toBe(10000);
      expect(reversalEntries[0].credit).toBe(0);
      expect(reversalEntries[0].description).toContain('[REVERSAL]');
      // Second entry: debit becomes credit
      expect(reversalEntries[1].debit).toBe(0);
      expect(reversalEntries[1].credit).toBe(10000);
    });

    it('handles Firestore errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore connection failed'));

      const result = await voidBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore connection failed');
    });
  });

  describe('voidAndRecreateBill', () => {
    const mockInput = {
      billId: 'bill-123',
      reason: 'Wrong vendor selected',
      userId: 'user-1',
      userName: 'Test User',
      newVendorId: 'vendor-456',
      newVendorName: 'Correct Vendor Inc',
    };

    it('successfully voids and recreates a bill with new vendor', async () => {
      // Mock transaction execution - return successful result directly
      mockRunTransaction.mockResolvedValue({
        success: true,
        voidedBillId: 'bill-123',
        newBillId: 'new-bill-456',
        newTransactionNumber: 'BILL-2024-0001',
      });

      const result = await voidAndRecreateBill(mockDb, mockInput);

      expect(result.success).toBe(true);
      expect(result.voidedBillId).toBe('bill-123');
      expect(result.newBillId).toBe('new-bill-456');
      expect(result.newTransactionNumber).toBe('BILL-2024-0001');
    });

    it('returns error when original bill is not found', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
        };

        return callback(mockTransaction);
      });

      const result = await voidAndRecreateBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bill not found');
    });

    it('returns error when bill cannot be voided', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'bill-123',
            data: () => ({
              status: 'PAID',
              transactionNumber: 'BILL-001',
            }),
          }),
        };

        return callback(mockTransaction);
      });

      const result = await voidAndRecreateBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot void a bill that has been fully paid');
    });

    it('handles transaction errors gracefully', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Transaction aborted'));

      const result = await voidAndRecreateBill(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction aborted');
    });
  });

  describe('getVoidAvailableActions', () => {
    it('returns all false when user cannot manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'DRAFT' } as VendorBill;
      const result = getVoidAvailableActions(bill, false);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Insufficient permissions');
    });

    it('returns all true for DRAFT bill when user can manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'DRAFT' } as VendorBill;
      const result = getVoidAvailableActions(bill, true);

      expect(result.canVoid).toBe(true);
      expect(result.canVoidAndRecreate).toBe(true);
      expect(result.voidReason).toBeUndefined();
    });

    it('returns all false for PAID bill even with manage permission', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'PAID' } as VendorBill;
      const result = getVoidAvailableActions(bill, true);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Cannot void a bill that has been fully paid');
    });

    it('returns all false for VOID bill', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const bill = { status: 'VOID' } as VendorBill;
      const result = getVoidAvailableActions(bill, true);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Bill is already voided');
    });
  });
});
