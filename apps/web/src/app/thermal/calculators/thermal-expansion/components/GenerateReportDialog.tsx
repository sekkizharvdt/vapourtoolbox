'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { ThermalExpansionResult } from '@/lib/thermal';
import {
  ThermalExpansionReportPDF,
  type ThermalExpansionReportInputs,
} from './ThermalExpansionReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: ThermalExpansionResult;
  inputs: ThermalExpansionReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const isRestrained = inputs.constraintMode === 'restrained';
  const deltaL_display =
    Math.abs(result.deltaL) >= 1000
      ? `${(result.deltaL / 1000).toFixed(3)} m`
      : `${result.deltaL.toFixed(3)} mm`;

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Thermal Expansion Report"
      defaultDocNumber="THEXP-001"
      buildDocument={(meta) => (
        <ThermalExpansionReportPDF result={result} inputs={inputs} {...meta} />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Material:</span>
              <strong>{result.materialLabel}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Free ΔL:</span>
              <strong>{deltaL_display}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{isRestrained ? 'Restrained σ' : 'Stress if Restrained'}:</span>
              <strong>{Math.abs(result.thermalStress).toFixed(0)} MPa</strong>
            </Box>
            {result.yieldUtilisation !== null && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Yield utilisation:</span>
                <strong>{(result.yieldUtilisation * 100).toFixed(0)} %</strong>
              </Box>
            )}
          </Stack>
        </Box>
      }
    />
  );
}
