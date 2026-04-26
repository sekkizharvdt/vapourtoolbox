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
  Stack,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { addDays } from 'date-fns';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createMinimalProposal } from '@/lib/proposals/proposalService';
import type { Enquiry } from '@vapour/types';
import { WORK_COMPONENT_LABELS } from '@vapour/constants';

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
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const [title, setTitle] = useState('');
  const [validityDate, setValidityDate] = useState<Date | null>(addDays(new Date(), 30));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (enquiry) {
      setTitle(enquiry.title);
    }
  }, [enquiry]);

  const inheritedComponents = enquiry.workComponents ?? [];
  const hasInheritedComponents = inheritedComponents.length > 0;

  const resetForm = () => {
    setTitle(enquiry?.title || '');
    setValidityDate(addDays(new Date(), 30));
    setNotes('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!hasInheritedComponents) {
      setError('Set the type of work on the enquiry before creating a proposal.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a proposal title.');
      return;
    }
    if (!validityDate) {
      setError('Please pick a validity date.');
      return;
    }
    if (!db || !user?.uid) {
      setError('Authentication required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const proposal = await createMinimalProposal(
        db,
        {
          tenantId: enquiry.tenantId,
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
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Start a new proposal
        <Typography variant="body2" color="text.secondary">
          From enquiry {enquiry.enquiryNumber} — {enquiry.clientName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={4} sx={{ pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Inherited type of work */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Type of work
            </Typography>
            {hasInheritedComponents ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {inheritedComponents.map((c) => (
                  <Chip key={c} label={WORK_COMPONENT_LABELS[c].title} color="primary" />
                ))}
                <Typography variant="body2" color="text.secondary">
                  Inherited from the enquiry. Edit it there if it needs to change.
                </Typography>
              </Stack>
            ) : (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                This enquiry doesn&apos;t have a type of work yet. Open the enquiry, set it, then
                come back.
              </Alert>
            )}
          </Box>

          {/* Title + validity + notes */}
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              required
              label="Proposal title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              helperText="Pre-filled from the enquiry — edit if you'd like."
            />

            <DatePicker
              label="Valid until"
              value={validityDate}
              onChange={(date) => setValidityDate(date)}
              format="dd/MM/yyyy"
              minDate={new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: 'How long the offer stands for the customer.',
                },
              }}
            />

            <TextField
              fullWidth
              label="Initial notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              helperText="Anything you'd like to remember about this proposal."
            />
          </Stack>

          <Alert severity="info" icon={false} sx={{ bgcolor: 'action.hover' }}>
            Internal costing is captured in ₹ INR. The currency the customer sees on the offer is
            decided on the Pricing tab when you finalise the quote.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !hasInheritedComponents}
        >
          {submitting ? 'Creating…' : 'Create proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
