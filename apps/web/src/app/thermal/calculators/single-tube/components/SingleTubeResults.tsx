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
  Divider,
  Chip,
  Box,
} from '@mui/material';
import type { SingleTubeResult } from '@vapour/types';
import { SINGLE_TUBE_MATERIAL_LABELS } from '@/lib/thermal';

interface SingleTubeResultsProps {
  result: SingleTubeResult;
}

function fmt(val: number, decimals = 2): string {
  return val.toFixed(decimals);
}

function fmtSci(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) < 0.001 || Math.abs(val) > 99999) return val.toExponential(3);
  return val.toFixed(4);
}

const wettingColors: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  excellent: 'success',
  good: 'info',
  marginal: 'warning',
  poor: 'error',
};

export function SingleTubeResults({ result }: SingleTubeResultsProps) {
  const hmb = result.heatMassBalance;

  return (
    <Stack spacing={3}>
      {/* === Primary Result: Heat Duty === */}
      <Card variant="outlined" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Heat Duty (per tube)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{fmt(hmb.heatDuty, 3)}</Typography>
            <Typography variant="h6">kW</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Overall U = {fmt(result.overallHTC, 1)} W/(m&sup2;&middot;K) &nbsp;|&nbsp; &Delta;T eff
            = {fmt(result.effectiveDeltaT, 1)}&deg;C
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

      {/* === Tube Geometry === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Tube Geometry
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Material</TableCell>
              <TableCell align="right">
                {SINGLE_TUBE_MATERIAL_LABELS[result.inputs.tubeMaterial]}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Dimensions</TableCell>
              <TableCell align="right">
                {fmt(result.inputs.tubeOD, 1)} OD &times; {fmt(result.inputs.wallThickness, 1)} mm
                wall (ID = {fmt(result.tubeID, 1)} mm)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Tube Length</TableCell>
              <TableCell align="right">{fmt(result.inputs.tubeLength, 2)} m</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Outer Surface Area</TableCell>
              <TableCell align="right">{fmt(result.outerSurfaceArea, 4)} m&sup2;</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Wall Conductivity</TableCell>
              <TableCell align="right">{fmt(result.wallConductivity, 1)} W/(m&middot;K)</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* === Film Analysis === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Film Analysis
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell align="right">Inside (Condensation)</TableCell>
              <TableCell align="right">Outside (Evaporation)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Film Thickness</TableCell>
              <TableCell align="right">{fmtSci(result.insideFilm.filmThickness)} mm</TableCell>
              <TableCell align="right">{fmtSci(result.outsideFilm.filmThickness)} mm</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Film Reynolds</TableCell>
              <TableCell align="right">{fmt(result.insideFilm.reynoldsNumber, 0)}</TableCell>
              <TableCell align="right">{fmt(result.outsideFilm.reynoldsNumber, 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Flow Regime</TableCell>
              <TableCell align="right">{result.insideFilm.flowRegime}</TableCell>
              <TableCell align="right">{result.outsideFilm.flowRegime}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>HTC</TableCell>
              <TableCell align="right">
                {fmt(result.insideFilm.htc, 1)} W/(m&sup2;&middot;K)
              </TableCell>
              <TableCell align="right">
                {fmt(result.outsideFilm.htc, 1)} W/(m&sup2;&middot;K)
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* === Thermal Resistance Breakdown === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Thermal Resistance Breakdown
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Inside convection (ref. to OD)</TableCell>
              <TableCell align="right">{fmtSci(result.insideFouling)} m&sup2;&middot;K/W</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Inside fouling</TableCell>
              <TableCell align="right">{fmtSci(result.insideFouling)} m&sup2;&middot;K/W</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Tube wall</TableCell>
              <TableCell align="right">
                {fmtSci(result.wallResistance)} m&sup2;&middot;K/W
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Outside fouling</TableCell>
              <TableCell align="right">
                {fmtSci(result.outsideFouling)} m&sup2;&middot;K/W
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Outside convection</TableCell>
              <TableCell align="right">
                {fmtSci(1 / result.outsideFilm.htc)} m&sup2;&middot;K/W
              </TableCell>
            </TableRow>
            <TableRow sx={{ fontWeight: 'bold' }}>
              <TableCell>
                <strong>Overall U (based on OD)</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{fmt(result.overallHTC, 1)} W/(m&sup2;&middot;K)</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* === Wetting Analysis === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Wetting Analysis (Outside)
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Wetting Rate (&Gamma;)</TableCell>
              <TableCell align="right">{fmtSci(result.wettingRate)} kg/(m&middot;s)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Min. Wetting Rate (&Gamma;min)</TableCell>
              <TableCell align="right">
                {fmtSci(result.minimumWettingRate)} kg/(m&middot;s)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Wetting Ratio (&Gamma;/&Gamma;min)</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  <span>{fmt(result.wettingRatio)}</span>
                  <Chip
                    label={result.wettingStatus}
                    size="small"
                    color={wettingColors[result.wettingStatus]}
                  />
                </Stack>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* === Heat & Mass Balance === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Heat &amp; Mass Balance
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Heat Duty</TableCell>
              <TableCell align="right">{fmt(hmb.heatDuty, 3)} kW</TableCell>
            </TableRow>
            <Divider component="tr" />
            <TableRow>
              <TableCell>
                <strong>Inside (Condensation)</strong>
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Vapour Condensed</TableCell>
              <TableCell align="right">
                {fmtSci(hmb.vapourCondensed)} kg/s ({fmt(hmb.vapourCondensed * 3600, 2)} kg/h)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Latent Heat</TableCell>
              <TableCell align="right">{fmt(hmb.latentHeatCondensation, 1)} kJ/kg</TableCell>
            </TableRow>
            <Divider component="tr" />
            <TableRow>
              <TableCell>
                <strong>Outside (Evaporation)</strong>
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Water Evaporated</TableCell>
              <TableCell align="right">
                {fmtSci(hmb.waterEvaporated)} kg/s ({fmt(hmb.waterEvaporated * 3600, 2)} kg/h)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Brine Out</TableCell>
              <TableCell align="right">{fmt(hmb.brineOut * 3600, 2)} kg/h</TableCell>
            </TableRow>
            {hmb.brineOutSalinity > 0 && (
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Brine Salinity</TableCell>
                <TableCell align="right">{fmt(hmb.brineOutSalinity, 0)} ppm</TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Latent Heat</TableCell>
              <TableCell align="right">{fmt(hmb.latentHeatEvaporation, 1)} kJ/kg</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {result.boilingPointElevation > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              BPE = {fmt(result.boilingPointElevation, 2)}&deg;C &nbsp;|&nbsp; Effective &Delta;T ={' '}
              {fmt(result.effectiveDeltaT, 2)}&deg;C
            </Typography>
          </Box>
        )}
      </Paper>

      {/* === Design Check === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Design Check
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Required Area</TableCell>
              <TableCell align="right">{fmt(result.requiredArea, 4)} m&sup2;</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Installed Area</TableCell>
              <TableCell align="right">{fmt(result.outerSurfaceArea, 4)} m&sup2;</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Excess Area</TableCell>
              <TableCell align="right">{fmt(result.excessArea, 1)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
