'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '@/app/thermal/calculators/components/PDFReportDialog';
import type { FlashChamberResult } from '@vapour/types';
import { FlashChamberDatasheet } from './FlashChamberDatasheet';

interface GenerateDatasheetDialogProps {
  open: boolean;
  onClose: () => void;
  result: FlashChamberResult;
}

export function GenerateDatasheetDialog({ open, onClose, result }: GenerateDatasheetDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Datasheet"
      defaultDocNumber="FC-DS-001"
      buildDocument={(meta) => <FlashChamberDatasheet result={result} {...meta} />}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Chamber Diameter:</span>
              <strong>{result.chamberSizing.diameter} mm</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Operating Pressure:</span>
              <strong>{result.inputs.operatingPressure} mbar abs</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Vapor Production:</span>
              <strong>{result.heatMassBalance.vapor.flowRate.toFixed(2)} ton/hr</strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
