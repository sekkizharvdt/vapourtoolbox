'use client';

/**
 * Shared PDF Report Dialog
 *
 * Handles all common report-generation UI: document number, revision, project
 * name, notes, logo pre-fetch, and PDF download.  Each calculator provides
 * only the title, default document number, a `buildDocument` factory, and an
 * optional summary box.
 *
 * @react-pdf/renderer is imported DYNAMICALLY on button-click so it is never
 * included in any page's static bundle — only in the lazy chunk of the calling
 * dialog wrapper.
 */

import { useState, useEffect, type ReactElement, type ReactNode } from 'react';
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
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';

export interface PDFReportMeta {
  documentNumber: string;
  revision: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

interface PDFReportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title, e.g. "Generate Siphon Sizing Report" */
  title: string;
  /** Pre-filled document number, e.g. "SIPHON-001" */
  defaultDocNumber: string;
  /**
   * Factory called with document metadata when the user clicks Download.
   * Return a React element whose root is a @react-pdf/renderer <Document>.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildDocument: (meta: PDFReportMeta) => ReactElement<any>;
  /** Optional calculator-specific key metrics shown inside the dialog */
  summary?: ReactNode;
}

export function PDFReportDialog({
  open,
  onClose,
  title,
  defaultDocNumber,
  buildDocument,
  summary,
}: PDFReportDialogProps) {
  const [documentNumber, setDocumentNumber] = useState(defaultDocNumber);
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
      const meta: PDFReportMeta = {
        documentNumber,
        revision,
        projectName: projectName || undefined,
        notes: notes || undefined,
        logoDataUri,
      };

      const doc = buildDocument(meta);

      // Dynamic import keeps @react-pdf/renderer out of this module's static chunk
      const { pdf } = await import('@react-pdf/renderer');
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
      console.error('PDF generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
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
      <DialogTitle>{title}</DialogTitle>
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

          {summary}
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
