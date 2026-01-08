/**
 * Chart of Accounts Types
 * Based on Indian Accounting Standards
 *
 * This module defines the structure for the company's Chart of Accounts,
 * including account hierarchies, GST/TDS accounts, and bank accounts.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type AccountCategory =
  // Assets
  | 'CURRENT_ASSETS'
  | 'FIXED_ASSETS'
  | 'INVESTMENTS'
  | 'OTHER_ASSETS'
  // Liabilities
  | 'CURRENT_LIABILITIES'
  | 'LONG_TERM_LIABILITIES'
  | 'OTHER_LIABILITIES'
  // Equity
  | 'SHARE_CAPITAL'
  | 'RESERVES_SURPLUS'
  | 'RETAINED_EARNINGS'
  // Income
  | 'OPERATING_REVENUE'
  | 'OTHER_INCOME'
  // Expenses
  | 'COST_OF_GOODS_SOLD'
  | 'OPERATING_EXPENSES'
  | 'FINANCIAL_EXPENSES'
  | 'OTHER_EXPENSES';

/**
 * Account in Chart of Accounts
 * Supports 4-level hierarchy: Type → Category → Group → Account
 */
export interface Account {
  id: string;
  code: string; // e.g., "1100", "2100" - must be unique
  name: string;
  description?: string;

  // Account Classification
  accountType: AccountType;
  accountCategory: AccountCategory;
  accountGroup?: string; // e.g., "Cash & Bank", "Trade Receivables"

  // Hierarchy (4 levels)
  parentAccountId?: string;
  level: number; // 1 (Type) -> 2 (Category) -> 3 (Group) -> 4 (Account)
  isGroup: boolean; // True for parent accounts, false for leaf accounts

  // Status
  isActive: boolean;
  isSystemAccount: boolean; // Cannot be deleted (GST, Bank, etc.)

  // Financial Properties
  openingBalance: number;
  currentBalance: number;
  currency: string;

  // GST/Tax Properties
  isGSTAccount: boolean;
  gstType?: 'CGST' | 'SGST' | 'IGST' | 'CESS';
  gstDirection?: 'INPUT' | 'OUTPUT'; // Input (you pay) or Output (you collect)
  isTDSAccount: boolean;
  tdsSection?: string; // e.g., "194C", "194J"

  // Bank Properties
  isBankAccount: boolean;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;

  // For display (computed field)
  fullPath?: string; // e.g., "Assets > Current Assets > Cash & Bank > SBI Current Account"
}

/**
 * Account with children for tree view display
 */
export interface AccountTreeNode extends Account {
  children?: AccountTreeNode[];
}

/**
 * Template for default account creation
 * Used for importing Indian Chart of Accounts template
 */
export interface DefaultAccountTemplate {
  code: string;
  name: string;
  accountType: AccountType;
  accountCategory: AccountCategory;
  accountGroup?: string;
  level: number;
  isGroup: boolean;
  isSystemAccount: boolean;
  isGSTAccount: boolean;
  gstType?: 'CGST' | 'SGST' | 'IGST' | 'CESS';
  gstDirection?: 'INPUT' | 'OUTPUT';
  isTDSAccount: boolean;
  tdsSection?: string;
  isBankAccount: boolean;
  bankName?: string;
  description?: string;
}

/**
 * Cost Centre Category
 * - PROJECT: Linked to a specific project
 * - ADMINISTRATION: For general administrative expenses (not linked to a project)
 * - OVERHEAD: For overhead costs shared across projects
 */
export type CostCentreCategory = 'PROJECT' | 'ADMINISTRATION' | 'OVERHEAD';

/**
 * Cost Centre (Project-based accounting)
 * Maps to existing Projects for cost tracking
 */
export interface CostCentre {
  id: string;
  code: string; // e.g., "CC-001"
  name: string;
  description?: string;

  // Category (PROJECT, ADMINISTRATION, OVERHEAD)
  category: CostCentreCategory;

  // Link to project (required only for PROJECT category)
  projectId?: string; // Optional: Reference to existing project (for auto-created cost centres)

  // Budget & Tracking
  budgetAmount: number | null;
  budgetCurrency: string;
  actualSpent: number;
  variance: number | null;

  // Status
  isActive: boolean;
  autoCreated?: boolean; // True if auto-created from project, false if manually created

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Interproject Loan
 * Tracks lending between projects with automatic journal entries
 */
export interface InterprojectLoan {
  id: string;
  loanNumber: string; // e.g., "IPL-001"

  // Parties
  lendingProjectId: string; // Project giving the loan
  borrowingProjectId: string; // Project receiving the loan

  // Loan Terms
  principalAmount: number;
  currency: string;
  interestRate: number; // Annual percentage
  interestCalculationMethod: 'SIMPLE' | 'COMPOUND';
  startDate: Date;
  maturityDate: Date;

  // Repayment
  repaymentSchedule: RepaymentSchedule[];
  remainingPrincipal: number;
  totalInterestAccrued: number;
  totalInterestPaid: number;

  // Status
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'FULLY_REPAID' | 'DEFAULTED' | 'WRITTEN_OFF';

  // Journal Tracking (auto-generated)
  disbursementJournalId?: string;
  accruedInterestAccountId?: string;

  // Metadata
  notes?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Loan Repayment Schedule Entry
 */
export interface RepaymentSchedule {
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  paidDate?: Date;
  paidAmount?: number;
  journalEntryId?: string;
}

/**
 * Ledger Entry (for double-entry bookkeeping)
 */
export interface LedgerEntry {
  accountId: string;
  accountCode?: string; // Denormalized for display
  accountName?: string; // Denormalized for display
  debit: number;
  credit: number;
  description?: string;
  costCentreId?: string; // Optional project/cost centre tagging
  entityId?: string; // Optional vendor/customer reference for entity ledger tracking
  entityName?: string; // Denormalized for display
}

/**
 * Line Item for invoices and bills
 */
export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstRate?: number;
  gstAmount?: number;
  hsnCode?: string;
  sacCode?: string;
  accountId?: string;
  costCentreId?: string;
}

/**
 * GST Details for transactions
 */
export interface GSTDetails {
  gstType: 'CGST_SGST' | 'IGST';
  taxableAmount: number;

  // CGST + SGST (for intra-state)
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;

  // IGST (for inter-state)
  igstRate?: number;
  igstAmount?: number;

  totalGST: number;

  // Classification
  hsnCode?: string; // For goods
  sacCode?: string; // For services

  // Place of supply
  placeOfSupply?: string; // State code
}

/**
 * TDS Details for transactions
 */
export interface TDSDetails {
  section: string; // e.g., "194C", "194J"
  tdsRate: number;
  tdsAmount: number;
  panNumber?: string; // PAN of deductee
  certificateNumber?: string;
}

/**
 * Account Balance Summary
 * Used for reports and dashboards
 */
export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  currency: string;
}

/**
 * Outstanding Balance (AR/AP)
 */
export interface OutstandingBalance {
  entityId: string;
  entityName: string;
  entityRole: 'VENDOR' | 'CUSTOMER';
  totalOutstanding: number;
  currency: string;

  // Aging buckets
  current: number; // 0-30 days
  days31to60: number;
  days61to90: number;
  over90days: number;

  // Individual invoices/bills
  outstandingItems: OutstandingItem[];
}

/**
 * Individual outstanding invoice/bill
 */
export interface OutstandingItem {
  transactionId: string;
  transactionNumber: string;
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL';
  date: Date;
  dueDate?: Date;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
}

/**
 * Fiscal Year
 * Represents a complete accounting year with multiple periods
 */
export interface FiscalYear {
  id: string;
  name: string; // e.g., "FY 2024-25"
  startDate: Date; // e.g., 2024-04-01
  endDate: Date; // e.g., 2025-03-31
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  isCurrent: boolean; // Only one fiscal year should be current

  // Periods (months/quarters)
  periods: string[]; // Array of AccountingPeriod IDs

  // Year-end closing
  isYearEndClosed: boolean;
  yearEndClosingDate?: Date;
  yearEndClosingJournalId?: string;
  closedBy?: string;

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Accounting Period (Month/Quarter)
 * Controls transaction posting and prevents backdated entries
 */
export interface AccountingPeriod {
  id: string;
  fiscalYearId: string;
  name: string; // e.g., "Apr 2024", "Q1 2024-25"
  periodType: 'MONTH' | 'QUARTER';
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';

  // Sequence
  periodNumber: number; // 1-12 for months, 1-4 for quarters
  year: number; // Calendar year (for grouping)

  // Closing information
  closedDate?: Date;
  closedBy?: string;
  closingNotes?: string;

  // Locking (prevents reopening)
  lockedDate?: Date;
  lockedBy?: string;
  lockReason?: string;

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Year-End Closing Entry
 * Records the transfer of revenue/expense balances to retained earnings
 */
export interface YearEndClosingEntry {
  id: string;
  fiscalYearId: string;
  fiscalYearName: string;

  // Closing details
  closingDate: Date;
  retainedEarningsAccountId: string; // Target account for net income/loss

  // Accounts closed
  revenueAccounts: ClosedAccountBalance[];
  expenseAccounts: ClosedAccountBalance[];

  // Summary
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number; // Positive = profit, Negative = loss

  // Journal Entry
  journalEntryId: string; // Reference to the closing journal entry
  journalEntryNumber: string;

  // Status
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  reversalDate?: Date;
  reversalJournalId?: string;

  // Audit
  preparedBy: string;
  approvedBy?: string;
  approvalDate?: Date;
  notes?: string;

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Closed Account Balance
 * Tracks individual account balances that were closed
 */
export interface ClosedAccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'INCOME' | 'EXPENSE';
  closingBalance: number; // Balance transferred to retained earnings
}

/**
 * Period Lock Audit Log
 * Tracks who locked/unlocked periods and why
 */
export interface PeriodLockAudit {
  id: string;
  periodId: string;
  fiscalYearId: string;
  action: 'LOCK' | 'UNLOCK';
  actionDate: Date;
  actionBy: string;
  reason: string;
  previousStatus: 'OPEN' | 'CLOSED' | 'LOCKED';
  newStatus: 'OPEN' | 'CLOSED' | 'LOCKED';
}

// Export Indian COA template
export { INDIAN_COA_TEMPLATE } from './data/indian-coa-template';
