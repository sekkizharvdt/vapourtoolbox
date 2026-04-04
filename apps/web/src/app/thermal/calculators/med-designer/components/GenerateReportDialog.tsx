'use client';

import { useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material';
import {
  Description as BriefIcon,
  Engineering as DetailedIcon,
  FactCheck as VerificationIcon,
} from '@mui/icons-material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import { MEDDesignerReportPDF } from './MEDDesignerReportPDF';
import { MEDBriefReportPDF } from './MEDBriefReportPDF';
import { MEDVerificationReportPDF } from './MEDVerificationReportPDF';
import type { MEDDesignerResult, MEDDesignOption } from '@/lib/thermal';

type ReportType = 'brief' | 'detailed' | 'verification';

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
  const [reportType, setReportType] = useState<ReportType>('brief');

  return (
    <PDFReportDialog
      open={open}
      onClose={onClose}
      title="Generate MED Design Report"
      defaultDocNumber="MED-001"
      buildDocument={({ documentNumber, revision, projectName, notes, logoDataUri }) =>
        reportType === 'brief' ? (
          <MEDBriefReportPDF
            result={result}
            options={options}
            documentNumber={documentNumber}
            revision={revision}
            projectName={projectName}
            notes={notes}
            logoDataUri={logoDataUri ?? null}
          />
        ) : reportType === 'verification' ? (
          <MEDVerificationReportPDF
            result={result}
            options={options}
            documentNumber={documentNumber}
            revision={revision}
            projectName={projectName}
            notes={notes}
            logoDataUri={logoDataUri ?? null}
          />
        ) : (
          <MEDDesignerReportPDF
            result={result}
            options={options}
            documentNumber={documentNumber}
            revision={revision}
            projectName={projectName}
            notes={notes}
            logoDataUri={logoDataUri ?? null}
          />
        )
      }
      summary={
        <Stack spacing={2}>
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Typography variant="body2">
              <strong>GOR {result.achievedGOR.toFixed(1)}</strong> &bull;{' '}
              {result.totalDistillateM3Day.toFixed(0)} m³/day &bull; {result.effects.length} effects
              &bull; {result.totalEvaporatorArea.toFixed(0)} m² evaporator area
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Report Type
            </Typography>
            <ToggleButtonGroup
              value={reportType}
              exclusive
              onChange={(_, v) => v && setReportType(v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="brief">
                <BriefIcon sx={{ mr: 1, fontSize: 18 }} />
                Brief (Proposal)
              </ToggleButton>
              <ToggleButton value="detailed">
                <DetailedIcon sx={{ mr: 1, fontSize: 18 }} />
                Detailed (Engineering)
              </ToggleButton>
              <ToggleButton value="verification">
                <VerificationIcon sx={{ mr: 1, fontSize: 18 }} />
                Verification
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {reportType === 'brief'
                ? 'Shows key performance and dimensions only — does not reveal tube counts, HTCs, or detailed engineering data.'
                : reportType === 'verification'
                  ? 'Complete process calculation report for third-party verification — property data, temperature cascade, H&M balance, HTC breakdown, correlations, and references.'
                  : 'Full engineering report with effect-by-effect design, U-values, weight breakdown, and equipment list.'}
            </Typography>
          </Box>
        </Stack>
      }
    />
  );
}
