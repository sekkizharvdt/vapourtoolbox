import type { TransactionType } from '@vapour/types';
import { TRANSACTION_TYPE_SHORT_LABELS } from '@vapour/constants';

export const getTransactionTypeLabel = (type: TransactionType): string => {
  return TRANSACTION_TYPE_SHORT_LABELS[type] || type;
};

export const TRANSACTION_TYPE_COLORS: Record<
  TransactionType,
  'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'default'
> = {
  CUSTOMER_INVOICE: 'primary',
  CUSTOMER_PAYMENT: 'success',
  VENDOR_BILL: 'warning',
  VENDOR_PAYMENT: 'info',
  JOURNAL_ENTRY: 'default',
  BANK_TRANSFER: 'info',
  EXPENSE_CLAIM: 'warning',
  DIRECT_PAYMENT: 'secondary',
  DIRECT_RECEIPT: 'success',
};

export const getTransactionTypeColor = (
  type: TransactionType
): 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'default' => {
  return TRANSACTION_TYPE_COLORS[type] || 'default';
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
