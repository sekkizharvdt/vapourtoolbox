'use client';

import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Stack,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import type { PumpSizingResult } from '@/lib/thermal';

interface PumpSizingResultsProps {
  result: PumpSizingResult;
}

export function PumpSizingResults({ result }: PumpSizingResultsProps) {
  const headRows = [
    { label: 'Static Head', value: result.headBreakdown.staticHead },
    { label: 'Discharge Pressure Head', value: result.headBreakdown.dischargePressureHead },
    { label: 'Suction Pressure Head', value: -result.headBreakdown.suctionPressureHead },
    { label: 'Discharge Friction Head', value: result.headBreakdown.dischargeFrictionHead },
    { label: 'Suction Friction Head', value: result.headBreakdown.suctionFrictionHead },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Pump Sizing Result
      </Typography>

      {/* Primary result: TDH */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Total Differential Head
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.totalDifferentialHead.toFixed(1)}</Typography>
            <Typography variant="h6">m</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            = {result.differentialPressure.toFixed(2)} bar differential
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

      {/* Head Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Head Breakdown
          </Typography>
          <Table size="small">
            <TableBody>
              {headRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell sx={{ border: 0, py: 0.5 }}>{row.label}</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {row.value >= 0 ? '+' : ''}
                    {row.value.toFixed(2)} m
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ borderTop: 1, borderBottom: 0, py: 0.5, fontWeight: 'bold' }}>
                  Total
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
                  {result.totalDifferentialHead.toFixed(2)} m
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Power Calculations */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Power
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Hydraulic
                  </Typography>
                  <Typography variant="h6">{result.hydraulicPower.toFixed(2)}</Typography>
                  <Typography variant="caption">kW</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Brake (Shaft)
                  </Typography>
                  <Typography variant="h6">{result.brakePower.toFixed(2)}</Typography>
                  <Typography variant="caption">kW</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Motor Input
                  </Typography>
                  <Typography variant="h6">{result.motorPower.toFixed(2)}</Typography>
                  <Typography variant="caption">kW</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Motor Size
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="baseline"
                    spacing={0.5}
                  >
                    <Typography variant="h6">{result.recommendedMotorKW}</Typography>
                    <Typography variant="caption">kW</Typography>
                  </Stack>
                  <Chip label="IEC" size="small" variant="outlined" color="primary" />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Flow Data */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Volumetric Flow
              </Typography>
              <Typography variant="h6">{result.volumetricFlowM3Hr.toFixed(2)}</Typography>
              <Typography variant="caption">m³/hr</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Pump Eff.
              </Typography>
              <Typography variant="h6">{(result.pumpEfficiency * 100).toFixed(0)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Motor Eff.
              </Typography>
              <Typography variant="h6">{(result.motorEfficiency * 100).toFixed(0)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Formula Breakdown */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Hydraulic Power:</strong> P = Q × ρ × g × H / 1000
        </Typography>
        <Typography variant="body2" color="text.secondary">
          P = {(result.volumetricFlowM3Hr / 3600).toFixed(4)} m³/s × ρ × 9.81 ×{' '}
          {result.totalDifferentialHead.toFixed(2)} m = {result.hydraulicPower.toFixed(2)} kW
        </Typography>
      </Box>
    </Paper>
  );
}
