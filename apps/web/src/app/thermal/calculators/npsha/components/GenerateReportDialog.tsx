'use client';

import { useState } from 'react';
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
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';
import { SuctionReportPDF } from './SuctionReportPDF';
import type { SuctionReportInputs } from './SuctionResults';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: SuctionSystemResult;
  inputs: SuctionReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const [documentNumber, setDocumentNumber] = useState('SUCTION-001');
  const [revision, setRevision] = useState('0');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const doc = (
        <SuctionReportPDF
          result={result}
          inputs={inputs}
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
      <DialogTitle>Generate Suction System Report</DialogTitle>
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
            placeholder="SUCTION-001"
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
            placeholder="Project Alpha — Brine Pump P-401"
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
                <span>Nozzle Pipe:</span>
                <strong>
                  {result.nozzlePipe.nps}&quot; Sch 40 (DN{result.nozzlePipe.dn})
                </strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Suction Pipe:</span>
                <strong>
                  {result.suctionPipe.nps}&quot; Sch 40 (DN{result.suctionPipe.dn})
                </strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Required Elevation:</span>
                <strong>{result.requiredElevation.toFixed(2)} m</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>NPSHa (Dirty):</span>
                <strong>
                  {result.npshaDirty.npsha.toFixed(2)} m (margin{' '}
                  {result.npshaDirty.margin >= 0 ? '+' : ''}
                  {result.npshaDirty.margin.toFixed(2)} m)
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
