/**
 * Leave Approval Service Tests
 *
 * Tests the 2-step leave approval workflow including:
 * - Self-approval prevention
 * - Status transitions (DRAFT → PENDING → PARTIALLY_APPROVED → APPROVED)
 * - Rejection and cancellation
 * - Balance adjustments
 */

import type { LeaveRequest } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// ── Mock Firestore ──
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  collection: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => args),
  Timestamp: {
    now: () => ({ seconds: 1709827200, nanoseconds: 0, toDate: () => new Date('2024-03-07') }),
  },
}));

// ── Mock getFirebase ──
const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: mockDb }),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    HR_LEAVE_REQUESTS: 'hrLeaveRequests',
    HR_CONFIG: 'hrConfig',
    USERS: 'users',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// ── Mock dependencies ──
const mockGetLeaveRequestById = jest.fn();
jest.mock('./leaveRequestService', () => ({
  getLeaveRequestById: (...args: unknown[]) => mockGetLeaveRequestById(...args),
}));

const mockAddPendingLeave = jest.fn().mockResolvedValue(undefined);
const mockConfirmPendingLeave = jest.fn().mockResolvedValue(undefined);
const mockRemovePendingLeave = jest.fn().mockResolvedValue(undefined);
jest.mock('./leaveBalanceService', () => ({
  addPendingLeave: (...args: unknown[]) => mockAddPendingLeave(...args),
  confirmPendingLeave: (...args: unknown[]) => mockConfirmPendingLeave(...args),
  removePendingLeave: (...args: unknown[]) => mockRemovePendingLeave(...args),
}));

const mockCreateTaskNotification = jest.fn().mockResolvedValue(undefined);
const mockCompleteTaskNotifications = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: (...args: unknown[]) => mockCreateTaskNotification(...args),
  completeTaskNotificationsByEntity: (...args: unknown[]) => mockCompleteTaskNotifications(...args),
}));

jest.mock('@/lib/auth/authorizationService', () => ({
  preventSelfApproval: jest.fn((approverId: string, creatorId: string, op: string) => {
    if (approverId === creatorId) {
      throw new Error(`Cannot ${op} your own request`);
    }
  }),
}));

jest.mock('date-fns', () => ({
  format: jest.fn(() => '07/03/2024'),
}));

import {
  submitLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from './leaveApprovalService';

// ── Test data ──
function makeLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id: 'lr-1',
    userId: 'emp-1',
    userName: 'John Doe',
    leaveTypeId: 'lt-1',
    leaveTypeCode: 'CL',
    leaveTypeName: 'Casual Leave',
    startDate: Timestamp.now(),
    endDate: Timestamp.now(),
    numberOfDays: 2,
    reason: 'Personal',
    status: 'DRAFT',
    approverIds: [],
    approvalHistory: [],
    fiscalYear: '2024-2025',
    entityId: 'ent-1',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'emp-1',
    ...overrides,
  } as LeaveRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Submit Leave Request ──

describe('submitLeaveRequest', () => {
  beforeEach(() => {
    // HR config returns approver emails
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        leaveApprovers: ['approver1@test.com', 'approver2@test.com'],
      }),
    });

    // User email lookup
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'approver-1',
          data: () => ({ email: 'approver1@test.com', displayName: 'Approver 1' }),
        },
        {
          id: 'approver-2',
          data: () => ({ email: 'approver2@test.com', displayName: 'Approver 2' }),
        },
      ],
    });
  });

  it('should submit a DRAFT request for approval', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest());

    // Mock getUserEmailById (separate getDoc for user)
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ leaveApprovers: ['a1@test.com', 'a2@test.com'] }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: 'john@test.com' }),
      });

    await submitLeaveRequest('lr-1', 'emp-1', 'John Doe');

    // Should update status to PENDING_APPROVAL
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'PENDING_APPROVAL',
      })
    );

    // Should add pending leave to balance
    expect(mockAddPendingLeave).toHaveBeenCalledWith('emp-1', 'CL', 2, 'emp-1', '2024-2025');
  });

  it('should reject submission of non-DRAFT requests', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ status: 'PENDING_APPROVAL' }));

    await expect(submitLeaveRequest('lr-1', 'emp-1', 'John Doe')).rejects.toThrow(
      'Only DRAFT requests can be submitted'
    );
  });

  it("should prevent submitting someone else's request", async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ userId: 'other-user' }));

    await expect(submitLeaveRequest('lr-1', 'emp-1', 'John Doe')).rejects.toThrow(
      'You can only submit your own leave requests'
    );
  });

  it('should throw when request not found', async () => {
    mockGetLeaveRequestById.mockResolvedValue(null);

    await expect(submitLeaveRequest('lr-nonexistent', 'emp-1', 'John')).rejects.toThrow(
      'Leave request not found'
    );
  });
});

// ── Approve Leave Request ──

describe('approveLeaveRequest', () => {
  it('should partially approve on first approval (2-step flow)', async () => {
    const request = makeLeaveRequest({
      status: 'PENDING_APPROVAL',
      approverIds: ['approver-1', 'approver-2'],
      approvalFlow: {
        requiredApprovers: ['a1@test.com', 'a2@test.com'],
        requiredApprovalCount: 2,
        approvals: [],
        currentStep: 1,
        isComplete: false,
        isSelfApprovalCase: false,
      },
    });
    mockGetLeaveRequestById.mockResolvedValue(request);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'a1@test.com' }),
    });

    await approveLeaveRequest('lr-1', 'approver-1', 'Approver 1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'PARTIALLY_APPROVED',
      })
    );

    // Should NOT confirm balance (only on full approval)
    expect(mockConfirmPendingLeave).not.toHaveBeenCalled();
  });

  it('should fully approve on second approval', async () => {
    const request = makeLeaveRequest({
      status: 'PARTIALLY_APPROVED',
      approverIds: ['approver-1', 'approver-2'],
      approvalFlow: {
        requiredApprovers: ['a1@test.com', 'a2@test.com'],
        requiredApprovalCount: 2,
        approvals: [
          {
            approverId: 'approver-1',
            approverEmail: 'a1@test.com',
            approverName: 'Approver 1',
            approvedAt: Timestamp.now(),
            step: 1,
          },
        ],
        currentStep: 1,
        isComplete: false,
        isSelfApprovalCase: false,
      },
    });
    mockGetLeaveRequestById.mockResolvedValue(request);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'a2@test.com' }),
    });

    await approveLeaveRequest('lr-1', 'approver-2', 'Approver 2');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'APPROVED',
        approvedBy: 'approver-2',
        approvedByName: 'Approver 2',
      })
    );

    // Should confirm pending leave balance
    expect(mockConfirmPendingLeave).toHaveBeenCalledWith(
      'emp-1',
      'CL',
      2,
      'approver-2',
      '2024-2025'
    );

    // Should complete task notifications
    expect(mockCompleteTaskNotifications).toHaveBeenCalledWith(
      'HR_LEAVE_REQUEST',
      'lr-1',
      'approver-2'
    );
  });

  it('should prevent self-approval', async () => {
    const request = makeLeaveRequest({
      status: 'PENDING_APPROVAL',
      userId: 'approver-1', // Approver is the requester
      approverIds: ['approver-1'],
    });
    mockGetLeaveRequestById.mockResolvedValue(request);

    await expect(approveLeaveRequest('lr-1', 'approver-1', 'Self Approver')).rejects.toThrow(
      'Cannot approve leave request your own request'
    );
  });

  it('should prevent duplicate approval by same approver', async () => {
    const request = makeLeaveRequest({
      status: 'PARTIALLY_APPROVED',
      approverIds: ['approver-1', 'approver-2'],
      approvalFlow: {
        requiredApprovers: ['a1@test.com', 'a2@test.com'],
        requiredApprovalCount: 2,
        approvals: [
          {
            approverId: 'approver-1',
            approverEmail: 'a1@test.com',
            approverName: 'Approver 1',
            approvedAt: Timestamp.now(),
            step: 1,
          },
        ],
        currentStep: 1,
        isComplete: false,
        isSelfApprovalCase: false,
      },
    });
    mockGetLeaveRequestById.mockResolvedValue(request);

    await expect(approveLeaveRequest('lr-1', 'approver-1', 'Approver 1')).rejects.toThrow(
      'You have already approved this request'
    );
  });

  it('should reject approval of wrong status', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ status: 'APPROVED' }));

    await expect(approveLeaveRequest('lr-1', 'approver-1', 'Approver')).rejects.toThrow(
      'cannot be approved'
    );
  });

  it('should reject unauthorized approver', async () => {
    mockGetLeaveRequestById.mockResolvedValue(
      makeLeaveRequest({
        status: 'PENDING_APPROVAL',
        approverIds: ['approver-1', 'approver-2'],
      })
    );

    await expect(approveLeaveRequest('lr-1', 'random-user', 'Random')).rejects.toThrow(
      'not authorized to approve'
    );
  });
});

// ── Reject Leave Request ──

describe('rejectLeaveRequest', () => {
  it('should reject a pending request', async () => {
    const request = makeLeaveRequest({
      status: 'PENDING_APPROVAL',
      approverIds: ['approver-1'],
    });
    mockGetLeaveRequestById.mockResolvedValue(request);

    await rejectLeaveRequest('lr-1', 'approver-1', 'Approver 1', 'Insufficient balance');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'REJECTED',
        rejectedBy: 'approver-1',
        rejectionReason: 'Insufficient balance',
      })
    );

    // Should remove pending leave
    expect(mockRemovePendingLeave).toHaveBeenCalledWith(
      'emp-1',
      'CL',
      2,
      'approver-1',
      '2024-2025'
    );
  });

  it('should require rejection reason', async () => {
    await expect(rejectLeaveRequest('lr-1', 'approver-1', 'Approver', '')).rejects.toThrow(
      'Rejection reason is required'
    );
  });

  it('should prevent self-rejection', async () => {
    const request = makeLeaveRequest({
      status: 'PENDING_APPROVAL',
      userId: 'approver-1',
      approverIds: ['approver-1'],
    });
    mockGetLeaveRequestById.mockResolvedValue(request);

    await expect(
      rejectLeaveRequest('lr-1', 'approver-1', 'Self', 'Cannot self-reject')
    ).rejects.toThrow('Cannot reject leave request your own request');
  });
});

// ── Cancel Leave Request ──

describe('cancelLeaveRequest', () => {
  it('should cancel a DRAFT request', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ status: 'DRAFT' }));

    await cancelLeaveRequest('lr-1', 'emp-1', 'John Doe', 'Changed plans');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'CANCELLED',
        cancellationReason: 'Changed plans',
      })
    );

    // DRAFT requests don't have pending balance to remove
    expect(mockRemovePendingLeave).not.toHaveBeenCalled();
  });

  it('should cancel a PENDING_APPROVAL request and remove pending balance', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ status: 'PENDING_APPROVAL' }));

    await cancelLeaveRequest('lr-1', 'emp-1', 'John Doe');

    expect(mockRemovePendingLeave).toHaveBeenCalledWith('emp-1', 'CL', 2, 'emp-1', '2024-2025');

    expect(mockCompleteTaskNotifications).toHaveBeenCalledWith('HR_LEAVE_REQUEST', 'lr-1', 'emp-1');
  });

  it("should prevent cancelling someone else's request", async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ userId: 'other-user' }));

    await expect(cancelLeaveRequest('lr-1', 'emp-1', 'John Doe')).rejects.toThrow(
      'You can only cancel your own leave requests'
    );
  });

  it('should prevent cancelling APPROVED requests', async () => {
    mockGetLeaveRequestById.mockResolvedValue(makeLeaveRequest({ status: 'APPROVED' }));

    await expect(cancelLeaveRequest('lr-1', 'emp-1', 'John Doe')).rejects.toThrow(
      'Only DRAFT, PENDING_APPROVAL, or PARTIALLY_APPROVED'
    );
  });
});
