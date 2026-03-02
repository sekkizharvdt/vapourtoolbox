'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { TVCResult } from '@/lib/thermal/tvcCalculator';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import { TVCReportPDF, type TVCReportInputs } from './TVCReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: TVCResult;
  desuperheatingResult: DesuperheatingResult | null;
  inputs: TVCReportInputs;
}

export function GenerateReportDialog({
  open,
  onClose,
  result,
  desuperheatingResult,
  inputs,
}: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate TVC Report"
      defaultDocNumber="TVC-001"
      buildDocument={(meta) => (
        <TVCReportPDF
          result={result}
          desuperheatingResult={desuperheatingResult}
          inputs={inputs}
          {...meta}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Entrainment Ratio (Ra):</span>
              <strong>{result.entrainmentRatio.toFixed(4)}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Compression Ratio (CR):</span>
              <strong>{result.compressionRatio.toFixed(3)}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discharge Superheat:</span>
              <strong>{result.dischargeSuperheat.toFixed(1)} °C</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
