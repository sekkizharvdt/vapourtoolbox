/**
 * Fixed Asset Service Tests
 *
 * Tests for pure depreciation calculation functions:
 * - calculateMonthlyDepreciation (WDV + SLM methods)
 * - getDepreciationSchedule (year-by-year projection)
 * - Constants consistency (rates, account mappings, labels)
 */

import { calculateMonthlyDepreciation, getDepreciationSchedule } from './fixedAssetService';
import type { FixedAsset } from '@vapour/types';
import {
  DEPRECIATION_RATES,
  ASSET_CATEGORY_ACCOUNTS,
  ASSET_CATEGORY_LABELS,
  DEPRECIATION_EXPENSE_CODE,
} from '@vapour/types';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Build a minimal FixedAsset for testing pure calculation functions */
function makeAsset(overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    id: 'test-asset-1',
    assetNumber: 'FA-2026-0001',
    entityId: 'entity-1',
    name: 'Test Asset',
    category: 'COMPUTERS_AND_IT',
    status: 'ACTIVE',
    purchaseDate: new Date('2026-04-01'),
    purchaseAmount: 100000,
    assetAccountId: 'acc-1503',
    assetAccountCode: '1503',
    accumulatedDepAccountId: 'acc-1603',
    accumulatedDepAccountCode: '1603',
    depreciationExpenseAccountId: 'acc-5208',
    depreciationMethod: 'WDV',
    depreciationRatePercent: 40,
    usefulLifeYears: 3,
    residualValue: 0,
    totalDepreciation: 0,
    writtenDownValue: 100000,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: 'user-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateMonthlyDepreciation
// ---------------------------------------------------------------------------

describe('calculateMonthlyDepreciation', () => {
  describe('WDV (Written Down Value) method', () => {
    it('should calculate correct monthly depreciation for a new computer asset', () => {
      // Computer: ₹1,00,000 @ 40% WDV → annual = 40,000, monthly = 3,333.33
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // 100000 * 40 / 100 / 12 = 3333.33...
      expect(monthly).toBeCloseTo(3333.33, 1);
    });

    it('should calculate based on current WDV, not purchase amount', () => {
      // After some depreciation, WDV is ₹60,000
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 60000,
        totalDepreciation: 40000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // 60000 * 40 / 100 / 12 = 2000
      expect(monthly).toBeCloseTo(2000, 2);
    });

    it('should handle the real-world Riveraa computer purchase (₹1,25,847 @ 40%)', () => {
      const asset = makeAsset({
        purchaseAmount: 125847,
        writtenDownValue: 125847,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // 125847 * 40 / 100 / 12 = 4194.90
      expect(monthly).toBeCloseTo(4194.9, 1);
    });

    it('should apply 15% rate for plant & machinery', () => {
      const asset = makeAsset({
        category: 'PLANT_AND_MACHINERY',
        purchaseAmount: 500000,
        writtenDownValue: 500000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 15,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // 500000 * 15 / 100 / 12 = 6250
      expect(monthly).toBe(6250);
    });

    it('should apply 10% rate for furniture', () => {
      const asset = makeAsset({
        category: 'FURNITURE_AND_FIXTURES',
        purchaseAmount: 200000,
        writtenDownValue: 200000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 10,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // 200000 * 10 / 100 / 12 = 1666.67
      expect(monthly).toBeCloseTo(1666.67, 1);
    });

    it('should not depreciate below residual value', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 5100, // Almost at residual
        residualValue: 5000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // Normal: 5100 * 40/100/12 = 170, but max is 5100 - 5000 = 100
      expect(monthly).toBe(100);
    });

    it('should return 0 when WDV equals residual value', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 5000,
        residualValue: 5000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      expect(monthly).toBe(0);
    });

    it('should return 0 when WDV is below residual value', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 4000,
        residualValue: 5000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      expect(monthly).toBe(0);
    });
  });

  describe('SLM (Straight Line Method)', () => {
    it('should calculate fixed monthly depreciation', () => {
      // ₹1,00,000 over 3 years SLM, no residual
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 33.33,
        usefulLifeYears: 3,
        residualValue: 0,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // (100000 - 0) / (3 * 12) = 2777.78
      expect(monthly).toBeCloseTo(2777.78, 1);
    });

    it('should account for residual value in SLM', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 33.33,
        usefulLifeYears: 3,
        residualValue: 10000,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // (100000 - 10000) / (3 * 12) = 2500
      expect(monthly).toBe(2500);
    });

    it('should use SLM amount consistently regardless of WDV', () => {
      // SLM gives same annual amount each year — only capped at WDV - residual
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 50000, // Half way through
        totalDepreciation: 50000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 33.33,
        usefulLifeYears: 3,
        residualValue: 0,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // (100000 - 0) / (3 * 12) = 2777.78, and maxDepreciation = 50000 > 2777.78
      expect(monthly).toBeCloseTo(2777.78, 1);
    });

    it('should not depreciate below residual value in SLM', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 12000,
        totalDepreciation: 88000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 33.33,
        usefulLifeYears: 3,
        residualValue: 10000,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // SLM monthly = (100000-10000)/(3*12) = 2500, but max = 12000 - 10000 = 2000
      expect(monthly).toBe(2000);
    });

    it('should default to 10 years when usefulLifeYears is missing', () => {
      const asset = makeAsset({
        purchaseAmount: 120000,
        writtenDownValue: 120000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 10,
        usefulLifeYears: undefined,
        residualValue: 0,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // (120000 - 0) / (10 * 12) = 1000
      expect(monthly).toBe(1000);
    });

    it('should return 0 when usefulLifeYears is 0', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        usefulLifeYears: 0,
        residualValue: 0,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      expect(monthly).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should return 0 for DISPOSED assets', () => {
      const asset = makeAsset({ status: 'DISPOSED' });
      expect(calculateMonthlyDepreciation(asset)).toBe(0);
    });

    it('should return 0 for WRITTEN_OFF assets', () => {
      const asset = makeAsset({ status: 'WRITTEN_OFF' });
      expect(calculateMonthlyDepreciation(asset)).toBe(0);
    });

    it('should return 0 for LAND (non-depreciable)', () => {
      const asset = makeAsset({
        category: 'LAND',
        purchaseAmount: 5000000,
        writtenDownValue: 5000000,
        depreciationRatePercent: 0,
      });

      expect(calculateMonthlyDepreciation(asset)).toBe(0);
    });

    it('should handle very small WDV gracefully', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 0.01,
        residualValue: 0,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      // Should be a tiny positive number
      expect(monthly).toBeGreaterThanOrEqual(0);
      expect(monthly).toBeLessThan(1);
    });

    it('should handle zero purchase amount', () => {
      const asset = makeAsset({
        purchaseAmount: 0,
        writtenDownValue: 0,
        depreciationMethod: 'SLM',
        usefulLifeYears: 3,
        residualValue: 0,
      });

      const monthly = calculateMonthlyDepreciation(asset);
      expect(monthly).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getDepreciationSchedule
// ---------------------------------------------------------------------------

describe('getDepreciationSchedule', () => {
  describe('WDV method', () => {
    it('should generate a declining-balance schedule for a computer', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      // Should have multiple years
      expect(schedule.length).toBeGreaterThan(3);

      // First year
      expect(schedule[0]!.year).toBe(2026);
      expect(schedule[0]!.openingWDV).toBe(100000);
      expect(schedule[0]!.depreciation).toBe(40000);
      expect(schedule[0]!.closingWDV).toBe(60000);

      // Second year
      expect(schedule[1]!.openingWDV).toBe(60000);
      expect(schedule[1]!.depreciation).toBe(24000);
      expect(schedule[1]!.closingWDV).toBe(36000);

      // Third year
      expect(schedule[2]!.openingWDV).toBe(36000);
      expect(schedule[2]!.depreciation).toBe(14400);
      expect(schedule[2]!.closingWDV).toBe(21600);
    });

    it('should eventually converge to near zero', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);
      const last = schedule[schedule.length - 1]!;

      // Should end near zero (within 1 paisa)
      expect(last.closingWDV).toBeLessThanOrEqual(0.01);
    });

    it('should stop at residual value', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
        residualValue: 10000,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);
      const last = schedule[schedule.length - 1]!;

      // Should not go below residual
      expect(last.closingWDV).toBeGreaterThanOrEqual(10000 - 0.01);
    });

    it('should have matching opening/closing WDV between consecutive years', () => {
      const asset = makeAsset({
        purchaseAmount: 500000,
        writtenDownValue: 500000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 15,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i]!.openingWDV).toBe(schedule[i - 1]!.closingWDV);
      }
    });

    it('should have opening = closing + depreciation for each year', () => {
      const asset = makeAsset({
        purchaseAmount: 250000,
        writtenDownValue: 250000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 40,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      for (const row of schedule) {
        expect(row.openingWDV).toBeCloseTo(row.depreciation + row.closingWDV, 2);
      }
    });
  });

  describe('SLM method', () => {
    it('should generate equal depreciation each year', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 33.33,
        usefulLifeYears: 3,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      // SLM: (100000 - 0) / 3 = 33333.33 per year
      expect(schedule.length).toBe(3);
      expect(schedule[0]!.depreciation).toBeCloseTo(33333.33, 0);
      expect(schedule[1]!.depreciation).toBeCloseTo(33333.33, 0);
      // Last year may differ slightly due to rounding (cap at WDV - residual)
    });

    it('should account for residual value in SLM schedule', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 20,
        usefulLifeYears: 5,
        residualValue: 10000,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      // (100000 - 10000) / 5 = 18000 per year
      expect(schedule[0]!.depreciation).toBe(18000);
      expect(schedule.length).toBe(5);

      const last = schedule[schedule.length - 1]!;
      expect(last.closingWDV).toBeCloseTo(10000, 0);
    });
  });

  describe('Edge cases', () => {
    it('should return empty schedule for LAND', () => {
      const asset = makeAsset({
        category: 'LAND',
        purchaseAmount: 5000000,
        writtenDownValue: 5000000,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);
      expect(schedule).toEqual([]);
    });

    it('should not exceed 50 years', () => {
      const asset = makeAsset({
        purchaseAmount: 10000000,
        writtenDownValue: 10000000,
        depreciationMethod: 'WDV',
        depreciationRatePercent: 1, // Very low rate
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);
      expect(schedule.length).toBeLessThanOrEqual(50);
    });

    it('should handle building with long useful life (30 years)', () => {
      const asset = makeAsset({
        category: 'BUILDING',
        purchaseAmount: 5000000,
        writtenDownValue: 5000000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 3.17,
        usefulLifeYears: 30,
        residualValue: 0,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);

      // SLM over 30 years: 5000000/30 = 166666.67/year
      expect(schedule.length).toBe(30);
      expect(schedule[0]!.depreciation).toBeCloseTo(166666.67, 0);
    });

    it('should start at the purchase year', () => {
      const asset = makeAsset({
        purchaseDate: new Date('2024-07-15'),
        purchaseAmount: 50000,
        writtenDownValue: 50000,
      });

      const schedule = getDepreciationSchedule(asset);
      expect(schedule[0]!.year).toBe(2024);
    });

    it('should produce total depreciation equal to purchase amount minus residual', () => {
      const asset = makeAsset({
        purchaseAmount: 100000,
        writtenDownValue: 100000,
        depreciationMethod: 'SLM',
        depreciationRatePercent: 20,
        usefulLifeYears: 5,
        residualValue: 5000,
        purchaseDate: new Date('2026-04-01'),
      });

      const schedule = getDepreciationSchedule(asset);
      const totalDep = schedule.reduce((sum, row) => sum + row.depreciation, 0);

      // Total should be purchaseAmount - residualValue = 95000
      expect(totalDep).toBeCloseTo(95000, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// Constants Consistency
// ---------------------------------------------------------------------------

describe('Fixed Asset Constants', () => {
  describe('DEPRECIATION_RATES', () => {
    it('should cover all asset categories', () => {
      const categories: string[] = [
        'PLANT_AND_MACHINERY',
        'FURNITURE_AND_FIXTURES',
        'COMPUTERS_AND_IT',
        'VEHICLES',
        'OFFICE_EQUIPMENT',
        'ELECTRICAL_INSTALLATIONS',
        'LAND',
        'BUILDING',
        'OTHER',
      ];

      for (const cat of categories) {
        expect(DEPRECIATION_RATES).toHaveProperty(cat);
      }
    });

    it('should have 0% rates for LAND (non-depreciable)', () => {
      expect(DEPRECIATION_RATES.LAND.wdv).toBe(0);
      expect(DEPRECIATION_RATES.LAND.slm).toBe(0);
      expect(DEPRECIATION_RATES.LAND.usefulLife).toBe(0);
    });

    it('should have 40% WDV rate for computers per IT Act', () => {
      expect(DEPRECIATION_RATES.COMPUTERS_AND_IT.wdv).toBe(40);
      expect(DEPRECIATION_RATES.COMPUTERS_AND_IT.usefulLife).toBe(3);
    });

    it('should have positive rates for all depreciable categories', () => {
      for (const [cat, rates] of Object.entries(DEPRECIATION_RATES)) {
        if (cat === 'LAND') continue;
        expect(rates.wdv).toBeGreaterThan(0);
        expect(rates.slm).toBeGreaterThan(0);
        expect(rates.usefulLife).toBeGreaterThan(0);
      }
    });
  });

  describe('ASSET_CATEGORY_ACCOUNTS', () => {
    it('should map every category to unique account codes', () => {
      const assetCodes = new Set<string>();
      const accumDepCodes = new Set<string>();

      for (const { asset, accumDep } of Object.values(ASSET_CATEGORY_ACCOUNTS)) {
        assetCodes.add(asset);
        accumDepCodes.add(accumDep);
      }

      // 9 categories → 9 unique asset + 9 unique accum dep codes
      expect(assetCodes.size).toBe(9);
      expect(accumDepCodes.size).toBe(9);
    });

    it('should have asset accounts in the 1500 range', () => {
      for (const { asset } of Object.values(ASSET_CATEGORY_ACCOUNTS)) {
        const code = parseInt(asset, 10);
        expect(code).toBeGreaterThanOrEqual(1501);
        expect(code).toBeLessThanOrEqual(1509);
      }
    });

    it('should have accumulated depreciation accounts in the 1600 range', () => {
      for (const { accumDep } of Object.values(ASSET_CATEGORY_ACCOUNTS)) {
        const code = parseInt(accumDep, 10);
        expect(code).toBeGreaterThanOrEqual(1601);
        expect(code).toBeLessThanOrEqual(1609);
      }
    });

    it('should have matching last digits between asset and accum dep codes', () => {
      for (const { asset, accumDep } of Object.values(ASSET_CATEGORY_ACCOUNTS)) {
        expect(asset.slice(-2)).toBe(accumDep.slice(-2));
      }
    });
  });

  describe('ASSET_CATEGORY_LABELS', () => {
    it('should have a label for every category', () => {
      for (const cat of Object.keys(DEPRECIATION_RATES)) {
        expect(ASSET_CATEGORY_LABELS).toHaveProperty(cat);
        expect(typeof ASSET_CATEGORY_LABELS[cat as keyof typeof ASSET_CATEGORY_LABELS]).toBe(
          'string'
        );
      }
    });
  });

  describe('DEPRECIATION_EXPENSE_CODE', () => {
    it('should be 5208', () => {
      expect(DEPRECIATION_EXPENSE_CODE).toBe('5208');
    });
  });
});
