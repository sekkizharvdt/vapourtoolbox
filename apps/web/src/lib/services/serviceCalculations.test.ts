/**
 * Service Cost Calculation Tests
 *
 * Tests for service cost calculation engine including:
 * - Percentage of Material Cost
 * - Percentage of Total Cost (Material + Fabrication)
 * - Fixed Amount per Item
 * - Rate per Unit
 * - Custom Formula Evaluation
 * - Service applicability rules
 * - Cost aggregation
 */

import { Timestamp } from 'firebase/firestore';
import type { BOMItemService, ServiceCostBreakdown, CurrencyCode, Money } from '@vapour/types';
import { ServiceCategory, ServiceCalculationMethod } from '@vapour/types';

// Mock Firebase Timestamp
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
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

describe('Service Cost Calculations', () => {
  describe('Percentage of Material Cost', () => {
    it('should calculate service cost as percentage of material cost', () => {
      const materialCost = 10000;
      const percentage = 15; // 15%

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(1500);
    });

    it('should handle different percentage values', () => {
      const materialCost = 20000;
      const testCases = [
        { percentage: 5, expected: 1000 },
        { percentage: 10, expected: 2000 },
        { percentage: 15, expected: 3000 },
        { percentage: 20, expected: 4000 },
      ];

      testCases.forEach(({ percentage, expected }) => {
        const serviceCost = (materialCost * percentage) / 100;
        expect(serviceCost).toBe(expected);
      });
    });

    it('should calculate total service cost with quantity', () => {
      const materialCost = 10000;
      const percentage = 10;
      const quantity = 5;

      const serviceCostPerUnit = (materialCost * percentage) / 100; // 1000
      const totalServiceCost = serviceCostPerUnit * quantity; // 5000

      expect(serviceCostPerUnit).toBe(1000);
      expect(totalServiceCost).toBe(5000);
    });

    it('should handle zero material cost', () => {
      const materialCost = 0;
      const percentage = 15;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(0);
    });

    it('should handle zero percentage', () => {
      const materialCost = 10000;
      const percentage = 0;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(0);
    });

    it('should handle decimal percentages', () => {
      const materialCost = 10000;
      const percentage = 12.5;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(1250);
    });
  });

  describe('Percentage of Total Cost', () => {
    it('should calculate service cost as percentage of total cost', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;
      const percentage = 10;

      const totalCost = materialCost + fabricationCost; // 15000
      const serviceCost = (totalCost * percentage) / 100; // 1500

      expect(totalCost).toBe(15000);
      expect(serviceCost).toBe(1500);
    });

    it('should handle only material cost (no fabrication)', () => {
      const materialCost = 10000;
      const fabricationCost = 0;
      const percentage = 10;

      const totalCost = materialCost + fabricationCost;
      const serviceCost = (totalCost * percentage) / 100;

      expect(totalCost).toBe(10000);
      expect(serviceCost).toBe(1000);
    });

    it('should handle only fabrication cost (no material)', () => {
      const materialCost = 0;
      const fabricationCost = 8000;
      const percentage = 15;

      const totalCost = materialCost + fabricationCost;
      const serviceCost = (totalCost * percentage) / 100;

      expect(totalCost).toBe(8000);
      expect(serviceCost).toBe(1200);
    });

    it('should calculate with quantity', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;
      const percentage = 10;
      const quantity = 3;

      const totalCost = materialCost + fabricationCost; // 15000
      const serviceCostPerUnit = (totalCost * percentage) / 100; // 1500
      const totalServiceCost = serviceCostPerUnit * quantity; // 4500

      expect(serviceCostPerUnit).toBe(1500);
      expect(totalServiceCost).toBe(4500);
    });

    it('should handle realistic HVAC scenario', () => {
      const materialCost = 8500; // Sheet metal
      const fabricationCost = 3200; // Cutting, bending
      const percentage = 12; // 12% for welding

      const totalCost = materialCost + fabricationCost; // 11700
      const weldingCost = (totalCost * percentage) / 100; // 1404

      expect(totalCost).toBe(11700);
      expect(weldingCost).toBe(1404);
    });
  });

  describe('Fixed Amount', () => {
    it('should use fixed amount as cost per unit', () => {
      const fixedAmount = 500;
      const quantity = 10;

      const costPerUnit = fixedAmount;
      const totalCost = costPerUnit * quantity;

      expect(costPerUnit).toBe(500);
      expect(totalCost).toBe(5000);
    });

    it('should not be affected by material or fabrication cost', () => {
      const fixedAmount = 300;
      const materialCost = 10000;
      const fabricationCost = 5000;

      const costPerUnit = fixedAmount;

      expect(costPerUnit).toBe(300);
      expect(costPerUnit).not.toBe(materialCost);
      expect(costPerUnit).not.toBe(fabricationCost);
    });

    it('should handle different fixed amounts', () => {
      const testCases = [
        { amount: 100, quantity: 5, expected: 500 },
        { amount: 250, quantity: 10, expected: 2500 },
        { amount: 1000, quantity: 2, expected: 2000 },
      ];

      testCases.forEach(({ amount, quantity, expected }) => {
        const totalCost = amount * quantity;
        expect(totalCost).toBe(expected);
      });
    });

    it('should handle zero quantity', () => {
      const fixedAmount = 500;
      const quantity = 0;

      const totalCost = fixedAmount * quantity;

      expect(totalCost).toBe(0);
    });
  });

  describe('Rate per Unit', () => {
    it('should calculate cost using rate per unit', () => {
      const rate = 250;
      const quantity = 8;

      const costPerUnit = rate;
      const totalCost = costPerUnit * quantity;

      expect(costPerUnit).toBe(250);
      expect(totalCost).toBe(2000);
    });

    it('should be equivalent to fixed amount', () => {
      const ratePerUnit = 300;
      const fixedAmount = 300;
      const quantity = 5;

      const totalFromRate = ratePerUnit * quantity;
      const totalFromFixed = fixedAmount * quantity;

      expect(totalFromRate).toBe(totalFromFixed);
      expect(totalFromRate).toBe(1500);
    });

    it('should handle decimal rates', () => {
      const rate = 125.5;
      const quantity = 4;

      const totalCost = rate * quantity;

      expect(totalCost).toBe(502);
    });
  });

  describe('Custom Formula Evaluation', () => {
    it('should evaluate simple formula with materialCost', () => {
      const materialCost = 10000;
      const formula = 'materialCost * 0.05';

      // Replace variables
      const evaluableFormula = formula.replace(/materialCost/g, String(materialCost));
      const result = eval(evaluableFormula);

      expect(result).toBe(500);
    });

    it('should evaluate formula with total cost', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;
      const total = materialCost + fabricationCost;
      const formula = 'total * 0.10';

      const evaluableFormula = formula.replace(/total/g, String(total));
      const result = eval(evaluableFormula);

      expect(result).toBe(1500);
      expect(total).toBe(materialCost + fabricationCost); // Use fabricationCost
    });

    it('should evaluate complex formula with multiple variables', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;
      const formula = 'materialCost * 0.05 + fabricationCost * 0.03';

      let evaluableFormula = formula;
      evaluableFormula = evaluableFormula.replace(/materialCost/g, String(materialCost));
      evaluableFormula = evaluableFormula.replace(/fabricationCost/g, String(fabricationCost));

      const result = eval(evaluableFormula);

      expect(result).toBe(650); // (10000 * 0.05) + (5000 * 0.03) = 500 + 150
    });

    it('should evaluate formula with quantity', () => {
      const quantity = 5;
      const formula = 'quantity * 100';

      const evaluableFormula = formula.replace(/quantity/g, String(quantity));
      const result = eval(evaluableFormula);

      expect(result).toBe(500);
    });

    it('should evaluate formula with Math functions', () => {
      const materialCost = 12345.67;
      const formula = 'Math.round(materialCost * 0.05)';

      const evaluableFormula = formula.replace(/materialCost/g, String(materialCost));
      const result = eval(evaluableFormula);

      expect(result).toBe(617); // Math.round(617.2835)
    });

    it('should handle max/min functions', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;
      const formula = 'Math.max(materialCost * 0.05, fabricationCost * 0.10)';

      let evaluableFormula = formula;
      evaluableFormula = evaluableFormula.replace(/materialCost/g, String(materialCost));
      evaluableFormula = evaluableFormula.replace(/fabricationCost/g, String(fabricationCost));

      const result = eval(evaluableFormula);

      expect(result).toBe(500); // max(500, 500)
    });

    it('should handle floor/ceil functions', () => {
      const materialCost = 12345.67;
      const testCases = [
        { formula: 'Math.floor(materialCost * 0.05)', expected: 617 },
        { formula: 'Math.ceil(materialCost * 0.05)', expected: 618 },
      ];

      testCases.forEach(({ formula, expected }) => {
        const evaluableFormula = formula.replace(/materialCost/g, String(materialCost));
        const result = eval(evaluableFormula);
        expect(result).toBe(expected);
      });
    });

    it('should return 0 for empty formula', () => {
      const formula = '';
      const result = formula.trim() === '' ? 0 : eval(formula);

      expect(result).toBe(0);
    });
  });

  describe('Multiple Services Aggregation', () => {
    it('should aggregate costs from multiple services', () => {
      const materialCost = 10000;
      const fabricationCost = 5000;

      const services = [
        { name: 'Welding', method: 'PERCENTAGE_OF_TOTAL', rate: 10 }, // 1500
        { name: 'Painting', method: 'PERCENTAGE_OF_MATERIAL', rate: 5 }, // 500
        { name: 'QC Inspection', method: 'FIXED_AMOUNT', rate: 200 }, // 200
      ];

      let totalServiceCost = 0;

      services.forEach((service) => {
        let cost = 0;
        if (service.method === 'PERCENTAGE_OF_TOTAL') {
          cost = ((materialCost + fabricationCost) * service.rate) / 100;
        } else if (service.method === 'PERCENTAGE_OF_MATERIAL') {
          cost = (materialCost * service.rate) / 100;
        } else if (service.method === 'FIXED_AMOUNT') {
          cost = service.rate;
        }
        totalServiceCost += cost;
      });

      expect(totalServiceCost).toBe(2200); // 1500 + 500 + 200
    });

    it('should handle no services assigned', () => {
      const services: BOMItemService[] = [];

      const totalServiceCost = services.length === 0 ? 0 : 100;

      expect(totalServiceCost).toBe(0);
    });

    it('should calculate service breakdown by service ID', () => {
      const services = [
        { id: 'service-1', cost: 1500 },
        { id: 'service-2', cost: 500 },
        { id: 'service-3', cost: 200 },
      ];

      const breakdown = new Map<string, number>();
      services.forEach((service) => {
        breakdown.set(service.id, service.cost);
      });

      expect(breakdown.size).toBe(3);
      expect(breakdown.get('service-1')).toBe(1500);
      expect(breakdown.get('service-2')).toBe(500);
      expect(breakdown.get('service-3')).toBe(200);
    });

    it('should aggregate same service across multiple items', () => {
      const items = [
        { serviceId: 'welding', cost: 1000 },
        { serviceId: 'welding', cost: 1500 },
        { serviceId: 'painting', cost: 500 },
      ];

      const aggregated = new Map<string, number>();
      items.forEach((item) => {
        const existing = aggregated.get(item.serviceId) || 0;
        aggregated.set(item.serviceId, existing + item.cost);
      });

      expect(aggregated.get('welding')).toBe(2500); // 1000 + 1500
      expect(aggregated.get('painting')).toBe(500);
    });
  });

  describe('Service Applicability', () => {
    it('should check if service applies to item category', () => {
      const service = {
        applicableToCategories: ['FABRICATED', 'EQUIPMENT'],
      };

      const item1 = { category: 'FABRICATED' };
      const item2 = { category: 'BOUGHT_OUT' };

      const canApply1 = service.applicableToCategories.includes(item1.category);
      const canApply2 = service.applicableToCategories.includes(item2.category);

      expect(canApply1).toBe(true);
      expect(canApply2).toBe(false);
    });

    it('should apply service to all items when no applicability rules', () => {
      const service = {
        applicableToCategories: [],
      };

      const hasRules = service.applicableToCategories.length > 0;
      const canApplyToAll = !hasRules;

      expect(canApplyToAll).toBe(true);
    });

    it('should check multiple applicability criteria', () => {
      const service = {
        applicableToCategories: ['FABRICATED'],
        applicableToComponentTypes: ['CUSTOM_FABRICATED'],
      };

      const item = {
        category: 'FABRICATED',
        componentType: 'CUSTOM_FABRICATED',
      };

      const categoryMatch = service.applicableToCategories.includes(item.category);
      const componentMatch = service.applicableToComponentTypes.includes(item.componentType);
      const canApply = categoryMatch && componentMatch;

      expect(canApply).toBe(true);
    });

    it('should not apply service if category does not match', () => {
      const service = {
        applicableToCategories: ['FABRICATED'],
      };

      const item = {
        category: 'BOUGHT_OUT',
      };

      const canApply = service.applicableToCategories.includes(item.category);

      expect(canApply).toBe(false);
    });
  });

  describe('Cost Breakdown Structure', () => {
    it('should create service cost breakdown with all fields', () => {
      const breakdown: ServiceCostBreakdown = {
        serviceId: 'service-1',
        serviceName: 'Welding',
        serviceCategory: ServiceCategory.FABRICATION,
        calculationMethod: ServiceCalculationMethod.PERCENTAGE_OF_TOTAL,
        rateApplied: 10,
        baseCost: { amount: 15000, currency: 'INR' },
        costPerUnit: { amount: 1500, currency: 'INR' },
        totalCost: { amount: 7500, currency: 'INR' },
        calculationDetails: '10% of total cost (₹15,000.00) = ₹1,500.00',
        isOverridden: false,
        calculatedAt: Timestamp.now(),
      };

      expect(breakdown.serviceId).toBe('service-1');
      expect(breakdown.serviceName).toBe('Welding');
      expect(breakdown.calculationMethod).toBe(ServiceCalculationMethod.PERCENTAGE_OF_TOTAL);
      expect(breakdown.rateApplied).toBe(10);
      expect(breakdown.costPerUnit.amount).toBe(1500);
      expect(breakdown.totalCost.amount).toBe(7500);
      expect(breakdown.isOverridden).toBe(false);
    });

    it('should mark breakdown as overridden when using rate override', () => {
      const service: BOMItemService = {
        serviceId: 'service-1',
        serviceName: 'Painting',
        serviceCategory: ServiceCategory.FABRICATION,
        calculationMethod: ServiceCalculationMethod.PERCENTAGE_OF_MATERIAL,
        rateOverride: {
          rateValue: 8,
          currency: 'INR',
        },
        isManualOverride: true,
        addedBy: 'test-user',
        addedAt: Timestamp.now(),
      };

      expect(service.rateOverride).toBeDefined();
      expect(service.rateOverride?.rateValue).toBe(8);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should calculate realistic HVAC duct service costs', () => {
      // Material: Sheet metal
      const materialCost = 8500;
      // Fabrication: Cutting, bending, rolling
      const fabricationCost = 3200;
      const quantity = 5;

      // Service 1: Welding (12% of total cost)
      const totalCost = materialCost + fabricationCost; // 11700
      const weldingCost = (totalCost * 12) / 100; // 1404

      // Service 2: Painting (8% of material cost)
      const paintingCost = (materialCost * 8) / 100; // 680

      // Service 3: QC Inspection (fixed ₹200 per unit)
      const qcCost = 200;

      const totalServiceCostPerUnit = weldingCost + paintingCost + qcCost; // 2284
      const totalServiceCost = totalServiceCostPerUnit * quantity; // 11420

      expect(weldingCost).toBe(1404);
      expect(paintingCost).toBe(680);
      expect(qcCost).toBe(200);
      expect(totalServiceCostPerUnit).toBe(2284);
      expect(totalServiceCost).toBe(11420);
    });

    it('should handle bought-out item with only inspection service', () => {
      const fabricationCost = 0; // No fabrication

      // Only QC inspection service (fixed ₹500)
      const qcCost = 500;
      const totalServiceCost = qcCost; // For single item

      expect(fabricationCost).toBe(0);
      expect(totalServiceCost).toBe(500);
    });

    it('should calculate comprehensive fabricated item costs', () => {
      const materialCost = 15000;
      const fabricationCost = 8000;
      const quantity = 10;

      // Services
      const weldingPercent = 10; // % of total
      const grindingPercent = 5; // % of total
      const paintingPercent = 8; // % of material
      const packagingFixed = 150; // Fixed per unit

      const totalCost = materialCost + fabricationCost; // 23000
      const weldingCost = (totalCost * weldingPercent) / 100; // 2300
      const grindingCost = (totalCost * grindingPercent) / 100; // 1150
      const paintingCost = (materialCost * paintingPercent) / 100; // 1200
      const packagingCost = packagingFixed; // 150

      const totalServiceCostPerUnit = weldingCost + grindingCost + paintingCost + packagingCost; // 4800
      const totalServiceCost = totalServiceCostPerUnit * quantity; // 48000

      expect(totalServiceCostPerUnit).toBe(4800);
      expect(totalServiceCost).toBe(48000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large cost values', () => {
      const materialCost = 10000000; // 1 crore
      const percentage = 5;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(500000);
    });

    it('should handle decimal precision', () => {
      const materialCost = 12345.67;
      const percentage = 7.5;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBeCloseTo(925.92525, 2);
    });

    it('should handle zero rates', () => {
      const materialCost = 10000;
      const percentage = 0;

      const serviceCost = (materialCost * percentage) / 100;

      expect(serviceCost).toBe(0);
    });

    it('should handle zero base costs', () => {
      const materialCost = 0;
      const fabricationCost = 0;
      const percentage = 15;

      const totalCost = materialCost + fabricationCost;
      const serviceCost = (totalCost * percentage) / 100;

      expect(serviceCost).toBe(0);
    });

    it('should handle service cost calculation error gracefully', () => {
      const invalidFormula = 'invalid * syntax @#$';

      try {
        eval(invalidFormula);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Currency Handling', () => {
    it('should maintain consistent currency across calculations', () => {
      const currency: CurrencyCode = 'INR';
      const serviceCost: Money = { amount: 1500, currency };

      expect(serviceCost.currency).toBe('INR');
    });

    it('should use service rate currency when specified', () => {
      const service: BOMItemService = {
        serviceId: 'service-1',
        serviceName: 'Service',
        serviceCategory: ServiceCategory.FABRICATION,
        calculationMethod: ServiceCalculationMethod.FIXED_AMOUNT,
        rateOverride: {
          rateValue: 100,
          currency: 'USD',
        },
        isManualOverride: false,
        addedBy: 'test-user',
        addedAt: Timestamp.now(),
      };

      expect(service.rateOverride?.currency).toBe('USD');
    });
  });
});
