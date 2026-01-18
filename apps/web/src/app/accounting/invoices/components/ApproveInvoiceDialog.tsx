'use client';

/**
 * Approve/Reject Invoice Dialog
 *
 * Wrapper around the generic ApproveTransactionDialog for invoices.
 * Maintained for backward compatibility.
 */

import { ApproveTransactionDialog } from '@/components/accounting';
import type { CustomerInvoice } from '@vapour/types';

interface ApproveInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: CustomerInvoice | null;
  onSuccess?: () => void;
}

export function ApproveInvoiceDialog({
  open,
  onClose,
  invoice,
  onSuccess,
}: ApproveInvoiceDialogProps) {
  return (
    <ApproveTransactionDialog
      open={open}
      onClose={onClose}
      transaction={invoice}
      transactionType="CUSTOMER_INVOICE"
      onSuccess={onSuccess}
    />
  );
}
