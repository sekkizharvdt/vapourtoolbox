'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { GORResult } from '@/lib/thermal/gorCalculator';
import { GORReportPDF, type GORReportInputs } from './GORReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: GORResult;
  inputs: GORReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate GOR / Performance Report"
      defaultDocNumber="GOR-001"
      buildDocument={(meta) => <GORReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GOR:</span>
              <strong>{result.gor.toFixed(2)}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>STE:</span>
              <strong>
                {result.specificThermalEnergy.toFixed(1)} kJ/kg (
                {result.specificThermalEnergy_kWh.toFixed(1)} kWh/m&sup3;)
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Thermal Efficiency:</span>
              <strong>{(result.thermalEfficiency * 100).toFixed(1)}%</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Recovery:</span>
              <strong>{(result.totalRecovery * 100).toFixed(1)}%</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
