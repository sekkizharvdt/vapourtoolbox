'use client';

/**
 * NPSHa Calculation Display
 *
 * Shows the Net Positive Suction Head Available calculation
 * at three levels (LG-L, Operating, LG-H) with recommendation for pump selection.
 */

import {
  Paper,
  Typography,
  Box,
  Stack,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { NPSHaCalculation as NPSHaCalculationType, NPSHaAtLevel } from '@vapour/types';

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

  // Determine severity based on worst case (LG-L)
  const getSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    const worstCase = npsha.atLGL.npshAvailable;
    if (worstCase < 0) return 'error';
    if (worstCase < 0.5) return 'error';
    if (worstCase < 1.5) return 'warning';
    if (worstCase < 3) return 'info';
    return 'success';
  };

  // Get color for NPSHa value
  const getNPSHaColor = (value: number): string => {
    if (value < 0) return 'error.main';
    if (value < 1.5) return 'warning.main';
    return 'primary.main';
  };

  // Helper to render a single level row
  const renderLevelRow = (level: NPSHaAtLevel, isWorstCase: boolean = false) => (
    <TableRow key={level.levelName} sx={isWorstCase ? { backgroundColor: 'action.hover' } : {}}>
      <TableCell>
        <Typography variant="body2" fontWeight={isWorstCase ? 'bold' : 'normal'}>
          {level.levelName}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">{formatNumber(level.elevation, 3)} m</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="success.main">
          {formatNumber(level.staticHead)} m
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="bold" color={getNPSHaColor(level.npshAvailable)}>
          {formatNumber(level.npshAvailable)} m
        </Typography>
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        NPSHa Calculation (Three Levels)
      </Typography>

      <Stack spacing={2}>
        {/* Common parameters */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Common Parameters
          </Typography>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Chamber Pressure Head</Typography>
              <Typography variant="body2" color="success.main">
                + {formatNumber(npsha.chamberPressureHead)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Vapor Pressure Head</Typography>
              <Typography variant="body2" color="error.main">
                - {formatNumber(npsha.vaporPressureHead)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Friction Loss (estimated)</Typography>
              <Typography variant="body2" color="error.main">
                - {formatNumber(npsha.frictionLoss)} m
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Divider />

        {/* NPSHa at Three Levels */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            NPSHa at Operating Levels
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Level</TableCell>
                  <TableCell align="right">Elevation</TableCell>
                  <TableCell align="right">Static Head</TableCell>
                  <TableCell align="right">NPSHa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renderLevelRow(npsha.atLGH)}
                {renderLevelRow(npsha.atOperating)}
                {renderLevelRow(npsha.atLGL, true)} {/* Worst case highlighted */}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Typography variant="caption" color="text.secondary">
          NPSHa = Static Head + Chamber Pressure Head - Vapor Pressure Head - Friction Loss
        </Typography>

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
