'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';

export interface BatchResult {
  fromEffect: number;
  toEffect: number;
  result: SiphonSizingResult;
}

interface BatchResultsTableProps {
  results: BatchResult[];
  pipeSchedule: string;
  onGenerateReport?: (batchResult: BatchResult) => void;
  availableNps?: string[];
  pipeOverrides?: Record<number, string>;
  onPipeOverride?: (siphonIndex: number, nps: string) => void;
}

function getStatusColor(status: 'OK' | 'HIGH' | 'LOW'): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'OK':
      return 'success';
    case 'HIGH':
      return 'error';
    case 'LOW':
      return 'warning';
  }
}

export function BatchResultsTable({
  results,
  pipeSchedule,
  onGenerateReport,
  availableNps,
  pipeOverrides,
  onPipeOverride,
}: BatchResultsTableProps) {
  const canOverride = availableNps && onPipeOverride;

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  fontWeight: 'bold',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                },
              }}
            >
              <TableCell>Siphon</TableCell>
              <TableCell>From → To</TableCell>
              <TableCell>Pipe Size</TableCell>
              <TableCell align="right">Min Height (m)</TableCell>
              <TableCell align="right">Velocity (m/s)</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Flash (%)</TableCell>
              <TableCell align="right">ΔP (mbar)</TableCell>
              <TableCell align="right">Holdup (L)</TableCell>
              {onGenerateReport && <TableCell align="center">Report</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map(({ fromEffect, toEffect, result }, i) => {
              const hasOverride = !!(pipeOverrides && pipeOverrides[i]);

              return (
                <TableRow key={i} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      S-{i + 1}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    E{fromEffect} → E{toEffect}
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    {canOverride ? (
                      <Select
                        value={pipeOverrides?.[i] ?? ''}
                        onChange={(e) => onPipeOverride(i, e.target.value as string)}
                        size="small"
                        variant="standard"
                        displayEmpty
                        sx={{ fontSize: '0.875rem', minWidth: 100 }}
                        renderValue={(val) =>
                          val
                            ? `${val}" Sch ${pipeSchedule}`
                            : `${result.pipe.nps}" Sch ${pipeSchedule}`
                        }
                      >
                        <MenuItem value="">
                          <em>Auto</em>
                        </MenuItem>
                        {availableNps.map((nps) => (
                          <MenuItem key={nps} value={nps}>
                            {nps}&quot; Sch {pipeSchedule}
                          </MenuItem>
                        ))}
                      </Select>
                    ) : result.pipe.nps === 'CUSTOM' ? (
                      `Custom ${result.pipe.id_mm} mm`
                    ) : (
                      `${result.pipe.nps}" Sch ${pipeSchedule}`
                    )}
                    {hasOverride && (
                      <Typography variant="caption" color="warning.main" display="block">
                        overridden
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{result.minimumHeight.toFixed(3)}</TableCell>
                  <TableCell align="right">{result.velocity.toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={result.velocityStatus}
                      color={getStatusColor(result.velocityStatus)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {result.flashOccurs ? (result.flashVaporFraction * 100).toFixed(2) : '0'}
                  </TableCell>
                  <TableCell align="right">
                    {result.pressureDrop.totalPressureDropMbar.toFixed(1)}
                  </TableCell>
                  <TableCell align="right">{result.holdupVolumeLiters.toFixed(1)}</TableCell>
                  {onGenerateReport && (
                    <TableCell align="center">
                      <Tooltip title="Download PDF Report">
                        <IconButton
                          size="small"
                          onClick={() => onGenerateReport({ fromEffect, toEffect, result })}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: 2, borderColor: 'divider' } }}>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell align="right">
                {results.reduce((sum, r) => sum + r.result.minimumHeight, 0).toFixed(3)}
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell align="right">
                {results.reduce((sum, r) => sum + r.result.flashVaporFraction * 100, 0).toFixed(2)}
              </TableCell>
              <TableCell align="right">
                {results
                  .reduce((sum, r) => sum + r.result.pressureDrop.totalPressureDropMbar, 0)
                  .toFixed(1)}
              </TableCell>
              <TableCell align="right">
                {results.reduce((sum, r) => sum + r.result.holdupVolumeLiters, 0).toFixed(1)}
              </TableCell>
              {onGenerateReport && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
