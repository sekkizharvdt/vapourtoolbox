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
import { useParams } from 'next/navigation';
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
  Select,
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
  Save as SaveIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import {
  recomputeBlockSubtotal,
  createManpowerBlock,
  createPerMandayBlock,
  createLumpSumBlock,
  createBOMCostSheetBlock,
} from '@/lib/proposals/pricingBlocks';
import { useToast } from '@/components/common/Toast';
import { CURRENCIES } from '@vapour/constants';
import type {
  Audience,
  PricingBlock,
  ManpowerRosterBlock,
  PerMandayCostBlock,
  LumpSumLinesBlock,
  BOMCostSheetBlock,
  Proposal,
  CurrencyCode,
} from '@vapour/types';

interface Props {
  proposalId?: string;
  embedded?: boolean;
}

const newId = (): string => Math.random().toString(36).slice(2, 11);

const audienceLabels: Record<Audience, string> = {
  CLIENT: 'Visible to client',
  INTERNAL: 'Internal only',
  BOTH: 'Visible to both',
};

const blockKindLabels = {
  MANPOWER_ROSTER: 'Manpower roster',
  PER_MANDAY_COST: 'Site costs (per manday)',
  LUMP_SUM_LINES: 'Lump-sum lines',
  BOM_COST_SHEET: 'Equipment from estimation',
} as const;

function formatMoney(amount: number, currency: CurrencyCode): string {
  const cfg = CURRENCIES[currency];
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: cfg.decimalDigits,
    }).format(amount);
  } catch {
    return `${cfg.symbol} ${amount.toFixed(cfg.decimalDigits)}`;
  }
}

export default function PricingBlocksEditor({ proposalId: propId }: Props = {}) {
  const params = useParams();
  const proposalId = propId || (params.id as string);
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [blocks, setBlocks] = useState<PricingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const totals = useMemo(() => {
    const all = blocks.reduce((s, b) => s + (b.subtotal || 0), 0);
    const client = blocks
      .filter((b) => b.audience !== 'INTERNAL')
      .reduce((s, b) => s + (b.subtotal || 0), 0);
    const internal = blocks
      .filter((b) => b.audience !== 'CLIENT')
      .reduce((s, b) => s + (b.subtotal || 0), 0);
    return { all, client, internal };
  }, [blocks]);

  const updateBlock = (id: string, updater: (b: PricingBlock) => PricingBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? recomputeBlockSubtotal(updater(b)) : b)));
    setDirty(true);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDirty(true);
  };

  const addBlock = (kind: PricingBlock['kind']) => {
    setAddAnchor(null);
    let block: PricingBlock;
    if (kind === 'MANPOWER_ROSTER') {
      block = createManpowerBlock(currency, 'CLIENT', 'Manpower');
    } else if (kind === 'PER_MANDAY_COST') {
      block = createPerMandayBlock(currency, 'CLIENT', 'Site costs');
    } else if (kind === 'LUMP_SUM_LINES') {
      block = createLumpSumBlock(currency, 'CLIENT', 'Lump-sum lines');
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
          <Typography variant="h6">Pricing buildup</Typography>
          <Typography variant="body2" color="text.secondary">
            Quoted in {CURRENCIES[currency].symbol} {currency}. Internal-only blocks drive your cost
            basis but are hidden from the client PDF.
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
            disabled={!dirty || saving}
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
              onChange={(updater) => updateBlock(block.id, updater)}
              onRemove={() => removeBlock(block.id)}
            />
          ))}
        </Stack>
      )}

      {/* Totals */}
      <Paper variant="outlined" sx={{ p: 2.5, mt: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack>
            <Typography variant="caption" color="text.secondary">
              Visible to client
            </Typography>
            <Typography variant="h6">{formatMoney(totals.client, currency)}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption" color="text.secondary">
              Internal cost basis
            </Typography>
            <Typography variant="h6">{formatMoney(totals.internal, currency)}</Typography>
          </Stack>
          <Stack>
            <Typography variant="caption" color="text.secondary">
              All blocks (sum)
            </Typography>
            <Typography variant="h6">{formatMoney(totals.all, currency)}</Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

/* ─── Block card ──────────────────────────────────────────────────────── */

interface BlockCardProps {
  block: PricingBlock;
  currency: CurrencyCode;
  onChange: (updater: (b: PricingBlock) => PricingBlock) => void;
  onRemove: () => void;
}

function BlockCard({ block, currency, onChange, onRemove }: BlockCardProps) {
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={block.audience}
              onChange={(e) => onChange((b) => ({ ...b, audience: e.target.value as Audience }))}
              sx={{ minWidth: 180 }}
            >
              {(['CLIENT', 'INTERNAL', 'BOTH'] as Audience[]).map((a) => (
                <MenuItem key={a} value={a}>
                  {audienceLabels[a]}
                </MenuItem>
              ))}
            </Select>
            <Tooltip title="Remove this block">
              <IconButton onClick={onRemove} size="small" color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {block.kind === 'MANPOWER_ROSTER' && (
          <ManpowerEditor block={block} currency={currency} onChange={onChange} />
        )}
        {block.kind === 'PER_MANDAY_COST' && (
          <PerMandayEditor block={block} currency={currency} onChange={onChange} />
        )}
        {block.kind === 'LUMP_SUM_LINES' && <LumpSumEditor block={block} onChange={onChange} />}
        {block.kind === 'BOM_COST_SHEET' && <BOMPlaceholder block={block} currency={currency} />}

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Typography variant="subtitle1">
            Subtotal: <strong>{formatMoney(block.subtotal || 0, currency)}</strong>
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
                <TableCell align="right">{formatMoney(row.total || 0, currency)}</TableCell>
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
                <TableCell align="right">{formatMoney(row.total || 0, currency)}</TableCell>
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

/* ─── BOM cost sheet placeholder ──────────────────────────────────────── */

function BOMPlaceholder({ block, currency }: { block: BOMCostSheetBlock; currency: CurrencyCode }) {
  return (
    <Alert severity="info" icon={false}>
      <Typography variant="body2">
        BOM linking comes in the next ship — for now this block holds your equipment cost basis of{' '}
        <strong>{formatMoney(block.subtotal || 0, currency)}</strong> as 0 until you wire it to the
        estimation module.
      </Typography>
    </Alert>
  );
}
