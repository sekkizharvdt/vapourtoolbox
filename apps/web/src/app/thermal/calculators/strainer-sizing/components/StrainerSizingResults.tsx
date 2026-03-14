'use client';

import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  STRAINER_TYPE_LABELS,
  type StrainerSizingResult,
} from '@/lib/thermal/strainerSizingCalculator';

interface StrainerSizingResultsProps {
  result: StrainerSizingResult;
}

export function StrainerSizingResults({ result }: StrainerSizingResultsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Strainer Sizing Results
      </Typography>

      {/* Primary result: Mesh Size */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {result.isRecommendedMesh ? 'Recommended Mesh Size' : 'Selected Mesh Size'}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.meshSizeMm}</Typography>
            <Typography variant="h6">mm</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Mesh #{result.meshNumber} &mdash; {result.meshDescription}
          </Typography>
          {!result.isRecommendedMesh && (
            <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
              (User override &mdash; differs from recommendation)
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Mesh Comparison Table */}
      {result.meshComparison.length > 1 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Mesh Size Comparison
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>Mesh</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>
                    Opening
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>
                    Screen Vel.
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>
                    &Delta;P Clean
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>
                    &Delta;P 50%
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.meshComparison.map((entry) => (
                  <TableRow
                    key={entry.meshIndex}
                    sx={{
                      bgcolor: entry.isSelected ? 'action.selected' : undefined,
                      fontWeight: entry.isSelected ? 'bold' : 'normal',
                    }}
                  >
                    <TableCell sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                      #{entry.mesh.meshNumber}
                      {entry.isSelected && (
                        <Chip label="Selected" size="small" color="primary" sx={{ ml: 1 }} />
                      )}
                      {entry.isRecommended && !entry.isSelected && (
                        <Chip label="Recommended" size="small" variant="outlined" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                      {entry.mesh.openingMm} mm
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                      {entry.screenVelocityClean.toFixed(2)} m/s
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                      {entry.totalPressureDropClean.toFixed(4)} bar
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        py: 0.5,
                        fontFamily: 'monospace',
                        color: entry.totalPressureDropClogged > 1.0 ? 'error.main' : undefined,
                      }}
                    >
                      {entry.totalPressureDropClogged.toFixed(4)} bar
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Finer meshes (higher #) have smaller openings, higher velocity, and higher pressure
              drop.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* Pressure Drop Comparison */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Pressure Drop Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Clean Condition
                  </Typography>
                  <Typography variant="h5">{result.totalPressureDropClean.toFixed(3)}</Typography>
                  <Typography variant="caption">bar</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    50% Clogged
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {result.totalPressureDropClogged.toFixed(3)}
                  </Typography>
                  <Typography variant="caption">bar</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Pressure Drop Breakdown
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5, fontWeight: 'bold' }} colSpan={3}>
                  Clean Condition
                </TableCell>
              </TableRow>
              {[
                {
                  label: 'Body Loss',
                  value: result.bodyPressureDrop,
                },
                {
                  label: 'Screen Loss',
                  value: result.screenPressureDropClean,
                },
                {
                  label: 'Total',
                  value: result.totalPressureDropClean,
                  bold: true,
                },
              ].map((row) => (
                <TableRow key={`clean-${row.label}`}>
                  <TableCell sx={{ border: 0, py: 0.5, pl: 3 }}>{row.label}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      border: 0,
                      py: 0.5,
                      fontFamily: 'monospace',
                      fontWeight: row.bold ? 'bold' : 'normal',
                    }}
                  >
                    {row.value.toFixed(4)} bar
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5, fontWeight: 'bold', pt: 2 }} colSpan={3}>
                  50% Clogged Condition
                </TableCell>
              </TableRow>
              {[
                {
                  label: 'Body Loss',
                  value: result.bodyPressureDrop,
                },
                {
                  label: 'Screen Loss',
                  value: result.screenPressureDropClogged,
                },
                {
                  label: 'Total',
                  value: result.totalPressureDropClogged,
                  bold: true,
                },
              ].map((row) => (
                <TableRow key={`clogged-${row.label}`}>
                  <TableCell sx={{ border: 0, py: 0.5, pl: 3 }}>{row.label}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      border: 0,
                      py: 0.5,
                      fontFamily: 'monospace',
                      fontWeight: row.bold ? 'bold' : 'normal',
                    }}
                  >
                    {row.value.toFixed(4)} bar
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Flow & Geometry Data */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Pipe Velocity
              </Typography>
              <Typography variant="h6">{result.pipeVelocity.toFixed(2)}</Typography>
              <Typography variant="caption">m/s</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Screen Vel. (Clean)
              </Typography>
              <Typography variant="h6">{result.screenVelocityClean.toFixed(2)}</Typography>
              <Typography variant="caption">m/s</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Screen Vel. (50%)
              </Typography>
              <Typography variant="h6" color="warning.main">
                {result.screenVelocityClogged.toFixed(2)}
              </Typography>
              <Typography variant="caption">m/s</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Reynolds No.
              </Typography>
              <Typography variant="h6">{result.reynoldsNumber.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Strainer Geometry */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Strainer Geometry
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip
              label={STRAINER_TYPE_LABELS[result.strainerType]}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip label={`NPS ${result.lineSize}"`} size="small" variant="outlined" />
            <Chip label={`K = ${result.bodyKFactor}`} size="small" variant="outlined" />
          </Stack>
          <Table size="small">
            <TableBody>
              {[
                { label: 'Pipe ID', value: `${result.pipeIdMm.toFixed(1)} mm` },
                { label: 'Pipe Area', value: `${result.pipeAreaMm2.toFixed(1)} mm\u00B2` },
                { label: 'Screen Area', value: `${result.screenAreaMm2.toFixed(1)} mm\u00B2` },
                {
                  label: 'Open Area (Clean)',
                  value: `${result.effectiveOpenAreaClean.toFixed(1)} mm\u00B2 (${(result.screenOpenAreaRatio * 100).toFixed(0)}% open)`,
                },
              ].map((row) => (
                <TableRow key={row.label}>
                  <TableCell sx={{ border: 0, py: 0.5 }}>{row.label}</TableCell>
                  <TableCell align="right" sx={{ border: 0, py: 0.5, fontFamily: 'monospace' }}>
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Paper>
  );
}
