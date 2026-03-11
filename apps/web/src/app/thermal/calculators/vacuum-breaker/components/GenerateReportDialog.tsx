'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { VacuumBreakerResult } from '@/lib/thermal/vacuumBreakerCalculator';
import { VacuumBreakerReportPDF } from './VacuumBreakerReportPDF';
import type { VacuumBreakerReportInputs } from './VacuumBreakerResults';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(2)} hr`;
}

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: VacuumBreakerResult;
  inputs: VacuumBreakerReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Vacuum Breaker Sizing Report"
      defaultDocNumber="VB-001"
      buildDocument={(meta) => <VacuumBreakerReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Selected Size:</span>
              <strong>
                DN {result.selectedValve.dn} ({result.selectedValve.nps})
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Equalization Time:</span>
              <strong>{formatTime(result.equalizationTimeSec)}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Peak Rise Rate:</span>
              <strong>{result.peakPressureRiseRate} kPa/s</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Breakers:</span>
              <strong>{result.numberOfBreakers}</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
