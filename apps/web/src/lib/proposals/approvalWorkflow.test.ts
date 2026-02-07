/**
 * Proposal Approval Workflow Tests
 *
 * Tests for proposal approval workflow:
 * - Submit proposal for approval
 * - Approve proposal
 * - Reject proposal
 * - Request changes
 * - Mark as submitted to client
 * - Get available actions
 */

import type { Proposal, ProposalStatus } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { Firestore } from 'firebase/firestore';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROPOSALS: 'proposals',
  },
}));

const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `proposals/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

// Mock task notification service
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: jest.fn().mockResolvedValue(undefined),
  findTaskNotificationByEntity: jest.fn().mockResolvedValue(null),
  completeActionableTask: jest.fn().mockResolvedValue(undefined),
}));

// Mock user helpers
jest.mock('./userHelpers', () => ({
  getProposalApprovers: jest.fn().mockResolvedValue(['approver-1', 'approver-2']),
}));

// Mock auth functions
jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  preventSelfApproval: jest.fn(),
}));

// Mock state machine
jest.mock('@/lib/workflow/stateMachines', () => ({
  proposalStateMachine: {
    validateTransition: jest.fn((fromStatus: string, toStatus: string) => {
      // Define valid transitions
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL'],
        PENDING_APPROVAL: ['APPROVED', 'DRAFT'],
        APPROVED: ['SUBMITTED'],
        SUBMITTED: ['ACCEPTED', 'REJECTED'],
      };
      const allowed = validTransitions[fromStatus]?.includes(toStatus) ?? false;
      return {
        allowed,
        reason: allowed ? null : `Cannot transition from ${fromStatus} to ${toStatus}`,
      };
    }),
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

import {
  submitProposalForApproval,
  approveProposal,
  rejectProposal,
  requestProposalChanges,
  markProposalAsSubmitted,
  updateProposalStatus,
  getAvailableActions,
} from './approvalWorkflow';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { requirePermission, preventSelfApproval } from '@/lib/auth';

describe('approvalWorkflow', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';
  const mockUserName = 'Test User';
  const mockPermissions = PERMISSION_FLAGS.MANAGE_ESTIMATION;

  const mockProposal: Partial<Proposal> = {
    id: 'proposal-123',
    proposalNumber: 'PROP-26-01',
    entityId: 'entity-123',
    title: 'Test Proposal',
    status: 'DRAFT' as ProposalStatus,
    submittedByUserId: 'submitter-123',
    approvalHistory: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitProposalForApproval', () => {
    it('should submit DRAFT proposal for approval', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'DRAFT' }),
      });

      await submitProposalForApproval(mockDb, 'proposal-123', mockUserId, mockUserName);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');
      expect(updateCall.submittedByUserId).toBe(mockUserId);
      expect(updateCall.submittedByUserName).toBe(mockUserName);

      // Should create task notifications for approvers
      expect(createTaskNotification).toHaveBeenCalled();
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        submitProposalForApproval(mockDb, 'non-existent', mockUserId, mockUserName)
      ).rejects.toThrow('Proposal not found');
    });

    it('should throw error when proposal is not in DRAFT status', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'APPROVED' }),
      });

      await expect(
        submitProposalForApproval(mockDb, 'proposal-123', mockUserId, mockUserName)
      ).rejects.toThrow();
    });
  });

  describe('approveProposal', () => {
    it('should approve PENDING_APPROVAL proposal', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockProposal,
          status: 'PENDING_APPROVAL',
          submittedByUserId: 'other-user',
        }),
      });

      await approveProposal(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName,
        mockPermissions,
        'Looks good!'
      );

      expect(requirePermission).toHaveBeenCalledWith(
        mockPermissions,
        PERMISSION_FLAGS.MANAGE_ESTIMATION,
        mockUserId,
        'approve proposal'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('APPROVED');
      expect(updateCall.approvalHistory).toHaveLength(1);
      expect(updateCall.approvalHistory[0].action).toBe('APPROVED');
      expect(updateCall.approvalHistory[0].comments).toBe('Looks good!');

      // Should create informational notification for submitter
      expect(createTaskNotification).toHaveBeenCalled();
    });

    it('should prevent self-approval', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockProposal,
          status: 'PENDING_APPROVAL',
          submittedByUserId: mockUserId, // Same user trying to approve
        }),
      });

      await approveProposal(mockDb, 'proposal-123', mockUserId, mockUserName, mockPermissions);

      expect(preventSelfApproval).toHaveBeenCalledWith(mockUserId, mockUserId, 'approve proposal');
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        approveProposal(mockDb, 'proposal-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow('Proposal not found');
    });

    it('should auto-complete review task if exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockProposal,
          status: 'PENDING_APPROVAL',
          submittedByUserId: 'other-user',
        }),
      });

      (findTaskNotificationByEntity as jest.Mock).mockResolvedValueOnce({
        id: 'task-123',
      });

      await approveProposal(mockDb, 'proposal-123', mockUserId, mockUserName, mockPermissions);

      expect(completeActionableTask).toHaveBeenCalledWith('task-123', mockUserId, true);
    });
  });

  describe('rejectProposal', () => {
    it('should reject PENDING_APPROVAL proposal with comments', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockProposal,
          status: 'PENDING_APPROVAL',
          submittedByUserId: 'other-user',
        }),
      });

      await rejectProposal(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName,
        mockPermissions,
        'Missing cost breakdown'
      );

      expect(requirePermission).toHaveBeenCalledWith(
        mockPermissions,
        PERMISSION_FLAGS.MANAGE_ESTIMATION,
        mockUserId,
        'reject proposal'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('DRAFT'); // Goes back to DRAFT
      expect(updateCall.approvalHistory).toHaveLength(1);
      expect(updateCall.approvalHistory[0].action).toBe('REJECTED');
      expect(updateCall.approvalHistory[0].comments).toBe('Missing cost breakdown');

      // Should notify submitter
      expect(createTaskNotification).toHaveBeenCalled();
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        rejectProposal(mockDb, 'proposal-123', mockUserId, mockUserName, mockPermissions, 'Reason')
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('requestProposalChanges', () => {
    it('should request changes and set status back to DRAFT', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockProposal,
          status: 'PENDING_APPROVAL',
          submittedByUserId: 'other-user',
        }),
      });

      await requestProposalChanges(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName,
        mockPermissions,
        'Please add more details to section 3'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('DRAFT');
      expect(updateCall.approvalHistory).toHaveLength(1);
      expect(updateCall.approvalHistory[0].action).toBe('REQUESTED_CHANGES');

      // Should notify submitter about requested changes
      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'PROPOSAL_CHANGES_REQUESTED',
        })
      );
    });
  });

  describe('markProposalAsSubmitted', () => {
    it('should mark APPROVED proposal as submitted to client', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'APPROVED' }),
      });

      await markProposalAsSubmitted(mockDb, 'proposal-123', mockUserId);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('SUBMITTED');
      expect(updateCall).toHaveProperty('submittedToClientAt');
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(markProposalAsSubmitted(mockDb, 'proposal-123', mockUserId)).rejects.toThrow(
        'Proposal not found'
      );
    });

    it('should throw error when proposal is not APPROVED', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'DRAFT' }),
      });

      await expect(markProposalAsSubmitted(mockDb, 'proposal-123', mockUserId)).rejects.toThrow();
    });
  });

  describe('updateProposalStatus', () => {
    it('should update proposal status with valid transition', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'DRAFT' }),
      });

      await updateProposalStatus(
        mockDb,
        'proposal-123',
        'PENDING_APPROVAL',
        mockUserId,
        'Ready for review'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.status).toBe('PENDING_APPROVAL');
      expect(updateCall.statusChangeReason).toBe('Ready for review');
    });

    it('should throw error for invalid transition', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockProposal, status: 'DRAFT' }),
      });

      await expect(
        updateProposalStatus(mockDb, 'proposal-123', 'ACCEPTED', mockUserId)
      ).rejects.toThrow();
    });
  });

  describe('getAvailableActions', () => {
    it('should return correct actions for DRAFT status', () => {
      const actions = getAvailableActions('DRAFT');

      expect(actions.canSubmit).toBe(true);
      expect(actions.canApprove).toBe(false);
      expect(actions.canReject).toBe(false);
      expect(actions.canRequestChanges).toBe(false);
      expect(actions.canEdit).toBe(true);
      expect(actions.canDownloadPDF).toBe(false);
      expect(actions.canConvertToProject).toBe(false);
    });

    it('should return correct actions for PENDING_APPROVAL status', () => {
      const actions = getAvailableActions('PENDING_APPROVAL');

      expect(actions.canSubmit).toBe(false);
      expect(actions.canApprove).toBe(true);
      expect(actions.canReject).toBe(true);
      expect(actions.canRequestChanges).toBe(true);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDownloadPDF).toBe(false);
      expect(actions.canConvertToProject).toBe(false);
    });

    it('should return correct actions for APPROVED status', () => {
      const actions = getAvailableActions('APPROVED');

      expect(actions.canSubmit).toBe(false);
      expect(actions.canApprove).toBe(false);
      expect(actions.canReject).toBe(false);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDownloadPDF).toBe(true);
      expect(actions.canConvertToProject).toBe(false);
    });

    it('should return correct actions for SUBMITTED status', () => {
      const actions = getAvailableActions('SUBMITTED');

      expect(actions.canSubmit).toBe(false);
      expect(actions.canApprove).toBe(false);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDownloadPDF).toBe(true);
      expect(actions.canConvertToProject).toBe(false);
    });

    it('should return correct actions for ACCEPTED status', () => {
      const actions = getAvailableActions('ACCEPTED');

      expect(actions.canSubmit).toBe(false);
      expect(actions.canApprove).toBe(false);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDownloadPDF).toBe(true);
      expect(actions.canConvertToProject).toBe(true);
    });

    it('should return correct actions for REJECTED status', () => {
      const actions = getAvailableActions('REJECTED');

      expect(actions.canSubmit).toBe(false);
      expect(actions.canApprove).toBe(false);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDownloadPDF).toBe(false);
      expect(actions.canConvertToProject).toBe(false);
    });
  });
});

describe('Approval Workflow State Transitions', () => {
  it('should follow valid workflow: DRAFT -> PENDING_APPROVAL -> APPROVED -> SUBMITTED', () => {
    // Valid workflow path
    const workflow = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED'] as ProposalStatus[];

    // Each status should allow progression to next
    expect(getAvailableActions('DRAFT').canSubmit).toBe(true);
    expect(getAvailableActions('PENDING_APPROVAL').canApprove).toBe(true);
    expect(getAvailableActions('APPROVED').canDownloadPDF).toBe(true);
    expect(getAvailableActions('SUBMITTED').canDownloadPDF).toBe(true);

    // Verify workflow array is valid
    expect(workflow.length).toBe(4);
  });

  it('should allow rejection workflow: PENDING_APPROVAL -> DRAFT (for revision)', () => {
    // When rejected, proposal goes back to DRAFT for revision
    expect(getAvailableActions('PENDING_APPROVAL').canReject).toBe(true);
    expect(getAvailableActions('DRAFT').canEdit).toBe(true);
  });

  it('should only allow project conversion from ACCEPTED status', () => {
    const statuses: ProposalStatus[] = [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SUBMITTED',
      'ACCEPTED',
      'REJECTED',
    ];

    const canConvertStatuses = statuses.filter(
      (status) => getAvailableActions(status).canConvertToProject
    );

    expect(canConvertStatuses).toEqual(['ACCEPTED']);
  });
});
