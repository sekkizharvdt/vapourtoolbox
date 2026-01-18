/**
 * Types for Vendor Payment Components
 *
 * Re-exports centralized payment constants.
 */

import type { VendorBill, PaymentAllocation } from '@vapour/types';

// Re-export from centralized constants
export { PAYMENT_METHODS, TDS_SECTIONS } from '@/lib/accounting/paymentConstants';

export interface BillAllocationTableProps {
  outstandingBills: VendorBill[];
  allocations: PaymentAllocation[];
  totalOutstanding: number;
  totalAllocated: number;
  amount: number;
  unallocated: number;
  onAllocationChange: (billId: string, allocatedAmount: number) => void;
  onAutoAllocate: () => void;
  onFillRemaining: (billId: string) => void;
}

export interface TDSSectionProps {
  tdsDeducted: boolean;
  setTdsDeducted: (value: boolean) => void;
  tdsSection: string;
  setTdsSection: (value: string) => void;
  tdsAmount: number;
  setTdsAmount: (value: number) => void;
  netPayment: number;
  amount: number;
}

export interface OutstandingBillsSummaryProps {
  entityId: string | null;
  loadingBills: boolean;
  outstandingBills: VendorBill[];
  totalOutstanding: number;
  onPayFullOutstanding: () => void;
}
