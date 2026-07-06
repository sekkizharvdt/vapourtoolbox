import type { PurchaseOrder } from '@vapour/types';

// Mock Firebase
const mockUpdateDoc = jest.fn();
const mockDeleteField = jest.fn((..._args: unknown[]) => 'mock-delete-field-sentinel');
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mock-doc-ref'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteField: (...args: unknown[]) => mockDeleteField(...args),
  runTransaction: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1702800000, nanoseconds: 0 })),
  },
}));

const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: mockDb })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDERS: 'purchaseOrders',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: jest.fn((userId, _, userName) => ({ userId, userName })),
}));

const mockRequireApprover = jest.fn();
jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  requireApprover: (...args: unknown[]) => mockRequireApprover(...args),
  preventSelfApproval: jest.fn(),
}));

const mockCanTransitionTo = jest.fn();
const mockValidateTransition = jest.fn();
jest.mock('@/lib/workflow/stateMachines', () => ({
  purchaseOrderStateMachine: {
    canTransitionTo: (...args: unknown[]) => mockCanTransitionTo(...args),
    validateTransition: (...args: unknown[]) => mockValidateTransition(...args),
  },
}));

const mockGetPOById = jest.fn();
jest.mock('./crud', () => ({
  getPOById: (...args: unknown[]) => mockGetPOById(...args),
}));

const mockCreateTaskNotification = jest.fn().mockResolvedValue('task-1');
const mockFindTaskNotificationsByEntity = jest.fn().mockResolvedValue([]);
const mockCompleteActionableTask = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: (...args: unknown[]) => mockCreateTaskNotification(...args),
  findTaskNotificationsByEntity: (...args: unknown[]) => mockFindTaskNotificationsByEntity(...args),
  completeActionableTask: (...args: unknown[]) => mockCompleteActionableTask(...args),
}));

import { advancePOStatusIfAllowed, returnPOForRevision, rejectPO } from './workflow';

const mockPO = {
  id: 'po-1',
  number: 'PO/2026/001',
  status: 'ISSUED',
  vendorName: 'Acme Corp',
  projectIds: [],
} as unknown as PurchaseOrder;

const mockApprovalPO = {
  id: 'po-1',
  number: 'PO/2026/001',
  vendorName: 'Acme Corp',
  createdBy: 'creator-1',
  submittedBy: 'creator-1',
  approverId: 'approver-1',
  secondApproverId: 'approver-2',
  projectIds: [],
} as unknown as PurchaseOrder;

describe('advancePOStatusIfAllowed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advances status and returns true when the transition is currently legal', async () => {
    mockGetPOById.mockResolvedValue(mockPO);
    mockCanTransitionTo.mockReturnValue(true);

    const result = await advancePOStatusIfAllowed('po-1', 'IN_PROGRESS', 'user-1', 'User One');

    expect(result).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({ status: 'IN_PROGRESS' })
    );
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('is a no-op and returns false when the transition is not currently legal', async () => {
    mockGetPOById.mockResolvedValue(mockPO);
    mockCanTransitionTo.mockReturnValue(false);

    const result = await advancePOStatusIfAllowed('po-1', 'IN_PROGRESS', 'user-1', 'User One');

    expect(result).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when the Purchase Order is not found', async () => {
    mockGetPOById.mockResolvedValue(null);

    await expect(advancePOStatusIfAllowed('missing', 'IN_PROGRESS', 'user-1')).rejects.toThrow(
      'Purchase Order not found'
    );
  });
});

describe('returnPOForRevision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateTransition.mockReturnValue({ allowed: true });
  });

  it('requires non-empty comments', async () => {
    await expect(returnPOForRevision('po-1', 'approver-1', 'Approver One', '   ')).rejects.toThrow(
      /Comments are required/
    );
    expect(mockGetPOById).not.toHaveBeenCalled();
  });

  it('throws when the Purchase Order is not found', async () => {
    mockGetPOById.mockResolvedValue(null);

    await expect(
      returnPOForRevision('missing', 'approver-1', 'Approver One', 'Please fix the pricing')
    ).rejects.toThrow('Purchase Order not found');
  });

  it('throws when the DRAFT transition is not currently legal', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'ISSUED' });
    mockValidateTransition.mockReturnValue({ allowed: false, reason: 'Bad state' });

    await expect(
      returnPOForRevision('po-1', 'approver-1', 'Approver One', 'comments')
    ).rejects.toThrow('Bad state');
  });

  it('gates on the FIRST approver identity when returning from PENDING_APPROVAL', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'PENDING_APPROVAL' });

    await returnPOForRevision('po-1', 'approver-1', 'Approver One', 'Please fix the pricing');

    expect(mockRequireApprover).toHaveBeenCalledWith(
      'approver-1',
      ['approver-1'],
      'return this purchase order'
    );
  });

  it('gates on the SECOND approver identity when returning from PENDING_FINAL_APPROVAL', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'PENDING_FINAL_APPROVAL' });

    await returnPOForRevision('po-1', 'approver-2', 'Approver Two', 'Needs another look');

    expect(mockRequireApprover).toHaveBeenCalledWith(
      'approver-2',
      ['approver-2'],
      'return this purchase order'
    );
  });

  it('resets status to DRAFT and clears the prior approval record (full restart)', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'PENDING_APPROVAL' });

    await returnPOForRevision('po-1', 'approver-1', 'Approver One', 'Please fix the pricing');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({
        status: 'DRAFT',
        returnedBy: 'approver-1',
        returnedByName: 'Approver One',
        returnComments: 'Please fix the pricing',
        submittedForApprovalAt: 'mock-delete-field-sentinel',
        submittedBy: 'mock-delete-field-sentinel',
        firstApprovedBy: 'mock-delete-field-sentinel',
        firstApprovedByName: 'mock-delete-field-sentinel',
        firstApprovedAt: 'mock-delete-field-sentinel',
      })
    );
  });

  it('completes open approval tasks and notifies the submitter', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'PENDING_APPROVAL' });
    mockFindTaskNotificationsByEntity.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);

    await returnPOForRevision('po-1', 'approver-1', 'Approver One', 'Please fix the pricing');

    expect(mockCompleteActionableTask).toHaveBeenCalledWith('task-1', 'approver-1', true);
    expect(mockCompleteActionableTask).toHaveBeenCalledWith('task-2', 'approver-1', true);
    expect(mockCreateTaskNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'PO_CHANGES_REQUESTED',
        userId: 'creator-1',
      })
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'PO_CHANGES_REQUESTED',
      'PURCHASE_ORDER',
      'po-1',
      expect.anything(),
      expect.anything()
    );
  });
});

describe('rejectPO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateTransition.mockReturnValue({ allowed: true });
  });

  it('notifies the submitter with the rejection reason', async () => {
    mockGetPOById.mockResolvedValue({ ...mockApprovalPO, status: 'PENDING_APPROVAL' });

    // MANAGE_PROCUREMENT permission bit (rejectPO also allows designated
    // approvers, but this exercises the permission-flag path).
    await rejectPO('po-1', 'manager-1', 'Manager One', 65536, 'Vendor pricing changed');

    expect(mockCreateTaskNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'PO_REJECTED',
        userId: 'creator-1',
        message: expect.stringContaining('Vendor pricing changed'),
      })
    );
  });

  it('does not notify when the PO has no submitter on record', async () => {
    mockGetPOById.mockResolvedValue({
      ...mockApprovalPO,
      status: 'PENDING_APPROVAL',
      submittedBy: undefined,
    });

    await rejectPO('po-1', 'manager-1', 'Manager One', 65536, 'Vendor pricing changed');

    expect(mockCreateTaskNotification).not.toHaveBeenCalled();
  });
});
