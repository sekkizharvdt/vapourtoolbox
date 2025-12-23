/**
 * Material CRUD Operations Tests
 *
 * Tests for create, read, update, and delete operations for materials.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import type { Firestore } from 'firebase/firestore';
import type { MaterialCategory } from '@vapour/types';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
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
    MATERIALS: 'materials',
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

jest.mock('@vapour/types', () => ({
  getMaterialCodeParts: (category: string) => {
    const mapping: Record<string, [string, string]> = {
      PLATES_STAINLESS_STEEL: ['PL', 'SS'],
      PLATES_CARBON_STEEL: ['PL', 'CS'],
      PIPES_STAINLESS_STEEL: ['PI', 'SS'],
      PIPES_CARBON_STEEL: ['PI', 'CS'],
    };
    return mapping[category];
  },
}));

jest.mock('../firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...data }) as T,
}));

// Import after mocks
import { createMaterial, updateMaterial, getMaterialById, deleteMaterial } from './crud';

describe('Material CRUD Operations', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 };
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockCollection.mockReturnValue({ id: 'materials' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockLimit.mockReturnValue('limit-constraint');
    mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
  });

  describe('createMaterial', () => {
    const baseMaterialData = {
      name: 'Stainless Steel 304 Plate',
      description: 'SS 304 plate for general fabrication',
      category: 'PLATES_STAINLESS_STEEL' as MaterialCategory,
      materialType: 'RAW_MATERIAL' as const,
      baseUnit: 'kg' as const,
      specification: {
        grade: '304',
        standard: 'ASTM A240',
      },
    };

    it('should create material with generated code', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, baseMaterialData as any, userId);

      expect(result.id).toBe('new-material-id');
      expect(result.materialCode).toBe('PL-SS-304');
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
      expect(result.isActive).toBe(true);
    });

    it('should use provided material code if specified', async () => {
      const dataWithCode = {
        ...baseMaterialData,
        materialCode: 'CUSTOM-001',
      };

      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, dataWithCode as any, userId);

      expect(result.materialCode).toBe('CUSTOM-001');
    });

    it('should throw error when grade is missing for code generation', async () => {
      const dataWithoutGrade = {
        ...baseMaterialData,
        specification: {
          standard: 'ASTM A240',
        },
      };

      await expect(createMaterial(mockDb, dataWithoutGrade as any, userId)).rejects.toThrow(
        'Material grade is required for code generation'
      );
    });

    it('should throw error when material code already exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'existing-material' }],
      });

      await expect(createMaterial(mockDb, baseMaterialData as any, userId)).rejects.toThrow(
        'Material code PL-SS-304 already exists'
      );
    });

    it('should initialize arrays with defaults', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, baseMaterialData as any, userId);

      expect(result.priceHistory).toEqual([]);
      expect(result.preferredVendors).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.certifications).toEqual([]);
    });

    it('should set default flags', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, baseMaterialData as any, userId);

      expect(result.isActive).toBe(true);
      expect(result.isStandard).toBe(false);
      expect(result.trackInventory).toBe(false);
    });

    it('should preserve provided arrays', async () => {
      const dataWithArrays = {
        ...baseMaterialData,
        preferredVendors: ['vendor-1', 'vendor-2'],
        tags: ['stainless', 'plate'],
        certifications: ['ISO 9001'],
      };

      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, dataWithArrays as any, userId);

      expect(result.preferredVendors).toEqual(['vendor-1', 'vendor-2']);
      expect(result.tags).toEqual(['stainless', 'plate']);
      expect(result.certifications).toEqual(['ISO 9001']);
    });

    it('should normalize grade for code generation', async () => {
      const dataWithSpacedGrade = {
        ...baseMaterialData,
        specification: {
          grade: '304 L',
          standard: 'ASTM A240',
        },
      };

      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, dataWithSpacedGrade as any, userId);

      expect(result.materialCode).toBe('PL-SS-304L');
    });

    it('should set timestamps on creation', async () => {
      mockGetDocs.mockResolvedValue({ empty: true });
      mockAddDoc.mockResolvedValue({ id: 'new-material-id' });

      const result = await createMaterial(mockDb, baseMaterialData as any, userId);

      expect(result.createdAt).toEqual(mockTimestamp);
      expect(result.updatedAt).toEqual(mockTimestamp);
    });

    it('should throw error for unsupported category', async () => {
      const unsupportedCategory = {
        ...baseMaterialData,
        category: 'UNKNOWN_CATEGORY' as MaterialCategory,
      };

      await expect(createMaterial(mockDb, unsupportedCategory as any, userId)).rejects.toThrow(
        'Material code generation not supported for category'
      );
    });
  });

  describe('updateMaterial', () => {
    it('should update material with new data', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateMaterial(mockDb, 'material-123', { name: 'Updated Name' }, userId);

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'materials', 'material-123');
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

      await updateMaterial(mockDb, 'material-123', { description: 'New description' }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: mockTimestamp,
          updatedBy: userId,
        })
      );
    });

    it('should throw error on update failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

      await expect(
        updateMaterial(mockDb, 'material-123', { name: 'Test' }, userId)
      ).rejects.toThrow('Failed to update material');
    });

    it('should update multiple fields', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateMaterial(
        mockDb,
        'material-123',
        {
          name: 'New Name',
          description: 'New Description',
          isActive: false,
          tags: ['tag1', 'tag2'],
        },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'New Name',
          description: 'New Description',
          isActive: false,
          tags: ['tag1', 'tag2'],
        })
      );
    });
  });

  describe('getMaterialById', () => {
    const mockMaterialData = {
      name: 'Test Material',
      description: 'Test description',
      category: 'PLATES_STAINLESS_STEEL',
      materialCode: 'PL-SS-304',
      isActive: true,
    };

    it('should return material when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => mockMaterialData,
      });

      const result = await getMaterialById(mockDb, 'material-123');

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'materials', 'material-123');
      expect(result).toMatchObject({
        id: 'material-123',
        name: 'Test Material',
      });
    });

    it('should return null when material not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getMaterialById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });

    it('should throw error on fetch failure', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      await expect(getMaterialById(mockDb, 'material-123')).rejects.toThrow(
        'Failed to get material'
      );
    });
  });

  describe('deleteMaterial', () => {
    it('should soft delete material by setting isActive to false', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteMaterial(mockDb, 'material-123', userId);

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'materials', 'material-123');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          updatedBy: userId,
        })
      );
    });

    it('should update timestamp on deletion', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteMaterial(mockDb, 'material-123', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: mockTimestamp,
        })
      );
    });

    it('should throw error on delete failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteMaterial(mockDb, 'material-123', userId)).rejects.toThrow(
        'Failed to delete material'
      );
    });
  });
});
