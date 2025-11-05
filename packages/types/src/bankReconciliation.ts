/**
 * Bank Reconciliation Type Definitions
 *
 * Types for bank reconciliation features including bank statements,
 * transaction matching, and reconciliation reports.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Bank Statement Record
 * Represents a single bank statement for a specific period
 */
export interface BankStatement {
  id?: string;
  accountId: string; // Reference to Chart of Accounts bank account
  accountName: string;
  accountNumber: string;
  bankName: string;

  // Statement Period
  statementDate: Timestamp;
  startDate: Timestamp;
  endDate: Timestamp;

  // Balances
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;

  // Reconciliation Status
  status: BankStatementStatus;
  reconciledAt?: Timestamp;
  reconciledBy?: string;

  // Metadata
  uploadedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

export type BankStatementStatus =
  | 'DRAFT' // Uploaded but not started
  | 'IN_PROGRESS' // Reconciliation in progress
  | 'RECONCILED' // Fully reconciled
  | 'REVIEWED'; // Reconciled and reviewed

/**
 * Bank Transaction (from bank statement)
 * Individual transaction line from bank statement
 */
export interface BankTransaction {
  id?: string;
  statementId: string; // Reference to BankStatement
  accountId: string; // Bank account ID

  // Transaction Details
  transactionDate: Timestamp;
  valueDate?: Timestamp;
  description: string;
  reference?: string;
  chequeNumber?: string;

  // Amounts
  debitAmount: number; // Money out (payment)
  creditAmount: number; // Money in (receipt)
  balance?: number; // Running balance

  // Reconciliation
  isReconciled: boolean;
  reconciledWith?: string; // ID of matched accounting transaction
  reconciledAt?: Timestamp;
  reconciledBy?: string;
  matchType?: MatchType;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

export type MatchType =
  | 'EXACT' // Exact amount and date match
  | 'MANUAL' // Manually matched by user
  | 'SUGGESTED' // System-suggested match
  | 'PARTIAL'; // Partial match (different amount or date)

/**
 * Reconciliation Match
 * Links a bank transaction to an accounting transaction
 */
export interface ReconciliationMatch {
  id?: string;
  statementId: string;
  accountId: string;

  // Matched Items
  bankTransactionId: string;
  accountingTransactionId: string;

  // Match Details
  matchType: MatchType;
  matchScore?: number; // 0-100 similarity score for suggested matches
  matchDate: Timestamp;
  matchedBy: string;

  // Variance (if any)
  amountVariance?: number; // Difference in amounts
  dateVariance?: number; // Difference in days

  // Metadata
  createdAt: Timestamp;
  notes?: string;
}

/**
 * Reconciliation Report
 * Summary of a reconciliation session
 */
export interface ReconciliationReport {
  id?: string;
  statementId: string;
  accountId: string;
  accountName: string;

  // Period
  startDate: Timestamp;
  endDate: Timestamp;
  reportDate: Timestamp;

  // Balances
  openingBalance: number;
  closingBalance: number;
  bookBalance: number; // Balance per accounting records
  bankBalance: number; // Balance per bank statement
  difference: number; // bankBalance - bookBalance

  // Statistics
  totalTransactions: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciliationPercentage: number;

  // Unreconciled Items
  unreconciledBankTransactions: number;
  unreconciledBankAmount: number;
  unreconciledAccountingTransactions: number;
  unreconciledAccountingAmount: number;

  // Status
  status: BankStatementStatus;
  generatedBy: string;
  createdAt: Timestamp;
}

/**
 * Reconciliation Adjustment
 * Manual adjustment entry to reconcile differences
 */
export interface ReconciliationAdjustment {
  id?: string;
  statementId: string;
  accountId: string;

  // Adjustment Details
  adjustmentDate: Timestamp;
  description: string;
  reason: string;
  amount: number;
  type: 'BANK_ERROR' | 'BOOK_ERROR' | 'TIMING_DIFFERENCE' | 'FEE' | 'INTEREST' | 'OTHER';

  // Links
  relatedBankTransactionId?: string;
  relatedAccountingTransactionId?: string;
  journalEntryId?: string; // If adjustment creates a JE

  // Approval
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Bank Reconciliation Filter Options
 */
export interface ReconciliationFilters {
  accountId?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  status?: BankStatementStatus;
  isReconciled?: boolean;
  matchType?: MatchType;
}

/**
 * Reconciliation Statistics
 * Real-time reconciliation progress
 */
export interface ReconciliationStats {
  statementId: string;
  totalBankTransactions: number;
  reconciledBankTransactions: number;
  unreconciledBankTransactions: number;
  totalAccountingTransactions: number;
  reconciledAccountingTransactions: number;
  unreconciledAccountingTransactions: number;
  matchedPairs: number;
  suggestedMatches: number;
  amountDifference: number;
  percentageComplete: number;
}

/**
 * Transaction Match Suggestion
 * System-suggested match between bank and accounting transaction
 */
export interface MatchSuggestion {
  bankTransactionId: string;
  accountingTransactionId: string;
  matchScore: number; // 0-100
  matchReasons: string[]; // Why this match is suggested
  amountMatch: boolean;
  dateMatch: boolean;
  descriptionMatch: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Manual Match Input
 * User input for manual transaction matching
 */
export interface ManualMatchInput {
  bankTransactionId: string;
  accountingTransactionId: string;
  notes?: string;
  adjustmentAmount?: number; // If amounts don't match exactly
}
