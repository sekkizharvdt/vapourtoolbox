'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';
import { SuctionReportPDF } from './SuctionReportPDF';
import type { SuctionReportInputs } from './SuctionResults';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: SuctionSystemResult;
  inputs: SuctionReportInputs;
}

export function GenerateReportDialog({ open, onClose, result, inputs }: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate Suction System Report"
      defaultDocNumber="SUCTION-001"
      buildDocument={({ documentNumber, revision, projectName, notes }) => (
        <SuctionReportPDF
          result={result}
          inputs={inputs}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName}
          notes={notes}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Nozzle Pipe:</span>
              <strong>
                {result.nozzlePipe.nps}&quot; Sch 40 (DN{result.nozzlePipe.dn})
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Suction Pipe:</span>
              <strong>
                {result.suctionPipe.nps}&quot; Sch 40 (DN{result.suctionPipe.dn})
              </strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Required Elevation:</span>
              <strong>{result.requiredElevation.toFixed(2)} m</strong>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>NPSHa (Dirty):</span>
              <strong>
                {result.npshaDirty.npsha.toFixed(2)} m (margin{' '}
                {result.npshaDirty.margin >= 0 ? '+' : ''}
                {result.npshaDirty.margin.toFixed(2)} m)
              </strong>
            </Box>
          </Stack>
        </Box>
      }
    />
  );
}
