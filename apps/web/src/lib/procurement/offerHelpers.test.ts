/**
 * Offer Helpers Tests
 *
 * Tests for offer utility functions: status checks, comparisons, calculations
 */

import {
  canEditOffer,
  canEvaluateOffer,
  canSelectOffer,
  canRejectOffer,
  getOfferStatusText,
  getOfferStatusColor,
  validateOfferForEvaluation,
  isOfferExpired,
  calculatePriceScore,
  compareOffers,
  rankOffersByPrice,
  findBestOffer,
  formatOfferDate,
  formatEvaluationScore,
  filterOffersBySearch,
  sortOffers,
  calculateOfferStats,
  calculateTotalAmount,
  checkAllItemsMeetSpec,
  getItemsWithDeviations,
  compareItemWithRequirement,
} from './offerHelpers';
import type { Offer, OfferItem, OfferStatus } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

// Mock formatCurrency
jest.mock('@/lib/utils/formatters', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`,
}));

// Helper to create mock timestamp
function createMockTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Helper to create mock offer
function createMockOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    number: 'OFF-2024-001',
    rfqId: 'rfq-1',
    rfqNumber: 'RFQ-2024-001',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor',
    status: 'UPLOADED',
    subtotal: 10000,
    taxAmount: 1800,
    totalAmount: 11800,
    currency: 'INR',
    itemsParsed: true,
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  } as Offer;
}

// Helper to create mock offer item
function createMockOfferItem(overrides: Partial<OfferItem> = {}): OfferItem {
  return {
    id: 'item-1',
    offerId: 'offer-1',
    rfqItemId: 'rfq-item-1',
    itemDescription: 'Test Item',
    quotedQuantity: 100,
    unit: 'NOS',
    unitRate: 100,
    amount: 10000,
    meetsSpec: true,
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  } as OfferItem;
}

describe('offerHelpers', () => {
  describe('status checks', () => {
    describe('canEditOffer', () => {
      it('should return true for UPLOADED status', () => {
        expect(canEditOffer(createMockOffer({ status: 'UPLOADED' }))).toBe(true);
      });

      it('should return true for UNDER_REVIEW status', () => {
        expect(canEditOffer(createMockOffer({ status: 'UNDER_REVIEW' }))).toBe(true);
      });

      it('should return false for EVALUATED status', () => {
        expect(canEditOffer(createMockOffer({ status: 'EVALUATED' }))).toBe(false);
      });

      it('should return false for SELECTED status', () => {
        expect(canEditOffer(createMockOffer({ status: 'SELECTED' }))).toBe(false);
      });
    });

    describe('canEvaluateOffer', () => {
      it('should return true for UPLOADED status', () => {
        expect(canEvaluateOffer(createMockOffer({ status: 'UPLOADED' }))).toBe(true);
      });

      it('should return true for UNDER_REVIEW status', () => {
        expect(canEvaluateOffer(createMockOffer({ status: 'UNDER_REVIEW' }))).toBe(true);
      });

      it('should return false for SELECTED status', () => {
        expect(canEvaluateOffer(createMockOffer({ status: 'SELECTED' }))).toBe(false);
      });
    });

    describe('canSelectOffer', () => {
      it('should return true for EVALUATED status', () => {
        expect(canSelectOffer(createMockOffer({ status: 'EVALUATED' }))).toBe(true);
      });

      it('should return true if isRecommended', () => {
        expect(canSelectOffer(createMockOffer({ status: 'UPLOADED', isRecommended: true }))).toBe(
          true
        );
      });

      it('should return false for non-evaluated, non-recommended offers', () => {
        expect(canSelectOffer(createMockOffer({ status: 'UPLOADED', isRecommended: false }))).toBe(
          false
        );
      });
    });

    describe('canRejectOffer', () => {
      it('should return true for UPLOADED status', () => {
        expect(canRejectOffer(createMockOffer({ status: 'UPLOADED' }))).toBe(true);
      });

      it('should return false for SELECTED status', () => {
        expect(canRejectOffer(createMockOffer({ status: 'SELECTED' }))).toBe(false);
      });

      it('should return false for WITHDRAWN status', () => {
        expect(canRejectOffer(createMockOffer({ status: 'WITHDRAWN' }))).toBe(false);
      });
    });
  });

  describe('display helpers', () => {
    describe('getOfferStatusText', () => {
      const statusTexts: Array<[OfferStatus, string]> = [
        ['UPLOADED', 'Uploaded'],
        ['UNDER_REVIEW', 'Under Review'],
        ['EVALUATED', 'Evaluated'],
        ['SELECTED', 'Selected'],
        ['REJECTED', 'Rejected'],
        ['WITHDRAWN', 'Withdrawn'],
      ];

      test.each(statusTexts)('should return "%s" for status %s', (status, expected) => {
        expect(getOfferStatusText(status)).toBe(expected);
      });
    });

    describe('getOfferStatusColor', () => {
      it('should return info for UPLOADED', () => {
        expect(getOfferStatusColor('UPLOADED')).toBe('info');
      });

      it('should return success for SELECTED', () => {
        expect(getOfferStatusColor('SELECTED')).toBe('success');
      });

      it('should return error for REJECTED', () => {
        expect(getOfferStatusColor('REJECTED')).toBe('error');
      });

      it('should return default for WITHDRAWN', () => {
        expect(getOfferStatusColor('WITHDRAWN')).toBe('default');
      });
    });
  });

  describe('validation', () => {
    describe('validateOfferForEvaluation', () => {
      it('should return valid true when all conditions met', () => {
        const offer = createMockOffer({
          itemsParsed: true,
          subtotal: 10000,
          totalAmount: 11800,
        });

        const result = validateOfferForEvaluation(offer);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return error when items not parsed', () => {
        const offer = createMockOffer({ itemsParsed: false });

        const result = validateOfferForEvaluation(offer);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Offer items have not been parsed/entered');
      });

      it('should return error when subtotal is zero', () => {
        const offer = createMockOffer({ subtotal: 0 });

        const result = validateOfferForEvaluation(offer);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Subtotal must be greater than zero');
      });

      it('should return error when totalAmount is zero', () => {
        const offer = createMockOffer({ totalAmount: 0 });

        const result = validateOfferForEvaluation(offer);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Total amount must be greater than zero');
      });
    });

    describe('isOfferExpired', () => {
      it('should return false when no validity date', () => {
        const offer = createMockOffer({ validityDate: undefined });

        expect(isOfferExpired(offer)).toBe(false);
      });

      it('should return true when validity date is in the past', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const offer = createMockOffer({ validityDate: createMockTimestamp(pastDate) });

        expect(isOfferExpired(offer)).toBe(true);
      });

      it('should return false when validity date is in the future', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const offer = createMockOffer({ validityDate: createMockTimestamp(futureDate) });

        expect(isOfferExpired(offer)).toBe(false);
      });
    });
  });

  describe('comparison helpers', () => {
    describe('calculatePriceScore', () => {
      it('should return 100 for lowest price', () => {
        expect(calculatePriceScore(1000, 1000)).toBe(100);
      });

      it('should return 90 for 10% higher price', () => {
        expect(calculatePriceScore(1100, 1000)).toBe(90);
      });

      it('should return 0 for 100%+ higher price', () => {
        expect(calculatePriceScore(2000, 1000)).toBe(0);
      });

      it('should return 0 when lowest price is 0', () => {
        expect(calculatePriceScore(1000, 0)).toBe(0);
      });

      it('should round the score', () => {
        expect(calculatePriceScore(1050, 1000)).toBe(95);
      });
    });

    describe('compareOffers', () => {
      it('should identify the cheaper offer', () => {
        const offer1 = createMockOffer({ id: 'offer-1', totalAmount: 1000 });
        const offer2 = createMockOffer({ id: 'offer-2', totalAmount: 1200 });

        const result = compareOffers(offer1, offer2);

        expect(result.cheaper).toBe('offer-1');
      });

      it('should calculate price difference', () => {
        const offer1 = createMockOffer({ totalAmount: 1000 });
        const offer2 = createMockOffer({ totalAmount: 1200 });

        const result = compareOffers(offer1, offer2);

        expect(result.priceDiff).toBe(200);
      });

      it('should calculate percent difference', () => {
        const offer1 = createMockOffer({ totalAmount: 1000 });
        const offer2 = createMockOffer({ totalAmount: 1200 });

        const result = compareOffers(offer1, offer2);

        expect(result.percentDiff).toBeCloseTo(16.67, 1);
      });
    });

    describe('rankOffersByPrice', () => {
      it('should rank offers by price ascending', () => {
        const offers = [
          createMockOffer({ id: 'offer-1', totalAmount: 3000 }),
          createMockOffer({ id: 'offer-2', totalAmount: 1000 }),
          createMockOffer({ id: 'offer-3', totalAmount: 2000 }),
        ];

        const ranked = rankOffersByPrice(offers);

        expect(ranked[0]!.rank).toBe(1);
        expect(ranked[0]!.offer.id).toBe('offer-2');
        expect(ranked[1]!.rank).toBe(2);
        expect(ranked[1]!.offer.id).toBe('offer-3');
        expect(ranked[2]!.rank).toBe(3);
        expect(ranked[2]!.offer.id).toBe('offer-1');
      });
    });

    describe('findBestOffer', () => {
      it('should return null for empty array', () => {
        expect(findBestOffer([])).toBeNull();
      });

      it('should return recommended offer if exists', () => {
        const offers = [
          createMockOffer({ id: 'offer-1', totalAmount: 1000, isRecommended: false }),
          createMockOffer({ id: 'offer-2', totalAmount: 2000, isRecommended: true }),
        ];

        const best = findBestOffer(offers);

        expect(best?.id).toBe('offer-2');
      });

      it('should return lowest price offer if no recommended', () => {
        const offers = [
          createMockOffer({ id: 'offer-1', totalAmount: 2000, status: 'EVALUATED' }),
          createMockOffer({ id: 'offer-2', totalAmount: 1000, status: 'EVALUATED' }),
        ];

        const best = findBestOffer(offers);

        expect(best?.id).toBe('offer-2');
      });

      it('should exclude withdrawn and rejected offers', () => {
        const offers = [
          createMockOffer({ id: 'offer-1', totalAmount: 500, status: 'WITHDRAWN' }),
          createMockOffer({ id: 'offer-2', totalAmount: 1000, status: 'EVALUATED' }),
        ];

        const best = findBestOffer(offers);

        expect(best?.id).toBe('offer-2');
      });
    });
  });

  describe('formatting helpers', () => {
    describe('formatOfferDate', () => {
      it('should return N/A for undefined', () => {
        expect(formatOfferDate(undefined)).toBe('N/A');
      });

      it('should format date correctly', () => {
        const date = new Date('2024-06-15');
        const timestamp = createMockTimestamp(date);

        const result = formatOfferDate(timestamp);

        expect(result).toContain('2024');
        expect(result).toContain('Jun');
        expect(result).toContain('15');
      });
    });

    describe('formatEvaluationScore', () => {
      it('should return not evaluated for undefined', () => {
        const result = formatEvaluationScore(undefined);

        expect(result.text).toBe('Not evaluated');
        expect(result.color).toBe('text.secondary');
      });

      it('should return error color for score < 50', () => {
        const result = formatEvaluationScore(40);

        expect(result.text).toBe('40/100');
        expect(result.color).toBe('error.main');
      });

      it('should return warning color for score < 75', () => {
        const result = formatEvaluationScore(60);

        expect(result.text).toBe('60/100');
        expect(result.color).toBe('warning.main');
      });

      it('should return success color for score >= 75', () => {
        const result = formatEvaluationScore(80);

        expect(result.text).toBe('80/100');
        expect(result.color).toBe('success.main');
      });
    });
  });

  describe('search and filter', () => {
    describe('filterOffersBySearch', () => {
      it('should return all offers when search is empty', () => {
        const offers = [createMockOffer(), createMockOffer({ id: 'offer-2' })];

        expect(filterOffersBySearch(offers, '')).toHaveLength(2);
        expect(filterOffersBySearch(offers, '  ')).toHaveLength(2);
      });

      it('should filter by offer number', () => {
        const offers = [
          createMockOffer({ number: 'OFF-2024-001', rfqNumber: 'RFQ-A' }),
          createMockOffer({ id: 'offer-2', number: 'OFF-2024-002', rfqNumber: 'RFQ-B' }),
        ];

        const result = filterOffersBySearch(offers, 'OFF-2024-001');

        expect(result).toHaveLength(1);
        expect(result[0]!.number).toBe('OFF-2024-001');
      });

      it('should filter by vendor name', () => {
        const offers = [
          createMockOffer({ vendorName: 'ABC Corp' }),
          createMockOffer({ id: 'offer-2', vendorName: 'XYZ Ltd' }),
        ];

        const result = filterOffersBySearch(offers, 'ABC');

        expect(result).toHaveLength(1);
      });

      it('should be case-insensitive', () => {
        const offers = [createMockOffer({ vendorName: 'ABC Corporation' })];

        expect(filterOffersBySearch(offers, 'abc')).toHaveLength(1);
        expect(filterOffersBySearch(offers, 'ABC')).toHaveLength(1);
      });
    });

    describe('sortOffers', () => {
      it('should sort by number ascending', () => {
        const offers = [
          createMockOffer({ number: 'OFF-002' }),
          createMockOffer({ id: 'offer-2', number: 'OFF-001' }),
        ];

        const sorted = sortOffers(offers, 'number', 'asc');

        expect(sorted[0]!.number).toBe('OFF-001');
      });

      it('should sort by totalAmount descending', () => {
        const offers = [
          createMockOffer({ totalAmount: 1000 }),
          createMockOffer({ id: 'offer-2', totalAmount: 2000 }),
        ];

        const sorted = sortOffers(offers, 'totalAmount', 'desc');

        expect(sorted[0]!.totalAmount).toBe(2000);
      });

      it('should sort by evaluationScore', () => {
        const offers = [
          createMockOffer({ evaluationScore: 60 }),
          createMockOffer({ id: 'offer-2', evaluationScore: 80 }),
        ];

        const sorted = sortOffers(offers, 'evaluationScore', 'desc');

        expect(sorted[0]!.evaluationScore).toBe(80);
      });
    });
  });

  describe('statistics', () => {
    describe('calculateOfferStats', () => {
      it('should return zero stats for empty array', () => {
        const stats = calculateOfferStats([]);

        expect(stats.total).toBe(0);
        expect(stats.lowestPrice).toBe(0);
      });

      it('should count statuses correctly', () => {
        const offers = [
          createMockOffer({ status: 'UPLOADED' }),
          createMockOffer({ id: 'offer-2', status: 'UPLOADED' }),
          createMockOffer({ id: 'offer-3', status: 'EVALUATED' }),
          createMockOffer({ id: 'offer-4', status: 'SELECTED' }),
        ];

        const stats = calculateOfferStats(offers);

        expect(stats.uploaded).toBe(2);
        expect(stats.evaluated).toBe(1);
        expect(stats.selected).toBe(1);
      });

      it('should count recommended offers', () => {
        const offers = [
          createMockOffer({ isRecommended: true }),
          createMockOffer({ id: 'offer-2', isRecommended: false }),
        ];

        const stats = calculateOfferStats(offers);

        expect(stats.recommended).toBe(1);
      });

      it('should calculate price statistics', () => {
        const offers = [
          createMockOffer({ totalAmount: 1000, status: 'EVALUATED' }),
          createMockOffer({ id: 'offer-2', totalAmount: 2000, status: 'EVALUATED' }),
          createMockOffer({ id: 'offer-3', totalAmount: 3000, status: 'EVALUATED' }),
        ];

        const stats = calculateOfferStats(offers);

        expect(stats.lowestPrice).toBe(1000);
        expect(stats.highestPrice).toBe(3000);
        expect(stats.averagePrice).toBe(2000);
        expect(stats.priceRange).toBe(2000);
      });

      it('should exclude withdrawn and rejected from price stats', () => {
        const offers = [
          createMockOffer({ totalAmount: 500, status: 'WITHDRAWN' }),
          createMockOffer({ id: 'offer-2', totalAmount: 1000, status: 'EVALUATED' }),
        ];

        const stats = calculateOfferStats(offers);

        expect(stats.lowestPrice).toBe(1000);
      });
    });
  });

  describe('item helpers', () => {
    describe('calculateTotalAmount', () => {
      it('should calculate subtotal, tax, and total', () => {
        const items = [
          createMockOfferItem({ amount: 1000, gstAmount: 180 }),
          createMockOfferItem({ id: 'item-2', amount: 2000, gstAmount: 360 }),
        ];

        const result = calculateTotalAmount(items);

        expect(result.subtotal).toBe(3000);
        expect(result.taxAmount).toBe(540);
        expect(result.totalAmount).toBe(3540);
      });

      it('should handle missing gstAmount', () => {
        const items = [createMockOfferItem({ amount: 1000, gstAmount: undefined })];

        const result = calculateTotalAmount(items);

        expect(result.taxAmount).toBe(0);
        expect(result.totalAmount).toBe(1000);
      });
    });

    describe('checkAllItemsMeetSpec', () => {
      it('should return true when all items meet spec', () => {
        const items = [
          createMockOfferItem({ meetsSpec: true }),
          createMockOfferItem({ id: 'item-2', meetsSpec: true }),
        ];

        expect(checkAllItemsMeetSpec(items)).toBe(true);
      });

      it('should return false when any item does not meet spec', () => {
        const items = [
          createMockOfferItem({ meetsSpec: true }),
          createMockOfferItem({ id: 'item-2', meetsSpec: false }),
        ];

        expect(checkAllItemsMeetSpec(items)).toBe(false);
      });
    });

    describe('getItemsWithDeviations', () => {
      it('should return items that do not meet spec', () => {
        const items = [
          createMockOfferItem({ meetsSpec: true }),
          createMockOfferItem({ id: 'item-2', meetsSpec: false }),
        ];

        const result = getItemsWithDeviations(items);

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('item-2');
      });

      it('should return items with deviations', () => {
        const items = [
          createMockOfferItem({ meetsSpec: true, deviations: undefined }),
          createMockOfferItem({ id: 'item-2', meetsSpec: true, deviations: 'Minor deviation' }),
        ];

        const result = getItemsWithDeviations(items);

        expect(result).toHaveLength(1);
        expect(result[0]!.deviations).toBe('Minor deviation');
      });
    });

    describe('compareItemWithRequirement', () => {
      it('should return match true when quantities match', () => {
        const item = createMockOfferItem({ quotedQuantity: 100 });

        const result = compareItemWithRequirement(item, 100);

        expect(result.quantityMatch).toBe(true);
        expect(result.quantityDiff).toBe(0);
      });

      it('should calculate positive diff when quoted > required', () => {
        const item = createMockOfferItem({ quotedQuantity: 120 });

        const result = compareItemWithRequirement(item, 100);

        expect(result.quantityMatch).toBe(false);
        expect(result.quantityDiff).toBe(20);
        expect(result.percentDiff).toBe(20);
      });

      it('should calculate negative diff when quoted < required', () => {
        const item = createMockOfferItem({ quotedQuantity: 80 });

        const result = compareItemWithRequirement(item, 100);

        expect(result.quantityMatch).toBe(false);
        expect(result.quantityDiff).toBe(-20);
        expect(result.percentDiff).toBe(-20);
      });

      it('should handle zero required quantity', () => {
        const item = createMockOfferItem({ quotedQuantity: 100 });

        const result = compareItemWithRequirement(item, 0);

        expect(result.percentDiff).toBe(0);
      });
    });
  });
});
