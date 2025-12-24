/**
 * BOM Service Tests
 *
 * Tests for CRUD operations on BOMs and BOM items with automatic
 * cost calculation, hierarchical numbering, and summary aggregation.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unused-vars */

import type { Firestore, Timestamp } from 'firebase/firestore';
import type { BOMCategory, BOMStatus, CreateBOMInput, CreateBOMItemInput } from '@vapour/types';
import { BOMItemType } from '@vapour/types';

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
const mockWriteBatch = jest.fn();
const mockSetDoc = jest.fn();
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
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    BOMS: 'boms',
    BOM_ITEMS: 'items',
    COUNTERS: 'counters',
    COST_CONFIGURATIONS: 'costConfigurations',
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

jest.mock('./costConfig', () => ({
  getActiveCostConfiguration: jest.fn().mockResolvedValue(null),
}));

// Import after mocks
import {
  generateBOMCode,
  createBOM,
  getBOMById,
  updateBOM,
  deleteBOM,
  listBOMs,
  addBOMItem,
  updateBOMItem,
  deleteBOMItem,
  getBOMItems,
  recalculateBOMSummary,
} from './bomService';

describe('BOM Service', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 } as Timestamp;
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockCollection.mockReturnValue({ id: 'boms' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderBy-constraint');
    mockLimit.mockReturnValue('limit-constraint');
    mockDoc.mockReturnValue({ id: 'mock-doc' });
  });

  describe('generateBOMCode', () => {
    it('should generate code with counter when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ value: 5 }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      const code = await generateBOMCode(mockDb);

      const year = new Date().getFullYear();
      expect(code).toBe(`EST-${year}-0006`);
    });

    it('should generate code with sequence 1 when counter does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const code = await generateBOMCode(mockDb);

      const year = new Date().getFullYear();
      expect(code).toBe(`EST-${year}-0001`);
    });

    it('should generate fallback code on counter failure', async () => {
      mockGetDoc.mockRejectedValue(new Error('Counter failed'));

      const code = await generateBOMCode(mockDb);

      const year = new Date().getFullYear();
      expect(code).toMatch(new RegExp(`^EST-${year}-\\d{6}$`));
    });

    it('should increment counter properly', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ value: 99 }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      const code = await generateBOMCode(mockDb);

      const year = new Date().getFullYear();
      expect(code).toBe(`EST-${year}-0100`);
    });
  });

  describe('createBOM', () => {
    const createBOMInput: CreateBOMInput = {
      name: 'Test BOM',
      description: 'Test description',
      category: 'FABRICATION' as BOMCategory,
      entityId: 'entity-123',
      projectId: 'project-456',
      projectName: 'Test Project',
    };

    beforeEach(() => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);
    });

    it('should create a BOM with generated code', async () => {
      mockAddDoc.mockResolvedValue({ id: 'bom-new' });

      const result = await createBOM(mockDb, createBOMInput, userId);

      expect(result.id).toBe('bom-new');
      expect(result.name).toBe('Test BOM');
      expect(result.bomCode).toMatch(/^EST-\d{4}-\d{4}$/);
      expect(result.status).toBe('DRAFT');
      expect(result.version).toBe(1);
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
    });

    it('should initialize summary with zero values', async () => {
      mockAddDoc.mockResolvedValue({ id: 'bom-new' });

      const result = await createBOM(mockDb, createBOMInput, userId);

      expect(result.summary).toEqual({
        totalWeight: 0,
        totalMaterialCost: { amount: 0, currency: 'INR' },
        totalFabricationCost: { amount: 0, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
        totalDirectCost: { amount: 0, currency: 'INR' },
        overhead: { amount: 0, currency: 'INR' },
        contingency: { amount: 0, currency: 'INR' },
        profit: { amount: 0, currency: 'INR' },
        totalCost: { amount: 0, currency: 'INR' },
        itemCount: 0,
        currency: 'INR',
      });
    });

    it('should include all required fields', async () => {
      mockAddDoc.mockResolvedValue({ id: 'bom-new' });

      const result = await createBOM(mockDb, createBOMInput, userId);

      expect(result.entityId).toBe('entity-123');
      expect(result.projectId).toBe('project-456');
      expect(result.projectName).toBe('Test Project');
      expect(result.category).toBe('FABRICATION');
      expect(result.description).toBe('Test description');
    });

    it('should throw error on Firestore failure', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(createBOM(mockDb, createBOMInput, userId)).rejects.toThrow('Firestore error');
    });
  });

  describe('getBOMById', () => {
    it('should return BOM when exists', async () => {
      const mockBOMData = {
        bomCode: 'EST-2024-0001',
        name: 'Test BOM',
        status: 'DRAFT',
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bom-123',
        data: () => mockBOMData,
      });

      const result = await getBOMById(mockDb, 'bom-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('bom-123');
      expect(result?.name).toBe('Test BOM');
    });

    it('should return null when BOM does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getBOMById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });

    it('should throw error on Firestore error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(getBOMById(mockDb, 'bom-123')).rejects.toThrow('Firestore error');
    });
  });

  describe('updateBOM', () => {
    it('should update BOM with provided fields', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateBOM(mockDb, 'bom-123', { name: 'Updated Name' }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated Name',
          updatedBy: userId,
        })
      );
    });

    it('should update timestamp on update', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateBOM(mockDb, 'bom-123', { status: 'APPROVED' as BOMStatus }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: mockTimestamp,
        })
      );
    });

    it('should throw error on update failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

      await expect(updateBOM(mockDb, 'bom-123', { name: 'New' }, userId)).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('deleteBOM', () => {
    it('should delete BOM and all items', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDocs.mockResolvedValue({
        docs: [{ ref: { id: 'item-1' } }, { ref: { id: 'item-2' } }],
      });

      await deleteBOM(mockDb, 'bom-123');

      expect(mockBatch.delete).toHaveBeenCalledTimes(3); // 2 items + 1 BOM
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle BOM with no items', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDocs.mockResolvedValue({ docs: [] });

      await deleteBOM(mockDb, 'bom-123');

      expect(mockBatch.delete).toHaveBeenCalledTimes(1); // Just the BOM
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should throw error on delete failure', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDocs.mockResolvedValue({ docs: [] });

      await expect(deleteBOM(mockDb, 'bom-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('listBOMs', () => {
    it('should list BOMs with entityId filter', async () => {
      const mockBOMs = [
        { id: 'bom-1', name: 'BOM 1' },
        { id: 'bom-2', name: 'BOM 2' },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockBOMs.map((bom) => ({
          id: bom.id,
          data: () => bom,
        })),
      });

      const result = await listBOMs(mockDb, { entityId: 'entity-123' });

      expect(result).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity-123');
    });

    it('should filter by projectId when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listBOMs(mockDb, { entityId: 'entity-123', projectId: 'project-456' });

      expect(mockWhere).toHaveBeenCalledWith('projectId', '==', 'project-456');
    });

    it('should filter by category when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listBOMs(mockDb, { entityId: 'entity-123', category: 'FABRICATION' as BOMCategory });

      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'FABRICATION');
    });

    it('should filter by status when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listBOMs(mockDb, { entityId: 'entity-123', status: 'DRAFT' as BOMStatus });

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'DRAFT');
    });

    it('should apply limit when provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listBOMs(mockDb, { entityId: 'entity-123', limit: 10 });

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it('should order by createdAt descending', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listBOMs(mockDb, { entityId: 'entity-123' });

      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('addBOMItem', () => {
    const mockItemInput: CreateBOMItemInput = {
      name: 'Test Item',
      description: 'Item description',
      quantity: 5,
      unit: 'pcs',
      itemType: BOMItemType.MATERIAL,
    };

    beforeEach(() => {
      // Mock for root level item number generation
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'item-new' });
      // Mock getBOMById for recalculateBOMSummary
      mockGetDoc.mockImplementation((ref) => {
        if (ref?.id === 'mock-doc') {
          return Promise.resolve({
            exists: () => true,
            id: 'bom-123',
            data: () => ({
              bomCode: 'EST-2024-0001',
              entityId: 'entity-123',
              summary: {},
            }),
          });
        }
        return Promise.resolve({ exists: () => false });
      });
      mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('should add item with generated item number', async () => {
      const result = await addBOMItem(mockDb, 'bom-123', mockItemInput, userId);

      expect(result.id).toBe('item-new');
      expect(result.itemNumber).toBe('1');
      expect(result.level).toBe(0);
      expect(result.sortOrder).toBe(1);
    });

    it('should set item properties correctly', async () => {
      const result = await addBOMItem(mockDb, 'bom-123', mockItemInput, userId);

      expect(result.name).toBe('Test Item');
      expect(result.description).toBe('Item description');
      expect(result.quantity).toBe(5);
      expect(result.unit).toBe('pcs');
      expect(result.bomId).toBe('bom-123');
    });

    it('should add child item with parent reference', async () => {
      const parentDoc = {
        exists: () => true,
        data: () => ({
          itemNumber: '1',
          level: 0,
        }),
      };

      mockGetDoc.mockImplementation(() => {
        // Return parent item for parentItemId lookup
        return Promise.resolve(parentDoc);
      });

      // No existing siblings
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await addBOMItem(
        mockDb,
        'bom-123',
        { ...mockItemInput, parentItemId: 'parent-item' },
        userId
      );

      expect(result.itemNumber).toBe('1.1');
      expect(result.level).toBe(1);
      expect(result.parentItemId).toBe('parent-item');
    });

    it('should trigger summary recalculation', async () => {
      await addBOMItem(mockDb, 'bom-123', mockItemInput, userId);

      // Summary recalculation calls updateBOM which calls updateDoc
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('getBOMItems', () => {
    it('should return all items ordered by item number', async () => {
      const mockItems = [
        { id: 'item-1', itemNumber: '1' },
        { id: 'item-2', itemNumber: '1.1' },
        { id: 'item-3', itemNumber: '2' },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const result = await getBOMItems(mockDb, 'bom-123');

      expect(result).toHaveLength(3);
      expect(mockOrderBy).toHaveBeenCalledWith('itemNumber', 'asc');
    });

    it('should return empty array for BOM with no items', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getBOMItems(mockDb, 'bom-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateBOMItem', () => {
    beforeEach(() => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bom-123',
        data: () => ({
          bomCode: 'EST-2024-0001',
          entityId: 'entity-123',
          component: { type: 'SHAPE' },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      mockGetDocs.mockResolvedValue({ docs: [] });
    });

    it('should update item with provided fields', async () => {
      await updateBOMItem(mockDb, 'bom-123', 'item-1', { name: 'Updated Name' }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated Name',
          updatedBy: userId,
        })
      );
    });

    it('should update component when component fields provided', async () => {
      await updateBOMItem(
        mockDb,
        'bom-123',
        'item-1',
        { shapeId: 'shape-new', materialId: 'material-new' },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          component: expect.objectContaining({
            shapeId: 'shape-new',
            materialId: 'material-new',
          }),
        })
      );
    });
  });

  describe('deleteBOMItem', () => {
    beforeEach(() => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bom-123',
        data: () => ({ entityId: 'entity-123' }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('should delete item with no children', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await deleteBOMItem(mockDb, 'bom-123', 'item-1', userId);

      const mockBatch = mockWriteBatch();
      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should trigger summary recalculation after delete', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await deleteBOMItem(mockDb, 'bom-123', 'item-1', userId);

      // Summary recalculation happens
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('recalculateBOMSummary', () => {
    beforeEach(() => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'bom-123',
        data: () => ({
          bomCode: 'EST-2024-0001',
          entityId: 'entity-123',
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('should calculate summary with no items', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await recalculateBOMSummary(mockDb, 'bom-123', userId);

      expect(result.itemCount).toBe(0);
      expect(result.totalWeight).toBe(0);
      expect(result.totalMaterialCost.amount).toBe(0);
      expect(result.totalFabricationCost.amount).toBe(0);
    });

    it('should aggregate item costs correctly', async () => {
      const mockItems = [
        {
          id: 'item-1',
          calculatedProperties: { totalWeight: 10 },
          cost: {
            totalMaterialCost: { amount: 1000, currency: 'INR' },
            totalFabricationCost: { amount: 500, currency: 'INR' },
            totalServiceCost: { amount: 200, currency: 'INR' },
          },
        },
        {
          id: 'item-2',
          calculatedProperties: { totalWeight: 20 },
          cost: {
            totalMaterialCost: { amount: 2000, currency: 'INR' },
            totalFabricationCost: { amount: 1000, currency: 'INR' },
            totalServiceCost: { amount: 400, currency: 'INR' },
          },
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const result = await recalculateBOMSummary(mockDb, 'bom-123', userId);

      expect(result.itemCount).toBe(2);
      expect(result.totalWeight).toBe(30);
      expect(result.totalMaterialCost.amount).toBe(3000);
      expect(result.totalFabricationCost.amount).toBe(1500);
      expect(result.totalServiceCost.amount).toBe(600);
    });

    it('should calculate direct cost correctly', async () => {
      const mockItems = [
        {
          id: 'item-1',
          cost: {
            totalMaterialCost: { amount: 1000, currency: 'INR' },
            totalFabricationCost: { amount: 500, currency: 'INR' },
            totalServiceCost: { amount: 200, currency: 'INR' },
          },
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const result = await recalculateBOMSummary(mockDb, 'bom-123', userId);

      expect(result.totalDirectCost.amount).toBe(1700); // 1000 + 500 + 200
    });

    it('should throw error when BOM not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(recalculateBOMSummary(mockDb, 'non-existent', userId)).rejects.toThrow(
        'BOM not found'
      );
    });

    it('should update BOM with calculated summary', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await recalculateBOMSummary(mockDb, 'bom-123', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          summary: expect.any(Object),
        })
      );
    });
  });
});
