'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { FallingFilmResult } from '@/lib/thermal/fallingFilmCalculator';
import { TUBE_MATERIALS } from '@/lib/thermal/fallingFilmCalculator';
import { FallingFilmReportPDF, type FallingFilmReportInputs } from './FallingFilmReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: FallingFilmResult;
  inputs: FallingFilmReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const materialLabel = TUBE_MATERIALS[inputs.tubeMaterial]?.label ?? inputs.tubeMaterial;

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Falling Film Evaporator Report"
      defaultDocNumber="FFE-001"
      buildDocument={(meta) => <FallingFilmReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Overall HTC:</span>
              <strong>{result.overallHTC.toFixed(1)} W/(m&sup2;&middot;K)</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Wetting Ratio:</span>
              <strong>
                {result.wettingRatio.toFixed(2)} ({result.wettingStatus})
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Heat Duty:</span>
              <strong>{result.heatDuty.toFixed(1)} kW</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Evaporation Rate:</span>
              <strong>{result.evaporationRate.toFixed(4)} kg/s</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tube Material:</span>
              <strong>{materialLabel}</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
