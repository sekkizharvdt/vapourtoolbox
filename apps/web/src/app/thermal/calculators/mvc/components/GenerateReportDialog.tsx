'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { MVCResult } from '@/lib/thermal/mvcCalculator';
import { MVCReportPDF, type MVCReportInputs } from './MVCReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: MVCResult;
  inputs: MVCReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}:</span>
      <strong>{value}</strong>
    </Box>
  );

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate MVC Report"
      defaultDocNumber="MVC-001"
      buildDocument={(meta) => <MVCReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row label="Shaft Power" value={`${result.shaftPower.toFixed(1)} kW`} />
            <Row label="Specific Energy" value={`${result.specificEnergy.toFixed(1)} kWh/ton`} />
            <Row label="Compression Ratio" value={result.compressionRatio.toFixed(2)} />
          </Stack>
        </Box>
      }
    />
  );
}
