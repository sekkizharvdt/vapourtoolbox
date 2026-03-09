'use client';

import { Box, Stack } from '@mui/material';
import { PDFReportDialog } from '../../components/PDFReportDialog';
import type { DosingResult, CIPResult } from '@/lib/thermal/chemicalDosingCalculator';
import {
  ChemicalDosingReportPDF,
  type DosingReportInputs,
  type CIPReportInputs,
} from './ChemicalDosingReportPDF';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  antiscalantResult?: DosingResult | null;
  antifoamResult?: DosingResult | null;
  cipResult?: CIPResult | null;
  antiscalantInputs?: DosingReportInputs;
  antifoamInputs?: DosingReportInputs;
  cipInputs?: CIPReportInputs;
}

export function GenerateReportDialog({
  open,
  onClose,
  antiscalantResult,
  antifoamResult,
  cipResult,
  antiscalantInputs,
  antifoamInputs,
  cipInputs,
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
      title="Generate Chemical Dosing & CIP Report"
      defaultDocNumber="CHD-001"
      buildDocument={(meta) => (
        <ChemicalDosingReportPDF
          antiscalantResult={antiscalantResult}
          antifoamResult={antifoamResult}
          cipResult={cipResult}
          antiscalantInputs={antiscalantInputs}
          antifoamInputs={antifoamInputs}
          cipInputs={cipInputs}
          {...meta}
        />
      )}
      summary={
        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
          <Stack spacing={0.5}>
            {antiscalantResult && (
              <Row
                label="Antiscalant"
                value={`${antiscalantResult.chemicalFlowMlMin.toFixed(1)} mL/min · ${antiscalantResult.annualConsumptionKg.toFixed(0)} kg/yr`}
              />
            )}
            {antifoamResult && (
              <Row
                label="Anti-foam"
                value={`${antifoamResult.chemicalFlowMlMin.toFixed(1)} mL/min · ${antifoamResult.annualConsumptionKg.toFixed(0)} kg/yr`}
              />
            )}
            {cipResult && (
              <Row
                label="Acid CIP"
                value={`${cipResult.neatAcidLitres.toFixed(1)} L/clean · ${cipResult.annualNeatAcidKg.toFixed(0)} kg/yr`}
              />
            )}
            {!antiscalantResult && !antifoamResult && !cipResult && (
              <span>No calculations to include in report</span>
            )}
          </Stack>
        </Box>
      }
    />
  );
}
