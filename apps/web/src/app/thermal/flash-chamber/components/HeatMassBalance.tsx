'use client';

/**
 * Heat and Mass Balance Table
 *
 * Displays the heat and mass balance for the flash chamber
 * with visual feedback on balance status.
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
  Box,
  Chip,
  Stack,
} from '@mui/material';
import { CheckCircle as CheckIcon, Warning as WarningIcon } from '@mui/icons-material';
import type { HeatMassBalance as HeatMassBalanceType } from '@vapour/types';

interface HeatMassBalanceProps {
  balance: HeatMassBalanceType;
}

export function HeatMassBalance({ balance }: HeatMassBalanceProps) {
  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const rows = [
    { ...balance.inlet, type: 'in' },
    { ...balance.vapor, type: 'out' },
    { ...balance.brine, type: 'out' },
  ];

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Heat & Mass Balance</Typography>
        <Chip
          icon={balance.isBalanced ? <CheckIcon /> : <WarningIcon />}
          label={balance.isBalanced ? 'Balanced' : `Error: ${balance.balanceError.toFixed(2)}%`}
          color={balance.isBalanced ? 'success' : 'warning'}
          variant="outlined"
        />
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Stream</TableCell>
              <TableCell align="right">Flow Rate</TableCell>
              <TableCell align="right">Temperature</TableCell>
              <TableCell align="right">Pressure</TableCell>
              <TableCell align="right">Enthalpy</TableCell>
              <TableCell align="right">Heat Duty</TableCell>
            </TableRow>
            <TableRow>
              <TableCell></TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  ton/hr
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  °C
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  mbar abs
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  kJ/kg
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption" color="text.secondary">
                  kW
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.stream}
                sx={{
                  bgcolor: row.type === 'in' ? 'primary.dark' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: row.type === 'in' ? 'info.main' : 'success.main',
                      }}
                    />
                    <Typography variant="body2">{row.stream}</Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatNumber(row.flowRate, 2)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(row.temperature, 1)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(row.pressure, 2)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(row.enthalpy, 1)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatNumber(row.heatDuty, 1)}</Typography>
                </TableCell>
              </TableRow>
            ))}

            {/* Summary Row */}
            <TableRow sx={{ borderTop: 2, borderColor: 'divider' }}>
              <TableCell colSpan={4}></TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">
                  Heat In:
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold" color="info.main">
                  {formatNumber(balance.heatInput, 1)} kW
                </Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4}></TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">
                  Heat Out:
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  {formatNumber(balance.heatOutput, 1)} kW
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
