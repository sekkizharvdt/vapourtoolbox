'use client';

/**
 * Compliance Matrix Editor
 *
 * For EPC-style tenders that enumerate 20-100 detailed specs (material,
 * design pressure, tube length, no. of effects, …) and demand a
 * "Complies / Deviation / N/A" response per clause. The whole section
 * is optional and disabled by default; the user enables it for tenders
 * that need it.
 *
 * Renders on the customer PDF as a table between Scope and the
 * Commercial Summary. Hides automatically when there are no items.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddCircleOutline as AddRowIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type {
  ComplianceStatus,
  Proposal,
  ProposalComplianceItem,
  ProposalComplianceMatrix,
} from '@vapour/types';

interface ComplianceMatrixEditorProps {
  proposalId: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const STATUS_OPTIONS: { value: ComplianceStatus; label: string }[] = [
  { value: 'COMPLIES', label: 'Complies' },
  { value: 'DEVIATION', label: 'Deviation' },
  { value: 'NA', label: 'N/A' },
];

export default function ComplianceMatrixEditor({ proposalId }: ComplianceMatrixEditorProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [matrix, setMatrix] = useState<ProposalComplianceMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!db || !proposalId || proposalId === 'placeholder') return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getProposalById(db, proposalId);
        if (cancelled) return;
        if (!data) {
          setError('Proposal not found');
          return;
        }
        setProposal(data);
        setMatrix(data.complianceMatrix ?? { preamble: '', items: [], included: false });
      } catch (err) {
        console.error('Error loading compliance matrix', err);
        if (!cancelled) setError('Failed to load proposal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const update = (patch: Partial<ProposalComplianceMatrix>) => {
    setMatrix((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const updateItem = (id: string, patch: Partial<ProposalComplianceItem>) => {
    update({
      items: (matrix.items ?? []).map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  };
  const addItem = () => {
    const list = matrix.items ?? [];
    update({
      items: [
        ...list,
        {
          id: newId(),
          clauseRef: '',
          requirement: '',
          offered: '',
          status: 'COMPLIES',
          remarks: '',
          order: list.length,
        },
      ],
    });
  };
  const removeItem = (id: string) => {
    update({ items: (matrix.items ?? []).filter((it) => it.id !== id) });
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      setError(null);
      const clean: ProposalComplianceMatrix = {
        ...matrix,
        items: (matrix.items ?? [])
          .filter((it) => it.requirement.trim().length > 0)
          .map((it, i) => ({ ...it, order: i })),
      };
      await updateProposal(
        db,
        proposalId,
        { complianceMatrix: clean },
        user.uid,
        claims?.permissions ?? 0
      );
      setMatrix(clean);
      setHasChanges(false);
      toast.success('Compliance matrix saved');
    } catch (err) {
      console.error('Error saving compliance matrix', err);
      setError('Failed to save compliance matrix');
      toast.error('Failed to save');
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

  const items = matrix.items ?? [];
  const disabled = matrix.included === false;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Use this on tenders that enumerate detailed technical specs and demand a clause-by-clause
        response (typically EPC bids). Skip it for surveys / engineering proposals — leave the
        toggle off and the section won&apos;t print.
      </Alert>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={matrix.included !== false}
                onChange={(e) => update({ included: e.target.checked })}
              />
            }
            label="Include Compliance Matrix section on the customer PDF"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            label="Preamble (optional)"
            value={matrix.preamble ?? ''}
            onChange={(e) => update({ preamble: e.target.value })}
            disabled={disabled}
            placeholder='e.g. "We confirm compliance with the technical specifications as detailed below. Deviations, where indicated, are explained in the remarks column."'
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1">Compliance Items</Typography>
              <Typography variant="body2" color="text.secondary">
                One row per spec clause. Capture the requirement, what we&apos;re offering,
                compliance status, and any remarks.
              </Typography>
            </Box>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>Clause</TableCell>
                  <TableCell>Requirement</TableCell>
                  <TableCell>Our Offer</TableCell>
                  <TableCell sx={{ width: 140 }}>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No items yet — add a row to begin.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        value={row.clauseRef ?? ''}
                        onChange={(e) => updateItem(row.id, { clauseRef: e.target.value })}
                        disabled={disabled}
                        placeholder="7.2.1"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        multiline
                        value={row.requirement}
                        onChange={(e) => updateItem(row.id, { requirement: e.target.value })}
                        disabled={disabled}
                        placeholder="e.g. Tube material Cupronickel 90/10"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        multiline
                        value={row.offered ?? ''}
                        onChange={(e) => updateItem(row.id, { offered: e.target.value })}
                        disabled={disabled}
                        placeholder="Offered: Cupronickel 90/10"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        variant="standard"
                        value={row.status}
                        onChange={(e) =>
                          updateItem(row.id, { status: e.target.value as ComplianceStatus })
                        }
                        disabled={disabled}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        multiline
                        value={row.remarks ?? ''}
                        onChange={(e) => updateItem(row.id, { remarks: e.target.value })}
                        disabled={disabled}
                        placeholder="explanation / superior alternative"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove row">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeItem(row.id)}
                          disabled={disabled}
                          aria-label="Remove row"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1 }}>
            <Button startIcon={<AddRowIcon />} size="small" onClick={addItem} disabled={disabled}>
              Add row
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Compliance Matrix
        </LoadingButton>
      </Box>
    </Box>
  );
}
