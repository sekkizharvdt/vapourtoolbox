/**
 * Order Acceptance Service Tests
 *
 * Mirrors charterApprovalService.test.ts's mocking style: real state
 * machine + real deliverableService pure helpers so transition rules and
 * the deliverables merge are actually exercised, not mocked away.
 */

import type { Project, OrderAcceptanceRecord } from '@vapour/types';
import type { Firestore, Timestamp } from 'firebase/firestore';

/** Minimal fake Timestamp for test fixtures — only the shape the service under test touches. */
function fakeTimestamp(overrides: Partial<{ toDate: () => Date }> = {}): Timestamp {
  return {
    seconds: 1,
    nanoseconds: 0,
    toDate: () => new Date(),
    ...overrides,
  } as unknown as Timestamp;
}

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: { PROJECTS: 'projects' },
}));

const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `projects/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// preventSelfApproval mirrors the real guard so self-approval tests exercise
// actual blocking behaviour (same style as charterApprovalService.test.ts).
jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
  preventSelfApproval: jest.fn((approverId: string, submitterId: string, action: string) => {
    if (approverId === submitterId) {
      throw new Error(`You cannot ${action} that you submitted yourself`);
    }
  }),
}));

jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn((userId: string, email: string, name: string) => ({
    userId,
    userEmail: email,
    userName: name,
  })),
}));

jest.mock('@/lib/firebase/retryOnStaleToken', () => ({
  retryOnStaleToken: (op: () => Promise<unknown>) => op(),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

// NOTE: './deliverableService' is intentionally NOT mocked — approveOrderAcceptance
// relies on its real computeProjectProgress/mergeDeliverablesBatch pure helpers,
// and this test asserts on their actual output.

import {
  saveOrderAcceptanceDraft,
  submitOrderAcceptanceForApproval,
  approveOrderAcceptance,
  rejectOrderAcceptance,
  reopenOrderAcceptance,
} from './orderAcceptanceService';
import { requirePermission, preventSelfApproval } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit/clientAuditService';

describe('orderAcceptanceService', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';
  const mockUserName = 'Test User';
  const mockPermissions = 0;

  // Fixture charter is deliberately partial (missing objectives/scope/risks/
  // stakeholders — irrelevant to this service's tests); cast through
  // `unknown` on its own declaration rather than inline on the object
  // literal so `charter: baseCharter` below stays assertion-free.
  const baseCharter = {
    authorization: { sponsorName: 'Sponsor', approvalStatus: 'APPROVED' },
    deliveryPeriod: { duration: 180 },
    deliverables: [
      {
        id: 'del-existing',
        name: 'Existing Deliverable',
        description: 'desc',
        type: 'DOCUMENT',
        acceptanceCriteria: [],
        status: 'ACCEPTED',
      },
    ],
  } as unknown as NonNullable<Project['charter']>;

  const baseProject: Partial<Project> = {
    id: 'project-123',
    code: 'PRJ-001',
    name: 'Test Project',
    tenantId: 'default-entity',
    charter: baseCharter,
  };

  const projectSnap = (overrides: Record<string, unknown>) => ({
    exists: () => true,
    id: 'project-123',
    data: () => ({ ...baseProject, ...overrides }),
  });

  const withOA = (
    oaOverrides: Partial<OrderAcceptanceRecord> = {},
    charterExtra: Record<string, unknown> = {}
  ) =>
    projectSnap({
      charter: {
        ...(baseProject.charter as object),
        ...charterExtra,
        orderAcceptance: {
          terms: {},
          status: 'DRAFT',
          applied: false,
          createdBy: 'someone',
          createdAt: fakeTimestamp(),
          ...oaOverrides,
        },
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('saveOrderAcceptanceDraft', () => {
    it('creates a new DRAFT record when none exists yet', async () => {
      mockGetDoc.mockResolvedValueOnce(projectSnap({}));

      await saveOrderAcceptanceDraft(
        mockDb,
        'project-123',
        { documentReference: 'PO26XP062901', terms: { paymentTermsDays: 30 } },
        mockUserId,
        mockUserName,
        mockPermissions
      );

      expect(requirePermission).toHaveBeenCalledWith(
        mockPermissions,
        expect.any(Number),
        mockUserId,
        'save order acceptance draft'
      );
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      const record = updateCall['charter.orderAcceptance'];
      expect(record.status).toBe('DRAFT');
      expect(record.applied).toBe(false);
      expect(record.createdBy).toBe(mockUserId);
      expect(record.documentReference).toBe('PO26XP062901');
      expect(record.terms.paymentTermsDays).toBe(30);
    });

    it('preserves createdBy/createdAt when updating an existing DRAFT record', async () => {
      const originalCreatedAt = fakeTimestamp();
      mockGetDoc.mockResolvedValueOnce(
        withOA({ createdBy: 'original-author', createdAt: originalCreatedAt })
      );

      await saveOrderAcceptanceDraft(
        mockDb,
        'project-123',
        { terms: { paymentTermsDays: 45 } },
        mockUserId,
        mockUserName,
        mockPermissions
      );

      const record = mockUpdateDoc.mock.calls[0][1]['charter.orderAcceptance'];
      expect(record.createdBy).toBe('original-author');
      expect(record.createdAt).toBe(originalCreatedAt);
      expect(record.updatedBy).toBe(mockUserId);
    });

    it('rejects edits while the record is PENDING_APPROVAL', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'PENDING_APPROVAL' }));

      await expect(
        saveOrderAcceptanceDraft(
          mockDb,
          'project-123',
          { terms: {} },
          mockUserId,
          mockUserName,
          mockPermissions
        )
      ).rejects.toThrow('cannot be edited');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects edits while the record is APPROVED (terminal)', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'APPROVED', applied: true }));

      await expect(
        saveOrderAcceptanceDraft(
          mockDb,
          'project-123',
          { terms: {} },
          mockUserId,
          mockUserName,
          mockPermissions
        )
      ).rejects.toThrow('cannot be edited');
    });

    it('points a REJECTED-record edit attempt at reopenOrderAcceptance', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'REJECTED', rejectionReason: 'nope' }));

      await expect(
        saveOrderAcceptanceDraft(
          mockDb,
          'project-123',
          { terms: {} },
          mockUserId,
          mockUserName,
          mockPermissions
        )
      ).rejects.toThrow('reopenOrderAcceptance');
    });
  });

  describe('submitOrderAcceptanceForApproval', () => {
    it('submits a DRAFT record and stamps submittedBy/At', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'DRAFT' }));

      await submitOrderAcceptanceForApproval(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions
      );

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall['charter.orderAcceptance.status']).toBe('PENDING_APPROVAL');
      expect(updateCall['charter.orderAcceptance.submittedBy']).toBe(mockUserId);
      expect(updateCall['charter.orderAcceptance.submittedByName']).toBe(mockUserName);
    });

    it('throws when no order acceptance draft exists', async () => {
      mockGetDoc.mockResolvedValueOnce(projectSnap({}));

      await expect(
        submitOrderAcceptanceForApproval(
          mockDb,
          'project-123',
          mockUserId,
          mockUserName,
          mockPermissions
        )
      ).rejects.toThrow('No order acceptance draft');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects submission when already PENDING_APPROVAL (state machine)', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'PENDING_APPROVAL' }));

      await expect(
        submitOrderAcceptanceForApproval(
          mockDb,
          'project-123',
          mockUserId,
          mockUserName,
          mockPermissions
        )
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('approveOrderAcceptance', () => {
    function mockTransactionWith(snap: ReturnType<typeof withOA>) {
      const mockTxUpdate = jest.fn();
      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (tx: unknown) => Promise<void>) => {
          const tx = { get: jest.fn().mockResolvedValue(snap), update: mockTxUpdate };
          await callback(tx);
        }
      );
      return mockTxUpdate;
    }

    it('applies schedule, payment terms, key personnel, and deliverables onto the charter', async () => {
      const scheduleStart = fakeTimestamp({ toDate: () => new Date('2026-01-01T00:00:00Z') });
      const snap = withOA({
        status: 'PENDING_APPROVAL',
        submittedBy: 'submitter-456',
        terms: {
          scheduleDurationDays: 90,
          scheduleStartDate: scheduleStart,
          paymentTermsDays: 45,
          retentionPercentage: 5,
          paymentMilestones: [
            { description: 'On delivery', paymentPercentage: 100, triggerType: 'SUBMISSION' },
          ],
          keyPersonnel: [{ name: 'Jane Doe', role: 'PM' }],
          deliverables: [{ name: 'New Deliverable', type: 'DOCUMENT' }],
        },
      });
      const mockTxUpdate = mockTransactionWith(snap as never);

      await approveOrderAcceptance(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions
      );

      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        'submitter-456',
        'approve order acceptance terms'
      );

      expect(mockTxUpdate).toHaveBeenCalledTimes(1);
      const updateData = mockTxUpdate.mock.calls[0][1];

      // Order acceptance record: APPROVED + applied
      expect(updateData['charter.orderAcceptance'].status).toBe('APPROVED');
      expect(updateData['charter.orderAcceptance'].applied).toBe(true);
      expect(updateData['charter.orderAcceptance'].approvedBy).toBe(mockUserId);

      // Schedule override — duration 90 given, start date given -> endDate computed
      expect(updateData['charter.deliveryPeriod'].duration).toBe(90);
      expect(updateData['charter.deliveryPeriod'].startDate).toBe(scheduleStart);
      expect(updateData['charter.deliveryPeriod'].endDate).toBeDefined();

      // Payment terms
      expect(updateData['charter.paymentTerms']).toEqual({
        termsDays: 45,
        retentionPercentage: 5,
        milestones: [
          { description: 'On delivery', paymentPercentage: 100, triggerType: 'SUBMISSION' },
        ],
      });

      // Key personnel
      expect(updateData['charter.keyPersonnel']).toEqual([{ name: 'Jane Doe', role: 'PM' }]);

      // Deliverables — existing preserved, new one appended (batch-seeded)
      const deliverables = updateData['charter.deliverables'];
      expect(deliverables).toHaveLength(2);
      expect(deliverables[0].id).toBe('del-existing');
      expect(deliverables[1].name).toBe('New Deliverable');
      expect(deliverables[1].status).toBe('PENDING');

      // Progress recomputed once from the merged deliverable list (1 of 2 accepted = 50%)
      expect(updateData.progress).toEqual({
        percentage: 50,
        completedMilestones: 1,
        totalMilestones: 2,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        'PROJECT_UPDATED',
        'PROJECT',
        'project-123',
        expect.stringContaining('applied to charter'),
        expect.anything()
      );
    });

    it('only overrides schedule fields that were actually provided (partial override)', async () => {
      const snap = withOA(
        {
          status: 'PENDING_APPROVAL',
          submittedBy: 'submitter-456',
          terms: { scheduleDurationDays: 60 }, // no start date given
        },
        { deliveryPeriod: { duration: 180, description: 'original schedule' } }
      );
      const mockTxUpdate = mockTransactionWith(snap as never);

      await approveOrderAcceptance(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions
      );

      const updateData = mockTxUpdate.mock.calls[0][1];
      expect(updateData['charter.deliveryPeriod'].duration).toBe(60); // overridden
      expect(updateData['charter.deliveryPeriod'].description).toBe('original schedule'); // preserved
      expect(updateData['charter.deliveryPeriod'].startDate).toBeUndefined(); // never set
    });

    it('blocks self-approval — submitter cannot approve their own terms', async () => {
      const snap = withOA({ status: 'PENDING_APPROVAL', submittedBy: mockUserId });
      mockTransactionWith(snap as never);

      await expect(
        approveOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        mockUserId,
        'approve order acceptance terms'
      );
    });

    it('rejects approval of a DRAFT record — must be submitted first', async () => {
      const snap = withOA({ status: 'DRAFT' });
      mockTransactionWith(snap as never);

      await expect(
        approveOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
    });
  });

  describe('rejectOrderAcceptance', () => {
    it('returns a PENDING_APPROVAL record to REJECTED with the reason', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withOA({ status: 'PENDING_APPROVAL', submittedBy: 'submitter-456' })
      );

      await rejectOrderAcceptance(
        mockDb,
        'project-123',
        mockUserId,
        mockUserName,
        mockPermissions,
        'Terms unacceptable'
      );

      expect(preventSelfApproval).toHaveBeenCalledWith(
        mockUserId,
        'submitter-456',
        'reject order acceptance terms'
      );
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall['charter.orderAcceptance.status']).toBe('REJECTED');
      expect(updateCall['charter.orderAcceptance.rejectionReason']).toBe('Terms unacceptable');
    });

    it('requires a rejection reason', async () => {
      await expect(
        rejectOrderAcceptance(
          mockDb,
          'project-123',
          mockUserId,
          mockUserName,
          mockPermissions,
          '  '
        )
      ).rejects.toThrow('rejection reason is required');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('blocks the submitter from rejecting their own terms', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withOA({ status: 'PENDING_APPROVAL', submittedBy: mockUserId })
      );

      await expect(
        rejectOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions, 'x')
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects the transition when the record is not PENDING_APPROVAL', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'DRAFT' }));

      await expect(
        rejectOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions, 'x')
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('reopenOrderAcceptance', () => {
    it('reopens a REJECTED record back to DRAFT', async () => {
      mockGetDoc.mockResolvedValueOnce(
        withOA({ status: 'REJECTED', rejectionReason: 'not acceptable' })
      );

      await reopenOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions);

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall['charter.orderAcceptance.status']).toBe('DRAFT');
      expect(updateCall['charter.orderAcceptance.rejectionReason']).toBeNull();
    });

    it('throws when no order acceptance record exists', async () => {
      mockGetDoc.mockResolvedValueOnce(projectSnap({}));

      await expect(
        reopenOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow('No order acceptance record');
    });

    it('rejects the transition when the record is not REJECTED', async () => {
      mockGetDoc.mockResolvedValueOnce(withOA({ status: 'DRAFT' }));

      await expect(
        reopenOrderAcceptance(mockDb, 'project-123', mockUserId, mockUserName, mockPermissions)
      ).rejects.toThrow();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
