/**
 * Date and Time Utilities Tests
 */

import {
  DEFAULT_TIMEZONE,
  getStartOfDay,
  getEndOfDay,
  isSameDay,
  isToday,
  getTodayDateString,
  getFiscalYear,
  getFiscalYearRange,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  createTimestampFromDateString,
  getDateParts,
  addDays,
  addMonths,
  getDaysDifference,
  isPast,
  isFuture,
  getMonthName,
  getQuarter,
  getFiscalQuarter,
} from './dateTime';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Timestamp
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;

    constructor(seconds: number, nanoseconds: number = 0) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }

    static fromDate(date: Date) {
      return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
    }

    static now() {
      return MockTimestamp.fromDate(new Date());
    }
  }

  return {
    Timestamp: MockTimestamp,
  };
});

describe('dateTime utilities', () => {
  describe('DEFAULT_TIMEZONE', () => {
    it('should be Asia/Kolkata', () => {
      expect(DEFAULT_TIMEZONE).toBe('Asia/Kolkata');
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day in IST', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const startOfDay = getStartOfDay(date, 'Asia/Kolkata');
      // In IST (UTC+5:30), start of day should be at 18:30 UTC the previous day
      expect(startOfDay.getUTCHours()).toBeLessThanOrEqual(18);
    });

    it('should return start of day in UTC', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const startOfDay = getStartOfDay(date, 'UTC');
      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
    });

    it('should handle dates near midnight', () => {
      const date = new Date('2025-06-15T00:15:00Z');
      const startOfDay = getStartOfDay(date, 'UTC');
      expect(startOfDay.getUTCDate()).toBe(15);
      expect(startOfDay.getUTCHours()).toBe(0);
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day (23:59:59.999)', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const endOfDay = getEndOfDay(date, 'UTC');
      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
    });

    it('should be 1ms before next day start', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const endOfDay = getEndOfDay(date, 'UTC');
      const startOfNextDay = getStartOfDay(new Date('2025-06-16T12:00:00Z'), 'UTC');
      expect(startOfNextDay.getTime() - endOfDay.getTime()).toBe(1);
    });
  });

  describe('isSameDay', () => {
    it('should return true for dates on the same day', () => {
      const date1 = new Date('2025-06-15T10:00:00Z');
      const date2 = new Date('2025-06-15T22:00:00Z');
      expect(isSameDay(date1, date2, 'UTC')).toBe(true);
    });

    it('should return false for dates on different days', () => {
      const date1 = new Date('2025-06-15T10:00:00Z');
      const date2 = new Date('2025-06-16T10:00:00Z');
      expect(isSameDay(date1, date2, 'UTC')).toBe(false);
    });

    it('should handle Timestamp objects', () => {
      const date1 = Timestamp.fromDate(new Date('2025-06-15T10:00:00Z'));
      const date2 = Timestamp.fromDate(new Date('2025-06-15T20:00:00Z'));
      expect(isSameDay(date1, date2, 'UTC')).toBe(true);
    });

    it('should consider timezone for day boundaries', () => {
      // 23:00 UTC on June 15 is 4:30 AM IST on June 16
      const date1 = new Date('2025-06-15T23:00:00Z');
      const date2 = new Date('2025-06-16T01:00:00Z');
      // In UTC, these are different days
      expect(isSameDay(date1, date2, 'UTC')).toBe(false);
      // In IST, both are June 16
      expect(isSameDay(date1, date2, 'Asia/Kolkata')).toBe(true);
    });
  });

  describe('isToday', () => {
    it('should return true for current date', () => {
      const now = new Date();
      expect(isToday(now, 'UTC')).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isToday(yesterday, 'UTC')).toBe(false);
    });

    it('should handle Timestamp objects', () => {
      const now = Timestamp.now();
      expect(isToday(now)).toBe(true);
    });
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getTodayDateString('UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should match current date', () => {
      const result = getTodayDateString('UTC');
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      expect(result).toBe(`${year}-${month}-${day}`);
    });
  });

  describe('getFiscalYear', () => {
    it('should return current year for April-December', () => {
      const date = new Date('2024-06-15T00:00:00Z');
      expect(getFiscalYear(date, 'UTC')).toBe(2024);
    });

    it('should return previous year for January-March', () => {
      const date = new Date('2025-02-15T00:00:00Z');
      expect(getFiscalYear(date, 'UTC')).toBe(2024);
    });

    it('should return current year for April 1st', () => {
      const date = new Date('2024-04-01T00:00:00Z');
      expect(getFiscalYear(date, 'UTC')).toBe(2024);
    });

    it('should return previous year for March 31st', () => {
      const date = new Date('2025-03-31T00:00:00Z');
      expect(getFiscalYear(date, 'UTC')).toBe(2024);
    });
  });

  describe('getFiscalYearRange', () => {
    it('should return April 1 to March 31', () => {
      const range = getFiscalYearRange(2024, 'UTC');

      // Start should be April 1, 2024
      const startDate = range.start;
      expect(startDate.getUTCFullYear()).toBe(2024);
      expect(startDate.getUTCMonth()).toBe(3); // April (0-indexed)
      expect(startDate.getUTCDate()).toBe(1);

      // End should be March 31, 2025
      const endDate = range.end;
      expect(endDate.getUTCFullYear()).toBe(2025);
      expect(endDate.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(endDate.getUTCDate()).toBe(31);
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date with default options', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = formatDateForDisplay(date, 'UTC');
      expect(result).toContain('15');
      expect(result).toContain('Jun');
      expect(result).toContain('2025');
    });

    it('should return empty string for null', () => {
      expect(formatDateForDisplay(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDateForDisplay(undefined)).toBe('');
    });

    it('should handle Timestamp objects', () => {
      const timestamp = Timestamp.fromDate(new Date('2025-06-15T12:00:00Z'));
      const result = formatDateForDisplay(timestamp, 'UTC');
      expect(result).toContain('15');
    });

    it('should accept custom format options', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = formatDateForDisplay(date, 'UTC', { year: 'numeric' });
      expect(result).toBe('2025');
    });
  });

  describe('formatDateTimeForDisplay', () => {
    it('should include time in output', () => {
      const date = new Date('2025-06-15T14:30:00Z');
      const result = formatDateTimeForDisplay(date, 'UTC');
      // Result format is "DD Mon YYYY, HH:MM am/pm" - 12-hour format
      expect(result).toContain('30');
      expect(result).toMatch(/pm|am/i);
    });

    it('should return empty string for null', () => {
      expect(formatDateTimeForDisplay(null)).toBe('');
    });
  });

  describe('createTimestampFromDateString', () => {
    it('should create Timestamp from YYYY-MM-DD string', () => {
      const timestamp = createTimestampFromDateString('2025-06-15', 'UTC');
      const date = timestamp.toDate();
      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(date.getUTCDate()).toBe(15);
    });
  });

  describe('getDateParts', () => {
    it('should return year, month, day from Date', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const parts = getDateParts(date, 'UTC');
      expect(parts.year).toBe(2025);
      expect(parts.month).toBe(6);
      expect(parts.day).toBe(15);
    });

    it('should handle Timestamp objects', () => {
      const timestamp = Timestamp.fromDate(new Date('2025-12-25T00:00:00Z'));
      const parts = getDateParts(timestamp, 'UTC');
      expect(parts.year).toBe(2025);
      expect(parts.month).toBe(12);
      expect(parts.day).toBe(25);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.getUTCDate()).toBe(20);
    });

    it('should subtract negative days', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = addDays(date, -5);
      expect(result.getUTCDate()).toBe(10);
    });

    it('should handle month boundary', () => {
      const date = new Date('2025-06-30T12:00:00Z');
      const result = addDays(date, 2);
      expect(result.getUTCMonth()).toBe(6); // July
      expect(result.getUTCDate()).toBe(2);
    });

    it('should handle Timestamp objects', () => {
      const timestamp = Timestamp.fromDate(new Date('2025-06-15T12:00:00Z'));
      const result = addDays(timestamp, 10);
      expect(result.getUTCDate()).toBe(25);
    });
  });

  describe('addMonths', () => {
    it('should add positive months', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = addMonths(date, 3);
      expect(result.getUTCMonth()).toBe(8); // September
    });

    it('should subtract negative months', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const result = addMonths(date, -2);
      expect(result.getUTCMonth()).toBe(3); // April
    });

    it('should handle year boundary', () => {
      const date = new Date('2025-11-15T12:00:00Z');
      const result = addMonths(date, 3);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(1); // February
    });

    it('should handle Timestamp objects', () => {
      const timestamp = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));
      const result = addMonths(timestamp, 6);
      expect(result.getUTCMonth()).toBe(6); // July
    });
  });

  describe('getDaysDifference', () => {
    it('should return positive for later date first', () => {
      const date1 = new Date('2025-06-20T12:00:00Z');
      const date2 = new Date('2025-06-15T12:00:00Z');
      expect(getDaysDifference(date1, date2)).toBe(5);
    });

    it('should return negative for earlier date first', () => {
      const date1 = new Date('2025-06-15T12:00:00Z');
      const date2 = new Date('2025-06-20T12:00:00Z');
      expect(getDaysDifference(date1, date2)).toBe(-5);
    });

    it('should return 0 for same day (when time diff less than 24h)', () => {
      // Same day, just 1 hour apart
      const date1 = new Date('2025-06-15T12:00:00Z');
      const date2 = new Date('2025-06-15T11:00:00Z');
      expect(getDaysDifference(date1, date2)).toBe(0);
    });

    it('should handle Timestamp objects', () => {
      const ts1 = Timestamp.fromDate(new Date('2025-06-20T12:00:00Z'));
      const ts2 = Timestamp.fromDate(new Date('2025-06-15T12:00:00Z'));
      expect(getDaysDifference(ts1, ts2)).toBe(5);
    });
  });

  describe('isPast', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(isPast(yesterday)).toBe(true);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      expect(isPast(tomorrow)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should return true for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      expect(isFuture(tomorrow)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(isFuture(yesterday)).toBe(false);
    });
  });

  describe('getMonthName', () => {
    it('should return full month name', () => {
      expect(getMonthName(1)).toBe('January');
      expect(getMonthName(6)).toBe('June');
      expect(getMonthName(12)).toBe('December');
    });

    it('should return short month name', () => {
      expect(getMonthName(1, true)).toBe('Jan');
      expect(getMonthName(6, true)).toBe('Jun');
      expect(getMonthName(12, true)).toBe('Dec');
    });
  });

  describe('getQuarter', () => {
    it('should return correct quarter for each month', () => {
      expect(getQuarter(1)).toBe(1);
      expect(getQuarter(3)).toBe(1);
      expect(getQuarter(4)).toBe(2);
      expect(getQuarter(6)).toBe(2);
      expect(getQuarter(7)).toBe(3);
      expect(getQuarter(9)).toBe(3);
      expect(getQuarter(10)).toBe(4);
      expect(getQuarter(12)).toBe(4);
    });
  });

  describe('getFiscalQuarter', () => {
    it('should return Q1 for April-June', () => {
      expect(getFiscalQuarter(4)).toBe(1);
      expect(getFiscalQuarter(5)).toBe(1);
      expect(getFiscalQuarter(6)).toBe(1);
    });

    it('should return Q2 for July-September', () => {
      expect(getFiscalQuarter(7)).toBe(2);
      expect(getFiscalQuarter(8)).toBe(2);
      expect(getFiscalQuarter(9)).toBe(2);
    });

    it('should return Q3 for October-December', () => {
      expect(getFiscalQuarter(10)).toBe(3);
      expect(getFiscalQuarter(11)).toBe(3);
      expect(getFiscalQuarter(12)).toBe(3);
    });

    it('should return Q4 for January-March', () => {
      expect(getFiscalQuarter(1)).toBe(4);
      expect(getFiscalQuarter(2)).toBe(4);
      expect(getFiscalQuarter(3)).toBe(4);
    });
  });
});
