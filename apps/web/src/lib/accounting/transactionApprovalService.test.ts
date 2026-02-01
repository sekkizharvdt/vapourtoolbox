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

// Mock audit service
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditContext = jest.fn().mockReturnValue({ userId: 'user-1' });

jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: (...args: unknown[]) => mockCreateAuditContext(...args),
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

    describe('VOIDED status', () => {
      it('disallows all actions including payment', () => {
        const actions = getTransactionAvailableActions(
          'VENDOR_BILL',
          'VOID',
          true,
          true,
          'user-123',
          'user-123'
        );

        expect(actions.canEdit).toBe(false);
        expect(actions.canDelete).toBe(false);
        expect(actions.canSubmitForApproval).toBe(false);
        expect(actions.canApprove).toBe(false);
        expect(actions.canReject).toBe(false);
        expect(actions.canRecordPayment).toBe(false);
      });
    });
  });

  // ==========================================================================
  // VENDOR_BILL workflow tests
  // ==========================================================================

  describe('VENDOR_BILL workflow', () => {
    it('submits a draft bill for approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'BILL-2026-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor Corp',
          entityId: 'vendor-1',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'VENDOR_BILL',
        'txn-bill-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');

      expect(mockCreateTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'BILL_SUBMITTED',
          entityType: 'BILL',
          entityId: 'txn-bill-1',
        })
      );
    });

    it('approves a pending bill', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-2026-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor Corp',
          submittedByUserId: 'submitter-1',
          approvalHistory: [{ action: 'SUBMITTED' }],
        }),
      });

      await approveTransaction(mockDb, 'VENDOR_BILL', 'txn-bill-1', 'approver-1', 'Approver');

      expect(mockUpdateDoc.mock.calls[0][1].status).toBe('APPROVED');
      expect(mockCompleteTaskNotificationsByEntity).toHaveBeenCalledWith(
        'BILL',
        'txn-bill-1',
        'approver-1'
      );
      expect(mockCreateTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'BILL_APPROVED',
          userId: 'submitter-1',
        })
      );
    });

    it('rejects a pending bill', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-2026-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor Corp',
          submittedByUserId: 'submitter-1',
          approvalHistory: [{ action: 'SUBMITTED' }],
        }),
      });

      await rejectTransaction(
        mockDb,
        'VENDOR_BILL',
        'txn-bill-1',
        'approver-1',
        'Approver',
        'Wrong amount'
      );

      expect(mockUpdateDoc.mock.calls[0][1].status).toBe('DRAFT');
      expect(mockCreateTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'BILL_REJECTED',
          priority: 'HIGH',
        })
      );
    });

    it('uses Bill in error messages', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(
        submitTransactionForApproval(
          mockDb,
          'VENDOR_BILL',
          'txn-1',
          'approver-1',
          'Approver',
          'user-1',
          'User'
        )
      ).rejects.toThrow('Bill not found');
    });

    it('uses Bill ID in validation error', async () => {
      await expect(
        submitTransactionForApproval(
          mockDb,
          'VENDOR_BILL',
          '',
          'approver-1',
          'Approver',
          'user-1',
          'User'
        )
      ).rejects.toThrow('Bill ID');
    });
  });

  // ==========================================================================
  // TRANSACTION_CONFIGS display number logic
  // ==========================================================================

  describe('TRANSACTION_CONFIGS display number', () => {
    it('CUSTOMER_INVOICE uses transactionNumber', () => {
      const config = TRANSACTION_CONFIGS.CUSTOMER_INVOICE;
      expect(config.getDisplayNumber({ transactionNumber: 'INV-001' })).toBe('INV-001');
    });

    it('VENDOR_BILL prefers vendorInvoiceNumber', () => {
      const config = TRANSACTION_CONFIGS.VENDOR_BILL;
      expect(
        config.getDisplayNumber({
          vendorInvoiceNumber: 'VINV-001',
          transactionNumber: 'BILL-001',
        })
      ).toBe('VINV-001');
    });

    it('VENDOR_BILL falls back to transactionNumber', () => {
      const config = TRANSACTION_CONFIGS.VENDOR_BILL;
      expect(
        config.getDisplayNumber({
          transactionNumber: 'BILL-001',
        })
      ).toBe('BILL-001');
    });
  });

  // ==========================================================================
  // Validation edge cases
  // ==========================================================================

  describe('validation edge cases', () => {
    it('rejects whitespace-only transaction ID', async () => {
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          '   ',
          'approver-1',
          'Approver',
          'user-1',
          'User'
        )
      ).rejects.toThrow('cannot be empty');
    });

    it('rejects transaction ID exceeding max length', async () => {
      const longId = 'x'.repeat(101);
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          longId,
          'approver-1',
          'Approver',
          'user-1',
          'User'
        )
      ).rejects.toThrow('exceeds maximum length of 100');
    });

    it('rejects approver name exceeding max length', async () => {
      const longName = 'x'.repeat(201);
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-1',
          'approver-1',
          longName,
          'user-1',
          'User'
        )
      ).rejects.toThrow('exceeds maximum length of 200');
    });

    it('rejects comment exceeding max length', async () => {
      const longComment = 'x'.repeat(2001);
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-1',
          'approver-1',
          'Approver',
          'user-1',
          'User',
          longComment
        )
      ).rejects.toThrow('exceeds maximum length of 2000');
    });

    it('rejects whitespace-only comment for rejection', async () => {
      await expect(
        rejectTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-1', 'user-1', 'User', '   ')
      ).rejects.toThrow('Comment is required');
    });

    it('allows valid comment up to max length', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          approvalHistory: [],
        }),
      });

      const maxComment = 'x'.repeat(2000);
      await expect(
        submitTransactionForApproval(
          mockDb,
          'CUSTOMER_INVOICE',
          'txn-1',
          'approver-1',
          'Approver',
          'user-1',
          'User',
          maxComment
        )
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Approval history management
  // ==========================================================================

  describe('approval history', () => {
    it('appends to existing approval history on submit', async () => {
      const existingHistory = [
        { action: 'SUBMITTED', userId: 'old-user', userName: 'Old', timestamp: new Date() },
        {
          action: 'REJECTED',
          userId: 'approver',
          userName: 'Approver',
          timestamp: new Date(),
          comments: 'Fix it',
        },
      ];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          approvalHistory: existingHistory,
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      const history = mockUpdateDoc.mock.calls[0][1].approvalHistory;
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual(existingHistory[0]);
      expect(history[1]).toEqual(existingHistory[1]);
      expect(history[2].action).toBe('SUBMITTED');
    });

    it('handles missing approval history gracefully', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          // No approvalHistory field
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      const history = mockUpdateDoc.mock.calls[0][1].approvalHistory;
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('SUBMITTED');
    });

    it('omits comments from approval record when not provided', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      const record = mockUpdateDoc.mock.calls[0][1].approvalHistory[0];
      expect(record).not.toHaveProperty('comments');
    });

    it('includes comments in approval record when provided', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User',
        'Please review urgently'
      );

      const record = mockUpdateDoc.mock.calls[0][1].approvalHistory[0];
      expect(record.comments).toBe('Please review urgently');
    });
  });

  // ==========================================================================
  // Notification failure resilience
  // ==========================================================================

  describe('notification failure resilience', () => {
    it('approve succeeds even if submitter notification fails', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          submittedByUserId: 'submitter-1',
          approvalHistory: [],
        }),
      });
      mockCreateTaskNotification.mockRejectedValueOnce(new Error('Notification service down'));

      await expect(
        approveTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-1', 'user-1', 'User')
      ).resolves.toBeUndefined();

      // Firestore update should still have happened
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc.mock.calls[0][1].status).toBe('APPROVED');
    });

    it('reject succeeds even if submitter notification fails', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          submittedByUserId: 'submitter-1',
          approvalHistory: [],
        }),
      });
      mockCreateTaskNotification.mockRejectedValueOnce(new Error('Service down'));

      await expect(
        rejectTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-1', 'user-1', 'User', 'Bad')
      ).resolves.toBeUndefined();

      expect(mockUpdateDoc.mock.calls[0][1].status).toBe('DRAFT');
    });

    it('does not send notification when no submitter recorded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Test',
          // no submittedByUserId
          approvalHistory: [],
        }),
      });

      await approveTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-1', 'user-1', 'User');

      expect(mockCreateTaskNotification).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Audit logging
  // ==========================================================================

  describe('audit logging', () => {
    it('logs INVOICE_SUBMITTED on submit', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'INV-001',
          entityName: 'Customer',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'INVOICE_SUBMITTED',
        'INVOICE',
        'txn-1',
        expect.stringContaining('submitted for approval'),
        expect.objectContaining({
          entityName: 'INV-001',
          metadata: expect.objectContaining({
            approverId: 'approver-1',
            approverName: 'Approver',
          }),
        })
      );
    });

    it('logs BILL_SUBMITTED on bill submit', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'DRAFT',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await submitTransactionForApproval(
        mockDb,
        'VENDOR_BILL',
        'txn-1',
        'approver-1',
        'Approver',
        'user-1',
        'User'
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'BILL_SUBMITTED',
        'BILL',
        'txn-1',
        expect.stringContaining('submitted for approval'),
        expect.anything()
      );
    });

    it('logs INVOICE_APPROVED with WARNING severity', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Customer',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await approveTransaction(mockDb, 'CUSTOMER_INVOICE', 'txn-1', 'user-1', 'User');

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'INVOICE_APPROVED',
        'INVOICE',
        'txn-1',
        expect.stringContaining('approved'),
        expect.objectContaining({ severity: 'WARNING' })
      );
    });

    it('logs BILL_APPROVED on bill approval', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await approveTransaction(mockDb, 'VENDOR_BILL', 'txn-1', 'user-1', 'User');

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'BILL_APPROVED',
        'BILL',
        'txn-1',
        expect.stringContaining('approved'),
        expect.anything()
      );
    });

    it('logs INVOICE_REJECTED with rejection reason in metadata', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'INV-001',
          entityName: 'Customer',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await rejectTransaction(
        mockDb,
        'CUSTOMER_INVOICE',
        'txn-1',
        'user-1',
        'User',
        'Wrong totals'
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'INVOICE_REJECTED',
        'INVOICE',
        'txn-1',
        expect.stringContaining('rejected'),
        expect.objectContaining({
          metadata: expect.objectContaining({ rejectionReason: 'Wrong totals' }),
        })
      );
    });

    it('logs BILL_REJECTED on bill rejection', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'PENDING_APPROVAL',
          transactionNumber: 'BILL-001',
          vendorInvoiceNumber: 'VINV-001',
          entityName: 'Vendor',
          entityId: 'ent-1',
          approvalHistory: [],
        }),
      });

      await rejectTransaction(mockDb, 'VENDOR_BILL', 'txn-1', 'user-1', 'User', 'Incorrect vendor');

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'BILL_REJECTED',
        'BILL',
        'txn-1',
        expect.stringContaining('rejected'),
        expect.anything()
      );
    });
  });
});
