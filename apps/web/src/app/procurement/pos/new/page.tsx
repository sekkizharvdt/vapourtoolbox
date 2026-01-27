'use client';

/**
 * Create Purchase Order Page
 *
 * Create a PO from a selected offer with structured commercial terms.
 * Uses the CommercialTermsForm component for the 19-section terms template.
 */

import { useState, useEffect, useMemo } from 'react';
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
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { Offer, POCommercialTerms, CommercialTermsTemplate } from '@vapour/types';
import { getOfferById } from '@/lib/procurement/offer';
import { createPOFromOffer } from '@/lib/procurement/purchaseOrderService';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import {
  getDefaultTemplate,
  getActiveTemplates,
  createCommercialTermsFromTemplate,
  validatePaymentSchedule,
} from '@/lib/procurement/commercialTerms';
import { CommercialTermsForm } from '@/components/procurement';

export default function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const offerId = searchParams.get('offerId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<CommercialTermsTemplate>(
    getDefaultTemplate()
  );
  const availableTemplates = useMemo(() => getActiveTemplates(), []);

  // Commercial terms state (structured)
  const [commercialTerms, setCommercialTerms] = useState<POCommercialTerms>(() =>
    createCommercialTermsFromTemplate(getDefaultTemplate(), '')
  );

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Expected delivery date (kept separate as it's a PO-level field, not part of commercial terms)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

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

      // Update commercial terms with offer currency
      setCommercialTerms((prev) => ({
        ...prev,
        currency: offerData.currency || 'INR',
      }));
    } catch (err) {
      console.error('[NewPOPage] Error loading offer:', err);
      setError('Failed to load offer');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = availableTemplates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      // Reset commercial terms to new template defaults, preserving delivery address
      setCommercialTerms(
        createCommercialTermsFromTemplate(template, commercialTerms.deliveryAddress, {
          currency: offer?.currency || 'INR',
        })
      );
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate delivery address
    if (!commercialTerms.deliveryAddress.trim()) {
      errors.deliveryAddress = 'Delivery address is required';
    }

    // Validate payment schedule
    const scheduleValidation = validatePaymentSchedule(commercialTerms.paymentSchedule);
    if (!scheduleValidation.isValid) {
      errors.paymentSchedule = scheduleValidation.error || 'Invalid payment schedule';
    }

    // Validate buyer contact
    if (!commercialTerms.buyerContactName.trim()) {
      errors.buyerContactName = 'Buyer contact name is required';
    }
    if (!commercialTerms.buyerContactPhone.trim()) {
      errors.buyerContactPhone = 'Buyer contact phone is required';
    }
    if (!commercialTerms.buyerContactEmail.trim()) {
      errors.buyerContactEmail = 'Buyer contact email is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePO = async () => {
    if (!user || !offer || !offerId) return;

    // Validate form
    if (!validateForm()) {
      setError('Please fix the validation errors before creating the PO');
      return;
    }

    setCreating(true);
    setError('');

    try {
      // Generate legacy text fields from structured terms for backward compatibility
      const paymentTermsText = commercialTerms.paymentSchedule
        .map((m) => `${m.percentage}% - ${m.paymentType} (${m.deliverables})`)
        .join(', ');

      const deliveryTermsText = `${commercialTerms.deliveryWeeks} weeks from ${
        commercialTerms.deliveryTrigger === 'PO_DATE'
          ? 'PO date'
          : commercialTerms.deliveryTrigger === 'ADVANCE_PAYMENT'
            ? 'advance payment receipt'
            : 'drawing approval'
      }. Price basis: ${commercialTerms.priceBasis}`;

      const warrantyTermsText = `${commercialTerms.warrantyMonthsFromSupply} months from supply or ${commercialTerms.warrantyMonthsFromCommissioning} months from commissioning, whichever is later`;

      const penaltyClauseText = `${commercialTerms.ldPerWeekPercent}% per week of delay, maximum ${commercialTerms.ldMaxPercent}% of order value`;

      // Calculate advance payment from payment schedule
      const advanceMilestone = commercialTerms.paymentSchedule.find(
        (m) => m.paymentType.toLowerCase().includes('advance')
      );
      const advancePercentage = advanceMilestone?.percentage || 0;

      const poId = await createPOFromOffer(
        offerId,
        {
          // Legacy text fields (for backward compatibility with existing code)
          paymentTerms: paymentTermsText,
          deliveryTerms: deliveryTermsText,
          warrantyTerms: warrantyTermsText,
          penaltyClause: penaltyClauseText,
          otherClauses: [],
          deliveryAddress: commercialTerms.deliveryAddress,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          advancePaymentRequired: advancePercentage > 0,
          advancePercentage: advancePercentage > 0 ? advancePercentage : undefined,

          // New structured commercial terms
          commercialTermsTemplateId: selectedTemplate.id,
          commercialTermsTemplateName: selectedTemplate.name,
          commercialTerms: commercialTerms,
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
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 0 }}>
          <Link
            color="inherit"
            href="/procurement"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Procurement
          </Link>
          <Link
            color="inherit"
            href="/procurement/pos"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement/pos');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Purchase Orders
          </Link>
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

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
            Create a purchase order from the selected offer with structured commercial terms
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

            {/* Template Selection */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Commercial Terms Template
              </Typography>
              <Divider sx={{ my: 2 }} />
              <FormControl fullWidth>
                <InputLabel>Select Template</InputLabel>
                <Select
                  value={selectedTemplate.id}
                  label="Select Template"
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {availableTemplates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && ' (Default)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>

            {/* Commercial Terms Form */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Purchase Order Terms
              </Typography>
              <Divider sx={{ my: 2 }} />
              <CommercialTermsForm
                terms={commercialTerms}
                template={selectedTemplate}
                onChange={setCommercialTerms}
                errors={formErrors}
              />
            </Paper>

            {/* Expected Delivery Date */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Expected Delivery
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TextField
                label="Expected Delivery Date"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Expected date of delivery at site"
              />
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
