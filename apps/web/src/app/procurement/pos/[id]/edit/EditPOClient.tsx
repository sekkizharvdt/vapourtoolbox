'use client';

/**
 * Edit Draft Purchase Order Client Component
 *
 * Edit commercial terms of a DRAFT PO before submitting for approval.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, POCommercialTerms, CommercialTermsTemplate } from '@vapour/types';
import { getPOById } from '@/lib/procurement/purchaseOrderService';
import { updateDraftPO } from '@/lib/procurement/purchaseOrder';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import {
  getDefaultTemplate,
  getActiveTemplates,
  getTemplateById,
  createCommercialTermsFromTemplate,
  validatePaymentSchedule,
  buildBillingAddressFromCompany,
} from '@/lib/procurement/commercialTerms';
import { CommercialTermsForm } from '@/components/procurement';

export default function EditPOClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [poId, setPoId] = useState<string | null>(null);

  // Template selection
  const [selectedTemplate, setSelectedTemplate] =
    useState<CommercialTermsTemplate>(getDefaultTemplate());
  const availableTemplates = useMemo(() => getActiveTemplates(), []);

  // Commercial terms state
  const [commercialTerms, setCommercialTerms] = useState<POCommercialTerms>(() =>
    createCommercialTermsFromTemplate(getDefaultTemplate(), '')
  );

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Expected delivery date
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

  // Extract PO ID from pathname
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/pos\/([^/]+)\/edit/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setPoId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (poId) {
      loadPO();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const loadPO = async () => {
    if (!poId) return;

    setLoading(true);
    setError('');
    try {
      const [poData, companyDoc] = await Promise.all([
        getPOById(poId),
        getDoc(doc(getFirebase().db, 'company', 'settings')),
      ]);

      if (!poData) {
        setError('Purchase Order not found');
        return;
      }

      if (poData.status !== 'DRAFT') {
        setError('Only DRAFT Purchase Orders can be edited');
        return;
      }

      setPO(poData);

      // Load existing commercial terms or create from template
      if (poData.commercialTerms) {
        // Build billing address from company profile if available
        const companySettings = companyDoc.exists() ? companyDoc.data() : null;
        const billingAddress = buildBillingAddressFromCompany(companySettings);

        setCommercialTerms({
          ...poData.commercialTerms,
          billingAddress: billingAddress || poData.commercialTerms.billingAddress,
        });
      }

      // Set template if stored on PO
      if (poData.commercialTermsTemplateId) {
        const template = getTemplateById(poData.commercialTermsTemplateId);
        if (template) setSelectedTemplate(template);
      }

      // Set expected delivery date
      if (poData.expectedDeliveryDate) {
        const date = poData.expectedDeliveryDate.toDate?.()
          ? poData.expectedDeliveryDate.toDate()
          : new Date(poData.expectedDeliveryDate as unknown as string);
        setExpectedDeliveryDate(date.toISOString().split('T')[0] ?? '');
      }
    } catch (err) {
      console.error('[EditPOPage] Error loading PO:', err);
      setError('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = availableTemplates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCommercialTerms(
        createCommercialTermsFromTemplate(template, commercialTerms.deliveryAddress, {
          currency: po?.currency || 'INR',
          billingAddress: commercialTerms.billingAddress,
        })
      );
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!commercialTerms.deliveryAddress.trim()) {
      errors.deliveryAddress = 'Delivery address is required';
    }

    const scheduleValidation = validatePaymentSchedule(commercialTerms.paymentSchedule);
    if (!scheduleValidation.isValid) {
      errors.paymentSchedule = scheduleValidation.error || 'Invalid payment schedule';
    }

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

  const handleSave = async () => {
    if (!user || !po || !poId) return;

    if (!validateForm()) {
      setError('Please fix the validation errors before saving');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Generate text fields from structured terms
      const paymentTermsText = commercialTerms.paymentSchedule
        .map((m) => `${m.percentage}% - ${m.paymentType} (${m.deliverables})`)
        .join(', ');

      const deliveryUnitLabel =
        commercialTerms.deliveryUnit === 'DAYS'
          ? 'days'
          : commercialTerms.deliveryUnit === 'MONTHS'
            ? 'months'
            : 'weeks';

      const deliveryTriggerLabel =
        commercialTerms.deliveryTrigger === 'PO_DATE'
          ? 'PO date'
          : commercialTerms.deliveryTrigger === 'ADVANCE_PAYMENT'
            ? 'advance payment receipt'
            : 'drawing approval';

      const deliveryTermsText =
        commercialTerms.deliveryUnit === 'READY_STOCK'
          ? `Ready Stock - items available immediately. Price basis: ${commercialTerms.priceBasis}`
          : `${commercialTerms.deliveryPeriod ?? commercialTerms.deliveryWeeks ?? 8} ${deliveryUnitLabel} from ${deliveryTriggerLabel}. Price basis: ${commercialTerms.priceBasis}`;

      const warrantyTermsText = `${commercialTerms.warrantyMonthsFromSupply} months from supply or ${commercialTerms.warrantyMonthsFromCommissioning} months from commissioning, whichever is later`;

      const penaltyClauseText = `${commercialTerms.ldPerWeekPercent}% per week of delay, maximum ${commercialTerms.ldMaxPercent}% of order value`;

      const advanceMilestone = commercialTerms.paymentSchedule.find((m) =>
        m.paymentType.toLowerCase().includes('advance')
      );
      const advancePercentage = advanceMilestone?.percentage || 0;

      await updateDraftPO(
        poId,
        {
          paymentTerms: paymentTermsText,
          deliveryTerms: deliveryTermsText,
          warrantyTerms: warrantyTermsText,
          penaltyClause: penaltyClauseText,
          deliveryAddress: commercialTerms.deliveryAddress,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          advancePaymentRequired: advancePercentage > 0,
          advancePercentage: advancePercentage > 0 ? advancePercentage : undefined,
          commercialTermsTemplateId: selectedTemplate.id,
          commercialTermsTemplateName: selectedTemplate.name,
          commercialTerms: commercialTerms,
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/pos/${poId}`);
    } catch (err) {
      console.error('[EditPOPage] Error saving PO:', err);
      setError('Failed to save changes. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !po) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/pos')}
          sx={{ mt: 2 }}
        >
          Back to Purchase Orders
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
          <Link
            color="inherit"
            href={`/procurement/pos/${poId}`}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push(`/procurement/pos/${poId}`);
            }}
            sx={{ cursor: 'pointer' }}
          >
            {po?.number}
          </Link>
          <Typography color="text.primary">Edit</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/procurement/pos/${poId}`)}
            sx={{ mb: 1 }}
          >
            Back to PO
          </Button>
          <Typography variant="h4" gutterBottom>
            Edit {po?.number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Edit commercial terms before submitting for approval
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {po && (
          <>
            {/* PO Summary */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                PO Summary
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{po.vendorName}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Offer
                  </Typography>
                  <Typography variant="body1">{po.selectedOfferNumber}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(po.grandTotal, po.currency)}
                  </Typography>
                </Box>
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
              <Button onClick={() => router.push(`/procurement/pos/${poId}`)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
