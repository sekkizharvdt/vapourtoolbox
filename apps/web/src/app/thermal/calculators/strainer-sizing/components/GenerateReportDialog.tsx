'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { StrainerSizingResult } from '@/lib/thermal/strainerSizingCalculator';
import {
  StrainerSizingReportPDF,
  type StrainerSizingReportInputs,
} from './StrainerSizingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: StrainerSizingResult;
  inputs: StrainerSizingReportInputs;
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
      title="Generate Strainer Sizing Report"
      defaultDocNumber="STR-001"
      buildDocument={(meta) => (
        <StrainerSizingReportPDF result={result} inputs={inputs} {...meta} />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row label="Mesh Size" value={`${result.meshSizeMm} mm (#${result.meshNumber})`} />
            <Row label="Clean ΔP" value={`${result.totalPressureDropClean.toFixed(4)} bar`} />
            <Row
              label="50% Clogged ΔP"
              value={`${result.totalPressureDropClogged.toFixed(4)} bar`}
            />
          </Stack>
        </Box>
      }
    />
  );
}
