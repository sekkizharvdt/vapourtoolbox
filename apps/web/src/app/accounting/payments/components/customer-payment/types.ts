/**
 * Types for Customer Payment Components
 *
 * Re-exports centralized payment constants.
 */

import type { CustomerInvoice, PaymentAllocation } from '@vapour/types';

// Re-export from centralized constants
export { PAYMENT_METHODS, CURRENCIES } from '@/lib/accounting/paymentConstants';

export interface InvoiceAllocationTableProps {
  outstandingInvoices: CustomerInvoice[];
  allocations: PaymentAllocation[];
  totalAllocated: number;
  unallocated: number;
  onAllocationChange: (invoiceId: string, allocatedAmount: number) => void;
  onAutoAllocate: () => void;
  onFillRemaining: (invoiceId: string) => void;
}
