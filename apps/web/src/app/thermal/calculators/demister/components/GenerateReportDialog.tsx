'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { DemisterResult } from '@/lib/thermal/demisterCalculator';
import { DemisterReportPDF, type DemisterReportInputs } from './DemisterReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: DemisterResult;
  inputs: DemisterReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Demister Sizing Report"
      defaultDocNumber="DEM-001"
      buildDocument={(meta) => <DemisterReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Required Area:</span>
              <strong>{result.requiredArea.toFixed(3)} m²</strong>
            </Box>
            {result.vesselDiameter !== undefined && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Min. Diameter:</span>
                <strong>{result.vesselDiameter.toFixed(3)} m</strong>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pressure Drop:</span>
              <strong>{result.pressureDrop.toFixed(1)} Pa</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Loading:</span>
              <strong>{(result.loadingFraction * 100).toFixed(0)}% of V_max</strong>
            </Box>
            {result.carryover && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Distillate TDS:</span>
                <strong>
                  {result.carryover.distillateTDS.toFixed(2)} ppm (
                  {result.carryover.qualityAssessment})
                </strong>
              </Box>
            )}
          </Stack>
        </Box>
      }
    />
  );
}
