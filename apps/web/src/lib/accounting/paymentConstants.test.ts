/**
 * Payment Constants Tests
 */

import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CURRENCIES,
  TDS_SECTIONS,
  getCurrency,
  getTDSSection,
  formatPaymentMethod,
} from './paymentConstants';
import type { PaymentMethod } from '@vapour/types';

describe('Payment Constants', () => {
  describe('PAYMENT_METHODS', () => {
    it('should contain all expected payment methods', () => {
      expect(PAYMENT_METHODS).toContain('BANK_TRANSFER');
      expect(PAYMENT_METHODS).toContain('UPI');
      expect(PAYMENT_METHODS).toContain('CHEQUE');
      expect(PAYMENT_METHODS).toContain('CASH');
      expect(PAYMENT_METHODS).toContain('CREDIT_CARD');
      expect(PAYMENT_METHODS).toContain('DEBIT_CARD');
      expect(PAYMENT_METHODS).toContain('OTHER');
    });

    it('should have labels for every payment method', () => {
      PAYMENT_METHODS.forEach((method) => {
        expect(PAYMENT_METHOD_LABELS[method]).toBeDefined();
        expect(PAYMENT_METHOD_LABELS[method].length).toBeGreaterThan(0);
      });
    });
  });

  describe('CURRENCIES', () => {
    it('should include INR as the first currency', () => {
      expect(CURRENCIES[0]!.code).toBe('INR');
      expect(CURRENCIES[0]!.symbol).toBe('₹');
    });

    it('should include major world currencies', () => {
      const codes = CURRENCIES.map((c) => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
    });

    it('should have code, symbol, and name for each currency', () => {
      CURRENCIES.forEach((currency) => {
        expect(currency.code).toBeDefined();
        expect(currency.symbol).toBeDefined();
        expect(currency.name).toBeDefined();
      });
    });
  });

  describe('TDS_SECTIONS', () => {
    it('should include common TDS sections', () => {
      const codes = TDS_SECTIONS.map((s) => s.code);
      expect(codes).toContain('194C');
      expect(codes).toContain('194J');
      expect(codes).toContain('194H');
    });

    it('should have valid rates', () => {
      TDS_SECTIONS.forEach((section) => {
        expect(section.rate).toBeGreaterThan(0);
        expect(section.rate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getCurrency', () => {
    it('should return INR for code INR', () => {
      const result = getCurrency('INR');
      expect(result).toBeDefined();
      expect(result!.code).toBe('INR');
      expect(result!.symbol).toBe('₹');
      expect(result!.name).toBe('Indian Rupee');
    });

    it('should return USD for code USD', () => {
      const result = getCurrency('USD');
      expect(result).toBeDefined();
      expect(result!.code).toBe('USD');
    });

    it('should return undefined for unknown code', () => {
      const result = getCurrency('XYZ');
      expect(result).toBeUndefined();
    });
  });

  describe('getTDSSection', () => {
    it('should return section 194C for contractors', () => {
      const result = getTDSSection('194C');
      expect(result).toBeDefined();
      expect(result!.rate).toBe(2);
    });

    it('should return section 194J for professionals', () => {
      const result = getTDSSection('194J');
      expect(result).toBeDefined();
      expect(result!.rate).toBe(10);
    });

    it('should return undefined for unknown code', () => {
      const result = getTDSSection('999X');
      expect(result).toBeUndefined();
    });
  });

  describe('formatPaymentMethod', () => {
    it('should format BANK_TRANSFER to Bank Transfer', () => {
      expect(formatPaymentMethod('BANK_TRANSFER' as PaymentMethod)).toBe('Bank Transfer');
    });

    it('should format UPI to UPI', () => {
      expect(formatPaymentMethod('UPI' as PaymentMethod)).toBe('UPI');
    });

    it('should format CHEQUE to Cheque', () => {
      expect(formatPaymentMethod('CHEQUE' as PaymentMethod)).toBe('Cheque');
    });

    it('should return method string for unknown methods', () => {
      expect(formatPaymentMethod('UNKNOWN' as PaymentMethod)).toBe('UNKNOWN');
    });
  });
});
