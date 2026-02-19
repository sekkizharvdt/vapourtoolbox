'use client';

/**
 * Clone Proposal Dialog
 *
 * Dialog for cloning an existing proposal to create a new one.
 * Allows selecting which sections to copy (scope, pricing, terms).
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  Alert,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { ContentCopy as CloneIcon } from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { cloneProposal } from '@/lib/proposals/proposalService';
import { useToast } from '@/components/common/Toast';
import type { Proposal } from '@vapour/types';

interface CloneProposalDialogProps {
  open: boolean;
  proposal: Proposal;
  onClose: () => void;
  onComplete: (newProposalId: string) => void;
}

export function CloneProposalDialog({
  open,
  proposal,
  onClose,
  onComplete,
}: CloneProposalDialogProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [newTitle, setNewTitle] = useState(`${proposal.title} (Copy)`);
  const [copyScope, setCopyScope] = useState(true);
  const [copyPricing, setCopyPricing] = useState(true);
  const [copyTerms, setCopyTerms] = useState(true);
  const [copyAttachments, setCopyAttachments] = useState(false);

  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClone = async () => {
    if (!db || !user || !newTitle.trim()) {
      setError('Please enter a title for the new proposal');
      return;
    }

    try {
      setCloning(true);
      setError(null);

      const newProposal = await cloneProposal(
        db,
        {
          sourceProposalId: proposal.id,
          newTitle: newTitle.trim(),
          copyScope,
          copyPricing,
          copyTerms,
          copyAttachments,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      toast.success(`Proposal cloned successfully! New number: ${newProposal.proposalNumber}`);
      onComplete(newProposal.id);
    } catch (err) {
      console.error('[CloneProposalDialog] Clone failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to clone proposal');
    } finally {
      setCloning(false);
    }
  };

  const handleClose = () => {
    if (!cloning) {
      setNewTitle(`${proposal.title} (Copy)`);
      setCopyScope(true);
      setCopyPricing(true);
      setCopyTerms(true);
      setCopyAttachments(false);
      setError(null);
      onClose();
    }
  };

  // Count what will be cloned
  const scopeItemCount =
    proposal.unifiedScopeMatrix?.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0;
  const attachmentCount = proposal.attachments?.length || 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloneIcon />
          Clone Proposal
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Source Proposal
            </Typography>
            <Typography variant="subtitle1" fontWeight="medium">
              {proposal.proposalNumber} - {proposal.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Client: {proposal.clientName}
            </Typography>
          </Box>

          <Divider />

          <TextField
            label="New Proposal Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            fullWidth
            required
            disabled={cloning}
            helperText="A new proposal number will be generated automatically"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              What to copy:
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyScope}
                    onChange={(e) => setCopyScope(e.target.checked)}
                    disabled={cloning}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Scope Matrix</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {scopeItemCount} items (services, supply, exclusions)
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyPricing}
                    onChange={(e) => setCopyPricing(e.target.checked)}
                    disabled={cloning}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Pricing Configuration</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Margins, tax settings, payment terms
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyTerms}
                    onChange={(e) => setCopyTerms(e.target.checked)}
                    disabled={cloning}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Terms & Conditions</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Warranty, guarantees, custom terms
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyAttachments}
                    onChange={(e) => setCopyAttachments(e.target.checked)}
                    disabled={cloning}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Attachments</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {attachmentCount} files (drawings, specs, etc.)
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>

          <Alert severity="info">
            The new proposal will be created in <strong>DRAFT</strong> status with the same client
            and enquiry reference. Scope and pricing completion status will be reset.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={cloning}>
          Cancel
        </Button>
        <LoadingButton
          onClick={handleClone}
          variant="contained"
          startIcon={<CloneIcon />}
          loading={cloning}
          disabled={!newTitle.trim()}
        >
          Clone Proposal
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
