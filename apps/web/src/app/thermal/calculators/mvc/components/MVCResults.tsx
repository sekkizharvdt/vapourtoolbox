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
import type { MVCResult } from '@/lib/thermal';

interface MVCResultsProps {
  result: MVCResult;
}

export function MVCResults({ result }: MVCResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        MVC Result
      </Typography>

      {/* Primary result: Shaft Power + Specific Energy */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Shaft Power
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.shaftPower.toFixed(1)}</Typography>
            <Typography variant="h6">kW</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Specific energy: {result.specificEnergy.toFixed(2)} kWh/ton | Electrical:{' '}
            {result.electricalPower.toFixed(1)} kW
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

      {/* Compression */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Compression Ratio
              </Typography>
              <Typography variant="h6">{result.compressionRatio.toFixed(2)}</Typography>
              <Typography variant="caption">Pd / Ps</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Isentropic Eff.
              </Typography>
              <Typography variant="h6">
                {(result.isentropicEfficiency * 100).toFixed(0)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Suction Volume
              </Typography>
              <Typography variant="h6">{result.volumetricFlowSuction.toFixed(0)}</Typography>
              <Typography variant="caption">m³/hr</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Temperatures */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Temperatures
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Suction</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.suctionTemperature.toFixed(1)} °C
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Discharge (isentropic)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.dischargeTemperatureIsentropic.toFixed(1)} °C
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5, fontWeight: 'bold' }}>
                  Discharge (actual)
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ border: 0, py: 0.5, fontFamily: 'monospace', fontWeight: 'bold' }}
                >
                  {result.dischargeTemperatureActual.toFixed(1)} °C
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enthalpies */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Enthalpies
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Suction</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.suctionEnthalpy.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5 }}>Discharge (isentropic)</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                  {result.dischargeEnthalpyIsentropic.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5, fontWeight: 'bold' }}>
                  Discharge (actual)
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ border: 0, py: 0.5, fontFamily: 'monospace', fontWeight: 'bold' }}
                >
                  {result.dischargeEnthalpyActual.toFixed(1)} kJ/kg
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Power Breakdown */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Isentropic Power
              </Typography>
              <Typography variant="h6">{result.isentropicPower.toFixed(1)}</Typography>
              <Typography variant="caption">kW</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Shaft Power
              </Typography>
              <Typography variant="h6">{result.shaftPower.toFixed(1)}</Typography>
              <Typography variant="caption">kW</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Electrical Power
              </Typography>
              <Typography variant="h6">{result.electricalPower.toFixed(1)}</Typography>
              <Typography variant="caption">kW</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Formula */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Isentropic Compression:</strong> W_is = ṁ × (h_out_s - h_in)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          h_out = h_in + (h_out_s - h_in) / η_is
        </Typography>
      </Box>
    </Paper>
  );
}
