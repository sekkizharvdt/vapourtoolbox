/**
 * Payment Planning Types
 * For cash flow forecasting, manual cash flow entry, and payment scheduling
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Forecast confidence based on historical payment behavior
 */
export type ForecastConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Payment risk status
 */
export type PaymentRiskStatus = 'ON_SCHEDULE' | 'AT_RISK' | 'OVERDUE';

/**
 * Direction of cash flow
 */
export type CashFlowDirection = 'INFLOW' | 'OUTFLOW';

/**
 * Source of a forecast item
 */
export type ForecastItemSource =
  | 'INVOICE' // Outstanding customer invoice
  | 'BILL' // Outstanding vendor bill
  | 'RECURRING' // From recurring transaction template
  | 'MANUAL'; // Manually entered cash flow item

/**
 * Category for manual cash flow entries
 */
export type ManualCashFlowCategory =
  // Inflows
  | 'PROJECT_RECEIPT' // Customer payment for project
  | 'LOAN_RECEIPT' // Loan received
  | 'INTEREST_INCOME' // Interest earned
  | 'OTHER_INCOME' // Other income
  // Outflows
  | 'SALARY_WAGES' // Payroll
  | 'RENT_LEASE' // Rent/lease payments
  | 'UTILITIES' // Electricity, water, internet
  | 'LOAN_REPAYMENT' // Loan EMI/repayment
  | 'TAX_PAYMENT' // GST, TDS, income tax
  | 'VENDOR_PAYMENT' // Vendor/supplier payment
  | 'CAPITAL_EXPENSE' // Equipment, assets
  | 'OTHER_EXPENSE'; // Miscellaneous

/**
 * Manual cash flow entry for planning
 * This is what users create when they want to add expected receipts/payments
 * that aren't already captured by invoices, bills, or recurring transactions
 */
export interface ManualCashFlowItem {
  id: string;

  // Basic info
  name: string;
  description?: string;
  direction: CashFlowDirection;
  category: ManualCashFlowCategory;

  // Financial
  amount: number;
  currency: string;

  // Timing
  expectedDate: Date | Timestamp;
  isRecurring: boolean; // One-time or repeating

  // For recurring manual items (simple repeat, not full recurring transaction)
  recurrenceEndDate?: Date | Timestamp;
  recurrenceFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

  // Optional links
  entityId?: string; // Customer or vendor
  entityName?: string;
  projectId?: string;
  projectName?: string;

  // Status
  status: 'PLANNED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  completedTransactionId?: string; // Link to actual transaction when realized

  // Audit
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  notes?: string;
}

/**
 * Individual forecast item (from any source)
 */
export interface ForecastItem {
  // Source identification
  id: string;
  source: ForecastItemSource;
  sourceId: string; // ID of invoice, bill, recurring transaction, or manual item
  sourceReference: string; // Invoice number, bill number, or name

  // Direction
  direction: CashFlowDirection;
  category?: ManualCashFlowCategory;

  // Entity (Customer or Vendor)
  entityId?: string;
  entityName?: string;

  // Financial
  amount: number;
  currency: string;

  // Dates
  expectedDate: Date;
  dueDate?: Date;

  // Forecasting
  confidence: ForecastConfidence;
  riskStatus: PaymentRiskStatus;
  daysUntilDue: number;
  daysOverdue: number;

  // Notes
  notes?: string;
}

/**
 * Daily cash flow projection
 */
export interface DailyForecast {
  date: Date;

  // Projected amounts
  projectedReceipts: number;
  projectedPayments: number;
  netCashFlow: number;

  // Running balance
  openingBalance: number;
  closingBalance: number;

  // Item counts
  receiptsCount: number;
  paymentsCount: number;

  // Items for this day
  items: ForecastItem[];
}

/**
 * Weekly summary for longer-term view
 */
export interface WeeklyForecast {
  weekStartDate: Date;
  weekEndDate: Date;
  weekNumber: number;

  totalReceipts: number;
  totalPayments: number;
  netCashFlow: number;

  // Item counts
  invoicesDue: number;
  billsDue: number;
  recurringItems: number;
  manualItems: number;
}

/**
 * Complete cash flow forecast
 */
export interface CashFlowForecast {
  // Metadata
  generatedAt: Date;
  forecastStartDate: Date;
  forecastEndDate: Date;
  forecastDays: number;
  currency: string;

  // Opening position
  openingCashBalance: number;

  // Projections
  dailyForecasts: DailyForecast[];
  weeklyForecasts: WeeklyForecast[];

  // Summary totals
  totalProjectedReceipts: number;
  totalProjectedPayments: number;
  netForecastedCashFlow: number;
  projectedClosingBalance: number;

  // Breakdown by source
  receiptsBySource: {
    invoices: number;
    recurring: number;
    manual: number;
  };
  paymentsBySource: {
    bills: number;
    recurring: number;
    manual: number;
  };

  // Risk analysis
  overdueReceivables: number;
  overduePayables: number;
  atRiskItems: ForecastItem[];

  // All individual items
  allItems: ForecastItem[];
}

/**
 * Forecast generation options
 */
export interface ForecastOptions {
  startDate: Date;
  endDate: Date;

  // What to include
  includeOverdue: boolean;
  includeInvoices: boolean;
  includeBills: boolean;
  includeRecurring: boolean;
  includeManual: boolean;

  // Opening balance source
  openingBalance?: number; // Override, otherwise calculated

  // Filters
  entityIds?: string[];
  projectIds?: string[];
  minAmount?: number;
}

/**
 * Quick summary for dashboard cards
 */
export interface CashFlowSummary {
  // Current position
  currentBalance: number;

  // Next 7 days
  next7DaysReceipts: number;
  next7DaysPayments: number;
  next7DaysNet: number;

  // Next 30 days
  next30DaysReceipts: number;
  next30DaysPayments: number;
  next30DaysNet: number;

  // Counts
  overdueReceivablesCount: number;
  overduePayablesCount: number;
  upcomingRecurringCount: number;

  // Projected balance
  projectedBalance7Days: number;
  projectedBalance30Days: number;
}
