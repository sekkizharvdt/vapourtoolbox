/**
 * Service Order CRUD and Workflow Tests
 *
 * Tests for create, read, list, status transitions,
 * and state machine validation for service orders.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */

import type { Firestore } from 'firebase/firestore';
import type { ServiceOrderStatus } from '@vapour/types';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockTimestampNow = jest.fn();
const mockTimestampFromDate = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
    fromDate: (d: Date) => mockTimestampFromDate(d),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    SERVICE_ORDERS: 'serviceOrders',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('../../firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...(data as object) }) as T,
}));

// Import after mocks — state machine must be imported for real validation
import {
  createServiceOrder,
  getServiceOrderById,
  listServiceOrders,
  updateServiceOrderStatus,
  updateServiceOrder,
} from './crud';

describe('Service Order CRUD and Workflow', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1710700800, nanoseconds: 0 };
  const userId = 'user-123';
  const userName = 'Test User';

  const baseInput = {
    purchaseOrderId: 'po-001',
    poNumber: 'PO/2026/03/0001',
    vendorId: 'vendor-001',
    vendorName: 'Lab Corp',
    projectId: 'project-001',
    projectName: 'MED Plant',
    serviceId: 'svc-001',
    serviceCode: 'SVC-TST-001',
    serviceName: 'Proximate Analysis',
    serviceCategory: 'TESTING',
    description: 'Coal sample testing',
    estimatedTurnaroundDays: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockTimestampFromDate.mockImplementation((d: Date) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    }));
    mockCollection.mockReturnValue({ id: 'serviceOrders' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderby-constraint');
    mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('createServiceOrder', () => {
    it('should create a service order with DRAFT status', async () => {
      // Number generation query
      mockGetDocs.mockResolvedValueOnce({ size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'so-new-id' });

      const result = await createServiceOrder(mockDb, baseInput, userId, userName);

      expect(result.id).toBe('so-new-id');
      expect(result.status).toBe('DRAFT');
      expect(result.createdBy).toBe(userId);
      expect(result.createdByName).toBe(userName);
      expect(result.serviceName).toBe('Proximate Analysis');
      expect(result.vendorName).toBe('Lab Corp');
      expect(result.poNumber).toBe('PO/2026/03/0001');
    });

    it('should generate sequential SO numbers', async () => {
      // 5 existing SOs this month
      mockGetDocs.mockResolvedValueOnce({ size: 5 });
      mockAddDoc.mockResolvedValue({ id: 'so-new-id' });

      const result = await createServiceOrder(mockDb, baseInput, userId, userName);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      expect(result.number).toBe(`SO/${year}/${month}/0006`);
    });

    it('should include optional fields when provided', async () => {
      mockGetDocs.mockResolvedValueOnce({ size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'so-new-id' });

      const result = await createServiceOrder(mockDb, baseInput, userId, userName);

      expect(result.projectId).toBe('project-001');
      expect(result.projectName).toBe('MED Plant');
      expect(result.serviceId).toBe('svc-001');
      expect(result.serviceCode).toBe('SVC-TST-001');
      expect(result.serviceCategory).toBe('TESTING');
      expect(result.description).toBe('Coal sample testing');
      expect(result.estimatedTurnaroundDays).toBe(7);
    });

    it('should omit optional fields when not provided', async () => {
      const minimalInput = {
        purchaseOrderId: 'po-001',
        poNumber: 'PO/2026/03/0001',
        vendorId: 'vendor-001',
        vendorName: 'Lab Corp',
        serviceName: 'Basic Test',
      };

      mockGetDocs.mockResolvedValueOnce({ size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'so-new-id' });

      const result = await createServiceOrder(mockDb, minimalInput, userId, userName);

      expect(result.projectId).toBeUndefined();
      expect(result.serviceId).toBeUndefined();
      expect(result.estimatedTurnaroundDays).toBeUndefined();
    });

    it('should convert expectedCompletionDate to Timestamp', async () => {
      const inputWithDate = {
        ...baseInput,
        expectedCompletionDate: new Date('2026-04-01'),
      };

      mockGetDocs.mockResolvedValueOnce({ size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'so-new-id' });

      await createServiceOrder(mockDb, inputWithDate, userId, userName);

      expect(mockTimestampFromDate).toHaveBeenCalledWith(new Date('2026-04-01'));
    });
  });

  // ============================================================================
  // READ
  // ============================================================================

  describe('getServiceOrderById', () => {
    it('should return service order when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'so-123',
        data: () => ({
          number: 'SO/2026/03/0001',
          serviceName: 'Proximate Analysis',
          status: 'DRAFT',
        }),
      });

      const result = await getServiceOrderById(mockDb, 'so-123');

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'serviceOrders', 'so-123');
      expect(result).toMatchObject({
        id: 'so-123',
        number: 'SO/2026/03/0001',
        status: 'DRAFT',
      });
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await getServiceOrderById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listServiceOrders', () => {
    it('should list all service orders ordered by createdAt desc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'so-1', data: () => ({ number: 'SO/2026/03/0002', status: 'IN_PROGRESS' }) },
          { id: 'so-2', data: () => ({ number: 'SO/2026/03/0001', status: 'DRAFT' }) },
        ],
      });

      const result = await listServiceOrders(mockDb);

      expect(result).toHaveLength(2);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should filter by status when provided', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ id: 'so-1', data: () => ({ status: 'IN_PROGRESS' }) }],
      });

      await listServiceOrders(mockDb, { status: 'IN_PROGRESS' });

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'IN_PROGRESS');
    });

    it('should filter by purchaseOrderId when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listServiceOrders(mockDb, { purchaseOrderId: 'po-001' });

      expect(mockWhere).toHaveBeenCalledWith('purchaseOrderId', '==', 'po-001');
    });

    it('should filter by projectId when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listServiceOrders(mockDb, { projectId: 'project-001' });

      expect(mockWhere).toHaveBeenCalledWith('projectId', '==', 'project-001');
    });

    it('should combine multiple filters', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listServiceOrders(mockDb, {
        status: 'COMPLETED',
        projectId: 'project-001',
      });

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'COMPLETED');
      expect(mockWhere).toHaveBeenCalledWith('projectId', '==', 'project-001');
    });
  });

  // ============================================================================
  // STATUS TRANSITIONS
  // ============================================================================

  describe('updateServiceOrderStatus', () => {
    function mockExistingOrder(status: ServiceOrderStatus) {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status, serviceName: 'Test' }),
      });
    }

    it('should transition DRAFT → SAMPLE_SENT', async () => {
      mockExistingOrder('DRAFT');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'SAMPLE_SENT', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'SAMPLE_SENT',
          updatedBy: userId,
        })
      );
    });

    it('should transition DRAFT → IN_PROGRESS', async () => {
      mockExistingOrder('DRAFT');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'IN_PROGRESS', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'IN_PROGRESS' })
      );
    });

    it('should transition SAMPLE_SENT → IN_PROGRESS', async () => {
      mockExistingOrder('SAMPLE_SENT');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'IN_PROGRESS', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'IN_PROGRESS' })
      );
    });

    it('should transition IN_PROGRESS → RESULTS_RECEIVED', async () => {
      mockExistingOrder('IN_PROGRESS');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'RESULTS_RECEIVED', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'RESULTS_RECEIVED' })
      );
    });

    it('should transition RESULTS_RECEIVED → COMPLETED', async () => {
      mockExistingOrder('RESULTS_RECEIVED');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'COMPLETED', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'COMPLETED',
          completedBy: userId,
          completedAt: mockTimestamp,
          actualCompletionDate: mockTimestamp,
        })
      );
    });

    it('should transition RESULTS_RECEIVED → UNDER_REVIEW', async () => {
      mockExistingOrder('RESULTS_RECEIVED');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'UNDER_REVIEW', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'UNDER_REVIEW' })
      );
    });

    it('should transition UNDER_REVIEW → COMPLETED', async () => {
      mockExistingOrder('UNDER_REVIEW');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'COMPLETED', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });

    it('should allow CANCELLED from any non-terminal state', async () => {
      const cancellableStates: ServiceOrderStatus[] = [
        'DRAFT',
        'SAMPLE_SENT',
        'IN_PROGRESS',
        'RESULTS_RECEIVED',
        'UNDER_REVIEW',
      ];

      for (const state of cancellableStates) {
        jest.clearAllMocks();
        mockTimestampNow.mockReturnValue(mockTimestamp);
        mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
        mockExistingOrder(state);
        mockUpdateDoc.mockResolvedValue(undefined);

        await updateServiceOrderStatus(mockDb, 'so-123', 'CANCELLED', userId);

        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ status: 'CANCELLED' })
        );
      }
    });

    it('should reject invalid transition DRAFT → COMPLETED', async () => {
      mockExistingOrder('DRAFT');

      await expect(
        updateServiceOrderStatus(mockDb, 'so-123', 'COMPLETED', userId)
      ).rejects.toThrow();
    });

    it('should reject invalid transition DRAFT → RESULTS_RECEIVED', async () => {
      mockExistingOrder('DRAFT');

      await expect(
        updateServiceOrderStatus(mockDb, 'so-123', 'RESULTS_RECEIVED', userId)
      ).rejects.toThrow();
    });

    it('should reject transition from terminal state COMPLETED', async () => {
      mockExistingOrder('COMPLETED');

      await expect(
        updateServiceOrderStatus(mockDb, 'so-123', 'IN_PROGRESS', userId)
      ).rejects.toThrow();
    });

    it('should reject transition from terminal state CANCELLED', async () => {
      mockExistingOrder('CANCELLED');

      await expect(updateServiceOrderStatus(mockDb, 'so-123', 'DRAFT', userId)).rejects.toThrow();
    });

    it('should throw when service order not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(
        updateServiceOrderStatus(mockDb, 'non-existent', 'IN_PROGRESS', userId)
      ).rejects.toThrow('Service order not found');
    });

    it('should merge additional updates with status change', async () => {
      mockExistingOrder('RESULTS_RECEIVED');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'COMPLETED', userId, {
        resultSummary: 'All tests passed',
        remarks: 'Excellent quality',
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'COMPLETED',
          resultSummary: 'All tests passed',
          remarks: 'Excellent quality',
        })
      );
    });

    it('should set completion fields only on COMPLETED transition', async () => {
      // IN_PROGRESS should not set completedBy
      mockExistingOrder('DRAFT');
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrderStatus(mockDb, 'so-123', 'IN_PROGRESS', userId);

      const call = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(call.completedBy).toBeUndefined();
      expect(call.completedAt).toBeUndefined();
    });
  });

  // ============================================================================
  // UPDATE (non-status)
  // ============================================================================

  describe('updateServiceOrder', () => {
    it('should update fields with timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateServiceOrder(
        mockDb,
        'so-123',
        { resultSummary: 'Results look good', remarks: 'No issues' },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          resultSummary: 'Results look good',
          remarks: 'No issues',
          updatedAt: mockTimestamp,
          updatedBy: userId,
        })
      );
    });
  });
});
