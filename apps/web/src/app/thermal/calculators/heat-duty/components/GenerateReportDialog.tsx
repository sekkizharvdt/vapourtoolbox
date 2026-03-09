'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type {
  SensibleHeatResult,
  LatentHeatResult,
  LMTDResult,
} from '@/lib/thermal/heatDutyCalculator';
import { HeatDutyReportPDF, type HeatDutyReportInputs } from './HeatDutyReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  inputs: HeatDutyReportInputs;
  sensibleResult?: SensibleHeatResult | null;
  latentResult?: LatentHeatResult | null;
  lmtdResult?: LMTDResult | null;
  requiredArea?: number | null;
}

export function GenerateReportDialog({
  open,
  onClose,
  inputs,
  sensibleResult,
  latentResult,
  lmtdResult,
  requiredArea,
}: GenerateReportDialogProps) {
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
      title="Generate Heat Duty Report"
      defaultDocNumber="HD-001"
      buildDocument={(meta) => (
        <HeatDutyReportPDF
          inputs={inputs}
          sensibleResult={sensibleResult}
          latentResult={latentResult}
          lmtdResult={lmtdResult}
          requiredArea={requiredArea}
          {...meta}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            {sensibleResult && (
              <Row label="Sensible Heat Duty" value={`${sensibleResult.heatDuty.toFixed(1)} kW`} />
            )}
            {latentResult && (
              <Row label="Latent Heat Duty" value={`${latentResult.heatDuty.toFixed(1)} kW`} />
            )}
            {lmtdResult && (
              <Row
                label="Corrected LMTD"
                value={`${lmtdResult.correctedLMTD.toFixed(1)} \u00B0C`}
              />
            )}
            {requiredArea != null && (
              <Row label="Required Area" value={`${requiredArea.toFixed(1)} m\u00B2`} />
            )}
            {!sensibleResult && !latentResult && !lmtdResult && (
              <span>No calculations to include in report</span>
            )}
          </Stack>
        </Box>
      }
    />
  );
}
