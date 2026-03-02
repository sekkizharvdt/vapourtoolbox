'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';
import { HeatTransferReportPDF, type HeatTransferReportInputs } from './HeatTransferReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  inputs: HeatTransferReportInputs;
  tubeSideResult: TubeSideHTCResult;
  condensationResult: CondensationHTCResult;
  overallResult: OverallHTCResult;
}

export function GenerateReportDialog({
  open,
  onClose,
  inputs,
  tubeSideResult,
  condensationResult,
  overallResult,
}: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Heat Transfer Report"
      defaultDocNumber="HTC-001"
      buildDocument={({ documentNumber, revision, projectName, notes, logoDataUri }) => (
        <HeatTransferReportPDF
          inputs={inputs}
          tubeSideResult={tubeSideResult}
          condensationResult={condensationResult}
          overallResult={overallResult}
          logoDataUri={logoDataUri ?? null}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName}
          notes={notes}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>h_i (Tube Side):</span>
              <strong>{tubeSideResult.htc.toFixed(1)} W/(m²·K)</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>h_o (Shell Side):</span>
              <strong>{condensationResult.htc.toFixed(1)} W/(m²·K)</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>U_o (Overall):</span>
              <strong>{overallResult.overallHTC.toFixed(1)} W/(m²·K)</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
