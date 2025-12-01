'use client';

/**
 * NPSHa Calculation Display
 *
 * Shows the Net Positive Suction Head Available calculation
 * breakdown with recommendation for pump selection.
 */

import { Paper, Typography, Box, Stack, Divider, Alert } from '@mui/material';
import type { NPSHaCalculation as NPSHaCalculationType } from '@vapour/types';

interface NPSHaCalculationProps {
  npsha: NPSHaCalculationType;
}

export function NPSHaCalculation({ npsha }: NPSHaCalculationProps) {
  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Determine severity based on NPSHa value
  const getSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    if (npsha.npshAvailable >= 5) return 'success';
    if (npsha.npshAvailable >= 3) return 'info';
    if (npsha.npshAvailable >= 1.5) return 'warning';
    return 'error';
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        NPSHa Calculation (Bottom Pump)
      </Typography>

      <Stack spacing={2}>
        {/* Calculation breakdown */}
        <Box>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Static Head (liquid level)</Typography>
              <Typography variant="body2" fontWeight="medium" color="success.main">
                + {formatNumber(npsha.staticHead)} m
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Atmospheric Pressure</Typography>
              <Typography variant="body2" fontWeight="medium" color="success.main">
                + {formatNumber(npsha.atmosphericPressure)} m
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Vapor Pressure</Typography>
              <Typography variant="body2" fontWeight="medium" color="error.main">
                - {formatNumber(npsha.vaporPressure)} m
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Friction Loss (estimated)</Typography>
              <Typography variant="body2" fontWeight="medium" color="error.main">
                - {formatNumber(npsha.frictionLoss)} m
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Divider />

        {/* Result */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            NPSHa =
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="primary.main">
            {formatNumber(npsha.npshAvailable)} m
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Recommended minimum NPSHa margin: {formatNumber(npsha.recommendedNpshMargin)} m above pump
          NPSHr
        </Typography>

        {/* Recommendation */}
        <Alert severity={getSeverity()}>{npsha.recommendation}</Alert>
      </Stack>
    </Paper>
  );
}
