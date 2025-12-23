/**
 * Formatters Tests
 *
 * Tests for common formatting utility functions
 */

import {
  formatMoney,
  formatDate,
  formatNumber,
  formatPercentage,
  formatFileSize,
  formatPhoneNumber,
  formatDuration,
  truncateText,
  formatWeight,
  formatRelativeTime,
  formatDualCurrency,
  formatExchangeRate,
  getCurrencyPrecision,
  roundCurrency,
  currencyEquals,
  isZeroCurrency,
  currencyDifference,
  currencySum,
} from './formatters';

describe('Formatters', () => {
  describe('formatMoney', () => {
    it('should format INR with rupee symbol', () => {
      const result = formatMoney({ amount: 1234.56, currency: 'INR' });
      expect(result).toBe('₹1,234.56');
    });

    it('should format USD with dollar symbol', () => {
      const result = formatMoney({ amount: 1000, currency: 'USD' });
      expect(result).toBe('$1,000.00');
    });

    it('should format EUR with euro symbol (German locale)', () => {
      const result = formatMoney({ amount: 500.5, currency: 'EUR' });
      // German locale: "500,50 €"
      expect(result).toContain('€');
      expect(result).toContain('500');
    });

    it('should format GBP with pound symbol', () => {
      const result = formatMoney({ amount: 250.99, currency: 'GBP' });
      expect(result).toContain('£');
      expect(result).toContain('250.99');
    });

    it('should format AED with Arabic locale', () => {
      const result = formatMoney({ amount: 100, currency: 'AED' });
      // Arabic locale uses different formatting
      expect(result).toContain('100');
    });

    it('should handle SGD currency', () => {
      const result = formatMoney({ amount: 100, currency: 'SGD' });
      // Should contain amount and currency indicator
      expect(result).toContain('100');
    });

    it('should handle zero amounts', () => {
      const result = formatMoney({ amount: 0, currency: 'INR' });
      expect(result).toBe('₹0.00');
    });

    it('should format large numbers with Indian comma notation', () => {
      const result = formatMoney({ amount: 1234567.89, currency: 'INR' });
      // Indian notation: 12,34,567.89
      expect(result).toContain('₹');
      expect(result).toContain('12,34,567.89');
    });
  });

  describe('formatDate', () => {
    it('should format Date object with short format', () => {
      const date = new Date('2025-11-26T00:00:00');
      const result = formatDate(date, 'short');
      expect(result).toBe('26-Nov-2025');
    });

    it('should format Date object with long format', () => {
      const date = new Date('2025-03-15T00:00:00');
      const result = formatDate(date, 'long');
      expect(result).toBe('15 March 2025');
    });

    it('should format Date object with datetime format', () => {
      const date = new Date('2025-11-26T14:30:00');
      const result = formatDate(date, 'datetime');
      expect(result).toBe('26-Nov-2025 14:30');
    });

    it('should format string date', () => {
      const result = formatDate('2025-12-25T00:00:00', 'short');
      expect(result).toBe('25-Dec-2025');
    });

    it('should format object with toDate method', () => {
      const timestamp = { toDate: () => new Date('2025-01-01T00:00:00') };
      const result = formatDate(timestamp, 'short');
      expect(result).toBe('01-Jan-2025');
    });

    it('should return dash for null', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('should return dash for invalid date string', () => {
      expect(formatDate('invalid-date')).toBe('-');
    });

    it('should default to short format', () => {
      const date = new Date('2025-06-15T00:00:00');
      const result = formatDate(date);
      expect(result).toBe('15-Jun-2025');
    });

    it('should pad single digit days and hours', () => {
      const date = new Date('2025-01-05T09:05:00');
      expect(formatDate(date, 'short')).toBe('05-Jan-2025');
      expect(formatDate(date, 'datetime')).toBe('05-Jan-2025 09:05');
    });
  });

  describe('formatNumber', () => {
    it('should format integer with no decimals', () => {
      const result = formatNumber(12345);
      expect(result).toBe('12,345');
    });

    it('should format number with specified decimals', () => {
      const result = formatNumber(12345.6789, 2);
      expect(result).toBe('12,345.68');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should use Indian locale formatting', () => {
      const result = formatNumber(1234567);
      // Indian notation: 12,34,567
      expect(result).toBe('12,34,567');
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal as percentage', () => {
      const result = formatPercentage(0.15);
      expect(result).toBe('15.0%');
    });

    it('should format with custom decimals', () => {
      const result = formatPercentage(0.1567, 2);
      expect(result).toBe('15.67%');
    });

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('should handle 100%', () => {
      expect(formatPercentage(1)).toBe('100.0%');
    });

    it('should handle values over 100%', () => {
      expect(formatPercentage(1.5)).toBe('150.0%');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format 10-digit Indian number', () => {
      const result = formatPhoneNumber('9876543210');
      expect(result).toBe('+91 98765 43210');
    });

    it('should format number with country code', () => {
      const result = formatPhoneNumber('919876543210');
      expect(result).toBe('+91 98765 43210');
    });

    it('should clean non-digit characters', () => {
      const result = formatPhoneNumber('+91 98765 43210');
      expect(result).toBe('+91 98765 43210');
    });

    it('should return short numbers as-is', () => {
      const result = formatPhoneNumber('12345');
      expect(result).toBe('12345');
    });

    it('should handle numbers with dashes', () => {
      const result = formatPhoneNumber('987-654-3210');
      expect(result).toBe('+91 98765 43210');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(30000)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(5400000)).toBe('1h 30m');
    });

    it('should format days and hours', () => {
      expect(formatDuration(86400000)).toBe('1d 0h');
      expect(formatDuration(90000000)).toBe('1d 1h');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });

  describe('truncateText', () => {
    it('should truncate text longer than maxLength', () => {
      const result = truncateText('Hello World', 5);
      expect(result).toBe('Hello...');
    });

    it('should not truncate text shorter than maxLength', () => {
      const result = truncateText('Hi', 10);
      expect(result).toBe('Hi');
    });

    it('should not truncate text equal to maxLength', () => {
      const result = truncateText('Hello', 5);
      expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('formatWeight', () => {
    it('should format kilograms', () => {
      expect(formatWeight(50)).toBe('50.00 kg');
      expect(formatWeight(999.99)).toBe('999.99 kg');
    });

    it('should convert to tons for >= 1000 kg', () => {
      expect(formatWeight(1000)).toBe('1.00 tons');
      expect(formatWeight(1500)).toBe('1.50 tons');
      expect(formatWeight(10000)).toBe('10.00 tons');
    });

    it('should handle zero', () => {
      expect(formatWeight(0)).toBe('0.00 kg');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format just now', () => {
      const date = new Date();
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('should format single minute ago', () => {
      const date = new Date(Date.now() - 60 * 1000);
      expect(formatRelativeTime(date)).toBe('1 minute ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2 hours ago');
    });

    it('should format single hour ago', () => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('1 hour ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('3 days ago');
    });

    it('should format weeks ago', () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2 weeks ago');
    });

    it('should format months ago', () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2 months ago');
    });

    it('should format years ago', () => {
      const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('1 year ago');
    });

    it('should handle timestamp object with toDate method', () => {
      const timestamp = { toDate: () => new Date() };
      expect(formatRelativeTime(timestamp as never)).toBe('just now');
    });
  });

  describe('formatDualCurrency', () => {
    it('should format foreign currency with INR equivalent', () => {
      const result = formatDualCurrency(1000, 'USD', 83250);
      expect(result).toBe('$1,000.00 (₹83,250.00)');
    });

    it('should return single format for INR transactions', () => {
      const result = formatDualCurrency(1000, 'INR', 1000);
      expect(result).toBe('₹1,000.00');
    });

    it('should handle EUR currency', () => {
      const result = formatDualCurrency(500, 'EUR', 45000);
      expect(result).toContain('€');
      expect(result).toContain('₹45,000.00');
    });

    it('should handle GBP currency', () => {
      const result = formatDualCurrency(200, 'GBP', 21000);
      expect(result).toContain('£');
      expect(result).toContain('₹21,000.00');
    });

    it('should handle zero amounts', () => {
      const result = formatDualCurrency(0, 'USD', 0);
      expect(result).toBe('$0.00 (₹0.00)');
    });

    it('should handle custom base currency', () => {
      const result = formatDualCurrency(1000, 'INR', 12, 'USD');
      expect(result).toBe('₹1,000.00 ($12.00)');
    });
  });

  describe('formatExchangeRate', () => {
    it('should format short rate with @ symbol', () => {
      const result = formatExchangeRate(83.25, 'USD');
      expect(result).toBe('@83.25');
    });

    it('should format long rate with currency text', () => {
      const result = formatExchangeRate(83.25, 'USD', 'INR', 'long');
      expect(result).toBe('1 USD = ₹83.25');
    });

    it('should handle EUR to INR', () => {
      const result = formatExchangeRate(90.5, 'EUR', 'INR', 'long');
      expect(result).toBe('1 EUR = ₹90.50');
    });

    it('should round to 2 decimal places', () => {
      const result = formatExchangeRate(83.256789, 'USD');
      expect(result).toBe('@83.26');
    });

    it('should handle rate of 1', () => {
      const result = formatExchangeRate(1, 'INR');
      expect(result).toBe('@1.00');
    });

    it('should handle very small rates', () => {
      const result = formatExchangeRate(0.01, 'JPY');
      expect(result).toBe('@0.01');
    });
  });

  // =========================================================================
  // Currency Precision Utilities
  // =========================================================================

  describe('getCurrencyPrecision', () => {
    it('should return 2 for most currencies (INR, USD, EUR)', () => {
      expect(getCurrencyPrecision('INR')).toBe(2);
      expect(getCurrencyPrecision('USD')).toBe(2);
      expect(getCurrencyPrecision('EUR')).toBe(2);
      expect(getCurrencyPrecision('GBP')).toBe(2);
      expect(getCurrencyPrecision('AED')).toBe(2);
    });

    it('should return 3 for 3-decimal currencies (BHD, KWD, OMR)', () => {
      expect(getCurrencyPrecision('BHD')).toBe(3);
      expect(getCurrencyPrecision('KWD')).toBe(3);
      expect(getCurrencyPrecision('OMR')).toBe(3);
    });

    it('should default to 2 for unknown currencies', () => {
      expect(getCurrencyPrecision('XYZ')).toBe(2);
      expect(getCurrencyPrecision()).toBe(2);
    });
  });

  describe('roundCurrency', () => {
    it('should round to 2 decimals for INR', () => {
      expect(roundCurrency(123.456, 'INR')).toBe(123.46);
      expect(roundCurrency(123.454, 'INR')).toBe(123.45);
      expect(roundCurrency(123.455, 'INR')).toBe(123.46); // Banker's rounding
    });

    it('should round to 3 decimals for KWD', () => {
      expect(roundCurrency(123.4567, 'KWD')).toBe(123.457);
      expect(roundCurrency(123.4564, 'KWD')).toBe(123.456);
    });

    it('should handle negative amounts', () => {
      expect(roundCurrency(-123.456, 'INR')).toBe(-123.46);
    });

    it('should handle very small amounts', () => {
      expect(roundCurrency(0.001, 'INR')).toBe(0);
      expect(roundCurrency(0.005, 'INR')).toBe(0.01);
    });

    it('should handle whole numbers', () => {
      expect(roundCurrency(100, 'INR')).toBe(100);
    });

    it('should default to INR', () => {
      expect(roundCurrency(123.456)).toBe(123.46);
    });
  });

  describe('currencyEquals', () => {
    it('should return true for equal amounts', () => {
      expect(currencyEquals(100.0, 100.0)).toBe(true);
      expect(currencyEquals(0, 0)).toBe(true);
    });

    it('should return true for amounts within tolerance', () => {
      // Tolerance for INR is 0.005 (half of 0.01)
      expect(currencyEquals(100.001, 100.002, 'INR')).toBe(true);
      expect(currencyEquals(100.004, 100.0, 'INR')).toBe(true);
    });

    it('should return false for amounts outside tolerance', () => {
      expect(currencyEquals(100.01, 100.02, 'INR')).toBe(false);
      expect(currencyEquals(100.0, 100.01, 'INR')).toBe(false);
    });

    it('should handle floating-point precision issues', () => {
      // Classic floating-point issue: 0.1 + 0.2 !== 0.3
      const sum = 0.1 + 0.2;
      expect(currencyEquals(sum, 0.3, 'INR')).toBe(true);
    });

    it('should use appropriate tolerance for 3-decimal currencies', () => {
      // Tolerance for KWD is 0.0005 (half of 0.001)
      expect(currencyEquals(100.0001, 100.0004, 'KWD')).toBe(true);
      expect(currencyEquals(100.001, 100.002, 'KWD')).toBe(false);
    });
  });

  describe('isZeroCurrency', () => {
    it('should return true for zero', () => {
      expect(isZeroCurrency(0)).toBe(true);
      expect(isZeroCurrency(-0)).toBe(true);
    });

    it('should return true for amounts that round to zero', () => {
      expect(isZeroCurrency(0.001, 'INR')).toBe(true);
      expect(isZeroCurrency(-0.001, 'INR')).toBe(true);
    });

    it('should return false for non-zero amounts', () => {
      expect(isZeroCurrency(0.01, 'INR')).toBe(false);
      expect(isZeroCurrency(-0.01, 'INR')).toBe(false);
      expect(isZeroCurrency(100, 'INR')).toBe(false);
    });
  });

  describe('currencyDifference', () => {
    it('should calculate difference with proper rounding', () => {
      expect(currencyDifference(100.5, 50.25, 'INR')).toBe(50.25);
      expect(currencyDifference(100, 33.33, 'INR')).toBe(66.67);
    });

    it('should handle negative results', () => {
      expect(currencyDifference(50, 100, 'INR')).toBe(-50);
    });

    it('should avoid floating-point errors', () => {
      expect(currencyDifference(100.1, 0.1, 'INR')).toBe(100);
    });
  });

  describe('currencySum', () => {
    it('should sum amounts with proper rounding', () => {
      expect(currencySum([10.5, 20.25, 30.75], 'INR')).toBe(61.5);
    });

    it('should handle empty array', () => {
      expect(currencySum([], 'INR')).toBe(0);
    });

    it('should handle single amount', () => {
      expect(currencySum([100.555], 'INR')).toBe(100.56);
    });

    it('should avoid accumulating floating-point errors', () => {
      // Adding many 0.1 values should not accumulate errors
      const amounts = Array(10).fill(0.1);
      expect(currencySum(amounts, 'INR')).toBe(1);
    });

    it('should handle negative amounts', () => {
      expect(currencySum([100, -50, 25.5], 'INR')).toBe(75.5);
    });
  });
});
