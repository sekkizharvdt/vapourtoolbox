/**
 * Transaction Approval Service Tests
 *
 * Tests for transaction approval workflow operations
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

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `transactions/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
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

// Mock task notification service
const mockCreateTaskNotification = jest.fn().mockResolvedValue({ id: 'notification-id' });
const mockCompleteTaskNotificationsByEntity = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: (...args: unknown[]) => mockCreateTaskNotification(...args),
  completeTaskNotificationsByEntity: (...args: unknown[]) =>
    mockCompleteTaskNotificationsByEntity(...args),
}));

import {
  submitTransactionForApproval,
  approveTransaction,
  rejectTransaction,
  getTransactionAvailableActions,
  TRANSACTION_CONFIGS,
} from './transactionApprovalService';
import type { Firestore } from 'firebase/firestore';

describe('transactionApprovalService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TRANSACTION_CONFIGS', () => {
    it('has correct config for CUSTOMER_INVOICE', () => {
      const config = TRANSACTION_CONFIGS.CUSTOMER_INVOICE;
      expect(config.entityType).toBe('INVOICE');
      expect(config.entityLabel).toBe('Invoice');
      expect(config.counterpartyLabel).toBe('Customer');
      expect(config.linkUrl).toBe('/accounting/invoices');
    });

    it('has correct config for VENDOR_BILL', () => {
      const config = TRANSACTION_CONFIGS.VENDOR_BILL;
      expect(config.entityType).toBe('BILL');
      expect(config.entityLabel).toBe('Bill');
      expect(config.counterpartyLabel).toBe('Vendor');
      expect(config.linkUrl).toBe('/accounting/bills');
    });
  });

  describe('submitTransactionForApproval', () => {
    it('submits a draft transaction for approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-2026-001',
          entityName: 'Test Customer',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-123',
        'approver-456',
        'Approver Name',
        'user-789',
        'User Name',
        'Please review'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');
      expect(updateCall.assignedApproverId).toBe('approver-456');
      expect(updateCall.assignedApproverName).toBe('Approver Name');
      expect(updateCall.submittedByUserId).toBe('user-789');
      expect(updateCall.submittedByUserName).toBe('User Name');
      expect(updateCall.approvalHistory).toHaveLength(1);
      expect(updateCall.approvalHistory[0].action).toBe('SUBMITTED');

      expect(mockCreateTaskNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskNotification.mock.calls[0][0]).toMatchObject({
        type: 'actionable',
        category: 'INVOICE_SUBMITTED',
        userId: 'approver-456',
        entityType: 'INVOICE',
        entityId: 'txn-123',
        priority: 'HIGH',
      });
    });

    it('throws error when transaction not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-123',
          'approver-456',
          'Approver Name',
          'user-789',
          'User Name'
        )
      ).rejects.toThrow('Invoice not found');
    });

    it('throws error when transaction is not in DRAFT status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-2026-001',
        }),
      });

      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-123',
          'approver-456',
          'Approver Name',
          'user-789',
          'User Name'
        )
      ).rejects.toThrow('Cannot submit invoice with status: APPROVED');
    });

    it('validates required fields', async () => {
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          '', // Empty ID
          'approver-456',
          'Approver Name',
          'user-789',
          'User Name'
        )
      ).rejects.toThrow('Invoice ID is required');

      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-123',
          '', // Empty approver ID
          'Approver Name',
          'user-789',
          'User Name'
        )
      ).rejects.toThrow('Approver ID is required');
    });
  });

  describe('approveTransaction', () => {
    it('approves a pending transaction', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-2026-001',
          entityName: 'Test Customer',
          submittedByUserId: 'submitter-123',
          approvalHistory: [{ action: 'SUBMITTED' }],
        }),
      });

      await approveTransaction(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-123',
        'user-789',
        'User Name',
        'Looks good!'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('APPROVED');
      expect(updateCall.approvedBy).toBe('user-789');
      expect(updateCall.approvalHistory).toHaveLength(2);
      expect(updateCall.approvalHistory[1].action).toBe('APPROVED');

      expect(mockCompleteTaskNotificationsByEntity).toHaveBeenCalledWith(
        'INVOICE',
        'txn-123',
        'user-789'
      );

      // Should send notification to submitter
      expect(mockCreateTaskNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskNotification.mock.calls[0][0]).toMatchObject({
        type: 'informational',
        category: 'INVOICE_APPROVED',
        userId: 'submitter-123',
      });
    });

    it('throws error when transaction is not pending approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-2026-001',
        }),
      });

      await expect(
        approveTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-123', 'user-789', 'User Name')
      ).rejects.toThrow('Cannot approve invoice with status: DRAFT');
    });
  });

  describe('rejectTransaction', () => {
    it('rejects a pending transaction with required comment', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-2026-001',
          entityName: 'Test Customer',
          submittedByUserId: 'submitter-123',
          approvalHistory: [{ action: 'SUBMITTED' }],
        }),
      });

      await rejectTransaction(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-123',
        'user-789',
        'User Name',
        'Missing documentation'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('DRAFT');
      expect(updateCall.rejectionReason).toBe('Missing documentation');
      expect(updateCall.approvalHistory).toHaveLength(2);
      expect(updateCall.approvalHistory[1].action).toBe('REJECTED');
      expect(updateCall.approvalHistory[1].comments).toBe('Missing documentation');

      // Should send notification to submitter
      expect(mockCreateTaskNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateTaskNotification.mock.calls[0][0]).toMatchObject({
        type: 'informational',
        category: 'INVOICE_REJECTED',
        userId: 'submitter-123',
        priority: 'HIGH',
      });
    });

    it('requires comment for rejection', async () => {
      await expect(
        rejectTransaction(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-123',
          'user-789',
          'User Name',
          '' // Empty comment
        )
      ).rejects.toThrow('Comment is required');
    });

    it('throws error when transaction is not pending approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'APPROVED',
          transactionNumber: 'INV-2026-001',
        }),
      });

      await expect(
        rejectTransaction(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-123',
          'user-789',
          'User Name',
          'Rejecting'
        )
      ).rejects.toThrow('Cannot reject invoice with status: APPROVED');
    });
  });

  describe('getTransactionAvailableActions', () => {
    describe('DRAFT status', () => {
      it('allows editing and submitting for managers', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'DRAFT',
          true, // canManage
          false, // isAssignedApprover
          'user-123',
          undefined
        );

        expect(actions.canEdit).toBe(true);
        expect(actions.canSubmitForApproval).toBe(true);
        expect(actions.canApprove).toBe(false);
        expect(actions.canReject).toBe(false);
        expect(actions.canDelete).toBe(true);
        expect(actions.canRecordPayment).toBe(false);
      });

      it('disallows actions for non-managers', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'DRAFT',
          false, // canManage
          false,
          'user-123',
          undefined
        );

        expect(actions.canEdit).toBe(false);
        expect(actions.canSubmitForApproval).toBe(false);
        expect(actions.canDelete).toBe(false);
      });
    });

    describe('PENDING_APPROVAL status', () => {
      it('allows approval for assigned approver', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'PENDING_APPROVAL',
          true,
          true, // isAssignedApprover
          'user-123',
          'user-123' // assignedApproverId matches
        );

        expect(actions.canApprove).toBe(true);
        expect(actions.canReject).toBe(true);
        expect(actions.canEdit).toBe(true); // Testing phase
        expect(actions.canSubmitForApproval).toBe(false);
      });

      it('disallows approval for non-assigned user', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'PENDING_APPROVAL',
          true,
          false, // not assigned approver
          'user-123',
          'other-user' // different approver
        );

        expect(actions.canApprove).toBe(false);
        expect(actions.canReject).toBe(false);
      });
    });

    describe('APPROVED status', () => {
      it('disallows editing and deleting', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'APPROVED',
          true,
          false,
          'user-123',
          undefined
        );

        expect(actions.canEdit).toBe(false);
        expect(actions.canDelete).toBe(false);
        expect(actions.canSubmitForApproval).toBe(false);
        expect(actions.canApprove).toBe(false);
      });

      it('allows payment recording for vendor bills', () => {
        const actions = getTransactionAvailableActions(
          'VENDOR_BILL',
          'APPROVED',
          true,
          false,
          'user-123',
          undefined
        );

        expect(actions.canRecordPayment).toBe(true);
      });

      it('disallows payment recording for invoices', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'APPROVED',
          true,
          false,
          'user-123',
          undefined
        );

        expect(actions.canRecordPayment).toBe(false);
      });
    });

    describe('POSTED status', () => {
      it('disallows all modification actions', () => {
        const actions = getTransactionAvailableActions(
          'CUSTOMER_INVOICE',
          'POSTED',
          true,
          false,
          'user-123',
          undefined
        );

        expect(actions.canEdit).toBe(false);
        expect(actions.canDelete).toBe(false);
        expect(actions.canSubmitForApproval).toBe(false);
        expect(actions.canApprove).toBe(false);
        expect(actions.canReject).toBe(false);
      });
    });
  });
});
