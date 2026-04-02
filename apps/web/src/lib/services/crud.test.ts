/**
 * Service Catalog CRUD Operations Tests
 *
 * Tests for create, read, update, soft-delete, and code generation
 * for the services catalog.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { Firestore } from 'firebase/firestore';
import type { Service, ServiceCategory } from '@vapour/types';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockTimestampNow = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    SERVICES: 'services',
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

jest.mock('../firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...(data as object) }) as T,
}));

// Import after mocks
import {
  createService,
  getServiceById,
  getServiceByCode,
  listServices,
  updateService,
  deleteService,
  restoreService,
} from './crud';

describe('Service Catalog CRUD Operations', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1710700800, nanoseconds: 0 };
  const userId = 'user-123';

  const baseServiceData: Omit<
    Service,
    'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
  > = {
    name: 'Proximate Analysis',
    serviceCode: '',
    category: 'TESTING' as ServiceCategory,
    calculationMethod: 'PERCENTAGE_OF_MATERIAL' as Service['calculationMethod'],
    tenantId: 'default-entity',
    description: 'Moisture, volatile matter, ash, fixed carbon analysis',
    isActive: true,
    isStandard: false,
    unit: 'PER SAMPLE',
    estimatedTurnaroundDays: 7,
    testMethodStandard: 'ASTM D3172',
    sampleRequirements: 'Minimum 500g of ground sample',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockCollection.mockReturnValue({ id: 'services' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderby-constraint');
    mockLimit.mockReturnValue('limit-constraint');
    mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('createService', () => {
    it('should create a service with auto-generated code', async () => {
      // Count query for sequence number (serviceCode is empty so no duplicate check)
      mockGetDocs.mockResolvedValueOnce({ size: 0, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, baseServiceData, userId);

      expect(result.id).toBe('svc-new-id');
      expect(result.serviceCode).toBe('SVC-TST-001');
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toEqual(mockTimestamp);
      expect(result.updatedAt).toEqual(mockTimestamp);
    });

    it('should use provided service code if specified', async () => {
      const dataWithCode = { ...baseServiceData, serviceCode: 'CUSTOM-TST-001' };

      // Duplicate check returns no match (getServiceByCode calls getDocs)
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, dataWithCode, userId);

      expect(result.serviceCode).toBe('CUSTOM-TST-001');
    });

    it('should throw error when service code already exists', async () => {
      const dataWithCode = { ...baseServiceData, serviceCode: 'SVC-TST-001' };

      // Duplicate check returns a match
      const docsArr = [{ id: 'existing-svc', data: () => ({}) }];
      mockGetDocs.mockResolvedValue({
        empty: false,
        size: 1,
        docs: docsArr,
      });

      await expect(createService(mockDb, dataWithCode, userId)).rejects.toThrow(
        'Service with code SVC-TST-001 already exists'
      );
    });

    it('should generate sequential codes per category', async () => {
      // Sequence count = 3 (so next = 004), serviceCode is '' so no dup check
      mockGetDocs.mockResolvedValueOnce({ size: 3, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, baseServiceData, userId);

      expect(result.serviceCode).toBe('SVC-TST-004');
    });

    it('should generate correct prefix for each category', async () => {
      const categories: [ServiceCategory, string][] = [
        ['ENGINEERING' as ServiceCategory, 'SVC-ENG-001'],
        ['FABRICATION' as ServiceCategory, 'SVC-FAB-001'],
        ['INSPECTION' as ServiceCategory, 'SVC-INS-001'],
        ['CONSULTING' as ServiceCategory, 'SVC-CON-001'],
        ['CALIBRATION' as ServiceCategory, 'SVC-CAL-001'],
        ['MAINTENANCE' as ServiceCategory, 'SVC-MNT-001'],
        ['TRAINING' as ServiceCategory, 'SVC-TRG-001'],
      ];

      for (const [category, expectedCode] of categories) {
        jest.clearAllMocks();
        mockTimestampNow.mockReturnValue(mockTimestamp);
        mockCollection.mockReturnValue({ id: 'services' });
        mockQuery.mockReturnValue({ id: 'mock-query' });
        mockWhere.mockReturnValue('where-constraint');
        mockDoc.mockReturnValue({ id: 'mock-doc-ref' });

        mockGetDocs.mockResolvedValueOnce({ size: 0, docs: [] });
        mockAddDoc.mockResolvedValue({ id: 'svc-id' });

        const data = { ...baseServiceData, serviceCode: '', category };
        const result = await createService(mockDb, data, userId);

        expect(result.serviceCode).toBe(expectedCode);
      }
    });

    it('should default isActive to true when not specified', async () => {
      const data = {
        ...baseServiceData,
        serviceCode: 'SVC-TST-X',
        isActive: undefined as unknown as boolean,
      };

      // Duplicate check returns no match
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, data, userId);

      expect(result.isActive).toBe(true);
    });

    it('should default isStandard to false when not specified', async () => {
      const data = {
        ...baseServiceData,
        serviceCode: 'SVC-TST-X',
        isStandard: undefined as unknown as boolean,
      };

      // Duplicate check returns no match
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, data, userId);

      expect(result.isStandard).toBe(false);
    });

    it('should preserve all optional fields', async () => {
      // serviceCode is '' so no dup check, just code gen count
      mockGetDocs.mockResolvedValueOnce({ size: 0, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'svc-new-id' });

      const result = await createService(mockDb, baseServiceData, userId);

      expect(result.unit).toBe('PER SAMPLE');
      expect(result.estimatedTurnaroundDays).toBe(7);
      expect(result.testMethodStandard).toBe('ASTM D3172');
      expect(result.sampleRequirements).toBe('Minimum 500g of ground sample');
      expect(result.description).toBe('Moisture, volatile matter, ash, fixed carbon analysis');
    });
  });

  // ============================================================================
  // READ
  // ============================================================================

  describe('getServiceById', () => {
    const mockServiceData = {
      name: 'Proximate Analysis',
      serviceCode: 'SVC-TST-001',
      category: 'TESTING',
      isActive: true,
    };

    it('should return service when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'svc-123',
        data: () => mockServiceData,
      });

      const result = await getServiceById(mockDb, 'svc-123');

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'services', 'svc-123');
      expect(result).toMatchObject({
        id: 'svc-123',
        name: 'Proximate Analysis',
        serviceCode: 'SVC-TST-001',
      });
    });

    it('should return null when service not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getServiceById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getServiceByCode', () => {
    it('should return service when code matches', async () => {
      const docsArr = [
        {
          id: 'svc-123',
          data: () => ({ name: 'Test Service', serviceCode: 'SVC-TST-001' }),
        },
      ];
      mockGetDocs.mockResolvedValue({
        empty: false,
        size: 1,
        docs: docsArr,
      });

      const result = await getServiceByCode(mockDb, 'SVC-TST-001');

      expect(result).toMatchObject({
        id: 'svc-123',
        serviceCode: 'SVC-TST-001',
      });
    });

    it('should return null when no service matches code', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await getServiceByCode(mockDb, 'NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('listServices', () => {
    it('should list active services by default', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'svc-1', data: () => ({ name: 'Service A', isActive: true }) },
          { id: 'svc-2', data: () => ({ name: 'Service B', isActive: true }) },
        ],
      });

      const result = await listServices(mockDb);

      expect(result).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should include inactive services when requested', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'svc-1', data: () => ({ name: 'Active', isActive: true }) },
          { id: 'svc-2', data: () => ({ name: 'Inactive', isActive: false }) },
        ],
      });

      const result = await listServices(mockDb, { includeInactive: true });

      expect(result).toHaveLength(2);
      // Should NOT filter by isActive
      expect(mockWhere).not.toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should filter by category when specified', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ id: 'svc-1', data: () => ({ name: 'Test', category: 'TESTING' }) }],
      });

      await listServices(mockDb, { category: 'TESTING' as ServiceCategory });

      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'TESTING');
    });

    it('should order by name ascending', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listServices(mockDb);

      expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    });
  });

  // ============================================================================
  // UPDATE
  // ============================================================================

  describe('updateService', () => {
    it('should update service with new data and timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateService(mockDb, 'svc-123', { name: 'Updated Name' }, userId);

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'services', 'svc-123');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated Name',
          updatedBy: userId,
          updatedAt: mockTimestamp,
        })
      );
    });

    it('should update multiple fields at once', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateService(
        mockDb,
        'svc-123',
        {
          name: 'Updated Name',
          description: 'Updated description',
          estimatedTurnaroundDays: 14,
          isActive: false,
        },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          estimatedTurnaroundDays: 14,
          isActive: false,
        })
      );
    });

    it('should propagate errors from Firestore', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Firestore update failed'));

      await expect(updateService(mockDb, 'svc-123', { name: 'Test' }, userId)).rejects.toThrow();
    });
  });

  // ============================================================================
  // DELETE / RESTORE
  // ============================================================================

  describe('deleteService', () => {
    it('should soft-delete by setting isActive to false', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteService(mockDb, 'svc-123', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          updatedBy: userId,
          updatedAt: mockTimestamp,
        })
      );
    });
  });

  describe('restoreService', () => {
    it('should restore by setting isActive to true', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await restoreService(mockDb, 'svc-123', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: true,
          updatedBy: userId,
          updatedAt: mockTimestamp,
        })
      );
    });
  });
});
