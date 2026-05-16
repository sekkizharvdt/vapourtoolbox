/**
 * Proposal Revision Management Tests
 *
 * Tests for:
 * - Get latest revision (delegates to proposalService.getProposalRevisions)
 * - Compare revisions (pricingConfig + unifiedScopeMatrix)
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROPOSALS: 'proposals',
  },
}));

const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
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

import { getLatestRevision, compareRevisions } from './revisionManagement';
import type { Firestore } from 'firebase/firestore';
import type { Proposal, ProposalStatus } from '@vapour/types';

describe('revisionManagement', () => {
  const mockDb = {} as unknown as Firestore;

  // Mock proposal factory
  const createMockProposal = (overrides: Partial<Proposal> = {}): Proposal =>
    ({
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
      status: 'DRAFT' as ProposalStatus,
      isLatestRevision: true,
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
      createdBy: 'user-123',
      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      updatedBy: 'user-123',
      ...overrides,
    }) as unknown as Proposal;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestRevision', () => {
    it('should return the latest revision (highest revision number)', async () => {
      const revisions = [
        createMockProposal({ id: 'rev-3', revision: 3, isLatestRevision: true }),
        createMockProposal({ id: 'rev-2', revision: 2, isLatestRevision: false }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: revisions.map((rev) => ({ id: rev.id, data: () => rev })),
      });

      const result = await getLatestRevision(mockDb, 'PROP-26-01');

      expect(result).toBeDefined();
      expect(result?.revision).toBe(3);
      expect(result?.id).toBe('rev-3');
    });

    it('should return null when no revisions found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      });

      const result = await getLatestRevision(mockDb, 'PROP-99-99');

      expect(result).toBeNull();
    });
  });

  describe('compareRevisions', () => {
    // Helper: build a minimal clientPricing with a single included
    // section at the given total. Mirrors what computeCommercialSummary
    // reads.
    const pricingWith = (sectionAmount: number, taxRate = 0) => ({
      overheadPercent: 0,
      contingencyPercent: 0,
      profitPercent: 0,
      priceSections: [
        { id: 's1', title: 'Scope', amount: sectionAmount, included: true, order: 0 },
      ],
      lumpSumLines: [],
      taxRate,
      taxLabel: '',
      currency: 'INR' as const,
      fxRate: 1,
    });

    it('should detect pricing changes via clientPricing', () => {
      // Both revisions have cost basis so the single-section auto-sync
      // takes the user-typed amount × markup. We use markup = 0 so the
      // section amount IS the total.
      const oldRevision = createMockProposal({
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 153400,
            rows: [],
          },
        ],
        clientPricing: pricingWith(153400),
      } as Partial<Proposal>);

      const newRevision = createMockProposal({
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 184080,
            rows: [],
          },
        ],
        clientPricing: pricingWith(184080),
      } as Partial<Proposal>);

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.pricingChanged).toBe(true);
      expect(result.changes.some((c) => /153400.*184080/.test(c))).toBe(true);
    });

    it('should report no pricing change when totals match', () => {
      const oldRevision = createMockProposal({
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 118000,
            rows: [],
          },
        ],
        clientPricing: pricingWith(118000),
      } as Partial<Proposal>);

      const newRevision = createMockProposal({
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 118000,
            rows: [],
          },
        ],
        clientPricing: pricingWith(118000),
      } as Partial<Proposal>);

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.pricingChanged).toBe(false);
    });

    it('should detect unified scope matrix changes', () => {
      const oldRevision = createMockProposal({
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'PROCESS_DESIGN',
              label: 'Process Design',
              displayType: 'CHECKLIST',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Design Review',
                  classification: 'SERVICE',
                  included: true,
                  order: 0,
                },
              ],
              order: 0,
            },
          ],
        },
      } as Partial<Proposal>);

      const newRevision = createMockProposal({
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'PROCESS_DESIGN',
              label: 'Process Design',
              displayType: 'CHECKLIST',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Design Review',
                  classification: 'SERVICE',
                  included: true,
                  order: 0,
                },
                {
                  id: 'item-2',
                  itemNumber: '2',
                  name: 'P&ID Development',
                  classification: 'SERVICE',
                  included: true,
                  order: 1,
                },
              ],
              order: 0,
            },
          ],
        },
      } as Partial<Proposal>);

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.scopeChanged).toBe(true);
      expect(result.changes).toContain('Scope matrix modified');
    });

    it('should detect terms changes', () => {
      const oldRevision = createMockProposal({ terms: { warranty: '12 months' } });
      const newRevision = createMockProposal({ terms: { warranty: '24 months' } });

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.termsChanged).toBe(true);
      expect(result.changes).toContain('Terms and conditions updated');
    });

    it('should detect delivery changes', () => {
      const oldRevision = createMockProposal({
        deliveryPeriod: { durationInWeeks: 4, description: 'Four weeks', milestones: [] },
      });
      const newRevision = createMockProposal({
        deliveryPeriod: { durationInWeeks: 6, description: 'Six weeks', milestones: [] },
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
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 153400,
            rows: [],
          },
        ],
        clientPricing: pricingWith(153400),
        terms: { warranty: '12 months' },
      } as Partial<Proposal>);

      const newRevision = createMockProposal({
        pricingBlocks: [
          {
            id: 'b1',
            kind: 'LUMP_SUM_LINES',
            label: 'X',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 230100,
            rows: [],
          },
        ],
        clientPricing: pricingWith(230100),
        terms: { warranty: '24 months' },
      } as Partial<Proposal>);

      const result = compareRevisions(oldRevision, newRevision);

      expect(result.pricingChanged).toBe(true);
      expect(result.termsChanged).toBe(true);
      expect(result.changes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
