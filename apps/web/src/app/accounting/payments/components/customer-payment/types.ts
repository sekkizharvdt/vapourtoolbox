/**
 * Types for Customer Payment Components
 */

import type { CustomerInvoice, PaymentAllocation, PaymentMethod } from '@vapour/types';

export interface InvoiceAllocationTableProps {
  outstandingInvoices: CustomerInvoice[];
  allocations: PaymentAllocation[];
  totalAllocated: number;
  unallocated: number;
  onAllocationChange: (invoiceId: string, allocatedAmount: number) => void;
  onAutoAllocate: () => void;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CHEQUE',
  'CASH',
  'OTHER',
];

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];
