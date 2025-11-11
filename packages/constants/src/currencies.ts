// Currency Configuration

import type { CurrencyCode } from '@vapour/types';

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  symbolNative: string;
  decimalDigits: number;
  rounding: number;
}

/**
 * Currency configurations
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    symbolNative: '₹',
    decimalDigits: 2,
    rounding: 0,
  },

  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
  },

  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    symbolNative: '€',
    decimalDigits: 2,
    rounding: 0,
  },

  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    symbolNative: 'S$',
    decimalDigits: 2,
    rounding: 0,
  },

  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    symbolNative: '£',
    decimalDigits: 2,
    rounding: 0,
  },

  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED',
    symbolNative: 'د.إ',
    decimalDigits: 2,
    rounding: 0,
  },
};

/**
 * Default currency for the application
 */
export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

/**
 * Get currency configuration
 */
export function getCurrency(code: CurrencyCode): CurrencyConfig {
  return CURRENCIES[code];
}

/**
 * Get all currencies as array
 */
export function getAllCurrencies(): CurrencyConfig[] {
  return Object.values(CURRENCIES);
}

/**
 * Get currency options for select/dropdown
 */
export function getCurrencyOptions() {
  return getAllCurrencies().map((currency) => ({
    value: currency.code,
    label: `${currency.code} - ${currency.name}`,
  }));
}

/**
 * Format amount with currency
 */
export function formatCurrency(amount: number, currencyCode: CurrencyCode): string {
  const currency = getCurrency(currencyCode);
  return `${currency.symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: currency.decimalDigits,
    maximumFractionDigits: currency.decimalDigits,
  })}`;
}
