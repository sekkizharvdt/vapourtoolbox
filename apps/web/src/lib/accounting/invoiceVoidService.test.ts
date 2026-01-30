/**
 * Invoice Void Service Tests
 *
 * Tests for voiding customer invoices and the void-and-recreate workflow
 */

import type { CustomerInvoice, LedgerEntry } from '@vapour/types';

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
  generateTransactionNumber: jest.fn().mockResolvedValue('INV-2024-0001'),
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
  canVoidInvoice,
  voidInvoice,
  voidAndRecreateInvoice,
  getVoidInvoiceAvailableActions,
} from './invoiceVoidService';
import type { Firestore } from 'firebase/firestore';

describe('invoiceVoidService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canVoidInvoice', () => {
    it('returns canVoid: true for DRAFT invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'DRAFT' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns canVoid: true for PENDING_APPROVAL invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'PENDING_APPROVAL' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(true);
    });

    it('returns canVoid: true for APPROVED invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(true);
    });

    it('returns canVoid: true for UNPAID invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'UNPAID' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(true);
    });

    it('returns canVoid: false for VOID invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'VOID' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Invoice is already voided');
    });

    it('returns canVoid: false for PAID invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'PAID' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe('Cannot void an invoice that has been fully paid');
    });

    it('returns canVoid: false for PARTIALLY_PAID invoices', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'PARTIALLY_PAID' } as CustomerInvoice;
      const result = canVoidInvoice(invoice);
      expect(result.canVoid).toBe(false);
      expect(result.reason).toBe(
        'Cannot void an invoice with partial payments. Reverse payments first.'
      );
    });
  });

  describe('voidInvoice', () => {
    const mockInput = {
      invoiceId: 'invoice-123',
      reason: 'Wrong customer selected',
      userId: 'user-1',
      userName: 'Test User',
    };

    it('returns error when invoice is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
      expect(result.voidedInvoiceId).toBe('invoice-123');
    });

    it('returns error when invoice cannot be voided (PAID status)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'invoice-123',
        data: () => ({
          status: 'APPROVED',
          paymentStatus: 'PAID',
          transactionNumber: 'INV-001',
        }),
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot void an invoice that has been fully paid');
    });

    it('returns error when invoice cannot be voided (PARTIALLY_PAID status)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'invoice-123',
        data: () => ({
          status: 'APPROVED',
          paymentStatus: 'PARTIALLY_PAID',
          transactionNumber: 'INV-001',
        }),
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Cannot void an invoice with partial payments. Reverse payments first.'
      );
    });

    it('successfully voids a DRAFT invoice', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'invoice-123',
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          totalAmount: 10000,
          entries: [],
        }),
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(true);
      expect(result.voidedInvoiceId).toBe('invoice-123');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      // Check the update includes correct fields
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('VOID');
      expect(updateCall.voidedBy).toBe('user-1');
      expect(updateCall.voidedByName).toBe('Test User');
      expect(updateCall.voidReason).toBe('Wrong customer selected');
    });

    it('successfully voids an APPROVED invoice', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'invoice-123',
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          totalAmount: 15000,
          entries: [],
        }),
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(true);
      expect(result.voidedInvoiceId).toBe('invoice-123');
    });

    it('generates reversing entries when voiding an invoice with GL entries', async () => {
      const originalEntries: LedgerEntry[] = [
        {
          accountId: 'acc-1',
          accountCode: '1200',
          accountName: 'Accounts Receivable',
          debit: 11800,
          credit: 0,
          description: 'Invoice to customer',
        },
        {
          accountId: 'acc-2',
          accountCode: '4100',
          accountName: 'Sales Revenue',
          debit: 0,
          credit: 10000,
          description: 'Sales revenue',
        },
        {
          accountId: 'acc-3',
          accountCode: '2201',
          accountName: 'GST Output',
          debit: 0,
          credit: 1800,
          description: 'GST on sales',
        },
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'invoice-123',
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
          entries: originalEntries,
        }),
      });

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(true);

      // Check reversing entries were generated
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      const reversalEntries = updateCall.reversalEntries;

      expect(reversalEntries).toHaveLength(3);

      // First entry: debit becomes credit (Accounts Receivable reversal)
      expect(reversalEntries[0].debit).toBe(0);
      expect(reversalEntries[0].credit).toBe(11800);
      expect(reversalEntries[0].description).toContain('[REVERSAL]');

      // Second entry: credit becomes debit (Sales Revenue reversal)
      expect(reversalEntries[1].debit).toBe(10000);
      expect(reversalEntries[1].credit).toBe(0);
      expect(reversalEntries[1].description).toContain('[REVERSAL]');

      // Third entry: credit becomes debit (GST Output reversal)
      expect(reversalEntries[2].debit).toBe(1800);
      expect(reversalEntries[2].credit).toBe(0);
    });

    it('handles Firestore errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore connection failed'));

      const result = await voidInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore connection failed');
    });
  });

  describe('voidAndRecreateInvoice', () => {
    const mockInput = {
      invoiceId: 'invoice-123',
      reason: 'Wrong customer selected',
      userId: 'user-1',
      userName: 'Test User',
      newCustomerId: 'customer-456',
      newCustomerName: 'Correct Customer Ltd',
    };

    it('successfully voids and recreates an invoice with new customer', async () => {
      // Mock transaction execution - return successful result directly
      mockRunTransaction.mockResolvedValue({
        success: true,
        voidedInvoiceId: 'invoice-123',
        newInvoiceId: 'new-invoice-456',
        newTransactionNumber: 'INV-2024-0001',
      });

      const result = await voidAndRecreateInvoice(mockDb, mockInput);

      expect(result.success).toBe(true);
      expect(result.voidedInvoiceId).toBe('invoice-123');
      expect(result.newInvoiceId).toBe('new-invoice-456');
      expect(result.newTransactionNumber).toBe('INV-2024-0001');
    });

    it('returns error when original invoice is not found', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
        };

        return callback(mockTransaction);
      });

      const result = await voidAndRecreateInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('returns error when invoice cannot be voided (PAID status)', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'invoice-123',
            data: () => ({
              status: 'APPROVED',
              paymentStatus: 'PAID',
              transactionNumber: 'INV-001',
            }),
          }),
        };

        return callback(mockTransaction);
      });

      const result = await voidAndRecreateInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot void an invoice that has been fully paid');
    });

    it('returns error when invoice cannot be voided (PARTIALLY_PAID status)', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'invoice-123',
            data: () => ({
              status: 'APPROVED',
              paymentStatus: 'PARTIALLY_PAID',
              transactionNumber: 'INV-001',
            }),
          }),
        };

        return callback(mockTransaction);
      });

      const result = await voidAndRecreateInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Cannot void an invoice with partial payments. Reverse payments first.'
      );
    });

    it('handles transaction errors gracefully', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Transaction aborted'));

      const result = await voidAndRecreateInvoice(mockDb, mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction aborted');
    });
  });

  describe('getVoidInvoiceAvailableActions', () => {
    it('returns all false when user cannot manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'DRAFT' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, false);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Insufficient permissions');
    });

    it('returns all true for DRAFT invoice when user can manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'DRAFT' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(true);
      expect(result.canVoidAndRecreate).toBe(true);
      expect(result.voidReason).toBeUndefined();
    });

    it('returns all true for APPROVED invoice when user can manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(true);
      expect(result.canVoidAndRecreate).toBe(true);
    });

    it('returns all true for UNPAID invoice when user can manage', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'UNPAID' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(true);
      expect(result.canVoidAndRecreate).toBe(true);
    });

    it('returns all false for PAID invoice even with manage permission', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'PAID' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Cannot void an invoice that has been fully paid');
    });

    it('returns all false for PARTIALLY_PAID invoice even with manage permission', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'APPROVED', paymentStatus: 'PARTIALLY_PAID' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe(
        'Cannot void an invoice with partial payments. Reverse payments first.'
      );
    });

    it('returns all false for VOID invoice', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const invoice = { status: 'VOID' } as CustomerInvoice;
      const result = getVoidInvoiceAvailableActions(invoice, true);

      expect(result.canVoid).toBe(false);
      expect(result.canVoidAndRecreate).toBe(false);
      expect(result.voidReason).toBe('Invoice is already voided');
    });
  });
});
