'use client';

/**
 * StandardDialogActions Component
 *
 * Standardized dialog footer with consistent spacing and button placement.
 * Use this instead of raw DialogActions for consistency across the app.
 *
 * @example
 * // Basic save/cancel
 * <StandardDialogActions
 *   onCancel={handleClose}
 *   onConfirm={handleSave}
 *   loading={saving}
 * />
 *
 * @example
 * // Approval dialog with approve/reject
 * <StandardDialogActions
 *   variant="approval"
 *   onCancel={handleClose}
 *   onReject={handleReject}
 *   onConfirm={handleApprove}
 *   loading={loading}
 *   loadingAction={action}
 * />
 */

import { DialogActions, Button, CircularProgress, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export interface StandardDialogActionsProps {
  /**
   * Cancel button handler
   */
  onCancel: () => void;

  /**
   * Primary action handler (Save, Confirm, Approve, etc.)
   */
  onConfirm?: () => void;

  /**
   * Secondary/destructive action handler (Reject, Delete)
   */
  onReject?: () => void;

  /**
   * Whether any action is loading
   */
  loading?: boolean;

  /**
   * Which action is currently loading (for multi-action dialogs)
   */
  loadingAction?: 'confirm' | 'reject' | 'cancel';

  /**
   * Whether the primary action is disabled
   */
  confirmDisabled?: boolean;

  /**
   * Dialog variant determines button colors and labels
   * - 'default': Cancel + primary confirm
   * - 'approval': Cancel + Reject + Approve
   * - 'destructive': Cancel + Delete (red)
   */
  variant?: 'default' | 'approval' | 'destructive';

  /**
   * Cancel button label
   */
  cancelLabel?: string;

  /**
   * Confirm button label
   */
  confirmLabel?: string;

  /**
   * Reject button label (for approval variant)
   */
  rejectLabel?: string;

  /**
   * Additional content to show before buttons (e.g., validation message)
   */
  beforeButtons?: ReactNode;

  /**
   * Whether to show all buttons in a vertical stack on mobile
   */
  stackOnMobile?: boolean;
}

export function StandardDialogActions({
  onCancel,
  onConfirm,
  onReject,
  loading = false,
  loadingAction,
  confirmDisabled = false,
  variant = 'default',
  cancelLabel = 'Cancel',
  confirmLabel,
  rejectLabel = 'Reject',
  beforeButtons,
  stackOnMobile = false,
}: StandardDialogActionsProps) {
  // Default confirm labels based on variant
  const defaultConfirmLabel =
    variant === 'approval' ? 'Approve' : variant === 'destructive' ? 'Delete' : 'Save';
  const finalConfirmLabel = confirmLabel ?? defaultConfirmLabel;

  // Determine button colors based on variant
  const confirmColor =
    variant === 'destructive' ? 'error' : variant === 'approval' ? 'success' : 'primary';
  const confirmVariant = variant === 'approval' ? 'contained' : 'contained';

  const isConfirmLoading = loading && (loadingAction === 'confirm' || !loadingAction);
  const isRejectLoading = loading && loadingAction === 'reject';

  return (
    <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
      {beforeButtons && (
        <Stack direction="row" sx={{ flex: 1 }}>
          {beforeButtons}
        </Stack>
      )}

      <Stack
        direction={{ xs: stackOnMobile ? 'column' : 'row', sm: 'row' }}
        spacing={1}
        sx={{ width: stackOnMobile ? '100%' : 'auto' }}
      >
        {/* Cancel button */}
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>

        {/* Reject button (approval variant) */}
        {variant === 'approval' && onReject && (
          <Button
            onClick={onReject}
            color="error"
            variant="outlined"
            disabled={loading}
            startIcon={isRejectLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isRejectLoading ? 'Rejecting...' : rejectLabel}
          </Button>
        )}

        {/* Primary action button */}
        {onConfirm && (
          <Button
            onClick={onConfirm}
            color={confirmColor}
            variant={confirmVariant}
            disabled={confirmDisabled || loading}
            startIcon={
              isConfirmLoading ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {isConfirmLoading
              ? variant === 'approval'
                ? 'Approving...'
                : variant === 'destructive'
                  ? 'Deleting...'
                  : 'Saving...'
              : finalConfirmLabel}
          </Button>
        )}
      </Stack>
    </DialogActions>
  );
}

export default StandardDialogActions;
