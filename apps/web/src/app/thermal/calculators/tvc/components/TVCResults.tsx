'use client';

import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import type { TVCResult, DesuperheatingResult } from '@/lib/thermal';

interface TVCResultsProps {
  result: TVCResult;
  desuperheatingResult?: DesuperheatingResult | null;
}

export function TVCResults({ result, desuperheatingResult }: TVCResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        TVC Result
      </Typography>

      {/* Primary result: Entrainment Ratio */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Entrainment Ratio (Ra = entrained / motive)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.entrainmentRatio.toFixed(2)}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Theoretical: {result.theoreticalEntrainmentRatio.toFixed(2)} × η ={' '}
            {(result.ejectorEfficiency * 100).toFixed(0)}%
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            CR = {result.compressionRatio.toFixed(2)} | ER = {result.expansionRatio.toFixed(1)}
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

      {/* Ratios */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Compression Ratio
              </Typography>
              <Typography variant="h6">{result.compressionRatio.toFixed(2)}</Typography>
              <Typography variant="caption">Pc / Ps</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Expansion Ratio
              </Typography>
              <Typography variant="h6">{result.expansionRatio.toFixed(1)}</Typography>
              <Typography variant="caption">Pm / Ps</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Ejector Efficiency
              </Typography>
              <Typography variant="h6">{(result.ejectorEfficiency * 100).toFixed(0)}%</Typography>
              <Typography variant="caption">η_ej</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Efficiency Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Efficiency Parameters (1-D Model)
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Nozzle efficiency (η_n)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {(result.nozzleEfficiency * 100).toFixed(0)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Mixing efficiency (η_m)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {(result.mixingEfficiency * 100).toFixed(0)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Diffuser efficiency (η_d)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {(result.diffuserEfficiency * 100).toFixed(0)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Flow Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Flow Breakdown
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Motive steam</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.motiveFlow.toFixed(2)} ton/hr
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Entrained vapor</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.entrainedFlow.toFixed(2)} ton/hr
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ borderTop: 1, borderBottom: 0, py: 0.5, fontWeight: 'bold' }}>
                  Discharge total
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderTop: 1,
                    borderBottom: 0,
                    py: 0.5,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  {result.dischargeFlow.toFixed(2)} ton/hr
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enthalpy Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Enthalpy
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Motive steam</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.motiveEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Suction vapor</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.suctionEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Discharge (energy balance)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.dischargeEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Discharge Conditions */}
      <Card
        variant="outlined"
        sx={{ mb: 2, bgcolor: desuperheatingResult ? 'action.hover' : 'warning.light' }}
      >
        <CardContent sx={{ textAlign: 'center', py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Discharge Temperature{' '}
            {desuperheatingResult ? '(Before Desuperheating)' : '(Superheated)'}
          </Typography>
          <Typography variant="h5">{result.dischargeTemperature.toFixed(1)} °C</Typography>
          <Typography variant="body2">
            {result.dischargeSuperheat.toFixed(1)}°C superheat above Tsat (
            {result.dischargeSatTemperature.toFixed(1)}°C)
          </Typography>
        </CardContent>
      </Card>

      {/* Desuperheating Results */}
      {desuperheatingResult && (
        <Card variant="outlined" sx={{ mb: 2, bgcolor: 'success.light' }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom sx={{ textAlign: 'center' }}>
              After Desuperheating
            </Typography>
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="baseline"
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Typography variant="h4">
                {(result.dischargeSatTemperature + desuperheatingResult.outletSuperheat).toFixed(1)}{' '}
                °C
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({desuperheatingResult.outletSuperheat.toFixed(1)}°C superheat)
              </Typography>
            </Stack>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ border: 0, py: 0.5 }}>Spray water required</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {desuperheatingResult.sprayWaterFlow.toFixed(3)} ton/hr
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: 0, py: 0.5 }}>Water-to-steam ratio</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {(desuperheatingResult.waterToSteamRatio * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ borderTop: 1, borderBottom: 0, py: 0.5, fontWeight: 'bold' }}>
                    Total outlet flow
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      borderTop: 1,
                      borderBottom: 0,
                      py: 0.5,
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                    }}
                  >
                    {desuperheatingResult.totalOutletFlow.toFixed(2)} ton/hr
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: 0, py: 0.5 }}>Heat removed</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {desuperheatingResult.heatRemoved.toFixed(1)} kW
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {desuperheatingResult.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {desuperheatingResult.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saturation Temperatures */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Motive Tsat
              </Typography>
              <Typography variant="h6">{result.motiveSatTemperature.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Suction Tsat
              </Typography>
              <Typography variant="h6">{result.suctionSatTemperature.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Discharge Tsat
              </Typography>
              <Typography variant="h6">{result.dischargeSatTemperature.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
}
