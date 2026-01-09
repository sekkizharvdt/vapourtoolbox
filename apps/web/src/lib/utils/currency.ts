/**
 * Currency formatting utilities for Indian Rupees
 *
 * Provides consistent formatting for currency values throughout the application.
 * Uses the Indian numbering system (lakhs, crores).
 */

/** 1 Lakh = 100,000 */
export const LAKH = 100_000;

/** 1 Crore = 10,000,000 */
export const CRORE = 10_000_000;

/**
 * Format a number as Indian Rupees with proper comma separation.
 *
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted string like "₹1,23,456.78"
 *
 * @example
 * formatINR(1234567.89) // "₹12,34,567.89"
 * formatINR(1234567.89, { showSymbol: false }) // "12,34,567.89"
 */
export function formatINR(
  amount: number,
  options: {
    /** Whether to include the ₹ symbol. Default: true */
    showSymbol?: boolean;
    /** Number of decimal places. Default: 2 */
    decimals?: number;
    /** Whether to show decimals for whole numbers. Default: true */
    showDecimalsForWholeNumbers?: boolean;
  } = {}
): string {
  const { showSymbol = true, decimals = 2, showDecimalsForWholeNumbers = true } = options;

  // Handle NaN and undefined
  if (isNaN(amount) || amount === undefined || amount === null) {
    return showSymbol ? '₹0.00' : '0.00';
  }

  // Determine if we should show decimals
  const isWholeNumber = amount % 1 === 0;
  const actualDecimals = isWholeNumber && !showDecimalsForWholeNumbers ? 0 : decimals;

  // Format using Indian locale
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: actualDecimals,
    maximumFractionDigits: actualDecimals,
  });

  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Format a large amount in lakhs or crores for compact display.
 *
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted string like "1.23 Cr" or "45.67 L"
 *
 * @example
 * formatIndianCompact(12345678) // "1.23 Cr"
 * formatIndianCompact(123456) // "1.23 L"
 * formatIndianCompact(12345) // "₹12,345" (falls back to regular format)
 */
export function formatIndianCompact(
  amount: number,
  options: {
    /** Minimum value to show in compact form. Default: LAKH (100,000) */
    minCompact?: number;
    /** Number of decimal places for compact form. Default: 2 */
    decimals?: number;
    /** Whether to include the ₹ symbol for non-compact amounts. Default: true */
    showSymbol?: boolean;
  } = {}
): string {
  const { minCompact = LAKH, decimals = 2, showSymbol = true } = options;

  // Handle NaN and undefined
  if (isNaN(amount) || amount === undefined || amount === null) {
    return showSymbol ? '₹0' : '0';
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= CRORE) {
    return `${sign}${(absAmount / CRORE).toFixed(decimals)} Cr`;
  }

  if (absAmount >= minCompact) {
    return `${sign}${(absAmount / LAKH).toFixed(decimals)} L`;
  }

  // Fall back to regular formatting for smaller amounts
  return formatINR(amount, { showSymbol, decimals: 0, showDecimalsForWholeNumbers: false });
}

/**
 * Parse a formatted Indian currency string back to a number.
 *
 * @param value - The formatted string to parse
 * @returns The numeric value, or NaN if parsing fails
 *
 * @example
 * parseINR("₹12,34,567.89") // 1234567.89
 * parseINR("1.5 Cr") // 15000000
 * parseINR("2.5 L") // 250000
 */
export function parseINR(value: string): number {
  if (!value || typeof value !== 'string') {
    return NaN;
  }

  // Remove currency symbol and spaces
  let cleaned = value.replace(/₹/g, '').trim();

  // Handle Crore notation
  if (cleaned.toLowerCase().endsWith('cr')) {
    const numPart = parseFloat(cleaned.replace(/cr/gi, '').trim());
    return numPart * CRORE;
  }

  // Handle Lakh notation
  if (cleaned.toLowerCase().endsWith('l')) {
    const numPart = parseFloat(cleaned.replace(/l/gi, '').trim());
    return numPart * LAKH;
  }

  // Remove commas and parse
  cleaned = cleaned.replace(/,/g, '');
  return parseFloat(cleaned);
}

/**
 * Format amount with currency code (for multi-currency support).
 *
 * @param amount - The amount to format
 * @param currencyCode - ISO 4217 currency code (e.g., 'INR', 'USD', 'EUR')
 * @returns Formatted string with currency
 *
 * @example
 * formatCurrency(1234.56, 'USD') // "$1,234.56"
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 * formatCurrency(1234.56, 'INR') // "₹1,234.56"
 */
export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  if (isNaN(amount) || amount === undefined || amount === null) {
    amount = 0;
  }

  try {
    // Use 'en-IN' for INR to get proper Indian number formatting
    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Get the currency symbol for a given currency code.
 *
 * @param currencyCode - ISO 4217 currency code
 * @returns The currency symbol
 *
 * @example
 * getCurrencySymbol('INR') // "₹"
 * getCurrencySymbol('USD') // "$"
 * getCurrencySymbol('EUR') // "€"
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AED: 'د.إ',
    SAR: '﷼',
    SGD: 'S$',
    AUD: 'A$',
    CAD: 'C$',
  };

  return symbols[currencyCode.toUpperCase()] || currencyCode;
}
