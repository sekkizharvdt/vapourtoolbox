'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { FoulingScalingResult } from '@/lib/thermal/foulingScalingCalculator';
import {
  FoulingScalingReportPDF,
  type FoulingScalingReportInputs,
} from './FoulingScalingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: FoulingScalingResult;
  inputs: FoulingScalingReportInputs;
}

const SCALANT_LABELS: Record<string, string> = {
  CaSO4: 'CaSO\u2084',
  CaCO3: 'CaCO\u2083',
  MgOH2: 'Mg(OH)\u2082',
  none: 'None',
};

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Fouling & Scaling Report"
      defaultDocNumber="FSP-001"
      buildDocument={(meta) => (
        <FoulingScalingReportPDF result={result} inputs={inputs} {...meta} />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Max TBT (no antiscalant):</span>
              <strong>{result.maxTBT_noAntiscalant.toFixed(1)} &deg;C</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Max TBT (with antiscalant):</span>
              <strong>{result.maxTBT_withAntiscalant.toFixed(1)} &deg;C</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dominant Scalant:</span>
              <strong>{SCALANT_LABELS[result.dominantScalant] ?? result.dominantScalant}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Brine TDS:</span>
              <strong>{result.brineConcentration.toLocaleString()} ppm</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
