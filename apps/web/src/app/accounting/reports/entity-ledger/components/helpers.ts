import type { TransactionType } from '@vapour/types';

export const getTransactionTypeLabel = (type: TransactionType): string => {
  const labels: Record<TransactionType, string> = {
    CUSTOMER_INVOICE: 'Invoice',
    CUSTOMER_PAYMENT: 'Receipt',
    VENDOR_BILL: 'Bill',
    VENDOR_PAYMENT: 'Payment',
    JOURNAL_ENTRY: 'Journal',
    BANK_TRANSFER: 'Transfer',
    EXPENSE_CLAIM: 'Expense',
    DIRECT_PAYMENT: 'Direct',
  };
  return labels[type] || type;
};

export const getTransactionTypeColor = (
  type: TransactionType
): 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'default' => {
  switch (type) {
    case 'CUSTOMER_INVOICE':
      return 'primary';
    case 'CUSTOMER_PAYMENT':
      return 'success';
    case 'VENDOR_BILL':
      return 'warning';
    case 'VENDOR_PAYMENT':
      return 'info';
    case 'DIRECT_PAYMENT':
      return 'secondary';
    default:
      return 'default';
  }
};

export const getPaymentStatusColor = (
  status?: string
): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'OVERDUE':
      return 'error';
    case 'UNPAID':
    default:
      return 'default';
  }
};
