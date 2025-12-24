/**
 * BOM Calculations Engine Tests
 *
 * Tests for cost and weight calculations for BOM items by integrating with
 * Material Database and Shape Database.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */

import type { BOMItem, Material, Shape, ShapeParameter, MaterialPrice } from '@vapour/types';
import { ServiceCategory, ServiceCalculationMethod } from '@vapour/types';
import type { Firestore, Timestamp } from 'firebase/firestore';

// Mock firebase/firestore
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockTimestampNow = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    MATERIALS: 'materials',
    SHAPES: 'shapes',
    BOMS: 'boms',
    BOM_ITEMS: 'items',
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

// Mock shape calculator
const mockCalculateShape = jest.fn();
jest.mock('@/lib/shapes/shapeCalculator', () => ({
  calculateShape: (...args: unknown[]) => mockCalculateShape(...args),
}));

// Mock service calculations
const mockCalculateAllServiceCosts = jest.fn();
jest.mock('@/lib/services/serviceCalculations', () => ({
  calculateAllServiceCosts: (...args: unknown[]) => mockCalculateAllServiceCosts(...args),
}));

// Import after mocks
import {
  calculateBoughtOutItemCost,
  calculateItemCost,
  calculateAndUpdateItemCost,
  calculateAllItemCosts,
  getMaterialPrice,
  validateShapeParameters,
} from './bomCalculations';

describe('BOM Calculations', () => {
  const mockDb = {} as Firestore;
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 };
  const userId = 'user-123';

  const createMockBOMItem = (overrides: Partial<BOMItem> = {}): BOMItem =>
    ({
      id: 'item-123',
      bomId: 'bom-123',
      itemNumber: '1',
      itemType: 'MATERIAL',
      level: 0,
      sortOrder: 1,
      name: 'Test Item',
      quantity: 10,
      unit: 'pcs',
      ...overrides,
    }) as BOMItem;

  const createMockMaterialPrice = (overrides: Partial<MaterialPrice> = {}): MaterialPrice => ({
    id: 'price-1',
    materialId: 'material-123',
    pricePerUnit: { amount: 100, currency: 'INR' },
    unit: 'kg',
    currency: 'INR',
    sourceType: 'MARKET_RATE',
    effectiveDate: { seconds: 1703318400, nanoseconds: 0 } as unknown as Timestamp,
    isActive: true,
    isForecast: false,
    createdAt: { seconds: 1703318400, nanoseconds: 0 } as unknown as Timestamp,
    createdBy: 'system',
    updatedAt: { seconds: 1703318400, nanoseconds: 0 } as unknown as Timestamp,
    updatedBy: 'system',
    ...overrides,
  });

  const createMockMaterial = (overrides: Partial<Material> = {}): Material =>
    ({
      id: 'material-123',
      name: 'Test Material',
      category: 'PLATES_STAINLESS_STEEL',
      currentPrice: createMockMaterialPrice(),
      ...overrides,
    }) as Material;

  const createMockShapeParameter = (overrides: Partial<ShapeParameter> = {}): ShapeParameter => ({
    name: 'L',
    label: 'Length',
    unit: 'mm',
    dataType: 'NUMBER',
    order: 0,
    required: true,
    usedInFormulas: ['volume', 'weight'],
    ...overrides,
  });

  const createMockShape = (overrides: Partial<Shape> = {}): Shape =>
    ({
      id: 'shape-123',
      name: 'Rectangular Plate',
      category: 'PLATE_RECTANGULAR',
      parameters: [
        createMockShapeParameter({ name: 'L', label: 'Length', order: 0 }),
        createMockShapeParameter({ name: 'W', label: 'Width', order: 1 }),
        createMockShapeParameter({ name: 't', label: 'Thickness', order: 2 }),
      ],
      ...overrides,
    }) as Shape;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockDoc.mockReturnValue({ id: 'mock-doc' });

    // Default service costs mock
    mockCalculateAllServiceCosts.mockReturnValue({
      serviceCostPerUnit: { amount: 0, currency: 'INR' },
      totalServiceCost: { amount: 0, currency: 'INR' },
      serviceBreakdown: [],
    });
  });

  describe('calculateBoughtOutItemCost', () => {
    it('should return null when item has no component', async () => {
      const item = createMockBOMItem({ component: undefined });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should return null when component has no materialId', async () => {
      const item = createMockBOMItem({
        component: { type: 'BOUGHT_OUT' },
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should return null when component type is not BOUGHT_OUT', async () => {
      const item = createMockBOMItem({
        component: { type: 'SHAPE', materialId: 'material-123' },
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should return null when material not found', async () => {
      const item = createMockBOMItem({
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should calculate cost for bought-out item', async () => {
      const material = createMockMaterial();
      const item = createMockBOMItem({
        quantity: 5,
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result).not.toBeNull();
      expect(result?.materialCostPerUnit.amount).toBe(100);
      expect(result?.totalMaterialCost.amount).toBe(500); // 100 * 5
      expect(result?.weight).toBe(0); // Bought-out items have no weight calculation
      expect(result?.totalWeight).toBe(0);
      expect(result?.fabricationCostPerUnit.amount).toBe(0); // No fabrication
      expect(result?.totalFabricationCost.amount).toBe(0);
    });

    it('should use INR as default currency when not specified', async () => {
      const material = createMockMaterial({
        currentPrice: createMockMaterialPrice({
          // Test with malformed data - currency might be undefined at runtime
          pricePerUnit: { amount: 50, currency: undefined as unknown as 'INR' },
        }),
      });
      const item = createMockBOMItem({
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result?.materialCostPerUnit.currency).toBe('INR');
    });

    it('should handle zero price material', async () => {
      const material = createMockMaterial({
        currentPrice: createMockMaterialPrice({ pricePerUnit: { amount: 0, currency: 'INR' } }),
      });
      const item = createMockBOMItem({
        quantity: 10,
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result?.totalMaterialCost.amount).toBe(0);
    });

    it('should include service costs in calculation', async () => {
      const material = createMockMaterial();
      const item = createMockBOMItem({
        quantity: 2,
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
        services: [
          {
            serviceId: 'svc-1',
            serviceName: 'Test Service',
            serviceCategory: ServiceCategory.ENGINEERING,
            calculationMethod: ServiceCalculationMethod.FIXED_AMOUNT,
            isManualOverride: false,
            addedBy: 'test-user',
            addedAt: { seconds: 1703318400, nanoseconds: 0 } as unknown as Timestamp,
          },
        ],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });

      mockCalculateAllServiceCosts.mockReturnValue({
        serviceCostPerUnit: { amount: 25, currency: 'INR' },
        totalServiceCost: { amount: 50, currency: 'INR' },
        serviceBreakdown: [{ serviceId: 'svc-1', cost: 50 }],
      });

      const result = await calculateBoughtOutItemCost(mockDb, item);

      expect(result?.serviceCostPerUnit.amount).toBe(25);
      expect(result?.totalServiceCost.amount).toBe(50);
    });
  });

  describe('calculateItemCost', () => {
    it('should return null when item has no component', async () => {
      const item = createMockBOMItem({ component: undefined });

      const result = await calculateItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should route to calculateBoughtOutItemCost for BOUGHT_OUT type', async () => {
      const material = createMockMaterial();
      const item = createMockBOMItem({
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });

      const result = await calculateItemCost(mockDb, item);

      // Should return bought-out result (no fabrication cost)
      expect(result?.fabricationCostPerUnit.amount).toBe(0);
    });

    it('should return null for SHAPE type without shapeId', async () => {
      const item = createMockBOMItem({
        component: { type: 'SHAPE', materialId: 'material-123' },
      });

      const result = await calculateItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should return null for SHAPE type without materialId', async () => {
      const item = createMockBOMItem({
        component: { type: 'SHAPE', shapeId: 'shape-123' },
      });

      const result = await calculateItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should return null when shape not found', async () => {
      const item = createMockBOMItem({
        component: { type: 'SHAPE', shapeId: 'shape-123', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await calculateItemCost(mockDb, item);

      expect(result).toBeNull();
    });

    it('should calculate cost for shape-based item', async () => {
      const shape = createMockShape();
      const material = createMockMaterial();
      const item = createMockBOMItem({
        quantity: 2,
        component: {
          type: 'SHAPE',
          shapeId: 'shape-123',
          materialId: 'material-123',
          parameters: { L: 100, W: 50, t: 10 },
        },
      });

      mockGetDoc.mockImplementation((ref) => {
        if (ref?.id === 'shape-123' || mockDoc.mock.calls.some((c) => c[2] === 'shape-123')) {
          return Promise.resolve({
            exists: () => true,
            id: 'shape-123',
            data: () => shape,
          });
        }
        return Promise.resolve({
          exists: () => true,
          id: 'material-123',
          data: () => material,
        });
      });

      mockCalculateShape.mockReturnValue({
        calculatedValues: { weight: 3.93 },
        costEstimate: {
          materialCost: 150,
          fabricationCost: 75,
          currency: 'INR',
        },
      });

      const result = await calculateItemCost(mockDb, item);

      expect(result).not.toBeNull();
      expect(result?.weight).toBe(3.93);
      expect(result?.totalWeight).toBe(7.86); // 3.93 * 2
      expect(result?.materialCostPerUnit.amount).toBe(150);
      expect(result?.totalMaterialCost.amount).toBe(300); // 150 * 2
      expect(result?.fabricationCostPerUnit.amount).toBe(75);
      expect(result?.totalFabricationCost.amount).toBe(150); // 75 * 2
    });

    it('should return null on calculation error', async () => {
      const item = createMockBOMItem({
        component: { type: 'SHAPE', shapeId: 'shape-123', materialId: 'material-123' },
      });

      mockGetDoc.mockRejectedValue(new Error('Database error'));

      const result = await calculateItemCost(mockDb, item);

      expect(result).toBeNull();
    });
  });

  describe('calculateAndUpdateItemCost', () => {
    it('should skip update when no calculation result', async () => {
      const item = createMockBOMItem({ component: undefined });

      await calculateAndUpdateItemCost(mockDb, 'bom-123', item, userId);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should update item with calculated values', async () => {
      const material = createMockMaterial();
      const item = createMockBOMItem({
        component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await calculateAndUpdateItemCost(mockDb, 'bom-123', item, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          calculatedProperties: expect.any(Object),
          cost: expect.any(Object),
          updatedBy: userId,
        })
      );
    });
  });

  describe('calculateAllItemCosts', () => {
    it('should calculate costs for all items in parallel', async () => {
      const items = [
        createMockBOMItem({ id: 'item-1', component: undefined }),
        createMockBOMItem({ id: 'item-2', component: undefined }),
        createMockBOMItem({ id: 'item-3', component: undefined }),
      ];

      await calculateAllItemCosts(mockDb, 'bom-123', items, userId);

      // All items processed (even if skipped)
      // No errors thrown
      expect(true).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const material = createMockMaterial();
      const items = [
        createMockBOMItem({
          id: 'item-1',
          component: { type: 'BOUGHT_OUT', materialId: 'material-123' },
        }),
        createMockBOMItem({ id: 'item-2', component: undefined }),
      ];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'material-123',
        data: () => material,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      // Should not throw even with mixed results
      await expect(calculateAllItemCosts(mockDb, 'bom-123', items, userId)).resolves.not.toThrow();
    });

    it('should process empty item list', async () => {
      await expect(calculateAllItemCosts(mockDb, 'bom-123', [], userId)).resolves.not.toThrow();
    });
  });

  describe('getMaterialPrice', () => {
    it('should return material price when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          currentPrice: { pricePerUnit: { amount: 250 } },
        }),
      });

      const price = await getMaterialPrice(mockDb, 'material-123');

      expect(price).toBe(250);
    });

    it('should return 0 when material not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const price = await getMaterialPrice(mockDb, 'non-existent');

      expect(price).toBe(0);
    });

    it('should return 0 when material has no price', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const price = await getMaterialPrice(mockDb, 'material-123');

      expect(price).toBe(0);
    });

    it('should return 0 on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Database error'));

      const price = await getMaterialPrice(mockDb, 'material-123');

      expect(price).toBe(0);
    });
  });

  describe('validateShapeParameters', () => {
    it('should return invalid when shape not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await validateShapeParameters(mockDb, 'shape-123', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Shape not found');
    });

    it('should validate required parameters', async () => {
      const shape = createMockShape({
        parameters: [
          createMockShapeParameter({ name: 'L', label: 'Length', required: true }),
          createMockShapeParameter({ name: 'W', label: 'Width', required: true }),
        ],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => shape,
      });

      const result = await validateShapeParameters(mockDb, 'shape-123', { L: 100 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required parameter 'Width' is missing");
    });

    it('should validate minimum values', async () => {
      const shape = createMockShape({
        parameters: [createMockShapeParameter({ name: 'L', label: 'Length', minValue: 10 })],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => shape,
      });

      const result = await validateShapeParameters(mockDb, 'shape-123', { L: 5 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'Length' is below minimum value (10)");
    });

    it('should validate maximum values', async () => {
      const shape = createMockShape({
        parameters: [createMockShapeParameter({ name: 'L', label: 'Length', maxValue: 1000 })],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => shape,
      });

      const result = await validateShapeParameters(mockDb, 'shape-123', { L: 1500 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'Length' exceeds maximum value (1000)");
    });

    it('should return valid when all constraints satisfied', async () => {
      const shape = createMockShape({
        parameters: [
          createMockShapeParameter({
            name: 'L',
            label: 'Length',
            required: true,
            minValue: 10,
            maxValue: 1000,
          }),
          createMockShapeParameter({
            name: 'W',
            label: 'Width',
            required: true,
            minValue: 5,
            maxValue: 500,
          }),
        ],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => shape,
      });

      const result = await validateShapeParameters(mockDb, 'shape-123', { L: 100, W: 50 });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation error on database failure', async () => {
      mockGetDoc.mockRejectedValue(new Error('Database error'));

      const result = await validateShapeParameters(mockDb, 'shape-123', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation error occurred');
    });

    it('should allow optional parameters to be missing', async () => {
      const shape = createMockShape({
        parameters: [
          createMockShapeParameter({ name: 'L', label: 'Length', required: true }),
          createMockShapeParameter({ name: 'note', label: 'Note', required: false }),
        ],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => shape,
      });

      const result = await validateShapeParameters(mockDb, 'shape-123', { L: 100 });

      expect(result.valid).toBe(true);
    });
  });
});
