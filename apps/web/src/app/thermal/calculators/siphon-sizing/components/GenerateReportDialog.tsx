'use client';

/**
 * Generate Report Dialog
 *
 * Dialog for configuring and downloading siphon sizing PDF report.
 * Follows the GenerateDatasheetDialog pattern from flash-chamber.
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';
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

/** Capture an SVG element as a PNG data URI via canvas */
function captureSvgAsImage(svgEl: SVGSVGElement): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const svgClone = svgEl.cloneNode(true) as SVGSVGElement;

      // Inline computed styles so the rasterised image looks correct
      const original = svgEl.querySelectorAll('*');
      const cloned = svgClone.querySelectorAll('*');
      original.forEach((el, i) => {
        const computed = window.getComputedStyle(el);
        const target = cloned[i] as SVGElement;
        target.setAttribute('fill', computed.fill);
        target.setAttribute('stroke', computed.stroke);
        target.setAttribute('opacity', computed.opacity);
      });

      // Ensure explicit dimensions on the clone
      const bbox = svgEl.getBoundingClientRect();
      svgClone.setAttribute('width', String(bbox.width));
      svgClone.setAttribute('height', String(bbox.height));

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      const scale = 2; // retina sharpness
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(undefined);
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.src = url;
    } catch {
      resolve(undefined);
    }
  });
}

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
  diagramSvgRef?: RefObject<SVGSVGElement | null>;
}

export function GenerateReportDialog({
  open,
  onClose,
  result,
  inputs,
  diagramSvgRef,
}: GenerateReportDialogProps) {
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

  const captureDiagram = useCallback(async (): Promise<string | undefined> => {
    if (!diagramSvgRef?.current) return undefined;
    return captureSvgAsImage(diagramSvgRef.current);
  }, [diagramSvgRef]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const diagramImageUri = await captureDiagram();

      const doc = (
        <SiphonReportPDF
          result={result}
          inputs={inputs}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName || undefined}
          notes={notes || undefined}
          logoDataUri={logoDataUri}
          diagramImageUri={diagramImageUri}
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
