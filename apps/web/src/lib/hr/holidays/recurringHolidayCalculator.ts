/**
 * Recurring Holiday Calculator
 *
 * Utility functions to calculate recurring holidays:
 * - All Sundays
 * - 1st Saturday of each month (day 1-7)
 * - 3rd Saturday of each month (day 15-21)
 */

import type { RecurringHolidayConfig } from '@vapour/types';

/**
 * Default recurring holiday configuration
 * All Sundays + 1st & 3rd Saturdays are holidays
 */
export const DEFAULT_RECURRING_CONFIG: RecurringHolidayConfig = {
  sundays: true,
  firstSaturday: true,
  thirdSaturday: true,
};

/**
 * Check if a date is a Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Check if a date is the 1st Saturday of the month
 * 1st Saturday falls between day 1-7
 */
export function isFirstSaturday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  return dayOfWeek === 6 && dayOfMonth <= 7;
}

/**
 * Check if a date is the 3rd Saturday of the month
 * 3rd Saturday falls between day 15-21
 */
export function isThirdSaturday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  return dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21;
}

/**
 * Check if a date is the 2nd Saturday of the month
 * 2nd Saturday falls between day 8-14
 */
export function isSecondSaturday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  return dayOfWeek === 6 && dayOfMonth >= 8 && dayOfMonth <= 14;
}

/**
 * Check if a date is the 4th Saturday of the month
 * 4th Saturday falls between day 22-28
 */
export function isFourthSaturday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  return dayOfWeek === 6 && dayOfMonth >= 22 && dayOfMonth <= 28;
}

/**
 * Check if a date is a recurring holiday based on configuration
 */
export function isRecurringHoliday(
  date: Date,
  config: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): boolean {
  if (config.sundays && isSunday(date)) {
    return true;
  }

  if (config.firstSaturday && isFirstSaturday(date)) {
    return true;
  }

  if (config.thirdSaturday && isThirdSaturday(date)) {
    return true;
  }

  return false;
}

/**
 * Get the name/label for a recurring holiday
 */
export function getRecurringHolidayLabel(date: Date): string | null {
  if (isSunday(date)) {
    return 'Sunday';
  }
  if (isFirstSaturday(date)) {
    return '1st Saturday';
  }
  if (isThirdSaturday(date)) {
    return '3rd Saturday';
  }
  return null;
}

/**
 * Get all recurring holidays for a specific month
 */
export function getRecurringHolidaysForMonth(
  year: number,
  month: number, // 0-indexed (0 = January)
  config: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Date[] {
  const holidays: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (isRecurringHoliday(date, config)) {
      holidays.push(date);
    }
  }

  return holidays;
}

/**
 * Get all recurring holidays for a date range
 */
export function getRecurringHolidaysInRange(
  startDate: Date,
  endDate: Date,
  config: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Date[] {
  const holidays: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    if (isRecurringHoliday(current, config)) {
      holidays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return holidays;
}

/**
 * Count recurring holidays in a date range
 */
export function countRecurringHolidaysInRange(
  startDate: Date,
  endDate: Date,
  config: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): number {
  return getRecurringHolidaysInRange(startDate, endDate, config).length;
}

/**
 * Get all Saturdays in a month with their type (1st, 2nd, 3rd, 4th, 5th)
 */
export function getSaturdaysInMonth(
  year: number,
  month: number
): Array<{ date: Date; ordinal: number; label: string }> {
  const saturdays: Array<{ date: Date; ordinal: number; label: string }> = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let saturdayCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 6) {
      saturdayCount++;
      const ordinalLabels = ['1st', '2nd', '3rd', '4th', '5th'];
      saturdays.push({
        date,
        ordinal: saturdayCount,
        label: `${ordinalLabels[saturdayCount - 1]} Saturday`,
      });
    }
  }

  return saturdays;
}
