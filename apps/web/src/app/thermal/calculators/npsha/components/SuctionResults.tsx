'use client';

import { useState } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Box,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';
import { VALVE_TYPE_LABELS, STRAINER_TYPE_LABELS } from './types';
import { GenerateReportDialog } from './GenerateReportDialog';

export interface SuctionReportInputs {
  effectPressure: string;
  fluidType: string;
  salinity: string;
  flowRate: string;
  nozzleVelocityTarget: string;
  suctionVelocityTarget: string;
  elbowCount: string;
  verticalPipeRun: string;
  horizontalPipeRun: string;
  holdupPipeDiameter: string;
  minColumnHeight: string;
  residenceTime: string;
  pumpNPSHr: string;
  safetyMargin: string;
  mode: string;
  userElevation: string;
}

interface SuctionResultsProps {
  result: SuctionSystemResult;
  inputs: SuctionReportInputs;
}

function getVelocityColor(status: 'OK' | 'HIGH' | 'LOW'): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'OK':
      return 'success';
    case 'HIGH':
      return 'error';
    case 'LOW':
      return 'warning';
  }
}

function getNPSHaColor(isAdequate: boolean, margin: number): 'success' | 'warning' | 'error' {
  if (!isAdequate) return 'error';
  if (margin < 1.0) return 'warning';
  return 'success';
}

export function SuctionResults({ result, inputs }: SuctionResultsProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const dirtyColor = getNPSHaColor(result.npshaDirty.isAdequate, result.npshaDirty.margin);

  return (
    <Stack spacing={3}>
      {/* === Download Report Button === */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => setReportDialogOpen(true)}
        >
          Download Report
        </Button>
      </Box>

      {/* === Primary Result Card === */}
      {result.elevationAdequate !== undefined ? (
        <Card
          variant="outlined"
          sx={{
            borderColor: result.elevationAdequate ? 'success.main' : 'error.main',
            borderWidth: 2,
          }}
        >
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              {result.elevationAdequate ? (
                <CheckCircleIcon color="success" fontSize="large" />
              ) : (
                <ErrorIcon color="error" fontSize="large" />
              )}
              <Box>
                <Typography variant="h5">
                  {result.elevationAdequate ? 'Elevation is Adequate' : 'Elevation is Insufficient'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User elevation: {result.userElevation?.toFixed(2)} m · Required:{' '}
                  {result.requiredElevation.toFixed(2)} m
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Required Minimum Elevation (Nozzle to Pump CL)
            </Typography>
            <Typography variant="h3" color="primary.main">
              {result.requiredElevation.toFixed(2)} m
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* === Key Metrics Grid === */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Nozzle Pipe
              </Typography>
              <Typography variant="h6">{result.nozzlePipe.nps}&quot;</Typography>
              <Chip
                label={`${result.nozzleVelocity.toFixed(3)} m/s`}
                size="small"
                color={getVelocityColor(result.nozzleVelocityStatus)}
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Suction Pipe
              </Typography>
              <Typography variant="h6">{result.suctionPipe.nps}&quot;</Typography>
              <Chip
                label={`${result.suctionVelocity.toFixed(2)} m/s`}
                size="small"
                color={getVelocityColor(result.suctionVelocityStatus)}
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: dirtyColor === 'success' ? undefined : `${dirtyColor}.main`,
              color: dirtyColor === 'success' ? undefined : `${dirtyColor}.contrastText`,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography
                variant="caption"
                sx={{ opacity: dirtyColor === 'success' ? 1 : 0.8 }}
                color={dirtyColor === 'success' ? 'text.secondary' : 'inherit'}
              >
                NPSHa (Dirty)
              </Typography>
              <Typography variant="h6">{result.npshaDirty.npsha.toFixed(2)}</Typography>
              <Typography
                variant="caption"
                sx={{ opacity: dirtyColor === 'success' ? 1 : 0.8 }}
                color={dirtyColor === 'success' ? 'text.secondary' : 'inherit'}
              >
                m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Req. Elevation
              </Typography>
              <Typography variant="h6">{result.requiredElevation.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* === Pipe Selection Table === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Pipe Selection
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Pipe</TableCell>
                <TableCell align="center">NPS</TableCell>
                <TableCell align="center">DN</TableCell>
                <TableCell align="right">ID (mm)</TableCell>
                <TableCell align="right">OD (mm)</TableCell>
                <TableCell align="right">Velocity (m/s)</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Nozzle</TableCell>
                <TableCell align="center">{result.nozzlePipe.nps}&quot;</TableCell>
                <TableCell align="center">DN{result.nozzlePipe.dn}</TableCell>
                <TableCell align="right">{result.nozzlePipe.id_mm.toFixed(1)}</TableCell>
                <TableCell align="right">{result.nozzlePipe.od_mm.toFixed(1)}</TableCell>
                <TableCell align="right">{result.nozzleVelocity.toFixed(3)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={result.nozzleVelocityStatus}
                    size="small"
                    color={getVelocityColor(result.nozzleVelocityStatus)}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Suction</TableCell>
                <TableCell align="center">{result.suctionPipe.nps}&quot;</TableCell>
                <TableCell align="center">DN{result.suctionPipe.dn}</TableCell>
                <TableCell align="right">{result.suctionPipe.id_mm.toFixed(1)}</TableCell>
                <TableCell align="right">{result.suctionPipe.od_mm.toFixed(1)}</TableCell>
                <TableCell align="right">{result.suctionVelocity.toFixed(2)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={result.suctionVelocityStatus}
                    size="small"
                    color={getVelocityColor(result.suctionVelocityStatus)}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === Fittings & Losses Table === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Fittings &amp; Losses (Suction Line)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Auto-selected: {VALVE_TYPE_LABELS[result.valveType]} (NPS {result.suctionPipe.nps}&quot;{' '}
          {'≥'} 4&quot; threshold), {STRAINER_TYPE_LABELS[result.strainerType]}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fitting</TableCell>
                <TableCell align="center">Count</TableCell>
                <TableCell align="right">K</TableCell>
                <TableCell align="right">Loss (m H₂O)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.fittings.map((f, i) => (
                <TableRow key={i}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell align="center">{f.count}</TableCell>
                  <TableCell align="right">{f.kFactor.toFixed(4)}</TableCell>
                  <TableCell align="right">{f.loss.toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === NPSHa Breakdown (Clean vs Dirty Side-by-Side) === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          NPSHa Breakdown
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          NPSHa = Hs + Hp - Hvp - Hf
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="center">Sign</TableCell>
                <TableCell align="right">Clean (m)</TableCell>
                <TableCell align="right">Dirty (m)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  Hs — Static head
                  <Typography variant="caption" color="text.secondary" display="block">
                    Liquid level above pump CL
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography color="success.main">+</Typography>
                </TableCell>
                <TableCell align="right">{result.npshaClean.staticHead.toFixed(3)}</TableCell>
                <TableCell align="right">{result.npshaDirty.staticHead.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Hp — Pressure head
                  <Typography variant="caption" color="text.secondary" display="block">
                    Effect pressure ({(result.vaporPressure * 1000).toFixed(0)} mbar vap)
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography color="success.main">+</Typography>
                </TableCell>
                <TableCell align="right">{result.npshaClean.pressureHead.toFixed(3)}</TableCell>
                <TableCell align="right">{result.npshaDirty.pressureHead.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Hvp — Vapor pressure head
                  <Typography variant="caption" color="text.secondary" display="block">
                    At {result.fluidTemperature.toFixed(1)}°C
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography color="error.main">-</Typography>
                </TableCell>
                <TableCell align="right">
                  {result.npshaClean.vaporPressureHead.toFixed(3)}
                </TableCell>
                <TableCell align="right">
                  {result.npshaDirty.vaporPressureHead.toFixed(3)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Hf — Friction loss
                  <Typography variant="caption" color="text.secondary" display="block">
                    Pipe + fittings + strainer
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography color="error.main">-</Typography>
                </TableCell>
                <TableCell align="right">{result.npshaClean.frictionLoss.toFixed(3)}</TableCell>
                <TableCell align="right">{result.npshaDirty.frictionLoss.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow
                sx={{ '& td': { fontWeight: 'bold', borderTop: 2, borderColor: 'divider' } }}
              >
                <TableCell>NPSHa</TableCell>
                <TableCell align="center">=</TableCell>
                <TableCell align="right">{result.npshaClean.npsha.toFixed(3)}</TableCell>
                <TableCell align="right">{result.npshaDirty.npsha.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Margin (NPSHa - NPSHr)</TableCell>
                <TableCell />
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={
                      getNPSHaColor(result.npshaClean.isAdequate, result.npshaClean.margin) ===
                      'success'
                        ? 'success.main'
                        : getNPSHaColor(result.npshaClean.isAdequate, result.npshaClean.margin) ===
                            'warning'
                          ? 'warning.main'
                          : 'error.main'
                    }
                    fontWeight="bold"
                  >
                    {result.npshaClean.margin >= 0 ? '+' : ''}
                    {result.npshaClean.margin.toFixed(3)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color={`${dirtyColor}.main`} fontWeight="bold">
                    {result.npshaDirty.margin >= 0 ? '+' : ''}
                    {result.npshaDirty.margin.toFixed(3)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === Strainer Pressure Drop === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Strainer Pressure Drop — {result.strainerPressureDrop.strainerName}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Clean (K={result.strainerPressureDrop.cleanKFactor})
                </Typography>
                <Typography variant="h6">
                  {result.strainerPressureDrop.cleanLossMbar.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  mbar ({result.strainerPressureDrop.cleanLoss.toFixed(3)} m H₂O)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Dirty (K={result.strainerPressureDrop.dirtyKFactor})
                </Typography>
                <Typography variant="h6">
                  {result.strainerPressureDrop.dirtyLossMbar.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  mbar ({result.strainerPressureDrop.dirtyLoss.toFixed(3)} m H₂O)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* === Holdup Volume Details === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Holdup Volume
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Holdup Pipe
            </Typography>
            <Typography variant="body2">
              {result.holdup.holdupPipeNPS}&quot; (ID {result.holdup.holdupPipeID.toFixed(1)} mm)
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Governing Height
            </Typography>
            <Typography variant="body2">{result.holdup.governingHeight.toFixed(2)} m</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Volume
            </Typography>
            <Typography variant="body2">{result.holdup.holdupVolume.toFixed(1)} litres</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Actual Residence Time
            </Typography>
            <Typography variant="body2">
              {result.holdup.actualResidenceTime.toFixed(1)} s
            </Typography>
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Governing constraint:{' '}
          <strong>
            {result.holdup.governingConstraint === 'residence_time'
              ? `Residence time (${result.holdup.heightFromResidenceTime.toFixed(2)} m > min column ${result.holdup.heightFromMinColumn.toFixed(2)} m)`
              : `Min column height (${result.holdup.heightFromMinColumn.toFixed(2)} m > residence time ${result.holdup.heightFromResidenceTime.toFixed(2)} m)`}
          </strong>
        </Typography>
      </Paper>

      {/* === Elevation Breakdown === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Elevation Breakdown
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>Holdup standpipe height</TableCell>
                <TableCell align="right">
                  {result.elevationBreakdown.holdupHeight.toFixed(2)} m
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Additional head for NPSHa</TableCell>
                <TableCell align="right">
                  {result.elevationBreakdown.additionalHeadRequired.toFixed(2)} m
                </TableCell>
              </TableRow>
              <TableRow
                sx={{ '& td': { fontWeight: 'bold', borderTop: 2, borderColor: 'divider' } }}
              >
                <TableCell>Required Elevation</TableCell>
                <TableCell align="right">{result.elevationBreakdown.total.toFixed(2)} m</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === Fluid Properties === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Fluid Properties
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Saturation Temperature
            </Typography>
            <Typography variant="body2">{result.saturationTemperature.toFixed(1)} °C</Typography>
          </Grid>
          {result.boilingPointElevation > 0 && (
            <Grid size={{ xs: 6, sm: 4 }}>
              <Typography variant="caption" color="text.secondary">
                BPE
              </Typography>
              <Typography variant="body2">{result.boilingPointElevation.toFixed(2)} °C</Typography>
            </Grid>
          )}
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Fluid Temperature
            </Typography>
            <Typography variant="body2">{result.fluidTemperature.toFixed(1)} °C</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Density
            </Typography>
            <Typography variant="body2">{result.fluidDensity.toFixed(2)} kg/m³</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Viscosity
            </Typography>
            <Typography variant="body2">
              {(result.fluidViscosity * 1000).toFixed(3)} mPa·s
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Vapor Pressure
            </Typography>
            <Typography variant="body2">{(result.vaporPressure * 1000).toFixed(1)} mbar</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* === Warnings === */}
      {result.warnings.length > 0 && (
        <Box>
          {result.warnings.map((warning, i) => (
            <Alert
              key={i}
              severity={warning.includes('CRITICAL') ? 'error' : 'warning'}
              sx={{ mb: 1 }}
            >
              {warning}
            </Alert>
          ))}
        </Box>
      )}

      <Divider />

      {/* === Pressure Summary === */}
      <Typography variant="caption" color="text.secondary">
        Effect pressure: {inputs.effectPressure} mbar(a) ={' '}
        {(parseFloat(inputs.effectPressure) / 1000).toFixed(4)} bar(a) · Total friction (dirty):{' '}
        {result.pressureDropDirty.totalPressureDropMbar.toFixed(1)} mbar ={' '}
        {result.pressureDropDirty.totalPressureDropMH2O.toFixed(3)} m H₂O
      </Typography>

      {/* === Report Dialog === */}
      <GenerateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        result={result}
        inputs={inputs}
      />
    </Stack>
  );
}
