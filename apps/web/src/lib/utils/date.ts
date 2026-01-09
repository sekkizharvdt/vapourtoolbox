/**
 * Date utility functions
 *
 * Provides consistent date handling throughout the application.
 * All functions are designed to work with both Date objects and Firestore Timestamps.
 */

import { Timestamp } from 'firebase/firestore';

/** Milliseconds in one day */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Milliseconds in one hour */
export const MS_PER_HOUR = 1000 * 60 * 60;

/** Milliseconds in one minute */
export const MS_PER_MINUTE = 1000 * 60;

/**
 * Get today's date as a string in YYYY-MM-DD format.
 * Useful for HTML date inputs.
 *
 * @returns Today's date in YYYY-MM-DD format
 *
 * @example
 * getTodayDateString() // "2024-01-15"
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0] || '';
}

/**
 * Get a date string in YYYY-MM-DD format from a Date object.
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * toDateString(new Date(2024, 0, 15)) // "2024-01-15"
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}

/**
 * Parse a YYYY-MM-DD date string to a Date object.
 * Sets time to midnight in local timezone.
 *
 * @param dateString - The date string to parse
 * @returns A Date object, or null if parsing fails
 *
 * @example
 * fromDateString("2024-01-15") // Date object for Jan 15, 2024 00:00:00
 */
export function fromDateString(dateString: string): Date | null {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  // Validate the date is valid
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Calculate the difference between two dates in days.
 *
 * @param start - Start date
 * @param end - End date
 * @returns Number of days between the dates (can be negative if end < start)
 *
 * @example
 * daysBetween(new Date('2024-01-01'), new Date('2024-01-10')) // 9
 */
export function daysBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

/**
 * Check if a date is today.
 *
 * @param date - The date to check
 * @returns True if the date is today
 *
 * @example
 * isToday(new Date()) // true
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past (before today).
 *
 * @param date - The date to check
 * @returns True if the date is before today
 *
 * @example
 * isPast(new Date('2020-01-01')) // true
 */
export function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date is in the future (after today).
 *
 * @param date - The date to check
 * @returns True if the date is after today
 *
 * @example
 * isFuture(new Date('2030-01-01')) // true
 */
export function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}

/**
 * Get the start of today (midnight).
 *
 * @returns Date object set to midnight today
 */
export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get the end of today (23:59:59.999).
 *
 * @returns Date object set to end of today
 */
export function endOfToday(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * Get the start of a given date (midnight).
 *
 * @param date - The date to get the start of
 * @returns New Date object set to midnight of that day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of a given date (23:59:59.999).
 *
 * @param date - The date to get the end of
 * @returns New Date object set to end of that day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Add days to a date.
 *
 * @param date - The starting date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object with days added
 *
 * @example
 * addDays(new Date('2024-01-01'), 7) // Jan 8, 2024
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date.
 *
 * @param date - The starting date
 * @param months - Number of months to add (can be negative)
 * @returns New Date object with months added
 *
 * @example
 * addMonths(new Date('2024-01-15'), 1) // Feb 15, 2024
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Convert a Firestore Timestamp or Date to a Date object.
 * Safely handles both types.
 *
 * @param value - Firestore Timestamp, Date, or undefined
 * @returns Date object, or undefined if input is undefined
 *
 * @example
 * toDate(firestoreTimestamp) // Date object
 * toDate(new Date()) // Same Date object
 */
export function toDate(value: Timestamp | Date | undefined | null): Date | undefined {
  if (!value) return undefined;

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  // Handle plain objects with seconds/nanoseconds (Firestore serialized)
  if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    return new Timestamp(
      (value as { seconds: number }).seconds,
      (value as { nanoseconds: number }).nanoseconds
    ).toDate();
  }

  return undefined;
}

/**
 * Convert a Date to a Firestore Timestamp.
 *
 * @param date - The Date to convert
 * @returns Firestore Timestamp, or undefined if input is undefined
 *
 * @example
 * toTimestamp(new Date()) // Firestore Timestamp
 */
export function toTimestamp(date: Date | undefined | null): Timestamp | undefined {
  if (!date) return undefined;
  return Timestamp.fromDate(date);
}

/**
 * Format a date in Indian format (DD/MM/YYYY).
 *
 * @param date - The date to format
 * @returns Formatted string like "15/01/2024"
 *
 * @example
 * formatDateIndian(new Date(2024, 0, 15)) // "15/01/2024"
 */
export function formatDateIndian(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a date in ISO format (YYYY-MM-DD).
 *
 * @param date - The date to format
 * @returns Formatted string like "2024-01-15"
 *
 * @example
 * formatDateISO(new Date(2024, 0, 15)) // "2024-01-15"
 */
export function formatDateISO(date: Date): string {
  return toDateString(date);
}

/**
 * Get the financial year for a given date.
 * Indian financial year runs from April 1 to March 31.
 *
 * @param date - The date to get the FY for
 * @returns Financial year string like "FY 2024-25"
 *
 * @example
 * getFinancialYear(new Date('2024-05-15')) // "FY 2024-25"
 * getFinancialYear(new Date('2024-02-15')) // "FY 2023-24"
 */
export function getFinancialYear(date: Date): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // April (3) onwards is the new FY
  if (month >= 3) {
    return `FY ${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `FY ${year - 1}-${year.toString().slice(-2)}`;
  }
}

/**
 * Get the start date of a financial year.
 *
 * @param fy - Financial year string like "FY 2024-25" or just the starting year like 2024
 * @returns April 1 of that financial year
 *
 * @example
 * getFYStartDate("FY 2024-25") // April 1, 2024
 * getFYStartDate(2024) // April 1, 2024
 */
export function getFYStartDate(fy: string | number): Date {
  let startYear: number;

  if (typeof fy === 'number') {
    startYear = fy;
  } else {
    // Extract year from "FY 2024-25" format
    const match = fy.match(/(\d{4})/);
    startYear = match?.[1] ? parseInt(match[1], 10) : new Date().getFullYear();
  }

  return new Date(startYear, 3, 1); // April 1
}

/**
 * Get the end date of a financial year.
 *
 * @param fy - Financial year string like "FY 2024-25" or just the starting year like 2024
 * @returns March 31 of the following calendar year
 *
 * @example
 * getFYEndDate("FY 2024-25") // March 31, 2025
 * getFYEndDate(2024) // March 31, 2025
 */
export function getFYEndDate(fy: string | number): Date {
  let startYear: number;

  if (typeof fy === 'number') {
    startYear = fy;
  } else {
    const match = fy.match(/(\d{4})/);
    startYear = match?.[1] ? parseInt(match[1], 10) : new Date().getFullYear();
  }

  return new Date(startYear + 1, 2, 31); // March 31 of next year
}
