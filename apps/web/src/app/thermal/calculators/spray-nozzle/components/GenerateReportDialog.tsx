'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { SprayNozzleResult } from '@/lib/thermal/sprayNozzleCalculator';
import { SprayNozzleReportPDF, type SprayNozzleReportInputs } from './SprayNozzleReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: SprayNozzleResult;
  inputs: SprayNozzleReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  const best = result.matches[0];

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Spray Nozzle Report"
      defaultDocNumber="NOZZLE-001"
      buildDocument={(meta) => <SprayNozzleReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        best ? (
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Best Match:</span>
                <strong>{best.nozzle.capacitySize}</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Flow at Pressure:</span>
                <strong>{best.flowAtPressure} lpm</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Deviation:</span>
                <strong>
                  {best.deviationPercent > 0 ? '+' : ''}
                  {best.deviationPercent}%
                </strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Matches Found:</span>
                <strong>{result.matches.length}</strong>
              </Box>
            </Stack>
          </Box>
        ) : undefined
      }
    />
  );
}
