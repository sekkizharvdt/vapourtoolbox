'use client';

/**
 * Project Brief Editor — "Description of the Project" tab.
 *
 * Edits the narrative that prints between the covering letter and the
 * scope. Combines three optional pieces:
 *   - description: free-form project narrative (purpose, approach)
 *   - inputData: parameter table (flow rate, temperature, etc.) for
 *     engineering proposals
 *   - clarifications: items the contractor IS doing but with specific
 *     assumptions (distinct from exclusions, which are out-of-scope)
 *
 * Pieces are independently optional. The PDF section renders only when
 * the user has put content in at least one piece AND `included !== false`.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, ProposalInputDataRow, ProposalProjectBrief } from '@vapour/types';

interface ProjectBriefEditorProps {
  proposalId: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ProjectBriefEditor({ proposalId }: ProjectBriefEditorProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [brief, setBrief] = useState<ProposalProjectBrief>({});
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
        setBrief(data.projectBrief ?? { included: true, inputData: [] });
      } catch (err) {
        console.error('Error loading project brief', err);
        if (!cancelled) setError('Failed to load proposal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const update = (patch: Partial<ProposalProjectBrief>) => {
    setBrief((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const updateRow = (id: string, patch: Partial<ProposalInputDataRow>) => {
    setBrief((prev) => ({
      ...prev,
      inputData: (prev.inputData ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    setHasChanges(true);
  };

  const addRow = () => {
    setBrief((prev) => ({
      ...prev,
      inputData: [...(prev.inputData ?? []), { id: newId(), parameter: '', value: '' }],
    }));
    setHasChanges(true);
  };

  const removeRow = (id: string) => {
    setBrief((prev) => ({
      ...prev,
      inputData: (prev.inputData ?? []).filter((r) => r.id !== id),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      setError(null);
      // Drop empty input-data rows on save so they don't pollute the PDF.
      const clean: ProposalProjectBrief = {
        ...brief,
        inputData: (brief.inputData ?? []).filter(
          (r) => r.parameter.trim().length > 0 || r.value.trim().length > 0
        ),
      };
      await updateProposal(
        db,
        proposalId,
        { projectBrief: clean },
        user.uid,
        claims?.permissions ?? 0
      );
      setBrief(clean);
      setHasChanges(false);
      toast.success('Project brief saved');
    } catch (err) {
      console.error('Error saving project brief', err);
      setError('Failed to save project brief');
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

  const rows = brief.inputData ?? [];
  const disabled = brief.included === false;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        The Description prints between the covering letter and the scope. Use it to explain the
        project context, the technical approach, and any specific assumptions. Each block is
        optional — leave a piece blank to skip it on the PDF.
      </Alert>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={brief.included !== false}
                onChange={(e) => update({ included: e.target.checked })}
              />
            }
            label="Include the Description section on the customer PDF"
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Description of the Project
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={5}
            maxRows={20}
            label="Project narrative"
            value={brief.description ?? ''}
            onChange={(e) => update({ description: e.target.value })}
            disabled={disabled}
            helperText="What the project is, what we're proposing, why it matters. Separate paragraphs with a blank line."
          />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Input Data Considered</Typography>
            <Tooltip title="Add a parameter row">
              <span>
                <IconButton size="small" onClick={addRow} disabled={disabled} aria-label="Add row">
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Optional engineering parameters (flow rate, temperature, density, etc.). Skip if not
            relevant.
          </Typography>
          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No parameters yet. Click + to add one.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '50%' }}>Parameter</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="e.g. Effluent flow rate"
                        value={row.parameter}
                        onChange={(e) => updateRow(row.id, { parameter: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="e.g. 135 m3/hour"
                        value={row.value}
                        onChange={(e) => updateRow(row.id, { value: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeRow(row.id)}
                        disabled={disabled}
                        aria-label="Remove row"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Clarifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Items we ARE doing but with specific assumptions or notes (distinct from exclusions).
            Group by equipment if helpful (e.g. &ldquo;Flash Evaporator 1: …&rdquo;).
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={20}
            label="Clarifications"
            value={brief.clarifications ?? ''}
            onChange={(e) => update({ clarifications: e.target.value })}
            disabled={disabled}
          />
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
          Save Description
        </LoadingButton>
      </Box>
    </Box>
  );
}
