'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import {
  DesuperheatingReportPDF,
  type DesuperheatingReportInputs,
} from './DesuperheatingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: DesuperheatingResult;
  inputs: DesuperheatingReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Desuperheating Report"
      defaultDocNumber="DSH-001"
      buildDocument={(meta) => (
        <DesuperheatingReportPDF result={result} inputs={inputs} {...meta} />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Spray Water Flow:</span>
              <strong>{result.sprayWaterFlow.toFixed(3)} t/hr</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Water / Steam Ratio:</span>
              <strong>{(result.waterToSteamRatio * 100).toFixed(1)}%</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Heat Removed:</span>
              <strong>{(result.heatRemoved / 1000).toFixed(3)} MW</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
