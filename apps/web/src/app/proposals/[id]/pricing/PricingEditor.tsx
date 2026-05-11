'use client';

/**
 * Pricing Editor (Stage 2.5)
 *
 * The client-facing Pricing tab. Reads the cost basis from the Costing tab
 * (sum of `proposal.pricingBlocks` subtotals), then layers:
 *
 *   Cost basis
 *   + Overhead %     × Cost basis
 *   + Contingency %  × Cost basis
 *   + Profit %       × Cost basis
 *   + Lump-sum lines (each visible on the client PDF)
 *   = Subtotal
 *   + Tax %          × Subtotal
 *   = Total price
 *
 * The Costing tab is internal — never seen by the client. This tab is.
 */

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
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
import { createDefaultClientPricing } from '@/lib/proposals/pricingBlocks';
import { useToast } from '@/components/common/Toast';
import { CURRENCIES } from '@vapour/constants';
import type { ClientPricing, CurrencyCode, PriceSection, Proposal } from '@vapour/types';

interface Props {
  proposalId?: string;
  embedded?: boolean;
}

const newId = (): string => Math.random().toString(36).slice(2, 11);
const round2 = (n: number): number => Math.round(n * 100) / 100;

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

export default function PricingEditor({ proposalId: propId }: Props = {}) {
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
  const [pricing, setPricing] = useState<ClientPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Stage 2.5r migration: if a proposal predates priceSections, lift
        // its legacy lump-sum lines + cost-basis-with-markups into
        // sections so the editor opens with a populated section list.
        const rawPricing = p.clientPricing ?? createDefaultClientPricing();
        const hasSections =
          Array.isArray(rawPricing.priceSections) && rawPricing.priceSections.length > 0;
        if (!hasSections) {
          const seeded: PriceSection[] = [];
          const cb = (p.pricingBlocks ?? []).reduce((s, b) => s + (b.subtotal || 0), 0);
          const overhead = (cb * (rawPricing.overheadPercent || 0)) / 100;
          const contingency = (cb * (rawPricing.contingencyPercent || 0)) / 100;
          const profit = (cb * (rawPricing.profitPercent || 0)) / 100;
          const scopeLineAmount = cb + overhead + contingency + profit;
          if (scopeLineAmount > 0) {
            seeded.push({
              id: newId(),
              title: p.title || 'Scope of Work',
              amount: round2(scopeLineAmount),
              included: true,
              order: 0,
            });
          }
          (rawPricing.lumpSumLines ?? []).forEach((row, idx) => {
            if (!row.description?.trim() && !(row.amount > 0)) return;
            seeded.push({
              id: row.id || newId(),
              title: row.description || `Line ${idx + 1}`,
              amount: row.amount || 0,
              included: true,
              order: seeded.length,
            });
          });
          setPricing({ ...rawPricing, priceSections: seeded });
        } else {
          setPricing(rawPricing);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PricingEditor] load failed', err);
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

  // Internal cost basis is always INR. Quote currency on Pricing only
  // affects the very last conversion of the final total.
  const inrCurrency: CurrencyCode = 'INR';
  const quoteCurrency: CurrencyCode = pricing?.currency ?? 'INR';
  const fxRate = pricing?.fxRate ?? 1;
  const isForeignQuote = quoteCurrency !== 'INR';

  const costBasis = useMemo(
    () => (proposal?.pricingBlocks ?? []).reduce((s, b) => s + (b.subtotal || 0), 0),
    [proposal?.pricingBlocks]
  );

  const computed = useMemo(() => {
    if (!pricing) {
      return {
        overheadAmount: 0,
        contingencyAmount: 0,
        profitAmount: 0,
        sectionsTotal: 0,
        subtotal: 0,
        taxAmount: 0,
        totalInr: 0,
        totalQuote: 0,
        margin: 0,
      };
    }
    // Markup percentages are kept as a *helper* for the user (they show
    // what overhead/contingency/profit on the cost basis would look like)
    // but they no longer feed the subtotal — the customer-facing subtotal
    // is the sum of the section amounts the user has typed in.
    const overheadAmount = round2((costBasis * (pricing.overheadPercent || 0)) / 100);
    const contingencyAmount = round2((costBasis * (pricing.contingencyPercent || 0)) / 100);
    const profitAmount = round2((costBasis * (pricing.profitPercent || 0)) / 100);
    const sectionsTotal = round2(
      (pricing.priceSections ?? [])
        .filter((sec) => sec.included)
        .reduce((s, sec) => s + (sec.amount || 0), 0)
    );
    const subtotal = sectionsTotal;
    const taxAmount = round2((subtotal * (pricing.taxRate || 0)) / 100);
    const totalInr = round2(subtotal + taxAmount);
    const totalQuote = isForeignQuote && fxRate > 0 ? round2(totalInr / fxRate) : totalInr;
    // Margin = customer revenue (before tax) minus internal cost basis.
    // Shown to the user as a sanity check while pricing.
    const margin = round2(subtotal - costBasis);
    return {
      overheadAmount,
      contingencyAmount,
      profitAmount,
      sectionsTotal,
      subtotal,
      taxAmount,
      totalInr,
      totalQuote,
      margin,
    };
  }, [pricing, costBasis, fxRate, isForeignQuote]);

  const update = (patch: Partial<ClientPricing>) => {
    setPricing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const setSections = (rows: PriceSection[]) => {
    setPricing((prev) => (prev ? { ...prev, priceSections: rows } : prev));
    setDirty(true);
  };
  const updateSection = (id: string, patch: Partial<PriceSection>) => {
    const list = pricing?.priceSections ?? [];
    setSections(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const addSection = () => {
    const list = pricing?.priceSections ?? [];
    setSections([
      ...list,
      { id: newId(), title: '', amount: 0, included: true, order: list.length },
    ]);
  };
  const removeSection = (id: string) => {
    const list = pricing?.priceSections ?? [];
    setSections(list.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!db || !user || !proposal || !pricing) return;
    try {
      setSaving(true);
      await updateProposal(
        db,
        proposal.id,
        { clientPricing: pricing },
        user.uid,
        claims?.permissions ?? 0
      );
      setDirty(false);
      toast.success('Pricing saved');
    } catch (err) {
      console.error('[PricingEditor] save failed', err);
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
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!proposal || !pricing) return null;

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h6">Pricing</Typography>
          <Typography variant="body2" color="text.secondary">
            What the customer sees on the offer. All inputs below are in ₹ INR — pick the quote
            currency at the bottom if the offer is going to a foreign client.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>

      {/* Cost basis read-out */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">
              Cost basis (from Costing tab)
            </Typography>
            <Typography variant="h6">{formatMoney(costBasis, inrCurrency)}</Typography>
          </Box>
          {costBasis === 0 && (
            <Alert severity="info" sx={{ ml: 2 }}>
              No costs entered yet. Fill the Costing tab first.
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Markup */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            Markup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Each percentage is applied independently to the cost basis above.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <PercentField
              label="Overhead"
              value={pricing.overheadPercent}
              onChange={(v) => update({ overheadPercent: v })}
              amount={computed.overheadAmount}
              currency={inrCurrency}
            />
            <PercentField
              label="Contingency"
              value={pricing.contingencyPercent}
              onChange={(v) => update({ contingencyPercent: v })}
              amount={computed.contingencyAmount}
              currency={inrCurrency}
            />
            <PercentField
              label="Profit"
              value={pricing.profitPercent}
              onChange={(v) => update({ profitPercent: v })}
              amount={computed.profitAmount}
              currency={inrCurrency}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Customer Price Sections — the rows the buyer sees on the Commercial
          Summary. Independent of the scope matrix: scope can list 10+ items,
          customer sees the breakdown they want (e.g. MED System / Solar /
          O&M). Each section is a flat priced row the user types in. */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1">Customer Price Sections</Typography>
              <Typography variant="body2" color="text.secondary">
                Each section prints as its own row on the customer PDF. Use one for a single-line
                offer, or split EPC bids into named groups (MED Process System, Solar System, O&M,
                etc.). Sub-total + tax + total follow.
              </Typography>
            </Box>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 100, textAlign: 'center' }}>Include</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell sx={{ width: '30%' }}>Sub-line (optional)</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>
                    Amount (INR)
                  </TableCell>
                  <TableCell align="right" sx={{ width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {(pricing.priceSections ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No sections yet — add one below. For a single-line offer (e.g. a survey),
                        one section is enough.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {(pricing.priceSections ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell align="center">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateSection(row.id, { included: e.target.checked })}
                        aria-label="Include section"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        value={row.title}
                        onChange={(e) => updateSection(row.id, { title: e.target.value })}
                        placeholder="e.g. MED Process System"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        variant="standard"
                        value={row.description ?? ''}
                        onChange={(e) => updateSection(row.id, { description: e.target.value })}
                        placeholder="optional fine print"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        variant="standard"
                        type="number"
                        value={row.amount || ''}
                        onChange={(e) =>
                          updateSection(row.id, { amount: parseFloat(e.target.value) || 0 })
                        }
                        sx={{ width: 160 }}
                        inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => removeSection(row.id)}
                        aria-label="Remove section"
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
            <Button startIcon={<AddRowIcon />} size="small" onClick={addSection}>
              Add section
            </Button>
          </Box>
          {costBasis > 0 && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Internal margin check:</strong>{' '}
                {formatMoney(computed.subtotal, inrCurrency)} (sum of included sections)
                {' − '}
                {formatMoney(costBasis, inrCurrency)} (cost basis from Costing tab)
                {' = '}
                <span
                  style={{
                    fontWeight: 600,
                    color: computed.margin >= 0 ? 'inherit' : '#b71c1c',
                  }}
                >
                  {formatMoney(computed.margin, inrCurrency)}
                </span>
                {' ('}
                {computed.subtotal > 0
                  ? `${((computed.margin / computed.subtotal) * 100).toFixed(1)}%`
                  : '—'}
                {' margin)'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tax */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Tax
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Tax label"
              size="small"
              value={pricing.taxLabel}
              onChange={(e) => update({ taxLabel: e.target.value })}
              placeholder="e.g. GST 18%"
              sx={{ minWidth: 200 }}
            />
            <TextField
              label="Tax rate"
              size="small"
              type="number"
              value={pricing.taxRate || ''}
              onChange={(e) => update({ taxRate: parseFloat(e.target.value) || 0 })}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              sx={{ width: 160 }}
              inputProps={{ min: 0, step: 'any' }}
            />
            <Box sx={{ flex: 1 }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Tax amount
              </Typography>
              <Typography variant="body1">
                {formatMoney(computed.taxAmount, inrCurrency)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Quote currency */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            Quote currency
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The currency the customer sees on the offer. Defaults to ₹ INR. Pick something else for
            foreign clients and snapshot the exchange rate; the conversion only happens on the final
            total.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              select
              label="Quote currency"
              size="small"
              value={pricing.currency}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                update({ currency: next, fxRate: next === 'INR' ? 1 : pricing.fxRate });
              }}
              sx={{ minWidth: 200 }}
            >
              {(['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'] as CurrencyCode[]).map((code) => (
                <MenuItem key={code} value={code}>
                  {CURRENCIES[code].symbol} {code} — {CURRENCIES[code].name}
                </MenuItem>
              ))}
            </TextField>
            {isForeignQuote && (
              <TextField
                label={`1 ${quoteCurrency} = ? INR`}
                size="small"
                type="number"
                value={pricing.fxRate || ''}
                onChange={(e) => update({ fxRate: parseFloat(e.target.value) || 0 })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">INR</InputAdornment>,
                }}
                sx={{ minWidth: 200 }}
                inputProps={{ min: 0, step: 'any' }}
                helperText="Snapshot at quote time — held steady on the PDF."
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Final total — mirrors what the customer sees on the PDF
          Commercial Summary, driven by the price sections above. */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, bgcolor: 'primary.light', color: 'primary.contrastText' }}
      >
        <Stack spacing={0.5}>
          {(pricing.priceSections ?? [])
            .filter((sec) => sec.included)
            .map((sec) => (
              <Row
                key={sec.id}
                label={sec.title || '(untitled section)'}
                value={formatMoney(sec.amount ?? 0, inrCurrency)}
              />
            ))}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)', my: 0.5 }} />
          <Row label="Subtotal" value={formatMoney(computed.subtotal, inrCurrency)} bold />
          {pricing.taxRate > 0 && (
            <Row
              label={`${pricing.taxLabel || 'Tax'} (${pricing.taxRate}%)`}
              value={formatMoney(computed.taxAmount, inrCurrency)}
            />
          )}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)', my: 0.5 }} />
          <Row label="Total (INR)" value={formatMoney(computed.totalInr, inrCurrency)} large />
          {isForeignQuote && fxRate > 0 && (
            <Row
              label={`Total quoted as ${quoteCurrency} (at 1 ${quoteCurrency} = ${fxRate} INR)`}
              value={formatMoney(computed.totalQuote, quoteCurrency)}
              large
            />
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function PercentField({
  label,
  value,
  onChange,
  amount,
  currency,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  amount: number;
  currency: CurrencyCode;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
      helperText={amount > 0 ? formatMoney(amount, currency) : ' '}
      sx={{ flex: 1, minWidth: 160 }}
      inputProps={{ min: 0, step: 'any' }}
    />
  );
}

function Row({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant={large ? 'h6' : 'body2'} sx={{ fontWeight: bold || large ? 600 : 400 }}>
        {label}
      </Typography>
      <Typography variant={large ? 'h6' : 'body2'} sx={{ fontWeight: bold || large ? 600 : 400 }}>
        {value}
      </Typography>
    </Stack>
  );
}
