'use client';

/**
 * Create Revision Dialog
 *
 * Captures the reason for a new revision (e.g. "Client requested 24-month
 * warranty") and creates a fresh DRAFT proposal at revision N+1, inheriting
 * everything from the current revision. The previous revision is marked
 * isLatestRevision = false but stays readable for history.
 */

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createProposalRevision } from '@/lib/proposals/proposalService';
import type { Proposal } from '@vapour/types';

interface CreateRevisionDialogProps {
  open: boolean;
  proposal: Proposal;
  onClose: () => void;
  onComplete: (newProposalId: string) => void;
}

export default function CreateRevisionDialog({
  open,
  proposal,
  onClose,
  onComplete,
}: CreateRevisionDialogProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!db || !user || !proposal) return;
    if (!reason.trim()) {
      setError('Please describe what changed in this revision.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const next = await createProposalRevision(db, proposal.id, reason.trim(), user.uid);
      // Reset local state so a re-open starts clean.
      setReason('');
      onComplete(next.id);
    } catch (err) {
      console.error('Error creating revision', err);
      setError(err instanceof Error ? err.message : 'Failed to create revision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" />
        Create Revision {proposal.revision + 1} of {proposal.proposalNumber}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          A new <b>DRAFT</b> revision will be created with everything from the current revision
          (scope, costing, pricing, terms, cover letter, project brief) pre-filled. Edit the new
          draft, re-submit for approval when ready, then submit to the client. The previous revision
          stays readable for history.
        </DialogContentText>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Capturing the reason here keeps a clear audit trail of why each revision was made — useful
          for the next person on the deal and for contract disputes.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          required
          multiline
          minRows={3}
          maxRows={8}
          label="Reason for this revision"
          placeholder='e.g. "Client requested 24-month warranty period and revised payment milestones."'
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!reason.trim()}
        >
          Create Revision {proposal.revision + 1}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
