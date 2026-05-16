'use client';

/**
 * Qualifications Editor — capability statement + key personnel + past
 * projects. Every tender we respond to demands this in some form. The
 * section prints on the customer PDF between the covering letter and
 * the project brief.
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
import type {
  Proposal,
  ProposalKeyPerson,
  ProposalPastProject,
  ProposalQualifications,
} from '@vapour/types';

interface QualificationsEditorProps {
  proposalId: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function QualificationsEditor({ proposalId }: QualificationsEditorProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [q, setQ] = useState<ProposalQualifications>({});
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
        setQ(
          data.qualifications ?? {
            statement: '',
            experienceHighlights: '',
            keyPersonnel: [],
            pastProjects: [],
            included: true,
          }
        );
      } catch (err) {
        console.error('Error loading qualifications', err);
        if (!cancelled) setError('Failed to load proposal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const update = (patch: Partial<ProposalQualifications>) => {
    setQ((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  // Key personnel ────────────────────────────────────────────────
  const addPerson = () => {
    const list = q.keyPersonnel ?? [];
    const next: ProposalKeyPerson = {
      id: newId(),
      name: '',
      role: '',
      qualification: '',
      experienceYears: undefined,
      bio: '',
      included: true,
      order: list.length,
    };
    update({ keyPersonnel: [...list, next] });
  };
  const updatePerson = (id: string, patch: Partial<ProposalKeyPerson>) => {
    update({
      keyPersonnel: (q.keyPersonnel ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };
  const removePerson = (id: string) => {
    update({ keyPersonnel: (q.keyPersonnel ?? []).filter((p) => p.id !== id) });
  };

  // Past projects ─────────────────────────────────────────────────
  const addProject = () => {
    const list = q.pastProjects ?? [];
    const next: ProposalPastProject = {
      id: newId(),
      name: '',
      client: '',
      year: '',
      value: '',
      scopeSummary: '',
      role: '',
      included: true,
      order: list.length,
    };
    update({ pastProjects: [...list, next] });
  };
  const updateProject = (id: string, patch: Partial<ProposalPastProject>) => {
    update({
      pastProjects: (q.pastProjects ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };
  const removeProject = (id: string) => {
    update({ pastProjects: (q.pastProjects ?? []).filter((p) => p.id !== id) });
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      setError(null);
      // Drop blank rows on save so they don't pollute the PDF.
      const clean: ProposalQualifications = {
        ...q,
        keyPersonnel: (q.keyPersonnel ?? [])
          .filter((p) => p.name.trim().length > 0)
          .map((p, i) => ({ ...p, order: i })),
        pastProjects: (q.pastProjects ?? [])
          .filter((p) => p.name.trim().length > 0)
          .map((p, i) => ({ ...p, order: i })),
      };
      await updateProposal(
        db,
        proposalId,
        { qualifications: clean },
        user.uid,
        claims?.permissions ?? 0
      );
      setQ(clean);
      setHasChanges(false);
      toast.success('Qualifications saved');
    } catch (err) {
      console.error('Error saving qualifications', err);
      setError('Failed to save qualifications');
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

  const personnel = q.keyPersonnel ?? [];
  const projects = q.pastProjects ?? [];
  const disabled = q.included === false;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Most tenders require a qualifications block — capability statement, named team with
        experience, and past-project references. This section prints between the covering letter and
        the project brief on the customer PDF. Leave fields empty to skip them; the whole section
        can be toggled off below.
      </Alert>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={q.included !== false}
                onChange={(e) => update({ included: e.target.checked })}
              />
            }
            label="Include Qualifications section on the customer PDF"
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Capability Statement
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
            label="Capability statement"
            value={q.statement ?? ''}
            onChange={(e) => update({ statement: e.target.value })}
            disabled={disabled}
            placeholder="One paragraph: who we are, what we do, what makes us qualified for this scope."
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            label="Experience highlights"
            value={q.experienceHighlights ?? ''}
            onChange={(e) => update({ experienceHighlights: e.target.value })}
            disabled={disabled}
            placeholder='e.g. "Established 2015 — 10+ years in MED desalination. ASME and IS code compliant. Past clients: BARC, NIOT, DCW Limited."'
          />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Key Personnel</Typography>
            <Tooltip title="Add a person">
              <span>
                <IconButton
                  size="small"
                  onClick={addPerson}
                  disabled={disabled}
                  aria-label="Add person"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Named team members the buyer will see (project lead, key engineers, draftsmen). Tenders
            that ask for CVs reference this list.
          </Typography>
          {personnel.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No personnel listed yet. Click + to add one.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {personnel.map((p) => (
                <Card key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Switch
                      size="small"
                      checked={p.included}
                      onChange={(e) => updatePerson(p.id, { included: e.target.checked })}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Included on PDF
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removePerson(p.id)}
                        disabled={disabled}
                        aria-label="Remove person"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Name"
                      value={p.name}
                      onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                      disabled={disabled}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Role"
                      value={p.role ?? ''}
                      onChange={(e) => updatePerson(p.id, { role: e.target.value })}
                      disabled={disabled}
                      placeholder="e.g. Project Lead, Senior Mech Engineer"
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Qualification"
                      value={p.qualification ?? ''}
                      onChange={(e) => updatePerson(p.id, { qualification: e.target.value })}
                      disabled={disabled}
                      placeholder="e.g. B.E. Mechanical, IIT Madras"
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Experience (yrs)"
                      value={p.experienceYears ?? ''}
                      onChange={(e) =>
                        updatePerson(p.id, {
                          experienceYears: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      disabled={disabled}
                      sx={{ minWidth: 140 }}
                    />
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={4}
                    size="small"
                    label="Bio / highlights"
                    value={p.bio ?? ''}
                    onChange={(e) => updatePerson(p.id, { bio: e.target.value })}
                    disabled={disabled}
                    placeholder="1-3 sentences on relevant projects and expertise."
                  />
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Past Projects / References</Typography>
            <Tooltip title="Add a project">
              <span>
                <IconButton
                  size="small"
                  onClick={addProject}
                  disabled={disabled}
                  aria-label="Add project"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Past projects the buyer can verify. Tenders typically ask for 3-5 references in similar
            scope from the past 5 years.
          </Typography>
          {projects.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No projects listed yet. Click + to add one.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {projects.map((p) => (
                <Card key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Switch
                      size="small"
                      checked={p.included}
                      onChange={(e) => updateProject(p.id, { included: e.target.checked })}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Included on PDF
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeProject(p.id)}
                        disabled={disabled}
                        aria-label="Remove project"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Project name"
                      value={p.name}
                      onChange={(e) => updateProject(p.id, { name: e.target.value })}
                      disabled={disabled}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Client"
                      value={p.client ?? ''}
                      onChange={(e) => updateProject(p.id, { client: e.target.value })}
                      disabled={disabled}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      label="Year"
                      value={p.year ?? ''}
                      onChange={(e) => updateProject(p.id, { year: e.target.value })}
                      disabled={disabled}
                      placeholder="2024"
                      sx={{ minWidth: 140 }}
                    />
                    <TextField
                      size="small"
                      label="Value"
                      value={p.value ?? ''}
                      onChange={(e) => updateProject(p.id, { value: e.target.value })}
                      disabled={disabled}
                      placeholder="₹5 Cr / USD 2 M / 1 MLD"
                      sx={{ minWidth: 180 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Our role"
                      value={p.role ?? ''}
                      onChange={(e) => updateProject(p.id, { role: e.target.value })}
                      disabled={disabled}
                      placeholder="Prime contractor / Consultant"
                    />
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    size="small"
                    label="Scope summary"
                    value={p.scopeSummary ?? ''}
                    onChange={(e) => updateProject(p.id, { scopeSummary: e.target.value })}
                    disabled={disabled}
                    placeholder="1-2 sentences on what we did."
                  />
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges || proposal?.status !== 'DRAFT'}
        >
          Save Qualifications
        </LoadingButton>
      </Box>
    </Box>
  );
}
