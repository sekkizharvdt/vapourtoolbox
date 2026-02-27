'use client';

/**
 * Generate Report Dialog — Heat Transfer Calculator
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { pdf } from '@react-pdf/renderer';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';
import { HeatTransferReportPDF, type HeatTransferReportInputs } from './HeatTransferReportPDF';

let cachedLogoDataUri: string | null = null;

async function fetchLogoAsDataUri(): Promise<string | undefined> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUri = reader.result as string;
        resolve(cachedLogoDataUri);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  inputs: HeatTransferReportInputs;
  tubeSideResult: TubeSideHTCResult;
  condensationResult: CondensationHTCResult;
  overallResult: OverallHTCResult;
}

export function GenerateReportDialog({
  open,
  onClose,
  inputs,
  tubeSideResult,
  condensationResult,
  overallResult,
}: GenerateReportDialogProps) {
  const [documentNumber, setDocumentNumber] = useState('HTC-001');
  const [revision, setRevision] = useState('0');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>();

  useEffect(() => {
    if (open) fetchLogoAsDataUri().then(setLogoDataUri);
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const doc = (
        <HeatTransferReportPDF
          inputs={inputs}
          tubeSideResult={tubeSideResult}
          condensationResult={condensationResult}
          overallResult={overallResult}
          logoDataUri={logoDataUri ?? null}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName || undefined}
          notes={notes || undefined}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_Rev${revision}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (!generating) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Heat Transfer Report</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <TextField
            label="Document Number"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="HTC-001"
            fullWidth
            required
          />
          <TextField
            label="Revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="0"
            fullWidth
          />
          <TextField
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project Alpha — Condenser E-101"
            fullWidth
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Design basis, assumptions, or special requirements..."
            multiline
            rows={3}
            fullWidth
          />
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>h_i (Tube Side):</span>
                <strong>{tubeSideResult.htc.toFixed(1)} W/(m²·K)</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>h_o (Shell Side):</span>
                <strong>{condensationResult.htc.toFixed(1)} W/(m²·K)</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>U_o (Overall):</span>
                <strong>{overallResult.overallHTC.toFixed(1)} W/(m²·K)</strong>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={generating || !documentNumber}
          startIcon={generating ? <CircularProgress size={20} /> : <DownloadIcon />}
        >
          {generating ? 'Generating...' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
