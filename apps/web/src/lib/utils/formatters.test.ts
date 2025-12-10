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

    it('should format EUR with euro symbol', () => {
      const result = formatMoney({ amount: 500.5, currency: 'EUR' });
      expect(result).toBe('€500.50');
    });

    it('should format GBP with pound symbol', () => {
      const result = formatMoney({ amount: 250.99, currency: 'GBP' });
      expect(result).toBe('£250.99');
    });

    it('should format AED with prefix', () => {
      const result = formatMoney({ amount: 100, currency: 'AED' });
      expect(result).toBe('AED 100.00');
    });

    it('should handle SGD currency with code prefix', () => {
      const result = formatMoney({ amount: 100, currency: 'SGD' });
      expect(result).toBe('SGD 100.00');
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
});
