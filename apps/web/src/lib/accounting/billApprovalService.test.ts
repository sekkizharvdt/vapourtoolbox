/**
 * Bill Approval Service Tests
 *
 * Tests for vendor bill approval workflow: submit, approve, reject
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
  submitBillForApproval,
  approveBill,
  rejectBill,
  getBillAvailableActions,
} from './billApprovalService';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import type { Firestore } from 'firebase/firestore';

describe('billApprovalService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitBillForApproval', () => {
    it('successfully submits a DRAFT bill for approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'INV-001',
          entityName: 'Test Vendor',
          approvalHistory: [],
        }),
      });

      await submitBillForApproval(
        mockDb,
        'bill-123',
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
          category: 'BILL_SUBMITTED',
          userId: 'approver-1',
        })
      );
    });

    it('throws error when bill is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        submitBillForApproval(
          mockDb,
          'bill-123',
          'approver-1',
          'Approver Name',
          'user-1',
          'Submitter Name'
        )
      ).rejects.toThrow('Bill not found');
    });

    it('throws error when bill is not in DRAFT status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'BILL-001',
        }),
      });

      await expect(
        submitBillForApproval(
          mockDb,
          'bill-123',
          'approver-1',
          'Approver Name',
          'user-1',
          'Submitter Name'
        )
      ).rejects.toThrow('Cannot submit bill with status: APPROVED');
    });
  });

  describe('approveBill', () => {
    it('successfully approves a PENDING_APPROVAL bill', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'INV-001',
          entityName: 'Test Vendor',
          submittedByUserId: 'user-1',
          approvalHistory: [{ action: 'SUBMITTED', userId: 'user-1' }],
        }),
      });

      await approveBill(mockDb, 'bill-123', 'approver-1', 'Approver Name', 'Looks good');

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
          category: 'BILL_APPROVED',
          userId: 'user-1',
        })
      );
    });

    it('throws error when bill is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(approveBill(mockDb, 'bill-123', 'approver-1', 'Approver Name')).rejects.toThrow(
        'Bill not found'
      );
    });

    it('throws error when bill is not in PENDING_APPROVAL status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'BILL-001',
        }),
      });

      await expect(approveBill(mockDb, 'bill-123', 'approver-1', 'Approver Name')).rejects.toThrow(
        'Cannot approve bill with status: DRAFT'
      );
    });
  });

  describe('rejectBill', () => {
    it('successfully rejects a PENDING_APPROVAL bill', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'INV-001',
          entityName: 'Test Vendor',
          submittedByUserId: 'user-1',
          approvalHistory: [{ action: 'SUBMITTED', userId: 'user-1' }],
        }),
      });

      await rejectBill(mockDb, 'bill-123', 'approver-1', 'Approver Name', 'Missing documentation');

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
          category: 'BILL_REJECTED',
          userId: 'user-1',
          priority: 'HIGH',
        })
      );
    });

    it('throws error when bill is not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        rejectBill(mockDb, 'bill-123', 'approver-1', 'Approver Name', 'Reason')
      ).rejects.toThrow('Bill not found');
    });

    it('throws error when bill is not in PENDING_APPROVAL status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'BILL-001',
        }),
      });

      await expect(
        rejectBill(mockDb, 'bill-123', 'approver-1', 'Approver Name', 'Reason')
      ).rejects.toThrow('Cannot reject bill with status: APPROVED');
    });
  });

  describe('getBillAvailableActions', () => {
    it('returns correct actions for DRAFT bill with manage permission', () => {
      const result = getBillAvailableActions('DRAFT' as TransactionStatus, true, false, 'user-1');

      expect(result.canEdit).toBe(true);
      expect(result.canSubmitForApproval).toBe(true);
      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
      expect(result.canDelete).toBe(true);
      expect(result.canRecordPayment).toBe(false);
    });

    it('returns correct actions for PENDING_APPROVAL bill as assigned approver', () => {
      const result = getBillAvailableActions(
        'PENDING_APPROVAL' as TransactionStatus,
        true,
        true,
        'approver-1',
        'approver-1'
      );

      // TESTING PHASE: canEdit and canDelete are true for PENDING_APPROVAL
      expect(result.canEdit).toBe(true);
      expect(result.canSubmitForApproval).toBe(false);
      expect(result.canApprove).toBe(true);
      expect(result.canReject).toBe(true);
      expect(result.canDelete).toBe(true);
      expect(result.canRecordPayment).toBe(false);
    });

    it('returns correct actions for PENDING_APPROVAL bill as non-assigned user', () => {
      const result = getBillAvailableActions(
        'PENDING_APPROVAL' as TransactionStatus,
        true,
        false,
        'other-user',
        'approver-1'
      );

      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
    });

    it('returns correct actions for APPROVED bill', () => {
      const result = getBillAvailableActions(
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
      expect(result.canRecordPayment).toBe(true);
    });

    it('returns all false when user cannot manage', () => {
      const result = getBillAvailableActions('DRAFT' as TransactionStatus, false, false, 'user-1');

      expect(result.canEdit).toBe(false);
      expect(result.canSubmitForApproval).toBe(false);
      expect(result.canApprove).toBe(false);
      expect(result.canReject).toBe(false);
      expect(result.canDelete).toBe(false);
      expect(result.canRecordPayment).toBe(false);
    });
  });
});
