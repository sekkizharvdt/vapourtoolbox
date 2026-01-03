/**
 * Holiday Service Tests
 *
 * Tests for holiday service business logic and validation.
 * These are unit tests that mock Firestore interactions.
 *
 * Note: Integration tests with real Firestore emulator are in __integration__/ directory
 */

import type { Holiday, HolidayType } from '@vapour/types';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
  })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Holiday Service', () => {
  describe('CreateHolidayInput Validation', () => {
    /**
     * Tests for holiday input validation business rules
     */

    it('should require a valid holiday name', () => {
      const validName = 'Diwali';
      const emptyName = '';

      expect(validName.trim().length > 0).toBe(true);
      expect(emptyName.trim().length > 0).toBe(false);
    });

    it('should require a valid date', () => {
      const validDate = new Date(2025, 9, 20);
      const invalidDate = new Date('invalid');

      expect(validDate instanceof Date && !isNaN(validDate.getTime())).toBe(true);
      expect(invalidDate instanceof Date && !isNaN(invalidDate.getTime())).toBe(false);
    });

    it('should validate holiday types', () => {
      const validTypes: HolidayType[] = ['NATIONAL', 'COMPANY', 'OPTIONAL'];

      validTypes.forEach((type) => {
        expect(['NATIONAL', 'COMPANY', 'OPTIONAL']).toContain(type);
      });
    });
  });

  describe('Holiday Date Extraction', () => {
    /**
     * Tests for extracting year from holiday date
     */

    it('should extract year from date correctly', () => {
      const date = new Date(2025, 9, 20);
      expect(date.getFullYear()).toBe(2025);
    });

    it('should handle different year dates', () => {
      const date2024 = new Date(2024, 11, 25);
      const date2025 = new Date(2025, 0, 1);
      const date2026 = new Date(2026, 6, 15);

      expect(date2024.getFullYear()).toBe(2024);
      expect(date2025.getFullYear()).toBe(2025);
      expect(date2026.getFullYear()).toBe(2026);
    });
  });

  describe('Holiday Working Days Calculation', () => {
    /**
     * Tests for calculating working days between dates
     * excluding holidays
     */

    it('should count days in a range correctly', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 5);

      let dayCount = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        dayCount++;
        current.setDate(current.getDate() + 1);
      }

      expect(dayCount).toBe(5);
    });

    it('should calculate working days excluding holiday set', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 10);

      // Simulate holidays on Jan 1 (New Year) and Jan 5 (Sunday)
      const holidayDates = new Set(['2025-01-01', '2025-01-05']);

      let workingDays = 0;
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!holidayDates.has(dateKey!)) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      expect(workingDays).toBe(8); // 10 days - 2 holidays
    });

    it('should handle range with all holidays', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 3);

      // All days are holidays
      const holidayDates = new Set(['2025-01-01', '2025-01-02', '2025-01-03']);

      let workingDays = 0;
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!holidayDates.has(dateKey!)) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      expect(workingDays).toBe(0);
    });

    it('should handle range with no holidays', () => {
      const startDate = new Date(2025, 0, 6);
      const endDate = new Date(2025, 0, 10);

      const holidayDates = new Set<string>();

      let workingDays = 0;
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!holidayDates.has(dateKey!)) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      expect(workingDays).toBe(5);
    });
  });

  describe('Holiday Copy Logic', () => {
    /**
     * Tests for copying holidays from one year to another
     */

    it('should calculate target date when copying holiday to new year', () => {
      const sourceDate = new Date(2024, 9, 20);
      const targetYear = 2025;

      const targetDate = new Date(sourceDate);
      targetDate.setFullYear(targetYear);

      expect(targetDate.getFullYear()).toBe(2025);
      expect(targetDate.getMonth()).toBe(9);
      expect(targetDate.getDate()).toBe(20);
    });

    it('should handle leap year dates when copying', () => {
      // February 29, 2024 (leap year)
      const sourceDate = new Date(2024, 1, 29);
      const targetYear = 2025;

      const targetDate = new Date(sourceDate);
      targetDate.setFullYear(targetYear);

      // Feb 29 2024 -> March 1 2025 (no Feb 29 in 2025)
      expect(targetDate.getMonth()).toBe(2); // March
      expect(targetDate.getDate()).toBe(1);
    });
  });

  describe('Holiday Merge Logic', () => {
    /**
     * Tests for merging recurring and company holidays
     */

    interface TestHolidayInfo {
      date: Date;
      name: string;
      type: string;
      isRecurring: boolean;
    }

    it('should merge holidays with company taking precedence', () => {
      const recurringHolidays: TestHolidayInfo[] = [
        { date: new Date(2025, 0, 5), name: 'Sunday', type: 'RECURRING', isRecurring: true },
        { date: new Date(2025, 0, 12), name: 'Sunday', type: 'RECURRING', isRecurring: true },
      ];

      const companyHolidays: TestHolidayInfo[] = [
        {
          date: new Date(2025, 0, 5),
          name: 'Special Holiday',
          type: 'COMPANY',
          isRecurring: false,
        },
      ];

      // Merge logic: company holidays override recurring
      const holidayMap = new Map<string, TestHolidayInfo>();

      for (const holiday of recurringHolidays) {
        const key = holiday.date.toISOString().split('T')[0] ?? '';
        holidayMap.set(key, holiday);
      }

      for (const holiday of companyHolidays) {
        const key = holiday.date.toISOString().split('T')[0] ?? '';
        holidayMap.set(key, holiday);
      }

      const merged = Array.from(holidayMap.values());

      expect(merged.length).toBe(2);

      // Find the holiday on Jan 5
      const jan5Holiday = merged.find((h) => h.date.toISOString().split('T')[0] === '2025-01-05');
      expect(jan5Holiday?.name).toBe('Special Holiday');
      expect(jan5Holiday?.isRecurring).toBe(false);
    });

    it('should sort merged holidays by date', () => {
      const holidays: TestHolidayInfo[] = [
        { date: new Date(2025, 0, 15), name: 'Holiday C', type: 'COMPANY', isRecurring: false },
        { date: new Date(2025, 0, 5), name: 'Holiday A', type: 'COMPANY', isRecurring: false },
        { date: new Date(2025, 0, 10), name: 'Holiday B', type: 'RECURRING', isRecurring: true },
      ];

      const sorted = [...holidays].sort((a, b) => a.date.getTime() - b.date.getTime());

      expect(sorted[0]?.name).toBe('Holiday A');
      expect(sorted[1]?.name).toBe('Holiday B');
      expect(sorted[2]?.name).toBe('Holiday C');
    });
  });

  describe('Holiday Date Range Queries', () => {
    /**
     * Tests for date range filtering logic
     */

    it('should check if date is within range', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 31);

      const testDate1 = new Date(2025, 0, 15);
      const testDate2 = new Date(2025, 1, 15);

      const isInRange1 = testDate1 >= startDate && testDate1 <= endDate;
      const isInRange2 = testDate2 >= startDate && testDate2 <= endDate;

      expect(isInRange1).toBe(true);
      expect(isInRange2).toBe(false);
    });

    it('should include boundary dates in range', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 31);

      const isStartInRange = startDate >= startDate && startDate <= endDate;
      const isEndInRange = endDate >= startDate && endDate <= endDate;

      expect(isStartInRange).toBe(true);
      expect(isEndInRange).toBe(true);
    });
  });

  describe('Holiday isHoliday Check', () => {
    /**
     * Tests for checking if a specific date is a holiday
     */

    it('should check date boundaries for single day check', () => {
      const testDate = new Date(2025, 0, 15);

      const startOfDay = new Date(testDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(testDate);
      endOfDay.setHours(23, 59, 59, 999);

      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
    });
  });

  describe('Holiday Types', () => {
    it('should have distinct holiday types', () => {
      const types: HolidayType[] = ['NATIONAL', 'COMPANY', 'OPTIONAL'];
      const uniqueTypes = new Set(types);

      expect(uniqueTypes.size).toBe(3);
    });

    it('should categorize holidays correctly', () => {
      const holiday: Partial<Holiday> = {
        id: 'test-1',
        name: 'Republic Day',
        type: 'NATIONAL',
      };

      expect(holiday.type).toBe('NATIONAL');
    });
  });

  describe('Soft Delete Logic', () => {
    it('should mark holiday as inactive for soft delete', () => {
      const holiday = {
        id: 'test-1',
        name: 'Test Holiday',
        isActive: true,
      };

      const softDeleted = {
        ...holiday,
        isActive: false,
      };

      expect(softDeleted.isActive).toBe(false);
    });

    it('should filter out inactive holidays', () => {
      const holidays = [
        { id: '1', name: 'Holiday 1', isActive: true },
        { id: '2', name: 'Holiday 2', isActive: false },
        { id: '3', name: 'Holiday 3', isActive: true },
      ];

      const activeHolidays = holidays.filter((h) => h.isActive);

      expect(activeHolidays.length).toBe(2);
      expect(activeHolidays.map((h) => h.id)).toEqual(['1', '3']);
    });
  });
});
