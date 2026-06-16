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

// Currency main-unit / sub-unit names for amount-in-words (PO/PDF use).
const CURRENCY_WORD_NAMES: Record<string, { main: string; sub: string }> = {
  INR: { main: 'Rupees', sub: 'Paise' },
  USD: { main: 'US Dollars', sub: 'Cents' },
  EUR: { main: 'Euros', sub: 'Cents' },
  GBP: { main: 'Pounds', sub: 'Pence' },
  AED: { main: 'Dirhams', sub: 'Fils' },
  SGD: { main: 'Singapore Dollars', sub: 'Cents' },
  AUD: { main: 'Australian Dollars', sub: 'Cents' },
  CAD: { main: 'Canadian Dollars', sub: 'Cents' },
};

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Convert an integer 0–999 to words (Title Case, space-separated). */
function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest]!);
    } else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      parts.push(o > 0 ? `${TENS[t]} ${ONES[o]}` : TENS[t]!);
    }
  }
  return parts.join(' ');
}

/** Convert a non-negative integer to words using the Indian numbering system (lakh/crore). */
function integerToWordsIndian(num: number): string {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10_000_000);
  const lakh = Math.floor((num % 10_000_000) / 100_000);
  const thousand = Math.floor((num % 100_000) / 1_000);
  const hundredsAndbelow = num % 1_000;
  const parts: string[] = [];
  if (crore > 0) parts.push(`${integerToWordsIndian(crore)} Crore`);
  if (lakh > 0) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundredsAndbelow > 0) parts.push(threeDigitsToWords(hundredsAndbelow));
  return parts.join(' ');
}

/** Convert a non-negative integer to words using the international system (thousand/million/billion). */
function integerToWordsInternational(num: number): string {
  if (num === 0) return 'Zero';
  const scales = ['', ' Thousand', ' Million', ' Billion', ' Trillion'];
  const groups: number[] = [];
  let remaining = num;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]! > 0) parts.push(`${threeDigitsToWords(groups[i]!)}${scales[i] ?? ''}`);
  }
  return parts.join(' ');
}

/**
 * Spell out a monetary amount in words for documents (e.g. PO PDFs).
 *
 * Uses the Indian numbering system (lakh/crore) for INR and the international
 * system (million/billion) for other currencies, with the correct main/sub unit
 * names. Sub-units (paise/cents) are rounded to 2 decimals.
 *
 * @example
 * amountToWords(547520.20)        // "Rupees Five Lakh Forty Seven Thousand Five Hundred Twenty and Twenty Paise Only"
 * amountToWords(1234.56, 'USD')   // "US Dollars One Thousand Two Hundred Thirty Four and Fifty Six Cents Only"
 */
export function amountToWords(amount: number, currencyCode: string = 'INR'): string {
  const code = currencyCode.toUpperCase();
  const names = CURRENCY_WORD_NAMES[code] || { main: code, sub: 'Cents' };

  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${names.main} Zero Only`;
  }

  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const fraction = Math.round((abs - whole) * 100);

  const isIndian = code === 'INR';
  const wholeWords = isIndian ? integerToWordsIndian(whole) : integerToWordsInternational(whole);

  let result = `${names.main} ${wholeWords}`;
  if (fraction > 0) {
    result += ` and ${threeDigitsToWords(fraction)} ${names.sub}`;
  }
  result += ' Only';
  return negative ? `Minus ${result}` : result;
}
