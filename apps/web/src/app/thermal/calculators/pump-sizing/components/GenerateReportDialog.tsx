'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { PumpSizingResult } from '@/lib/thermal/pumpSizing';
import { PumpSizingReportPDF, type PumpSizingReportInputs } from './PumpSizingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: PumpSizingResult;
  inputs: PumpSizingReportInputs;
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
      title="Generate Pump Sizing Report"
      defaultDocNumber="PUMP-001"
      buildDocument={(meta) => <PumpSizingReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row
              label="TDH"
              value={`${result.totalDifferentialHead.toFixed(1)} m (${result.differentialPressure.toFixed(3)} bar)`}
            />
            <Row label="Brake Power" value={`${result.brakePower.toFixed(2)} kW`} />
            <Row label="Motor" value={`${result.recommendedMotorKW} kW (IEC 60034-1)`} />
          </Stack>
        </Box>
      }
    />
  );
}
