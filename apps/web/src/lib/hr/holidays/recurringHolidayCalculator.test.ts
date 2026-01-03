/**
 * Recurring Holiday Calculator Tests
 *
 * Tests for recurring holiday calculation functions:
 * - isSunday, isFirstSaturday, isSecondSaturday, isThirdSaturday, isFourthSaturday
 * - isRecurringHoliday
 * - getRecurringHolidaysForMonth, getRecurringHolidaysInRange
 * - countRecurringHolidaysInRange
 * - getSaturdaysInMonth
 */

import {
  isSunday,
  isFirstSaturday,
  isSecondSaturday,
  isThirdSaturday,
  isFourthSaturday,
  isRecurringHoliday,
  getRecurringHolidayLabel,
  getRecurringHolidaysForMonth,
  getRecurringHolidaysInRange,
  countRecurringHolidaysInRange,
  getSaturdaysInMonth,
  DEFAULT_RECURRING_CONFIG,
} from './recurringHolidayCalculator';

describe('Recurring Holiday Calculator', () => {
  describe('isSunday', () => {
    it('should return true for a Sunday', () => {
      // January 5, 2025 is a Sunday
      const sunday = new Date(2025, 0, 5);
      expect(isSunday(sunday)).toBe(true);
    });

    it('should return false for other days', () => {
      // January 4, 2025 is a Saturday
      const saturday = new Date(2025, 0, 4);
      expect(isSunday(saturday)).toBe(false);

      // January 6, 2025 is a Monday
      const monday = new Date(2025, 0, 6);
      expect(isSunday(monday)).toBe(false);
    });
  });

  describe('isFirstSaturday', () => {
    it('should return true for the first Saturday (day 1-7)', () => {
      // January 4, 2025 is the 1st Saturday (day 4)
      const firstSat = new Date(2025, 0, 4);
      expect(isFirstSaturday(firstSat)).toBe(true);
    });

    it('should return true when 1st Saturday falls on day 1', () => {
      // February 1, 2025 is a Saturday (day 1)
      const firstSatDay1 = new Date(2025, 1, 1);
      expect(isFirstSaturday(firstSatDay1)).toBe(true);
    });

    it('should return true when 1st Saturday falls on day 7', () => {
      // March 7, 2026 is a Saturday (day 7)
      const firstSatDay7 = new Date(2026, 2, 7);
      expect(isFirstSaturday(firstSatDay7)).toBe(true);
    });

    it('should return false for the second Saturday', () => {
      // January 11, 2025 is the 2nd Saturday
      const secondSat = new Date(2025, 0, 11);
      expect(isFirstSaturday(secondSat)).toBe(false);
    });

    it('should return false for other days of the week', () => {
      // January 5, 2025 is a Sunday (day 5)
      const sundayDay5 = new Date(2025, 0, 5);
      expect(isFirstSaturday(sundayDay5)).toBe(false);
    });
  });

  describe('isSecondSaturday', () => {
    it('should return true for the second Saturday (day 8-14)', () => {
      // January 11, 2025 is the 2nd Saturday (day 11)
      const secondSat = new Date(2025, 0, 11);
      expect(isSecondSaturday(secondSat)).toBe(true);
    });

    it('should return true when 2nd Saturday falls on day 8', () => {
      // February 8, 2025 is a Saturday (day 8)
      const secondSatDay8 = new Date(2025, 1, 8);
      expect(isSecondSaturday(secondSatDay8)).toBe(true);
    });

    it('should return true when 2nd Saturday falls on day 14', () => {
      // March 14, 2026 is a Saturday (day 14)
      const secondSatDay14 = new Date(2026, 2, 14);
      expect(isSecondSaturday(secondSatDay14)).toBe(true);
    });

    it('should return false for the first Saturday', () => {
      const firstSat = new Date(2025, 0, 4);
      expect(isSecondSaturday(firstSat)).toBe(false);
    });
  });

  describe('isThirdSaturday', () => {
    it('should return true for the third Saturday (day 15-21)', () => {
      // January 18, 2025 is the 3rd Saturday (day 18)
      const thirdSat = new Date(2025, 0, 18);
      expect(isThirdSaturday(thirdSat)).toBe(true);
    });

    it('should return true when 3rd Saturday falls on day 15', () => {
      // February 15, 2025 is a Saturday (day 15)
      const thirdSatDay15 = new Date(2025, 1, 15);
      expect(isThirdSaturday(thirdSatDay15)).toBe(true);
    });

    it('should return true when 3rd Saturday falls on day 21', () => {
      // March 21, 2026 is a Saturday (day 21)
      const thirdSatDay21 = new Date(2026, 2, 21);
      expect(isThirdSaturday(thirdSatDay21)).toBe(true);
    });

    it('should return false for the fourth Saturday', () => {
      // January 25, 2025 is the 4th Saturday
      const fourthSat = new Date(2025, 0, 25);
      expect(isThirdSaturday(fourthSat)).toBe(false);
    });
  });

  describe('isFourthSaturday', () => {
    it('should return true for the fourth Saturday (day 22-28)', () => {
      // January 25, 2025 is the 4th Saturday (day 25)
      const fourthSat = new Date(2025, 0, 25);
      expect(isFourthSaturday(fourthSat)).toBe(true);
    });

    it('should return true when 4th Saturday falls on day 22', () => {
      // February 22, 2025 is a Saturday (day 22)
      const fourthSatDay22 = new Date(2025, 1, 22);
      expect(isFourthSaturday(fourthSatDay22)).toBe(true);
    });

    it('should return true when 4th Saturday falls on day 28', () => {
      // March 28, 2026 is a Saturday (day 28)
      const fourthSatDay28 = new Date(2026, 2, 28);
      expect(isFourthSaturday(fourthSatDay28)).toBe(true);
    });

    it('should return false for the third Saturday', () => {
      const thirdSat = new Date(2025, 0, 18);
      expect(isFourthSaturday(thirdSat)).toBe(false);
    });
  });

  describe('isRecurringHoliday', () => {
    it('should return true for Sundays with default config', () => {
      const sunday = new Date(2025, 0, 5);
      expect(isRecurringHoliday(sunday)).toBe(true);
    });

    it('should return true for 1st Saturday with default config', () => {
      const firstSat = new Date(2025, 0, 4);
      expect(isRecurringHoliday(firstSat)).toBe(true);
    });

    it('should return true for 3rd Saturday with default config', () => {
      const thirdSat = new Date(2025, 0, 18);
      expect(isRecurringHoliday(thirdSat)).toBe(true);
    });

    it('should return false for 2nd Saturday with default config', () => {
      const secondSat = new Date(2025, 0, 11);
      expect(isRecurringHoliday(secondSat)).toBe(false);
    });

    it('should return false for 4th Saturday with default config', () => {
      const fourthSat = new Date(2025, 0, 25);
      expect(isRecurringHoliday(fourthSat)).toBe(false);
    });

    it('should return false for weekdays with default config', () => {
      const monday = new Date(2025, 0, 6);
      expect(isRecurringHoliday(monday)).toBe(false);
    });

    it('should respect custom config (no Sundays)', () => {
      const sunday = new Date(2025, 0, 5);
      const config = { sundays: false, firstSaturday: true, thirdSaturday: true };
      expect(isRecurringHoliday(sunday, config)).toBe(false);
    });

    it('should respect custom config (no 1st Saturday)', () => {
      const firstSat = new Date(2025, 0, 4);
      const config = { sundays: true, firstSaturday: false, thirdSaturday: true };
      expect(isRecurringHoliday(firstSat, config)).toBe(false);
    });

    it('should respect custom config (no 3rd Saturday)', () => {
      const thirdSat = new Date(2025, 0, 18);
      const config = { sundays: true, firstSaturday: true, thirdSaturday: false };
      expect(isRecurringHoliday(thirdSat, config)).toBe(false);
    });

    it('should return false for all days when all config options are false', () => {
      const allFalseConfig = { sundays: false, firstSaturday: false, thirdSaturday: false };
      expect(isRecurringHoliday(new Date(2025, 0, 5), allFalseConfig)).toBe(false);
      expect(isRecurringHoliday(new Date(2025, 0, 4), allFalseConfig)).toBe(false);
      expect(isRecurringHoliday(new Date(2025, 0, 18), allFalseConfig)).toBe(false);
    });
  });

  describe('getRecurringHolidayLabel', () => {
    it('should return "Sunday" for Sundays', () => {
      const sunday = new Date(2025, 0, 5);
      expect(getRecurringHolidayLabel(sunday)).toBe('Sunday');
    });

    it('should return "1st Saturday" for 1st Saturdays', () => {
      const firstSat = new Date(2025, 0, 4);
      expect(getRecurringHolidayLabel(firstSat)).toBe('1st Saturday');
    });

    it('should return "3rd Saturday" for 3rd Saturdays', () => {
      const thirdSat = new Date(2025, 0, 18);
      expect(getRecurringHolidayLabel(thirdSat)).toBe('3rd Saturday');
    });

    it('should return null for non-recurring holidays', () => {
      const secondSat = new Date(2025, 0, 11);
      expect(getRecurringHolidayLabel(secondSat)).toBeNull();

      const monday = new Date(2025, 0, 6);
      expect(getRecurringHolidayLabel(monday)).toBeNull();
    });
  });

  describe('getRecurringHolidaysForMonth', () => {
    it('should return all recurring holidays for January 2025', () => {
      const holidays = getRecurringHolidaysForMonth(2025, 0);

      // January 2025:
      // 1st Saturday: Jan 4
      // Sundays: Jan 5, 12, 19, 26
      // 3rd Saturday: Jan 18
      // Total: 6 recurring holidays

      expect(holidays.length).toBe(6);

      // Verify dates
      const dateStrings = holidays.map((d) => d.toISOString().split('T')[0]);
      expect(dateStrings).toContain('2025-01-04'); // 1st Saturday
      expect(dateStrings).toContain('2025-01-05'); // Sunday
      expect(dateStrings).toContain('2025-01-12'); // Sunday
      expect(dateStrings).toContain('2025-01-18'); // 3rd Saturday
      expect(dateStrings).toContain('2025-01-19'); // Sunday
      expect(dateStrings).toContain('2025-01-26'); // Sunday
    });

    it('should handle February 2025 (28 days)', () => {
      const holidays = getRecurringHolidaysForMonth(2025, 1);
      expect(holidays.length).toBeGreaterThan(0);

      // February 2025:
      // 1st Saturday: Feb 1
      // Sundays: Feb 2, 9, 16, 23
      // 3rd Saturday: Feb 15
      // Total: 6 recurring holidays

      const dateStrings = holidays.map((d) => d.toISOString().split('T')[0]);
      expect(dateStrings).toContain('2025-02-01'); // 1st Saturday
      expect(dateStrings).toContain('2025-02-15'); // 3rd Saturday
    });

    it('should respect custom config', () => {
      const config = { sundays: false, firstSaturday: true, thirdSaturday: false };
      const holidays = getRecurringHolidaysForMonth(2025, 0, config);

      // Only 1st Saturday
      expect(holidays.length).toBe(1);
      expect(holidays[0]?.toISOString().split('T')[0]).toBe('2025-01-04');
    });

    it('should return empty array when all config options are false', () => {
      const config = { sundays: false, firstSaturday: false, thirdSaturday: false };
      const holidays = getRecurringHolidaysForMonth(2025, 0, config);
      expect(holidays).toEqual([]);
    });
  });

  describe('getRecurringHolidaysInRange', () => {
    it('should return recurring holidays in a date range', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 15);
      const holidays = getRecurringHolidaysInRange(startDate, endDate);

      // Jan 1-15, 2025:
      // 1st Saturday: Jan 4
      // Sundays: Jan 5, 12
      // Total: 3 recurring holidays

      expect(holidays.length).toBe(3);
    });

    it('should handle single day range', () => {
      const sunday = new Date(2025, 0, 5);
      const holidays = getRecurringHolidaysInRange(sunday, sunday);
      expect(holidays.length).toBe(1);
    });

    it('should handle range spanning multiple months', () => {
      const startDate = new Date(2025, 0, 25);
      const endDate = new Date(2025, 1, 5);
      const holidays = getRecurringHolidaysInRange(startDate, endDate);

      // Jan 25 - Feb 5, 2025:
      // Sundays: Jan 26, Feb 2
      // 1st Saturday: Feb 1
      // Total: 3 recurring holidays

      expect(holidays.length).toBe(3);
    });

    it('should respect custom config', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 31);
      const config = { sundays: true, firstSaturday: false, thirdSaturday: false };
      const holidays = getRecurringHolidaysInRange(startDate, endDate, config);

      // Only Sundays in January 2025: 5, 12, 19, 26
      expect(holidays.length).toBe(4);
    });
  });

  describe('countRecurringHolidaysInRange', () => {
    it('should count recurring holidays in a range', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 31);
      const count = countRecurringHolidaysInRange(startDate, endDate);

      // Same as getRecurringHolidaysForMonth test
      expect(count).toBe(6);
    });

    it('should return 0 for range with no recurring holidays', () => {
      // Monday to Friday range with no recurring holidays
      const startDate = new Date(2025, 0, 6);
      const endDate = new Date(2025, 0, 10);
      const count = countRecurringHolidaysInRange(startDate, endDate);
      expect(count).toBe(0);
    });

    it('should respect custom config', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 31);
      const config = { sundays: false, firstSaturday: false, thirdSaturday: false };
      const count = countRecurringHolidaysInRange(startDate, endDate, config);
      expect(count).toBe(0);
    });
  });

  describe('getSaturdaysInMonth', () => {
    it('should return all Saturdays with ordinals for January 2025', () => {
      const saturdays = getSaturdaysInMonth(2025, 0);

      expect(saturdays.length).toBe(4);
      expect(saturdays[0]).toEqual({
        date: new Date(2025, 0, 4),
        ordinal: 1,
        label: '1st Saturday',
      });
      expect(saturdays[1]).toEqual({
        date: new Date(2025, 0, 11),
        ordinal: 2,
        label: '2nd Saturday',
      });
      expect(saturdays[2]).toEqual({
        date: new Date(2025, 0, 18),
        ordinal: 3,
        label: '3rd Saturday',
      });
      expect(saturdays[3]).toEqual({
        date: new Date(2025, 0, 25),
        ordinal: 4,
        label: '4th Saturday',
      });
    });

    it('should handle months with 5 Saturdays', () => {
      // March 2025 has 5 Saturdays: 1, 8, 15, 22, 29
      const saturdays = getSaturdaysInMonth(2025, 2);

      expect(saturdays.length).toBe(5);
      expect(saturdays[4]?.label).toBe('5th Saturday');
    });

    it('should handle February (short month)', () => {
      // February 2025: Saturdays are 1, 8, 15, 22
      const saturdays = getSaturdaysInMonth(2025, 1);
      expect(saturdays.length).toBe(4);
    });
  });

  describe('DEFAULT_RECURRING_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RECURRING_CONFIG).toEqual({
        sundays: true,
        firstSaturday: true,
        thirdSaturday: true,
      });
    });
  });
});
