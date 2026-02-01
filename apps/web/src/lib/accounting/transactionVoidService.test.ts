/**
 * Transaction Void Service Tests
 *
 * Tests for transaction void operations
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id: id || 'new-id', path: `transactions/${id}` })),
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
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

// Mock audit service
jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn(() => ({ userId: 'user-123', userEmail: '', userName: 'User Name' })),
}));

// Mock transaction number generator
jest.mock('./transactionNumberGenerator', () => ({
  generateTransactionNumber: jest.fn().mockResolvedValue('INV-2026-NEW'),
}));

import {
  canVoidTransaction,
  voidTransaction,
  getVoidAvailableActions,
  canVoidInvoice,
  canVoidBill,
} from './transactionVoidService';
import type { Firestore } from 'firebase/firestore';

describe('transactionVoidService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canVoidTransaction', () => {
    it('allows voiding DRAFT transactions', () => {
      const result = canVoidTransaction('CUSTOMER_INVOICE', { status: 'DRAFT' });
      expect(result.canVoid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows voiding PENDING_APPROVAL transactions', () => {
      const result = canVoidTransaction('CUSTOMER_INVOICE', { status: 'PENDING_APPROVAL' });
      expect(result.canVoid).toBe(true);
    });

    it('allows voiding APPROVED transactions', () => {
      const result = canVoidTransaction('VENDOR_BILL', { status: 'APPROVED' });
      expect(result.canVoid).toBe(true);
    });

    it('prevents voiding VOID transactions', () => {
      const result = canVoidTransaction('CUSTOMER_INVOICE', { status: 'VOID' });
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Invoice is already voided');
    });

    it('prevents voiding PAID transactions', () => {
      const result = canVoidTransaction('CUSTOMER_INVOICE', {
        status: 'APPROVED',
        paymentStatus: 'PAID',
      });
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Cannot void an invoice that has been fully paid');
    });

    it('prevents voiding PARTIALLY_PAID transactions', () => {
      const result = canVoidTransaction('VENDOR_BILL', {
        status: 'APPROVED',
        paymentStatus: 'PARTIALLY_PAID',
      });
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe(
        'Cannot void a bill with partial payments. Reverse payments first.'
      );
    });

    it('uses correct article for invoice (an)', () => {
      const result = canVoidTransaction('CUSTOMER_INVOICE', {
        status: 'APPROVED',
        paymentStatus: 'PAID',
      });
      expect(result.reason).toContain('an invoice');
    });

    it('uses correct article for bill (a)', () => {
      const result = canVoidTransaction('VENDOR_BILL', {
        status: 'APPROVED',
        paymentStatus: 'PAID',
      });
      expect(result.reason).toContain('a bill');
    });
  });

  describe('voidTransaction', () => {
    it('voids a transaction successfully', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-2026-001',
          entityName: 'Test Customer',
          totalAmount: 100000,
          entries: [
            { accountId: 'acc-1', debit: 100000, credit: 0, description: 'Revenue' },
            { accountId: 'acc-2', debit: 0, credit: 100000, description: 'Receivable' },
          ],
        }),
      });

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-123',
        reason: 'Duplicate entry',
        userId: 'user-456',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.voidedTransactionId).toBe('txn-123');
      expect(result.error).toBeUndefined();

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('VOID');
      expect(updateCall.voidedBy).toBe('user-456');
      expect(updateCall.voidReason).toBe('Duplicate entry');
      expect(updateCall.reversalEntries).toHaveLength(2);
      // Check reversing entries - debits and credits are swapped
      expect(updateCall.reversalEntries[0].debit).toBe(0);
      expect(updateCall.reversalEntries[0].credit).toBe(100000);
    });

    it('returns error when transaction not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-123',
        reason: 'Test',
        userId: 'user-456',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('returns error when transaction cannot be voided', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          paymentStatus: 'PAID',
          transactionNumber: 'INV-2026-001',
        }),
      });

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-123',
        reason: 'Test',
        userId: 'user-456',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot void an invoice that has been fully paid');
    });

    it('handles transactions without GL entries', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-2026-001',
          entityName: 'Test Customer',
          // No entries field
        }),
      });

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-123',
        reason: 'Cancelling draft',
        userId: 'user-456',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.reversalEntries).toHaveLength(0);
    });
  });

  describe('getVoidAvailableActions', () => {
    it('returns correct actions for voidable transaction with manage permission', () => {
      const result = getVoidAvailableActions(
        'CUSTOMER_INVOICE',
        { status: 'APPROVED' },
        true // canManage
      );

      expect(result.canVoid).toBe(true);
      expect(result.canVoidAndRecreate).toBe(true);
      expect(result.voidReason).toBeUndefined();
    });

    it('returns no permissions without manage permission', () => {
      const result = getVoidAvailableActions(
        'CUSTOMER_INVOICE',
        { status: 'APPROVED' },
        false // canManage
      );

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Insufficient permissions');
    });

    it('returns correct reason when transaction cannot be voided', () => {
      const result = getVoidAvailableActions(
        'VENDOR_BILL',
        { status: 'APPROVED', paymentStatus: 'PAID' },
        true
      );

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toContain('Cannot void');
    });
  });

  describe('voidTransaction - vendor bills', () => {
    it('voids a vendor bill successfully', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'BILL-2026-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Test Vendor',
          totalAmount: 50000,
          entries: [
            { accountId: 'acc-1', debit: 50000, credit: 0, description: 'Expense' },
            { accountId: 'acc-2', debit: 0, credit: 50000, description: 'Payable' },
          ],
        }),
      });

      const result = await voidTransaction(mockDb, 'VENDOR_BILL', {
        transactionId: 'txn-bill-1',
        reason: 'Wrong vendor',
        userId: 'user-1',
        userName: 'User',
      });

      expect(result.success).toBe(true);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('VOID');
      expect(updateCall.voidReason).toBe('Wrong vendor');
    });
  });

  describe('voidTransaction - reversal entries', () => {
    it('prefixes reversal descriptions with [REVERSAL]', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
          entityName: 'Customer',
          entries: [{ accountId: 'a1', debit: 1000, credit: 0, description: 'Sales Revenue' }],
        }),
      });

      await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-1',
        reason: 'Test',
        userId: 'u1',
        userName: 'User',
      });

      const reversalEntries = mockUpdateDoc.mock.calls[0][1].reversalEntries;
      expect(reversalEntries[0].description).toBe('[REVERSAL] Sales Revenue');
    });

    it('swaps debits and credits correctly', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
          entityName: 'Customer',
          entries: [
            { accountId: 'a1', debit: 5000, credit: 0 },
            { accountId: 'a2', debit: 0, credit: 3000 },
            { accountId: 'a3', debit: 0, credit: 2000 },
          ],
        }),
      });

      await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-1',
        reason: 'Test',
        userId: 'u1',
        userName: 'User',
      });

      const reversals = mockUpdateDoc.mock.calls[0][1].reversalEntries;
      expect(reversals[0]).toMatchObject({ debit: 0, credit: 5000 });
      expect(reversals[1]).toMatchObject({ debit: 3000, credit: 0 });
      expect(reversals[2]).toMatchObject({ debit: 2000, credit: 0 });
    });
  });

  describe('voidTransaction - error handling', () => {
    it('catches and returns Firestore errors', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-1',
        reason: 'Test',
        userId: 'u1',
        userName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore unavailable');
    });

    it('returns "Unknown error" for non-Error throws', async () => {
      mockGetDoc.mockRejectedValue('string error');

      const result = await voidTransaction(mockDb, 'CUSTOMER_INVOICE', {
        transactionId: 'txn-1',
        reason: 'Test',
        userId: 'u1',
        userName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('backward compatibility helpers', () => {
    it('canVoidInvoice delegates to canVoidTransaction', () => {
      const result = canVoidInvoice({ status: 'DRAFT' });
      expect(result.canVoid).toBe(true);
    });

    it('canVoidBill delegates to canVoidTransaction', () => {
      const result = canVoidBill({ status: 'VOID' });
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Bill is already voided');
    });
  });
});
