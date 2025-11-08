'use client';

/**
 * Create Purchase Order Page
 *
 * Create a PO from a selected offer
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { Offer } from '@vapour/types';
import { getOfferById } from '@/lib/procurement/offerService';
import { createPOFromOffer } from '@/lib/procurement/purchaseOrderService';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

export default function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const offerId = searchParams.get('offerId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);

  // Form fields
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [penaltyClause, setPenaltyClause] = useState('');
  const [otherClauses, setOtherClauses] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [advancePaymentRequired, setAdvancePaymentRequired] = useState(false);
  const [advancePercentage, setAdvancePercentage] = useState(30);

  useEffect(() => {
    if (!offerId) {
      setError('No offer selected. Please select an offer first.');
      setLoading(false);
      return;
    }
    loadOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  const loadOffer = async () => {
    if (!offerId) return;

    setLoading(true);
    setError('');
    try {
      const offerData = await getOfferById(offerId);
      if (!offerData) {
        setError('Offer not found');
        return;
      }

      if (offerData.status !== 'SELECTED') {
        setError('Only selected offers can be converted to Purchase Orders');
        return;
      }

      setOffer(offerData);

      // Pre-fill from offer if available
      if (offerData.paymentTerms) setPaymentTerms(offerData.paymentTerms);
      if (offerData.deliveryTerms) setDeliveryTerms(offerData.deliveryTerms);
      if (offerData.warrantyTerms) setWarrantyTerms(offerData.warrantyTerms);
    } catch (err) {
      console.error('[NewPOPage] Error loading offer:', err);
      setError('Failed to load offer');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async () => {
    if (!user || !offer || !offerId) return;

    // Validation
    if (!paymentTerms.trim()) {
      setError('Payment terms are required');
      return;
    }

    if (!deliveryTerms.trim()) {
      setError('Delivery terms are required');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }

    if (advancePaymentRequired && (advancePercentage <= 0 || advancePercentage > 100)) {
      setError('Advance percentage must be between 1 and 100');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const otherClausesArray = otherClauses
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const poId = await createPOFromOffer(
        offerId,
        {
          paymentTerms,
          deliveryTerms,
          warrantyTerms: warrantyTerms || undefined,
          penaltyClause: penaltyClause || undefined,
          otherClauses: otherClausesArray.length > 0 ? otherClausesArray : undefined,
          deliveryAddress,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          advancePaymentRequired,
          advancePercentage: advancePaymentRequired ? advancePercentage : undefined,
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/pos/${poId}`);
    } catch (err) {
      console.error('[NewPOPage] Error creating PO:', err);
      setError('Failed to create Purchase Order. Please try again.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !offer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/rfqs')}
          sx={{ mt: 2 }}
        >
          Back to RFQs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/procurement/rfqs/${offer?.rfqId}/offers`)}
            sx={{ mb: 1 }}
          >
            Back to Offers
          </Button>
          <Typography variant="h4" gutterBottom>
            Create Purchase Order
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a purchase order from the selected offer
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {offer && (
          <>
            {/* Offer Summary */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Selected Offer
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Box flex={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Vendor
                    </Typography>
                    <Typography variant="body1">{offer.vendorName}</Typography>
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Offer Number
                    </Typography>
                    <Typography variant="body1">{offer.number}</Typography>
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(offer.totalAmount, offer.currency)}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </Paper>

            {/* PO Terms Form */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Purchase Order Terms
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={3}>
                <TextField
                  label="Payment Terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  required
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="e.g., 30% advance, 60% on delivery, 10% after commissioning"
                  helperText="Specify the payment schedule and terms"
                />

                <TextField
                  label="Delivery Terms"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  required
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g., CIF Mumbai Port, FOB Dubai"
                  helperText="Specify delivery terms (CIF, FOB, etc.)"
                />

                <TextField
                  label="Delivery Address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Complete delivery address with contact details"
                />

                <TextField
                  label="Expected Delivery Date"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Expected date of delivery"
                />

                <TextField
                  label="Warranty Terms"
                  value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g., 12 months from date of commissioning"
                />

                <TextField
                  label="Penalty Clause"
                  value={penaltyClause}
                  onChange={(e) => setPenaltyClause(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g., 0.5% per week of delay, max 10% of order value"
                />

                <TextField
                  label="Other Clauses"
                  value={otherClauses}
                  onChange={(e) => setOtherClauses(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Enter each clause on a new line"
                  helperText="Additional terms and conditions (one per line)"
                />
              </Stack>
            </Paper>

            {/* Advance Payment */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Advance Payment
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={advancePaymentRequired}
                      onChange={(e) => setAdvancePaymentRequired(e.target.checked)}
                    />
                  }
                  label="Advance payment required"
                />

                {advancePaymentRequired && (
                  <>
                    <TextField
                      label="Advance Percentage"
                      type="number"
                      value={advancePercentage}
                      onChange={(e) => setAdvancePercentage(Number(e.target.value))}
                      inputProps={{ min: 1, max: 100 }}
                      fullWidth
                      helperText="Percentage of total amount to be paid in advance"
                    />
                    <Alert severity="info">
                      Advance amount:{' '}
                      {formatCurrency(
                        (offer.totalAmount * advancePercentage) / 100,
                        offer.currency
                      )}
                    </Alert>
                  </>
                )}
              </Stack>
            </Paper>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                onClick={() => router.push(`/procurement/rfqs/${offer.rfqId}/offers`)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreatePO}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
