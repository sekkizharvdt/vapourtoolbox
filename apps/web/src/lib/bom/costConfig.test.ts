/**
 * Cost Configuration Service Tests
 *
 * Tests for CRUD operations for managing entity-level cost configurations.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unused-vars */

import type { Firestore, Timestamp } from 'firebase/firestore';
import type {
  CreateCostConfigurationInput,
  LaborRates,
  FabricationRates,
  OverheadConfig,
} from '@vapour/types';

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
    COST_CONFIGURATIONS: 'costConfigurations',
  },
}));

// Mock default configs from types
jest.mock('@vapour/types', () => ({
  DEFAULT_OVERHEAD_CONFIG: {
    enabled: true,
    ratePercent: 15,
    applicableTo: 'ALL',
  },
  DEFAULT_CONTINGENCY_CONFIG: {
    enabled: true,
    ratePercent: 5,
  },
  DEFAULT_PROFIT_CONFIG: {
    enabled: true,
    ratePercent: 10,
  },
}));

// Import after mocks
import {
  createCostConfiguration,
  getActiveCostConfiguration,
  getCostConfiguration,
  updateCostConfiguration,
  listCostConfigurations,
  deactivateCostConfiguration,
  getDefaultCostConfiguration,
} from './costConfig';

describe('Cost Configuration Service', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 } as Timestamp;
  const userId = 'user-123';
  const entityId = 'entity-456';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockCollection.mockReturnValue({ id: 'costConfigurations' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderBy-constraint');
    mockLimit.mockReturnValue('limit-constraint');
    mockDoc.mockReturnValue({ id: 'mock-doc' });
  });

  describe('createCostConfiguration', () => {
    const createInput: CreateCostConfigurationInput = {
      entityId: 'entity-456',
      name: 'Standard Config',
      description: 'Default cost configuration',
      overhead: {
        enabled: true,
        ratePercent: 10,
        applicableTo: 'FABRICATION',
      },
      contingency: {
        enabled: true,
        ratePercent: 5,
      },
      profit: {
        enabled: true,
        ratePercent: 15,
      },
    };

    it('should create cost configuration with defaults', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const result = await createCostConfiguration(mockDb, createInput, userId);

      expect(result.id).toBe('config-new');
      expect(result.entityId).toBe('entity-456');
      expect(result.name).toBe('Standard Config');
      expect(result.isActive).toBe(true);
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
    });

    it('should use provided overhead config', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const result = await createCostConfiguration(mockDb, createInput, userId);

      expect(result.overhead).toEqual({
        enabled: true,
        ratePercent: 10,
        applicableTo: 'FABRICATION',
      });
    });

    it('should use provided contingency config', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const result = await createCostConfiguration(mockDb, createInput, userId);

      expect(result.contingency).toEqual({
        enabled: true,
        ratePercent: 5,
      });
    });

    it('should use provided profit config', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const result = await createCostConfiguration(mockDb, createInput, userId);

      expect(result.profit).toEqual({
        enabled: true,
        ratePercent: 15,
      });
    });

    it('should use custom overhead config when different from input', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const customOverhead: OverheadConfig = {
        enabled: true,
        ratePercent: 20,
        applicableTo: 'MATERIAL',
      };

      const result = await createCostConfiguration(
        mockDb,
        { ...createInput, overhead: customOverhead },
        userId
      );

      expect(result.overhead).toEqual(customOverhead);
    });

    it('should set effectiveFrom to current time when not provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const result = await createCostConfiguration(mockDb, createInput, userId);

      expect(result.effectiveFrom).toEqual(mockTimestamp);
    });

    it('should use provided effectiveFrom', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const customDate = { seconds: 1700000000, nanoseconds: 0 } as Timestamp;
      const result = await createCostConfiguration(
        mockDb,
        { ...createInput, effectiveFrom: customDate },
        userId
      );

      expect(result.effectiveFrom).toEqual(customDate);
    });

    it('should include labor and fabrication rates when provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'config-new' });

      const laborRates: LaborRates = {
        engineerHourlyRate: { amount: 500, currency: 'INR' },
        draftsmanHourlyRate: { amount: 300, currency: 'INR' },
        fitterHourlyRate: { amount: 250, currency: 'INR' },
        welderHourlyRate: { amount: 350, currency: 'INR' },
        supervisorHourlyRate: { amount: 400, currency: 'INR' },
      };
      const fabricationRates: FabricationRates = {
        cuttingRatePerMeter: { amount: 10, currency: 'INR' },
        weldingRatePerMeter: { amount: 20, currency: 'INR' },
        formingRatePerSqMeter: { amount: 30, currency: 'INR' },
        machiningRatePerHour: { amount: 100, currency: 'INR' },
        assemblyRatePerUnit: { amount: 50, currency: 'INR' },
      };

      const result = await createCostConfiguration(
        mockDb,
        { ...createInput, laborRates, fabricationRates },
        userId
      );

      expect(result.laborRates).toEqual(laborRates);
      expect(result.fabricationRates).toEqual(fabricationRates);
    });
  });

  describe('getActiveCostConfiguration', () => {
    it('should return null when no active configuration exists', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await getActiveCostConfiguration(mockDb, entityId);

      expect(result).toBeNull();
    });

    it('should return active configuration when exists', async () => {
      const mockConfig = {
        entityId: 'entity-456',
        isActive: true,
        overhead: { enabled: true, ratePercent: 15 },
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'config-123',
            data: () => mockConfig,
          },
        ],
      });

      const result = await getActiveCostConfiguration(mockDb, entityId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('config-123');
      expect(result?.entityId).toBe('entity-456');
    });

    it('should filter by entityId, isActive, and effectiveFrom', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      await getActiveCostConfiguration(mockDb, entityId);

      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', entityId);
      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
      expect(mockWhere).toHaveBeenCalledWith('effectiveFrom', '<=', mockTimestamp);
    });

    it('should order by effectiveFrom descending and limit to 1', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      await getActiveCostConfiguration(mockDb, entityId);

      expect(mockOrderBy).toHaveBeenCalledWith('effectiveFrom', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(1);
    });
  });

  describe('getCostConfiguration', () => {
    it('should return configuration when exists', async () => {
      const mockConfig = {
        entityId: 'entity-456',
        name: 'Test Config',
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'config-123',
        data: () => mockConfig,
      });

      const result = await getCostConfiguration(mockDb, 'config-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('config-123');
      expect(result?.name).toBe('Test Config');
    });

    it('should return null when configuration does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getCostConfiguration(mockDb, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateCostConfiguration', () => {
    it('should update configuration with provided fields', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCostConfiguration(
        mockDb,
        'config-123',
        { name: 'Updated Name', description: 'New description' },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated Name',
          description: 'New description',
          updatedBy: userId,
          updatedAt: mockTimestamp,
        })
      );
    });

    it('should update overhead when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const newOverhead = { enabled: false, ratePercent: 0, applicableTo: 'ALL' as const };
      await updateCostConfiguration(mockDb, 'config-123', { overhead: newOverhead }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          overhead: newOverhead,
        })
      );
    });

    it('should update contingency when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const newContingency = { enabled: true, ratePercent: 8 };
      await updateCostConfiguration(mockDb, 'config-123', { contingency: newContingency }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          contingency: newContingency,
        })
      );
    });

    it('should update profit when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const newProfit = { enabled: true, ratePercent: 12 };
      await updateCostConfiguration(mockDb, 'config-123', { profit: newProfit }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          profit: newProfit,
        })
      );
    });

    it('should update isActive when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCostConfiguration(mockDb, 'config-123', { isActive: false }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it('should not include undefined fields', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCostConfiguration(mockDb, 'config-123', { name: 'Only Name' }, userId);

      const updateCall = mockUpdateDoc.mock.calls[0]?.[1];
      expect(updateCall).not.toHaveProperty('overhead');
      expect(updateCall).not.toHaveProperty('contingency');
      expect(updateCall).not.toHaveProperty('profit');
    });
  });

  describe('listCostConfigurations', () => {
    it('should list all configurations for entity', async () => {
      const mockConfigs = [
        { id: 'config-1', name: 'Config 1' },
        { id: 'config-2', name: 'Config 2' },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockConfigs.map((config) => ({
          id: config.id,
          data: () => config,
        })),
      });

      const result = await listCostConfigurations(mockDb, entityId);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('config-1');
      expect(result[1]?.id).toBe('config-2');
    });

    it('should filter by entityId', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listCostConfigurations(mockDb, entityId);

      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', entityId);
    });

    it('should order by effectiveFrom descending', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listCostConfigurations(mockDb, entityId);

      expect(mockOrderBy).toHaveBeenCalledWith('effectiveFrom', 'desc');
    });

    it('should return empty array when no configurations exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await listCostConfigurations(mockDb, entityId);

      expect(result).toHaveLength(0);
    });
  });

  describe('deactivateCostConfiguration', () => {
    it('should set isActive to false', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await deactivateCostConfiguration(mockDb, 'config-123', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          updatedBy: userId,
        })
      );
    });
  });

  describe('getDefaultCostConfiguration', () => {
    it('should return default configuration structure', () => {
      const result = getDefaultCostConfiguration(entityId);

      expect(result.entityId).toBe(entityId);
      expect(result.isActive).toBe(false);
      expect(result.overhead).toEqual({
        enabled: true,
        ratePercent: 15,
        applicableTo: 'ALL',
      });
      expect(result.contingency).toEqual({
        enabled: true,
        ratePercent: 5,
      });
      expect(result.profit).toEqual({
        enabled: true,
        ratePercent: 10,
      });
    });

    it('should set effectiveFrom to current timestamp', () => {
      const result = getDefaultCostConfiguration(entityId);

      expect(result.effectiveFrom).toEqual(mockTimestamp);
    });

    it('should not include id, createdAt, updatedAt, createdBy, updatedBy', () => {
      const result = getDefaultCostConfiguration(entityId);

      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('createdBy');
      expect(result).not.toHaveProperty('updatedBy');
    });
  });
});
