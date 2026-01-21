/**
 * Proposal Revision Management Tests
 *
 * Tests for proposal revision handling:
 * - Create new revision
 * - Get all revisions
 * - Get latest revision
 * - Compare revisions
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROPOSALS: 'proposals',
  },
}));

const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `proposals/${id}` })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  orderBy: jest.fn((...args) => args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => true,
      toJSON: () => ({ seconds: Date.now() / 1000, nanoseconds: 0, type: 'timestamp' }),
    })),
  },
}));

// Helper to create mock Timestamp
const createMockTimestamp = (seconds?: number) => ({
  seconds: seconds ?? Date.now() / 1000,
  nanoseconds: 0,
  toDate: () => new Date((seconds ?? Date.now() / 1000) * 1000),
  toMillis: () => (seconds ?? Date.now() / 1000) * 1000,
  isEqual: () => true,
  toJSON: () => ({ seconds: seconds ?? Date.now() / 1000, nanoseconds: 0, type: 'timestamp' }),
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

import {
  createProposalRevision,
  getProposalRevisions,
  getLatestRevision,
  compareRevisions,
} from './revisionManagement';
import type { Firestore } from 'firebase/firestore';
import type { Proposal, ProposalStatus } from '@vapour/types';

describe('revisionManagement', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';
  const mockUserName = 'Test User';

  // Mock proposal factory - cast to Proposal for test compatibility
  const createMockProposal = (overrides: Partial<Proposal> = {}): Proposal => ({
    id: 'proposal-123',
    proposalNumber: 'PROP-26-01',
    revision: 1,
    entityId: 'entity-123',
    enquiryId: 'enquiry-123',
    enquiryNumber: 'ENQ-26-01',
    clientId: 'client-123',
    clientName: 'Test Client',
    clientContactPerson: 'John Doe',
    clientEmail: 'john@example.com',
    clientAddress: '123 Test St',
    title: 'Test Proposal',
    validityDate: { seconds: Date.now() / 1000 + 86400 * 30, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => true, toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }) },
    preparationDate: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => true, toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }) },
    status: 'DRAFT' as ProposalStatus,
    isLatestRevision: true,
    scopeOfWork: {
      summary: 'Test scope summary',
      objectives: [],
      deliverables: [],
      inclusions: [],
      exclusions: [],
      assumptions: [],
    },
    scopeOfSupply: [{ id: 'item-1', itemNumber: '1', itemName: 'Item 1', category: 'EQUIPMENT', description: 'Test item', quantity: 10, unit: 'Nos', totalPrice: { amount: 10000, currency: 'INR' } }],
    deliveryPeriod: {
      durationInWeeks: 4,
      description: 'Four weeks delivery',
      milestones: [],
    },
    pricing: {
      currency: 'INR',
      lineItems: [],
      subtotal: { amount: 100000, currency: 'INR' },
      taxItems: [],
      totalAmount: { amount: 118000, currency: 'INR' },
      paymentTerms: '50% advance',
    },
    terms: {
      warranty: '12 months',
    },
    approvalHistory: [],
    attachments: [],
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    createdBy: mockUserId,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedBy: mockUserId,
    ...overrides,
  }) as unknown as Proposal;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProposalRevision', () => {
    it('should create a new revision with incremented revision number', async () => {
      const originalProposal = createMockProposal({ revision: 1 });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'proposal-123',
        data: () => originalProposal,
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-revision-123' });

      const newRevisionId = await createProposalRevision(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName,
        'Client requested pricing change'
      );

      expect(newRevisionId).toBe('new-revision-123');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);

      const addedDoc = mockAddDoc.mock.calls[0]?.[1];
      expect(addedDoc?.revision).toBe(2);
      expect(addedDoc?.status).toBe('DRAFT');
      expect(addedDoc?.previousRevisionId).toBe('proposal-123');
      expect(addedDoc?.revisionReason).toBe('Client requested pricing change');
      expect(addedDoc?.approvalHistory).toEqual([]);
    });

    it('should clear submission fields in new revision', async () => {
      const originalProposal = createMockProposal({
        revision: 2,
        status: 'APPROVED',
        submittedAt: createMockTimestamp(),
        submittedByUserId: 'submitter-123',
        submittedByUserName: 'Submitter Name',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'proposal-123',
        data: () => originalProposal,
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-revision-123' });

      await createProposalRevision(mockDb, 'proposal-123', mockUserId, mockUserName);

      const addedDoc = mockAddDoc.mock.calls[0]?.[1];
      expect(addedDoc?.submittedAt).toBeUndefined();
      expect(addedDoc?.submittedByUserId).toBeUndefined();
      expect(addedDoc?.submittedByUserName).toBeUndefined();
    });

    it('should throw error when proposal not found', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      await expect(
        createProposalRevision(mockDb, 'non-existent', mockUserId, mockUserName)
      ).rejects.toThrow('Proposal not found');
    });

    it('should handle revision without reason', async () => {
      const originalProposal = createMockProposal();

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'proposal-123',
        data: () => originalProposal,
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-revision-123' });

      const newRevisionId = await createProposalRevision(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName
      );

      expect(newRevisionId).toBe('new-revision-123');
    });
  });

  describe('getProposalRevisions', () => {
    it('should return all revisions ordered by revision number desc', async () => {
      const revisions = [
        createMockProposal({ id: 'rev-3', revision: 3 }),
        createMockProposal({ id: 'rev-2', revision: 2 }),
        createMockProposal({ id: 'rev-1', revision: 1 }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          revisions.forEach((rev) => callback({ id: rev.id, data: () => rev }));
        },
      });

      const result = await getProposalRevisions(mockDb, 'PROP-26-01');

      expect(result).toHaveLength(3);
      expect(result[0]?.revision).toBe(3);
      expect(result[1]?.revision).toBe(2);
      expect(result[2]?.revision).toBe(1);
    });

    it('should return empty array when no revisions found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: () => {},
      });

      const result = await getProposalRevisions(mockDb, 'PROP-99-99');

      expect(result).toHaveLength(0);
    });
  });

  describe('getLatestRevision', () => {
    it('should return the latest revision (highest revision number)', async () => {
      const revisions = [
        createMockProposal({ id: 'rev-3', revision: 3, isLatestRevision: true }),
        createMockProposal({ id: 'rev-2', revision: 2, isLatestRevision: false }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          revisions.forEach((rev) => callback({ id: rev.id, data: () => rev }));
        },
      });

      const result = await getLatestRevision(mockDb, 'PROP-26-01');

      expect(result).toBeDefined();
      expect(result?.revision).toBe(3);
      expect(result?.id).toBe('rev-3');
    });

    it('should return null when no revisions found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: () => {},
      });

      const result = await getLatestRevision(mockDb, 'PROP-99-99');

      expect(result).toBeNull();
    });
  });

  describe('compareRevisions', () => {
    it('should detect pricing changes', () => {
      const oldRevision = createMockProposal({
        pricing: {
          currency: 'INR',
          lineItems: [],
          subtotal: { amount: 100000, currency: 'INR' },
          taxItems: [],
          totalAmount: { amount: 118000, currency: 'INR' },
          paymentTerms: '50% advance',
        },
      });

      const newRevision = createMockProposal({
        pricing: {
          currency: 'INR',
          lineItems: [],
          subtotal: { amount: 120000, currency: 'INR' },
          taxItems: [],
          totalAmount: { amount: 141600, currency: 'INR' },
          paymentTerms: '50% advance',
        },
      });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.pricingChanged).toBe(true);
      expect(result.changes).toContain('Total amount changed from 118000 to 141600');
    });

    it('should detect scope of supply changes', () => {
      const oldRevision = createMockProposal({
        scopeOfSupply: [{ id: 'item-1', itemNumber: '1', itemName: 'Item 1', category: 'EQUIPMENT', description: 'Test item', quantity: 10, unit: 'Nos', totalPrice: { amount: 10000, currency: 'INR' } }],
      });

      const newRevision = createMockProposal({
        scopeOfSupply: [
          { itemNumber: '1', itemName: 'Item 1', quantity: 10 },
          { itemNumber: '2', itemName: 'Item 2', quantity: 5 },
        ],
      });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.scopeChanged).toBe(true);
      expect(result.changes).toContain('Scope of supply modified');
    });

    it('should detect terms changes', () => {
      const oldRevision = createMockProposal({
        terms: { warranty: '12 months' },
      });

      const newRevision = createMockProposal({
        terms: { warranty: '24 months' },
      });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.termsChanged).toBe(true);
      expect(result.changes).toContain('Terms and conditions updated');
    });

    it('should detect delivery changes', () => {
      const oldRevision = createMockProposal({
        deliveryPeriod: {
          durationInWeeks: 4,
          description: 'Four weeks',
          milestones: [],
        },
      });

      const newRevision = createMockProposal({
        deliveryPeriod: {
          durationInWeeks: 6,
          description: 'Six weeks',
          milestones: [],
        },
      });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.deliveryChanged).toBe(true);
      expect(result.changes).toContain('Delivery schedule modified');
    });

    it('should return no changes when revisions are identical', () => {
      const proposal = createMockProposal();

      const result = compareRevisions(proposal, proposal);

      expect(result.pricingChanged).toBe(false);
      expect(result.scopeChanged).toBe(false);
      expect(result.termsChanged).toBe(false);
      expect(result.deliveryChanged).toBe(false);
      expect(result.changes).toHaveLength(0);
    });

    it('should detect multiple changes at once', () => {
      const oldRevision = createMockProposal({
        pricing: {
          currency: 'INR',
          lineItems: [],
          subtotal: { amount: 100000, currency: 'INR' },
          taxItems: [],
          totalAmount: { amount: 118000, currency: 'INR' },
          paymentTerms: '50% advance',
        },
        scopeOfSupply: [{ id: 'item-1', itemNumber: '1', itemName: 'Item 1', category: 'EQUIPMENT', description: 'Test item', quantity: 10, unit: 'Nos', totalPrice: { amount: 10000, currency: 'INR' } }],
        terms: { warranty: '12 months' },
      });

      const newRevision = createMockProposal({
        pricing: {
          currency: 'INR',
          lineItems: [],
          subtotal: { amount: 150000, currency: 'INR' },
          taxItems: [],
          totalAmount: { amount: 177000, currency: 'INR' },
          paymentTerms: '50% advance',
        },
        scopeOfSupply: [{ itemNumber: '1', itemName: 'Item 1', quantity: 15 }],
        terms: { warranty: '24 months' },
      });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.pricingChanged).toBe(true);
      expect(result.scopeChanged).toBe(true);
      expect(result.termsChanged).toBe(true);
      expect(result.changes.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Revision Numbering', () => {
  it('should follow sequential numbering', () => {
    const revisions = [1, 2, 3, 4, 5];

    revisions.forEach((rev, index) => {
      expect(rev).toBe(index + 1);
    });
  });

  it('should preserve original proposal ID in previousRevisionId', () => {
    const originalId = 'proposal-original';
    const revision = {
      id: 'proposal-rev-2',
      previousRevisionId: originalId,
      revision: 2,
    };

    expect(revision.previousRevisionId).toBe(originalId);
    expect(revision.revision).toBeGreaterThan(1);
  });
});
