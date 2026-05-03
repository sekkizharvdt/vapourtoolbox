'use client';

/**
 * Terms & Conditions Editor (clause-card list).
 *
 * Each canonical clause is rendered as an editable card. The user can
 * include/exclude per deal, override the body text, reorder clauses,
 * reset a seeded clause to its canonical body, and add bespoke clauses.
 *
 * Old proposals carry only the legacy `terms` named-slot shape; on first
 * open this editor seeds them with `buildDefaultTermsBlocks()` and lifts
 * the legacy values into the matching clauses (warranty, LD, force
 * majeure, dispute resolution, customTerms) so nothing in flight is lost.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDownward as ArrowDownIcon,
  ArrowUpward as ArrowUpIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import {
  DEFAULT_TERMS_CLAUSES,
  buildDefaultTermsBlocks,
  newCustomTermsBlock,
} from '@/lib/proposals/termsBlocks';
import type {
  Proposal,
  ProposalTermsBlock,
  ProposalTermsBlockKey,
  TermsAndConditions,
} from '@vapour/types';

interface TermsEditorProps {
  proposalId: string;
}

/**
 * For an old proposal that has only the legacy `terms` shape, seed the
 * default termsBlocks and lift any non-empty legacy values into the
 * matching clauses so the user doesn't lose anything they'd typed.
 */
function lift(legacy: TermsAndConditions | undefined): ProposalTermsBlock[] {
  const blocks = buildDefaultTermsBlocks();
  if (!legacy) return blocks;
  const setBody = (key: ProposalTermsBlockKey, body?: string) => {
    if (!body) return;
    const block = blocks.find((b) => b.key === key);
    if (block) {
      block.body = body;
      block.included = true;
    }
  };
  setBody('WARRANTY', legacy.warranty);
  setBody('LIQUIDATED_DAMAGES', legacy.liquidatedDamages);
  setBody('FORCE_MAJEURE', legacy.forceMajeure);
  setBody('GOVERNING_LAW_AND_DISPUTE_RESOLUTION', legacy.disputeResolution);
  if (legacy.customTerms && legacy.customTerms.length > 0) {
    let nextOrder = blocks.length;
    for (const t of legacy.customTerms) {
      if (!t.trim()) continue;
      const c = newCustomTermsBlock(nextOrder++);
      c.body = t;
      c.title = 'Additional Term';
      blocks.push(c);
    }
  }
  return blocks;
}

const SEED_BODY_BY_KEY: Record<string, string> = Object.fromEntries(
  DEFAULT_TERMS_CLAUSES.map((c) => [c.key, c.body])
);

export default function TermsEditor({ proposalId }: TermsEditorProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [blocks, setBlocks] = useState<ProposalTermsBlock[]>([]);
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
        setBlocks(
          data.termsBlocks && data.termsBlocks.length > 0 ? data.termsBlocks : lift(data.terms)
        );
      } catch (err) {
        console.error('Error loading proposal terms', err);
        if (!cancelled) setError('Failed to load proposal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const sorted = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);

  const updateBlock = (id: string, patch: Partial<ProposalTermsBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setHasChanges(true);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setHasChanges(true);
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = [...sorted];
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx];
    const c = list[swap];
    if (!a || !c) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === a.id ? { ...b, order: c.order } : b.id === c.id ? { ...b, order: a.order } : b
      )
    );
    setHasChanges(true);
  };

  const resetBody = (id: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const seedBody = SEED_BODY_BY_KEY[b.key];
        return seedBody ? { ...b, body: seedBody } : b;
      })
    );
    setHasChanges(true);
  };

  const addCustom = () => {
    const nextOrder = blocks.length > 0 ? Math.max(...blocks.map((b) => b.order)) + 1 : 0;
    setBlocks((prev) => [...prev, newCustomTermsBlock(nextOrder)]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      setError(null);
      // Drop empty CUSTOM clauses on save so they don't pollute the PDF.
      const clean = blocks
        .filter((b) => b.key !== 'CUSTOM' || b.body.trim().length > 0)
        .map((b, i) => ({ ...b, order: i }));
      await updateProposal(
        db,
        proposalId,
        { termsBlocks: clean },
        user.uid,
        claims?.permissions ?? 0
      );
      setBlocks(clean);
      setHasChanges(false);
      toast.success('Terms & conditions saved');
    } catch (err) {
      console.error('Error saving terms', err);
      setError('Failed to save terms & conditions');
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

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Each clause is seeded from the canonical Vapour Desal template. Toggle the switch to include
        or exclude a clause from this proposal&apos;s offer; edit the body to tailor it to the deal.
        Use <em>Reset</em> on a seeded clause to restore the canonical text. Add custom clauses for
        one-off requirements.
      </Alert>

      <Stack spacing={2}>
        {sorted.map((block, idx) => {
          const isCustom = block.key === 'CUSTOM';
          const seeded = !!SEED_BODY_BY_KEY[block.key];
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;
          return (
            <Card
              key={block.id}
              variant="outlined"
              sx={{
                opacity: block.included ? 1 : 0.6,
                borderLeft: 4,
                borderLeftColor: block.included ? 'primary.main' : 'divider',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Switch
                    checked={block.included}
                    onChange={(e) => updateBlock(block.id, { included: e.target.checked })}
                    size="small"
                  />
                  {isCustom ? (
                    <TextField
                      placeholder="Clause title"
                      value={block.title}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                  ) : (
                    <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                      {idx + 1}. {block.title}
                    </Typography>
                  )}
                  <Tooltip title="Move up">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => move(block.id, -1)}
                        disabled={isFirst}
                        aria-label="Move clause up"
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => move(block.id, 1)}
                        disabled={isLast}
                        aria-label="Move clause down"
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {seeded && (
                    <Tooltip title="Reset body to canonical text">
                      <IconButton
                        size="small"
                        onClick={() => resetBody(block.id)}
                        aria-label="Reset clause body"
                      >
                        <ResetIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isCustom && (
                    <Tooltip title="Delete this custom clause">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeBlock(block.id)}
                        aria-label="Delete clause"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={20}
                  value={block.body}
                  onChange={(e) => updateBlock(block.id, { body: e.target.value })}
                  placeholder={isCustom ? 'Clause text…' : ''}
                  disabled={!block.included}
                />
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={addCustom}>
          Add custom clause
        </Button>
        <LoadingButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Terms
        </LoadingButton>
      </Box>
    </Box>
  );
}
