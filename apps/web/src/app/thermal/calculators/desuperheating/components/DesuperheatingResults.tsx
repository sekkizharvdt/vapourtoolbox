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
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import type { DesuperheatingResult } from '@/lib/thermal';

interface DesuperheatingResultsProps {
  result: DesuperheatingResult;
}

export function DesuperheatingResults({ result }: DesuperheatingResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Desuperheating Result
      </Typography>

      {/* Primary result: Spray water flow */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Required Spray Water Flow
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.sprayWaterFlow.toFixed(2)}</Typography>
            <Typography variant="h6">ton/hr</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Water-to-steam ratio: {(result.waterToSteamRatio * 100).toFixed(1)}%
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

      {/* Enthalpy Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Enthalpy Breakdown
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Inlet steam enthalpy</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.steamEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Target enthalpy</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.targetEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Spray water enthalpy</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.sprayWaterEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Temperature Analysis */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Tsat
              </Typography>
              <Typography variant="h6">{result.saturationTemperature.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Inlet Superheat
              </Typography>
              <Typography variant="h6">{result.degreesOfSuperheat.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Outlet Superheat
              </Typography>
              <Typography variant="h6">{result.outletSuperheat.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Heat Removed & Flow */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Heat Removed
              </Typography>
              <Typography variant="h6">{result.heatRemoved.toFixed(1)}</Typography>
              <Typography variant="caption">kW</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Total Outlet Flow
              </Typography>
              <Typography variant="h6">{result.totalOutletFlow.toFixed(2)}</Typography>
              <Typography variant="caption">ton/hr</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Formula */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Energy Balance:</strong> m_steam × h_steam + m_water × h_water = m_total ×
          h_target
        </Typography>
        <Typography variant="body2" color="text.secondary">
          m_water = m_steam × (h_steam - h_target) / (h_target - h_water)
        </Typography>
      </Box>
    </Paper>
  );
}
