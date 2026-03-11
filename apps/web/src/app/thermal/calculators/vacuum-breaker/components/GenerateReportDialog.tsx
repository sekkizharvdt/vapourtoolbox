'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { VacuumBreakerResult } from '@/lib/thermal/vacuumBreakerCalculator';
import { VacuumBreakerReportPDF } from './VacuumBreakerReportPDF';
import type { VacuumBreakerReportInputs } from './VacuumBreakerResults';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: VacuumBreakerResult;
  inputs: VacuumBreakerReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Vacuum Breaker Sizing Report"
      defaultDocNumber="VB-001"
      buildDocument={(meta) => <VacuumBreakerReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Selected Valve:</span>
              <strong>
                DN {result.selectedValve.dn} ({result.selectedValve.nps})
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Required Area:</span>
              <strong>{result.requiredOrificeArea} cm&sup2;</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Number of Breakers:</span>
              <strong>{result.numberOfBreakers}</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
