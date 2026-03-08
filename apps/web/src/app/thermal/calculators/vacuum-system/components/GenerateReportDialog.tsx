'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { VacuumSystemResult, TrainConfig } from '@/lib/thermal/vacuumSystemCalculator';
import { VacuumSystemReportPDF, type VacuumSystemReportInputs } from './VacuumSystemReportPDF';

const TRAIN_LABELS: Record<TrainConfig, string> = {
  single_ejector: 'Single-Stage Ejector',
  two_stage_ejector: 'Two-Stage Ejector',
  lrvp_only: 'LRVP Only',
  hybrid: 'Hybrid (Ejector + LRVP)',
};

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: VacuumSystemResult;
  inputs: VacuumSystemReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Vacuum System Report"
      defaultDocNumber="VAC-SYS-001"
      buildDocument={(meta) => <VacuumSystemReportPDF result={result} inputs={inputs} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Configuration:</span>
              <strong>{TRAIN_LABELS[result.trainConfig]}</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Dry NCG:</span>
              <strong>{result.totalDryNcgKgH} kg/h</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Design Suction Volume:</span>
              <strong>{result.designSuctionVolumeM3h} m&sup3;/h</strong>
            </Box>
            {result.totalMotiveSteamKgH > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Motive Steam:</span>
                <strong>{result.totalMotiveSteamKgH} kg/h</strong>
              </Box>
            )}
            {result.totalPowerKW > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>LRVP Power:</span>
                <strong>{result.totalPowerKW} kW</strong>
              </Box>
            )}
          </Stack>
        </Box>
      }
    />
  );
}
