'use client';

/**
 * Save As Template Dialog
 *
 * Dialog for saving the current proposal as a reusable template.
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
import { BookmarkAdd as TemplateIcon } from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createProposalTemplate } from '@/lib/proposals/proposalService';
import { useToast } from '@/components/common/Toast';
import type { Proposal } from '@vapour/types';

interface SaveAsTemplateDialogProps {
  open: boolean;
  proposal: Proposal;
  onClose: () => void;
  onComplete: () => void;
}

export function SaveAsTemplateDialog({
  open,
  proposal,
  onClose,
  onComplete,
}: SaveAsTemplateDialogProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(`${proposal.title} Template`);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [includeScope, setIncludeScope] = useState(true);
  const [includePricing, setIncludePricing] = useState(true);
  const [includeTerms, setIncludeTerms] = useState(true);
  const [includeDelivery, setIncludeDelivery] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!db || !user || !name.trim()) {
      setError('Please enter a name for the template');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createProposalTemplate(
        db,
        proposal,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          sourceProposalId: proposal.id,
          includeScope,
          includePricing,
          includeTerms,
          includeDelivery,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      toast.success('Template saved successfully!');
      onComplete();
      onClose();
    } catch (err) {
      console.error('[SaveAsTemplateDialog] Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setName(`${proposal.title} Template`);
      setDescription('');
      setCategory('');
      setIncludeScope(true);
      setIncludePricing(true);
      setIncludeTerms(true);
      setIncludeDelivery(true);
      setError(null);
      onClose();
    }
  };

  // Count items in proposal
  const scopeItemCount =
    proposal.unifiedScopeMatrix?.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0;
  const hasPricing = !!proposal.pricingConfig;
  const hasTerms = !!(proposal.terms && Object.keys(proposal.terms).length > 0);
  const hasDelivery = !!proposal.deliveryPeriod;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TemplateIcon />
          Save as Template
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
          </Box>

          <Divider />

          <TextField
            label="Template Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            disabled={saving}
            helperText="A descriptive name for this template"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            disabled={saving}
            placeholder="Brief description of what this template is for..."
          />

          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            disabled={saving}
            placeholder="e.g., Heat Exchanger, Condenser, General"
            helperText="Optional category for organizing templates"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              What to include:
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeScope}
                    onChange={(e) => setIncludeScope(e.target.checked)}
                    disabled={saving || scopeItemCount === 0}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Scope Matrix</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {scopeItemCount > 0
                        ? `${scopeItemCount} items (services, supply, exclusions)`
                        : 'No scope items defined'}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includePricing}
                    onChange={(e) => setIncludePricing(e.target.checked)}
                    disabled={saving || !hasPricing}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Pricing Defaults</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hasPricing
                        ? 'Markup percentages, tax rate, validity'
                        : 'No pricing configured'}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeTerms}
                    onChange={(e) => setIncludeTerms(e.target.checked)}
                    disabled={saving || !hasTerms}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Terms & Conditions</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hasTerms ? 'Warranty, guarantees, custom terms' : 'No terms defined'}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeDelivery}
                    onChange={(e) => setIncludeDelivery(e.target.checked)}
                    disabled={saving || !hasDelivery}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Delivery Period</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hasDelivery
                        ? `${proposal.deliveryPeriod?.durationInWeeks} weeks`
                        : 'No delivery period defined'}
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>

          <Alert severity="info">
            Templates save scope items without linked BOMs or cost data. Each new proposal created
            from this template will need its own estimation.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton
          onClick={handleSave}
          variant="contained"
          startIcon={<TemplateIcon />}
          loading={saving}
          disabled={!name.trim()}
        >
          Save Template
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
