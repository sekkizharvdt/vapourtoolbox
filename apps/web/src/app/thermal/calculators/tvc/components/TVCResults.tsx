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
import type { TVCResult } from '@/lib/thermal';

interface TVCResultsProps {
  result: TVCResult;
}

export function TVCResults({ result }: TVCResultsProps) {
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
            <Typography variant="h3">{result.entrainmentRatio.toFixed(3)}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
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
        <Grid size={{ xs: 6 }}>
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
        <Grid size={{ xs: 6 }}>
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
      </Grid>

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
