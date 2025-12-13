'use client';

/**
 * Generate RFQ PDF Dialog
 *
 * Allows users to generate RFQ PDFs with customizable options:
 * - View and download existing PDFs without regeneration
 * - Select vendors (individual or combined PDF)
 * - Customize terms and conditions
 * - Set company information
 * - Add watermark, notes, etc.
 * - Revision tracking with version history
 */

import { useState, useEffect, useCallback } from 'react';
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
  Tab,
  Tabs,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Storefront as VendorIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { RFQ, DocumentRecord } from '@vapour/types';
import type { RFQPDFGenerationOptions, RFQPDFGenerationResult, RFQPDFMode } from '@vapour/types';

interface ExistingPDF {
  id: string;
  title: string;
  vendorId?: string;
  vendorName?: string;
  version: number;
  fileUrl: string;
  uploadedAt: Timestamp;
  uploadedByName: string;
  isLatest: boolean;
}

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

  // Tab state: 0 = Existing PDFs, 1 = Generate New
  const [activeTab, setActiveTab] = useState(0);

  // Existing PDFs
  const [existingPdfs, setExistingPdfs] = useState<ExistingPDF[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

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

  // Load existing PDFs for this RFQ
  const loadExistingPdfs = useCallback(async () => {
    setLoadingExisting(true);
    try {
      const { db } = getFirebase();

      // Query documents collection for RFQ PDFs
      const q = query(
        collection(db, 'documents'),
        where('entityType', '==', 'RFQ'),
        where('entityId', '==', rfq.id),
        where('documentType', '==', 'RFQ_PDF'),
        orderBy('uploadedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const pdfs: ExistingPDF[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as DocumentRecord;
        // Extract vendor info from tags if present
        const vendorIdTag = data.tags?.find(
          (t: string) => t !== 'vendor-specific' && t !== 'combined'
        );
        const isVendorSpecific = data.tags?.includes('vendor-specific');

        pdfs.push({
          id: doc.id,
          title: data.title || data.fileName,
          vendorId: isVendorSpecific ? vendorIdTag : undefined,
          vendorName: isVendorSpecific
            ? data.title?.replace(`${rfq.number} - `, '') || undefined
            : undefined,
          version: data.version || 1,
          fileUrl: data.fileUrl,
          uploadedAt: data.uploadedAt,
          uploadedByName: data.uploadedByName,
          isLatest: data.isLatest,
        });
      });

      setExistingPdfs(pdfs);

      // If there are existing PDFs, stay on existing tab; otherwise switch to generate
      if (pdfs.length === 0) {
        setActiveTab(1);
      }
    } catch (err) {
      console.error('Error loading existing PDFs:', err);
      // Don't set error - just show empty state
    } finally {
      setLoadingExisting(false);
    }
  }, [rfq.id, rfq.number]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setSelectedVendorIds(rfq.vendorIds);
      setActiveTab(0);
      loadExistingPdfs();
    }
  }, [open, rfq.vendorIds, loadExistingPdfs]);

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

  // Format date for display
  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get latest PDFs only
  const latestPdfs = existingPdfs.filter((pdf) => pdf.isLatest);

  // Get version history (non-latest)
  const historicalPdfs = existingPdfs.filter((pdf) => !pdf.isLatest);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PdfIcon color="success" />
          RFQ PDF - {rfq.number}
          {rfq.pdfVersion && <Chip label={`v${rfq.pdfVersion}`} size="small" color="info" />}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {result ? (
          // Show results after generation
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully generated {result.totalFiles} PDF file(s)! (Version {result.pdfVersion})
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
          <Box>
            {/* Tab navigation */}
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<DownloadIcon />}
                iconPosition="start"
                label={`Existing PDFs (${latestPdfs.length})`}
              />
              <Tab icon={<AddIcon />} iconPosition="start" label="Generate New" />
            </Tabs>

            {/* Tab 0: Existing PDFs */}
            {activeTab === 0 && (
              <Box>
                {loadingExisting ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : latestPdfs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PdfIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography color="text.secondary">
                      No PDFs have been generated for this RFQ yet.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setActiveTab(1)}
                      sx={{ mt: 2 }}
                      color="success"
                    >
                      Generate First PDF
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="subtitle2" color="text.secondary">
                        Latest PDFs
                      </Typography>
                      <Tooltip title="Refresh">
                        <IconButton size="small" onClick={loadExistingPdfs}>
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <List disablePadding>
                      {latestPdfs.map((pdf) => (
                        <ListItem key={pdf.id} disablePadding sx={{ mb: 1 }}>
                          <ListItemButton
                            onClick={() => handleDownload(pdf.fileUrl)}
                            sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                          >
                            <ListItemIcon>
                              <PdfIcon color="error" />
                            </ListItemIcon>
                            <ListItemText
                              primary={pdf.title}
                              secondary={
                                <>
                                  Version {pdf.version} • Generated by {pdf.uploadedByName}
                                  <br />
                                  {formatDate(pdf.uploadedAt)}
                                </>
                              }
                            />
                            <Chip
                              label={`v${pdf.version}`}
                              size="small"
                              color="primary"
                              sx={{ mr: 1 }}
                            />
                            <DownloadIcon color="primary" />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>

                    {historicalPdfs.length > 0 && (
                      <Accordion sx={{ mt: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <HistoryIcon />
                            <Typography>
                              Version History ({historicalPdfs.length} older versions)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <List disablePadding dense>
                            {historicalPdfs.map((pdf) => (
                              <ListItem key={pdf.id} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                  onClick={() => handleDownload(pdf.fileUrl)}
                                  sx={{ borderRadius: 1, opacity: 0.7 }}
                                >
                                  <ListItemIcon>
                                    <PdfIcon color="disabled" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={pdf.title}
                                    secondary={`v${pdf.version} • ${formatDate(pdf.uploadedAt)}`}
                                  />
                                  <DownloadIcon color="action" />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Tip:</strong> If you need to regenerate PDFs (e.g., after RFQ
                        changes), switch to the &quot;Generate New&quot; tab. Previous versions will
                        be preserved.
                      </Typography>
                    </Alert>
                  </>
                )}
              </Box>
            )}

            {/* Tab 1: Generate New */}
            {activeTab === 1 && (
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
                      <FormControlLabel
                        value="COMBINED"
                        control={<Radio />}
                        label="One combined PDF"
                      />
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
                        <Typography>
                          Select Vendors ({selectedVendorIds.length} selected)
                        </Typography>
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
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && activeTab === 1 && (
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <PdfIcon />}
            color="success"
          >
            {generating
              ? 'Generating...'
              : existingPdfs.length > 0
                ? 'Regenerate PDF'
                : 'Generate PDF'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
