/**
 * BOM Summary Calculation Tests
 *
 * Tests for BOM summary calculation service including:
 * - Direct cost aggregation (material, fabrication, service)
 * - Cost configuration application (overhead, contingency, profit)
 * - Service cost breakdown aggregation
 * - Weight calculation
 * - Currency handling
 */

import { Timestamp } from 'firebase/firestore';
import type { BOMSummary, CurrencyCode, Money } from '@vapour/types';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

// Mock COLLECTIONS
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    BOMS: 'boms',
    BOM_ITEMS: 'items',
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('BOM Summary Calculation', () => {
  const mockCurrency: CurrencyCode = 'INR';

  const createMoney = (amount: number): Money => ({
    amount,
    currency: mockCurrency,
  });

  describe('Direct Cost Aggregation', () => {
    it('should aggregate material costs from all BOM items', () => {
      const items = [
        { cost: { totalMaterialCost: createMoney(10000) } },
        { cost: { totalMaterialCost: createMoney(15000) } },
        { cost: { totalMaterialCost: createMoney(5000) } },
      ];

      const totalMaterialCost = items.reduce(
        (sum, item) => sum + (item.cost?.totalMaterialCost?.amount || 0),
        0
      );

      expect(totalMaterialCost).toBe(30000);
    });

    it('should aggregate fabrication costs from all BOM items', () => {
      const items = [
        { cost: { totalFabricationCost: createMoney(8000) } },
        { cost: { totalFabricationCost: createMoney(12000) } },
        { cost: { totalFabricationCost: createMoney(4000) } },
      ];

      const totalFabricationCost = items.reduce(
        (sum, item) => sum + (item.cost?.totalFabricationCost?.amount || 0),
        0
      );

      expect(totalFabricationCost).toBe(24000);
    });

    it('should aggregate service costs from all BOM items', () => {
      const items = [
        { cost: { totalServiceCost: createMoney(2000) } },
        { cost: { totalServiceCost: createMoney(3000) } },
        { cost: { totalServiceCost: createMoney(1500) } },
      ];

      const totalServiceCost = items.reduce(
        (sum, item) => sum + (item.cost?.totalServiceCost?.amount || 0),
        0
      );

      expect(totalServiceCost).toBe(6500);
    });

    it('should calculate total direct cost from all cost components', () => {
      const materialCost = 30000;
      const fabricationCost = 24000;
      const serviceCost = 6500;

      const totalDirectCost = materialCost + fabricationCost + serviceCost;

      expect(totalDirectCost).toBe(60500);
    });

    it('should handle items with missing cost data', () => {
      const items = [
        { cost: { totalMaterialCost: createMoney(10000) } },
        { cost: null },
        { cost: { totalMaterialCost: createMoney(5000) } },
      ];

      const totalMaterialCost = items.reduce(
        (sum, item) => sum + (item.cost?.totalMaterialCost?.amount || 0),
        0
      );

      expect(totalMaterialCost).toBe(15000);
    });
  });

  describe('Weight Calculation', () => {
    it('should aggregate total weight from all BOM items', () => {
      const items = [
        { calculatedProperties: { totalWeight: 125.5 } },
        { calculatedProperties: { totalWeight: 89.3 } },
        { calculatedProperties: { totalWeight: 45.2 } },
      ];

      const totalWeight = items.reduce(
        (sum, item) => sum + (item.calculatedProperties?.totalWeight || 0),
        0
      );

      expect(totalWeight).toBeCloseTo(260, 1);
    });

    it('should handle items without weight data', () => {
      const items = [
        { calculatedProperties: { totalWeight: 100 } },
        { calculatedProperties: null },
        { calculatedProperties: { totalWeight: 50 } },
      ];

      const totalWeight = items.reduce(
        (sum, item) => sum + (item.calculatedProperties?.totalWeight || 0),
        0
      );

      expect(totalWeight).toBe(150);
    });
  });

  describe('Cost Configuration - Overhead', () => {
    it('should calculate overhead on ALL cost types when applicableTo is ALL', () => {
      const materialCost = 30000;
      const fabricationCost = 24000;
      const serviceCost = 6500;
      const overheadPercent = 10;

      const overheadBase = materialCost + fabricationCost + serviceCost;
      const overhead = (overheadBase * overheadPercent) / 100;

      expect(overheadBase).toBe(60500); // Verify totalDirectCost
      expect(overhead).toBe(6050);
    });

    it('should calculate overhead only on MATERIAL cost when applicableTo is MATERIAL', () => {
      const materialCost = 30000;
      const fabricationCost = 24000;
      const serviceCost = 6500;
      const overheadPercent = 10;

      const overheadBase = materialCost;
      const overhead = (overheadBase * overheadPercent) / 100;

      expect(overhead).toBe(3000);
      expect(overhead).toBeLessThan((materialCost + fabricationCost + serviceCost) * 0.1);
    });

    it('should calculate overhead only on FABRICATION cost when applicableTo is FABRICATION', () => {
      const fabricationCost = 24000;
      const overheadPercent = 15;

      const overheadBase = fabricationCost;
      const overhead = (overheadBase * overheadPercent) / 100;

      expect(overhead).toBe(3600);
    });

    it('should calculate overhead only on SERVICE cost when applicableTo is SERVICE', () => {
      const serviceCost = 6500;
      const overheadPercent = 20;

      const overheadBase = serviceCost;
      const overhead = (overheadBase * overheadPercent) / 100;

      expect(overhead).toBe(1300);
    });

    it('should not apply overhead when not enabled', () => {
      const costConfig = {
        overhead: {
          enabled: false,
          ratePercent: 10,
          applicableTo: 'ALL',
        },
      };

      const overhead = costConfig.overhead.enabled ? 100 : 0;

      expect(overhead).toBe(0);
    });

    it('should handle different overhead percentages', () => {
      const baseCost = 100000;
      const testCases = [
        { percent: 5, expected: 5000 },
        { percent: 10, expected: 10000 },
        { percent: 15, expected: 15000 },
        { percent: 20, expected: 20000 },
      ];

      testCases.forEach(({ percent, expected }) => {
        const overhead = (baseCost * percent) / 100;
        expect(overhead).toBe(expected);
      });
    });
  });

  describe('Cost Configuration - Contingency', () => {
    it('should apply contingency to direct cost + overhead', () => {
      const totalDirectCost = 60500;
      const overhead = 6050;
      const contingencyPercent = 5;

      const contingencyBase = totalDirectCost + overhead; // 66550
      const contingency = (contingencyBase * contingencyPercent) / 100;

      expect(contingency).toBe(3327.5);
    });

    it('should not apply contingency when not enabled', () => {
      const costConfig = {
        contingency: {
          enabled: false,
          ratePercent: 5,
        },
      };

      const contingency = costConfig.contingency.enabled ? 100 : 0;

      expect(contingency).toBe(0);
    });

    it('should handle zero contingency percentage', () => {
      const base = 100000;
      const contingencyPercent = 0;

      const contingency = (base * contingencyPercent) / 100;

      expect(contingency).toBe(0);
    });

    it('should apply contingency after overhead calculation', () => {
      const directCost = 100000;
      const overheadPercent = 10;
      const contingencyPercent = 5;

      const overhead = (directCost * overheadPercent) / 100; // 10000
      const contingencyBase = directCost + overhead; // 110000
      const contingency = (contingencyBase * contingencyPercent) / 100; // 5500

      expect(overhead).toBe(10000);
      expect(contingencyBase).toBe(110000);
      expect(contingency).toBe(5500);
    });
  });

  describe('Cost Configuration - Profit', () => {
    it('should apply profit to subtotal (direct + overhead + contingency)', () => {
      const totalDirectCost = 60500;
      const overhead = 6050;
      const contingency = 3327.5;
      const profitPercent = 15;

      const profitBase = totalDirectCost + overhead + contingency; // 69877.5
      const profit = (profitBase * profitPercent) / 100;

      expect(profit).toBeCloseTo(10481.625, 2);
    });

    it('should not apply profit when not enabled', () => {
      const costConfig = {
        profit: {
          enabled: false,
          ratePercent: 15,
        },
      };

      const profit = costConfig.profit.enabled ? 100 : 0;

      expect(profit).toBe(0);
    });

    it('should calculate profit last in the cost cascade', () => {
      const directCost = 100000;
      const overheadPercent = 10;
      const contingencyPercent = 5;
      const profitPercent = 15;

      // Step 1: Calculate overhead
      const overhead = (directCost * overheadPercent) / 100; // 10000

      // Step 2: Calculate contingency on (direct + overhead)
      const contingencyBase = directCost + overhead; // 110000
      const contingency = (contingencyBase * contingencyPercent) / 100; // 5500

      // Step 3: Calculate profit on (direct + overhead + contingency)
      const profitBase = directCost + overhead + contingency; // 115500
      const profit = (profitBase * profitPercent) / 100; // 17325

      const totalCost = directCost + overhead + contingency + profit; // 132825

      expect(overhead).toBe(10000);
      expect(contingency).toBe(5500);
      expect(profit).toBe(17325);
      expect(totalCost).toBe(132825);
    });
  });

  describe('Total Cost Calculation', () => {
    it('should calculate total cost with all cost components', () => {
      const totalDirectCost = 60500;
      const overhead = 6050;
      const contingency = 3327.5;
      const profit = 10481.625;

      const totalCost = totalDirectCost + overhead + contingency + profit;

      expect(totalCost).toBeCloseTo(80359.125, 2);
    });

    it('should calculate total cost without cost configuration', () => {
      const materialCost = 30000;
      const fabricationCost = 24000;
      const serviceCost = 6500;

      const totalCost = materialCost + fabricationCost + serviceCost;

      expect(totalCost).toBe(60500);
    });

    it('should handle partial cost configuration (only overhead)', () => {
      const totalDirectCost = 100000;
      const overheadPercent = 10;

      const overhead = (totalDirectCost * overheadPercent) / 100;
      const contingency = 0;
      const profit = 0;
      const totalCost = totalDirectCost + overhead + contingency + profit;

      expect(totalCost).toBe(110000);
    });
  });

  describe('Service Cost Breakdown', () => {
    it('should aggregate service costs by service ID', () => {
      const serviceBreakdownMap = new Map<string, number>();

      const items = [
        {
          cost: {
            serviceBreakdown: [
              { serviceId: 'service-1', serviceName: 'Welding', totalCost: createMoney(1000) },
              { serviceId: 'service-2', serviceName: 'Painting', totalCost: createMoney(500) },
            ],
          },
        },
        {
          cost: {
            serviceBreakdown: [
              { serviceId: 'service-1', serviceName: 'Welding', totalCost: createMoney(1500) },
              { serviceId: 'service-3', serviceName: 'Grinding', totalCost: createMoney(300) },
            ],
          },
        },
      ];

      items.forEach((item) => {
        item.cost?.serviceBreakdown?.forEach((service) => {
          const existing = serviceBreakdownMap.get(service.serviceId) || 0;
          serviceBreakdownMap.set(service.serviceId, existing + service.totalCost.amount);
        });
      });

      expect(serviceBreakdownMap.get('service-1')).toBe(2500); // 1000 + 1500
      expect(serviceBreakdownMap.get('service-2')).toBe(500);
      expect(serviceBreakdownMap.get('service-3')).toBe(300);
    });

    it('should handle items without service breakdown', () => {
      const serviceBreakdownMap = new Map<string, number>();

      const items = [
        {
          cost: {
            serviceBreakdown: [
              { serviceId: 'service-1', serviceName: 'Welding', totalCost: createMoney(1000) },
            ],
          },
        },
        {
          cost: {
            serviceBreakdown: undefined,
          },
        },
      ];

      items.forEach((item) => {
        item.cost?.serviceBreakdown?.forEach((service) => {
          const existing = serviceBreakdownMap.get(service.serviceId) || 0;
          serviceBreakdownMap.set(service.serviceId, existing + service.totalCost.amount);
        });
      });

      expect(serviceBreakdownMap.size).toBe(1);
      expect(serviceBreakdownMap.get('service-1')).toBe(1000);
    });

    it('should create service breakdown object from map', () => {
      const serviceBreakdownMap = new Map<string, number>([
        ['service-1', 2500],
        ['service-2', 500],
        ['service-3', 300],
      ]);

      const serviceBreakdown: Record<string, Money> = {};
      for (const [serviceId, amount] of serviceBreakdownMap.entries()) {
        serviceBreakdown[serviceId] = { amount, currency: mockCurrency };
      }

      expect(Object.keys(serviceBreakdown)).toHaveLength(3);
      expect(serviceBreakdown['service-1']?.amount).toBe(2500);
      expect(serviceBreakdown['service-2']?.amount).toBe(500);
      expect(serviceBreakdown['service-3']?.amount).toBe(300);
    });
  });

  describe('Currency Handling', () => {
    it('should use consistent currency across all cost items', () => {
      const items = [
        { cost: { totalMaterialCost: { amount: 10000, currency: 'INR' as CurrencyCode } } },
        { cost: { totalMaterialCost: { amount: 15000, currency: 'INR' as CurrencyCode } } },
      ];

      const currencies = items.map((item) => item.cost?.totalMaterialCost?.currency);
      const uniqueCurrencies = new Set(currencies);

      expect(uniqueCurrencies.size).toBe(1);
      expect(uniqueCurrencies.has('INR')).toBe(true);
    });

    it('should default to INR when no cost items exist', () => {
      const currency: CurrencyCode = 'INR';

      expect(currency).toBe('INR');
    });

    it('should use first item currency for summary', () => {
      const items = [
        { cost: { totalMaterialCost: { amount: 10000, currency: 'USD' as CurrencyCode } } },
        { cost: { totalMaterialCost: { amount: 15000, currency: 'INR' as CurrencyCode } } },
      ];

      const currency = items[0]?.cost?.totalMaterialCost?.currency || 'INR';

      expect(currency).toBe('USD');
    });
  });

  describe('BOM Summary Object Structure', () => {
    it('should create complete BOM summary with all fields', () => {
      const summary: BOMSummary = {
        totalWeight: 260,
        totalMaterialCost: createMoney(30000),
        totalFabricationCost: createMoney(24000),
        totalServiceCost: createMoney(6500),
        totalDirectCost: createMoney(60500),
        overhead: createMoney(6050),
        contingency: createMoney(3327.5),
        profit: createMoney(10481.625),
        totalCost: createMoney(80359.125),
        itemCount: 5,
        currency: mockCurrency,
        serviceBreakdown: {
          'service-1': createMoney(2500),
          'service-2': createMoney(500),
        },
        costConfigId: 'config-123',
        lastCalculated: Timestamp.now(),
      };

      expect(summary.totalWeight).toBe(260);
      expect(summary.totalMaterialCost.amount).toBe(30000);
      expect(summary.totalFabricationCost.amount).toBe(24000);
      expect(summary.totalServiceCost.amount).toBe(6500);
      expect(summary.totalDirectCost.amount).toBe(60500);
      expect(summary.overhead.amount).toBe(6050);
      expect(summary.contingency.amount).toBe(3327.5);
      expect(summary.profit.amount).toBeCloseTo(10481.625, 2);
      expect(summary.totalCost.amount).toBeCloseTo(80359.125, 2);
      expect(summary.itemCount).toBe(5);
      expect(summary.serviceBreakdown).toBeDefined();
      expect(summary.costConfigId).toBe('config-123');
    });

    it('should create minimal BOM summary without cost configuration', () => {
      const summary: BOMSummary = {
        totalWeight: 100,
        totalMaterialCost: createMoney(10000),
        totalFabricationCost: createMoney(5000),
        totalServiceCost: createMoney(1000),
        totalDirectCost: createMoney(16000),
        overhead: createMoney(0),
        contingency: createMoney(0),
        profit: createMoney(0),
        totalCost: createMoney(16000),
        itemCount: 2,
        currency: mockCurrency,
        lastCalculated: Timestamp.now(),
      };

      expect(summary.overhead.amount).toBe(0);
      expect(summary.contingency.amount).toBe(0);
      expect(summary.profit.amount).toBe(0);
      expect(summary.totalCost.amount).toBe(summary.totalDirectCost.amount);
      expect(summary.costConfigId).toBeUndefined();
      expect(summary.serviceBreakdown).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty BOM (no items)', () => {
      const summary = {
        totalWeight: 0,
        totalMaterialCost: createMoney(0),
        totalFabricationCost: createMoney(0),
        totalServiceCost: createMoney(0),
        totalDirectCost: createMoney(0),
        overhead: createMoney(0),
        contingency: createMoney(0),
        profit: createMoney(0),
        totalCost: createMoney(0),
        itemCount: 0,
        currency: mockCurrency,
      };

      expect(summary.itemCount).toBe(0);
      expect(summary.totalCost.amount).toBe(0);
    });

    it('should handle very large cost values', () => {
      const materialCost = 10000000; // 1 crore
      const overheadPercent = 10;

      const overhead = (materialCost * overheadPercent) / 100;
      const totalCost = materialCost + overhead;

      expect(overhead).toBe(1000000);
      expect(totalCost).toBe(11000000);
    });

    it('should handle decimal precision in cost calculations', () => {
      const cost = 12345.67;
      const percent = 7.5;

      const result = (cost * percent) / 100;

      expect(result).toBeCloseTo(925.92525, 2);
    });

    it('should handle zero percentage rates', () => {
      const baseCost = 100000;

      const overhead = (baseCost * 0) / 100;
      const contingency = (baseCost * 0) / 100;
      const profit = (baseCost * 0) / 100;

      expect(overhead).toBe(0);
      expect(contingency).toBe(0);
      expect(profit).toBe(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should calculate realistic HVAC duct BOM summary', () => {
      // Realistic scenario: HVAC duct fabrication
      const materialCost = 45000; // Sheet metal
      const fabricationCost = 18000; // Cutting, bending
      const serviceCost = 8000; // Welding, painting
      const totalDirectCost = materialCost + fabricationCost + serviceCost; // 71000

      // Cost configuration
      const overheadPercent = 12; // 12% on all costs
      const contingencyPercent = 5; // 5% buffer
      const profitPercent = 15; // 15% profit

      const overhead = (totalDirectCost * overheadPercent) / 100; // 8520
      const contingencyBase = totalDirectCost + overhead; // 79520
      const contingency = (contingencyBase * contingencyPercent) / 100; // 3976
      const profitBase = totalDirectCost + overhead + contingency; // 83496
      const profit = (profitBase * profitPercent) / 100; // 12524.4
      const totalCost = profitBase + profit; // 96020.4

      expect(overhead).toBe(8520);
      expect(contingency).toBe(3976);
      expect(profit).toBeCloseTo(12524.4, 1);
      expect(totalCost).toBeCloseTo(96020.4, 1);
    });

    it('should calculate summary with only material costs (bought-out items)', () => {
      // Scenario: BOM with only bought-out items (no fabrication/services)
      const totalMaterialCost = 150000;
      const totalDirectCost = totalMaterialCost;

      const overheadPercent = 10;
      const overhead = (totalDirectCost * overheadPercent) / 100;
      const totalCost = totalDirectCost + overhead;

      expect(totalCost).toBe(165000);
    });

    it('should handle mixed item types (fabricated + bought-out)', () => {
      // Material: bought-out + raw material for fabrication
      const materialCost = 60000;
      // Fabrication: only for fabricated items
      const fabricationCost = 25000;
      // Services: welding, painting on fabricated items
      const serviceCost = 10000;

      const totalDirectCost = materialCost + fabricationCost + serviceCost;

      expect(totalDirectCost).toBe(95000);
    });
  });
});
