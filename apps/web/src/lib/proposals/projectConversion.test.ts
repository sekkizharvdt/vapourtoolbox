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

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `proposals/${id}` })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
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

import { convertProposalToProject, canConvertToProject } from './projectConversion';
import type { Firestore } from 'firebase/firestore';
import type { Proposal, ProposalStatus } from '@vapour/types';

describe('projectConversion', () => {
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
    validityDate: { seconds: Date.now() / 1000 + 86400 * 30, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => true, toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }), valueOf: () => 'timestamp' },
    preparationDate: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => true, toJSON: () => ({ seconds: 0, nanoseconds: 0, type: 'timestamp' }), valueOf: () => 'timestamp' },
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

    it('should set budget from proposal pricing', async () => {
      const proposal = createMockProposal({
        pricing: {
          currency: 'INR',
          lineItems: [],
          subtotal: { amount: 200000, currency: 'INR' },
          taxItems: [],
          totalAmount: { amount: 236000, currency: 'INR' },
          paymentTerms: '30% advance',
        },
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
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

    it('should generate budget line items from scope of supply', async () => {
      const proposal = createMockProposal({
        scopeOfSupply: [
          {
            id: 'item-1',
            itemNumber: '1',
            itemName: 'Equipment A',
            category: 'EQUIPMENT',
            description: 'Main equipment',
            quantity: 5,
            unit: 'Nos',
            totalPrice: { amount: 100000, currency: 'INR' },
          },
          {
            id: 'item-2',
            itemNumber: '2',
            itemName: 'Component B',
            category: 'MATERIAL',
            description: 'Supporting component',
            quantity: 10,
            unit: 'Nos',
            totalPrice: { amount: 50000, currency: 'INR' },
          },
        ],
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'new-project-123' });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await convertProposalToProject(mockDb, 'proposal-123', mockUserId, mockUserName, proposal);

      const projectData = mockAddDoc.mock.calls[0]?.[1];
      expect(projectData?.charter?.budgetLineItems).toHaveLength(2);
      expect(projectData?.charter?.budgetLineItems?.[0]?.description).toBe('Equipment A');
      expect(projectData?.charter?.budgetLineItems?.[0]?.estimatedCost).toBe(100000);
      expect(projectData?.charter?.budgetLineItems?.[1]?.description).toBe('Component B');
      expect(projectData?.charter?.budgetLineItems?.[1]?.estimatedCost).toBe(50000);
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

    it('should handle proposal with empty scope of supply', async () => {
      const proposal = createMockProposal({ scopeOfSupply: [] });

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

    it('should handle scope of supply items with missing totalPrice', async () => {
      const proposal = createMockProposal({
        scopeOfSupply: [
          {
            id: 'item-1',
            itemNumber: '1',
            itemName: 'Item without price',
            category: 'EQUIPMENT',
            description: 'No price set',
            quantity: 5,
            unit: 'Nos',
            totalPrice: { amount: 0, currency: 'INR' },
          },
        ],
      });

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
      expect(updateData?.projectNumber).toMatch(/^PROJ-\d{4}-\d{6}$/);
    });
  });
});
