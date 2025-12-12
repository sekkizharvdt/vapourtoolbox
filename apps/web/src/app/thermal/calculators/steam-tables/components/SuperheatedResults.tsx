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
import type { SuperheatedResult, PressureUnit } from './types';
import { convertBarToPressureUnit, getPressureUnitLabel } from './pressureUtils';

interface SuperheatedResultsProps {
  result: SuperheatedResult;
  pressureUnit: PressureUnit;
}

export function SuperheatedResults({ result, pressureUnit }: SuperheatedResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Superheated Steam Properties
      </Typography>

      {/* Primary Values */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          mb: 3,
          p: 2,
          bgcolor: 'error.main',
          color: 'error.contrastText',
          borderRadius: 1,
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Temperature
          </Typography>
          <Typography variant="h5">{result.temperature.toFixed(2)} °C</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Pressure
          </Typography>
          <Typography variant="h5">
            {convertBarToPressureUnit(result.pressure, pressureUnit).toFixed(4)}{' '}
            {getPressureUnitLabel(pressureUnit)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Superheat
          </Typography>
          <Typography variant="h5">{result.superheat.toFixed(2)} °C</Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Properties Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Property</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Unit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Specific Enthalpy (h)</TableCell>
              <TableCell align="right">{result.enthalpy.toFixed(2)}</TableCell>
              <TableCell align="right">kJ/kg</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Density (ρ)</TableCell>
              <TableCell align="right">{result.density.toFixed(4)}</TableCell>
              <TableCell align="right">kg/m³</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Specific Volume (v)</TableCell>
              <TableCell align="right">{result.specificVolume.toFixed(4)}</TableCell>
              <TableCell align="right">m³/kg</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Specific Heat (Cp)</TableCell>
              <TableCell align="right">{result.specificHeat.toFixed(4)}</TableCell>
              <TableCell align="right">kJ/(kg·K)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Internal Energy (u)</TableCell>
              <TableCell align="right">{result.internalEnergy.toFixed(2)}</TableCell>
              <TableCell align="right">kJ/kg</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Entropy (s)</TableCell>
              <TableCell align="right">{result.entropy.toFixed(4)}</TableCell>
              <TableCell align="right">kJ/(kg·K)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Speed of Sound (w)</TableCell>
              <TableCell align="right">{result.speedOfSound.toFixed(1)}</TableCell>
              <TableCell align="right">m/s</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
