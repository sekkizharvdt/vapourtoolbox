'use client';

/**
 * Terms & Conditions Editor
 * Standalone editor for warranty, performance bond, liquidated damages,
 * force majeure, dispute resolution, and custom terms.
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemSecondaryAction,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, TermsAndConditions } from '@vapour/types';

interface TermsEditorProps {
  proposalId: string;
}

export default function TermsEditor({ proposalId }: TermsEditorProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [warranty, setWarranty] = useState('');
  const [performanceBond, setPerformanceBond] = useState('');
  const [liquidatedDamages, setLiquidatedDamages] = useState('');
  const [forceMajeure, setForceMajeure] = useState('');
  const [disputeResolution, setDisputeResolution] = useState('');
  const [customTerms, setCustomTerms] = useState<string[]>([]);

  useEffect(() => {
    if (!db || !proposalId || proposalId === 'placeholder') return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        const data = await getProposalById(db, proposalId);
        if (!data) {
          setError('Proposal not found');
          return;
        }

        setProposal(data);

        if (data.terms) {
          setWarranty(data.terms.warranty || '');
          setPerformanceBond(data.terms.performanceBond || '');
          setLiquidatedDamages(data.terms.liquidatedDamages || '');
          setForceMajeure(data.terms.forceMajeure || '');
          setDisputeResolution(data.terms.disputeResolution || '');
          setCustomTerms(data.terms.customTerms || []);
        }
      } catch (err) {
        setError('Failed to load proposal');
        console.error('Error loading proposal:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [db, proposalId]);

  const handleAddTerm = () => {
    setCustomTerms((prev) => [...prev, '']);
  };

  const handleRemoveTerm = (index: number) => {
    setCustomTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTermChange = (index: number, value: string) => {
    setCustomTerms((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;

    try {
      setSaving(true);
      setError(null);

      const terms: Partial<TermsAndConditions> = {
        ...(warranty && { warranty }),
        ...(performanceBond && { performanceBond }),
        ...(liquidatedDamages && { liquidatedDamages }),
        ...(forceMajeure && { forceMajeure }),
        ...(disputeResolution && { disputeResolution }),
        customTerms: customTerms.filter((t) => t.trim() !== ''),
      };

      await updateProposal(db, proposalId, { terms }, user.uid);

      toast.success('Terms & conditions saved');
    } catch (err) {
      setError('Failed to save terms & conditions');
      toast.error('Failed to save');
      console.error('Error saving terms:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !proposal) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!proposal) {
    return <Alert severity="error">Proposal not found</Alert>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Warranty"
            fullWidth
            multiline
            rows={2}
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder="e.g., 12 months from commissioning or 18 months from supply..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Performance Bond"
            fullWidth
            multiline
            rows={2}
            value={performanceBond}
            onChange={(e) => setPerformanceBond(e.target.value)}
            placeholder="e.g., 10% of contract value..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Liquidated Damages"
            fullWidth
            multiline
            rows={2}
            value={liquidatedDamages}
            onChange={(e) => setLiquidatedDamages(e.target.value)}
            placeholder="e.g., 0.5% per week of delay..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Force Majeure"
            fullWidth
            multiline
            rows={2}
            value={forceMajeure}
            onChange={(e) => setForceMajeure(e.target.value)}
            placeholder="Standard clause applicable..."
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Dispute Resolution"
            fullWidth
            multiline
            rows={2}
            value={disputeResolution}
            onChange={(e) => setDisputeResolution(e.target.value)}
            placeholder="e.g., Arbitration under Indian Arbitration Act..."
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Custom Terms</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddTerm}>
          Add Term
        </Button>
      </Box>

      {customTerms.length > 0 ? (
        <Paper variant="outlined">
          <List>
            {customTerms.map((term, index) => (
              <ListItem key={index} divider={index < customTerms.length - 1}>
                <TextField
                  fullWidth
                  multiline
                  size="small"
                  variant="standard"
                  value={term}
                  onChange={(e) => handleTermChange(index, e.target.value)}
                  placeholder={`Term ${index + 1}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleRemoveTerm(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography color="text.secondary">
            No custom terms added. Add specific terms if required.
          </Typography>
        </Paper>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
        >
          Save Terms
        </LoadingButton>
      </Box>
    </Box>
  );
}
