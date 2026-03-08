'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { NozzleLayoutResult } from '@/lib/thermal/sprayNozzleCalculator';
import { NozzleLayoutReportPDF, type NozzleLayoutReportInputs } from './NozzleLayoutReportPDF';

interface GenerateLayoutReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: NozzleLayoutResult;
  inputs: NozzleLayoutReportInputs;
  selectedIdx: number;
}

export function GenerateLayoutReportDialog({
  open,
  onClose,
  result,
  inputs,
  selectedIdx,
}: GenerateLayoutReportDialogProps) {
  const best = result.matches[selectedIdx] ?? result.matches[0];

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Nozzle Layout Report"
      defaultDocNumber="NOZZLE-LAYOUT-001"
      buildDocument={(meta) => (
        <NozzleLayoutReportPDF
          result={result}
          inputs={inputs}
          selectedIdx={selectedIdx}
          {...meta}
        />
      )}
      summary={
        best ? (
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Model:</span>
                <strong>{best.modelNumber}</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Layout:</span>
                <strong>
                  {best.nozzlesAlongLength} &times; {best.rowsAcrossWidth} = {best.totalNozzles}
                </strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Derived Height:</span>
                <strong>{best.derivedHeight} mm</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Overlap:</span>
                <strong>{best.actualOverlapLength}%</strong>
              </Box>
            </Stack>
          </Box>
        ) : undefined
      }
    />
  );
}
