import type { BaseTransaction } from '@vapour/types';

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
}
