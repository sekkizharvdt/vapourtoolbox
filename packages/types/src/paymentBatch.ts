/**
 * Payment Batch Types
 *
 * The Payment Batch module enables fund allocation workflow where:
 * 1. Receipts (money received from projects/customers) are recorded
 * 2. Expenses (payments to be made) are allocated against those receipts
 * 3. Approval is obtained before payments are executed
 * 4. Interproject loans are automatically created when paying bills for other projects
 */

// ============================================
// Enums and Constants
// ============================================

/**
 * Status of a payment batch
 */
export type PaymentBatchStatus =
  | 'DRAFT' // Being prepared by accountant
  | 'PENDING_APPROVAL' // Submitted for approval
  | 'APPROVED' // Approved, ready to execute
  | 'EXECUTING' // Payments being processed
  | 'COMPLETED' // All payments made
  | 'REJECTED' // Approval rejected
  | 'CANCELLED'; // Cancelled by creator

/**
 * Source type for receipts
 */
export type BatchReceiptSourceType = 'CUSTOMER_PAYMENT' | 'OTHER_RECEIPT';

/**
 * Type of linked payment
 */
export type BatchPaymentLinkedType = 'VENDOR_BILL' | 'RECURRING' | 'MANUAL';

/**
 * Payee type for payments
 */
export type BatchPayeeType = 'VENDOR' | 'EMPLOYEE' | 'OTHER';

/**
 * Status of individual payment within a batch
 */
export type BatchPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'SKIPPED';

// ============================================
// Receipt Types
// ============================================

/**
 * A receipt (fund source) within a payment batch
 */
export interface BatchReceipt {
  /** Unique identifier */
  id: string;

  // Source linkage
  /** Type of receipt source */
  sourceType: BatchReceiptSourceType;
  /** Link to CustomerPayment transaction if sourceType is CUSTOMER_PAYMENT */
  sourceId?: string;

  // Details
  /** Human-readable description, e.g., "Desolenator USD 13,922 × 89.62" */
  description: string;
  /** Receipt amount in base currency */
  amount: number;
  /** Currency code (usually INR) */
  currency: string;

  // Project link (for interproject loan detection)
  /** Project ID if receipt is from a specific project */
  projectId?: string;
  /** Project name for display */
  projectName?: string;

  // Entity (customer)
  /** Customer entity ID */
  entityId?: string;
  /** Customer name for display */
  entityName?: string;

  // Dates
  /** Date the receipt was received */
  receiptDate: Date | string;
}

// ============================================
// Payment Types
// ============================================

/**
 * A payment (allocation) within a payment batch
 */
export interface BatchPayment {
  /** Unique identifier */
  id: string;

  // Link to existing records
  /** Type of linked record */
  linkedType?: BatchPaymentLinkedType;
  /** ID of linked Bill or Recurring Transaction */
  linkedId?: string;
  /** Reference number for display (bill number, recurring name) */
  linkedReference?: string;

  // Payee information
  /** Type of payee */
  payeeType: BatchPayeeType;
  /** Entity ID (vendor or employee) */
  entityId?: string;
  /** Payee name for display, e.g., "TryCAE", "Sathiyamoorthi" */
  entityName: string;

  // Amount
  /** Gross amount to pay */
  amount: number;
  /** Currency code */
  currency: string;

  // TDS Deductions
  /** TDS amount to deduct */
  tdsAmount?: number;
  /** TDS section, e.g., "194C", "194J" */
  tdsSection?: string;
  /** Net amount payable (amount - tdsAmount) */
  netPayable?: number;

  // Project link (for interproject loan detection)
  /** Project ID if this payment is for a specific project */
  projectId?: string;
  /** Project name for display */
  projectName?: string;

  // Payment status
  /** Current status of this payment */
  status: BatchPaymentStatus;
  /** ID of VendorPayment transaction created when paid */
  paidTransactionId?: string;
  /** Error message if payment failed */
  errorMessage?: string;

  // Notes
  /** Additional notes, e.g., "7500 TDS" */
  notes?: string;
}

// ============================================
// Payment Batch
// ============================================

/**
 * A payment batch groups receipts and payments for approval workflow
 */
export interface PaymentBatch {
  /** Unique identifier */
  id: string;
  /** Batch number for display, e.g., "PB-2026-0001" */
  batchNumber: string;

  // Receipts (fund sources)
  /** Array of receipts in this batch */
  receipts: BatchReceipt[];
  /** Sum of all receipt amounts */
  totalReceiptAmount: number;

  // Payments (allocations)
  /** Array of payments in this batch */
  payments: BatchPayment[];
  /** Sum of all payment amounts */
  totalPaymentAmount: number;

  // Balance tracking
  /** Remaining balance after all payments (receipts - payments) */
  remainingBalance: number;
  /** Projected bank balance after execution */
  bankBalanceAfter?: number;

  // Bank account
  /** Bank account ID for payments */
  bankAccountId: string;
  /** Bank account name for display */
  bankAccountName: string;

  // Status and workflow
  /** Current batch status */
  status: PaymentBatchStatus;
  /** User ID who created the batch */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Timestamp when submitted for approval */
  submittedAt?: Date | string;
  /** User ID who approved the batch */
  approvedBy?: string;
  /** Approval timestamp */
  approvedAt?: Date | string;
  /** Timestamp when execution completed */
  executedAt?: Date | string;
  /** Rejection reason if status is REJECTED */
  rejectionReason?: string;

  // Notes
  /** Batch-level notes */
  notes?: string;

  // Metadata
  /** Last update timestamp */
  updatedAt?: Date | string;
}

// ============================================
// Interproject Loan Tracking
// ============================================

/**
 * Tracks interproject loans created from a payment batch
 */
export interface InterprojectLoanFromBatch {
  /** Payment batch ID */
  batchId: string;
  /** Specific payment ID within the batch */
  batchPaymentId: string;
  /** Project providing funds (from receipt) */
  lendingProjectId: string;
  /** Project name for display */
  lendingProjectName: string;
  /** Project receiving funds (from payment) */
  borrowingProjectId: string;
  /** Project name for display */
  borrowingProjectName: string;
  /** Loan amount */
  amount: number;
  /** Currency */
  currency: string;
  /** ID of the created InterprojectLoan */
  loanId: string;
  /** Creation timestamp */
  createdAt: Date | string;
}

// ============================================
// Input Types for Service Functions
// ============================================

/**
 * Input for creating a new payment batch
 */
export interface CreatePaymentBatchInput {
  /** Bank account ID for payments */
  bankAccountId: string;
  /** Bank account name for display */
  bankAccountName: string;
  /** Initial notes */
  notes?: string;
}

/**
 * Input for adding a receipt to a batch
 */
export interface AddBatchReceiptInput {
  /** Type of receipt source */
  sourceType: BatchReceiptSourceType;
  /** Link to existing transaction */
  sourceId?: string;
  /** Description */
  description: string;
  /** Amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Project ID */
  projectId?: string;
  /** Project name */
  projectName?: string;
  /** Entity ID */
  entityId?: string;
  /** Entity name */
  entityName?: string;
  /** Receipt date */
  receiptDate: Date | string;
}

/**
 * Input for adding a payment to a batch
 */
export interface AddBatchPaymentInput {
  /** Linked type */
  linkedType?: BatchPaymentLinkedType;
  /** Linked ID */
  linkedId?: string;
  /** Linked reference */
  linkedReference?: string;
  /** Payee type */
  payeeType: BatchPayeeType;
  /** Entity ID */
  entityId?: string;
  /** Entity name */
  entityName: string;
  /** Amount */
  amount: number;
  /** Currency */
  currency: string;
  /** TDS amount */
  tdsAmount?: number;
  /** TDS section */
  tdsSection?: string;
  /** Project ID */
  projectId?: string;
  /** Project name */
  projectName?: string;
  /** Notes */
  notes?: string;
}

// ============================================
// Query Types
// ============================================

/**
 * Options for listing payment batches
 */
export interface ListPaymentBatchesOptions {
  /** Filter by status */
  status?: PaymentBatchStatus | PaymentBatchStatus[];
  /** Filter by creator */
  createdBy?: string;
  /** Filter by date range - start */
  startDate?: Date;
  /** Filter by date range - end */
  endDate?: Date;
  /** Limit results */
  limit?: number;
  /** Order by field */
  orderBy?: 'createdAt' | 'totalReceiptAmount' | 'status';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Summary statistics for payment batches
 */
export interface PaymentBatchStats {
  /** Total batches by status */
  byStatus: Record<PaymentBatchStatus, number>;
  /** Total amount pending approval */
  pendingApprovalAmount: number;
  /** Total amount approved (ready to execute) */
  approvedAmount: number;
  /** Total completed this month */
  completedThisMonth: number;
  /** Total amount paid this month */
  paidThisMonthAmount: number;
}
