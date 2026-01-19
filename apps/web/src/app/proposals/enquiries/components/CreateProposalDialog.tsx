'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { addDays } from 'date-fns';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createMinimalProposal } from '@/lib/proposals/proposalService';
import type { Enquiry } from '@vapour/types';

interface CreateProposalDialogProps {
  open: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  onSuccess: (proposalId: string) => void;
}

export function CreateProposalDialog({
  open,
  onClose,
  enquiry,
  onSuccess,
}: CreateProposalDialogProps) {
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Form state - pre-filled from enquiry
  const [title, setTitle] = useState('');
  const [validityDate, setValidityDate] = useState<Date | null>(addDays(new Date(), 30));
  const [notes, setNotes] = useState('');

  // Pre-fill title when enquiry changes
  useEffect(() => {
    if (enquiry) {
      setTitle(enquiry.title);
    }
  }, [enquiry]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a proposal title');
      return;
    }
    if (!validityDate) {
      setError('Please select a validity date');
      return;
    }
    if (!db || !user?.uid || !claims?.entityId) {
      setError('Authentication required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const proposal = await createMinimalProposal(
        db,
        {
          entityId: claims.entityId,
          enquiryId: enquiry.id,
          title: title.trim(),
          clientId: enquiry.clientId,
          validityDate,
          notes: notes.trim() || undefined,
        },
        user.uid
      );

      onSuccess(proposal.id);
      handleClose();

      // Navigate to the proposal detail page
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle(enquiry?.title || '');
    setValidityDate(addDays(new Date(), 30));
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Create Proposal
        <Typography variant="body2" color="text.secondary">
          From {enquiry.enquiryNumber}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <Alert severity="info">
            This will create a new proposal linked to this enquiry. You can then define the scope,
            estimate costs, and set pricing in the dedicated sub-modules.
          </Alert>

          {/* Client Info (read-only) */}
          <Box>
            <Typography variant="caption" color="text.secondary">
              Client
            </Typography>
            <Typography variant="body1">{enquiry.clientName}</Typography>
          </Box>

          {/* Title */}
          <TextField
            fullWidth
            required
            label="Proposal Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            helperText="Pre-filled from enquiry title. Modify if needed."
          />

          {/* Validity Date */}
          <DatePicker
            label="Valid Until"
            value={validityDate}
            onChange={(date) => setValidityDate(date)}
            format="dd/MM/yyyy"
            minDate={new Date()}
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                helperText: 'The proposal will be valid until this date',
              },
            }}
          />

          {/* Notes */}
          <TextField
            fullWidth
            label="Initial Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            helperText="Any initial notes or context for this proposal"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
