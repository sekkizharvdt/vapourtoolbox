'use client';

/**
 * Approve/Reject Bill Dialog
 *
 * Wrapper around the generic ApproveTransactionDialog for bills.
 * Maintained for backward compatibility.
 */

import { ApproveTransactionDialog } from '@/components/accounting';
import type { VendorBill } from '@vapour/types';

interface ApproveBillDialogProps {
  open: boolean;
  onClose: () => void;
  bill: VendorBill | null;
  onSuccess?: () => void;
}

export function ApproveBillDialog({ open, onClose, bill, onSuccess }: ApproveBillDialogProps) {
  return (
    <ApproveTransactionDialog
      open={open}
      onClose={onClose}
      transaction={bill}
      transactionType="VENDOR_BILL"
      onSuccess={onSuccess}
    />
  );
}
