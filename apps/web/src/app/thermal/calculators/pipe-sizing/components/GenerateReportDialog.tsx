'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import {
  PipeSizingReportPDF,
  type PipeSizingReportInputs,
  type PipeSizingReportResult,
} from './PipeSizingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: PipeSizingReportResult;
  inputs: PipeSizingReportInputs;
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
      title="Generate Pipe Sizing Report"
      defaultDocNumber="PIPE-001"
      buildDocument={(meta) => <PipeSizingReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row label="Pipe" value={`NPS ${result.pipe.nps} (DN ${result.pipe.dn})`} />
            <Row
              label="Velocity"
              value={`${result.velocity.toFixed(2)} m/s (${result.velocityStatus})`}
            />
          </Stack>
        </Box>
      }
    />
  );
}
