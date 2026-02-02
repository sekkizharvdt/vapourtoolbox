/**
 * GL Entry Regeneration Service Tests
 *
 * Tests for regenerating GL entries for customer and vendor payments
 * that are missing them or have incorrect entries.
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

const mockGenerateCustomerPaymentGLEntries = jest.fn();
const mockGenerateVendorPaymentGLEntries = jest.fn();
jest.mock('./glEntry/generators', () => ({
  generateCustomerPaymentGLEntries: (...args: unknown[]) =>
    mockGenerateCustomerPaymentGLEntries(...args),
  generateVendorPaymentGLEntries: (...args: unknown[]) =>
    mockGenerateVendorPaymentGLEntries(...args),
}));

import {
  regenerateCustomerPaymentGL,
  regenerateVendorPaymentGL,
  regeneratePaymentGL,
} from './glEntryRegeneration';
import type { Firestore } from 'firebase/firestore';

describe('glEntryRegeneration', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('regenerateCustomerPaymentGL', () => {
    it('returns error when payment is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await regenerateCustomerPaymentGL(mockDb, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
      expect(result.entries).toEqual([]);
    });

    it('returns error when transaction is not a customer payment', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'VENDOR_PAYMENT', amount: 1000 }),
      });

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction is not a customer payment');
    });

    it('returns error when no bank account is specified', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'CUSTOMER_PAYMENT',
          amount: 1000,
          bankAccountId: undefined,
          depositedToBankAccountId: undefined,
        }),
      });

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No bank account specified');
    });

    it('uses depositedToBankAccountId as fallback', async () => {
      const mockEntries = [
        { accountId: 'bank-1', debit: 1000, credit: 0 },
        { accountId: 'ar-1', debit: 0, credit: 1000 },
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'CUSTOMER_PAYMENT',
          totalAmount: 1000,
          bankAccountId: undefined,
          depositedToBankAccountId: 'bank-fallback',
          projectId: 'proj-1',
        }),
      });

      mockGenerateCustomerPaymentGLEntries.mockResolvedValue({
        success: true,
        entries: mockEntries,
        errors: [],
      });

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(true);
      expect(mockGenerateCustomerPaymentGLEntries).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ bankAccountId: 'bank-fallback' })
      );
    });

    it('returns error when GL generation fails', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'CUSTOMER_PAYMENT',
          totalAmount: 1000,
          bankAccountId: 'bank-1',
          projectId: 'proj-1',
        }),
      });

      mockGenerateCustomerPaymentGLEntries.mockResolvedValue({
        success: false,
        entries: [],
        errors: ['Bank account not found', 'AR account missing'],
      });

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found; AR account missing');
    });

    it('successfully regenerates and updates GL entries', async () => {
      const mockEntries = [
        { accountId: 'bank-1', debit: 5000, credit: 0 },
        { accountId: 'ar-1', debit: 0, credit: 5000 },
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'CUSTOMER_PAYMENT',
          totalAmount: 5000,
          amount: 3000,
          bankAccountId: 'bank-1',
          projectId: 'proj-1',
        }),
      });

      mockGenerateCustomerPaymentGLEntries.mockResolvedValue({
        success: true,
        entries: mockEntries,
        errors: [],
      });

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockEntries);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entries: mockEntries })
      );
    });

    it('uses totalAmount over amount when both present', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'CUSTOMER_PAYMENT',
          totalAmount: 5000,
          amount: 3000,
          bankAccountId: 'bank-1',
          projectId: 'proj-1',
        }),
      });

      mockGenerateCustomerPaymentGLEntries.mockResolvedValue({
        success: true,
        entries: [],
        errors: [],
      });

      await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(mockGenerateCustomerPaymentGLEntries).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ amount: 5000 })
      );
    });

    it('handles unexpected errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore unavailable');
    });

    it('handles non-Error throws', async () => {
      mockGetDoc.mockRejectedValue('string error');

      const result = await regenerateCustomerPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('regenerateVendorPaymentGL', () => {
    it('returns error when payment is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await regenerateVendorPaymentGL(mockDb, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });

    it('returns error when transaction is not a vendor payment', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'CUSTOMER_PAYMENT', amount: 1000 }),
      });

      const result = await regenerateVendorPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction is not a vendor payment');
    });

    it('returns error when no bank account is specified', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'VENDOR_PAYMENT',
          amount: 1000,
          bankAccountId: undefined,
        }),
      });

      const result = await regenerateVendorPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No bank account specified');
    });

    it('successfully regenerates vendor payment GL entries', async () => {
      const mockEntries = [
        { accountId: 'ap-1', debit: 8000, credit: 0 },
        { accountId: 'bank-1', debit: 0, credit: 8000 },
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'VENDOR_PAYMENT',
          totalAmount: 8000,
          bankAccountId: 'bank-1',
          projectId: 'proj-1',
        }),
      });

      mockGenerateVendorPaymentGLEntries.mockResolvedValue({
        success: true,
        entries: mockEntries,
        errors: [],
      });

      const result = await regenerateVendorPaymentGL(mockDb, 'payment-1');

      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockEntries);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('uses costCentreId as fallback for projectId', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'VENDOR_PAYMENT',
          totalAmount: 1000,
          bankAccountId: 'bank-1',
          projectId: undefined,
          costCentreId: 'cc-1',
        }),
      });

      mockGenerateVendorPaymentGLEntries.mockResolvedValue({
        success: true,
        entries: [],
        errors: [],
      });

      await regenerateVendorPaymentGL(mockDb, 'payment-1');

      expect(mockGenerateVendorPaymentGLEntries).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ projectId: 'cc-1' })
      );
    });
  });

  describe('regeneratePaymentGL', () => {
    it('routes CUSTOMER_PAYMENT to regenerateCustomerPaymentGL', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await regeneratePaymentGL(mockDb, 'payment-1', 'CUSTOMER_PAYMENT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });

    it('routes VENDOR_PAYMENT to regenerateVendorPaymentGL', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await regeneratePaymentGL(mockDb, 'payment-1', 'VENDOR_PAYMENT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });
});
