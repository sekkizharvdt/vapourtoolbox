'use client';

import { useState } from 'react';
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
  Grid,
} from '@mui/material';
import { PictureAsPdf as PdfIcon, Download as DownloadIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { PDFGenerationOptions, PDFGenerationResult } from '@vapour/types';

interface GeneratePDFDialogProps {
  open: boolean;
  onClose: () => void;
  bomId: string;
  bomName: string;
}

export default function GeneratePDFDialog({
  open,
  onClose,
  bomId,
  bomName,
}: GeneratePDFDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState('Vapour Desal Technologies');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAttention, setCustomerAttention] = useState('');
  const [preparedBy, setPreparedBy] = useState('');

  // Display options
  const [showCostBreakdown, setShowCostBreakdown] = useState(true);
  const [showIndirectCosts, setShowIndirectCosts] = useState(true);
  const [showItemDetails, setShowItemDetails] = useState(true);
  const [showMaterialCodes, setShowMaterialCodes] = useState(true);
  const [showServices, setShowServices] = useState(true);

  const handleClose = () => {
    setPdfUrl(null);
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    setError(null);
    setPdfUrl(null);

    // Validation
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }

    try {
      setGenerating(true);

      // Get Firebase app and auth
      const { app, auth } = getFirebase();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('You must be logged in to generate PDFs');
      }

      const options: PDFGenerationOptions = {
        bomId,
        companyName,
        customerName,
        customerAddress: customerAddress || undefined,
        customerAttention: customerAttention || undefined,
        preparedBy: preparedBy || undefined,
        showCostBreakdown,
        showIndirectCosts,
        showItemDetails,
        showMaterialCodes,
        showServices,
      };

      // Call Firebase Function directly
      const functions = getFunctions(app, 'asia-south1');
      const generatePDF = httpsCallable<
        { bomId: string; options: PDFGenerationOptions; userId: string },
        PDFGenerationResult
      >(functions, 'generateBOMQuotePDF');

      const result = await generatePDF({
        bomId,
        options,
        userId: user.uid,
      });

      if (!result.data.success || !result.data.pdfUrl) {
        throw new Error(result.data.error || 'PDF generation failed');
      }

      setPdfUrl(result.data.pdfUrl);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PdfIcon />
          Generate Quote PDF - {bomName}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {pdfUrl && (
          <Alert severity="success" sx={{ mb: 2 }}>
            PDF generated successfully! Click the download button below.
          </Alert>
        )}

        {!pdfUrl && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Company Name *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="Customer Name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
              required
              helperText="Name of the company or person receiving the quote"
            />

            <TextField
              label="Customer Address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="Attention (Contact Person)"
              value={customerAttention}
              onChange={(e) => setCustomerAttention(e.target.value)}
              fullWidth
              helperText="Name of the specific person at the customer's company"
            />

            <TextField
              label="Prepared By"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              fullWidth
              helperText="Your name or designation"
            />

            <Box sx={{ mt: 2 }}>
              <Box sx={{ fontWeight: 'bold', mb: 1 }}>Display Options:</Box>
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showCostBreakdown}
                        onChange={(e) => setShowCostBreakdown(e.target.checked)}
                      />
                    }
                    label="Show detailed cost breakdown"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showIndirectCosts}
                        onChange={(e) => setShowIndirectCosts(e.target.checked)}
                      />
                    }
                    label="Show indirect costs (overhead, profit)"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showItemDetails}
                        onChange={(e) => setShowItemDetails(e.target.checked)}
                      />
                    }
                    label="Show item descriptions"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showMaterialCodes}
                        onChange={(e) => setShowMaterialCodes(e.target.checked)}
                      />
                    }
                    label="Show material codes"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showServices}
                        onChange={(e) => setShowServices(e.target.checked)}
                      />
                    }
                    label="Show service costs"
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          Close
        </Button>
        {pdfUrl ? (
          <Button
            onClick={handleDownload}
            variant="contained"
            startIcon={<DownloadIcon />}
            color="success"
          >
            Download PDF
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <PdfIcon />}
          >
            {generating ? 'Generating...' : 'Generate PDF'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
