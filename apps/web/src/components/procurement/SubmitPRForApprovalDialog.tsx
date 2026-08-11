'use client';

/**
 * SubmitPRForApprovalDialog — asks for the approver at the moment of submitting.
 *
 * The approver used to sit on the create form marked "required", above the line
 * items, even though a draft never needs one: validation only demanded it on
 * submit. Asking here matches when the answer is actually required, and gives
 * the line items back a screen's worth of space.
 *
 * Used by the New form and the Edit form; the detail page's own submit action
 * should adopt it too rather than growing a second copy (rule 32).
 */

import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { FormDialog } from '@vapour/ui';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';

interface SubmitPRForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resolves when the caller has saved and submitted; errors surface inline. */
  onConfirm: (approverId: string, approverName: string) => Promise<void>;
  /** PR number when it already exists; omitted while creating a new one. */
  prNumber?: string;
  /** User ids that cannot approve — always includes the submitter (rule 6). */
  excludeUserIds?: string[];
}

export function SubmitPRForApprovalDialog({
  open,
  onClose,
  onConfirm,
  prNumber,
  excludeUserIds = [],
}: SubmitPRForApprovalDialogProps) {
  const [approverId, setApproverId] = useState('');
  const [approverName, setApproverName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Re-sync on open so a second submit never inherits the first one's approver
  // (rule 14b).
  useEffect(() => {
    if (!open) return;
    setApproverId('');
    setApproverName('');
    setError(undefined);
    setSubmitting(false);
  }, [open]);

  const handleConfirm = async () => {
    if (!approverId) {
      setError('Select who should approve this purchase request.');
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await onConfirm(approverId, approverName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={prNumber ? `Submit ${prNumber} for approval` : 'Submit for approval'}
      maxWidth="sm"
      loading={submitting}
      error={error}
      onError={() => setError(undefined)}
      actions={
        <>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleConfirm}
            disabled={submitting || !approverId}
          >
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          The request moves to Pending Approval and the approver is notified. It cannot be edited
          again until they respond.
        </Typography>

        <ApproverSelector
          value={approverId || null}
          onChange={(userId) => setApproverId(userId || '')}
          onChangeWithName={(userId, displayName) => {
            setApproverId(userId || '');
            setApproverName(displayName || '');
          }}
          label="Approver"
          approvalType="pr"
          excludeUserIds={excludeUserIds}
          required
        />

        {excludeUserIds.length > 0 && (
          <Alert severity="info" variant="outlined">
            You cannot approve your own request.
          </Alert>
        )}
      </Stack>
    </FormDialog>
  );
}
