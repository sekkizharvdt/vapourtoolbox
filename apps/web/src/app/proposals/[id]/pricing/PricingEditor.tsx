'use client';

/**
 * Pricing Editor — markup drives revenue, sections distribute it.
 *
 *   Cost basis (INR, internal, from Costing)
 *     × (1 + overhead% + contingency% + profit%)
 *     = Revenue target (INR)
 *     ÷ fxRate                            ← only if currency ≠ INR
 *     = Revenue target (quote currency)
 *
 *   Sections (amounts in quote currency) distribute the target:
 *     • exactly 1 included section  → amount auto-syncs to the target
 *     • multiple included sections → user types each amount; banner
 *                                     shows target vs sum vs delta and
 *                                     a "rebalance last row" button.
 *
 * Tax is whatever the user sets (Indian GST is typically zero-rated on
 * exports under LUT, but the user decides — the editor exposes the
 * input on every currency). For single-section proposals the editor
 * persists the computed target on save so the saved value matches what
 * the PDF will print.
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddCircleOutline as AddRowIcon,
  AutoFixHigh as RebalanceIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { createDefaultClientPricing } from '@/lib/proposals/pricingBlocks';
import { computeCommercialSummary } from '@/lib/proposals/commercialSummary';
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
  useUnsavedChangesWarning(dirty);

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

        setPricing(p.clientPricing ?? createDefaultClientPricing());
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

  // Live summary — drives every readout on this screen and is what the
  // PDF will print. Same helper, same numbers.
  const summary = useMemo(() => {
    if (!proposal || !pricing) return null;
    return computeCommercialSummary({ ...proposal, clientPricing: pricing });
  }, [proposal, pricing]);

  const inrCurrency: CurrencyCode = 'INR';
  const quoteCurrency: CurrencyCode = summary?.currency ?? 'INR';
  const isForeignQuote = summary?.isForeignQuote ?? false;
  const fxRate = summary?.fxRate ?? 1;

  // Section editing rules:
  //   - exactly one INCLUDED section ⇒ that row's amount auto-syncs
  //     to target (read-only in UI).
  //   - 0 or 2+ included ⇒ amounts are user-controlled.
  const includedSections = (pricing?.priceSections ?? []).filter((s) => s.included);
  const singleIncludedId = includedSections.length === 1 ? (includedSections[0]?.id ?? null) : null;

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
    // Default the first ever section to the proposal title so single-
    // line offers don't need any typing — the auto-sync gives them a
    // priced line out of the box.
    const defaultTitle = list.length === 0 ? (proposal?.title ?? 'Scope of Work') : '';
    setSections([
      ...list,
      {
        id: newId(),
        title: defaultTitle,
        amount: 0,
        included: true,
        order: list.length,
      },
    ]);
  };
  const removeSection = (id: string) => {
    const list = pricing?.priceSections ?? [];
    setSections(list.filter((s) => s.id !== id));
  };

  // When the user is splitting a target across multiple sections and
  // their typed amounts don't quite hit the target, "Rebalance" puts the
  // remainder on the last included row. Common quick fix.
  const rebalanceLastRow = () => {
    if (!summary || includedSections.length < 2) return;
    const list = pricing?.priceSections ?? [];
    const lastIncluded = [...includedSections].sort((a, b) => a.order - b.order).slice(-1)[0];
    if (!lastIncluded) return;
    const otherSum = round2(
      includedSections
        .filter((s) => s.id !== lastIncluded.id)
        .reduce((acc, s) => acc + (s.amount || 0), 0)
    );
    const newAmount = round2(Math.max(summary.targetRevenue - otherSum, 0));
    setSections(list.map((s) => (s.id === lastIncluded.id ? { ...s, amount: newAmount } : s)));
  };

  const handleSave = async () => {
    if (!db || !user || !proposal || !pricing || !summary) return;
    try {
      setSaving(true);

      // Single-section auto-sync: persist the target so the saved value
      // matches what the PDF will print.
      const sectionsToSave: PriceSection[] = (pricing.priceSections ?? []).map((s) =>
        s.id === singleIncludedId ? { ...s, amount: summary.targetRevenue } : s
      );

      const toSave: ClientPricing = {
        ...pricing,
        priceSections: sectionsToSave,
      };

      await updateProposal(
        db,
        proposal.id,
        { clientPricing: toSave },
        user.uid,
        claims?.permissions ?? 0
      );
      setPricing(toSave);
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
  if (!proposal || !pricing || !summary) return null;

  const currencyCfg = CURRENCIES[quoteCurrency];

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
            Cost basis × markup = revenue target. Sections distribute the target — one section
            tracks it automatically, two or more let you split it across named line items.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || saving || proposal?.status !== 'DRAFT'}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>

      {/* Cost basis */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">
              Cost basis (internal, INR — from Costing tab)
            </Typography>
            <Typography variant="h6">{formatMoney(summary.costBasisInr, inrCurrency)}</Typography>
          </Box>
          {summary.costBasisInr === 0 && (
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
            Each percentage is applied to the cost basis above. The three sum to the total markup on
            which the revenue target is built.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <PercentField
              label="Overhead"
              value={pricing.overheadPercent}
              onChange={(v) => update({ overheadPercent: v })}
              amount={round2((summary.costBasisInr * (pricing.overheadPercent || 0)) / 100)}
              currency={inrCurrency}
            />
            <PercentField
              label="Contingency"
              value={pricing.contingencyPercent}
              onChange={(v) => update({ contingencyPercent: v })}
              amount={round2((summary.costBasisInr * (pricing.contingencyPercent || 0)) / 100)}
              currency={inrCurrency}
            />
            <PercentField
              label="Profit"
              value={pricing.profitPercent}
              onChange={(v) => update({ profitPercent: v })}
              amount={round2((summary.costBasisInr * (pricing.profitPercent || 0)) / 100)}
              currency={inrCurrency}
            />
          </Stack>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Total markup: <strong>{summary.markupPercent.toFixed(2)}%</strong> →{' '}
              {formatMoney(summary.targetRevenueInr - summary.costBasisInr, inrCurrency)} added to
              cost basis.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Quote currency — placed before the revenue target so the unit
          of the target headline is established. */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            Quote currency
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What the customer sees on the offer. Defaults to ₹ INR. Pick something else for foreign
            clients and snapshot the exchange rate; the conversion happens once on the way from cost
            basis (INR) to revenue target (quote currency).
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

      {/* Revenue target — headline of the whole tab. */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Revenue target (before tax) — cost basis × (1 + markup), in quote currency
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {formatMoney(summary.targetRevenue, quoteCurrency)}
            </Typography>
            {isForeignQuote && (
              <Typography variant="caption" color="text.secondary">
                {formatMoney(summary.targetRevenueInr, inrCurrency)} ÷ {fxRate} ={' '}
                {formatMoney(summary.targetRevenue, quoteCurrency)}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Customer Price Sections. Single-section ⇒ amount = target.
          Multi-section ⇒ user splits, banner reconciles. */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle1">Customer Price Sections</Typography>
              <Typography variant="body2" color="text.secondary">
                Each section prints as its own row on the customer PDF. One section for a single-
                line offer (the amount auto-tracks the target above). Two or more to split an EPC
                bid into named groups (MED System, Solar, O&M, …).
              </Typography>
            </Box>
          </Stack>

          {/* Foreign-quote tax-rolling notice — explain what the
              customer will see vs what the editor is showing. */}
          {summary.rollTaxIntoSections && (
            <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
              Foreign-currency quote with {summary.taxRate}% tax: each section row is shown here at
              the <strong>pre-tax</strong> amount. The customer PDF rolls {summary.taxRate}% into
              each row and prints a single total — no separate tax line.
            </Alert>
          )}

          {/* Reconciliation banner — only when splitting */}
          {includedSections.length >= 2 && (
            <Alert
              severity={summary.hasDelta ? 'warning' : 'success'}
              sx={{ mt: 2, mb: 1 }}
              action={
                summary.hasDelta ? (
                  <Tooltip title="Put the remainder on the last included row.">
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<RebalanceIcon fontSize="small" />}
                      onClick={rebalanceLastRow}
                    >
                      Rebalance
                    </Button>
                  </Tooltip>
                ) : null
              }
            >
              <Typography variant="body2">
                <strong>Target:</strong> {formatMoney(summary.targetRevenue, quoteCurrency)} •{' '}
                <strong>Sum of sections:</strong> {formatMoney(summary.sectionsSum, quoteCurrency)}{' '}
                • <strong>Delta:</strong>{' '}
                <span style={{ fontWeight: 600 }}>
                  {summary.delta >= 0 ? '+' : ''}
                  {formatMoney(summary.delta, quoteCurrency)}
                </span>
              </Typography>
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 100, textAlign: 'center' }}>Include</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell sx={{ width: '30%' }}>Sub-line (optional)</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>
                    Amount ({currencyCfg.symbol} {quoteCurrency})
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
                        one section is enough; its amount will track the revenue target above.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {(pricing.priceSections ?? []).map((row) => {
                  const isAutoSync = row.id === singleIncludedId;
                  const displayedAmount = isAutoSync ? summary.targetRevenue : row.amount || 0;
                  return (
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
                        <Tooltip
                          title={
                            isAutoSync
                              ? 'Single included section — amount auto-tracks the revenue target. Add a second section to split.'
                              : ''
                          }
                        >
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={isAutoSync ? displayedAmount : row.amount || ''}
                            onChange={(e) =>
                              updateSection(row.id, {
                                amount: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={isAutoSync}
                            sx={{ width: 160 }}
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                            helperText={isAutoSync ? 'auto = target' : ' '}
                          />
                        </Tooltip>
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
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1 }}>
            <Button startIcon={<AddRowIcon />} size="small" onClick={addSection}>
              Add section
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Tax — visible for all quote currencies. Indian GST is typically
          zero-rated on exports under LUT, but place-of-supply rules,
          missing LUT, or destination-country VAT all have edge cases.
          The user decides; set rate to 0 to suppress on the PDF. */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            Tax
          </Typography>
          {isForeignQuote && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              GST is typically zero-rated on exports under LUT — leave at 0 unless your case differs
              (place-of-supply rules, missing LUT, destination-country VAT, etc.).
            </Typography>
          )}
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
                {formatMoney(summary.taxAmount, quoteCurrency)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Final total — mirrors what the customer sees on the PDF. */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, bgcolor: 'primary.light', color: 'primary.contrastText' }}
      >
        <Stack spacing={0.5}>
          {summary.sections.map((sec) => {
            // Mirror the customer PDF: when tax is rolled into rows
            // (foreign quotes) each row prints tax-inclusive and the
            // subtotal/tax rows below disappear.
            const displayed = summary.rollTaxIntoSections
              ? sec.amount * (1 + summary.taxRate / 100)
              : sec.amount;
            return (
              <Row
                key={sec.id}
                label={sec.title || '(untitled section)'}
                value={formatMoney(displayed, quoteCurrency)}
              />
            );
          })}
          {!summary.rollTaxIntoSections && summary.taxRate > 0 && (
            <>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)', my: 0.5 }} />
              <Row label="Subtotal" value={formatMoney(summary.sectionsSum, quoteCurrency)} bold />
              <Row
                label={`${summary.taxLabel} (${summary.taxRate}%)`}
                value={formatMoney(summary.taxAmount, quoteCurrency)}
              />
            </>
          )}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)', my: 0.5 }} />
          <Row
            label={`Total (${quoteCurrency})`}
            value={formatMoney(summary.total, quoteCurrency)}
            large
          />
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
