'use client';

/**
 * Submit Bill for Approval Dialog
 *
 * Wrapper around the generic SubmitForApprovalDialog for bills.
 * Maintained for backward compatibility.
 */

import { SubmitForApprovalDialog as GenericSubmitForApprovalDialog } from '@/components/accounting';
import type { VendorBill } from '@vapour/types';

interface SubmitBillForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  bill: VendorBill | null;
  onSuccess?: () => void;
}

export function SubmitBillForApprovalDialog({
  open,
  onClose,
  bill,
  onSuccess,
}: SubmitBillForApprovalDialogProps) {
  return (
    <GenericSubmitForApprovalDialog
      open={open}
      onClose={onClose}
      transaction={bill}
      transactionType="VENDOR_BILL"
      onSuccess={onSuccess}
      showAmountSummary
    />
  );
}
