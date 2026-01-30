/**
 * Transaction Types
 * Comprehensive transaction management for accounting system
 *
 * Supports 8 transaction types:
 * 1. Customer Invoice
 * 2. Customer Payment (Receipt)
 * 3. Vendor Bill
 * 4. Vendor Payment
 * 5. Journal Entry
 * 6. Bank Transfer
 * 7. Expense Claim
 * 8. Direct Payment (expense payments without vendor bill)
 */

import type { GSTDetails, TDSDetails, LedgerEntry } from './accounting';

/**
 * Transaction Types
 */
export type TransactionType =
  | 'CUSTOMER_INVOICE'
  | 'CUSTOMER_PAYMENT'
  | 'VENDOR_BILL'
  | 'VENDOR_PAYMENT'
  | 'JOURNAL_ENTRY'
  | 'BANK_TRANSFER'
  | 'EXPENSE_CLAIM'
  | 'DIRECT_PAYMENT';

/**
 * Transaction Status
 */
export type TransactionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'VOID';

/**
 * Payment Status (separate from workflow status)
 * Tracks whether a bill/invoice has been paid.
 */
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

/**
 * Payment Method
 */
export type PaymentMethod =
  | 'CASH'
  | 'CHEQUE'
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'OTHER';

/**
 * Transaction Approval Record
 * Audit trail for approval workflow actions
 */
export interface TransactionApprovalRecord {
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES';
  userId: string;
  userName: string;
  timestamp: Date;
  comments?: string;
}

/**
 * Base Transaction Interface
 * All transaction types extend this
 */
export interface BaseTransaction {
  id: string;
  type: TransactionType;
  transactionNumber: string; // Auto-generated: INV-001, RCPT-001, etc.
  date: Date;
  description: string;

  // Financial
  amount: number; // Gross amount
  currency: string;
  exchangeRate?: number; // Reference/expected rate for conversion
  baseAmount: number; // Amount in base currency (INR)

  // Bank Settlement (for foreign currency transactions)
  bankSettlementRate?: number; // Actual rate used by bank
  bankSettlementAmount?: number; // Actual INR amount received/paid
  bankSettlementDate?: Date; // When bank processed the transaction
  bankCharges?: number; // Bank fees in INR
  forexGainLoss?: number; // Difference: (bankSettlementAmount - baseAmount)

  // Cost Centre (Project) Assignment
  costCentreId?: string; // Link to project
  projectId?: string; // Direct project link (same as costCentreId)

  // Entity Reference (Vendor/Customer)
  entityId?: string; // Link to BusinessEntity
  entityName?: string; // Denormalized for display

  // Double-entry Accounting
  entries: LedgerEntry[]; // Must balance (total debits = total credits)

  // GST/Tax
  gstDetails?: GSTDetails;
  tdsDetails?: TDSDetails;

  // Status & Approval
  status: TransactionStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;

  // Approval workflow (optional - used by bills and invoices)
  submittedAt?: Date;
  submittedByUserId?: string;
  submittedByUserName?: string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  approvalHistory?: TransactionApprovalRecord[];

  // References
  reference?: string; // Alternative reference field
  referenceNumber?: string; // External reference (PO number, invoice number, etc.)
  relatedTransactionIds?: string[]; // Links to related transactions

  // Attachments
  attachments: string[]; // Document IDs

  // Bank Reconciliation
  reconciledBankAccountId?: string;
  reconciledDate?: Date;

  // Metadata
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
}

/**
 * Customer Invoice
 * Sales invoice sent to customer
 */
export interface CustomerInvoice extends BaseTransaction {
  type: 'CUSTOMER_INVOICE';

  // Customer details (entityId required)
  entityId: string; // MUST be a customer
  customerGSTIN?: string;

  // Invoice specifics
  invoiceDate: Date;
  dueDate?: Date;
  paymentTerms?: string; // e.g., "Net 30", "Due on receipt"
  reference?: string; // PO number, job reference, etc.

  // Line items
  lineItems: InvoiceLineItem[];

  // Amounts
  subtotal: number; // Before tax
  taxAmount: number; // GST total
  totalAmount: number; // After tax

  // Payment tracking
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: PaymentStatus;
}

/**
 * Customer Payment (Receipt)
 * Payment received from customer
 */
export interface CustomerPayment extends BaseTransaction {
  type: 'CUSTOMER_PAYMENT';

  // Customer details (entityId required)
  entityId: string; // MUST be a customer

  // Payment details
  paymentDate: Date | string;
  paymentMethod: PaymentMethod;
  chequeNumber?: string;
  upiTransactionId?: string;
  bankAccountId?: string; // Which bank account received payment

  // Amounts
  totalAmount: number; // Total payment amount

  // Invoice allocation
  invoiceAllocations: PaymentAllocation[]; // Which invoices this payment settles

  // Bank deposit
  depositedToBankAccountId: string;
  depositDate?: Date;
}

/**
 * Vendor Bill
 * Bill received from vendor (purchase)
 */
export interface VendorBill extends BaseTransaction {
  type: 'VENDOR_BILL';

  // Vendor details (entityId required)
  entityId: string; // MUST be a vendor
  vendorGSTIN?: string;

  // Bill specifics
  billDate: Date;
  dueDate?: Date;
  vendorInvoiceNumber: string; // Vendor's invoice/bill number
  reference?: string; // Alternative reference field

  // Line items
  lineItems: InvoiceLineItem[];

  // Amounts
  subtotal: number; // Before tax
  taxAmount: number; // GST total
  totalAmount: number; // After tax

  // Payment tracking
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: PaymentStatus;

  // TDS deduction
  tdsDeducted: boolean;
  tdsAmount?: number;

  // Cross-module integration (for future use when Procurement module is implemented)
  sourceModule?: 'procurement' | 'projects' | null; // Which module created this bill
  sourceDocumentId?: string; // ID of source document (e.g., vendor invoice from procurement)
  sourceDocumentType?: 'vendorInvoice' | 'projectExpense' | null; // Type of source document
}

/**
 * Vendor Payment
 * Payment made to vendor
 */
export interface VendorPayment extends BaseTransaction {
  type: 'VENDOR_PAYMENT';

  // Vendor details (entityId required)
  entityId: string; // MUST be a vendor

  // Payment details
  paymentDate: Date | string;
  paymentMethod: PaymentMethod;
  chequeNumber?: string;
  upiTransactionId?: string;
  bankAccountId?: string; // Which bank account made payment

  // Amounts
  totalAmount: number; // Total payment amount

  // Bill allocation
  billAllocations: PaymentAllocation[]; // Which bills this payment settles

  // TDS deduction
  tdsDeducted: boolean;
  tdsAmount?: number;
  tdsSection?: string;

  // Cross-module integration (for future use)
  notifyModules?: Array<'procurement' | 'projects'>; // Which modules should be notified of this payment
  sourceReferences?: Array<{
    // References to source documents that may need updates
    module: 'procurement' | 'projects';
    documentId: string;
    documentType: string;
  }>;
}

/**
 * Journal Entry
 * Manual accounting entry for adjustments
 */
export interface JournalEntry extends BaseTransaction {
  type: 'JOURNAL_ENTRY';

  // Journal specifics
  journalDate: Date;
  journalType: 'GENERAL' | 'ADJUSTING' | 'CLOSING' | 'REVERSING' | 'OPENING_BALANCE';

  // Multi-line entries (must balance)
  entries: LedgerEntry[]; // Each entry has accountId, debit, credit

  // Reversal tracking
  isReversed: boolean;
  reversalJournalId?: string;
  reversalDate?: Date;
}

/**
 * Bank Transfer
 * Transfer between bank accounts
 */
export interface BankTransfer extends BaseTransaction {
  type: 'BANK_TRANSFER';

  // Transfer details
  transferDate: Date;
  fromBankAccountId: string; // Source account
  toBankAccountId: string; // Destination account

  // Amount
  transferAmount: number;
  transferFee?: number; // Bank charges

  // Tracking
  transactionReference?: string; // UTR/reference number
  transferStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  completedDate?: Date;
}

/**
 * Expense Claim
 * Employee expense reimbursement
 */
export interface ExpenseClaim extends BaseTransaction {
  type: 'EXPENSE_CLAIM';

  // Employee details
  claimantUserId: string; // Employee who incurred expense
  claimantName?: string;

  // Claim details
  expenseDate: Date;
  expenseCategory: string; // e.g., "Travel", "Meals", "Supplies"

  // Line items
  expenseItems: ExpenseLineItem[];

  // Amounts
  totalClaimAmount: number;
  approvedAmount?: number;
  reimbursedAmount: number;

  // Status
  claimStatus: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';

  // Reimbursement
  reimbursementDate?: Date;
  reimbursementBankAccountId?: string;
  reimbursementMethod?: PaymentMethod;
}

/**
 * Invoice/Bill Line Item
 */
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number; // quantity * unitPrice

  // Tax
  gstRate?: number;
  gstAmount?: number;
  hsnCode?: string; // For goods
  sacCode?: string; // For services

  // Account mapping
  accountId?: string; // Which account to post to
  costCentreId?: string; // Project assignment

  // Charter budget line item tracking (optional)
  budgetLineItemId?: string; // Link to CharterBudgetLineItem for detailed budget tracking
}

/**
 * Payment Allocation
 * Links payment to invoice/bill
 */
export interface PaymentAllocation {
  invoiceId: string; // Invoice or bill ID
  invoiceNumber: string;
  originalAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
}

/**
 * Expense Line Item
 */
export interface ExpenseLineItem {
  id: string;
  description: string;
  expenseDate: Date;
  category: string;
  amount: number;
  currency: string;

  // Receipt
  hasReceipt: boolean;
  receiptAttachmentId?: string;

  // Tax
  gstRate?: number;
  gstAmount?: number;

  // Approval
  isApproved: boolean;
  approvedAmount?: number;
}

/**
 * Transaction Filters
 * For searching and filtering transactions
 */
export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  entityId?: string;
  costCentreId?: string;
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  searchText?: string; // Search in description, transaction number, entity name
}

/**
 * Transaction Summary
 * Aggregated transaction data for reports
 */
export interface TransactionSummary {
  totalCount: number;
  totalAmount: number;
  currency: string;
  byType: Record<TransactionType, { count: number; amount: number }>;
  byStatus: Record<TransactionStatus, { count: number; amount: number }>;
  byMonth: Array<{ month: string; count: number; amount: number }>;
}

/**
 * Type guard functions
 */
export function isCustomerInvoice(transaction: BaseTransaction): transaction is CustomerInvoice {
  return transaction.type === 'CUSTOMER_INVOICE';
}

export function isCustomerPayment(transaction: BaseTransaction): transaction is CustomerPayment {
  return transaction.type === 'CUSTOMER_PAYMENT';
}

export function isVendorBill(transaction: BaseTransaction): transaction is VendorBill {
  return transaction.type === 'VENDOR_BILL';
}

export function isVendorPayment(transaction: BaseTransaction): transaction is VendorPayment {
  return transaction.type === 'VENDOR_PAYMENT';
}

export function isJournalEntry(transaction: BaseTransaction): transaction is JournalEntry {
  return transaction.type === 'JOURNAL_ENTRY';
}

export function isBankTransfer(transaction: BaseTransaction): transaction is BankTransfer {
  return transaction.type === 'BANK_TRANSFER';
}

export function isExpenseClaim(transaction: BaseTransaction): transaction is ExpenseClaim {
  return transaction.type === 'EXPENSE_CLAIM';
}
