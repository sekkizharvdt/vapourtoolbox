/**
 * Invoice Approval Service Tests
 *
 * Tests for customer invoice approval workflow: submit, approve, reject
 */

import type { TransactionStatus } from '@vapour/types';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `transactions/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

// Mock task notification service
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: jest.fn().mockResolvedValue(undefined),
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
  submitInvoiceForApproval,
  approveInvoice,
  rejectInvoice,
  getInvoiceAvailableActions,
} from './invoiceApprovalService';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import type { Firestore } from 'firebase/firestore';

describe('invoiceApprovalService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitInvoiceForApproval', () => {
    it('successfully submits a DRAFT invoice for approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          approvalHistory: [],
        }),
      });

      await submitInvoiceForApproval(
        mockDb,
        'invoice-123',
        'approver-1',
        'Approver Name',
        'user-1',
        'Submitter Name',
        'Please review'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');
      expect(updateCall.submittedByUserId).toBe('user-1');
      expect(updateCall.assignedApproverId).toBe('approver-1');
      expect(updateCall.approvalHistory).toHaveLength(1);
      expect(updateCall.approvalHistory[0].action).toBe('SUBMITTED');

      // Check task notification was created
      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'actionable',
          category: 'INVOICE_SUBMITTED',
          userId: 'approver-1',
        })
      );
    });

    it('throws error when invoice is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        submitInvoiceForApproval(
          mockDb,
          'invoice-123',
          'approver-1',
          'Approver Name',
          'user-1',
          'Submitter Name'
        )
      ).rejects.toThrow('Invoice not found');
    });

    it('throws error when invoice is not in DRAFT status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
        }),
      });

      await expect(
        submitInvoiceForApproval(
          mockDb,
          'invoice-123',
          'approver-1',
          'Approver Name',
          'user-1',
          'Submitter Name'
        )
      ).rejects.toThrow('Cannot submit invoice with status: APPROVED');
    });

    it('handles submission without comments', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          approvalHistory: [],
        }),
      });

      await submitInvoiceForApproval(
        mockDb,
        'invoice-123',
        'approver-1',
        'Approver Name',
        'user-1',
        'Submitter Name'
        // No comments
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.approvalHistory[0].comments).toBeUndefined();
    });
  });

  describe('approveInvoice', () => {
    it('successfully approves a PENDING_APPROVAL invoice', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          submittedByUserId: 'user-1',
          approvalHistory: [{ action: 'SUBMITTED', userId: 'user-1' }],
        }),
      });

      await approveInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name', 'Looks good');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('APPROVED');
      expect(updateCall.approvedBy).toBe('approver-1');
      expect(updateCall.approvalHistory).toHaveLength(2);
      expect(updateCall.approvalHistory[1].action).toBe('APPROVED');
      expect(updateCall.approvalHistory[1].comments).toBe('Looks good');

      // Check notification was sent to submitter
      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'informational',
          category: 'INVOICE_APPROVED',
          userId: 'user-1',
        })
      );
    });

    it('throws error when invoice is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        approveInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name')
      ).rejects.toThrow('Invoice not found');
    });

    it('throws error when invoice is not in PENDING_APPROVAL status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
        }),
      });

      await expect(
        approveInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name')
      ).rejects.toThrow('Cannot approve invoice with status: DRAFT');
    });

    it('does not notify when no submitter is recorded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          // No submittedByUserId
          approvalHistory: [],
        }),
      });

      await approveInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      // Notification should NOT be called since no submitter
      expect(createTaskNotification).not.toHaveBeenCalled();
    });
  });

  describe('rejectInvoice', () => {
    it('successfully rejects a PENDING_APPROVAL invoice', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test Customer',
          submittedByUserId: 'user-1',
          approvalHistory: [{ action: 'SUBMITTED', userId: 'user-1' }],
        }),
      });

      await rejectInvoice(
        mockDb,
        'invoice-123',
        'approver-1',
        'Approver Name',
        'Missing documentation'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('DRAFT');
      expect(updateCall.rejectionReason).toBe('Missing documentation');
      expect(updateCall.approvalHistory).toHaveLength(2);
      expect(updateCall.approvalHistory[1].action).toBe('REJECTED');
      expect(updateCall.approvalHistory[1].comments).toBe('Missing documentation');

      // Check notification was sent to submitter
      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'informational',
          category: 'INVOICE_REJECTED',
          userId: 'user-1',
          priority: 'HIGH',
        })
      );
    });

    it('throws error when invoice is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        rejectInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name', 'Reason')
      ).rejects.toThrow('Invoice not found');
    });

    it('throws error when invoice is not in PENDING_APPROVAL status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-001',
        }),
      });

      await expect(
        rejectInvoice(mockDb, 'invoice-123', 'approver-1', 'Approver Name', 'Reason')
      ).rejects.toThrow('Cannot reject invoice with status: APPROVED');
    });
  });

  describe('getInvoiceAvailableActions', () => {
    it('returns correct actions for DRAFT invoice with manage permission', () => {
      const result = getInvoiceAvailableActions(
        'DRAFT' as TransactionStatus,
        true,
        false,
        'user-1'
      );

      expect(result.canEdit).toBe(true);
      expect(result.canSubmitForApproval).toBe(true);
      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
      expect(result.canDelete).toBe(true);
    });

    it('returns correct actions for PENDING_APPROVAL invoice as assigned approver', () => {
      const result = getInvoiceAvailableActions(
        'PENDING_APPROVAL' as TransactionStatus,
        true,
        true,
        'approver-1',
        'approver-1'
      );

      expect(result.canEdit).toBe(false);
      expect(result.canSubmitForApproval).toBe(false);
      expect(result.canApprove).toBe(true);
      expect(result.canReject).toBe(true);
      expect(result.canDelete).toBe(false);
    });

    it('returns correct actions for PENDING_APPROVAL invoice as non-assigned user', () => {
      const result = getInvoiceAvailableActions(
        'PENDING_APPROVAL' as TransactionStatus,
        true,
        false,
        'other-user',
        'approver-1'
      );

      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
    });

    it('returns correct actions for APPROVED invoice', () => {
      const result = getInvoiceAvailableActions(
        'APPROVED' as TransactionStatus,
        true,
        false,
        'user-1'
      );

      expect(result.canEdit).toBe(false);
      expect(result.canSubmitForApproval).toBe(false);
      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
      expect(result.canDelete).toBe(false);
    });

    it('returns all false when user cannot manage', () => {
      const result = getInvoiceAvailableActions(
        'DRAFT' as TransactionStatus,
        false,
        false,
        'user-1'
      );

      expect(result.canEdit).toBe(false);
      expect(result.canSubmitForApproval).toBe(false);
      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
      expect(result.canDelete).toBe(false);
    });

    it('allows approval when currentUserId matches assignedApproverId even without isAssignedApprover flag', () => {
      const result = getInvoiceAvailableActions(
        'PENDING_APPROVAL' as TransactionStatus,
        true,
        false, // isAssignedApprover is false
        'approver-1',
        'approver-1' // but assignedApproverId matches currentUserId
      );

      expect(result.canApprove).toBe(true);
      expect(result.canReject).toBe(true);
    });
  });
});
