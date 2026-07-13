/**
 * Project Conversion Tests
 *
 * Tests for converting accepted proposals to projects:
 * - Conversion validation
 * - Project creation from proposal data
 * - Proposal update with project link
 * - Budget line items generation
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROPOSALS: 'proposals',
    PROJECTS: 'projects',
  },
}));

const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockRunTransaction = jest.fn();
// Captured by the mocked `doc(collection(...))` overload when no id is
// supplied so each transactional create gets a fresh predictable id.
let nextProjectDocId = 'new-project-123';

// Mock the counter-backed number generator — the real module pulls in the
// Firebase client singleton, which explodes under this file's partial
// firebase/firestore mock. Format itself is pinned in documentNumberFormats.test.ts.
const mockGenerateCounterBackedNumber = jest.fn();
jest.mock('@/lib/procurement/generateProcurementNumber', () => ({
  generateCounterBackedNumber: (...args: unknown[]) => mockGenerateCounterBackedNumber(...args),
  generateProcurementNumber: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn((_db, _collection, id) =>
    id !== undefined
      ? { id, path: `proposals/${id}` }
      : { id: nextProjectDocId, path: `projects/${nextProjectDocId}` }
  ),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
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

// Mock auth (needed by proposalService which is imported by projectConversion)
jest.mock('@/lib/auth', () => ({
  requirePermission: jest.fn(),
}));

// Mock typeHelpers (needed by proposalService)
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: jest.fn(),
}));

import { convertProposalToProject, canConvertToProject } from './projectConversion';
import type { Firestore } from 'firebase/firestore';
import type { Proposal, ProposalStatus } from '@vapour/types';

describe('projectConversion', () => {
  const mockDb = {} as unknown as Firestore;
  const mockUserId = 'user-123';
  const mockUserName = 'Test User';

  // Mock proposal factory - cast to Proposal for test compatibility
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
      validityDate: {
        seconds: Date.now() / 1000 + 86400 * 30,
        nanoseconds: 0,
        toDate: () => new Date(),
        toMillis: () => Date.now(),
        isEqual: () => true,
        toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }),
        valueOf: () => 'timestamp',
      },
      preparationDate: {
        seconds: Date.now() / 1000,
        nanoseconds: 0,
        toDate: () => new Date(),
        toMillis: () => Date.now(),
        isEqual: () => true,
        toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }),
        valueOf: () => 'timestamp',
      },
      status: 'ACCEPTED' as ProposalStatus,
      isLatestRevision: true,
      scopeOfWork: {
        summary: 'Test scope summary',
        objectives: ['Objective 1', 'Objective 2'],
        deliverables: ['Deliverable 1', 'Deliverable 2'],
        inclusions: ['Inclusion 1'],
        exclusions: ['Exclusion 1'],
        assumptions: ['Assumption 1'],
      },
      scopeOfSupply: [
        {
          id: 'item-1',
          itemNumber: '1',
          itemName: 'Test Item 1',
          category: 'EQUIPMENT',
          description: 'Test item description',
          quantity: 10,
          unit: 'Nos',
          totalPrice: { amount: 50000, currency: 'INR' },
        },
        {
          id: 'item-2',
          itemNumber: '2',
          itemName: 'Test Item 2',
          category: 'EQUIPMENT',
          description: 'Another item',
          quantity: 5,
          unit: 'Nos',
          totalPrice: { amount: 30000, currency: 'INR' },
        },
      ],
      deliveryPeriod: {
        durationInWeeks: 8,
        description: 'Eight weeks delivery',
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
    nextProjectDocId = 'new-project-123';
    mockGenerateCounterBackedNumber.mockResolvedValue('PROJ-2026-0001');
    // Default: runTransaction invokes its callback with a tx whose get()
    // returns a fresh proposal (no projectId) and whose set/update bridge
    // to the existing mockAddDoc / mockUpdateDoc so test assertions on
    // those continue to work after the addDoc+updateDoc → tx.set+tx.update
    // refactor. Tests that want a different tx.get can re-override.
    mockRunTransaction.mockImplementation(
      async (_db: unknown, cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn(async () => ({
            exists: () => true,
            data: () => ({ projectId: undefined }),
          })),
          set: (...args: unknown[]) => mockAddDoc(...args),
          update: (...args: unknown[]) => mockUpdateDoc(...args),
        };
        return await cb(tx);
      }
    );
  });

  describe('canConvertToProject', () => {
    it('should return true for accepted proposal without projectId', () => {
      const proposal = createMockProposal({
        status: 'ACCEPTED',
        projectId: undefined,
      });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false for non-accepted proposal', () => {
      const proposal = createMockProposal({ status: 'DRAFT' });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Proposal must be in ACCEPTED status to convert to project');
    });

    it('should return false for already converted proposal', () => {
      const proposal = createMockProposal({
        status: 'ACCEPTED',
        projectId: 'existing-project-123',
      });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Proposal has already been converted to a project');
    });

    it('should return false for pending approval status', () => {
      const proposal = createMockProposal({ status: 'PENDING_APPROVAL' });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(false);
    });

    it('should return false for submitted status', () => {
      const proposal = createMockProposal({ status: 'SUBMITTED' });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(false);
    });

    it('should return false for rejected status', () => {
      const proposal = createMockProposal({ status: 'REJECTED' });

      const result = canConvertToProject(proposal);

      expect(result.canConvert).toBe(false);
    });
  });

  describe('convertProposalToProject', () => {
    it('should create a project from accepted proposal', async () => {
      const proposal = createMockProposal({ status: 'ACCEPTED' });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      const projectId = await convertProposalToProject(
        mockDb,
        'proposal-123',
        mockUserId,
        mockUserName,
        proposal
      );

      expect(projectId).toBe('new-project-123');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('should create project with correct basic info', async () => {
      const proposal = createMockProposal({
        title: 'Custom Project Title',
        scopeOfWork: {
          summary: 'Custom project summary',
          objectives: [],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.name).toBe('Custom Project Title');
      expect(projectData?.description).toBe('Custom project summary');
      expect(projectData?.status).toBe('PLANNING');
      expect(projectData?.priority).toBe('MEDIUM');
    });

    it('should set client info from proposal', async () => {
      const proposal = createMockProposal({
        clientId: 'client-456',
        clientName: 'Acme Corp',
        clientContactPerson: 'Jane Smith',
        clientEmail: 'jane@acme.com',
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.client?.entityId).toBe('client-456');
      expect(projectData?.client?.entityName).toBe('Acme Corp');
      expect(projectData?.client?.contactPerson).toBe('Jane Smith');
      expect(projectData?.client?.contactEmail).toBe('jane@acme.com');
    });

    it('should set project manager as creator', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.projectManager?.userId).toBe(mockUserId);
      expect(projectData?.projectManager?.userName).toBe(mockUserName);
    });

    it('should initialize team with creator as project manager', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.team).toHaveLength(1);
      expect(projectData?.team?.[0]?.userId).toBe(mockUserId);
      expect(projectData?.team?.[0]?.role).toBe('Project Manager');
      expect(projectData?.team?.[0]?.isActive).toBe(true);
    });

    it('should set budget from proposal pricing (canonical commercial summary)', async () => {
      // Budget now reads from computeCommercialSummary's targetRevenueInr
      // (cost basis × (1 + markup)), not the legacy pricing.totalAmount.
      const proposal = createMockProposal({
        pricingBlocks: [
          {
            id: 'block-1',
            kind: 'LUMP_SUM_LINES',
            label: 'Equipment',
            audience: 'INTERNAL',
            currency: 'INR',
            subtotal: 200000,
            rows: [{ id: 'r1', description: 'Pumps', amount: 200000 }],
          },
        ],
        clientPricing: {
          overheadPercent: 0,
          contingencyPercent: 0,
          profitPercent: 18,
          priceSections: [{ id: 's1', title: 'Scope', amount: 236000, included: true, order: 0 }],
          lumpSumLines: [],
          taxRate: 0,
          taxLabel: '',
          currency: 'INR',
          fxRate: 1,
        },
      } as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      // 200000 × (1 + 0.18) = 236000 INR
      expect(projectData?.budget?.estimated).toEqual({
        amount: 236000,
        currency: 'INR',
      });
      expect(projectData?.budget?.currency).toBe('INR');
    });

    it('should create charter with objectives from proposal', async () => {
      const proposal = createMockProposal({
        scopeOfWork: {
          summary: 'Summary',
          objectives: ['Objective A', 'Objective B', 'Objective C'],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.objectives).toHaveLength(3);
      expect(projectData?.charter?.objectives?.[0]?.description).toBe('Objective A');
      expect(projectData?.charter?.objectives?.[0]?.status).toBe('NOT_STARTED');
    });

    it('should create charter with deliverables from proposal', async () => {
      const proposal = createMockProposal({
        scopeOfWork: {
          summary: 'Summary',
          objectives: [],
          deliverables: ['Deliverable X', 'Deliverable Y'],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.deliverables).toHaveLength(2);
      expect(projectData?.charter?.deliverables?.[0]?.name).toBe('Deliverable X');
      expect(projectData?.charter?.deliverables?.[0]?.status).toBe('PENDING');
    });

    it('should set scope inclusions and exclusions from proposal', async () => {
      const proposal = createMockProposal({
        scopeOfWork: {
          summary: 'Summary',
          objectives: [],
          deliverables: [],
          inclusions: ['In scope item 1', 'In scope item 2'],
          exclusions: ['Out of scope item 1'],
          assumptions: ['Assumption 1'],
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.scope?.inScope).toEqual(['In scope item 1', 'In scope item 2']);
      expect(projectData?.charter?.scope?.outOfScope).toEqual(['Out of scope item 1']);
      expect(projectData?.charter?.scope?.assumptions).toEqual(['Assumption 1']);
    });

    it('should generate budget line items from unified scope matrix supply items', async () => {
      const proposal = createMockProposal({
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'MANUFACTURED',
              label: 'Manufactured Components',
              displayType: 'MATRIX',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Equipment A',
                  description: 'Main equipment',
                  classification: 'SUPPLY',
                  included: true,
                  estimationSummary: {
                    totalCost: { amount: 100000, currency: 'INR' },
                    bomCount: 1,
                  },
                  order: 0,
                },
                {
                  id: 'item-2',
                  itemNumber: '2',
                  name: 'Component B',
                  description: 'Supporting component',
                  classification: 'SUPPLY',
                  included: true,
                  estimationSummary: { totalCost: { amount: 50000, currency: 'INR' }, bomCount: 1 },
                  order: 1,
                },
                {
                  id: 'item-3',
                  itemNumber: '3',
                  name: 'Design Review',
                  classification: 'SERVICE',
                  included: true,
                  order: 2,
                },
              ],
              order: 0,
            },
          ],
        },
      } as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      // Only SUPPLY items become budget line items (not SERVICE)
      expect(projectData?.charter?.budgetLineItems).toHaveLength(2);
      expect(projectData?.charter?.budgetLineItems?.[0]?.description).toBe('Equipment A');
      expect(projectData?.charter?.budgetLineItems?.[0]?.estimatedCost).toBe(100000);
      expect(projectData?.charter?.budgetLineItems?.[1]?.description).toBe('Component B');
      expect(projectData?.charter?.budgetLineItems?.[1]?.estimatedCost).toBe(50000);
    });

    it('should omit budgetLineItems for service-only proposals and write no nested undefined', async () => {
      // Regression: a service-only proposal (zero SUPPLY items) used to write
      // charter.budgetLineItems: undefined, which Firestore Transaction.set()
      // rejects ("Unsupported field value: undefined"). The optional client
      // contact fields crash the same way when absent.
      const proposal = createMockProposal({
        tenantId: 'entity-123',
        clientContactPerson: undefined,
        clientEmail: undefined,
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'SERVICES',
              label: 'Services',
              displayType: 'LIST',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Baseline MEP Survey',
                  classification: 'SERVICE',
                  included: true,
                  order: 0,
                },
              ],
              order: 0,
            },
          ],
        },
      } as unknown as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect('budgetLineItems' in (projectData?.charter ?? {})).toBe(false);

      // firestore.rules requires tenantId on project create — a missing
      // field reads as undefined in rules and denies the transaction.
      expect(projectData?.tenantId).toBe('entity-123');

      // Firestore rejects undefined at any depth — deep-scan the payload.
      const findUndefinedPath = (value: unknown, path = ''): string | null => {
        if (value === undefined) return path || '<root>';
        if (value === null || typeof value !== 'object') return null;
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          const hit = findUndefinedPath(v, path ? `${path}.${k}` : k);
          if (hit) return hit;
        }
        return null;
      };
      expect(findUndefinedPath(projectData)).toBeNull();
    });

    it('should carry scope-matrix items and milestones into the charter for new-style proposals', async () => {
      // New-style proposals keep scope only in unifiedScopeMatrix and dates
      // in milestones — legacy scopeOfWork lists are empty. The charter must
      // not come out blank (in-scope from matrix, deliverables from
      // milestones with cumulative due dates).
      const proposal = createMockProposal({
        scopeOfWork: {
          summary: 'Survey summary',
          objectives: [],
          deliverables: [],
          inclusions: [],
          exclusions: [],
          assumptions: [],
        },
        deliveryPeriod: {
          durationInWeeks: 3,
          description: 'Three weeks',
          milestones: [
            {
              id: 'm1',
              milestoneNumber: 1,
              description: 'Review of Documentation',
              paymentPercentage: 20,
              durationInWeeks: 1,
            },
            {
              id: 'm2',
              milestoneNumber: 2,
              description: 'Completion of Site Survey',
              paymentPercentage: 50,
              durationInWeeks: 1,
            },
            {
              id: 'm3',
              milestoneNumber: 3,
              description: 'Submission of Report',
              paymentPercentage: 30,
              durationInWeeks: 1,
            },
          ],
        },
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'ELECTRICAL',
              label: 'Electrical',
              displayType: 'LIST',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Survey all electrical panels',
                  classification: 'SERVICE',
                  included: true,
                  order: 0,
                },
                {
                  id: 'item-2',
                  itemNumber: '2',
                  name: 'Excluded item',
                  classification: 'SERVICE',
                  included: false,
                  order: 1,
                },
                {
                  id: 'item-3',
                  itemNumber: '3',
                  name: 'Inspect cable trays',
                  classification: 'SERVICE',
                  included: true,
                  order: 2,
                },
              ],
              order: 0,
            },
          ],
        },
      } as unknown as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const charter = mockAddDoc.mock.calls[0]?.[1]?.charter;
      // Included matrix items → in-scope; excluded item dropped
      expect(charter?.scope?.inScope).toEqual([
        'Survey all electrical panels',
        'Inspect cable trays',
      ]);
      // Milestones → MILESTONE deliverables with cumulative due dates
      expect(charter?.deliverables).toHaveLength(3);
      expect(charter?.deliverables?.[0]?.name).toBe('Review of Documentation');
      expect(charter?.deliverables?.[0]?.type).toBe('MILESTONE');
      expect(charter?.deliverables?.[0]?.description).toContain('20%');
      const due = charter?.deliverables?.map((d: { dueDate: { toDate: () => Date } }) =>
        d.dueDate.toDate().getTime()
      );
      expect(due?.[0]).toBeLessThan(due?.[1]);
      expect(due?.[1]).toBeLessThan(due?.[2]);
    });

    it('should add client as stakeholder', async () => {
      const proposal = createMockProposal({ clientName: 'Big Client Corp' });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.stakeholders).toHaveLength(1);
      expect(projectData?.charter?.stakeholders?.[0]?.name).toBe('Big Client Corp');
      expect(projectData?.charter?.stakeholders?.[0]?.role).toBe('Client');
      expect(projectData?.charter?.stakeholders?.[0]?.interest).toBe('HIGH');
      expect(projectData?.charter?.stakeholders?.[0]?.influence).toBe('HIGH');
    });

    it('should update proposal with project link', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updateData = mockUpdateDoc.mock.calls[0]?.[1];
      expect(updateData?.projectId).toBe('new-project-123');
      expect(updateData?.convertedToProjectBy).toBe(mockUserId);
    });

    it('should throw error for non-accepted proposal', async () => {
      const proposal = createMockProposal({ status: 'DRAFT' });

      await expect(
        convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal)
      ).rejects.toThrow('Cannot convert proposal with status: DRAFT');
    });

    it('should throw error for already converted proposal', async () => {
      const proposal = createMockProposal({
        status: 'ACCEPTED',
        projectId: 'existing-project-456',
      });

      await expect(
        convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal)
      ).rejects.toThrow('Proposal has already been converted to a project');
    });

    it('should handle proposal without unified scope matrix', async () => {
      const proposal = createMockProposal({ unifiedScopeMatrix: undefined } as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.budgetLineItems).toBeUndefined();
    });

    it('should calculate end date based on delivery duration', async () => {
      const proposal = createMockProposal({
        deliveryPeriod: {
          durationInWeeks: 12,
          description: 'Twelve weeks',
          milestones: [],
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.deliveryPeriod?.duration).toBe(12 * 7);
      expect(projectData?.charter?.deliveryPeriod?.description).toBe('Twelve weeks');
    });

    it('should set owner and visibility correctly', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.ownerId).toBe(mockUserId);
      expect(projectData?.visibility).toBe('team');
    });

    it('should initialize project as not deleted', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.isDeleted).toBe(false);
      expect(projectData?.tags).toEqual([]);
    });

    it('should handle supply items with no estimation summary', async () => {
      const proposal = createMockProposal({
        unifiedScopeMatrix: {
          categories: [
            {
              id: 'cat-1',
              categoryKey: 'MANUFACTURED',
              label: 'Manufactured Components',
              displayType: 'MATRIX',
              items: [
                {
                  id: 'item-1',
                  itemNumber: '1',
                  name: 'Item without estimation',
                  classification: 'SUPPLY',
                  included: true,
                  order: 0,
                  // No estimationSummary
                },
              ],
              order: 0,
            },
          ],
        },
      } as Partial<Proposal>);

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.budgetLineItems?.[0]?.estimatedCost).toBe(0);
    });
  });

  describe('Project Number Generation', () => {
    it('should generate project number in expected format', async () => {
      const proposal = createMockProposal();

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const updateData = mockUpdateDoc.mock.calls[0]?.[1];
      // Counter-backed format since gap 2.4: PROJ-YYYY-NNNN (was a 6-digit
      // timestamp slice). Byte-exact format pinned in documentNumberFormats.test.ts.
      expect(updateData?.projectNumber).toMatch(/^PROJ-\d{4}-\d{4}$/);
    });
  });
});
