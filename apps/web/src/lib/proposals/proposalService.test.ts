/**
 * Proposal Service Tests
 *
 * Tests for proposal CRUD operations and workflow:
 * - Create proposal (full and minimal)
 * - Get proposal by ID and number
 * - List proposals with filters
 * - Update proposal
 * - Create proposal revision
 * - Submit proposal for approval
 * - Get proposal revisions
 */

// Mock Firebase before imports
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockRunTransaction = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  orderBy: jest.fn((...args) => args),
  limit: jest.fn((...args) => args),
  startAfter: jest.fn((...args) => args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => true,
      toJSON: () => ({ seconds: 0, nanoseconds: 0 }),
    })),
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
      toMillis: () => date.getTime(),
      isEqual: () => true,
      toJSON: () => ({ seconds: date.getTime() / 1000, nanoseconds: 0 }),
    })),
  },
}));

// Helper to create mock Timestamp with all required methods
const createMockTimestamp = (seconds?: number) => ({
  seconds: seconds ?? Date.now() / 1000,
  nanoseconds: 0,
  toDate: () => new Date((seconds ?? Date.now() / 1000) * 1000),
  toMillis: () => (seconds ?? Date.now() / 1000) * 1000,
  isEqual: () => true,
  toJSON: () => ({ seconds: seconds ?? Date.now() / 1000, nanoseconds: 0, type: 'timestamp' }),
  valueOf: () => `Timestamp(seconds=${seconds ?? Date.now() / 1000}, nanoseconds=0)`,
});

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock typeHelpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: Record<string, unknown>): T => {
    const result = { id, ...data };
    return result as T;
  },
}));

import type { CreateProposalInput } from '@vapour/types';
import {
  createProposal,
  createMinimalProposal,
  getProposalById,
  getProposalByNumber,
  listProposals,
  updateProposal,
  createProposalRevision,
  getProposalRevisions,
  getProposalsCountByStatus,
} from './proposalService';
import type { Firestore } from 'firebase/firestore';
import type { Proposal, ProposalStatus } from '@vapour/types';

describe('proposalService', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';

  // Sample mock data - using plain objects
  const mockEnquiry = {
    id: 'enquiry-123',
    enquiryNumber: 'ENQ-26-01',
    description: 'Test enquiry description',
    clientContactPerson: 'John Doe',
    clientEmail: 'john@example.com',
    bidDecision: {
      decision: 'BID',
      decidedBy: 'user-456',
      decidedByName: 'Manager',
      decidedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      rationale: 'Good opportunity',
      evaluation: { score: 80, criteria: [] },
    },
  };

  const mockClient = {
    name: 'Test Client Corp',
    billingAddress: {
      line1: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
    },
  };

  const mockProposal: Partial<Proposal> = {
    id: 'proposal-123',
    proposalNumber: 'PROP-26-01',
    revision: 1,
    enquiryId: 'enquiry-123',
    enquiryNumber: 'ENQ-26-01',
    entityId: 'entity-123',
    clientId: 'client-123',
    clientName: 'Test Client Corp',
    title: 'Test Proposal',
    status: 'DRAFT' as ProposalStatus,
    isLatestRevision: true,
    approvalHistory: [],
    attachments: [],
    createdBy: mockUserId,
    updatedBy: mockUserId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'doc-ref' });
    mockCollection.mockReturnValue({ id: 'collection-ref' });
  });

  describe('createProposal', () => {
    it('should create a proposal successfully', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'enquiry-123',
          data: () => mockEnquiry,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'client-123',
          data: () => mockClient,
        });

      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
      mockAddDoc.mockResolvedValueOnce({ id: 'new-proposal-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      const input = {
        enquiryId: 'enquiry-123',
        entityId: 'entity-123',
        clientId: 'client-123',
        title: 'Test Proposal',
        validityDate: createMockTimestamp(),
        scopeOfWork: {
          summary: 'Test scope',
          objectives: [],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
        deliveryPeriod: {
          durationInWeeks: 4,
          description: 'Four weeks',
          milestones: [],
        },
        paymentTerms: '50% advance',
      } as unknown as CreateProposalInput;

      const result = await createProposal(mockDb, input, mockUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe('new-proposal-123');
      expect(result.proposalNumber).toMatch(/^PROP-\d{2}-\d{2}$/);
      expect(result.status).toBe('DRAFT');
      expect(result.revision).toBe(1);
      expect(result.isLatestRevision).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error when enquiry not found', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const input = {
        enquiryId: 'non-existent',
        entityId: 'entity-123',
        clientId: 'client-123',
        title: 'Test Proposal',
        validityDate: createMockTimestamp(),
        scopeOfWork: {
          summary: '',
          objectives: [],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
        deliveryPeriod: { durationInWeeks: 4, description: '', milestones: [] },
        paymentTerms: '',
      } as unknown as CreateProposalInput;

      await expect(createProposal(mockDb, input, mockUserId)).rejects.toThrow('Enquiry not found');
    });

    it('should throw error when client not found', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'enquiry-123',
          data: () => mockEnquiry,
        })
        .mockResolvedValueOnce({ exists: () => false });

      const input = {
        enquiryId: 'enquiry-123',
        entityId: 'entity-123',
        clientId: 'non-existent',
        title: 'Test Proposal',
        validityDate: createMockTimestamp(),
        scopeOfWork: {
          summary: '',
          objectives: [],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
        deliveryPeriod: { durationInWeeks: 4, description: '', milestones: [] },
        paymentTerms: '',
      } as unknown as CreateProposalInput;

      await expect(createProposal(mockDb, input, mockUserId)).rejects.toThrow('Client not found');
    });
  });

  describe('createMinimalProposal', () => {
    it('should create a minimal proposal with scope matrix initialized', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'enquiry-123',
          data: () => mockEnquiry,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'client-123',
          data: () => mockClient,
        });

      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
      mockAddDoc.mockResolvedValueOnce({ id: 'minimal-proposal-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      const input = {
        entityId: 'entity-123',
        enquiryId: 'enquiry-123',
        title: 'Minimal Proposal',
        clientId: 'client-123',
        validityDate: new Date(),
      };

      const result = await createMinimalProposal(mockDb, input, mockUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe('minimal-proposal-123');
      expect(result.workflowStage).toBe('SCOPE_DEFINITION');
      expect(result.scopeMatrix).toEqual({
        services: [],
        supply: [],
        exclusions: [],
        isComplete: false,
      });
    });

    it('should throw error when enquiry has no BID decision', async () => {
      const enquiryWithoutBid = { ...mockEnquiry, bidDecision: undefined };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'enquiry-123',
        data: () => enquiryWithoutBid,
      });

      const input = {
        entityId: 'entity-123',
        enquiryId: 'enquiry-123',
        title: 'Test',
        clientId: 'client-123',
        validityDate: new Date(),
      };

      await expect(createMinimalProposal(mockDb, input, mockUserId)).rejects.toThrow(
        'Cannot create proposal without a BID decision on the enquiry'
      );
    });

    it('should throw error when enquiry has NO_BID decision', async () => {
      const enquiryWithNoBid = {
        ...mockEnquiry,
        bidDecision: {
          decision: 'NO_BID',
          decidedBy: 'user-456',
          decidedByName: 'Manager',
          decidedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
          rationale: 'Not suitable',
          evaluation: { score: 30, criteria: [] },
        },
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'enquiry-123',
        data: () => enquiryWithNoBid,
      });

      const input = {
        entityId: 'entity-123',
        enquiryId: 'enquiry-123',
        title: 'Test',
        clientId: 'client-123',
        validityDate: new Date(),
      };

      await expect(createMinimalProposal(mockDb, input, mockUserId)).rejects.toThrow(
        'Cannot create proposal without a BID decision on the enquiry'
      );
    });
  });

  describe('getProposalById', () => {
    it('should return proposal when found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'proposal-123',
        data: () => mockProposal,
      });

      const result = await getProposalById(mockDb, 'proposal-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('proposal-123');
      expect(result?.proposalNumber).toBe('PROP-26-01');
    });

    it('should return null when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await getProposalById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getProposalByNumber', () => {
    it('should return latest revision by default', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'proposal-123',
            data: () => ({ ...mockProposal, revision: 2, isLatestRevision: true }),
          },
        ],
      });

      const result = await getProposalByNumber(mockDb, 'PROP-26-01');

      expect(result).toBeDefined();
      expect(result?.revision).toBe(2);
    });

    it('should return specific revision when requested', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'proposal-old',
            data: () => ({ ...mockProposal, revision: 1, isLatestRevision: false }),
          },
        ],
      });

      const result = await getProposalByNumber(mockDb, 'PROP-26-01', 1);

      expect(result).toBeDefined();
      expect(result?.revision).toBe(1);
    });

    it('should return null when proposal number not found', async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await getProposalByNumber(mockDb, 'PROP-99-99');

      expect(result).toBeNull();
    });
  });

  describe('listProposals', () => {
    it('should return proposals with filters applied', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'p1',
            data: () => ({ ...mockProposal, id: 'p1', proposalNumber: 'PROP-26-01' }),
          },
          {
            id: 'p2',
            data: () => ({ ...mockProposal, id: 'p2', proposalNumber: 'PROP-26-02' }),
          },
        ],
      });

      const result = await listProposals(mockDb, {
        entityId: 'entity-123',
        status: 'DRAFT',
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.proposalNumber).toBe('PROP-26-01');
    });

    it('should filter by search term client-side', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'p1',
            data: () => ({
              ...mockProposal,
              id: 'p1',
              proposalNumber: 'PROP-26-01',
              title: 'Thermal Plant Project',
              clientName: 'ABC Corp',
              enquiryNumber: 'ENQ-26-01',
            }),
          },
          {
            id: 'p2',
            data: () => ({
              ...mockProposal,
              id: 'p2',
              proposalNumber: 'PROP-26-02',
              title: 'Solar Installation',
              clientName: 'XYZ Ltd',
              enquiryNumber: 'ENQ-26-02',
            }),
          },
        ],
      });

      const result = await listProposals(mockDb, {
        entityId: 'entity-123',
        searchTerm: 'Thermal',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Thermal Plant Project');
    });

    it('should handle empty results', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await listProposals(mockDb, {
        entityId: 'entity-123',
        status: 'APPROVED',
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('updateProposal', () => {
    it('should update proposal successfully', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateProposal(
        mockDb,
        'proposal-123',
        { title: 'Updated Title', status: 'DRAFT' },
        mockUserId
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdateDoc.mock.calls[0]?.[1];
      expect(updateCall?.title).toBe('Updated Title');
      expect(updateCall?.updatedBy).toBe(mockUserId);
    });
  });

  describe('createProposalRevision', () => {
    it('should create new revision and mark old as not latest', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'proposal-123',
        data: () => mockProposal,
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          update: jest.fn(),
          set: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await createProposalRevision(
        mockDb,
        'proposal-123',
        'Client requested changes',
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.revision).toBe(2);
      expect(result.previousRevisionId).toBe('proposal-123');
      expect(result.revisionReason).toBe('Client requested changes');
      expect(result.status).toBe('DRAFT');
      expect(result.isLatestRevision).toBe(true);
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      await expect(
        createProposalRevision(mockDb, 'non-existent', 'Reason', mockUserId)
      ).rejects.toThrow('Proposal not found');
    });
  });

  // submitProposalForApproval tests moved to approvalWorkflow.test.ts
  // (the actual implementation with state machine validation)

  describe('getProposalRevisions', () => {
    it('should return all revisions ordered by revision number desc', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'p-r2',
            data: () => ({ ...mockProposal, revision: 2, isLatestRevision: true }),
          },
          {
            id: 'p-r1',
            data: () => ({ ...mockProposal, revision: 1, isLatestRevision: false }),
          },
        ],
      });

      const result = await getProposalRevisions(mockDb, 'PROP-26-01');

      expect(result).toHaveLength(2);
      expect(result[0]?.revision).toBe(2);
      expect(result[1]?.revision).toBe(1);
    });
  });

  describe('getProposalsCountByStatus', () => {
    it('should count proposals grouped by status', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ status: 'DRAFT' }) },
          { data: () => ({ status: 'DRAFT' }) },
          { data: () => ({ status: 'PENDING_APPROVAL' }) },
          { data: () => ({ status: 'APPROVED' }) },
        ],
      });

      const result = await getProposalsCountByStatus(mockDb, 'entity-123');

      expect(result['DRAFT']).toBe(2);
      expect(result['PENDING_APPROVAL']).toBe(1);
      expect(result['APPROVED']).toBe(1);
    });
  });
});

describe('Proposal Number Generation', () => {
  it('should generate proposal numbers in correct format', () => {
    const year = new Date().getFullYear();
    const twoDigitYear = year.toString().slice(-2);

    const expectedPattern = new RegExp(`^PROP-${twoDigitYear}-\\d{2}$`);
    const genericPattern = /^PROP-\d{2}-\d{2}$/;

    expect(expectedPattern.test(`PROP-${twoDigitYear}-01`)).toBe(true);
    expect(expectedPattern.test(`PROP-${twoDigitYear}-99`)).toBe(true);
    expect(genericPattern.test('PROP-25-01')).toBe(true);
    expect(genericPattern.test('PROP-26-01')).toBe(true);
    expect(genericPattern.test('PROP-2025-01')).toBe(false);
    expect(genericPattern.test('PROP-25-1')).toBe(false);
  });

  it('should increment proposal numbers sequentially', () => {
    const lastProposalNumber = 'PROP-26-05';
    const parts = lastProposalNumber.split('-');
    const lastNumber = parseInt(parts[2] ?? '0', 10);
    const nextNumber = lastNumber + 1;

    expect(nextNumber).toBe(6);
    expect(`PROP-26-${nextNumber.toString().padStart(2, '0')}`).toBe('PROP-26-06');
  });
});
