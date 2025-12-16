/**
 * Types for Vendor Payment Components
 */

import type { VendorBill, PaymentAllocation, PaymentMethod } from '@vapour/types';

export interface BillAllocationTableProps {
  outstandingBills: VendorBill[];
  allocations: PaymentAllocation[];
  totalOutstanding: number;
  totalAllocated: number;
  amount: number;
  onAllocationChange: (billId: string, allocatedAmount: number) => void;
  onAutoAllocate: () => void;
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

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CHEQUE',
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'OTHER',
];

export const TDS_SECTIONS = [
  { code: '194C', name: 'Contractors - 2%', rate: 2 },
  { code: '194J', name: 'Professional Services - 10%', rate: 10 },
  { code: '194H', name: 'Commission/Brokerage - 5%', rate: 5 },
  { code: '194I', name: 'Rent - 10%', rate: 10 },
  { code: '194A', name: 'Interest (Other than Securities) - 10%', rate: 10 },
];
