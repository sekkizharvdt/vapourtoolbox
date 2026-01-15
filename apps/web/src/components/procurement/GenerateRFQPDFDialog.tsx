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
  Box,
  CircularProgress,
  Alert,
  Chip,
  Tab,
  Tabs,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { RFQ, DocumentRecord } from '@vapour/types';
import type { RFQPDFGenerationOptions, RFQPDFGenerationResult, RFQPDFMode } from '@vapour/types';
import { ExistingPDFsTab, GenerateNewTab, PDFGenerationResult, type ExistingPDF } from './rfq-pdf';

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
  const [companyName, setCompanyName] = useState('Vapour Desal Technologies Private Limited');
  const [companyAddress, setCompanyAddress] = useState(
    'SP Arcade, D-54, 9A Cross Road, West Thillai Nagar, Tiruchirappalli – 620018'
  );
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyGSTIN, setCompanyGSTIN] = useState('33AAJCS6943E1ZA');

  // Contact person
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');

  // Terms
  const [useDefaultTerms, setUseDefaultTerms] = useState(true);
  const [generalTerms, setGeneralTerms] = useState<string[]>([
    'All specifications mentioned are minimum requirements.',
    'Vendor must provide detailed technical specifications.',
    'Prices shall include all applicable taxes unless stated otherwise.',
  ]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([
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
          uploadedAt: data.uploadedAt as Timestamp,
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
          <PDFGenerationResult result={result} onDownload={handleDownload} />
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
                label={`Existing PDFs (${existingPdfs.filter((p) => p.isLatest).length})`}
              />
              <Tab icon={<AddIcon />} iconPosition="start" label="Generate New" />
            </Tabs>

            {/* Tab 0: Existing PDFs */}
            {activeTab === 0 && (
              <ExistingPDFsTab
                rfq={rfq}
                existingPdfs={existingPdfs}
                loadingExisting={loadingExisting}
                onRefresh={loadExistingPdfs}
                onSwitchToGenerate={() => setActiveTab(1)}
              />
            )}

            {/* Tab 1: Generate New */}
            {activeTab === 1 && (
              <GenerateNewTab
                rfq={rfq}
                mode={mode}
                setMode={setMode}
                selectedVendorIds={selectedVendorIds}
                onVendorToggle={handleVendorToggle}
                onSelectAllVendors={handleSelectAllVendors}
                onDeselectAllVendors={handleDeselectAllVendors}
                companyName={companyName}
                setCompanyName={setCompanyName}
                companyAddress={companyAddress}
                setCompanyAddress={setCompanyAddress}
                companyPhone={companyPhone}
                setCompanyPhone={setCompanyPhone}
                companyEmail={companyEmail}
                setCompanyEmail={setCompanyEmail}
                companyGSTIN={companyGSTIN}
                setCompanyGSTIN={setCompanyGSTIN}
                contactPersonName={contactPersonName}
                setContactPersonName={setContactPersonName}
                contactPersonEmail={contactPersonEmail}
                setContactPersonEmail={setContactPersonEmail}
                contactPersonPhone={contactPersonPhone}
                setContactPersonPhone={setContactPersonPhone}
                useDefaultTerms={useDefaultTerms}
                setUseDefaultTerms={setUseDefaultTerms}
                generalTerms={generalTerms}
                setGeneralTerms={setGeneralTerms}
                paymentTerms={paymentTerms}
                setPaymentTerms={setPaymentTerms}
                deliveryTerms={deliveryTerms}
                setDeliveryTerms={setDeliveryTerms}
                warrantyTerms={warrantyTerms}
                setWarrantyTerms={setWarrantyTerms}
                showItemSpecifications={showItemSpecifications}
                setShowItemSpecifications={setShowItemSpecifications}
                showDeliveryDates={showDeliveryDates}
                setShowDeliveryDates={setShowDeliveryDates}
                showEquipmentCodes={showEquipmentCodes}
                setShowEquipmentCodes={setShowEquipmentCodes}
                watermark={watermark}
                setWatermark={setWatermark}
                customNotes={customNotes}
                setCustomNotes={setCustomNotes}
              />
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
