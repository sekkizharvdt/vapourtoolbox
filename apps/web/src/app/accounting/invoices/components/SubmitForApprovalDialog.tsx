'use client';

/**
 * Submit Invoice for Approval Dialog
 *
 * Wrapper around the generic SubmitForApprovalDialog for invoices.
 * Maintained for backward compatibility.
 */

import { SubmitForApprovalDialog as GenericSubmitForApprovalDialog } from '@/components/accounting';
import type { CustomerInvoice } from '@vapour/types';

interface SubmitForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: CustomerInvoice | null;
  onSuccess?: () => void;
}

export function SubmitForApprovalDialog({
  open,
  onClose,
  invoice,
  onSuccess,
}: SubmitForApprovalDialogProps) {
  return (
    <GenericSubmitForApprovalDialog
      open={open}
      onClose={onClose}
      transaction={invoice}
      transactionType="CUSTOMER_INVOICE"
      onSuccess={onSuccess}
    />
  );
}
