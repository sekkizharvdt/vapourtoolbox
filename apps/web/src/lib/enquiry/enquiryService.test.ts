/**
 * Enquiry Service Tests
 *
 * Tests the enquiry lifecycle, bid decision recording, and authorization.
 */

import type { Enquiry, BidEvaluationCriteria, BidDecisionRecord } from '@vapour/types';

// Mock Firestore
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  doc: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => args),
  orderBy: jest.fn((...args: unknown[]) => args),
  limit: jest.fn((...args: unknown[]) => args),
  startAfter: jest.fn((...args: unknown[]) => args),
  Timestamp: {
    now: () => ({ seconds: 1709827200, nanoseconds: 0 }),
  },
  Firestore: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: jest.fn((id: string, data: Record<string, unknown>) => ({ id, ...data })),
  removeUndefinedValues: jest.fn((obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
  ),
}));

jest.mock('@vapour/constants', () => ({
  PERMISSION_FLAGS: { EDIT_ENTITIES: 4 },
  hasPermission: jest.fn((perms: number, flag: number) => (perms & flag) !== 0),
}));

jest.mock('@/lib/auth', () => ({
  requireOwnerOrPermission: jest.fn(
    (userId: string, ownerId: string, perms: number, flag: number, _op: string) => {
      if (userId !== ownerId && (perms & flag) === 0) {
        throw new Error('Permission denied');
      }
    }
  ),
}));

import {
  createEnquiry,
  getEnquiryById,
  updateEnquiryStatus,
  deleteEnquiry,
  recordBidDecision,
  reviseBidDecision,
} from './enquiryService';

const db = {} as never;

const MOCK_EVALUATION: BidEvaluationCriteria = {
  strategicAlignment: { rating: 'STRONG_FIT' },
  winProbability: { rating: 'MEDIUM', notes: 'Good chance' },
  commercialViability: { rating: 'HIGHLY_VIABLE' },
  riskExposure: { rating: 'MODERATE_RISK' },
  capacityCapability: { rating: 'FULLY_CAPABLE' },
};

function makeEnquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'enq-1',
    enquiryNumber: 'ENQ-26-01',
    entityId: 'ent-1',
    clientId: 'client-1',
    clientName: 'Acme Corp',
    title: 'Thermal Plant Enquiry',
    description: 'Engineering enquiry for thermal plant',
    status: 'NEW',
    attachedDocuments: [],
    createdBy: 'user-1',
    createdAt: { seconds: 1709827200, nanoseconds: 0 },
    updatedAt: { seconds: 1709827200, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  } as unknown as Enquiry;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateDoc.mockResolvedValue(undefined);
});

// ── Create Enquiry ──

describe('createEnquiry', () => {
  it('should create an enquiry with generated number', async () => {
    // Client exists
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Acme Corp' }),
    });

    // No existing enquiries (for number generation)
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    mockAddDoc.mockResolvedValue({ id: 'new-enq-id' });

    const result = await createEnquiry(
      db,
      {
        entityId: 'ent-1',
        clientId: 'client-1',
        title: 'Test Enquiry',
        description: 'Description',
        receivedDate: { seconds: 1709827200, nanoseconds: 0 } as never,
        receivedVia: 'EMAIL',
        projectType: 'EPC',
      } as never,
      'user-1'
    );

    expect(result.id).toBe('new-enq-id');
    expect(result.status).toBe('NEW');
    expect(result.clientName).toBe('Acme Corp');
    expect(result.enquiryNumber).toMatch(/^ENQ-\d{2}-\d{2}$/);
  });

  it('should throw when client not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(createEnquiry(db, { clientId: 'nonexistent' } as never, 'user-1')).rejects.toThrow(
      'Client not found'
    );
  });
});

// ── Get Enquiry ──

describe('getEnquiryById', () => {
  it('should return enquiry when found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ title: 'Test', status: 'NEW' }),
    });

    const result = await getEnquiryById(db, 'enq-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('enq-1');
  });

  it('should return null when not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getEnquiryById(db, 'nonexistent');
    expect(result).toBeNull();
  });
});

// ── Update Status ──

describe('updateEnquiryStatus', () => {
  it('should set outcomeDate for terminal statuses (WON/LOST/CANCELLED)', async () => {
    await updateEnquiryStatus(db, 'enq-1', 'WON', 'user-1', 'Client accepted');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'WON',
        outcomeDate: expect.anything(),
        outcomeReason: 'Client accepted',
      })
    );
  });

  it('should set proposalSubmittedAt when submitting proposal', async () => {
    await updateEnquiryStatus(db, 'enq-1', 'PROPOSAL_SUBMITTED', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'PROPOSAL_SUBMITTED',
        proposalSubmittedAt: expect.anything(),
      })
    );
  });

  it('should NOT set outcomeDate for non-terminal statuses', async () => {
    await updateEnquiryStatus(db, 'enq-1', 'UNDER_REVIEW', 'user-1');

    const updateData = mockUpdateDoc.mock.calls[0][1];
    expect(updateData.outcomeDate).toBeUndefined();
  });
});

// ── Delete Enquiry ──

describe('deleteEnquiry', () => {
  it('should allow owner to delete', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ createdBy: 'user-1', status: 'NEW' }),
    });

    await deleteEnquiry(db, 'enq-1', 'user-1', 0);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'CANCELLED' })
    );
  });

  it('should allow user with EDIT_ENTITIES permission to delete', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ createdBy: 'other-user', status: 'NEW' }),
    });

    await deleteEnquiry(db, 'enq-1', 'admin-user', 4); // EDIT_ENTITIES = 4

    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('should deny deletion for non-owner without permission', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ createdBy: 'other-user', status: 'NEW' }),
    });

    await expect(deleteEnquiry(db, 'enq-1', 'user-1', 0)).rejects.toThrow('Permission denied');
  });
});

// ── Record Bid Decision ──

describe('recordBidDecision', () => {
  it('should record BID decision and transition to PROPOSAL_IN_PROGRESS', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'BID_DECISION_PENDING' }) }),
    });

    const result = await recordBidDecision(
      db,
      'enq-1',
      'BID',
      MOCK_EVALUATION,
      'Strong alignment with our capabilities',
      'user-1',
      'Admin User'
    );

    expect(result.status).toBe('PROPOSAL_IN_PROGRESS');
    expect(result.bidDecision!.decision).toBe('BID');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'PROPOSAL_IN_PROGRESS' })
    );
  });

  it('should record NO_BID decision and set outcome fields', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'NEW' }) }),
    });

    const result = await recordBidDecision(
      db,
      'enq-1',
      'NO_BID',
      MOCK_EVALUATION,
      'Too risky',
      'user-1',
      'Admin User'
    );

    expect(result.status).toBe('NO_BID');

    const updateData = mockUpdateDoc.mock.calls[0][1];
    expect(updateData.outcomeDate).toBeDefined();
    expect(updateData.outcomeReason).toContain('Too risky');
  });

  it('should allow bid decision from NEW, UNDER_REVIEW, or BID_DECISION_PENDING', async () => {
    for (const status of ['NEW', 'UNDER_REVIEW', 'BID_DECISION_PENDING'] as const) {
      jest.clearAllMocks();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'enq-1',
        data: () => ({ ...makeEnquiry({ status }) }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await expect(
        recordBidDecision(db, 'enq-1', 'BID', MOCK_EVALUATION, 'Reason', 'u1', 'User')
      ).resolves.toBeDefined();
    }
  });

  it('should reject bid decision for invalid status', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'WON' }) }),
    });

    await expect(
      recordBidDecision(db, 'enq-1', 'BID', MOCK_EVALUATION, 'Reason', 'u1', 'User')
    ).rejects.toThrow('Cannot record bid decision for enquiry in WON status');
  });

  it('should clean undefined notes from evaluation criteria', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'NEW' }) }),
    });

    const evalWithUndefined: BidEvaluationCriteria = {
      strategicAlignment: { rating: 'STRONG_FIT', notes: undefined },
      winProbability: { rating: 'MEDIUM' },
      commercialViability: { rating: 'HIGHLY_VIABLE', notes: 'Good margin' },
      riskExposure: { rating: 'MODERATE_RISK' },
      capacityCapability: { rating: 'FULLY_CAPABLE' },
    };

    await recordBidDecision(db, 'enq-1', 'BID', evalWithUndefined, 'Reason', 'u1', 'User');

    const updateData = mockUpdateDoc.mock.calls[0][1];
    const savedEval = updateData.bidDecision.evaluation;

    // Notes with undefined should NOT be included (Firestore rejects undefined)
    expect(savedEval.strategicAlignment).not.toHaveProperty('notes');
    expect(savedEval.winProbability).not.toHaveProperty('notes');
    // Notes with value should be preserved
    expect(savedEval.commercialViability.notes).toBe('Good margin');
  });
});

// ── Revise Bid Decision ──

describe('reviseBidDecision', () => {
  const existingBidDecision: BidDecisionRecord = {
    decision: 'NO_BID',
    evaluation: MOCK_EVALUATION,
    rationale: 'Initial rejection',
    decidedBy: 'user-1',
    decidedByName: 'Admin User',
    decidedAt: { seconds: 1709827200, nanoseconds: 0 } as never,
  };

  it('should revise NO_BID to BID and store previous decision', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'NO_BID', bidDecision: existingBidDecision }) }),
    });

    // No proposals exist
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    const result = await reviseBidDecision(
      db,
      'enq-1',
      'BID',
      MOCK_EVALUATION,
      'Reconsidered after client updated scope',
      'user-2',
      'Manager'
    );

    expect(result.status).toBe('PROPOSAL_IN_PROGRESS');
    expect(result.bidDecision!.previousDecision).toBeDefined();
    expect(result.bidDecision!.previousDecision!.decision).toBe('NO_BID');

    // Should clear outcome fields when changing from NO_BID to BID
    const updateData = mockUpdateDoc.mock.calls[0][1];
    expect(updateData.outcomeDate).toBeNull();
    expect(updateData.outcomeReason).toBeNull();
  });

  it('should reject revision when no existing bid decision', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({ ...makeEnquiry({ status: 'NEW' }) }),
    });

    await expect(
      reviseBidDecision(db, 'enq-1', 'BID', MOCK_EVALUATION, 'Reason', 'u1', 'User')
    ).rejects.toThrow('No existing bid decision to revise');
  });

  it('should reject revision for terminal statuses', async () => {
    for (const status of ['WON', 'LOST', 'CANCELLED'] as const) {
      jest.clearAllMocks();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'enq-1',
        data: () => ({ ...makeEnquiry({ status, bidDecision: existingBidDecision }) }),
      });

      await expect(
        reviseBidDecision(db, 'enq-1', 'BID', MOCK_EVALUATION, 'Reason', 'u1', 'User')
      ).rejects.toThrow(`Cannot revise bid decision for enquiry in ${status} status`);
    }
  });

  it('should reject revision when proposal already exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'enq-1',
      data: () => ({
        ...makeEnquiry({ status: 'PROPOSAL_IN_PROGRESS', bidDecision: existingBidDecision }),
      }),
    });

    // Proposal exists
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'prop-1' }],
    });

    await expect(
      reviseBidDecision(db, 'enq-1', 'NO_BID', MOCK_EVALUATION, 'Changed mind', 'u1', 'User')
    ).rejects.toThrow('Cannot revise bid decision after a proposal has been created');
  });
});
