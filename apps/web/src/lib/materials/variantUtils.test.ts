/**
 * Material Variant Utilities Tests
 *
 * Tests for variant code generation, formatting, and display helpers.
 */

import {
  generateVariantCode,
  formatThickness,
  formatWeight,
  formatPrice,
  formatLeadTime,
  getVariantAvailability,
  sortVariantsByThickness,
  groupVariants,
  filterAvailableVariants,
  getVariantDisplayName,
  hasVariants,
  getCheapestVariant,
  getFastestDeliveryVariant,
  parseNPS,
  compareNPS,
  parseSchedule,
  parsePressureClass,
} from './variantUtils';
import type { Material, MaterialVariant, Money, MaterialPrice } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// Helper to create mock timestamp
function createMockTimestamp(date: Date = new Date()): Timestamp {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Helper to create mock material variant
function createMockVariant(overrides: Partial<MaterialVariant> = {}): MaterialVariant {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const variant = {
    id: 'variant-1',
    materialId: 'material-1',
    variantCode: '3mm-2B',
    dimensions: {
      thickness: 3,
    },
    isAvailable: true,
    unit: 'kg',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  } as MaterialVariant;
  return variant;
}

// Helper to create mock material
function createMockMaterial(overrides: Partial<Material> = {}): Material {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const material = {
    id: 'material-1',
    code: 'PL-SS-304',
    name: 'SS 304 Plate',
    type: 'PLATE',
    category: 'STAINLESS_STEEL',
    unit: 'kg',
    hasVariants: true,
    variants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  } as Material;
  return material;
}

describe('variantUtils', () => {
  describe('generateVariantCode', () => {
    it('should generate code with thickness', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 3 },
        variantCode: '2B',
      });

      const code = generateVariantCode('PL-SS-304', variant);

      expect(code).toBe('PL-SS-304-3mm-2B');
    });

    it('should handle variant without thickness', () => {
      const variant = createMockVariant({
        dimensions: {},
        variantCode: 'SCH40',
      });

      const code = generateVariantCode('PIPE-SS-304', variant);

      expect(code).toBe('PIPE-SS-304-SCH40');
    });

    it('should not duplicate dimension in variantCode', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 3 },
        variantCode: '3mm',
      });

      const code = generateVariantCode('PL-SS-304', variant);

      expect(code).toBe('PL-SS-304-3mm');
    });
  });

  describe('formatThickness', () => {
    it('should format thickness with mm suffix', () => {
      expect(formatThickness(3)).toBe('3mm');
      expect(formatThickness(0.5)).toBe('0.5mm');
      expect(formatThickness(10)).toBe('10mm');
    });
  });

  describe('formatWeight', () => {
    it('should format weight with default unit', () => {
      expect(formatWeight(23.45)).toBe('23.45 kg/m²');
    });

    it('should format weight with custom unit', () => {
      expect(formatWeight(5.678, 'kg/m')).toBe('5.68 kg/m');
    });

    it('should handle zero weight', () => {
      expect(formatWeight(0)).toBe('0.00 kg/m²');
    });
  });

  describe('formatPrice', () => {
    it('should format number price with default currency', () => {
      const result = formatPrice(12500);

      expect(result).toContain('12,500');
      expect(result).toContain('₹');
    });

    it('should format number price with specified currency', () => {
      const result = formatPrice(1000, 'USD');

      expect(result).toContain('1,000');
      expect(result).toContain('$');
    });

    it('should format Money object', () => {
      const money: Money = { amount: 5000, currency: 'INR' };
      const result = formatPrice(money);

      expect(result).toContain('5,000');
      expect(result).toContain('₹');
    });
  });

  describe('formatLeadTime', () => {
    it('should return Stock Available for 0 days', () => {
      expect(formatLeadTime(0)).toBe('Stock Available');
    });

    it('should return singular day for 1 day', () => {
      expect(formatLeadTime(1)).toBe('1 day');
    });

    it('should return days for 2-6 days', () => {
      expect(formatLeadTime(3)).toBe('3 days');
      expect(formatLeadTime(6)).toBe('6 days');
    });

    it('should return weeks for 7-29 days', () => {
      expect(formatLeadTime(7)).toBe('1 week');
      expect(formatLeadTime(14)).toBe('2 weeks');
      expect(formatLeadTime(21)).toBe('3 weeks');
    });

    it('should return months for 30+ days', () => {
      expect(formatLeadTime(30)).toBe('1 month');
      expect(formatLeadTime(60)).toBe('2 months');
      expect(formatLeadTime(90)).toBe('3 months');
    });
  });

  describe('getVariantAvailability', () => {
    it('should return Unavailable for unavailable variants', () => {
      const variant = createMockVariant({ isAvailable: false });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('Unavailable');
      expect(result.color).toBe('error');
    });

    it('should return In Stock when currentStock > 0', () => {
      const variant = createMockVariant({ isAvailable: true, currentStock: 100 });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('In Stock');
      expect(result.color).toBe('success');
    });

    it('should return Quick Delivery for lead time <= 7', () => {
      const variant = createMockVariant({
        isAvailable: true,
        currentStock: 0,
        leadTimeDays: 5,
      });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('Quick Delivery');
      expect(result.color).toBe('success');
    });

    it('should return Standard Lead Time for lead time 8-30', () => {
      const variant = createMockVariant({
        isAvailable: true,
        currentStock: 0,
        leadTimeDays: 15,
      });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('Standard Lead Time');
      expect(result.color).toBe('warning');
    });

    it('should return Extended Lead Time for lead time > 30', () => {
      const variant = createMockVariant({
        isAvailable: true,
        currentStock: 0,
        leadTimeDays: 45,
      });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('Extended Lead Time');
      expect(result.color).toBe('warning');
    });

    it('should return Available as default', () => {
      const variant = createMockVariant({ isAvailable: true, currentStock: undefined });
      const result = getVariantAvailability(variant);

      expect(result.label).toBe('Available');
      expect(result.color).toBe('default');
    });
  });

  describe('sortVariantsByThickness', () => {
    it('should sort variants by thickness ascending', () => {
      const variants = [
        createMockVariant({ id: 'v1', dimensions: { thickness: 6 } }),
        createMockVariant({ id: 'v2', dimensions: { thickness: 3 } }),
        createMockVariant({ id: 'v3', dimensions: { thickness: 10 } }),
      ];

      const sorted = sortVariantsByThickness(variants);

      expect(sorted[0]!.dimensions.thickness).toBe(3);
      expect(sorted[1]!.dimensions.thickness).toBe(6);
      expect(sorted[2]!.dimensions.thickness).toBe(10);
    });

    it('should handle variants without thickness', () => {
      const variants = [
        createMockVariant({ id: 'v1', dimensions: { thickness: 6 } }),
        createMockVariant({ id: 'v2', dimensions: {} }),
      ];

      const sorted = sortVariantsByThickness(variants);

      expect(sorted[0]!.dimensions.thickness).toBeUndefined();
      expect(sorted[1]!.dimensions.thickness).toBe(6);
    });

    it('should not mutate original array', () => {
      const variants = [
        createMockVariant({ id: 'v1', dimensions: { thickness: 6 } }),
        createMockVariant({ id: 'v2', dimensions: { thickness: 3 } }),
      ];

      sortVariantsByThickness(variants);

      expect(variants[0]!.dimensions.thickness).toBe(6);
    });
  });

  describe('groupVariants', () => {
    it('should group variants by thickness', () => {
      const variants = [
        createMockVariant({ id: 'v1', dimensions: { thickness: 3 } }),
        createMockVariant({ id: 'v2', dimensions: { thickness: 3 } }),
        createMockVariant({ id: 'v3', dimensions: { thickness: 6 } }),
      ];

      const grouped = groupVariants(variants, 'thickness');

      expect(grouped.get('3')).toHaveLength(2);
      expect(grouped.get('6')).toHaveLength(1);
    });

    it('should handle missing property as "other"', () => {
      const variants = [
        createMockVariant({ id: 'v1', dimensions: { thickness: 3 } }),
        createMockVariant({ id: 'v2', dimensions: {} }),
      ];

      const grouped = groupVariants(variants, 'thickness');

      expect(grouped.get('3')).toHaveLength(1);
      expect(grouped.get('other')).toHaveLength(1);
    });
  });

  describe('filterAvailableVariants', () => {
    it('should filter out unavailable variants', () => {
      const variants = [
        createMockVariant({ id: 'v1', isAvailable: true }),
        createMockVariant({ id: 'v2', isAvailable: false }),
      ];

      const result = filterAvailableVariants(variants);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('v1');
    });

    it('should filter out discontinued variants', () => {
      const variants = [
        createMockVariant({ id: 'v1', isAvailable: true }),
        createMockVariant({ id: 'v2', isAvailable: true, discontinuedDate: createMockTimestamp() }),
      ];

      const result = filterAvailableVariants(variants);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('v1');
    });
  });

  describe('getVariantDisplayName', () => {
    it('should return thickness-based display name', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 3 },
        displayName: undefined,
      });

      expect(getVariantDisplayName(variant)).toBe('3mm');
    });

    it('should include schedule if present', () => {
      const variant = createMockVariant({
        dimensions: { thickness: undefined, schedule: 'SCH40' },
        displayName: undefined,
      });

      expect(getVariantDisplayName(variant)).toBe('SCH40');
    });

    it('should combine thickness and schedule', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 6, schedule: 'SCH40' },
        displayName: undefined,
      });

      expect(getVariantDisplayName(variant)).toBe('6mm SCH40');
    });

    it('should use displayName if includes mm', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 3 },
        displayName: '3mm 2B Finish',
      });

      expect(getVariantDisplayName(variant)).toBe('3mm 2B Finish');
    });

    it('should combine with displayName if no mm in displayName', () => {
      const variant = createMockVariant({
        dimensions: { thickness: 3 },
        displayName: '2B Finish',
      });

      expect(getVariantDisplayName(variant)).toBe('3mm - 2B Finish');
    });

    it('should fall back to variantCode', () => {
      const variant = createMockVariant({
        dimensions: {},
        displayName: undefined,
        variantCode: 'CUSTOM-001',
      });

      expect(getVariantDisplayName(variant)).toBe('CUSTOM-001');
    });
  });

  describe('hasVariants', () => {
    it('should return true for material with variants', () => {
      const material = createMockMaterial({
        hasVariants: true,
        variants: [createMockVariant()],
      });

      expect(hasVariants(material)).toBe(true);
    });

    it('should return false when hasVariants is false', () => {
      const material = createMockMaterial({
        hasVariants: false,
        variants: [createMockVariant()],
      });

      expect(hasVariants(material)).toBe(false);
    });

    it('should return false when variants array is empty', () => {
      const material = createMockMaterial({
        hasVariants: true,
        variants: [],
      });

      expect(hasVariants(material)).toBe(false);
    });

    it('should return false when variants is undefined', () => {
      const material = createMockMaterial({
        hasVariants: true,
        variants: undefined,
      });

      expect(hasVariants(material)).toBe(false);
    });
  });

  describe('getCheapestVariant', () => {
    it('should return cheapest available variant', () => {
      const variants = [
        createMockVariant({
          id: 'v1',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 200, currency: 'INR' } } as MaterialPrice,
        }),
        createMockVariant({
          id: 'v2',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 100, currency: 'INR' } } as MaterialPrice,
        }),
        createMockVariant({
          id: 'v3',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 150, currency: 'INR' } } as MaterialPrice,
        }),
      ];

      const cheapest = getCheapestVariant(variants);

      expect(cheapest?.id).toBe('v2');
    });

    it('should exclude unavailable variants', () => {
      const variants = [
        createMockVariant({
          id: 'v1',
          isAvailable: false,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 50, currency: 'INR' } } as MaterialPrice,
        }),
        createMockVariant({
          id: 'v2',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 100, currency: 'INR' } } as MaterialPrice,
        }),
      ];

      const cheapest = getCheapestVariant(variants);

      expect(cheapest?.id).toBe('v2');
    });

    it('should handle Money object prices', () => {
      const variants = [
        createMockVariant({
          id: 'v1',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 200, currency: 'INR' } } as MaterialPrice,
        }),
        createMockVariant({
          id: 'v2',
          isAvailable: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          currentPrice: { pricePerUnit: { amount: 100, currency: 'INR' } } as MaterialPrice,
        }),
      ];

      const cheapest = getCheapestVariant(variants);

      expect(cheapest?.id).toBe('v2');
    });

    it('should return undefined for empty array', () => {
      expect(getCheapestVariant([])).toBeUndefined();
    });
  });

  describe('getFastestDeliveryVariant', () => {
    it('should return variant with shortest lead time', () => {
      const variants = [
        createMockVariant({ id: 'v1', isAvailable: true, leadTimeDays: 14 }),
        createMockVariant({ id: 'v2', isAvailable: true, leadTimeDays: 7 }),
        createMockVariant({ id: 'v3', isAvailable: true, leadTimeDays: 21 }),
      ];

      const fastest = getFastestDeliveryVariant(variants);

      expect(fastest?.id).toBe('v2');
    });

    it('should exclude unavailable variants', () => {
      const variants = [
        createMockVariant({ id: 'v1', isAvailable: false, leadTimeDays: 1 }),
        createMockVariant({ id: 'v2', isAvailable: true, leadTimeDays: 7 }),
      ];

      const fastest = getFastestDeliveryVariant(variants);

      expect(fastest?.id).toBe('v2');
    });

    it('should return undefined for empty array', () => {
      expect(getFastestDeliveryVariant([])).toBeUndefined();
    });
  });

  describe('parseNPS', () => {
    it('should parse integer NPS values', () => {
      expect(parseNPS('2')).toBe(2);
      expect(parseNPS('4')).toBe(4);
    });

    it('should parse fractional NPS values', () => {
      expect(parseNPS('1/2')).toBe(0.5);
      expect(parseNPS('3/4')).toBe(0.75);
    });

    it('should handle NPS with inch symbol', () => {
      expect(parseNPS('2"')).toBe(2);
      expect(parseNPS('1/2"')).toBe(0.5);
    });

    it('should parse first size from fitting notation', () => {
      expect(parseNPS('2 x 1')).toBe(2);
      expect(parseNPS('4 x 2')).toBe(4);
    });

    it('should return 0 for unparseable values', () => {
      expect(parseNPS('abc')).toBe(0);
      expect(parseNPS('')).toBe(0);
    });
  });

  describe('compareNPS', () => {
    it('should sort NPS values correctly', () => {
      const sizes = ['2', '1/2', '1', '4', '3/4'];
      const sorted = sizes.sort(compareNPS);

      expect(sorted).toEqual(['1/2', '3/4', '1', '2', '4']);
    });
  });

  describe('parseSchedule', () => {
    it('should parse numeric schedules', () => {
      expect(parseSchedule('Sch 40')).toBe(40);
      expect(parseSchedule('Sch 80')).toBe(80);
      expect(parseSchedule('Sch 160')).toBe(160);
    });

    it('should handle S suffix schedules', () => {
      expect(parseSchedule('10S')).toBe(10);
      expect(parseSchedule('40S')).toBe(40);
    });

    it('should handle special schedules', () => {
      expect(parseSchedule('STD')).toBe(40);
      expect(parseSchedule('XS')).toBe(80);
      expect(parseSchedule('XXS')).toBe(160);
    });

    it('should return 999 for unknown schedules', () => {
      expect(parseSchedule('UNKNOWN')).toBe(999);
    });
  });

  describe('parsePressureClass', () => {
    it('should parse numeric pressure classes', () => {
      expect(parsePressureClass('150')).toBe(150);
      expect(parsePressureClass('300')).toBe(300);
      expect(parsePressureClass('600')).toBe(600);
    });

    it('should handle Class prefix', () => {
      expect(parsePressureClass('Class 150')).toBe(150);
      expect(parsePressureClass('Class 300')).toBe(300);
    });

    it('should return 999 for non-numeric classes', () => {
      expect(parsePressureClass('Unknown')).toBe(999);
    });
  });
});
