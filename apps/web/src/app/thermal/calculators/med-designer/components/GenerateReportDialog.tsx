'use client';

import { Box, Typography } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import { MEDDesignerReportPDF } from './MEDDesignerReportPDF';
import type { MEDDesignerResult, MEDDesignOption } from '@/lib/thermal';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  result: MEDDesignerResult;
  options: MEDDesignOption[];
}

export function GenerateReportDialog({
  open,
  onClose,
  result,
  options,
}: GenerateReportDialogProps) {
  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate MED Design Report"
      defaultDocNumber="MED-001"
      buildDocument={({ documentNumber, revision, projectName, notes, logoDataUri }) => (
        <MEDDesignerReportPDF
          result={result}
          options={options}
          documentNumber={documentNumber}
          revision={revision}
          projectName={projectName}
          notes={notes}
          logoDataUri={logoDataUri ?? null}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
          <Typography variant="body2">
            <strong>GOR {result.achievedGOR.toFixed(1)}</strong> &bull;{' '}
            {result.totalDistillateM3Day.toFixed(0)} m³/day &bull; {result.effects.length} effects
            &bull; {result.totalEvaporatorArea.toFixed(0)} m² evaporator area
          </Typography>
        </Box>
      }
    />
  );
}
