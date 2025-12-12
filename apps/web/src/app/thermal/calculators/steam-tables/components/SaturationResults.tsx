'use client';

import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import type { SaturationResult, PressureUnit } from './types';
import { convertBarToPressureUnit, getPressureUnitLabel } from './pressureUtils';

interface SaturationResultsProps {
  result: SaturationResult;
  pressureUnit: PressureUnit;
}

export function SaturationResults({ result, pressureUnit }: SaturationResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Saturation Properties
      </Typography>

      {/* Primary Values */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 2,
          mb: 3,
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 1,
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Saturation Temperature
          </Typography>
          <Typography variant="h5">{result.temperature.toFixed(2)} °C</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Saturation Pressure
          </Typography>
          <Typography variant="h5">
            {convertBarToPressureUnit(result.pressure, pressureUnit).toFixed(4)}{' '}
            {getPressureUnitLabel(pressureUnit)}
          </Typography>
          {pressureUnit !== 'bar' && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              ({result.pressure.toFixed(4)} bar)
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Detailed Properties Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Property</TableCell>
              <TableCell align="right">Liquid (f)</TableCell>
              <TableCell align="right">Vapor (g)</TableCell>
              <TableCell align="right">Unit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Specific Enthalpy (h)</TableCell>
              <TableCell align="right">{result.enthalpyLiquid.toFixed(2)}</TableCell>
              <TableCell align="right">{result.enthalpyVapor.toFixed(2)}</TableCell>
              <TableCell align="right">kJ/kg</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Latent Heat (h_fg)</TableCell>
              <TableCell align="right" colSpan={2}>
                {result.latentHeat.toFixed(2)}
              </TableCell>
              <TableCell align="right">kJ/kg</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Density (ρ)</TableCell>
              <TableCell align="right">{result.densityLiquid.toFixed(2)}</TableCell>
              <TableCell align="right">{result.densityVapor.toFixed(4)}</TableCell>
              <TableCell align="right">kg/m³</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Specific Volume (v)</TableCell>
              <TableCell align="right">{result.specificVolumeLiquid.toFixed(6)}</TableCell>
              <TableCell align="right">{result.specificVolumeVapor.toFixed(4)}</TableCell>
              <TableCell align="right">m³/kg</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
