'use client';

/**
 * Nozzle Sizing Table
 *
 * Displays nozzle sizing results with velocity status indicators.
 */

import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import type { NozzleSizing as NozzleSizingType } from '@vapour/types';

interface NozzleSizingProps {
  nozzles: NozzleSizingType[];
}

export function NozzleSizing({ nozzles }: NozzleSizingProps) {
  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const getVelocityColor = (status: 'OK' | 'HIGH' | 'LOW') => {
    switch (status) {
      case 'OK':
        return 'success';
      case 'HIGH':
        return 'error';
      case 'LOW':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Nozzle Sizing
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nozzle</TableCell>
              <TableCell align="right">Required Area</TableCell>
              <TableCell align="right">Calc. Diameter</TableCell>
              <TableCell align="center">Selected Size</TableCell>
              <TableCell align="right">Actual ID</TableCell>
              <TableCell align="right">Velocity</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
            <TableRow>
              <TableCell></TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  mm²
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  mm
                </Typography>
              </TableCell>
              <TableCell align="center"></TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  mm
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  m/s
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" color="text.secondary">
                  ({`min-max`})
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nozzles.map((nozzle) => (
              <TableRow key={nozzle.type} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {nozzle.name}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(nozzle.requiredArea, 0)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatNumber(nozzle.calculatedDiameter, 1)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight="medium" color="primary.main">
                    {nozzle.selectedPipeSize}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(nozzle.actualID, 1)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {nozzle.actualVelocity.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${nozzle.velocityStatus} (${nozzle.velocityLimits.min}-${nozzle.velocityLimits.max})`}
                    color={getVelocityColor(nozzle.velocityStatus)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
