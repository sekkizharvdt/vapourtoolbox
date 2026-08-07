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
import { useMemo } from 'react';
import type { NPSHaCalculation as NPSHaCalculationType, NPSHaAtLevel } from '@vapour/types';
import { NPSH_MARGIN_REFERENCE_POINTS } from '@vapour/types';
import { formatNumber } from '@/lib/utils/formatters';

interface NPSHaCalculationProps {
  npsha: NPSHaCalculationType;
}

export function NPSHaCalculation({ npsha }: NPSHaCalculationProps) {
  // A named pump turns this from advice into a pass/fail, so the verdict drives
  // the severity rather than the NPSHa bands — which are only a proxy for it.
  const hasPump = npsha.pumpNPSHr !== undefined;

  /**
   * The margin decision, laid out rather than made.
   *
   * Each reference margin is evaluated against THIS vessel's worst-level
   * margin, with the elevation change that would carry a failing one. The
   * selected value is included even when it is not one of the reference points,
   * so a custom margin is never silently missing from its own comparison.
   */
  const marginSensitivity = useMemo(() => {
    if (npsha.pumpNPSHr === undefined) return [];

    const actualMargin = npsha.atLGL.margin ?? 0;
    const selected = npsha.npshSafetyMargin;

    const points = [...NPSH_MARGIN_REFERENCE_POINTS.map((p) => ({ ...p }))];
    if (selected !== undefined && !points.some((p) => p.marginM === selected)) {
      points.push({ marginM: selected, label: 'Your value', source: 'Entered for this vessel.' });
    }

    return points
      .sort((a, b) => a.marginM - b.marginM)
      .map((p) => ({
        marginM: p.marginM,
        label: p.label,
        passes: actualMargin >= p.marginM,
        shortfallM: Math.max(0, p.marginM - actualMargin),
        isSelected: selected !== undefined && p.marginM === selected,
      }));
  }, [npsha.pumpNPSHr, npsha.atLGL.margin, npsha.npshSafetyMargin]);

  // Determine severity based on worst case (LG-L)
  const getSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    if (hasPump) return npsha.isAdequate ? 'success' : 'error';

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
          {formatNumber(level.staticHead, 2)} m
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="bold" color={getNPSHaColor(level.npshAvailable)}>
          {formatNumber(level.npshAvailable, 2)} m
        </Typography>
      </TableCell>
      {hasPump && (
        <TableCell align="right">
          <Typography
            variant="body2"
            fontWeight={isWorstCase ? 'bold' : 'normal'}
            color={level.isAdequate ? 'success.main' : 'error.main'}
          >
            {formatNumber(level.margin ?? 0, 2)} m
          </Typography>
        </TableCell>
      )}
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
                + {formatNumber(npsha.chamberPressureHead, 2)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Vapor Pressure Head</Typography>
              <Typography variant="body2" color="error.main">
                - {formatNumber(npsha.vaporPressureHead, 2)} m
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Friction Loss (estimated)</Typography>
              <Typography variant="body2" color="error.main">
                - {formatNumber(npsha.frictionLoss, 2)} m
              </Typography>
            </Box>
            {hasPump && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Pump NPSHr (datasheet)</Typography>
                  <Typography variant="body2">{formatNumber(npsha.pumpNPSHr!, 2)} m</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Margin required above NPSHr</Typography>
                  <Typography variant="body2">
                    {formatNumber(npsha.npshSafetyMargin ?? 0, 2)} m
                  </Typography>
                </Box>
              </>
            )}
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
                  {hasPump && <TableCell align="right">Margin over NPSHr</TableCell>}
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
          {hasPump
            ? `Judged at LG-L, the worst level — a vessel that only satisfies its pump at normal level cavitates whenever the level controller draws it down.`
            : `Recommended minimum NPSHa margin: ${formatNumber(npsha.recommendedNpshMargin, 2)} m above pump NPSHr. Enter the pump's NPSHr to get a pass/fail instead of a recommendation.`}
        </Typography>

        {/* Recommendation */}
        <Alert severity={getSeverity()}>{npsha.recommendation}</Alert>

        {/* ── Margin sensitivity ────────────────────────────────────────────
            The required margin is CASE DEPENDENT — there is no house standard
            and the calculator must not invent one. What it can do is show the
            consequence of each candidate against the vessel in hand, so the
            choice is made with the outcome visible rather than by inheriting a
            constant. Derived entirely from values already computed above; this
            adds no physics and publishes nothing. */}
        {hasPump && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              What each margin would mean for this vessel
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The required margin depends on the service, the pump, how well the suction friction is
              known and how far the level swings. These are the values in use across the toolbox,
              not a ranking — pick deliberately.
            </Typography>
            <TableContainer sx={{ mt: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Margin</TableCell>
                    <TableCell>Where it comes from</TableCell>
                    <TableCell align="right">Verdict at LG-L</TableCell>
                    <TableCell align="right">Raise vessel by</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marginSensitivity.map((row) => (
                    <TableRow
                      key={row.marginM}
                      sx={row.isSelected ? { backgroundColor: 'action.hover' } : {}}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={row.isSelected ? 'bold' : 'normal'}>
                          {formatNumber(row.marginM, 2)} m{row.isSelected ? ' (selected)' : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {row.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={row.passes ? 'success.main' : 'error.main'}
                        >
                          {row.passes ? 'PASS' : 'FAIL'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={row.passes ? 'text.secondary' : 'error.main'}
                        >
                          {row.passes ? '—' : `+${formatNumber(row.shortfallM, 2)} m`}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              NPSHa is linear in elevation and in suction friction, so &quot;raise vessel by&quot;
              is the shortfall exactly. Cutting the {formatNumber(npsha.frictionLoss, 2)} m friction
              estimate buys the same head metre for metre.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
