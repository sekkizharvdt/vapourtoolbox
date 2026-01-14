/**
 * Recurring Transaction Types
 *
 * Types for recurring invoices, bills, salary provisioning, and scheduled journal entries.
 * These are templates that generate actual transactions on a schedule.
 */

import { Timestamp, Money, CurrencyCode, TimestampFields } from './common';

/**
 * Frequency for recurring transactions
 */
export type RecurrenceFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

/**
 * Type of recurring transaction
 */
export type RecurringTransactionType =
  | 'SALARY' // Employee salaries
  | 'VENDOR_BILL' // Recurring vendor bills (rent, subscriptions)
  | 'CUSTOMER_INVOICE' // Recurring customer invoices (retainers)
  | 'JOURNAL_ENTRY'; // Recurring journal entries (depreciation)

/**
 * Status of a recurring transaction template
 */
export type RecurringTransactionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/**
 * Status of a generated occurrence
 */
export type OccurrenceStatus = 'PENDING' | 'GENERATED' | 'SKIPPED' | 'MODIFIED' | 'FAILED';

/**
 * Journal entry line template for recurring journal entries
 */
export interface JournalLineTemplate {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  description?: string;
  debitAmount?: Money;
  creditAmount?: Money;
}

/**
 * Journal entry template for recurring journal entries
 */
export interface JournalEntryTemplate {
  narration: string;
  lines: JournalLineTemplate[];
  costCentreId?: string;
  projectId?: string;
}

/**
 * Line item template for recurring invoices/bills
 */
export interface RecurringLineItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: Money;
  amount: Money;
  accountId?: string; // Revenue/expense account
  taxRate?: number; // GST rate percentage
  hsnSacCode?: string;
}

/**
 * Recurring transaction template
 */
export interface RecurringTransaction extends TimestampFields {
  id: string;

  // Template info
  name: string;
  description?: string;
  type: RecurringTransactionType;
  status: RecurringTransactionStatus;

  // Schedule
  frequency: RecurrenceFrequency;
  startDate: Timestamp;
  endDate?: Timestamp; // Optional end date
  nextOccurrence: Timestamp; // Next scheduled date
  dayOfMonth?: number; // For MONTHLY: 1-31, use 0 for last day of month
  dayOfWeek?: number; // For WEEKLY: 0=Sunday, 1=Monday, etc.

  // Financial
  amount: Money; // Base amount (may vary per occurrence)
  currency: CurrencyCode;

  // For SALARY type
  employeeIds?: string[]; // Which employees (empty = all active)
  salaryComponents?: {
    basic?: boolean;
    hra?: boolean;
    allowances?: boolean;
    deductions?: boolean;
  };

  // For VENDOR_BILL type
  vendorId?: string;
  vendorName?: string;
  expenseAccountId?: string;
  expenseAccountName?: string;
  lineItems?: RecurringLineItem[];
  paymentTermDays?: number;

  // For CUSTOMER_INVOICE type
  customerId?: string;
  customerName?: string;
  revenueAccountId?: string;
  revenueAccountName?: string;
  invoiceLineItems?: RecurringLineItem[];
  customerPaymentTermDays?: number;

  // For JOURNAL_ENTRY type
  journalTemplate?: JournalEntryTemplate;

  // Auto-generation settings
  autoGenerate: boolean; // Auto-create or just notify
  daysBeforeToGenerate: number; // Generate N days before due
  requiresApproval: boolean; // Needs approval before posting

  // Tracking
  totalOccurrences: number; // Total generated so far
  lastGeneratedAt?: Timestamp;
  lastGeneratedOccurrenceId?: string;

  // Audit
  createdBy: string;
  createdByName?: string;
}

/**
 * Generated occurrence from a recurring transaction
 */
export interface RecurringOccurrence extends TimestampFields {
  id: string;
  recurringTransactionId: string;
  recurringTransactionName: string;
  type: RecurringTransactionType;

  // Scheduled info
  scheduledDate: Timestamp;
  occurrenceNumber: number; // 1, 2, 3, etc.

  // Financial
  originalAmount: Money;
  finalAmount: Money; // After modifications

  // Status
  status: OccurrenceStatus;

  // Generated transaction reference
  generatedTransactionId?: string;
  generatedTransactionType?: 'INVOICE' | 'BILL' | 'JOURNAL_ENTRY' | 'SALARY_PAYMENT';
  generatedTransactionNumber?: string;

  // Modifications (if status = MODIFIED)
  modifications?: {
    amountChanged?: boolean;
    dateChanged?: boolean;
    reason?: string;
    modifiedBy: string;
    modifiedAt: Timestamp;
  };

  // Skip info (if status = SKIPPED)
  skipReason?: string;
  skippedBy?: string;
  skippedAt?: Timestamp;

  // Error info (if status = FAILED)
  errorMessage?: string;
  errorDetails?: string;

  // Processing
  processedAt?: Timestamp;
  processedBy?: string;
}

/**
 * Summary of recurring transactions for dashboard
 */
export interface RecurringTransactionSummary {
  totalActive: number;
  totalPaused: number;

  byType: {
    salary: number;
    vendorBill: number;
    customerInvoice: number;
    journalEntry: number;
  };

  upcomingThisWeek: number;
  upcomingThisMonth: number;

  monthlyOutflow: Money; // Total expected outflow
  monthlyInflow: Money; // Total expected inflow
}

/**
 * Filter options for recurring transactions
 */
export interface RecurringTransactionFilters {
  type?: RecurringTransactionType;
  status?: RecurringTransactionStatus;
  frequency?: RecurrenceFrequency;
  vendorId?: string;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Create/update recurring transaction payload
 */
export interface RecurringTransactionInput {
  name: string;
  description?: string;
  type: RecurringTransactionType;

  // Schedule
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;

  // Financial
  amount: number;
  currency: CurrencyCode;

  // Type-specific fields
  employeeIds?: string[];
  vendorId?: string;
  customerId?: string;
  expenseAccountId?: string;
  revenueAccountId?: string;
  lineItems?: Omit<RecurringLineItem, 'id'>[];
  journalTemplate?: JournalEntryTemplate;
  paymentTermDays?: number;

  // Settings
  autoGenerate: boolean;
  daysBeforeToGenerate: number;
  requiresApproval: boolean;
}
