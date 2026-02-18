'use client';

/**
 * Delivery & Milestones Editor
 * Standalone editor for delivery period and milestones with payment percentages.
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  Grid,
  InputAdornment,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProposalById,
  updateProposal,
  generatePaymentTermsFromMilestones,
} from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, ProposalMilestone, MilestoneTaxType } from '@vapour/types';
import { MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';

interface DeliveryEditorProps {
  proposalId: string;
}

export default function DeliveryEditor({ proposalId }: DeliveryEditorProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [durationInWeeks, setDurationInWeeks] = useState(4);
  const [description, setDescription] = useState('');
  const [milestones, setMilestones] = useState<ProposalMilestone[]>([]);

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

        if (data.deliveryPeriod) {
          setDurationInWeeks(data.deliveryPeriod.durationInWeeks || 4);
          setDescription(data.deliveryPeriod.description || '');
          setMilestones(data.deliveryPeriod.milestones || []);
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

  const paymentTotal = milestones.reduce((sum, m) => sum + (m.paymentPercentage ?? 0), 0);

  const handleAddMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        milestoneNumber: prev.length + 1,
        description: '',
        deliverable: '',
        durationInWeeks: 1,
        paymentPercentage: 0,
        taxType: 'EXCLUSIVE' as MilestoneTaxType,
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((m, i) => ({ ...m, milestoneNumber: i + 1 }));
    });
  };

  const handleMilestoneChange = (
    index: number,
    field: keyof ProposalMilestone,
    value: string | number
  ) => {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;

    try {
      setSaving(true);
      setError(null);

      const paymentTerms = generatePaymentTermsFromMilestones(milestones);

      await updateProposal(
        db,
        proposalId,
        {
          deliveryPeriod: {
            durationInWeeks,
            description,
            milestones,
          },
          ...(paymentTerms && {
            pricing: { paymentTerms },
          }),
        },
        user.uid
      );

      toast.success('Delivery timeline saved');
    } catch (err) {
      setError('Failed to save delivery timeline');
      toast.error('Failed to save');
      console.error('Error saving delivery:', err);
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
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Total Duration (Weeks)"
            type="number"
            fullWidth
            value={durationInWeeks}
            onChange={(e) => setDurationInWeeks(Number(e.target.value))}
            InputProps={{
              endAdornment: <InputAdornment position="end">Weeks</InputAdornment>,
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField
            label="Delivery Description"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Delivery will commence 2 weeks after receipt of advance payment..."
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Project Milestones</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddMilestone}>
          Add Milestone
        </Button>
      </Box>

      {milestones.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="5%">#</TableCell>
                <TableCell width="25%">Description</TableCell>
                <TableCell width="20%">Deliverable</TableCell>
                <TableCell width="10%">Duration (Wks)</TableCell>
                <TableCell width="12%">Payment %</TableCell>
                <TableCell width="15%">Tax</TableCell>
                <TableCell width="5%"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {milestones.map((milestone, index) => (
                <TableRow key={milestone.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      variant="standard"
                      value={milestone.description}
                      onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      variant="standard"
                      value={milestone.deliverable}
                      onChange={(e) => handleMilestoneChange(index, 'deliverable', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      variant="standard"
                      value={milestone.durationInWeeks}
                      onChange={(e) =>
                        handleMilestoneChange(index, 'durationInWeeks', Number(e.target.value))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      variant="standard"
                      value={milestone.paymentPercentage ?? 0}
                      onChange={(e) =>
                        handleMilestoneChange(index, 'paymentPercentage', Number(e.target.value))
                      }
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small" variant="standard">
                      <Select
                        value={milestone.taxType || 'EXCLUSIVE'}
                        onChange={(e) => handleMilestoneChange(index, 'taxType', e.target.value)}
                      >
                        {Object.entries(MILESTONE_TAX_TYPE_LABELS).map(([val, label]) => (
                          <MenuItem key={val} value={val}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveMilestone(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} align="right">
                  <Typography variant="body2" fontWeight="bold">
                    Total Payment:
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={Math.abs(paymentTotal - 100) < 0.01 ? 'success.main' : 'error.main'}
                  >
                    {paymentTotal.toFixed(1)}%
                  </Typography>
                </TableCell>
                <TableCell colSpan={2}>
                  {paymentTotal > 0 && Math.abs(paymentTotal - 100) >= 0.01 && (
                    <Typography variant="caption" color="error.main">
                      Must sum to 100%
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography color="text.secondary">
            No milestones defined. Add milestones to break down the project timeline.
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
          Save Delivery Timeline
        </LoadingButton>
      </Box>
    </Box>
  );
}
