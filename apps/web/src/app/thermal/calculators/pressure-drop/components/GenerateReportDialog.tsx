'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { PressureDropResult } from '@/lib/thermal/pressureDropCalculator';
import { PressureDropReportPDF, type PressureDropReportInputs } from './PressureDropReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: PressureDropResult;
  inputs: PressureDropReportInputs;
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
      title="Generate Pressure Drop Report"
      defaultDocNumber="PD-001"
      buildDocument={(meta) => <PressureDropReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row
              label="Total \u0394P"
              value={`${result.totalPressureDropBar.toFixed(3)} bar (${result.totalPressureDropMH2O.toFixed(2)} m H\u2082O)`}
            />
            <Row
              label="Velocity"
              value={`${result.velocity.toFixed(2)} m/s (Re = ${result.reynoldsNumber.toLocaleString()})`}
            />
            <Row label="Flow Regime" value={result.flowRegime} />
          </Stack>
        </Box>
      }
    />
  );
}
