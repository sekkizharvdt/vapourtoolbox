'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import { SiphonReportPDF, type SiphonReportInputs } from './SiphonReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Siphon Sizing Report"
      defaultDocNumber="SIPHON-001"
      buildDocument={(meta) => <SiphonReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
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
      }
    />
  );
}
