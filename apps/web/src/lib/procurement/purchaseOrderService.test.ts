/**
 * Purchase Order Service Tests
 *
 * Tests for PO service operations including:
 * - CRUD operations (getPOById, getPOItems, listPOs)
 * - Workflow operations (submit, approve, reject, issue)
 * - Authorization checks
 * - State machine transitions
 */

import { Timestamp } from 'firebase/firestore';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@vapour/types';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, dir?: string) => ({ field, dir })),
  limit: jest.fn((n: number) => ({ limit: n })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock getFirebase
const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: mockDb })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDERS: 'purchaseOrders',
    PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
    COUNTERS: 'counters',
    OFFERS: 'offers',
    OFFER_ITEMS: 'offerItems',
    RFQ_ITEMS: 'rfqItems',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

// Mock audit logging
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: jest.fn((userId, _, userName) => ({ userId, userName })),
}));

// Mock authorization service
const mockRequirePermission = jest.fn();
const mockRequireApprover = jest.fn();
const mockPreventSelfApproval = jest.fn();

jest.mock('@/lib/auth', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  requireApprover: (...args: unknown[]) => mockRequireApprover(...args),
  preventSelfApproval: (...args: unknown[]) => mockPreventSelfApproval(...args),
  AuthorizationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
}));

// Mock state machine
const mockValidateTransition = jest.fn();
jest.mock('@/lib/workflow/stateMachines', () => ({
  purchaseOrderStateMachine: {
    validateTransition: (...args: unknown[]) => mockValidateTransition(...args),
    canTransitionTo: jest.fn(() => true),
    getAvailableActions: jest.fn(() => []),
  },
}));

// Mock idempotency
jest.mock('@/lib/utils/idempotencyService', () => ({
  withIdempotency: jest.fn((_db, _key, _operation, fn) => fn()),
  generateIdempotencyKey: jest.fn((...args: string[]) => args.join('-')),
}));

// Mock task notification
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: jest.fn().mockResolvedValue('notification-1'),
}));

// Import after mocks
import {
  getPOById,
  getPOItems,
  listPOs,
  submitPOForApproval,
  approvePO,
  rejectPO,
  issuePO,
  updatePOStatus,
} from './purchaseOrderService';

// Helper to create mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Helper to create mock PurchaseOrder
function createMockPO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po-1',
    number: 'PO/2024/12/0001',
    rfqId: 'rfq-1',
    offerId: 'offer-1',
    selectedOfferNumber: 'OFF-001',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor',
    projectIds: ['project-1'],
    projectNames: ['Project A'],
    title: 'Steel Plates Order',
    subtotal: 100000,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    totalTax: 18000,
    grandTotal: 118000,
    currency: 'INR',
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    deliveryAddress: '123 Factory Street',
    status: 'DRAFT' as PurchaseOrderStatus,
    pdfVersion: 1,
    deliveryProgress: 0,
    paymentProgress: 0,
    createdAt: createMockTimestamp(new Date('2024-12-15')),
    updatedAt: createMockTimestamp(new Date('2024-12-15')),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  } as PurchaseOrder;
}

// Helper to create mock PurchaseOrderItem
function createMockPOItem(overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem {
  return {
    id: 'poi-1',
    purchaseOrderId: 'po-1',
    offerItemId: 'oi-1',
    rfqItemId: 'rfqi-1',
    lineNumber: 1,
    description: 'Steel Plate 10mm',
    projectId: 'project-1',
    quantity: 100,
    unit: 'KG',
    unitPrice: 1000,
    amount: 100000,
    gstRate: 18,
    gstAmount: 18000,
    quantityDelivered: 0,
    quantityAccepted: 0,
    quantityRejected: 0,
    deliveryStatus: 'PENDING',
    createdAt: createMockTimestamp(new Date('2024-12-15')),
    updatedAt: createMockTimestamp(new Date('2024-12-15')),
    ...overrides,
  } as PurchaseOrderItem;
}

describe('purchaseOrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateTransition.mockReturnValue({ allowed: true });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  // ========================================================================
  // getPOById Tests
  // ========================================================================
  describe('getPOById', () => {
    it('should return PO when found', async () => {
      const mockPO = createMockPO();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      const result = await getPOById('po-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('po-1');
      expect(result?.number).toBe('PO/2024/12/0001');
      expect(result?.vendorName).toBe('Test Vendor');
    });

    it('should return null when PO not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getPOById('non-existent');

      expect(result).toBeNull();
    });

    it('should include all PO fields', async () => {
      const mockPO = createMockPO({
        advancePaymentRequired: true,
        advancePercentage: 30,
        advanceAmount: 35400,
        advancePaymentStatus: 'PENDING',
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      const result = await getPOById('po-1');

      expect(result?.advancePaymentRequired).toBe(true);
      expect(result?.advancePercentage).toBe(30);
      expect(result?.advanceAmount).toBe(35400);
    });
  });

  // ========================================================================
  // getPOItems Tests
  // ========================================================================
  describe('getPOItems', () => {
    it('should return PO items sorted by line number', async () => {
      const mockItems = [
        createMockPOItem({ id: 'poi-1', lineNumber: 1, description: 'Item 1' }),
        createMockPOItem({ id: 'poi-2', lineNumber: 2, description: 'Item 2' }),
        createMockPOItem({ id: 'poi-3', lineNumber: 3, description: 'Item 3' }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const result = await getPOItems('po-1');

      expect(result).toHaveLength(3);
      expect(result[0]!.lineNumber).toBe(1);
      expect(result[1]!.lineNumber).toBe(2);
      expect(result[2]!.lineNumber).toBe(3);
    });

    it('should return empty array when no items', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getPOItems('po-1');

      expect(result).toHaveLength(0);
    });

    it('should include delivery tracking fields', async () => {
      const mockItem = createMockPOItem({
        quantityDelivered: 50,
        quantityAccepted: 45,
        quantityRejected: 5,
        deliveryStatus: 'PARTIAL',
      });

      mockGetDocs.mockResolvedValue({
        docs: [{ id: mockItem.id, data: () => mockItem }],
      });

      const result = await getPOItems('po-1');

      expect(result[0]!.quantityDelivered).toBe(50);
      expect(result[0]!.quantityAccepted).toBe(45);
      expect(result[0]!.quantityRejected).toBe(5);
      expect(result[0]!.deliveryStatus).toBe('PARTIAL');
    });
  });

  // ========================================================================
  // listPOs Tests
  // ========================================================================
  describe('listPOs', () => {
    it('should return all POs when no filters', async () => {
      const mockPOs = [createMockPO({ id: 'po-1' }), createMockPO({ id: 'po-2' })];

      mockGetDocs.mockResolvedValue({
        docs: mockPOs.map((po) => ({ id: po.id, data: () => po })),
      });

      const result = await listPOs();

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockPO = createMockPO({ status: 'PENDING_APPROVAL' });
      mockGetDocs.mockResolvedValue({
        docs: [{ id: mockPO.id, data: () => mockPO }],
      });

      const result = await listPOs({ status: 'PENDING_APPROVAL' });

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('PENDING_APPROVAL');
    });

    it('should filter by vendorId', async () => {
      const mockPO = createMockPO({ vendorId: 'vendor-123' });
      mockGetDocs.mockResolvedValue({
        docs: [{ id: mockPO.id, data: () => mockPO }],
      });

      const result = await listPOs({ vendorId: 'vendor-123' });

      expect(result).toHaveLength(1);
    });

    it('should filter by projectId', async () => {
      const mockPO = createMockPO({ projectIds: ['project-abc'] });
      mockGetDocs.mockResolvedValue({
        docs: [{ id: mockPO.id, data: () => mockPO }],
      });

      const result = await listPOs({ projectId: 'project-abc' });

      expect(result).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      const mockPOs = Array.from({ length: 10 }, (_, i) => createMockPO({ id: `po-${i}` }));

      mockGetDocs.mockResolvedValue({
        docs: mockPOs.slice(0, 5).map((po) => ({ id: po.id, data: () => po })),
      });

      const result = await listPOs({ limit: 5 });

      expect(result).toHaveLength(5);
    });
  });

  // ========================================================================
  // submitPOForApproval Tests
  // ========================================================================
  describe('submitPOForApproval', () => {
    it('should update PO status to PENDING_APPROVAL', async () => {
      const mockPO = createMockPO({ status: 'DRAFT' });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      await submitPOForApproval('po-1', 'user-1', 'John Doe', PERMISSION_FLAGS.MANAGE_PROCUREMENT);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');
      expect(updateCall.submittedBy).toBe('user-1');
    });

    it('should throw error when PO not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(
        submitPOForApproval(
          'non-existent',
          'user-1',
          'John Doe',
          PERMISSION_FLAGS.MANAGE_PROCUREMENT
        )
      ).rejects.toThrow('Purchase Order not found');
    });

    it('should set approverId when provided', async () => {
      const mockPO = createMockPO();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      await submitPOForApproval(
        'po-1',
        'user-1',
        'John Doe',
        PERMISSION_FLAGS.MANAGE_PROCUREMENT,
        'approver-1'
      );

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.approverId).toBe('approver-1');
    });

    it('should log audit event', async () => {
      const mockPO = createMockPO();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      await submitPOForApproval('po-1', 'user-1', 'John Doe', PERMISSION_FLAGS.MANAGE_PROCUREMENT);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'user-1' }),
        'PO_UPDATED',
        'PURCHASE_ORDER',
        'po-1',
        expect.stringContaining('Submitted'),
        expect.anything()
      );
    });
  });

  // ========================================================================
  // approvePO Tests
  // ========================================================================
  describe('approvePO', () => {
    const APPROVE_PO_PERMISSION = PERMISSION_FLAGS.MANAGE_PROCUREMENT;

    beforeEach(() => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () =>
              createMockPO({
                status: 'PENDING_APPROVAL',
                createdBy: 'other-user',
              }),
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });
    });

    it('should require APPROVE_PO permission', async () => {
      mockRequirePermission.mockImplementation(() => {
        throw new Error('Permission denied: requires APPROVE_PO');
      });

      await expect(
        approvePO('po-1', 'user-1', 'John Doe', 0) // No permissions
      ).rejects.toThrow('Permission denied');

      expect(mockRequirePermission).toHaveBeenCalledWith(
        0,
        APPROVE_PO_PERMISSION,
        'user-1',
        'approve purchase order'
      );
    });

    it('should prevent self-approval', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {
        throw new Error('Cannot approve purchase order your own request');
      });

      // PO created by same user
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () =>
              createMockPO({
                status: 'PENDING_APPROVAL',
                createdBy: 'user-1', // Same as approver
              }),
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await expect(approvePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION)).rejects.toThrow(
        'Cannot approve'
      );
    });

    it('should validate state machine transition', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({
        allowed: false,
        reason: 'Cannot approve PO with status: DRAFT',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () => createMockPO({ status: 'DRAFT', createdBy: 'other-user' }),
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await expect(approvePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION)).rejects.toThrow(
        'Cannot approve PO with status: DRAFT'
      );
    });

    it('should check designated approver when set', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockRequireApprover.mockImplementation(() => {
        throw new Error('You are not authorized to approve this purchase order');
      });
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () =>
              createMockPO({
                status: 'PENDING_APPROVAL',
                createdBy: 'other-user',
                approverId: 'specific-approver', // Different from user-1
              }),
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await expect(approvePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION)).rejects.toThrow(
        'not authorized'
      );
    });

    it('should approve PO successfully', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      const mockTransactionUpdate = jest.fn();
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () =>
              createMockPO({
                status: 'PENDING_APPROVAL',
                createdBy: 'other-user',
              }),
          }),
          update: mockTransactionUpdate,
        };
        return callback(mockTransaction);
      });

      await approvePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION);

      expect(mockTransactionUpdate).toHaveBeenCalled();
      const updateData = mockTransactionUpdate.mock.calls[0][1];
      expect(updateData.status).toBe('APPROVED');
      expect(updateData.approvedBy).toBe('user-1');
      expect(updateData.approvedByName).toBe('John Doe');
    });

    it('should throw error when PO not found', async () => {
      mockRequirePermission.mockImplementation(() => {});

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await expect(
        approvePO('non-existent', 'user-1', 'John Doe', APPROVE_PO_PERMISSION)
      ).rejects.toThrow('Purchase Order not found');
    });
  });

  // ========================================================================
  // rejectPO Tests
  // ========================================================================
  describe('rejectPO', () => {
    const APPROVE_PO_PERMISSION = PERMISSION_FLAGS.MANAGE_PROCUREMENT;

    it('should require APPROVE_PO permission', async () => {
      mockRequirePermission.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(rejectPO('po-1', 'user-1', 'John Doe', 0, 'Not meeting specs')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should validate state machine transition', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({
        allowed: false,
        reason: 'Cannot reject PO with status: APPROVED',
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'APPROVED', createdBy: 'other-user' }),
      });

      await expect(
        rejectPO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION, 'Reason')
      ).rejects.toThrow('Cannot reject PO with status: APPROVED');
    });

    it('should reject PO with reason', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'PENDING_APPROVAL', createdBy: 'other-user' }),
      });

      await rejectPO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION, 'Budget exceeded');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.status).toBe('REJECTED');
      expect(updateData.rejectedBy).toBe('user-1');
      expect(updateData.rejectionReason).toBe('Budget exceeded');
    });

    it('should log rejection audit event with WARNING severity', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'PENDING_APPROVAL', createdBy: 'other-user' }),
      });

      await rejectPO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION, 'Not needed');

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'PO_REJECTED',
        'PURCHASE_ORDER',
        'po-1',
        expect.stringContaining('Rejected'),
        expect.objectContaining({
          severity: 'WARNING',
        })
      );
    });
  });

  // ========================================================================
  // issuePO Tests
  // ========================================================================
  describe('issuePO', () => {
    const APPROVE_PO_PERMISSION = PERMISSION_FLAGS.MANAGE_PROCUREMENT;

    it('should require APPROVE_PO permission', async () => {
      mockRequirePermission.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(issuePO('po-1', 'user-1', 'John Doe', 0)).rejects.toThrow('Permission denied');
    });

    it('should validate state machine transition', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({
        allowed: false,
        reason: 'Cannot issue PO with status: DRAFT',
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'DRAFT' }),
      });

      await expect(issuePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION)).rejects.toThrow(
        'Cannot issue PO with status: DRAFT'
      );
    });

    it('should issue PO successfully', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'APPROVED' }),
      });

      await issuePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.status).toBe('ISSUED');
      expect(updateData.issuedBy).toBe('user-1');
    });

    it('should log PO_ISSUED audit event', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'APPROVED', vendorName: 'ABC Corp' }),
      });

      await issuePO('po-1', 'user-1', 'John Doe', APPROVE_PO_PERMISSION);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'PO_ISSUED',
        'PURCHASE_ORDER',
        'po-1',
        expect.stringContaining('Issued'),
        expect.anything()
      );
    });
  });

  // ========================================================================
  // updatePOStatus Tests
  // ========================================================================
  describe('updatePOStatus', () => {
    it('should validate state machine transition', async () => {
      mockValidateTransition.mockReturnValue({
        allowed: false,
        reason: 'Cannot transition PO from DRAFT to COMPLETED',
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'DRAFT' }),
      });

      await expect(updatePOStatus('po-1', 'COMPLETED', 'user-1')).rejects.toThrow(
        'Cannot transition PO from DRAFT to COMPLETED'
      );
    });

    it('should update status when transition is valid', async () => {
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'DELIVERED' }),
      });

      await updatePOStatus('po-1', 'COMPLETED', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.status).toBe('COMPLETED');
      expect(updateData.updatedBy).toBe('user-1');
    });

    it('should throw error when PO not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(updatePOStatus('non-existent', 'COMPLETED', 'user-1')).rejects.toThrow(
        'Purchase Order not found'
      );
    });

    it('should update timestamp', async () => {
      mockValidateTransition.mockReturnValue({ allowed: true });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'po-1',
        data: () => createMockPO({ status: 'IN_PROGRESS' }),
      });

      await updatePOStatus('po-1', 'DELIVERED', 'user-1');

      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.updatedAt).toBeDefined();
    });
  });

  // ========================================================================
  // Edge Cases and Integration Tests
  // ========================================================================
  describe('Edge Cases', () => {
    it('should handle concurrent approval attempts', async () => {
      mockRequirePermission.mockImplementation(() => {});
      mockPreventSelfApproval.mockImplementation(() => {});
      mockValidateTransition.mockReturnValue({ allowed: true });

      // First call succeeds, second call fails due to status change
      let callCount = 0;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        callCount++;
        const status = callCount === 1 ? 'PENDING_APPROVAL' : 'APPROVED';
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'po-1',
            data: () => createMockPO({ status, createdBy: 'other-user' }),
          }),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      // First approval should succeed
      await approvePO('po-1', 'user-1', 'John Doe', PERMISSION_FLAGS.MANAGE_PROCUREMENT);

      // Second call - state machine should block
      mockValidateTransition.mockReturnValue({
        allowed: false,
        reason: 'Cannot approve PO with status: APPROVED',
      });

      await expect(
        approvePO('po-1', 'user-2', 'Jane Doe', PERMISSION_FLAGS.MANAGE_PROCUREMENT)
      ).rejects.toThrow('Cannot approve');
    });

    it('should handle PO with all optional fields', async () => {
      const fullPO = createMockPO({
        warrantyTerms: '12 months',
        penaltyClause: '1% per week',
        otherClauses: ['Clause 1', 'Clause 2'],
        advancePaymentRequired: true,
        advancePercentage: 30,
        advanceAmount: 35400,
        advancePaymentStatus: 'PAID',
        advancePaymentId: 'payment-123',
        expectedDeliveryDate: createMockTimestamp(new Date('2025-01-15')),
        approvedBy: 'approver-1',
        approvedByName: 'Approver Name',
        approvedAt: createMockTimestamp(new Date('2024-12-16')),
        issuedAt: createMockTimestamp(new Date('2024-12-17')),
        issuedBy: 'issuer-1',
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: fullPO.id,
        data: () => fullPO,
      });

      const result = await getPOById('po-1');

      expect(result?.warrantyTerms).toBe('12 months');
      expect(result?.advancePaymentRequired).toBe(true);
      expect(result?.advancePaymentStatus).toBe('PAID');
    });
  });
});
