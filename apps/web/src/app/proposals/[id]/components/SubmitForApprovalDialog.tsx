'use client';

/**
 * Submit For Approval Dialog
 *
 * The submitter picks a single approver from the list of users with
 * MANAGE_PROPOSALS permission (excluding themselves) and sends the
 * proposal for review. The selected approver receives an actionable
 * task notification; the submitter sees a "pending with X" indicator.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import {
  getProposalApproverCandidates,
  type ProposalApproverCandidate,
} from '@/lib/proposals/userHelpers';

interface SubmitForApprovalDialogProps {
  open: boolean;
  tenantId: string;
  submitterUserId: string;
  proposalNumber: string;
  proposalTitle: string;
  onClose: () => void;
  onSubmit: (approver: ProposalApproverCandidate) => Promise<void>;
}

export default function SubmitForApprovalDialog({
  open,
  tenantId,
  submitterUserId,
  proposalNumber,
  proposalTitle,
  onClose,
  onSubmit,
}: SubmitForApprovalDialogProps) {
  const db = useFirestore();
  const [candidates, setCandidates] = useState<ProposalApproverCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !db || !tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await getProposalApproverCandidates(db, tenantId, submitterUserId);
        if (cancelled) return;
        setCandidates(list);
        // Pre-select the first candidate so the user only has to click Send.
        if (list.length > 0 && list[0]) setSelectedId(list[0].id);
      } catch (err) {
        console.error('Error loading approver candidates', err);
        if (!cancelled) setError('Failed to load approvers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, db, tenantId, submitterUserId]);

  const handleConfirm = async () => {
    const approver = candidates.find((c) => c.id === selectedId);
    if (!approver) return;
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(approver);
      // Caller handles closing on success.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit for Approval</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose who in your team should review and approve{' '}
          <strong>
            {proposalNumber} — {proposalTitle}
          </strong>
          . They&apos;ll get an actionable task in their inbox.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : candidates.length === 0 ? (
          <Alert severity="warning">
            No other users with proposal-approval permission were found. Ask an admin to grant
            <strong> MANAGE_PROPOSALS</strong> to a teammate, or check that they&apos;re marked
            active.
          </Alert>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="approver-select-label">Approver</InputLabel>
            <Select
              labelId="approver-select-label"
              label="Approver"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={submitting}
            >
              {candidates.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.displayName}
                  {c.email ? ` — ${c.email}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          startIcon={<SendIcon />}
          onClick={handleConfirm}
          loading={submitting}
          disabled={!selectedId || candidates.length === 0}
        >
          Send for Approval
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
