import type { BaseTransaction, PaymentAllocation } from '@vapour/types';

export interface EntityTransaction extends BaseTransaction {
  entityId: string;
  entityName: string;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  paymentStatus?: string;
  invoiceDate?: Date;
  billDate?: Date;
  dueDate?: Date;
  // Base currency (INR) equivalents for foreign transactions
  totalBaseAmount?: number; // totalAmount in INR
  paidBaseAmount?: number; // paidAmount in INR
  outstandingBaseAmount?: number; // outstandingAmount in INR
  // Journal entry: entity-specific debit/credit computed during loading
  _journalDebit?: number;
  _journalCredit?: number;
  // Payment allocation arrays (present on payment transactions)
  invoiceAllocations?: PaymentAllocation[];
  billAllocations?: PaymentAllocation[];
}

/** Cross-reference entry: a payment applied to a specific bill/invoice */
export interface AllocationRef {
  paymentNumber: string;
  paymentDate: Date | string | { toDate: () => Date } | null;
  allocatedAmount: number;
}

export interface AgingBucket {
  current: number; // 0-30 days
  days31to60: number;
  days61to90: number;
  over90days: number;
}

export interface FinancialSummary {
  totalInvoiced: number;
  totalBilled: number;
  totalReceived: number;
  totalPaid: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  overdueReceivable: number;
  overduePayable: number;
  aging: AgingBucket;
  /** Opening balance at the start of the selected date range (from prior transactions) */
  openingBalance: number;
  /** Closing balance at the end of the selected date range */
  closingBalance: number;
}
