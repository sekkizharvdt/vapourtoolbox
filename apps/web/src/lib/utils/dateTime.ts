/**
 * Date and Time Utilities
 *
 * Standardizes date/time handling across the codebase to prevent timezone-related bugs.
 *
 * Key Principles:
 * 1. Store dates in UTC (Firestore Timestamp)
 * 2. Convert to local timezone only for display
 * 3. Use start/end of day functions for date range queries
 * 4. Always consider the business timezone (IST for this application)
 *
 * @example
 * ```typescript
 * // Creating a date for storage
 * const startOfToday = getStartOfDay(new Date(), 'Asia/Kolkata');
 *
 * // Comparing dates (ignoring time)
 * if (isSameDay(date1, date2, 'Asia/Kolkata')) {
 *   // Same calendar day in IST
 * }
 *
 * // Format for display
 * const displayDate = formatDateForDisplay(timestamp, 'Asia/Kolkata');
 * ```
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Default business timezone for the application (India Standard Time)
 */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Get the start of day (00:00:00.000) in a specific timezone
 *
 * @param date - The date to get start of day for
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Date object representing start of day in UTC
 */
export function getStartOfDay(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  // Format the date in the target timezone to get local date parts
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.format(date).split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1; // JS months are 0-indexed
  const day = parseInt(parts[2]!, 10);

  // Create a date string in the target timezone at midnight
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;

  // Parse it in the target timezone by creating a date and adjusting
  const localDate = new Date(dateStr);
  const targetOffset = getTimezoneOffset(new Date(year, month, day), timezone);
  return new Date(localDate.getTime() - targetOffset);
}

/**
 * Get the end of day (23:59:59.999) in a specific timezone
 *
 * @param date - The date to get end of day for
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Date object representing end of day in UTC
 */
export function getEndOfDay(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  const startOfDay = getStartOfDay(date, timezone);
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Get timezone offset in milliseconds for a date in a specific timezone
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Check if two dates are on the same calendar day in a specific timezone
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns true if same calendar day
 */
export function isSameDay(
  date1: Date | Timestamp,
  date2: Date | Timestamp,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const d1 = date1 instanceof Timestamp ? date1.toDate() : date1;
  const d2 = date2 instanceof Timestamp ? date2.toDate() : date2;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(d1) === formatter.format(d2);
}

/**
 * Check if a date is today in a specific timezone
 *
 * @param date - The date to check
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns true if the date is today
 */
export function isToday(date: Date | Timestamp, timezone: string = DEFAULT_TIMEZONE): boolean {
  return isSameDay(date, new Date(), timezone);
}

/**
 * Get the current date in a specific timezone (date only, no time)
 *
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Get the current fiscal year based on Indian fiscal year (April to March)
 *
 * @param date - Date to get fiscal year for (defaults to today)
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Fiscal year start year (e.g., 2024 for FY 2024-25)
 */
export function getFiscalYear(
  date: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);

  // Indian fiscal year runs April (4) to March (3)
  // If month is Jan-March, fiscal year started previous calendar year
  return month >= 4 ? year : year - 1;
}

/**
 * Get fiscal year date range
 *
 * @param fiscalYear - Fiscal year start year (e.g., 2024 for FY 2024-25)
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Object with start and end dates
 */
export function getFiscalYearRange(
  fiscalYear: number,
  timezone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  // Fiscal year starts April 1st
  const startDate = new Date(fiscalYear, 3, 1); // Month is 0-indexed
  const start = getStartOfDay(startDate, timezone);

  // Fiscal year ends March 31st
  const endDate = new Date(fiscalYear + 1, 2, 31);
  const end = getEndOfDay(endDate, timezone);

  return { start, end };
}

/**
 * Format a date/timestamp for display in a specific timezone
 *
 * @param date - Date or Firestore Timestamp
 * @param timezone - IANA timezone string (defaults to IST)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  date: Date | Timestamp | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  if (!date) return '';

  const d = date instanceof Timestamp ? date.toDate() : date;

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    ...options,
  }).format(d);
}

/**
 * Format a date/timestamp with time for display
 *
 * @param date - Date or Firestore Timestamp
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Formatted date-time string
 */
export function formatDateTimeForDisplay(
  date: Date | Timestamp | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatDateForDisplay(date, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Create a Firestore Timestamp from a date string in a specific timezone
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Firestore Timestamp
 */
export function createTimestampFromDateString(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE
): Timestamp {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  const startOfDay = getStartOfDay(date, timezone);
  return Timestamp.fromDate(startOfDay);
}

/**
 * Get date parts in a specific timezone
 *
 * @param date - Date or Timestamp
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns Object with year, month, day
 */
export function getDateParts(
  date: Date | Timestamp,
  timezone: string = DEFAULT_TIMEZONE
): { year: number; month: number; day: number } {
  const d = date instanceof Timestamp ? date.toDate() : date;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(d);
  return {
    year: parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10),
    month: parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10),
    day: parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10),
  };
}

/**
 * Add days to a date
 *
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object
 */
export function addDays(date: Date | Timestamp, days: number): Date {
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add months to a date
 *
 * @param date - Starting date
 * @param months - Number of months to add (can be negative)
 * @returns New Date object
 */
export function addMonths(date: Date | Timestamp, months: number): Date {
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Get the difference in days between two dates
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days (positive if date1 > date2)
 */
export function getDaysDifference(date1: Date | Timestamp, date2: Date | Timestamp): number {
  const d1 = date1 instanceof Timestamp ? date1.toDate() : date1;
  const d2 = date2 instanceof Timestamp ? date2.toDate() : date2;

  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past (before today)
 *
 * @param date - Date to check
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns true if the date is before today
 */
export function isPast(date: Date | Timestamp, timezone: string = DEFAULT_TIMEZONE): boolean {
  const d = date instanceof Timestamp ? date.toDate() : date;
  const startOfToday = getStartOfDay(new Date(), timezone);
  return d < startOfToday;
}

/**
 * Check if a date is in the future (after today)
 *
 * @param date - Date to check
 * @param timezone - IANA timezone string (defaults to IST)
 * @returns true if the date is after today
 */
export function isFuture(date: Date | Timestamp, timezone: string = DEFAULT_TIMEZONE): boolean {
  const d = date instanceof Timestamp ? date.toDate() : date;
  const endOfToday = getEndOfDay(new Date(), timezone);
  return d > endOfToday;
}

/**
 * Get month name from month number (1-12)
 */
export function getMonthName(month: number, short: boolean = false): string {
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleString('en-IN', { month: short ? 'short' : 'long' });
}

/**
 * Get quarter from month (1-4)
 */
export function getQuarter(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * Get fiscal quarter (Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar)
 */
export function getFiscalQuarter(month: number): number {
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4; // Jan-Mar
}
