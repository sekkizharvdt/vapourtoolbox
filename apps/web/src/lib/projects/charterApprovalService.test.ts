/**
 * Charter Approval Service Tests
 *
 * Tests the charter authorization workflow (B4 — charter approval hygiene):
 * - Submit charter for approval (DRAFT → PENDING_APPROVAL)
 * - Approve charter (PENDING_APPROVAL → APPROVED) with self-approval blocked
 * - Reject charter (PENDING_APPROVAL → DRAFT with reason)
 * - Downstream approve path (cost centre creation, idempotent)
 *
 * Uses the REAL charterApprovalStateMachine so transition rules are tested,
 * not mocked away.
 */

import type { Project } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { Firestore } from 'firebase/firestore';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
  },
}));

const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `projects/${id}` })),
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

// Mock auth functions — preventSelfApproval mirrors the real guard so the
// self-approval tests exercise actual blocking behaviour.
jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  preventSelfApproval: jest.fn((approverId: string, submitterId: string, action: string) => {
    if (approverId === submitterId) {
      throw new Error(`You cannot ${action} that you submitted yourself`);
    }
  }),
}));

// Mock user lookup (approver broadcast)
jest.mock('@/lib/auth/userLookup', () => ({
  getUsersWithPermission: jest.fn().mockResolvedValue(['approver-1', 'approver-2', 'user-123']),
}));

// Mock audit
jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn((userId: string, email: string, name: string) => ({
    userId,
    userEmail: email,
    userName: name,
  })),
}));

// Mock charter validation — valid by default; individual tests override
const mockValidateCharter = jest.fn().mockReturnValue({
  isValid: true,
  errors: [],
  warnings: [],
  completionPercentage: 100,
});
jest.mock('./charterValidationService', () => ({
  validateCharterForApproval: (...args: unknown[]) => mockValidateCharter(...args),
  getValidationSummary: jest.fn(
    (result: { errors: string[] }) => `Errors: ${result.errors.join('; ')}`
  ),
}));

// Mock cost centre creation (dynamically imported by approveCharter)
const mockCreateProjectCostCentre = jest.fn().mockResolvedValue('cost-centre-1');
jest.mock('@/lib/accounting/costCentreService', () => ({
  createProjectCostCentre: (...args: unknown[]) => mockCreateProjectCostCentre(...args),
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

import { submitCharterForApproval, approveCharter, rejectCharter } from './charterApprovalService';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { requirePermission, preventSelfApproval } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit/clientAuditService';

describe('charterApprovalService', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';
  const mockUserName = 'Test User';
  const mockPermissions = PERMISSION_FLAGS.MANAGE_PROJECTS;

  const baseProject: Partial<Project> = {
    id: 'project-123',
    code: 'PRJ-001',
    name: 'Test Project',
    tenantId: 'default-entity',
    budget: {
      estimated: { amount: 100000, currency: 'INR' },
      currency: 'INR',
    } as unknown as Project['budget'],
    charter: {
      authorization: {
        sponsorName: 'Sponsor',
        sponsorTitle: 'Director',
        budgetAuthority: 'Finance',
        approvalStatus: 'DRAFT',
      },
    } as unknown as Project['charter'],
  };

  const projectSnap = (overrides: Record<string, unknown>) => ({
    exists: () => true,
    id: 'project-123',
    data: () => ({ ...baseProject, ...overrides }),
  });

  const withAuthStatus = (
    approvalStatus: string,
    authExtra: Record<string, unknown> = {},
    projectExtra: Record<string, unknown> = {}
  ) =>
    projectSnap({
      charter: {
        authorization: {
          sponsorName: 'Sponsor',
          sponsorTitle: 'Director',
          budgetAuthority: 'Finance',
          approvalStatus,
          ...authExtra,
        },
      },
      ...projectExtra,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCharter.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      completionPercentage: 100,
    });
  });

  describe('submitCharterForApproval', () => {
    it('submits a DRAFT charter for approval and stamps submittedBy/At', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('DRAFT'));

      await submitCharterForApproval(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions
      );

      expect(requirePermission).toHaveBeenCalledWith(
        mockPermissions,
        PERMISSION_FLAGS.MANAGE_PROJECTS,
        mockUserId,
        'submit project charter for approval'
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall['charter.authorization.approvalStatus']).toBe('PENDING_APPROVAL');
      expect(updateCall['charter.authorization.submittedBy']).toBe(mockUserId);
      expect(updateCall['charter.authorization.submittedByName']).toBe(mockUserName);
      expect(updateCall['charter.authorization.submittedAt']).toBeDefined();
      expect(updateCall['charter.authorization.rejectionReason']).toBeNull();

      // Notifies approvers EXCLUDING the submitter (user-123 is in the lookup result)
      expect(createTaskNotification).toHaveBeenCalledTimes(2);
      const notifiedUsers = (createTaskNotification as jest.Mock).mock.calls.map(
        (c) => c[0].userId
      );
      expect(notifiedUsers).toEqual(['approver-1', 'approver-2']);
      expect((createTaskNotification as jest.Mock).mock.calls[0][0].category).toBe(
        'CHARTER_SUBMITTED'
      );

      expect(logAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'CHARTER_SUBMITTED',
        'PROJECT_CHARTER',
        'project-123',
        expect.stringContaining('submitted for approval'),
        expect.anything()
      );
    });

    it('rejects submission when charter is already PENDING_APPROVAL (state machine)', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('PENDING_APPROVAL'));

      await expect(
        submitCharterForApproval(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects submission of an APPROVED charter (terminal state)', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('APPROVED'));

      await expect(
        submitCharterForApproval(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects submission when charter validation fails', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('DRAFT'));
      mockValidateCharter.mockReturnValueOnce({
        isValid: false,
        errors: ['No objectives defined'],
        warnings: [],
        completionPercentage: 40,
      });

      await expect(
        submitCharterForApproval(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow('not ready for approval');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects submission when sponsor details are missing', async () => {
      mockGetDoc.mockResolvedValueOnce(
        projectSnap({
          charter: { authorization: { sponsorName: '', approvalStatus: 'DRAFT' } },
        })
      );

      await expect(
        submitCharterForApproval(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow('sponsor details');
    });

    it('throws when project not found', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      await expect(
        submitCharterForApproval(mockDb, 'missing', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow('Project not found');
    });
  });

  describe('approveCharter', () => {
    it('approves a PENDING_APPROVAL charter submitted by another user', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus('PENDING_APPROVAL', { submittedBy: 'submitter-456' })
      );

      await approveCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions);

      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        'submitter-456',
        'approve project charter'
      );

      // First update: the approval transition — this fires the
      // onCharterApproved Cloud Function (before != APPROVED → after == APPROVED)
      const approvalUpdate = mockUpdateDoc.mock.calls[0][1];
      expect(approvalUpdate['charter.authorization.approvalStatus']).toBe('APPROVED');
      expect(approvalUpdate['charter.authorization.approvedBy']).toBe(mockUserId);
      expect(approvalUpdate['charter.authorization.approvedAt']).toBeDefined();
      expect(approvalUpdate['charter.authorization.authorizedDate']).toBeDefined();

      // Downstream path: cost centre created and linked (project had none)
      expect(mockCreateProjectCostCentre).toHaveBeenCalledWith(
        mockDb,
        'project-123',
        'PRJ-001',
        'Test Project',
        100000,
        mockUserId,
        mockUserName,
        mockPermissions
      );
      const costCentreUpdate = mockUpdateDoc.mock.calls[1][1];
      expect(costCentreUpdate.costCentreId).toBe('cost-centre-1');

      // Submitter notified
      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'CHARTER_APPROVED', userId: 'submitter-456' })
      );

      expect(logAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'CHARTER_APPROVED',
        'PROJECT_CHARTER',
        'project-123',
        expect.stringContaining('approved'),
        expect.anything()
      );
    });

    it('blocks self-approval — submitter cannot approve their own charter', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus('PENDING_APPROVAL', { submittedBy: mockUserId })
      );

      await expect(
        approveCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        mockUserId,
        'approve project charter'
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects approval of a DRAFT charter — must be submitted first', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('DRAFT'));

      await expect(
        approveCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('skips cost centre creation when the project already has one (idempotent)', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus(
          'PENDING_APPROVAL',
          { submittedBy: 'submitter-456' },
          { costCentreId: 'existing-cc' }
        )
      );

      await approveCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions);

      expect(mockCreateProjectCostCentre).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1); // approval write only
    });

    it('auto-completes the pending review task', async () => {
      (findTaskNotificationByEntity as jest.Mock).mockResolvedValueOnce({ id: 'task-1' });
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus('PENDING_APPROVAL', { submittedBy: 'submitter-456' })
      );

      await approveCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions);

      expect(findTaskNotificationByEntity).toHaveBeenCalledWith(
        'PROJECT',
        'project-123',
        'CHARTER_SUBMITTED',
        'in_progress'
      );
      expect(completeActionableTask).toHaveBeenCalledWith('task-1', mockUserId, true);
    });
  });

  describe('rejectCharter', () => {
    it('returns a PENDING_APPROVAL charter to DRAFT with the reason', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus('PENDING_APPROVAL', { submittedBy: 'submitter-456' })
      );

      await rejectCharter(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions,
        'Budget section incomplete'
      );

      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        'submitter-456',
        'reject project charter'
      );

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall['charter.authorization.approvalStatus']).toBe('DRAFT');
      expect(updateCall['charter.authorization.rejectionReason']).toBe('Budget section incomplete');

      expect(createTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'CHARTER_REJECTED', userId: 'submitter-456' })
      );

      expect(logAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'CHARTER_REJECTED',
        'PROJECT_CHARTER',
        'project-123',
        expect.stringContaining('Budget section incomplete'),
        expect.anything()
      );
    });

    it('requires a rejection reason', async () => {
      await expect(
        rejectCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions, '   ')
      ).rejects.toThrow('rejection reason is required');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('blocks the submitter from rejecting their own charter', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withAuthStatus('PENDING_APPROVAL', { submittedBy: mockUserId })
      );

      await expect(
        rejectCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions, 'reason')
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects the transition when charter is not PENDING_APPROVAL', async () => {
      mockGetDoc.mockResolvedValueOnce(withAuthStatus('APPROVED'));

      await expect(
        rejectCharter(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions, 'reason')
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
