'use client';

/**
 * Bills Table for Cost Centre
 *
 * Wrapper around the generic CostCentreTransactionTable for bills.
 * Maintained for backward compatibility.
 */

import { CostCentreTransactionTable } from '@/components/accounting';
import type { BaseTransaction } from '@vapour/types';

interface BillsTableProps {
  bills: BaseTransaction[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function BillsTable({ bills, formatCurrency, formatDate }: BillsTableProps) {
  return (
    <CostCentreTransactionTable
      transactionType="bill"
      transactions={bills}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
    />
  );
}
