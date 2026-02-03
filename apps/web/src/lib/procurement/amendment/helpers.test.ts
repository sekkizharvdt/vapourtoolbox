/**
 * Amendment Helpers Tests
 */

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import { Timestamp } from 'firebase/firestore';
import { determineAmendmentType, formatValue } from './helpers';
import type { PurchaseOrderChange } from '@vapour/types';

function createChange(overrides: Partial<PurchaseOrderChange> = {}): PurchaseOrderChange {
  return {
    field: 'test',
    fieldLabel: 'Test',
    oldValue: '',
    newValue: '',
    oldValueDisplay: '',
    newValueDisplay: '',
    category: 'GENERAL' as never,
    ...overrides,
  };
}

describe('Amendment Helpers', () => {
  describe('determineAmendmentType', () => {
    it('should return QUANTITY_CHANGE for quantity field changes', () => {
      const changes = [createChange({ field: 'items[0].quantity' })];
      expect(determineAmendmentType(changes)).toBe('QUANTITY_CHANGE');
    });

    it('should return PRICE_CHANGE for price field changes', () => {
      const changes = [createChange({ field: 'items[0].unitPrice' })];
      expect(determineAmendmentType(changes)).toBe('PRICE_CHANGE');
    });

    it('should return PRICE_CHANGE for total field changes', () => {
      const changes = [createChange({ field: 'grandTotal' })];
      expect(determineAmendmentType(changes)).toBe('PRICE_CHANGE');
    });

    it('should return DELIVERY_CHANGE for delivery field changes', () => {
      // field.includes('delivery') is case-sensitive
      const changes = [createChange({ field: 'deliveryDate' })];
      expect(determineAmendmentType(changes)).toBe('DELIVERY_CHANGE');
    });

    it('should return TERMS_CHANGE for terms category changes', () => {
      const changes = [createChange({ field: 'paymentTerms', category: 'TERMS' as never })];
      expect(determineAmendmentType(changes)).toBe('TERMS_CHANGE');
    });

    it('should return GENERAL for unrecognized changes', () => {
      const changes = [createChange({ field: 'notes', category: 'GENERAL' as never })];
      expect(determineAmendmentType(changes)).toBe('GENERAL');
    });

    it('should prioritize quantity over price changes', () => {
      const changes = [
        createChange({ field: 'items[0].quantity' }),
        createChange({ field: 'grandTotal' }),
      ];
      expect(determineAmendmentType(changes)).toBe('QUANTITY_CHANGE');
    });

    it('should prioritize price over delivery changes', () => {
      const changes = [
        createChange({ field: 'unitPrice' }),
        createChange({ field: 'deliveryDate' }),
      ];
      expect(determineAmendmentType(changes)).toBe('PRICE_CHANGE');
    });
  });

  describe('formatValue', () => {
    it('should return N/A for null', () => {
      expect(formatValue(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
      expect(formatValue(undefined)).toBe('N/A');
    });

    it('should format numbers with 2 decimal places', () => {
      expect(formatValue(1234.5)).toBe('1234.50');
      expect(formatValue(0)).toBe('0.00');
      expect(formatValue(999999)).toBe('999999.00');
    });

    it('should format Date objects as locale strings', () => {
      const date = new Date('2024-01-15');
      const result = formatValue(date);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format Firestore Timestamps', () => {
      const timestamp = Timestamp.fromDate(new Date('2024-06-15'));
      const result = formatValue(timestamp);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should JSON-stringify objects', () => {
      const obj = { key: 'value' };
      expect(formatValue(obj)).toBe('{"key":"value"}');
    });

    it('should convert strings directly', () => {
      expect(formatValue('hello')).toBe('hello');
    });

    it('should convert booleans to strings', () => {
      expect(formatValue(true)).toBe('true');
      expect(formatValue(false)).toBe('false');
    });
  });
});
