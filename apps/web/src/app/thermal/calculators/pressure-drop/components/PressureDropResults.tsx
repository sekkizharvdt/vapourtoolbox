'use client';

import {
  Paper,
  Typography,
  Grid,
  Alert,
  Stack,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { FITTING_NAMES, type FittingCount } from '@/lib/thermal';

interface PressureDropResult {
  velocity: number;
  reynoldsNumber: number;
  flowRegime: string;
  frictionFactor: number;
  straightPipeLoss: number;
  fittingsLoss: number;
  elevationHead: number;
  totalPressureDropMH2O: number;
  totalPressureDropBar: number;
  totalPressureDropMbar: number;
  totalPressureDropKPa: number;
  totalKFactor: number;
  equivalentLength: number;
  warnings: string[];
  fittingsBreakdown: Array<{
    type: string;
    count: number;
    kFactor: number;
    loss: number;
  }>;
}

interface PressureDropResultsProps {
  result: PressureDropResult | null;
  pipeLength: string;
  fittings: FittingCount[];
  elevationChange: string;
  error: string | null;
}

export function PressureDropResults({
  result,
  pipeLength,
  fittings,
  elevationChange,
  error,
}: PressureDropResultsProps) {
  if (!result) {
    if (error) return null;
    return (
      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          bgcolor: 'action.hover',
          border: '2px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Enter parameters to calculate pressure drop
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Results will update automatically
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Results
      </Typography>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      {/* Main Result */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Total Pressure Drop
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.totalPressureDropMH2O.toFixed(2)}</Typography>
            <Typography variant="h6">m H₂O</Typography>
          </Stack>
          <Stack direction="row" spacing={2} mt={1}>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              = {result.totalPressureDropBar.toFixed(4)} bar
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              = {result.totalPressureDropMbar.toFixed(1)} mbar
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              = {result.totalPressureDropKPa.toFixed(2)} kPa
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Velocity
              </Typography>
              <Typography variant="h6">{result.velocity.toFixed(2)}</Typography>
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
              <Typography variant="h6">
                {result.reynoldsNumber > 10000
                  ? (result.reynoldsNumber / 1000).toFixed(1) + 'k'
                  : result.reynoldsNumber.toFixed(0)}
              </Typography>
              <Typography variant="caption">{result.flowRegime}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Friction Factor
              </Typography>
              <Typography variant="h6">{result.frictionFactor.toFixed(4)}</Typography>
              <Typography variant="caption">Darcy</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Total K
              </Typography>
              <Typography variant="h6">{result.totalKFactor.toFixed(2)}</Typography>
              <Typography variant="caption">
                ({result.equivalentLength.toFixed(1)} m eq.)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Loss Components */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Component</TableCell>
              <TableCell align="right">Loss (m H₂O)</TableCell>
              <TableCell align="right">%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Straight Pipe ({pipeLength} m)</TableCell>
              <TableCell align="right">{result.straightPipeLoss.toFixed(3)}</TableCell>
              <TableCell align="right">
                {((result.straightPipeLoss / result.totalPressureDropMH2O) * 100).toFixed(1)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                Fittings ({fittings.reduce((sum, f) => sum + f.count, 0)} items)
              </TableCell>
              <TableCell align="right">{result.fittingsLoss.toFixed(3)}</TableCell>
              <TableCell align="right">
                {((result.fittingsLoss / result.totalPressureDropMH2O) * 100).toFixed(1)}
              </TableCell>
            </TableRow>
            {result.elevationHead !== 0 && (
              <TableRow>
                <TableCell>Elevation ({elevationChange} m)</TableCell>
                <TableCell align="right">{result.elevationHead.toFixed(3)}</TableCell>
                <TableCell align="right">
                  {((result.elevationHead / result.totalPressureDropMH2O) * 100).toFixed(1)}
                </TableCell>
              </TableRow>
            )}
            <TableRow sx={{ fontWeight: 'bold' }}>
              <TableCell>
                <strong>Total</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{result.totalPressureDropMH2O.toFixed(3)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>100</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Fittings Breakdown */}
      {result.fittingsBreakdown.length > 0 && (
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Fittings Breakdown</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fitting</TableCell>
                    <TableCell align="center">Count</TableCell>
                    <TableCell align="right">K</TableCell>
                    <TableCell align="right">Loss (m)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.fittingsBreakdown.map((fb) => (
                    <TableRow key={fb.type}>
                      <TableCell>{FITTING_NAMES[fb.type as keyof typeof FITTING_NAMES]}</TableCell>
                      <TableCell align="center">{fb.count}</TableCell>
                      <TableCell align="right">{fb.kFactor.toFixed(2)}</TableCell>
                      <TableCell align="right">{fb.loss.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
}
