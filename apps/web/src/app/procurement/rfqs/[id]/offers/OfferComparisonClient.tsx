'use client';

/**
 * Offer Comparison Page
 *
 * Compare and evaluate vendor offers for an RFQ
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOfferComparison,
  evaluateOffer,
  markOfferAsRecommended,
  selectOffer,
} from '@/lib/procurement/offer';
import { formatCurrency, calculatePriceScore } from '@/lib/procurement/offerHelpers';
import type {
  OfferComparisonData,
  ItemComparison,
  ItemOfferComparison,
  OfferComparisonStat,
  Offer,
} from '@vapour/types';

export default function OfferComparisonPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comparisonData, setComparisonData] = useState<OfferComparisonData | null>(null);
  const [rfqId, setRfqId] = useState<string | null>(null);

  // Evaluation dialog
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [evaluationScore, setEvaluationScore] = useState(50);
  const [evaluationNotes, setEvaluationNotes] = useState('');
  const [redFlags, setRedFlags] = useState('');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/rfqs\/([^/]+)\/offers/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setRfqId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (rfqId) {
      loadComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const loadComparison = async () => {
    if (!rfqId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getOfferComparison(rfqId);
      setComparisonData(data);
    } catch (err) {
      console.error('[OfferComparisonPage] Error loading comparison:', err);
      setError('Failed to load offer comparison');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!user || !selectedOfferId) return;

    try {
      await evaluateOffer(
        selectedOfferId,
        {
          evaluationScore,
          evaluationNotes,
          redFlags: redFlags ? redFlags.split(',').map((f) => f.trim()) : [],
        },
        user.uid,
        user.displayName || 'Unknown'
      );
      setEvaluationDialogOpen(false);
      await loadComparison();
    } catch (err) {
      console.error('[OfferComparisonPage] Error evaluating offer:', err);
      setError('Failed to evaluate offer');
    }
  };

  const handleRecommend = async (offerId: string) => {
    if (!user) return;

    try {
      await markOfferAsRecommended(offerId, 'Best value for money', user.uid);
      await loadComparison();
    } catch (err) {
      console.error('[OfferComparisonPage] Error recommending offer:', err);
      setError('Failed to mark offer as recommended');
    }
  };

  const handleSelectOffer = async (offerId: string) => {
    if (!user) return;

    try {
      await selectOffer(offerId, user.uid);
      router.push(`/procurement/rfqs/${rfqId}`);
    } catch (err) {
      console.error('[OfferComparisonPage] Error selecting offer:', err);
      setError('Failed to select offer');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !comparisonData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Failed to load comparison'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mt: 2 }}>
          Back
        </Button>
      </Box>
    );
  }

  const { rfq, offers, itemComparisons, offerStats, lowestTotal } = comparisonData;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 1 }}>
            Back to RFQ
          </Button>
          <Typography variant="h4" gutterBottom>
            Offer Comparison - {rfq?.number || 'N/A'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {offers.length} offer(s) received from vendors
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Offer Summary */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Offer Summary
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack
            direction="row"
            spacing={2}
            flexWrap="wrap"
            sx={{ '& > *': { flex: '1 1 calc(25% - 12px)', minWidth: 200 } }}
          >
            {offerStats.map((stat: OfferComparisonStat) => (
              <Paper key={stat.offerId} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.vendorName}
                    </Typography>
                    <Typography variant="h5">{formatCurrency(stat.totalAmount)}</Typography>
                    {stat.isRecommended && (
                      <Chip
                        icon={<StarIcon />}
                        label="Recommended"
                        color="warning"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {stat.totalAmount === lowestTotal && (
                      <Chip label="Lowest" color="success" size="small" sx={{ mt: 1, ml: 1 }} />
                    )}
                  </Box>
                  <Box textAlign="right">
                    {stat.meetsAllSpecs ? (
                      <Chip label="✓ Specs" color="success" size="small" />
                    ) : (
                      <Chip label="⚠ Deviations" color="warning" size="small" />
                    )}
                    {stat.evaluationScore && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Score: {stat.evaluationScore}/100
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* Item-wise Comparison */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Item-wise Comparison
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {itemComparisons.map((item: ItemComparison) => (
            <Box key={item.rfqItemId} sx={{ mb: 4 }}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                {item.description}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Quantity: {item.quantity} {item.unit} | Lowest Price:{' '}
                {formatCurrency(item.lowestPrice)}
              </Typography>

              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendor</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total Price</TableCell>
                      <TableCell>Delivery</TableCell>
                      <TableCell>Spec Compliance</TableCell>
                      <TableCell align="right">Price Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {item.offers.map((offer: ItemOfferComparison) => {
                      const priceScore = calculatePriceScore(offer.unitPrice, item.lowestPrice);

                      return (
                        <TableRow key={offer.offerId}>
                          <TableCell>{offer.vendorName}</TableCell>
                          <TableCell align="right">
                            {offer.unitPrice > 0 ? formatCurrency(offer.unitPrice) : 'N/A'}
                          </TableCell>
                          <TableCell align="right">
                            {offer.totalPrice > 0 ? (
                              <Box>
                                {formatCurrency(offer.totalPrice)}
                                {offer.unitPrice === item.lowestPrice && (
                                  <Chip
                                    label="Lowest"
                                    color="success"
                                    size="small"
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </Box>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>{offer.deliveryPeriod || 'N/A'}</TableCell>
                          <TableCell>
                            {offer.meetsSpec ? (
                              <Chip label="✓ Meets" color="success" size="small" />
                            ) : (
                              <Chip label="⚠ Deviations" color="warning" size="small" />
                            )}
                            {offer.deviations && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {offer.deviations}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={
                                priceScore >= 90
                                  ? 'success.main'
                                  : priceScore >= 70
                                    ? 'warning.main'
                                    : 'error.main'
                              }
                            >
                              {priceScore}/100
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Paper>

        {/* Actions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Actions
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            {offers.map((offer: Offer) => (
              <Stack
                key={offer.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {offer.vendorName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {offer.number} - {formatCurrency(offer.totalAmount)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSelectedOfferId(offer.id);
                      setEvaluationDialogOpen(true);
                    }}
                  >
                    Evaluate
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    startIcon={<StarIcon />}
                    onClick={() => handleRecommend(offer.id)}
                    disabled={offer.isRecommended}
                  >
                    {offer.isRecommended ? 'Recommended' : 'Recommend'}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleSelectOffer(offer.id)}
                    disabled={offer.status === 'SELECTED'}
                  >
                    {offer.status === 'SELECTED' ? 'Selected' : 'Select'}
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>

      {/* Evaluation Dialog */}
      <Dialog
        open={evaluationDialogOpen}
        onClose={() => setEvaluationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Evaluate Offer</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography gutterBottom>Evaluation Score (0-100)</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Rating
                  value={evaluationScore / 20}
                  onChange={(_event, newValue) => setEvaluationScore((newValue || 0) * 20)}
                  max={5}
                  size="large"
                />
                <TextField
                  type="number"
                  value={evaluationScore}
                  onChange={(e) => setEvaluationScore(Number(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                  sx={{ width: 100 }}
                />
              </Stack>
            </Box>

            <TextField
              label="Evaluation Notes"
              multiline
              rows={4}
              value={evaluationNotes}
              onChange={(e) => setEvaluationNotes(e.target.value)}
              placeholder="Enter evaluation notes..."
            />

            <TextField
              label="Red Flags (comma-separated)"
              multiline
              rows={2}
              value={redFlags}
              onChange={(e) => setRedFlags(e.target.value)}
              placeholder="e.g., Late delivery, Poor quality history, Price too high"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvaluationDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEvaluate}>
            Save Evaluation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
