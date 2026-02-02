/**
 * Transaction Delete Service Tests
 *
 * Tests for soft delete, restore, and hard delete of transactions
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
    DELETED_TRANSACTIONS: 'deletedTransactions',
  },
}));

// Mock Firebase Firestore
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  deleteField: jest.fn(() => '__DELETE_FIELD__'),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
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
  canSoftDelete,
  softDeleteTransaction,
  restoreTransaction,
  hardDeleteTransaction,
  getTransactionTypeLabel,
} from './transactionDeleteService';
import type { Firestore } from 'firebase/firestore';

describe('transactionDeleteService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- canSoftDelete ---

  describe('canSoftDelete', () => {
    it('returns canDelete: true for a normal transaction', () => {
      const result = canSoftDelete({ status: 'DRAFT' });
      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns canDelete: true for APPROVED transactions', () => {
      const result = canSoftDelete({ status: 'APPROVED' });
      expect(result.canDelete).toBe(true);
    });

    it('returns canDelete: true for POSTED transactions', () => {
      const result = canSoftDelete({ status: 'POSTED' });
      expect(result.canDelete).toBe(true);
    });

    it('returns canDelete: false for already deleted transactions', () => {
      const result = canSoftDelete({ status: 'DRAFT', isDeleted: true });
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Transaction is already deleted');
    });

    it('returns canDelete: false for VOID transactions', () => {
      const result = canSoftDelete({ status: 'VOID' });
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('Cannot delete a voided transaction');
    });
  });

  // --- softDeleteTransaction ---

  describe('softDeleteTransaction', () => {
    it('soft deletes a transaction successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          type: 'CUSTOMER_INVOICE',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          totalAmount: 5000,
        }),
      });

      const result = await softDeleteTransaction(mockDb, {
        transactionId: 'txn-1',
        reason: 'Test delete',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn-1');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      const updateArgs = mockUpdateDoc.mock.calls[0][1];
      expect(updateArgs.isDeleted).toBe(true);
      expect(updateArgs.deletedBy).toBe('user-1');
      expect(updateArgs.deletionReason).toBe('Test delete');
    });

    it('returns error for non-existent transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await softDeleteTransaction(mockDb, {
        transactionId: 'txn-nonexistent',
        reason: 'Test delete',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    it('returns error for already deleted transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          isDeleted: true,
        }),
      });

      const result = await softDeleteTransaction(mockDb, {
        transactionId: 'txn-deleted',
        reason: 'Test delete',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction is already deleted');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('returns error for VOID transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'VOID',
        }),
      });

      const result = await softDeleteTransaction(mockDb, {
        transactionId: 'txn-void',
        reason: 'Test delete',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete a voided transaction');
    });
  });

  // --- restoreTransaction ---

  describe('restoreTransaction', () => {
    it('restores a soft-deleted transaction successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          isDeleted: true,
          type: 'VENDOR_BILL',
          transactionNumber: 'BILL-001',
          entityName: 'Test Vendor',
          deletionReason: 'Testing',
        }),
      });

      const result = await restoreTransaction(mockDb, {
        transactionId: 'txn-1',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn-1');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      const updateArgs = mockUpdateDoc.mock.calls[0][1];
      expect(updateArgs.isDeleted).toBe('__DELETE_FIELD__');
      expect(updateArgs.deletedAt).toBe('__DELETE_FIELD__');
      expect(updateArgs.deletedBy).toBe('__DELETE_FIELD__');
      expect(updateArgs.deletionReason).toBe('__DELETE_FIELD__');
    });

    it('returns error for non-existent transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await restoreTransaction(mockDb, {
        transactionId: 'txn-nonexistent',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    it('returns error for non-deleted transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          isDeleted: false,
        }),
      });

      const result = await restoreTransaction(mockDb, {
        transactionId: 'txn-active',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction is not deleted');
    });
  });

  // --- hardDeleteTransaction ---

  describe('hardDeleteTransaction', () => {
    it('archives and permanently deletes a soft-deleted transaction', async () => {
      const txnData = {
        status: 'DRAFT',
        isDeleted: true,
        type: 'JOURNAL_ENTRY',
        transactionNumber: 'JE-001',
        entityName: null,
        totalAmount: 10000,
        amount: 10000,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => txnData,
      });

      const result = await hardDeleteTransaction(mockDb, {
        transactionId: 'txn-1',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn-1');
      expect(result.archivedDocId).toBe('txn-1');

      // Verify archive was created
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const archiveData = mockSetDoc.mock.calls[0][1];
      expect(archiveData.originalId).toBe('txn-1');
      expect(archiveData.hardDeletedBy).toBe('user-1');
      expect(archiveData.hardDeletedByName).toBe('Test User');

      // Verify original was deleted
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });

    it('returns error for non-deleted transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          isDeleted: false,
        }),
      });

      const result = await hardDeleteTransaction(mockDb, {
        transactionId: 'txn-active',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only soft-deleted transactions can be permanently deleted');
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('returns error for non-existent transaction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await hardDeleteTransaction(mockDb, {
        transactionId: 'txn-nonexistent',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
  });

  // --- getTransactionTypeLabel ---

  describe('getTransactionTypeLabel', () => {
    it('returns correct labels for known types', () => {
      expect(getTransactionTypeLabel('CUSTOMER_INVOICE')).toBe('Invoice');
      expect(getTransactionTypeLabel('VENDOR_BILL')).toBe('Bill');
      expect(getTransactionTypeLabel('JOURNAL_ENTRY')).toBe('Journal Entry');
      expect(getTransactionTypeLabel('CUSTOMER_PAYMENT')).toBe('Customer Payment');
      expect(getTransactionTypeLabel('VENDOR_PAYMENT')).toBe('Vendor Payment');
      expect(getTransactionTypeLabel('DIRECT_PAYMENT')).toBe('Direct Payment');
      expect(getTransactionTypeLabel('BANK_TRANSFER')).toBe('Bank Transfer');
      expect(getTransactionTypeLabel('EXPENSE_CLAIM')).toBe('Expense Claim');
    });

    it('returns the type string for unknown types', () => {
      expect(getTransactionTypeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    });
  });
});
