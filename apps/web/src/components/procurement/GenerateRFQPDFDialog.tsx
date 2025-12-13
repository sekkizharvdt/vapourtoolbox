'use client';

/**
 * Generate RFQ PDF Dialog
 *
 * Allows users to generate RFQ PDFs with customizable options:
 * - Select vendors (individual or combined PDF)
 * - Customize terms and conditions
 * - Set company information
 * - Add watermark, notes, etc.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  FormControl,
  RadioGroup,
  Radio,
  FormLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Storefront as VendorIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { RFQ } from '@vapour/types';
import type { RFQPDFGenerationOptions, RFQPDFGenerationResult, RFQPDFMode } from '@vapour/types';

interface GenerateRFQPDFDialogProps {
  open: boolean;
  onClose: () => void;
  rfq: RFQ;
  onSuccess?: () => void;
}

export default function GenerateRFQPDFDialog({
  open,
  onClose,
  rfq,
  onSuccess,
}: GenerateRFQPDFDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RFQPDFGenerationResult | null>(null);

  // Generation mode
  const [mode, setMode] = useState<RFQPDFMode>('INDIVIDUAL');

  // Selected vendors for individual mode
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>(rfq.vendorIds);

  // Company information
  const [companyName, setCompanyName] = useState('Vapour Desal Technologies');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyGSTIN, setCompanyGSTIN] = useState('');

  // Contact person
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');

  // Terms
  const [useDefaultTerms, setUseDefaultTerms] = useState(true);
  const [generalTerms, setGeneralTerms] = useState<string[]>([
    'All specifications mentioned in this RFQ are minimum requirements.',
    'Vendor must provide detailed technical specifications with the quotation.',
    'Prices should be inclusive of all applicable taxes unless stated otherwise.',
    'Quotation validity should be minimum 30 days from submission date.',
    'Any deviations from specifications must be clearly mentioned.',
    'Vendor must mention lead time for delivery.',
  ]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([
    '30% advance against proforma invoice',
    '60% before dispatch against submission of test certificates',
    '10% within 30 days of receipt and acceptance at site',
  ]);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([
    'Delivery location: As mentioned in the RFQ',
    'Packing should be suitable for long distance transportation',
    'All materials should be properly labeled with PO number and item details',
  ]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([
    'Minimum warranty period: 12 months from date of commissioning or 18 months from date of supply, whichever is earlier',
  ]);

  // Display options
  const [showItemSpecifications, setShowItemSpecifications] = useState(true);
  const [showDeliveryDates, setShowDeliveryDates] = useState(true);
  const [showEquipmentCodes, setShowEquipmentCodes] = useState(true);

  // Additional
  const [watermark, setWatermark] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setSelectedVendorIds(rfq.vendorIds);
    }
  }, [open, rfq.vendorIds]);

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  const handleVendorToggle = (vendorId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const handleSelectAllVendors = () => {
    setSelectedVendorIds(rfq.vendorIds);
  };

  const handleDeselectAllVendors = () => {
    setSelectedVendorIds([]);
  };

  const handleGenerate = async () => {
    setError(null);
    setResult(null);

    // Validation
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (mode !== 'COMBINED' && selectedVendorIds.length === 0) {
      setError('Please select at least one vendor');
      return;
    }

    try {
      setGenerating(true);

      const { app, auth } = getFirebase();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('You must be logged in to generate PDFs');
      }

      const options: RFQPDFGenerationOptions = {
        rfqId: rfq.id,
        mode,
        vendorIds: mode === 'COMBINED' ? undefined : selectedVendorIds,
        companyName,
        companyAddress: companyAddress || undefined,
        companyPhone: companyPhone || undefined,
        companyEmail: companyEmail || undefined,
        companyGSTIN: companyGSTIN || undefined,
        generalTerms: useDefaultTerms ? undefined : generalTerms.filter(Boolean),
        paymentTerms: useDefaultTerms ? undefined : paymentTerms.filter(Boolean),
        deliveryTerms: useDefaultTerms ? undefined : deliveryTerms.filter(Boolean),
        warrantyTerms: useDefaultTerms ? undefined : warrantyTerms.filter(Boolean),
        showItemSpecifications,
        showDeliveryDates,
        showEquipmentCodes,
        watermark: watermark || undefined,
        customNotes: customNotes || undefined,
        contactPersonName: contactPersonName || undefined,
        contactPersonEmail: contactPersonEmail || undefined,
        contactPersonPhone: contactPersonPhone || undefined,
      };

      const functions = getFunctions(app, 'asia-south1');
      const generatePDF = httpsCallable<
        { rfqId: string; options: RFQPDFGenerationOptions; userId: string },
        RFQPDFGenerationResult
      >(functions, 'generateRFQPDF');

      const response = await generatePDF({
        rfqId: rfq.id,
        options,
        userId: user.uid,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'PDF generation failed');
      }

      setResult(response.data);
      onSuccess?.();
    } catch (err) {
      console.error('Error generating RFQ PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const handleTermsChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter(value.split('\n').filter((line) => line.trim()));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PdfIcon color="success" />
          Generate RFQ PDF - {rfq.number}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {result ? (
          // Show results
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully generated {result.totalFiles} PDF file(s)!
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Some PDFs could not be generated:
                <ul>
                  {result.errors.map((err, i) => (
                    <li key={i}>{err.error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Generated PDFs:
            </Typography>

            <List>
              {result.vendorPdfs?.map((pdf) => (
                <ListItem key={pdf.vendorId} disablePadding>
                  <ListItemButton onClick={() => handleDownload(pdf.pdfUrl)}>
                    <ListItemIcon>
                      <PdfIcon color="error" />
                    </ListItemIcon>
                    <ListItemText primary={pdf.vendorName} secondary="Click to download" />
                    <DownloadIcon color="primary" />
                  </ListItemButton>
                </ListItem>
              ))}

              {result.combinedPdfUrl && (
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleDownload(result.combinedPdfUrl!)}>
                    <ListItemIcon>
                      <PdfIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Combined PDF (All Vendors)"
                      secondary="Click to download"
                    />
                    <DownloadIcon color="primary" />
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Box>
        ) : (
          // Show form
          <Stack spacing={3}>
            {/* Generation Mode */}
            <Box>
              <FormControl>
                <FormLabel>PDF Generation Mode</FormLabel>
                <RadioGroup
                  row
                  value={mode}
                  onChange={(e) => setMode(e.target.value as RFQPDFMode)}
                >
                  <FormControlLabel
                    value="INDIVIDUAL"
                    control={<Radio />}
                    label="One PDF per vendor"
                  />
                  <FormControlLabel value="COMBINED" control={<Radio />} label="One combined PDF" />
                  <FormControlLabel value="BOTH" control={<Radio />} label="Both" />
                </RadioGroup>
              </FormControl>
            </Box>

            {/* Vendor Selection */}
            {mode !== 'COMBINED' && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VendorIcon />
                    <Typography>Select Vendors ({selectedVendorIds.length} selected)</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 1 }}>
                    <Button size="small" onClick={handleSelectAllVendors}>
                      Select All
                    </Button>
                    <Button size="small" onClick={handleDeselectAllVendors}>
                      Deselect All
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {rfq.vendorIds.map((vendorId, index) => (
                      <Chip
                        key={vendorId}
                        label={rfq.vendorNames[index] || vendorId}
                        onClick={() => handleVendorToggle(vendorId)}
                        color={selectedVendorIds.includes(vendorId) ? 'primary' : 'default'}
                        variant={selectedVendorIds.includes(vendorId) ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Company Information */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon />
                  <Typography>Company Information</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="Company Name *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Company Address"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Phone"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="GSTIN"
                    value={companyGSTIN}
                    onChange={(e) => setCompanyGSTIN(e.target.value)}
                    fullWidth
                  />
                  <Divider />
                  <Typography variant="subtitle2" color="text.secondary">
                    Contact Person (for queries)
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Name"
                      value={contactPersonName}
                      onChange={(e) => setContactPersonName(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={contactPersonEmail}
                      onChange={(e) => setContactPersonEmail(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Phone"
                      value={contactPersonPhone}
                      onChange={(e) => setContactPersonPhone(e.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Terms & Conditions */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon />
                  <Typography>Terms & Conditions</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useDefaultTerms}
                        onChange={(e) => setUseDefaultTerms(e.target.checked)}
                      />
                    }
                    label="Use default terms"
                  />

                  {!useDefaultTerms && (
                    <>
                      <TextField
                        label="General Terms (one per line)"
                        value={generalTerms.join('\n')}
                        onChange={(e) => handleTermsChange(setGeneralTerms, e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                      />
                      <TextField
                        label="Payment Terms (one per line)"
                        value={paymentTerms.join('\n')}
                        onChange={(e) => handleTermsChange(setPaymentTerms, e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                      />
                      <TextField
                        label="Delivery Terms (one per line)"
                        value={deliveryTerms.join('\n')}
                        onChange={(e) => handleTermsChange(setDeliveryTerms, e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                      />
                      <TextField
                        label="Warranty Terms (one per line)"
                        value={warrantyTerms.join('\n')}
                        onChange={(e) => handleTermsChange(setWarrantyTerms, e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                      />
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Display Options */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon />
                  <Typography>Display Options</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showItemSpecifications}
                        onChange={(e) => setShowItemSpecifications(e.target.checked)}
                      />
                    }
                    label="Show item specifications"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showDeliveryDates}
                        onChange={(e) => setShowDeliveryDates(e.target.checked)}
                      />
                    }
                    label="Show required by dates"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showEquipmentCodes}
                        onChange={(e) => setShowEquipmentCodes(e.target.checked)}
                      />
                    }
                    label="Show equipment codes"
                  />
                  <Divider sx={{ my: 1 }} />
                  <TextField
                    label="Watermark (optional)"
                    value={watermark}
                    onChange={(e) => setWatermark(e.target.value)}
                    placeholder="e.g., DRAFT, CONFIDENTIAL"
                    helperText="Leave empty for no watermark"
                  />
                  <TextField
                    label="Additional Notes (optional)"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    multiline
                    rows={2}
                    placeholder="Any additional notes to include in the RFQ"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <PdfIcon />}
            color="success"
          >
            {generating ? 'Generating...' : 'Generate PDF'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
