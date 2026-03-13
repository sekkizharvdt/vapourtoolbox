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
} from '@mui/material';
import {
  STRAINER_TYPE_LABELS,
  type StrainerSizingResult,
} from '@/lib/thermal/strainerSizingCalculator';

export interface BatchStrainerResult {
  tag: string;
  result: StrainerSizingResult;
}

interface BatchResultsTableProps {
  results: BatchStrainerResult[];
}

export function BatchResultsTable({ results }: BatchResultsTableProps) {
  if (results.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', mt: 2 }}>
        <Typography variant="body1" color="text.secondary">
          Enter flow rates above to see results
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Tag</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Line</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Mesh (mm)
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Pipe Vel. (m/s)
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                &Delta;P Clean (bar)
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                &Delta;P 50% (bar)
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((r) => {
              const hasWarnings = r.result.warnings.length > 0;
              return (
                <TableRow key={r.tag}>
                  <TableCell>{r.tag}</TableCell>
                  <TableCell>
                    {STRAINER_TYPE_LABELS[r.result.strainerType].replace(' Strainer', '')}
                  </TableCell>
                  <TableCell>{r.result.lineSize}&quot;</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.result.meshSizeMm}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.result.pipeVelocity.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.result.totalPressureDropClean.toFixed(4)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.result.totalPressureDropClogged.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={hasWarnings ? 'Warning' : 'OK'}
                      size="small"
                      color={hasWarnings ? 'warning' : 'success'}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
