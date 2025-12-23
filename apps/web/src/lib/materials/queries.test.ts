/**
 * Material Querying & Search Tests
 *
 * Tests for server-side querying, filtering, and search for materials.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */

import type { Firestore } from 'firebase/firestore';
import type { Material, MaterialCategory, MaterialType } from '@vapour/types';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
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

jest.mock('../firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...data }) as T,
}));

// Import after mocks
import { queryMaterials, searchMaterials, getMaterialsByVendor } from './queries';

describe('Material Querying & Search', () => {
  const mockDb = {} as Firestore;

  const createMockMaterial = (overrides: Partial<Material> = {}): Material =>
    ({
      id: `material-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Material',
      description: 'Test description',
      category: 'PLATES_STAINLESS_STEEL' as MaterialCategory,
      materialCode: 'PL-SS-304',
      materialType: 'RAW_MATERIAL' as MaterialType,
      baseUnit: 'kg',
      isActive: true,
      isStandard: false,
      tags: [],
      preferredVendors: [],
      ...overrides,
    }) as Material;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({ id: 'materials' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderBy-constraint');
    mockLimit.mockReturnValue('limit-constraint');
  });

  describe('queryMaterials', () => {
    it('should query materials with default options', async () => {
      const mockMaterials = [createMockMaterial(), createMockMaterial()];
      mockGetDocs.mockResolvedValue({
        docs: mockMaterials.map((m) => ({ id: m.id, data: () => m })),
        size: 2,
      });

      const result = await queryMaterials(mockDb);

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'materials');
      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(51); // Default 50 + 1
      expect(result.materials).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by single category', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        categories: ['PLATES_STAINLESS_STEEL' as MaterialCategory],
      });

      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'PLATES_STAINLESS_STEEL');
    });

    it('should filter by multiple categories using in', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        categories: ['PLATES_STAINLESS_STEEL', 'PLATES_CARBON_STEEL'] as MaterialCategory[],
      });

      expect(mockWhere).toHaveBeenCalledWith('category', 'in', [
        'PLATES_STAINLESS_STEEL',
        'PLATES_CARBON_STEEL',
      ]);
    });

    it('should filter by single material type', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        materialTypes: ['RAW_MATERIAL' as MaterialType],
      });

      expect(mockWhere).toHaveBeenCalledWith('materialType', '==', 'RAW_MATERIAL');
    });

    it('should filter by multiple material types', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        materialTypes: ['RAW_MATERIAL', 'SEMI_FINISHED'] as MaterialType[],
      });

      expect(mockWhere).toHaveBeenCalledWith('materialType', 'in', [
        'RAW_MATERIAL',
        'SEMI_FINISHED',
      ]);
    });

    it('should filter by isActive', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, { isActive: true });

      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should filter by isStandard', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, { isStandard: true });

      expect(mockWhere).toHaveBeenCalledWith('isStandard', '==', true);
    });

    it('should apply custom sort field and direction', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        sortField: 'name' as any,
        sortDirection: 'asc',
      });

      expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    });

    it('should apply custom limit', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, { limitResults: 100 });

      expect(mockLimit).toHaveBeenCalledWith(101); // 100 + 1 for hasMore check
    });

    it('should indicate hasMore when more results exist', async () => {
      const mockMaterials = Array(51)
        .fill(null)
        .map(() => createMockMaterial());
      mockGetDocs.mockResolvedValue({
        docs: mockMaterials.map((m) => ({ id: m.id, data: () => m })),
        size: 51,
      });

      const result = await queryMaterials(mockDb, { limitResults: 50 });

      expect(result.materials).toHaveLength(50); // Should slice to limit
      expect(result.hasMore).toBe(true);
    });

    it('should return lastDoc for pagination', async () => {
      const mockMaterials = [
        createMockMaterial({ id: 'material-1' }),
        createMockMaterial({ id: 'material-2' }),
      ];
      mockGetDocs.mockResolvedValue({
        docs: mockMaterials.map((m) => ({ id: m.id, data: () => m })),
        size: 2,
      });

      const result = await queryMaterials(mockDb);

      expect(result.lastDoc).toBe('material-2');
    });

    it('should handle empty results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      const result = await queryMaterials(mockDb);

      expect(result.materials).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeUndefined();
    });

    it('should throw error on query failure', async () => {
      mockGetDocs.mockRejectedValue(new Error('Query failed'));

      await expect(queryMaterials(mockDb)).rejects.toThrow('Failed to query materials');
    });

    it('should apply multiple filters together', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await queryMaterials(mockDb, {
        categories: ['PLATES_STAINLESS_STEEL' as MaterialCategory],
        isActive: true,
        isStandard: false,
      });

      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'PLATES_STAINLESS_STEEL');
      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
      expect(mockWhere).toHaveBeenCalledWith('isStandard', '==', false);
    });
  });

  describe('searchMaterials', () => {
    it('should search materials by name', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', name: 'Stainless Steel 304' }),
        createMockMaterial({ id: 'm2', name: 'Carbon Steel' }),
        createMockMaterial({ id: 'm3', name: 'Stainless Steel 316' }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'stainless');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['m1', 'm3']);
    });

    it('should search materials by description', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', description: 'High quality fabrication material' }),
        createMockMaterial({ id: 'm2', description: 'Standard industrial use' }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'fabrication');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it('should search materials by material code', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', materialCode: 'PL-SS-304' }),
        createMockMaterial({ id: 'm2', materialCode: 'PL-CS-A36' }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'SS-304');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it('should search materials by custom code', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', customCode: 'CUSTOM-001' }),
        createMockMaterial({ id: 'm2', customCode: 'CUSTOM-002' }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'CUSTOM-001');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it('should search materials by tags', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', tags: ['stainless', 'corrosion-resistant'] }),
        createMockMaterial({ id: 'm2', tags: ['carbon', 'structural'] }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'corrosion');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it('should be case insensitive', async () => {
      const materials = [createMockMaterial({ id: 'm1', name: 'STAINLESS Steel' })];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'stainless');

      expect(result).toHaveLength(1);
    });

    it('should apply limit to results', async () => {
      const materials = Array(100)
        .fill(null)
        .map((_, i) => createMockMaterial({ id: `m${i}`, name: `Steel ${i}` }));

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      const result = await searchMaterials(mockDb, 'steel', 10);

      expect(result).toHaveLength(10);
    });

    it('should only search active materials', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await searchMaterials(mockDb, 'test');

      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should throw error on search failure', async () => {
      mockGetDocs.mockRejectedValue(new Error('Search failed'));

      await expect(searchMaterials(mockDb, 'test')).rejects.toThrow('Failed to search materials');
    });

    it('should handle empty search results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await searchMaterials(mockDb, 'nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should handle undefined customCode without throwing', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', name: 'Steel Plate', customCode: undefined }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
      });

      // Should not throw when customCode is undefined and search doesn't match
      const result = await searchMaterials(mockDb, 'xyz-nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('getMaterialsByVendor', () => {
    it('should query materials by vendor ID', async () => {
      const materials = [
        createMockMaterial({ id: 'm1', preferredVendors: ['vendor-1'] }),
        createMockMaterial({ id: 'm2', preferredVendors: ['vendor-1', 'vendor-2'] }),
      ];

      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
        size: 2,
      });

      const result = await getMaterialsByVendor(mockDb, 'vendor-1');

      expect(mockWhere).toHaveBeenCalledWith('preferredVendors', 'array-contains', 'vendor-1');
      expect(result.materials).toHaveLength(2);
    });

    it('should filter only active materials', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await getMaterialsByVendor(mockDb, 'vendor-1');

      expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should order by updatedAt descending', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await getMaterialsByVendor(mockDb, 'vendor-1');

      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('should apply custom limit', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      await getMaterialsByVendor(mockDb, 'vendor-1', 50);

      expect(mockLimit).toHaveBeenCalledWith(51); // 50 + 1
    });

    it('should indicate hasMore correctly', async () => {
      const materials = Array(101)
        .fill(null)
        .map(() => createMockMaterial());
      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
        size: 101,
      });

      const result = await getMaterialsByVendor(mockDb, 'vendor-1', 100);

      expect(result.hasMore).toBe(true);
      expect(result.materials).toHaveLength(100);
    });

    it('should return lastDoc for pagination', async () => {
      const materials = [createMockMaterial({ id: 'material-last' })];
      mockGetDocs.mockResolvedValue({
        docs: materials.map((m) => ({ id: m.id, data: () => m })),
        size: 1,
      });

      const result = await getMaterialsByVendor(mockDb, 'vendor-1');

      expect(result.lastDoc).toBe('material-last');
    });

    it('should throw error on query failure', async () => {
      mockGetDocs.mockRejectedValue(new Error('Query failed'));

      await expect(getMaterialsByVendor(mockDb, 'vendor-1')).rejects.toThrow(
        'Failed to get materials by vendor'
      );
    });

    it('should handle no materials for vendor', async () => {
      mockGetDocs.mockResolvedValue({ docs: [], size: 0 });

      const result = await getMaterialsByVendor(mockDb, 'vendor-1');

      expect(result.materials).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeUndefined();
    });
  });
});
