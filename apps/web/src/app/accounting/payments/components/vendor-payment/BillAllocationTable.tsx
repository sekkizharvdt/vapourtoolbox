'use client';

/**
 * Bill Allocation Table
 *
 * Wrapper around the generic TransactionAllocationTable for vendor bills.
 * Maintained for backward compatibility.
 */

import { TransactionAllocationTable } from '@/components/accounting';
import type { BillAllocationTableProps } from './types';

export function BillAllocationTable({
  outstandingBills,
  allocations,
  totalOutstanding,
  totalAllocated,
  amount,
  unallocated,
  onAllocationChange,
  onAutoAllocate,
  onFillRemaining,
}: BillAllocationTableProps) {
  return (
    <TransactionAllocationTable
      transactionType="bill"
      transactions={outstandingBills}
      allocations={allocations}
      totalAllocated={totalAllocated}
      totalOutstanding={totalOutstanding}
      unallocated={unallocated}
      paymentAmount={amount}
      onAllocationChange={onAllocationChange}
      onAutoAllocate={onAutoAllocate}
      onFillRemaining={onFillRemaining}
      variant="compact"
    />
  );
}
