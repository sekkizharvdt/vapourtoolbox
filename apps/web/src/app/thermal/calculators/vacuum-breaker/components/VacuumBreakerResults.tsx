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
  TableHead,
  Button,
} from '@mui/material';
import { Download as DownloadIcon, Save as SaveIcon } from '@mui/icons-material';
import type { VacuumBreakerResult } from '@/lib/thermal/vacuumBreakerCalculator';
import { GenerateReportDialog } from './GenerateReportDialog';
import { SaveCalculationDialog } from '../../siphon-sizing/components/SaveCalculationDialog';

export interface VacuumBreakerReportInputs {
  totalVolume: string;
  numberOfBreakers: string;
  operatingPressure: string;
  equalizationTime: string;
  ambientTemperature: string;
  valveType: string;
}

interface VacuumBreakerResultsProps {
  result: VacuumBreakerResult;
  inputs: VacuumBreakerReportInputs;
}

export function VacuumBreakerResults({ result, inputs }: VacuumBreakerResultsProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  return (
    <Paper sx={{ p: 3 }}>
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)}>
          Save
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => setReportDialogOpen(true)}
        >
          PDF Report
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>
        Vacuum Breaker Sizing Result
      </Typography>

      {/* Primary result */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Selected Valve Size ({result.numberOfBreakers} identical breakers)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">DN {result.selectedValve.dn}</Typography>
            <Typography variant="h6">({result.selectedValve.nps})</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Required orifice area: {result.requiredOrificeArea} cm&sup2; | Valve bore:{' '}
            {result.selectedValve.boreArea} cm&sup2;
          </Typography>
        </CardContent>
      </Card>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* Key Parameters */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Vol. per Breaker
              </Typography>
              <Typography variant="h6">{result.volumePerBreaker}</Typography>
              <Typography variant="caption">m&sup3;</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Air Mass Required
              </Typography>
              <Typography variant="h6">{result.airMassRequired}</Typography>
              <Typography variant="caption">kg</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Orifice Diameter
              </Typography>
              <Typography variant="h6">{result.requiredOrificeDiameter}</Typography>
              <Typography variant="caption">mm</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Avg. Flow Rate
              </Typography>
              <Typography variant="h6">{result.averageMassFlowRate}</Typography>
              <Typography variant="caption">kg/s</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Calculation Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Calculation Parameters
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Discharge coefficient (C_d)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.dischargeCoefficient}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Critical pressure ratio</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.criticalPressureRatio}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Choked → subsonic transition</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.transitionPressureKPa} kPa abs
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Choked mass flux</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.chokedFluxPerCd} kg/(s&middot;m&sup2;)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pressure Profile Table (sampled) */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Pressure Equalization Profile (with DN {result.selectedValve.dn} valve)
          </Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Time (min)</TableCell>
                  <TableCell align="right">Pressure (kPa abs)</TableCell>
                  <TableCell align="right">Flow Rate (kg/s)</TableCell>
                  <TableCell align="center">Regime</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.pressureProfile.map((step, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {(step.time / 60).toFixed(1)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {step.pressure.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {step.massFlowRate.toFixed(4)}
                    </TableCell>
                    <TableCell align="center">
                      {step.regime === 'choked' ? '🔴 Choked' : '🟢 Subsonic'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <GenerateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        result={result}
        inputs={inputs}
      />
      <SaveCalculationDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        inputs={inputs as unknown as Record<string, unknown>}
        calculatorType="VACUUM_BREAKER"
      />
    </Paper>
  );
}
