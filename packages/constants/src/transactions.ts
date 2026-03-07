/**
 * Transaction Type Constants
 *
 * Centralized labels and utilities for the 9 TransactionType values.
 * All switch statements on TransactionType should use exhaustive checking
 * via assertNever to catch missing cases at compile time.
 */

import type { TransactionType } from '@vapour/types';

/**
 * Exhaustive switch helper — place in the `default` case of any switch
 * on a union type. If a new variant is added to the union but the switch
 * isn't updated, TypeScript will report a compile error here.
 *
 * Usage:
 *   switch (txnType) {
 *     case 'CUSTOMER_INVOICE': ...
 *     case 'CUSTOMER_PAYMENT': ...
 *     // ... all cases
 *     default:
 *       assertNever(txnType);
 *   }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled value: ${String(value)}`);
}

/**
 * Human-readable labels for each transaction type.
 * Use this instead of ad-hoc switch/if-else for type labels.
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  CUSTOMER_INVOICE: 'Invoice',
  CUSTOMER_PAYMENT: 'Receipt',
  VENDOR_BILL: 'Bill',
  VENDOR_PAYMENT: 'Payment',
  JOURNAL_ENTRY: 'Journal Entry',
  BANK_TRANSFER: 'Bank Transfer',
  EXPENSE_CLAIM: 'Expense Claim',
  DIRECT_PAYMENT: 'Direct Payment',
  DIRECT_RECEIPT: 'Direct Receipt',
};

/**
 * Short labels for compact UI display (e.g., table columns).
 */
export const TRANSACTION_TYPE_SHORT_LABELS: Record<TransactionType, string> = {
  CUSTOMER_INVOICE: 'Invoice',
  CUSTOMER_PAYMENT: 'Receipt',
  VENDOR_BILL: 'Bill',
  VENDOR_PAYMENT: 'Payment',
  JOURNAL_ENTRY: 'Journal',
  BANK_TRANSFER: 'Transfer',
  EXPENSE_CLAIM: 'Expense',
  DIRECT_PAYMENT: 'Direct Pmt',
  DIRECT_RECEIPT: 'Direct Rcpt',
};

/**
 * Route paths for each transaction type (for drill-down navigation).
 */
export const TRANSACTION_TYPE_ROUTES: Record<TransactionType, string> = {
  CUSTOMER_INVOICE: '/accounting/invoices',
  CUSTOMER_PAYMENT: '/accounting/payments',
  VENDOR_BILL: '/accounting/bills',
  VENDOR_PAYMENT: '/accounting/payments',
  JOURNAL_ENTRY: '/accounting/journal-entries',
  BANK_TRANSFER: '/accounting/bank-transfers',
  EXPENSE_CLAIM: '/accounting/expense-claims',
  DIRECT_PAYMENT: '/accounting/payments',
  DIRECT_RECEIPT: '/accounting/payments',
};
