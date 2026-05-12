'use client';

import { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Button,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { ThermalExpansionResult, ConstraintMode } from '@/lib/thermal';
import { GenerateReportDialog } from './GenerateReportDialog';
import type { ThermalExpansionReportInputs } from './ThermalExpansionReportPDF';

interface Props {
  result: ThermalExpansionResult;
  constraintMode: ConstraintMode;
  reportInputs: ThermalExpansionReportInputs;
}

function formatDeltaL(mm: number): { value: string; unit: 'mm' | 'm' } {
  const abs = Math.abs(mm);
  if (abs >= 1000) return { value: (mm / 1000).toFixed(3), unit: 'm' };
  return { value: mm.toFixed(3), unit: 'mm' };
}

export function ThermalExpansionResults({ result, constraintMode, reportInputs }: Props) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const isRestrained = constraintMode === 'restrained';
  const dL = formatDeltaL(result.deltaL);
  const direction = result.deltaT >= 0 ? 'heating' : 'cooling';

  const stressColour =
    result.yieldUtilisation === null
      ? 'primary.main'
      : result.yieldUtilisation >= 1
        ? 'error.main'
        : result.yieldUtilisation >= 0.7
          ? 'warning.main'
          : 'success.main';

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => setReportDialogOpen(true)}
        >
          PDF Report
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>
        {result.materialLabel} — {direction} from{' '}
        {(result.deltaT >= 0 ? result.deltaT : -result.deltaT).toFixed(0)} °C ΔT
      </Typography>

      {/* Primary results — two cards side by side */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* ΔL card */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: isRestrained ? 'action.hover' : 'primary.main',
              color: isRestrained ? 'text.primary' : 'primary.contrastText',
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {isRestrained ? 'Free ΔL (if unrestrained)' : 'Free Thermal Expansion ΔL'}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h3">{dL.value}</Typography>
                <Typography variant="h6">{dL.unit}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                Strain: {result.thermalStrain_mmPerM.toFixed(3)} mm/m (
                {result.thermalStrainPct.toFixed(3)} %)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Stress card */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: isRestrained ? stressColour : 'action.hover',
              color: isRestrained ? 'primary.contrastText' : 'text.primary',
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {isRestrained ? 'Restrained Thermal Stress σ' : 'Stress if restrained σ'}
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h3">{Math.abs(result.thermalStress).toFixed(0)}</Typography>
                <Typography variant="h6">MPa</Typography>
              </Stack>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                {result.thermalStress >= 0 ? 'Compressive' : 'Tensile'}
                {result.yieldStrength !== null
                  ? ` · σ_y(${result.deltaT >= 0 ? 'T_op' : 'T_op'}) = ${result.yieldStrength.toFixed(0)} MPa`
                  : ''}
              </Typography>
              {result.yieldUtilisation !== null && (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Utilisation: {(result.yieldUtilisation * 100).toFixed(0)}% of yield
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert
          severity={
            result.yieldUtilisation !== null && result.yieldUtilisation >= 1 ? 'error' : 'warning'
          }
          sx={{ mb: 2 }}
        >
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* Property breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Properties Used
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Mean α (20 °C → T_install)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.alphaMeanInstallation.toFixed(2)} × 10⁻⁶ /°C
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Mean α (20 °C → T_op)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.alphaMeanOperating.toFixed(2)} × 10⁻⁶ /°C
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>
                  <strong>Effective α (T_install → T_op)</strong>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ border: 0, py: 0.5, fontFamily: 'monospace', fontWeight: 'bold' }}
                >
                  {result.alphaEffective.toFixed(2)} × 10⁻⁶ /°C
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Young&apos;s modulus E(T_op)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.EOperating.toFixed(1)} GPa
                </TableCell>
              </TableRow>
              {result.yieldStrength !== null && (
                <TableRow>
                  <TableCell sx={{ border: 0, py: 0.5 }}>Yield strength σ_y(T_op)</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {result.yieldStrength.toFixed(0)} MPa
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>ΔL</strong> = L₀ × α_eff × ΔT &nbsp;|&nbsp; <strong>σ</strong> = E(T_op) × α_eff ×
          ΔT
        </Typography>
        <Typography variant="caption" color="text.secondary">
          α_eff is derived from tabulated α_mean(20 °C → T) so the result is correct even when
          T_install ≠ 20 °C.
        </Typography>
      </Box>

      <GenerateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        result={result}
        inputs={reportInputs}
      />
    </Paper>
  );
}
