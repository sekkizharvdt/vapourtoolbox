/**
 * Centralized Payment Constants
 *
 * Single source of truth for payment-related constants used across
 * customer and vendor payment components.
 */

import type { PaymentMethod } from '@vapour/types';

/**
 * Available payment methods
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'BANK_TRANSFER',
  'UPI',
  'CHEQUE',
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'OTHER',
];

/**
 * Payment method display labels
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  OTHER: 'Other',
};

/**
 * Currency definitions for foreign exchange
 */
export interface CurrencyDefinition {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyDefinition[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];

/**
 * TDS (Tax Deducted at Source) section definitions
 */
export interface TDSSection {
  code: string;
  name: string;
  rate: number;
}

export const TDS_SECTIONS: TDSSection[] = [
  { code: '194C', name: 'Contractors - 2%', rate: 2 },
  { code: '194J', name: 'Professional Services - 10%', rate: 10 },
  { code: '194H', name: 'Commission/Brokerage - 5%', rate: 5 },
  { code: '194I', name: 'Rent - 10%', rate: 10 },
  { code: '194A', name: 'Interest (Other than Securities) - 10%', rate: 10 },
];

/**
 * Get currency by code
 */
export function getCurrency(code: string): CurrencyDefinition | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/**
 * Get TDS section by code
 */
export function getTDSSection(code: string): TDSSection | undefined {
  return TDS_SECTIONS.find((s) => s.code === code);
}

/**
 * Format payment method for display
 */
export function formatPaymentMethod(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] || method;
}
