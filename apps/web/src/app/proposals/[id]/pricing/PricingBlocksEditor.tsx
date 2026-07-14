'use client';

/**
 * Pricing Blocks Editor (Stage 2)
 *
 * Replaces the legacy margin-based PricingEditorClient. Renders the proposal's
 * `pricingBlocks` as a stack of editable cards; each block knows its kind
 * (Manpower roster, Per-manday cost, Lump sum, BOM cost sheet) and its
 * audience (Client / Internal / Both). Subtotals roll up at the bottom.
 */

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
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
  Add as AddIcon,
  AddCircleOutline as AddRowIcon,
  Delete as DeleteIcon,
  LinkOff as UnlinkIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import type { Firestore } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import {
  recomputeBlockSubtotal,
  createManpowerBlock,
  createPerMandayBlock,
  createLumpSumBlock,
  createBOMCostSheetBlock,
  bomToSnapshot,
  linkBomToBlock,
  unlinkBomFromBlock,
  refreshBomSnapshots,
} from '@/lib/proposals/pricingBlocks';
import { getBOMById, setBOMProposalLink, clearBOMProposalLink } from '@/lib/bom/bomService';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import BOMPickerDialog from '@/components/bom/BOMPickerDialog';
import { useToast } from '@/components/common/Toast';
import { formatCurrency } from '@/lib/utils/formatters';
import { CURRENCIES } from '@vapour/constants';
import type {
  BOM,
  PricingBlock,
  ManpowerRosterBlock,
  PerMandayCostBlock,
  LumpSumLinesBlock,
  BOMCostSheetBlock,
  LinkedBomSnapshot,
  Proposal,
  CurrencyCode,
} from '@vapour/types';

interface Props {
  proposalId?: string;
  embedded?: boolean;
}

const newId = (): string => Math.random().toString(36).slice(2, 11);

const blockKindLabels = {
  MANPOWER_ROSTER: 'Manpower roster',
  PER_MANDAY_COST: 'Site costs (per manday)',
  LUMP_SUM_LINES: 'Lump-sum lines',
  BOM_COST_SHEET: 'Equipment from estimation',
} as const;

/**
 * Fetch the current summary.totalCost of every BOM linked by any
 * BOM_COST_SHEET block and rebuild the snapshots. BOMs that fail to fetch
 * (deleted, permission) keep their last-known snapshot via
 * refreshBomSnapshots' merge, so the cost basis never silently zeroes.
 */
async function refreshLinkedBomBlocks(
  db: Firestore,
  blocks: PricingBlock[]
): Promise<{ blocks: PricingBlock[]; changed: boolean }> {
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.kind === 'BOM_COST_SHEET') b.linkedBomIds.forEach((id) => ids.add(id));
  }
  if (ids.size === 0) return { blocks, changed: false };

  const fresh: LinkedBomSnapshot[] = [];
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const bom = await getBOMById(db, id);
        if (bom) fresh.push(bomToSnapshot(bom));
      } catch (err) {
        // Graceful degrade: keep the stale snapshot for this BOM.
        console.warn('[PricingBlocksEditor] BOM snapshot refresh failed', id, err);
      }
    })
  );

  const next = blocks.map((b) => (b.kind === 'BOM_COST_SHEET' ? refreshBomSnapshots(b, fresh) : b));
  const changed = JSON.stringify(next) !== JSON.stringify(blocks);
  return { blocks: next, changed };
}

export default function PricingBlocksEditor({ proposalId: propId }: Props = {}) {
  const pathname = usePathname();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [pathId, setPathId] = useState<string | null>(null);
  const proposalId = propId ?? pathId;

  useEffect(() => {
    if (propId || !pathname) return;
    const match = pathname.match(/\/proposals\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') setPathId(extracted);
  }, [pathname, propId]);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [blocks, setBlocks] = useState<PricingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useUnsavedChangesWarning(dirty);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!db || !proposalId) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const p = await getProposalById(db, proposalId);
        if (cancelled) return;
        if (!p) {
          setError('Proposal not found.');
          return;
        }
        setProposal(p);
        setBlocks(p.pricingBlocks ?? []);

        // Rule 13 sync strategy: automatically refresh linked-BOM cost
        // snapshots when the Costing tab loads. Only for DRAFT proposals —
        // a submitted/accepted quote's cost basis stays frozen as saved.
        if (p.status === 'DRAFT') {
          const refreshed = await refreshLinkedBomBlocks(db, p.pricingBlocks ?? []);
          if (cancelled) return;
          if (refreshed.changed) {
            setBlocks(refreshed.blocks);
            setDirty(true); // costs moved since last save — prompt a re-save
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PricingBlocksEditor] load failed', err);
          setError('Failed to load proposal.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const currency: CurrencyCode = proposal?.nativeCurrency ?? 'INR';

  const costBasis = useMemo(() => blocks.reduce((s, b) => s + (b.subtotal || 0), 0), [blocks]);

  const updateBlock = (id: string, updater: (b: PricingBlock) => PricingBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? recomputeBlockSubtotal(updater(b)) : b)));
    setDirty(true);
  };

  const removeBlock = (id: string) => {
    const removed = blocks.find((b) => b.id === id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDirty(true);
    // Removing a BOM cost sheet unlinks its BOMs — clear their back-links
    // (only where they still point at this proposal). Best-effort: a failed
    // clear leaves a stale chip on the BOM, never blocks the block removal.
    if (removed?.kind === 'BOM_COST_SHEET' && db && user && proposal) {
      for (const bomId of removed.linkedBomIds) {
        retryOnStaleToken(() => clearBOMProposalLink(db, bomId, proposal.id, user.uid)).catch(
          (err) => console.error('[PricingBlocksEditor] failed to clear BOM back-link', bomId, err)
        );
      }
    }
  };

  const addBlock = (kind: PricingBlock['kind']) => {
    setAddAnchor(null);
    let block: PricingBlock;
    if (kind === 'MANPOWER_ROSTER') {
      block = createManpowerBlock(currency, 'INTERNAL', 'Manpower');
    } else if (kind === 'PER_MANDAY_COST') {
      block = createPerMandayBlock(currency, 'INTERNAL', 'Site costs');
    } else if (kind === 'LUMP_SUM_LINES') {
      block = createLumpSumBlock(currency, 'INTERNAL', 'Internal lump-sum costs');
    } else {
      block = createBOMCostSheetBlock(currency, 'INTERNAL', 'Equipment from estimation');
    }
    setBlocks((prev) => [...prev, block]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      await updateProposal(
        db,
        proposal.id,
        { pricingBlocks: blocks },
        user.uid,
        claims?.permissions ?? 0
      );
      setDirty(false);
      toast.success('Pricing saved');
    } catch (err) {
      console.error('[PricingBlocksEditor] save failed', err);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h6">Costing</Typography>
          <Typography variant="body2" color="text.secondary">
            Internal cost basis in {CURRENCIES[currency].symbol} {currency}. Never shown to the
            client. Markup, lump-sum lines, and tax live on the Pricing tab.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={(e) => setAddAnchor(e.currentTarget)}
          >
            Add block
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!dirty || saving || proposal?.status !== 'DRAFT'}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
        <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
          <MenuItem onClick={() => addBlock('MANPOWER_ROSTER')}>Manpower roster</MenuItem>
          <MenuItem onClick={() => addBlock('PER_MANDAY_COST')}>Site costs (per manday)</MenuItem>
          <MenuItem onClick={() => addBlock('LUMP_SUM_LINES')}>Lump-sum lines</MenuItem>
          <MenuItem onClick={() => addBlock('BOM_COST_SHEET')}>Equipment from estimation</MenuItem>
        </Menu>
      </Stack>

      {blocks.length === 0 ? (
        <Alert severity="info">
          No pricing blocks yet. Use <strong>Add block</strong> above to start.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              currency={currency}
              proposal={proposal}
              onChange={(updater) => updateBlock(block.id, updater)}
              onRemove={() => removeBlock(block.id)}
            />
          ))}
        </Stack>
      )}

      {/* Cost basis */}
      <Paper variant="outlined" sx={{ p: 2.5, mt: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Internal cost basis
            </Typography>
            <Typography variant="h5">{formatCurrency(costBasis, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Carried into the Pricing tab as the basis for markup.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

/* ─── Block card ──────────────────────────────────────────────────────── */

interface BlockCardProps {
  block: PricingBlock;
  currency: CurrencyCode;
  proposal: Proposal | null;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
  onRemove: () => void;
}

function BlockCard({ block, currency, proposal, onChange, onRemove }: BlockCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              variant="standard"
              value={block.label ?? ''}
              placeholder={blockKindLabels[block.kind]}
              onChange={(e) => onChange((b) => ({ ...b, label: e.target.value }))}
              sx={{ minWidth: 200 }}
              InputProps={{ disableUnderline: false, sx: { fontWeight: 500, fontSize: '1rem' } }}
            />
            <Chip label={blockKindLabels[block.kind]} size="small" variant="outlined" />
          </Stack>
          <Tooltip title="Remove this block">
            <IconButton onClick={onRemove} size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {block.kind === 'MANPOWER_ROSTER' && (
          <ManpowerEditor block={block} currency={currency} onChange={onChange} />
        )}
        {block.kind === 'PER_MANDAY_COST' && (
          <PerMandayEditor block={block} currency={currency} onChange={onChange} />
        )}
        {block.kind === 'LUMP_SUM_LINES' && <LumpSumEditor block={block} onChange={onChange} />}
        {block.kind === 'BOM_COST_SHEET' && (
          <BOMCostSheetEditor
            block={block}
            currency={currency}
            proposal={proposal}
            onChange={onChange}
          />
        )}

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Typography variant="subtitle1">
            Subtotal: <strong>{formatCurrency(block.subtotal || 0, currency)}</strong>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ─── Manpower roster editor ──────────────────────────────────────────── */

function ManpowerEditor({
  block,
  currency,
  onChange,
}: {
  block: ManpowerRosterBlock;
  currency: CurrencyCode;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
}) {
  const setRows = (rows: ManpowerRosterBlock['rows']) =>
    onChange((b) => ({ ...(b as ManpowerRosterBlock), rows }));

  const addRow = () =>
    setRows([...block.rows, { id: newId(), role: '', mandays: 0, dayRate: 0, total: 0 }]);

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Role</TableCell>
              <TableCell>Person (optional)</TableCell>
              <TableCell align="right">Mandays</TableCell>
              <TableCell align="right">Day rate</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {block.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No rows yet — add one below.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {block.rows.map((row, idx) => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    variant="standard"
                    value={row.role}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, role: e.target.value };
                      setRows(rows);
                    }}
                    placeholder="e.g. Senior Engineer"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    variant="standard"
                    value={row.personName ?? ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, personName: e.target.value };
                      setRows(rows);
                    }}
                    placeholder="Name"
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    value={row.mandays || ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, mandays: parseFloat(e.target.value) || 0 };
                      setRows(rows);
                    }}
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    value={row.dayRate || ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, dayRate: parseFloat(e.target.value) || 0 };
                      setRows(rows);
                    }}
                    sx={{ width: 110 }}
                    inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">{formatCurrency(row.total || 0, currency)}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => setRows(block.rows.filter((r) => r.id !== row.id))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1 }}>
        <Button startIcon={<AddRowIcon />} size="small" onClick={addRow}>
          Add row
        </Button>
      </Box>
    </>
  );
}

/* ─── Per-manday cost editor ──────────────────────────────────────────── */

function PerMandayEditor({
  block,
  currency,
  onChange,
}: {
  block: PerMandayCostBlock;
  currency: CurrencyCode;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
}) {
  const setRows = (rows: PerMandayCostBlock['rows']) =>
    onChange((b) => ({ ...(b as PerMandayCostBlock), rows }));

  const addRow = () =>
    setRows([
      ...block.rows,
      { id: newId(), description: '', mandays: 0, ratePerManday: 0, total: 0 },
    ]);

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Mandays</TableCell>
              <TableCell align="right">Rate / manday</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {block.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No rows yet — add one below.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {block.rows.map((row, idx) => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    variant="standard"
                    value={row.description}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, description: e.target.value };
                      setRows(rows);
                    }}
                    placeholder="e.g. Accommodation"
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    value={row.mandays || ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, mandays: parseFloat(e.target.value) || 0 };
                      setRows(rows);
                    }}
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    value={row.ratePerManday || ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, ratePerManday: parseFloat(e.target.value) || 0 };
                      setRows(rows);
                    }}
                    sx={{ width: 110 }}
                    inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">{formatCurrency(row.total || 0, currency)}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => setRows(block.rows.filter((r) => r.id !== row.id))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1 }}>
        <Button startIcon={<AddRowIcon />} size="small" onClick={addRow}>
          Add row
        </Button>
      </Box>
    </>
  );
}

/* ─── Lump-sum editor ─────────────────────────────────────────────────── */

function LumpSumEditor({
  block,
  onChange,
}: {
  block: LumpSumLinesBlock;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
}) {
  const setRows = (rows: LumpSumLinesBlock['rows']) =>
    onChange((b) => ({ ...(b as LumpSumLinesBlock), rows }));

  const addRow = () => setRows([...block.rows, { id: newId(), description: '', amount: 0 }]);

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {block.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No lines yet — add one below.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {block.rows.map((row, idx) => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    variant="standard"
                    value={row.description}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, description: e.target.value };
                      setRows(rows);
                    }}
                    placeholder="e.g. Admin charges"
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    value={row.amount || ''}
                    onChange={(e) => {
                      const rows = [...block.rows];
                      rows[idx] = { ...row, amount: parseFloat(e.target.value) || 0 };
                      setRows(rows);
                    }}
                    sx={{ width: 140 }}
                    inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => setRows(block.rows.filter((r) => r.id !== row.id))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1 }}>
        <Button startIcon={<AddRowIcon />} size="small" onClick={addRow}>
          Add row
        </Button>
      </Box>
    </>
  );
}

/* ─── BOM cost sheet editor ───────────────────────────────────────────── */

function BOMCostSheetEditor({
  block,
  currency,
  proposal,
  onChange,
}: {
  block: BOMCostSheetBlock;
  currency: CurrencyCode;
  proposal: Proposal | null;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
}) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Snapshots in linked order — the render source for the table rows.
  const snapshots = useMemo(() => {
    const byId = new Map((block.linkedBomSnapshots ?? []).map((s) => [s.bomId, s]));
    return block.linkedBomIds
      .map((id) => byId.get(id))
      .filter((s): s is LinkedBomSnapshot => s !== undefined);
  }, [block]);

  const handlePicked = async (boms: BOM[]) => {
    if (boms.length === 0) return;
    // Link + snapshot + subtotal in one pure update (rule 26 denorm at link time).
    onChange((b) =>
      boms.reduce((acc, bom) => linkBomToBlock(acc, bomToSnapshot(bom)), b as BOMCostSheetBlock)
    );
    // Stamp the proposal back-link on each BOM (rule 35: wrapped in
    // retryOnStaleToken). Best-effort — a failed stamp never undoes the link.
    if (!db || !user || !proposal) return;
    for (const bom of boms) {
      try {
        await retryOnStaleToken(() =>
          setBOMProposalLink(
            db,
            bom.id,
            { proposalId: proposal.id, proposalNumber: proposal.proposalNumber },
            user.uid
          )
        );
      } catch (err) {
        console.error('[BOMCostSheetEditor] back-link stamp failed', bom.id, err);
        toast.error(`Linked ${bom.bomCode}, but could not stamp the proposal link on the BOM.`);
      }
    }
  };

  const handleUnlink = async (snapshot: LinkedBomSnapshot) => {
    onChange((b) => unlinkBomFromBlock(b as BOMCostSheetBlock, snapshot.bomId));
    // Clear the back-link only if it still points at this proposal.
    if (!db || !user || !proposal) return;
    try {
      await retryOnStaleToken(() =>
        clearBOMProposalLink(db, snapshot.bomId, proposal.id, user.uid)
      );
    } catch (err) {
      console.error('[BOMCostSheetEditor] back-link clear failed', snapshot.bomId, err);
      toast.error(
        `Unlinked ${snapshot.bomCode}, but could not clear the proposal link on the BOM.`
      );
    }
  };

  const handleRefresh = async () => {
    if (!db || block.linkedBomIds.length === 0) return;
    try {
      setRefreshing(true);
      const fresh: LinkedBomSnapshot[] = [];
      let missing = 0;
      await Promise.all(
        block.linkedBomIds.map(async (id) => {
          try {
            const bom = await getBOMById(db, id);
            if (bom) fresh.push(bomToSnapshot(bom));
            else missing += 1;
          } catch (err) {
            // Graceful degrade: keep the last-known snapshot for this BOM.
            console.warn('[BOMCostSheetEditor] BOM refresh fetch failed', id, err);
            missing += 1;
          }
        })
      );
      onChange((b) => refreshBomSnapshots(b as BOMCostSheetBlock, fresh));
      if (missing > 0) {
        toast.warning(
          `Costs refreshed — ${missing} BOM${missing === 1 ? '' : 's'} could not be fetched, kept last saved cost.`
        );
      } else {
        toast.success('Costs refreshed from BOMs');
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {snapshots.length === 0 ? (
        <Alert severity="info" icon={false}>
          <Typography variant="body2">
            No BOMs linked yet. Use <strong>Link BOMs</strong> below to pull equipment cost from the
            estimation module.
          </Typography>
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>BOM Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {snapshots.map((snap) => (
                <TableRow key={snap.bomId}>
                  <TableCell>{snap.bomCode}</TableCell>
                  <TableCell>{snap.name}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(snap.totalCostAmount || 0, currency)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Unlink this BOM">
                      <IconButton size="small" onClick={() => handleUnlink(snap)}>
                        <UnlinkIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button startIcon={<AddRowIcon />} size="small" onClick={() => setPickerOpen(true)}>
          Link BOMs
        </Button>
        <Button
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          size="small"
          onClick={handleRefresh}
          disabled={refreshing || block.linkedBomIds.length === 0}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from BOMs'}
        </Button>
      </Stack>

      <BOMPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePicked}
        excludeIds={block.linkedBomIds}
        currentProposalId={proposal?.id}
      />
    </>
  );
}
