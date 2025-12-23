/**
 * Formatting utility functions
 *
 * Common formatters for dates, numbers, money, etc.
 */

import type { Money } from '@vapour/types';
import type { Timestamp } from 'firebase/firestore';

/**
 * Currency locale configuration
 * Maps currency codes to appropriate locales for formatting
 */
const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SAR: 'ar-SA',
  QAR: 'ar-QA',
  KWD: 'ar-KW',
  OMR: 'ar-OM',
  BHD: 'ar-BH',
};

/**
 * Format currency amount using Intl.NumberFormat
 *
 * Centralized currency formatting function that should be used
 * across all modules to ensure consistent formatting.
 *
 * @param amount - Numeric amount to format
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @param options - Additional formatting options
 * @returns Formatted currency string (e.g., "₹1,23,456.00" for INR)
 *
 * @example
 * formatCurrency(123456.78, 'INR')  // "₹1,23,456.78"
 * formatCurrency(123456.78, 'USD')  // "$123,456.78"
 * formatCurrency(123456.78, 'AED')  // "AED 123,456.78"
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const locale = CURRENCY_LOCALES[currency] || 'en-US';
  const minDigits = options?.minimumFractionDigits ?? 2;
  const maxDigits = options?.maximumFractionDigits ?? 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${currency} ${amount.toLocaleString(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    })}`;
  }
}

/**
 * Format money value from Money object
 *
 * @param money - Money object with amount and currency
 * @returns Formatted money string (e.g., "₹1,234.56")
 */
export function formatMoney(money: Money): string {
  return formatCurrency(money.amount, money.currency);
}

/**
 * Format dual currency amount for foreign transactions
 *
 * Shows foreign amount with INR equivalent in parentheses.
 * For INR transactions, returns single formatted amount.
 *
 * @param foreignAmount - Amount in foreign currency
 * @param foreignCurrency - Currency code (e.g., 'USD')
 * @param baseAmount - Amount in base currency (INR)
 * @param baseCurrency - Base currency code (default: 'INR')
 * @returns Formatted string like "$1,000.00 (₹83,250.00)"
 *
 * @example
 * formatDualCurrency(1000, 'USD', 83250)  // "$1,000.00 (₹83,250.00)"
 * formatDualCurrency(1000, 'INR', 1000)   // "₹1,000.00"
 */
export function formatDualCurrency(
  foreignAmount: number,
  foreignCurrency: string,
  baseAmount: number,
  baseCurrency: string = 'INR'
): string {
  // If already in base currency, return single format
  if (foreignCurrency === baseCurrency) {
    return formatCurrency(foreignAmount, baseCurrency);
  }

  const formattedForeign = formatCurrency(foreignAmount, foreignCurrency);
  const formattedBase = formatCurrency(baseAmount, baseCurrency);
  return `${formattedForeign} (${formattedBase})`;
}

/**
 * Format exchange rate for display
 *
 * @param rate - Exchange rate value (e.g., 83.25 for 1 USD = 83.25 INR)
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code (default: 'INR')
 * @param format - 'short' for "@83.25", 'long' for "1 USD = ₹83.25"
 * @returns Formatted exchange rate string
 *
 * @example
 * formatExchangeRate(83.25, 'USD')                // "@83.25"
 * formatExchangeRate(83.25, 'USD', 'INR', 'long') // "1 USD = ₹83.25"
 */
export function formatExchangeRate(
  rate: number,
  fromCurrency: string,
  toCurrency: string = 'INR',
  format: 'short' | 'long' = 'short'
): string {
  if (format === 'short') {
    return `@${rate.toFixed(2)}`;
  }
  return `1 ${fromCurrency} = ${formatCurrency(rate, toCurrency)}`;
}

/**
 * Format date from Firestore Timestamp
 *
 * @param timestamp - Firestore Timestamp or Date or string or object with toDate method
 * @param format - Format type ('short', 'long', 'datetime')
 * @returns Formatted date string in DD-MMM-YYYY format
 */
export function formatDate(
  timestamp: Timestamp | Date | string | { toDate: () => Date } | undefined | null,
  format: 'short' | 'long' | 'datetime' = 'short'
): string {
  if (!timestamp) return '-';

  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp) {
    date = timestamp.toDate();
  } else {
    return '-';
  }

  // Check for invalid date
  if (isNaN(date.getTime())) return '-';

  const day = date.getDate().toString().padStart(2, '0');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  if (format === 'short') {
    // DD-MMM-YYYY (e.g., 26-Nov-2025)
    return `${day}-${month}-${year}`;
  }

  if (format === 'long') {
    // DD Month YYYY (e.g., 26 November 2025)
    const longMonths = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${date.getDate()} ${longMonths[date.getMonth()]} ${year}`;
  }

  if (format === 'datetime') {
    // DD-MMM-YYYY HH:MM (e.g., 26-Nov-2025 14:30)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  return `${day}-${month}-${year}`;
}

/**
 * Format number with commas
 *
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 *
 * @param value - Decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "15.0%")
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format file size
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format phone number (Indian format)
 *
 * @param phone - Phone number string
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as +91 XXXXX XXXXX
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  // Format as +XX XXXXX XXXXX
  if (cleaned.length > 10) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const number = cleaned.slice(-10);
    return `+${countryCode} ${number.slice(0, 5)} ${number.slice(5)}`;
  }

  return phone;
}

/**
 * Format duration in milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Truncate text to specified length
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Format weight (kg to tons if > 1000 kg)
 *
 * @param kg - Weight in kilograms
 * @returns Formatted weight string
 */
export function formatWeight(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(2)} tons`;
  }
  return `${kg.toFixed(2)} kg`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 *
 * @param timestamp - Firestore Timestamp or Date
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: Timestamp | Date): string {
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

// =============================================================================
// Currency Precision Utilities
// =============================================================================

/**
 * Currency precision configuration
 * Most currencies use 2 decimal places, but some (BHD, KWD, OMR) use 3
 */
const CURRENCY_PRECISION: Record<string, number> = {
  BHD: 3, // Bahraini Dinar
  KWD: 3, // Kuwaiti Dinar
  OMR: 3, // Omani Rial
  // All other currencies default to 2 decimal places
};

/**
 * Get the number of decimal places for a currency
 *
 * @param currency - ISO 4217 currency code
 * @returns Number of decimal places (2 or 3)
 */
export function getCurrencyPrecision(currency: string = 'INR'): number {
  return CURRENCY_PRECISION[currency] ?? 2;
}

/**
 * Round a monetary amount to the appropriate precision for its currency
 *
 * Uses proper rounding (not truncation) to avoid accumulating errors.
 * This is the canonical way to round currency amounts in this codebase.
 *
 * @param amount - Numeric amount to round
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @returns Properly rounded amount
 *
 * @example
 * roundCurrency(123.456)         // 123.46 (INR default, 2 decimals)
 * roundCurrency(123.456, 'USD')  // 123.46 (USD, 2 decimals)
 * roundCurrency(123.4567, 'KWD') // 123.457 (KWD, 3 decimals)
 */
export function roundCurrency(amount: number, currency: string = 'INR'): number {
  const precision = getCurrencyPrecision(currency);
  const multiplier = Math.pow(10, precision);
  return Math.round(amount * multiplier) / multiplier;
}

/**
 * Compare two currency amounts for equality with floating-point tolerance
 *
 * Compares amounts after rounding to appropriate currency precision.
 * This avoids false negatives from floating-point arithmetic.
 *
 * @param a - First amount
 * @param b - Second amount
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @returns true if amounts are equal within currency precision
 *
 * @example
 * currencyEquals(100.001, 100.002)  // true (difference < 0.01)
 * currencyEquals(100.01, 100.02)    // false (difference >= 0.01)
 */
export function currencyEquals(a: number, b: number, currency: string = 'INR'): boolean {
  const precision = getCurrencyPrecision(currency);
  const tolerance = Math.pow(10, -precision) / 2; // Half of smallest unit
  return Math.abs(a - b) < tolerance;
}

/**
 * Check if an amount is effectively zero for a given currency
 *
 * @param amount - Amount to check
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @returns true if amount rounds to zero
 */
export function isZeroCurrency(amount: number, currency: string = 'INR'): boolean {
  return currencyEquals(amount, 0, currency);
}

/**
 * Calculate the difference between two currency amounts
 *
 * Returns the difference rounded to the appropriate currency precision.
 *
 * @param a - First amount
 * @param b - Second amount
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @returns Rounded difference (a - b)
 */
export function currencyDifference(a: number, b: number, currency: string = 'INR'): number {
  return roundCurrency(a - b, currency);
}

/**
 * Sum multiple currency amounts with proper precision handling
 *
 * Rounds the final result to avoid accumulating floating-point errors.
 *
 * @param amounts - Array of amounts to sum
 * @param currency - ISO 4217 currency code (default: 'INR')
 * @returns Rounded sum
 */
export function currencySum(amounts: number[], currency: string = 'INR'): number {
  const sum = amounts.reduce((acc, amount) => acc + amount, 0);
  return roundCurrency(sum, currency);
}
