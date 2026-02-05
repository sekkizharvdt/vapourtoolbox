'use client';

/**
 * Proposal Pricing Editor Client Component
 *
 * Configure markup percentages (overhead, contingency, profit) and
 * calculate final client-facing price from estimation totals.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  CheckCircle as CompleteIcon,
  Home as HomeIcon,
  ArrowForward as ArrowIcon,
  PictureAsPdf as PreviewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { getBOMById } from '@/lib/bom/bomService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, ProposalPricingConfig, ScopeItem, ScopeMatrix, Money } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'PricingEditorClient' });

export default function PricingEditorClient() {
  const router = useRouter();
  const params = useParams();
  const proposalId = params.id as string;
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pricing configuration state
  const [overheadPercent, setOverheadPercent] = useState(10);
  const [contingencyPercent, setContingencyPercent] = useState(5);
  const [profitMarginPercent, setProfitMarginPercent] = useState(15);
  const [taxPercent, setTaxPercent] = useState(18);
  const [validityDays, setValidityDays] = useState(30);

  // Load proposal
  useEffect(() => {
    if (!db || !proposalId || proposalId === 'placeholder') return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getProposalById(db, proposalId);
        if (!data) {
          setError('Proposal not found');
          return;
        }

        setProposal(data);

        // Initialize from existing pricing config if available
        if (data.pricingConfig) {
          setOverheadPercent(data.pricingConfig.overheadPercent);
          setContingencyPercent(data.pricingConfig.contingencyPercent);
          setProfitMarginPercent(data.pricingConfig.profitMarginPercent);
          setTaxPercent(data.pricingConfig.taxPercent);
          setValidityDays(data.pricingConfig.validityDays);
        }

        logger.info('Proposal loaded for pricing', { proposalId });
      } catch (err) {
        logger.error('Error loading proposal', { error: err });
        setError('Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [db, proposalId]);

  // Calculate estimation total from scope matrix
  const estimationBreakdown = useMemo(() => {
    if (!proposal?.scopeMatrix) return { items: [], total: 0, currency: 'INR' as const };

    const allItems: { item: ScopeItem; type: 'SERVICE' | 'SUPPLY' }[] = [
      ...(proposal.scopeMatrix.services || []).map((item) => ({ item, type: 'SERVICE' as const })),
      ...(proposal.scopeMatrix.supply || []).map((item) => ({ item, type: 'SUPPLY' as const })),
    ];

    let total = 0;
    let currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD' | 'AED' = 'INR';
    const itemsWithEstimation: { name: string; type: string; amount: Money; bomCount: number }[] =
      [];

    allItems.forEach(({ item, type }) => {
      if (item.estimationSummary?.totalCost) {
        total += item.estimationSummary.totalCost.amount;
        currency = item.estimationSummary.totalCost.currency;
        itemsWithEstimation.push({
          name: item.name,
          type,
          amount: item.estimationSummary.totalCost,
          bomCount: item.estimationSummary.bomCount,
        });
      }
    });

    return { items: itemsWithEstimation, total, currency };
  }, [proposal]);

  // Calculate pricing
  const calculatedPricing = useMemo(() => {
    const subtotal = estimationBreakdown.total;
    const currency = estimationBreakdown.currency;

    const overheadAmount = subtotal * (overheadPercent / 100);
    const contingencyAmount = subtotal * (contingencyPercent / 100);
    const profitAmount = subtotal * (profitMarginPercent / 100);

    const subtotalBeforeTax = subtotal + overheadAmount + contingencyAmount + profitAmount;
    const taxAmount = subtotalBeforeTax * (taxPercent / 100);
    const totalPrice = subtotalBeforeTax + taxAmount;

    return {
      estimationSubtotal: { amount: subtotal, currency },
      overheadAmount: { amount: overheadAmount, currency },
      contingencyAmount: { amount: contingencyAmount, currency },
      profitAmount: { amount: profitAmount, currency },
      subtotalBeforeTax: { amount: subtotalBeforeTax, currency },
      taxAmount: { amount: taxAmount, currency },
      totalPrice: { amount: totalPrice, currency },
    };
  }, [estimationBreakdown, overheadPercent, contingencyPercent, profitMarginPercent, taxPercent]);

  const formatCurrency = (money: Money) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);
  };

  const handleSave = async (markComplete = false) => {
    if (!db || !user || !proposal) return;

    try {
      setSaving(true);
      setError(null);

      const pricingConfig: ProposalPricingConfig = {
        estimationSubtotal: calculatedPricing.estimationSubtotal,
        overheadPercent,
        contingencyPercent,
        profitMarginPercent,
        overheadAmount: calculatedPricing.overheadAmount,
        contingencyAmount: calculatedPricing.contingencyAmount,
        profitAmount: calculatedPricing.profitAmount,
        subtotalBeforeTax: calculatedPricing.subtotalBeforeTax,
        taxPercent,
        taxAmount: calculatedPricing.taxAmount,
        totalPrice: calculatedPricing.totalPrice,
        validityDays,
        isComplete: markComplete,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedBy: user.uid,
      };

      const updates: Partial<Proposal> = {
        pricingConfig,
      };

      if (markComplete) {
        updates.pricingCompletedAt = Timestamp.now();
      }

      await updateProposal(db, proposalId, updates, user.uid);

      toast.success(
        markComplete ? 'Pricing complete! Continue to preview.' : 'Pricing saved successfully'
      );
      logger.info('Pricing saved', { proposalId, markComplete });

      if (markComplete) {
        // Redirect to preview page after marking pricing complete
        router.push(`/proposals/${proposalId}/preview`);
      }
    } catch (err) {
      logger.error('Error saving pricing', { error: err });
      setError('Failed to save pricing');
      toast.error('Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  // Refresh BOM costs from the estimation module
  const handleRefreshBOMCosts = async () => {
    if (!db || !user || !proposal?.scopeMatrix) return;

    try {
      setRefreshing(true);
      setError(null);

      // Collect all unique BOM IDs from the scope matrix
      const allItems = [
        ...(proposal.scopeMatrix.services || []),
        ...(proposal.scopeMatrix.supply || []),
      ];

      const bomIds = new Set<string>();
      allItems.forEach((item) => {
        (item.linkedBOMs || []).forEach((bom) => bomIds.add(bom.bomId));
      });

      if (bomIds.size === 0) {
        toast.info('No BOMs linked to refresh');
        return;
      }

      // Fetch latest BOM costs
      const bomCosts: Record<
        string,
        { amount: number; currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD' | 'AED' }
      > = {};
      for (const bomId of bomIds) {
        const bom = await getBOMById(db, bomId);
        if (bom) {
          bomCosts[bomId] = bom.summary.totalCost;
        }
      }

      // Update scope items with refreshed costs
      const updateScopeItems = (items: ScopeItem[]): ScopeItem[] => {
        return items.map((item) => {
          if (!item.linkedBOMs || item.linkedBOMs.length === 0) return item;

          // Update linked BOM costs
          const updatedLinkedBOMs = item.linkedBOMs.map((linkedBom) => ({
            ...linkedBom,
            totalCost: bomCosts[linkedBom.bomId] || linkedBom.totalCost,
          }));

          // Recalculate estimation summary
          const totalCost = updatedLinkedBOMs.reduce((sum, bom) => sum + bom.totalCost.amount, 0);
          const currency = updatedLinkedBOMs[0]?.totalCost.currency || 'INR';

          return {
            ...item,
            linkedBOMs: updatedLinkedBOMs,
            estimationSummary: {
              totalCost: { amount: totalCost, currency },
              bomCount: updatedLinkedBOMs.length,
            },
          };
        });
      };

      const updatedScopeMatrix: ScopeMatrix = {
        ...proposal.scopeMatrix,
        services: updateScopeItems(proposal.scopeMatrix.services || []),
        supply: updateScopeItems(proposal.scopeMatrix.supply || []),
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedBy: user.uid,
      };

      // Save updated scope matrix
      await updateProposal(db, proposalId, { scopeMatrix: updatedScopeMatrix }, user.uid);

      // Update local state
      setProposal((prev) => (prev ? { ...prev, scopeMatrix: updatedScopeMatrix } : null));

      toast.success(`Refreshed costs from ${bomIds.size} BOMs`);
      logger.info('BOM costs refreshed', { proposalId, bomCount: bomIds.size });
    } catch (err) {
      logger.error('Error refreshing BOM costs', { error: err });
      setError('Failed to refresh BOM costs');
      toast.error('Failed to refresh BOM costs');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !proposal) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!proposal) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Proposal not found</Alert>
      </Container>
    );
  }

  const hasEstimation = estimationBreakdown.total > 0;

  return (
    <Container maxWidth="lg">
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Proposals
        </Link>
        <Link
          color="inherit"
          href="/proposals/pricing"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals/pricing');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Pricing
        </Link>
        <Typography color="text.primary">{proposal.proposalNumber}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/proposals/pricing')}
          sx={{ mb: 2 }}
        >
          Back to Pricing
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Pricing Configuration
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {proposal.proposalNumber} - {proposal.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Client: {proposal.clientName}
            </Typography>
          </Box>
          {proposal.pricingConfig?.isComplete && (
            <Chip icon={<CompleteIcon />} label="Pricing Complete" color="success" />
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!hasEstimation ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No estimation data found. Please link BOMs to scope items in the Scope Matrix before
          configuring pricing.
          <Button
            size="small"
            sx={{ ml: 2 }}
            onClick={() => router.push(`/proposals/${proposalId}/scope`)}
          >
            Go to Scope Matrix
          </Button>
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Left Column - Estimation Breakdown */}
          <Box sx={{ flex: 1 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6">Estimation Breakdown</Typography>
                  <LoadingButton
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshBOMCosts}
                    loading={refreshing}
                    variant="outlined"
                  >
                    Refresh Costs
                  </LoadingButton>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Scope Item</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">BOMs</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {estimationBreakdown.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Chip label={item.type} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{item.bomCount}</TableCell>
                          <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography fontWeight="bold">Total Estimation</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {formatCurrency(calculatedPricing.estimationSubtotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Pricing Configuration */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Markup Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Overhead"
                    type="number"
                    value={overheadPercent}
                    onChange={(e) => setOverheadPercent(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="General overhead and administrative costs"
                    size="small"
                  />
                  <TextField
                    label="Contingency"
                    type="number"
                    value={contingencyPercent}
                    onChange={(e) => setContingencyPercent(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="Buffer for unforeseen costs"
                    size="small"
                  />
                  <TextField
                    label="Profit Margin"
                    type="number"
                    value={profitMarginPercent}
                    onChange={(e) => setProfitMarginPercent(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="Target profit margin"
                    size="small"
                  />
                  <Divider />
                  <TextField
                    label="Tax (GST)"
                    type="number"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="Applied to subtotal (after markups)"
                    size="small"
                  />
                  <TextField
                    label="Validity Period"
                    type="number"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">days</InputAdornment>,
                    }}
                    helperText="Proposal validity from date of issue"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Right Column - Price Summary */}
          <Box sx={{ width: { xs: '100%', md: 350 } }}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                Price Summary
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Estimation Subtotal
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(calculatedPricing.estimationSubtotal)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overhead ({overheadPercent}%)
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(calculatedPricing.overheadAmount)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Contingency ({contingencyPercent}%)
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(calculatedPricing.contingencyAmount)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Profit ({profitMarginPercent}%)
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(calculatedPricing.profitAmount)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Subtotal before Tax
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(calculatedPricing.subtotalBeforeTax)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    GST ({taxPercent}%)
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(calculatedPricing.taxAmount)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total Price</Typography>
                  <Typography variant="h6" color="primary.main">
                    {formatCurrency(calculatedPricing.totalPrice)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <LoadingButton
                  variant="contained"
                  fullWidth
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave(false)}
                  loading={saving}
                >
                  Save Draft
                </LoadingButton>
                {proposal?.pricingConfig?.isComplete ? (
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<PreviewIcon />}
                    endIcon={<ArrowIcon />}
                    onClick={() => router.push(`/proposals/${proposalId}/preview`)}
                  >
                    Continue to Preview
                  </Button>
                ) : (
                  <LoadingButton
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<CompleteIcon />}
                    onClick={() => handleSave(true)}
                    loading={saving}
                  >
                    Mark Pricing Complete
                  </LoadingButton>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      )}
    </Container>
  );
}
