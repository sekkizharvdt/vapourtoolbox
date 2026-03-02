'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { NCGResult } from '@/lib/thermal/ncgCalculator';
import { NCGReportPDF, type NCGReportInputs } from './NCGReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: NCGResult;
  inputs: NCGReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate NCG Properties Report"
      defaultDocNumber="NCG-001"
      buildDocument={(meta) => <NCGReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Temperature:</span>
              <strong>{result.temperatureC.toFixed(1)} °C</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Pressure:</span>
              <strong>{result.totalPressureBar.toFixed(4)} bar abs</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Density:</span>
              <strong>{result.density.toFixed(4)} kg/m³</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>NCG Mole Fraction:</span>
              <strong>{(result.ncgMoleFrac * 100).toFixed(2)}%</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Specific Enthalpy:</span>
              <strong>{result.specificEnthalpy.toFixed(2)} kJ/kg</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
