'use client';

/**
 * Generate Report Dialog
 *
 * Dialog for configuring and downloading siphon sizing PDF report.
 * Follows the GenerateDatasheetDialog pattern from flash-chamber.
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
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import { SiphonReportPDF, type SiphonReportInputs } from './SiphonReportPDF';

/** Cache the logo data URI to avoid repeated fetches */
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
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const [documentNumber, setDocumentNumber] = useState('SIPHON-001');
  const [revision, setRevision] = useState('0');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>();

  // Pre-fetch logo when dialog opens
  useEffect(() => {
    if (open) {
      fetchLogoAsDataUri().then(setLogoDataUri);
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const doc = (
        <SiphonReportPDF
          result={result}
          inputs={inputs}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName || undefined}
          notes={notes || undefined}
          logoDataUri={logoDataUri}
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
      <DialogTitle>Generate Siphon Sizing Report</DialogTitle>
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
            placeholder="SIPHON-001"
            fullWidth
            required
            helperText="Unique identifier for this report"
          />

          <TextField
            label="Revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="0"
            fullWidth
            helperText="Revision number (0, A, 1, etc.)"
          />

          <TextField
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project Alpha — Siphon S-101/102"
            fullWidth
            helperText="Optional project or equipment identifier"
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Design basis, assumptions, or special requirements..."
            multiline
            rows={3}
            fullWidth
            helperText="Optional notes to include in the report"
          />

          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pipe Size:</span>
                <strong>
                  {result.pipe.nps}&quot; Sch {result.pipe.schedule} (DN{result.pipe.dn})
                </strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Minimum Siphon Height:</span>
                <strong>{result.minimumHeight.toFixed(3)} m</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Velocity:</span>
                <strong>
                  {result.velocity.toFixed(2)} m/s ({result.velocityStatus})
                </strong>
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
