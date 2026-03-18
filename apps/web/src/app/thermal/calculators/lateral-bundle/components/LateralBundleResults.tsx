'use client';

import {
  Paper,
  Typography,
  Card,
  CardContent,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Box,
} from '@mui/material';
import type { TubeBundleGeometryResult } from '@/lib/thermal';

interface LateralBundleResultsProps {
  result: TubeBundleGeometryResult;
  tubeOD: number;
  tubeLength: number;
}

function fmt(val: number, decimals = 2): string {
  return val.toFixed(decimals);
}

export function LateralBundleResults({ result, tubeOD, tubeLength }: LateralBundleResultsProps) {
  const totalArea = result.totalTubes * Math.PI * (tubeOD / 1000) * tubeLength;

  return (
    <Stack spacing={3}>
      {/* === Primary Result: Tube Count === */}
      <Card variant="outlined" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Total Tubes
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.totalTubes}</Typography>
            <Typography variant="h6">tubes</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            {result.numberOfRows} rows &nbsp;|&nbsp; Surface area: {fmt(totalArea, 1)} m&sup2;
          </Typography>
        </CardContent>
      </Card>

      {/* === Warnings === */}
      {result.warnings.length > 0 && (
        <Alert severity="warning">
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* === Bundle Dimensions === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Bundle Dimensions
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Bundle Width</TableCell>
              <TableCell align="right">{fmt(result.bundleWidthMM, 1)} mm</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Bundle Height</TableCell>
              <TableCell align="right">{fmt(result.bundleHeightMM, 1)} mm</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Heat Transfer Area</TableCell>
              <TableCell align="right">{fmt(totalArea, 2)} m&sup2;</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Area per Meter</TableCell>
              <TableCell align="right">{fmt(result.areaPerMeter, 3)} m&sup2;/m</TableCell>
            </TableRow>
            {result.tubesRemovedByLanes > 0 && (
              <TableRow>
                <TableCell>Tubes Removed by Vapour Lanes</TableCell>
                <TableCell align="right">{result.tubesRemovedByLanes}</TableCell>
              </TableRow>
            )}
            {result.tubesRemovedByExclusions > 0 && (
              <TableRow>
                <TableCell>Tubes Removed by Nozzle Exclusions</TableCell>
                <TableCell align="right">{result.tubesRemovedByExclusions}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* === Row-by-Row Distribution === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Row-by-Row Tube Count
        </Typography>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Row</TableCell>
                <TableCell align="right">Tubes</TableCell>
                <TableCell align="right">Y (mm)</TableCell>
                <TableCell align="center">Staggered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.row}>
                  <TableCell>{row.row + 1}</TableCell>
                  <TableCell align="right">{row.tubeCount}</TableCell>
                  <TableCell align="right">{fmt(row.y, 1)}</TableCell>
                  <TableCell align="center">{row.isStaggered ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
}
