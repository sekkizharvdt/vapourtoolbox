'use client';

/**
 * Edit Draft Purchase Order Client Component
 *
 * Edit commercial terms of a DRAFT PO before submitting for approval.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  POCommercialTerms,
  CommercialTermsTemplate,
} from '@vapour/types';
import { getPOById } from '@/lib/procurement/purchaseOrderService';
import {
  updateDraftPO,
  getPOItems,
  updatePOItemFields,
  addPOAttachment,
  removePOAttachment,
} from '@/lib/procurement/purchaseOrder';
import DocumentUploadWidget from '@/components/procurement/DocumentUploadWidget';
import { toDate } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import {
  getDefaultTemplate,
  getActiveTemplates,
  getTemplateById,
  createCommercialTermsFromTemplate,
  validatePaymentSchedule,
  buildBillingAddressFromCompany,
  buildWarrantyClause,
} from '@/lib/procurement/commercialTerms';
import { CommercialTermsForm } from '@/components/procurement';

export default function EditPOClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, claims } = useAuth();

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

  // PO header description (editable to fix auto-population — feedback iZqGG)
  const [description, setDescription] = useState('');

  // Line items — Specification + HSN/SAC are editable here (moved out of View).
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  // Original spec/HSN per item id, to write only changed items on save.
  const originalItemFields = useRef<Map<string, { specification: string; hsnSacCode: string }>>(
    new Map()
  );

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
      const [poData, itemsData, companyDoc] = await Promise.all([
        getPOById(poId),
        getPOItems(poId),
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
      setDescription(poData.description ?? '');
      setItems(itemsData);
      originalItemFields.current = new Map(
        itemsData.map((it) => [
          it.id,
          { specification: it.specification ?? '', hsnSacCode: it.hsnSacCode ?? '' },
        ])
      );

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

  const handleItemFieldChange = (
    itemId: string,
    field: 'specification' | 'hsnSacCode',
    value: string
  ) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)));
  };

  const handleUploadAttachment = async (file: File) => {
    if (!user || !poId) return;
    const attachment = await addPOAttachment(poId, file, user.uid, claims?.permissions || 0);
    setPO((prev) =>
      prev ? { ...prev, attachments: [...(prev.attachments ?? []), attachment] } : prev
    );
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!user || !poId) return;
    await removePOAttachment(poId, attachmentId, user.uid, claims?.permissions || 0);
    setPO((prev) =>
      prev
        ? { ...prev, attachments: (prev.attachments ?? []).filter((a) => a.id !== attachmentId) }
        : prev
    );
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!(commercialTerms.deliveryAddress ?? '').trim()) {
      errors.deliveryAddress = 'Delivery address is required';
    }

    const scheduleValidation = validatePaymentSchedule(commercialTerms.paymentSchedule);
    if (!scheduleValidation.isValid) {
      errors.paymentSchedule = scheduleValidation.error || 'Invalid payment schedule';
    }

    if (!(commercialTerms.buyerContactName ?? '').trim()) {
      errors.buyerContactName = 'Buyer contact name is required';
    }
    if (!(commercialTerms.buyerContactPhone ?? '').trim()) {
      errors.buyerContactPhone = 'Buyer contact phone is required';
    }
    if (!(commercialTerms.buyerContactEmail ?? '').trim()) {
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

      // Use the canonical helper (rule 32) so edit matches create — omits zero
      // terms and honours warrantyApplicable/comparison instead of always emitting
      // the "... or 0 months from commissioning, whichever is later" string.
      const warrantyTermsText = buildWarrantyClause(commercialTerms);

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
          description,
        },
        user.uid,
        user.displayName || 'Unknown',
        claims?.permissions || 0
      );

      // Persist edited line-item Specification / HSN-SAC — only changed rows.
      const changedItems = items.filter((it) => {
        const orig = originalItemFields.current.get(it.id);
        return (
          !orig ||
          orig.specification !== (it.specification ?? '') ||
          orig.hsnSacCode !== (it.hsnSacCode ?? '')
        );
      });
      for (const it of changedItems) {
        await updatePOItemFields(
          it.id,
          { specification: it.specification ?? '', hsnSacCode: it.hsnSacCode ?? '' },
          user.uid,
          claims?.permissions || 0
        );
      }

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
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Purchase Orders', href: '/procurement/pos' },
            { label: po?.number ?? '', href: `/procurement/pos/${poId}` },
            { label: 'Edit' },
          ]}
        />

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

            {/* PO Description (editable to correct auto-population) */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TextField
                label="PO Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                helperText="Shown on the PO and PDF. Correct any auto-populated text here."
              />
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

            {/* Line Items — Specification + HSN/SAC editable */}
            {items.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Line Items
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Edit Specification and HSN/SAC here. Other line values are fixed from the offer.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={40}>#</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Specification</TableCell>
                        <TableCell width={130}>HSN/SAC</TableCell>
                        <TableCell width={70} align="right">
                          Qty
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items
                        .slice()
                        .sort((a, b) => a.lineNumber - b.lineNumber)
                        .map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>{item.lineNumber}</TableCell>
                            <TableCell>
                              <Typography variant="body2">{item.description}</Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                value={item.specification ?? ''}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'specification', e.target.value)
                                }
                                placeholder="Specification"
                                size="small"
                                fullWidth
                                multiline
                                maxRows={3}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                value={item.hsnSacCode ?? ''}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'hsnSacCode', e.target.value)
                                }
                                placeholder="HSN/SAC"
                                size="small"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell align="right">
                              {item.quantity} {item.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* Attachments — upload/manage during editing */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Attachments
              </Typography>
              <Divider sx={{ my: 2 }} />
              <DocumentUploadWidget
                documents={(po.attachments ?? []).map((a) => ({
                  id: a.id,
                  fileName: a.fileName,
                  fileUrl: a.fileUrl,
                  fileSize: a.fileSize,
                  uploadedAt: toDate(a.uploadedAt) ?? new Date(0),
                }))}
                onUpload={handleUploadAttachment}
                onDelete={handleDeleteAttachment}
                onDownload={(d) => window.open(d.fileUrl, '_blank')}
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
