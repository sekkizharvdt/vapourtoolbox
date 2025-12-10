/**
 * Three-Way Match Utilities Tests
 *
 * Tests for tolerance checking and discrepancy creation functions
 */

import type { MatchToleranceConfig, MatchDiscrepancy } from '@vapour/types';
import {
  checkQuantityTolerance,
  checkPriceTolerance,
  checkAmountTolerance,
  createDiscrepancy,
} from './utils';

// Helper to create a mock tolerance config
const createMockToleranceConfig = (
  overrides: Partial<MatchToleranceConfig> = {}
): MatchToleranceConfig =>
  ({
    id: 'config-1',
    name: 'Default Tolerance',
    quantityTolerancePercent: 5,
    priceTolerancePercent: 2,
    amountTolerancePercent: 5,
    amountToleranceAbsolute: 1000,
    allowQuantityOverage: true,
    allowQuantityShortage: true,
    allowPriceIncrease: true,
    allowPriceDecrease: true,
    useAbsoluteOrPercentage: 'WHICHEVER_IS_LOWER',
    autoApproveIfWithinTolerance: true,
    autoApproveMaxAmount: 100000,
    isDefault: true,
    isActive: true,
    ...overrides,
  }) as MatchToleranceConfig;

describe('Three-Way Match Utilities', () => {
  describe('checkQuantityTolerance', () => {
    describe('with null config (defaults)', () => {
      it('should return true for 0% variance', () => {
        expect(checkQuantityTolerance(0, 0, null)).toBe(true);
      });

      it('should return true for variance within default 5%', () => {
        expect(checkQuantityTolerance(3, 3, null)).toBe(true);
        expect(checkQuantityTolerance(-3, -3, null)).toBe(true);
        expect(checkQuantityTolerance(5, 5, null)).toBe(true);
      });

      it('should return false for variance exceeding default 5%', () => {
        expect(checkQuantityTolerance(6, 6, null)).toBe(false);
        expect(checkQuantityTolerance(-6, -6, null)).toBe(false);
        expect(checkQuantityTolerance(10, 10, null)).toBe(false);
      });
    });

    describe('with custom config', () => {
      it('should use config percentage tolerance', () => {
        const config = createMockToleranceConfig({ quantityTolerancePercent: 10 });

        expect(checkQuantityTolerance(8, 8, config)).toBe(true);
        expect(checkQuantityTolerance(10, 10, config)).toBe(true);
        expect(checkQuantityTolerance(11, 11, config)).toBe(false);
      });

      it('should reject overage when not allowed', () => {
        const config = createMockToleranceConfig({
          quantityTolerancePercent: 10,
          allowQuantityOverage: false,
        });

        // Positive variance = overage
        expect(checkQuantityTolerance(5, 5, config)).toBe(false);
        expect(checkQuantityTolerance(1, 1, config)).toBe(false);

        // Negative variance = shortage (still allowed)
        expect(checkQuantityTolerance(-5, -5, config)).toBe(true);
      });

      it('should reject shortage when not allowed', () => {
        const config = createMockToleranceConfig({
          quantityTolerancePercent: 10,
          allowQuantityShortage: false,
        });

        // Negative variance = shortage
        expect(checkQuantityTolerance(-5, -5, config)).toBe(false);
        expect(checkQuantityTolerance(-1, -1, config)).toBe(false);

        // Positive variance = overage (still allowed)
        expect(checkQuantityTolerance(5, 5, config)).toBe(true);
      });

      it('should handle zero variance with restrictions', () => {
        const config = createMockToleranceConfig({
          allowQuantityOverage: false,
          allowQuantityShortage: false,
        });

        // Zero variance should still pass
        expect(checkQuantityTolerance(0, 0, config)).toBe(true);
      });

      it('should check both percentage and direction', () => {
        const config = createMockToleranceConfig({
          quantityTolerancePercent: 5,
          allowQuantityOverage: true,
          allowQuantityShortage: true,
        });

        // Within percentage and direction allowed
        expect(checkQuantityTolerance(3, 3, config)).toBe(true);
        expect(checkQuantityTolerance(-3, -3, config)).toBe(true);

        // Exceeds percentage even though direction allowed
        expect(checkQuantityTolerance(8, 8, config)).toBe(false);
      });
    });
  });

  describe('checkPriceTolerance', () => {
    describe('with null config (defaults)', () => {
      it('should return true for 0% variance', () => {
        expect(checkPriceTolerance(0, 0, null)).toBe(true);
      });

      it('should return true for variance within default 2%', () => {
        expect(checkPriceTolerance(1, 10, null)).toBe(true);
        expect(checkPriceTolerance(-1, -10, null)).toBe(true);
        expect(checkPriceTolerance(2, 20, null)).toBe(true);
      });

      it('should return false for variance exceeding default 2%', () => {
        expect(checkPriceTolerance(3, 30, null)).toBe(false);
        expect(checkPriceTolerance(-3, -30, null)).toBe(false);
      });
    });

    describe('with custom config', () => {
      it('should use config percentage tolerance', () => {
        const config = createMockToleranceConfig({ priceTolerancePercent: 5 });

        expect(checkPriceTolerance(4, 400, config)).toBe(true);
        expect(checkPriceTolerance(5, 500, config)).toBe(true);
        expect(checkPriceTolerance(6, 600, config)).toBe(false);
      });

      it('should reject price increase when not allowed', () => {
        const config = createMockToleranceConfig({
          priceTolerancePercent: 5,
          allowPriceIncrease: false,
        });

        // Positive variance = price increase
        expect(checkPriceTolerance(3, 300, config)).toBe(false);

        // Negative variance = price decrease (allowed)
        expect(checkPriceTolerance(-3, -300, config)).toBe(true);
      });

      it('should reject price decrease when not allowed', () => {
        const config = createMockToleranceConfig({
          priceTolerancePercent: 5,
          allowPriceDecrease: false,
        });

        // Negative variance = price decrease
        expect(checkPriceTolerance(-3, -300, config)).toBe(false);

        // Positive variance = price increase (allowed)
        expect(checkPriceTolerance(3, 300, config)).toBe(true);
      });

      it('should handle strict no-variance policy', () => {
        const config = createMockToleranceConfig({
          priceTolerancePercent: 0,
          allowPriceIncrease: false,
          allowPriceDecrease: false,
        });

        expect(checkPriceTolerance(0, 0, config)).toBe(true);
        expect(checkPriceTolerance(0.1, 1, config)).toBe(false);
        expect(checkPriceTolerance(-0.1, -1, config)).toBe(false);
      });
    });
  });

  describe('checkAmountTolerance', () => {
    describe('with null config (defaults)', () => {
      it('should return true for 0% variance', () => {
        expect(checkAmountTolerance(0, 0, null)).toBe(true);
      });

      it('should return true for variance within default 5%', () => {
        expect(checkAmountTolerance(500, 5, null)).toBe(true);
        expect(checkAmountTolerance(300, 3, null)).toBe(true);
      });

      it('should return false for variance exceeding default 5%', () => {
        expect(checkAmountTolerance(1000, 6, null)).toBe(false);
        expect(checkAmountTolerance(5000, 10, null)).toBe(false);
      });
    });

    describe('with ABSOLUTE mode', () => {
      it('should only check absolute tolerance', () => {
        const config = createMockToleranceConfig({
          amountToleranceAbsolute: 500,
          amountTolerancePercent: 1, // Would fail at 2%
          useAbsoluteOrPercentage: 'ABSOLUTE',
        });

        // 400 absolute < 500 limit, even though 10% > 1%
        expect(checkAmountTolerance(400, 10, config)).toBe(true);

        // 600 absolute > 500 limit
        expect(checkAmountTolerance(600, 1, config)).toBe(false);
      });
    });

    describe('with PERCENTAGE mode', () => {
      it('should only check percentage tolerance', () => {
        const config = createMockToleranceConfig({
          amountToleranceAbsolute: 100, // Would fail at 500
          amountTolerancePercent: 5,
          useAbsoluteOrPercentage: 'PERCENTAGE',
        });

        // 3% < 5% limit, even though 500 > 100 absolute
        expect(checkAmountTolerance(500, 3, config)).toBe(true);

        // 6% > 5% limit
        expect(checkAmountTolerance(100, 6, config)).toBe(false);
      });
    });

    describe('with WHICHEVER_IS_LOWER mode', () => {
      it('should pass if either tolerance is met', () => {
        const config = createMockToleranceConfig({
          amountToleranceAbsolute: 1000,
          amountTolerancePercent: 5,
          useAbsoluteOrPercentage: 'WHICHEVER_IS_LOWER',
        });

        // Passes absolute (500 < 1000) but fails percentage (10% > 5%)
        expect(checkAmountTolerance(500, 10, config)).toBe(true);

        // Fails absolute (2000 > 1000) but passes percentage (2% < 5%)
        expect(checkAmountTolerance(2000, 2, config)).toBe(true);

        // Passes both
        expect(checkAmountTolerance(500, 2, config)).toBe(true);

        // Fails both
        expect(checkAmountTolerance(2000, 10, config)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle zero values', () => {
        const config = createMockToleranceConfig({
          amountToleranceAbsolute: 0,
          amountTolerancePercent: 0,
        });

        expect(checkAmountTolerance(0, 0, config)).toBe(true);
        expect(checkAmountTolerance(1, 0.1, config)).toBe(false);
      });

      it('should handle large tolerances', () => {
        const config = createMockToleranceConfig({
          amountToleranceAbsolute: 1000000,
          amountTolerancePercent: 50,
        });

        expect(checkAmountTolerance(500000, 30, config)).toBe(true);
      });
    });
  });

  describe('createDiscrepancy', () => {
    const baseArgs = {
      threeWayMatchId: 'match-1',
      matchLineItemId: 'line-1',
      type: 'QUANTITY_MISMATCH' as const,
      severity: 'HIGH' as MatchDiscrepancy['severity'],
      description: 'Quantity variance detected',
      fieldName: 'quantity',
      expectedValue: 100,
      actualValue: 110,
      variance: 10,
      variancePercent: 10,
      financialImpact: 5000,
      affectsPayment: true,
      userId: 'user-1',
      userName: 'John Doe',
    };

    it('should create discrepancy with all fields', () => {
      const discrepancy = createDiscrepancy(
        baseArgs.threeWayMatchId,
        baseArgs.matchLineItemId,
        baseArgs.type,
        baseArgs.severity,
        baseArgs.description,
        baseArgs.fieldName,
        baseArgs.expectedValue,
        baseArgs.actualValue,
        baseArgs.variance,
        baseArgs.variancePercent,
        baseArgs.financialImpact,
        baseArgs.affectsPayment,
        baseArgs.userId,
        baseArgs.userName
      );

      expect(discrepancy.threeWayMatchId).toBe('match-1');
      expect(discrepancy.matchLineItemId).toBe('line-1');
      expect(discrepancy.discrepancyType).toBe('QUANTITY_MISMATCH');
      expect(discrepancy.severity).toBe('HIGH');
      expect(discrepancy.description).toBe('Quantity variance detected');
      expect(discrepancy.fieldName).toBe('quantity');
      expect(discrepancy.expectedValue).toBe(100);
      expect(discrepancy.actualValue).toBe(110);
      expect(discrepancy.variance).toBe(10);
      expect(discrepancy.variancePercentage).toBe(10);
      expect(discrepancy.financialImpact).toBe(5000);
      expect(discrepancy.affectsPayment).toBe(true);
      expect(discrepancy.resolved).toBe(false);
      expect(discrepancy.createdBy).toBe('user-1');
    });

    it('should set requiresApproval true for CRITICAL severity', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'ITEM_NOT_ORDERED',
        'CRITICAL',
        'Item not found',
        'item',
        '',
        'Unknown Item',
        0,
        null,
        10000,
        true,
        'user-1',
        'John'
      );

      expect(discrepancy.requiresApproval).toBe(true);
    });

    it('should set requiresApproval true for HIGH severity', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'PRICE_MISMATCH',
        'HIGH',
        'Price variance',
        'unitPrice',
        1000,
        1200,
        200,
        20,
        2000,
        true,
        'user-1',
        'John'
      );

      expect(discrepancy.requiresApproval).toBe(true);
    });

    it('should set requiresApproval false for MEDIUM severity', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'QUANTITY_MISMATCH',
        'MEDIUM',
        'Minor variance',
        'quantity',
        100,
        102,
        2,
        2,
        100,
        false,
        'user-1',
        'John'
      );

      expect(discrepancy.requiresApproval).toBe(false);
    });

    it('should set requiresApproval false for LOW severity', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'AMOUNT_MISMATCH',
        'LOW',
        'Rounding difference',
        'amount',
        1000,
        1000.5,
        0.5,
        0.05,
        0.5,
        false,
        'user-1',
        'John'
      );

      expect(discrepancy.requiresApproval).toBe(false);
    });

    it('should handle undefined matchLineItemId', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        undefined,
        'ITEM_NOT_ORDERED',
        'CRITICAL',
        'Item not on PO',
        'item',
        '',
        'Mystery Item',
        0,
        null,
        5000,
        true,
        'user-1',
        'John'
      );

      expect(discrepancy.matchLineItemId).toBeUndefined();
    });

    it('should handle null variancePercent', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'ITEM_NOT_RECEIVED',
        'CRITICAL',
        'Item not received',
        'quantity',
        100,
        0,
        -100,
        null,
        10000,
        true,
        'user-1',
        'John'
      );

      expect(discrepancy.variancePercentage).toBeNull();
    });

    it('should handle string values for expected/actual', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'PRICE_MISMATCH',
        'MEDIUM',
        'Description mismatch',
        'description',
        'Steel Plate 3mm',
        'Steel Plate 4mm',
        0,
        null,
        0,
        false,
        'user-1',
        'John'
      );

      expect(discrepancy.expectedValue).toBe('Steel Plate 3mm');
      expect(discrepancy.actualValue).toBe('Steel Plate 4mm');
    });

    it('should set timestamps', () => {
      const discrepancy = createDiscrepancy(
        'match-1',
        'line-1',
        'QUANTITY_MISMATCH',
        'LOW',
        'Test',
        'quantity',
        100,
        101,
        1,
        1,
        10,
        false,
        'user-1',
        'John'
      );

      expect(discrepancy.createdAt).toBeDefined();
      expect(discrepancy.updatedAt).toBeDefined();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical quantity variance check', () => {
      const config = createMockToleranceConfig({
        quantityTolerancePercent: 5,
        allowQuantityOverage: true,
        allowQuantityShortage: true,
      });

      // Ordered 100, received 103 (3% over) - should pass
      const variance1 = 103 - 100;
      const variancePercent1 = (variance1 / 100) * 100;
      expect(checkQuantityTolerance(variancePercent1, variance1, config)).toBe(true);

      // Ordered 100, received 94 (6% under) - should fail
      const variance2 = 94 - 100;
      const variancePercent2 = (variance2 / 100) * 100;
      expect(checkQuantityTolerance(variancePercent2, variance2, config)).toBe(false);
    });

    it('should handle typical price variance check', () => {
      const config = createMockToleranceConfig({
        priceTolerancePercent: 2,
        allowPriceIncrease: false, // No price increases allowed
        allowPriceDecrease: true,
      });

      // PO price 1000, invoice price 990 (1% lower) - should pass
      const variance1 = 990 - 1000;
      const variancePercent1 = (variance1 / 1000) * 100;
      expect(checkPriceTolerance(variancePercent1, variance1, config)).toBe(true);

      // PO price 1000, invoice price 1010 (1% higher) - should fail (no increases)
      const variance2 = 1010 - 1000;
      const variancePercent2 = (variance2 / 1000) * 100;
      expect(checkPriceTolerance(variancePercent2, variance2, config)).toBe(false);
    });

    it('should handle invoice amount tolerance', () => {
      const config = createMockToleranceConfig({
        amountToleranceAbsolute: 500,
        amountTolerancePercent: 1,
        useAbsoluteOrPercentage: 'WHICHEVER_IS_LOWER',
      });

      // Invoice 100,500 vs GR 100,000 (0.5% or 500 variance) - should pass
      expect(checkAmountTolerance(500, 0.5, config)).toBe(true);

      // Invoice 102,000 vs GR 100,000 (2% or 2000 variance) - should fail
      expect(checkAmountTolerance(2000, 2, config)).toBe(false);
    });

    it('should create appropriate discrepancies for common issues', () => {
      // Item invoiced but not on PO
      const notOrderedDisc = createDiscrepancy(
        'match-1',
        undefined,
        'ITEM_NOT_ORDERED',
        'CRITICAL',
        'Item "Safety Equipment" is not on the purchase order',
        'lineItem',
        '',
        'Safety Equipment',
        15000,
        null,
        15000,
        true,
        'user-1',
        'Accounts Clerk'
      );
      expect(notOrderedDisc.severity).toBe('CRITICAL');
      expect(notOrderedDisc.requiresApproval).toBe(true);
      expect(notOrderedDisc.affectsPayment).toBe(true);

      // Minor quantity variance
      const qtyDisc = createDiscrepancy(
        'match-1',
        'line-1',
        'QUANTITY_MISMATCH',
        'LOW',
        'Quantity variance: 2 pcs (2%)',
        'quantity',
        100,
        102,
        2,
        2,
        200,
        false,
        'user-1',
        'Accounts Clerk'
      );
      expect(qtyDisc.severity).toBe('LOW');
      expect(qtyDisc.requiresApproval).toBe(false);
    });
  });
});
