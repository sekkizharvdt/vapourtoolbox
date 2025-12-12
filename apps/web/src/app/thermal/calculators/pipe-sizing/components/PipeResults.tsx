'use client';

import {
  Paper,
  Typography,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import type { PipeSizingResult } from './types';
import { getVelocityStatusIcon, getVelocityStatusColor } from './VelocityStatus';

interface PipeResultsProps {
  result: PipeSizingResult;
  minVelocity: string;
  maxVelocity: string;
}

export function PipeResults({ result, minVelocity, maxVelocity }: PipeResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {result.mode === 'size_by_flow' ? 'Recommended Pipe Size' : 'Velocity Check Result'}
      </Typography>

      {/* Main Result Card */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderColor: getVelocityStatusColor(result.velocityStatus),
          borderWidth: 2,
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            {getVelocityStatusIcon(result.velocityStatus)}
            <Typography variant="h4">{result.pipe.nps}&quot; Sch 40</Typography>
            <Chip
              label={result.velocityStatus}
              color={
                result.velocityStatus === 'OK'
                  ? 'success'
                  : result.velocityStatus === 'HIGH'
                    ? 'error'
                    : 'warning'
              }
              size="small"
            />
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Nominal Diameter
              </Typography>
              <Typography variant="body1">DN{result.pipe.dn}</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Inner Diameter
              </Typography>
              <Typography variant="body1">{result.pipe.id_mm.toFixed(1)} mm</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Flow Area
              </Typography>
              <Typography variant="body1">{(result.pipe.area_mm2 / 1e6).toFixed(6)} m²</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Actual Velocity
              </Typography>
              <Typography
                variant="body1"
                fontWeight="bold"
                color={getVelocityStatusColor(result.velocityStatus)}
              >
                {result.velocity.toFixed(2)} m/s
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alternatives (size by flow mode) */}
      {result.mode === 'size_by_flow' && result.alternatives.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Alternative Sizes
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Size</TableCell>
                  <TableCell align="right">ID (mm)</TableCell>
                  <TableCell align="right">Velocity (m/s)</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.alternatives.map((alt) => (
                  <TableRow key={alt.nps}>
                    <TableCell>
                      {alt.nps}&quot; (DN{alt.dn})
                    </TableCell>
                    <TableCell align="right">{alt.id_mm.toFixed(1)}</TableCell>
                    <TableCell align="right">{alt.velocity.toFixed(2)}</TableCell>
                    <TableCell align="center">{getVelocityStatusIcon(alt.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Velocity Guideline */}
      <Alert
        severity={
          result.velocityStatus === 'OK'
            ? 'success'
            : result.velocityStatus === 'HIGH'
              ? 'error'
              : 'warning'
        }
      >
        {result.velocityStatus === 'OK' && (
          <>
            Velocity is within acceptable range ({minVelocity} - {maxVelocity} m/s)
          </>
        )}
        {result.velocityStatus === 'HIGH' && (
          <>
            Velocity exceeds maximum limit ({maxVelocity} m/s). Consider using a larger pipe size to
            reduce erosion risk.
          </>
        )}
        {result.velocityStatus === 'LOW' && (
          <>
            Velocity below minimum limit ({minVelocity} m/s). Consider using a smaller pipe size to
            prevent solids settling.
          </>
        )}
      </Alert>
    </Paper>
  );
}
