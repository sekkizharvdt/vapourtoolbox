'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { HeatExchangerResult } from '@/lib/thermal/heatExchangerSizing';
import { HeatExchangerReportPDF, type VelocityCheckData } from './HeatExchangerReportPDF';
import type { IterativeHXResult } from '@/lib/thermal/iterativeHXDesign.types';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: HeatExchangerResult;
  heatDutyKW: number;
  lmtd: number;
  overallHTC: number;
  velocityCheck?: VelocityCheckData | null;
  /** Full iterative result for enhanced report sections */
  iterativeResult?: IterativeHXResult | null;
}

export function GenerateReportDialog({
  open,
  onClose,
  result,
  heatDutyKW,
  lmtd,
  overallHTC,
  velocityCheck,
  iterativeResult,
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
      title="Generate Heat Exchanger Sizing Report"
      defaultDocNumber="HX-001"
      buildDocument={(meta) => (
        <HeatExchangerReportPDF
          result={result}
          inputs={{ heatDutyKW, lmtd, overallHTC }}
          velocityCheck={velocityCheck}
          iterativeResult={iterativeResult}
          {...meta}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Row label="Design Area" value={`${result.designArea.toFixed(1)} m\u00B2`} />
            <Row
              label="Tubes"
              value={`${result.actualTubeCount} \u00D7 ${result.tubeSpec.od_mm} mm OD \u00D7 ${result.tubeLength} m`}
            />
            <Row label="Shell ID" value={`${result.shellID} mm`} />
            <Row label="Excess Area" value={`${result.excessArea.toFixed(1)}%`} />
            {velocityCheck && (
              <Row label="Tube Velocity" value={`${velocityCheck.velocity.toFixed(2)} m/s`} />
            )}
          </Stack>
        </Box>
      }
    />
  );
}
