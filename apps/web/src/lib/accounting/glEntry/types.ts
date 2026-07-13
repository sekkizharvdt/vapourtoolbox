/**
 * GL Entry Generator Types
 *
 * Type definitions for GL entry generation
 */

import type { LedgerEntry, GSTDetails, TDSDetails, LineItem } from '@vapour/types';

/**
 * Line item with optional account mapping for GL entry generation
 */
export interface GLLineItem extends Pick<LineItem, 'description' | 'amount' | 'accountId'> {
  accountId?: string;
  accountCode?: string;
  accountName?: string;
}

/**
 * Input for generating invoice GL entries
 */
export interface InvoiceGLInput {
  transactionId?: string;
  transactionNumber?: string;
  transactionDate?: { toDate: () => Date };
  subtotal: number; // Amount before GST
  lineItems?: GLLineItem[];
  gstDetails?: GSTDetails;
  currency?: string;
  description?: string;
  entityId?: string;
  projectId?: string;
}

/**
 * Input for generating bill GL entries
 */
export interface BillGLInput {
  transactionId?: string;
  transactionNumber?: string;
  transactionDate?: { toDate: () => Date };
  subtotal: number; // Amount before GST
  lineItems?: GLLineItem[];
  gstDetails?: GSTDetails;
  tdsDetails?: TDSDetails;
  currency?: string;
  description?: string;
  entityId?: string;
  projectId?: string;
}

/**
 * Input for generating payment GL entries
 */
export interface PaymentGLInput {
  transactionId?: string;
  transactionNumber?: string;
  transactionDate?: { toDate: () => Date };
  amount: number; // Total payment amount
  currency?: string;
  paymentMethod?: string;
  bankAccountId?: string; // Which bank account
  receivableOrPayableAccountId?: string; // Accounts Receivable or Payable account
  description?: string;
  entityId?: string;
  projectId?: string;
}

/**
 * Input for generating bank transfer GL entries
 */
export interface BankTransferGLInput {
  fromAccountId: string; // Source bank account (credited)
  fromAccountCode?: string;
  fromAccountName?: string;
  toAccountId: string; // Destination bank account (debited)
  toAccountCode?: string;
  toAccountName?: string;
  amount: number; // Transfer amount (INR)
  description?: string;
  projectId?: string;
}

/**
 * Single expense line for expense-claim GL generation
 */
export interface ExpenseClaimGLLine {
  accountId: string; // Expense account (debited)
  accountCode?: string;
  accountName?: string;
  description: string;
  amount: number;
}

/**
 * Input for generating expense claim GL entries
 */
export interface ExpenseClaimGLInput {
  lines: ExpenseClaimGLLine[];
  payableAccountId: string; // Employee-reimbursable liability account (credited)
  payableAccountCode?: string;
  payableAccountName?: string;
  claimantName?: string;
  projectId?: string;
}

/**
 * Result of GL entry generation
 */
export interface GLGenerationResult {
  success: boolean;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  errors: string[];
}
