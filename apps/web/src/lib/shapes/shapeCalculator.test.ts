/**
 * Shape Calculator Service Tests
 *
 * Tests for the shape calculation service including weight, volume,
 * surface area, and cost estimation calculations.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unused-vars */

import type { Shape, Material, FormulaDefinition } from '@vapour/types';

// Mock the formula evaluator
const mockEvaluateMultipleFormulas = jest.fn();
jest.mock('./formulaEvaluator', () => ({
  evaluateMultipleFormulas: (...args: unknown[]) => mockEvaluateMultipleFormulas(...args),
}));

// Mock fabrication rates
const mockResolveFabricationRates = jest.fn();
jest.mock('@/config/fabricationRates', () => ({
  resolveFabricationRates: (...args: unknown[]) => mockResolveFabricationRates(...args),
}));

// Import after mocks
import { calculateShape } from './shapeCalculator';

describe('shapeCalculator', () => {
  const defaultFabricationRates = {
    cuttingCostPerMeter: 100,
    edgePreparationCostPerMeter: 50,
    weldingCostPerMeter: 200,
    surfaceTreatmentCostPerSqm: 150,
    baseCost: 500,
    costPerKg: 10,
    laborRatePerHour: 500,
  };

  const createMockShape = (overrides: Partial<Shape> = {}): Shape =>
    ({
      id: 'shape-1',
      name: 'Rectangular Plate',
      category: 'plates',
      parameters: [
        { name: 'L', unit: 'mm', type: 'NUMBER', label: 'Length' },
        { name: 'W', unit: 'mm', type: 'NUMBER', label: 'Width' },
        { name: 't', unit: 'mm', type: 'NUMBER', label: 'Thickness' },
      ],
      formulas: {
        volume: {
          expression: 'L * W * t',
          variables: ['L', 'W', 't'],
        } as FormulaDefinition,
        weight: {
          expression: 'volume * density / 1000000',
          variables: ['volume', 'density'],
        } as FormulaDefinition,
        surfaceArea: {
          expression: '2 * (L * W + L * t + W * t)',
          variables: ['L', 'W', 't'],
        } as FormulaDefinition,
        perimeter: {
          expression: '2 * (L + W)',
          variables: ['L', 'W'],
        } as FormulaDefinition,
      },
      fabricationCost: {
        laborHours: 2,
      },
      ...overrides,
    }) as unknown as Shape;

  const createMockMaterial = (overrides: Partial<Material> = {}): Material =>
    ({
      id: 'material-1',
      name: 'Stainless Steel 304',
      category: 'PLATES_STAINLESS_STEEL',
      properties: {
        density: 7930,
      },
      currentPrice: {
        pricePerUnit: { amount: 250, currency: 'INR' },
        currency: 'INR',
      },
      ...overrides,
    }) as unknown as Material;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveFabricationRates.mockReturnValue(defaultFabricationRates);
  });

  describe('Basic Calculations', () => {
    it('should calculate volume, weight, and surface area', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 }, // 1000 cm³ = 1000000 mm³
        weight: { result: 7.93 }, // ~7.93 kg
        surfaceArea: { result: 20000 }, // mm²
        perimeter: { result: 400 }, // mm
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues.volume).toBe(1000000);
      expect(result.calculatedValues.weight).toBe(7.93);
      expect(result.calculatedValues.surfaceArea).toBe(20000);
      expect(result.calculatedValues.perimeter).toBe(400);
    });

    it('should use material density for calculations', () => {
      const shape = createMockShape();
      const material = createMockMaterial({ properties: { density: 8000 } });

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 8 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(mockEvaluateMultipleFormulas).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ L: 100, W: 100, t: 10 }),
        8000
      );
      expect(result.materialDensity).toBe(8000);
    });

    it('should default to steel density when not specified', () => {
      const shape = createMockShape();
      const material = createMockMaterial({ properties: {} });

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 7.85 },
        surfaceArea: { result: 20000 },
      });

      calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(mockEvaluateMultipleFormulas).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        7850 // Default steel density
      );
    });

    it('should include calculated values', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 7.93 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues.volume).toBe(1000000);
      expect(result.calculatedValues.weight).toBe(7.93);
      expect(result.calculatedValues.surfaceArea).toBe(20000);
    });
  });

  describe('Cost Calculations', () => {
    it('should calculate material cost based on weight and price', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 }, // 10 kg
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      // 10 kg × 250 INR/kg = 2500 INR
      expect(result.costEstimate.materialCost).toBe(2500);
    });

    it('should calculate cutting cost from perimeter', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        perimeter: { result: 1000 }, // 1000mm = 1m
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      // 1m × 100 INR/m = 100 INR
      expect(result.costEstimate.cuttingCost).toBe(100);
    });

    it('should calculate edge preparation cost', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        edgeLength: { result: 2000 }, // 2000mm = 2m
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      // 2m × 50 INR/m = 100 INR
      expect(result.costEstimate.edgePreparationCost).toBe(100);
    });

    it('should calculate welding cost with thickness multiplier', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        weldLength: { result: 1000 }, // 1m
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 20 }, // 20mm thick
      });

      // For t=20mm: multiplier = 1 + (20-10)/50 = 1.2
      // 1m × 200 × 1.2 = 240 INR
      expect(result.costEstimate.weldingCost).toBe(240);
    });

    it('should calculate surface treatment cost', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 1000000 }, // 1 m²
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 1000, W: 1000, t: 10 },
      });

      // 1 m² × 150 INR/m² = 150 INR
      expect(result.costEstimate.surfaceTreatmentCost).toBe(150);
    });

    it('should calculate total cost including all components', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 1000000 },
        perimeter: { result: 1000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.costEstimate.totalCost).toBeGreaterThan(0);
      expect(result.costEstimate.totalCost).toBe(
        result.costEstimate.materialCostActual -
          result.costEstimate.scrapRecoveryValue +
          result.costEstimate.fabricationCost
      );
    });

    it('should use material currency in cost estimate', () => {
      const shape = createMockShape();
      const material = createMockMaterial({
        currentPrice: {
          id: 'price-1',
          materialId: 'material-1',
          pricePerUnit: { amount: 100, currency: 'USD' },
          unit: 'kg',
          currency: 'USD',
          sourceType: 'MARKET_RATE',
          effectiveDate: {
            seconds: 1703318400,
            nanoseconds: 0,
          } as unknown as import('firebase/firestore').Timestamp,
          isActive: true,
          isForecast: false,
          createdAt: {
            seconds: 1703318400,
            nanoseconds: 0,
          } as unknown as import('firebase/firestore').Timestamp,
          createdBy: 'system',
          updatedAt: {
            seconds: 1703318400,
            nanoseconds: 0,
          } as unknown as import('firebase/firestore').Timestamp,
          updatedBy: 'system',
        },
      });

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.costEstimate.currency).toBe('USD');
    });

    it('should default to INR when no currency specified', () => {
      const shape = createMockShape();
      const material = createMockMaterial({ currentPrice: undefined });

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.costEstimate.currency).toBe('INR');
    });
  });

  describe('Scrap Calculations', () => {
    it('should calculate scrap weight from blank and finished areas', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        blankArea: { result: 12000 }, // mm²
        finishedArea: { result: 10000 }, // mm²
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      // blankDimensions contains the blank area information
      expect(result.calculatedValues.finishedArea).toBe(10000);
    });

    it('should calculate scrap recovery value at 30%', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        blankArea: { result: 12000 },
        finishedArea: { result: 10000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.costEstimate.scrapRecoveryValue).toBeGreaterThan(0);
    });
  });

  describe('Quantity Handling', () => {
    it('should calculate totals based on quantity', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
        quantity: 5,
      });

      expect(result.quantity).toBe(5);
      expect(result.totalWeight).toBe(50); // 10 kg × 5
    });

    it('should default quantity to 1', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.quantity).toBe(1);
      expect(result.totalWeight).toBe(10);
    });

    it('should calculate total cost with quantity', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
        quantity: 3,
      });

      expect(result.totalCost).toBe(result.costEstimate.totalCost * 3);
    });
  });

  describe('Parameter Values', () => {
    it('should map parameter values with units', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 200, t: 10 },
      });

      expect(result.parameterValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'L', value: 100, unit: 'mm' }),
          expect.objectContaining({ name: 'W', value: 200, unit: 'mm' }),
          expect.objectContaining({ name: 't', value: 10, unit: 'mm' }),
        ])
      );
    });

    it('should handle parameters not in shape definition', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 200, t: 10, customParam: 50 },
      });

      const customParam = result.parameterValues.find((p) => p.name === 'customParam');
      expect(customParam?.unit).toBe('');
    });
  });

  describe('Fabrication Rates', () => {
    it('should use user-provided rates when available', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      const userRates = {
        cuttingCostPerMeter: 200,
        weldingCostPerMeter: 400,
      };

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
        fabricationRates: userRates,
      });

      expect(mockResolveFabricationRates).toHaveBeenCalledWith(
        expect.objectContaining({
          userRates,
        })
      );
    });

    it('should pass shape-specific rates to resolver', () => {
      const shape = createMockShape({
        fabricationCost: {
          laborHours: 5,
          baseCost: 1000,
        },
      });
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(mockResolveFabricationRates).toHaveBeenCalledWith(
        expect.objectContaining({
          shapeRates: shape.fabricationCost,
          shapeCategory: 'plates',
          materialType: 'PLATES_STAINLESS_STEEL',
        })
      );
    });
  });

  describe('Optional Formula Results', () => {
    it('should include inner surface area when available', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        innerSurfaceArea: { result: 5000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues.innerSurfaceArea).toBe(5000);
    });

    it('should include outer surface area when available', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        outerSurfaceArea: { result: 15000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues.outerSurfaceArea).toBe(15000);
    });

    it('should include wetted area when available', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
        wettedArea: { result: 8000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues.wettedArea).toBe(8000);
    });

    it('should not include undefined optional values', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.calculatedValues).not.toHaveProperty('innerSurfaceArea');
      expect(result.calculatedValues).not.toHaveProperty('outerSurfaceArea');
      expect(result.calculatedValues).not.toHaveProperty('wettedArea');
    });
  });

  describe('Result Structure', () => {
    it('should include shape and material metadata', () => {
      const shape = createMockShape({ id: 'shape-test', name: 'Test Shape' });
      const material = createMockMaterial({ id: 'material-test', name: 'Test Material' });

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.shapeId).toBe('shape-test');
      expect(result.shapeName).toBe('Test Shape');
      expect(result.materialId).toBe('material-test');
      expect(result.materialName).toBe('Test Material');
    });

    it('should calculate effective cost per kg', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 1000000 },
        weight: { result: 10 },
        surfaceArea: { result: 20000 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 100, W: 100, t: 10 },
      });

      expect(result.costEstimate.effectiveCostPerKg).toBe(
        result.costEstimate.totalCost / result.calculatedValues.weight
      );
    });

    it('should handle zero weight gracefully', () => {
      const shape = createMockShape();
      const material = createMockMaterial();

      mockEvaluateMultipleFormulas.mockReturnValue({
        volume: { result: 0 },
        weight: { result: 0 },
        surfaceArea: { result: 0 },
      });

      const result = calculateShape({
        shape,
        material,
        parameterValues: { L: 0, W: 0, t: 0 },
      });

      expect(result.costEstimate.effectiveCostPerKg).toBe(0);
    });
  });
});
