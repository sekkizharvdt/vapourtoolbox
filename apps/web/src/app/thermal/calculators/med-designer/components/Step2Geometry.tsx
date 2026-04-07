'use client';

import {
  TextField,
  Stack,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  MenuItem,
  Alert,
} from '@mui/material';
import { ArrowBack as BackIcon, ArrowForward as NextIcon } from '@mui/icons-material';
import type { MEDDesignerResult } from '@/lib/thermal';

type GeoMode = 'fixed_length' | 'fixed_tubes' | 'uniform';
type UniformFix = 'tubes' | 'length';

interface Step2GeometryProps {
  result: MEDDesignerResult;
  geoMode: GeoMode;
  geoValue: string;
  geoUniformFix: UniformFix;
  onGeoModeChange: (v: GeoMode) => void;
  onGeoValueChange: (v: string) => void;
  onGeoUniformFixChange: (v: UniformFix) => void;
  onBack: () => void;
  onNext: () => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 2: Temperature Profile + Equipment Geometry
 *
 * Displays the pipeline's computed results directly — no local re-computation.
 * When the user changes tube count/length, the parent's designResult recomputes
 * via the pipeline with overrides, and this component re-renders with new values.
 */
export function Step2Geometry({
  result,
  geoMode,
  geoValue,
  geoUniformFix,
  onGeoModeChange,
  onGeoValueChange,
  onGeoUniformFixChange,
  onBack,
  onNext,
}: Step2GeometryProps) {
  const effects = result.effects;
  const hasEffects = effects.length > 0;
  const hasGeo = !isNaN(parseFloat(geoValue)) && parseFloat(geoValue) > 0;

  // Summary values from pipeline results
  const shellThk = result.inputs.shellThickness ?? 8;
  const maxShellOD = hasEffects ? Math.max(...effects.map((e) => e.shellODmm)) : 0;
  const maxShellID = maxShellOD - 2 * shellThk;
  const totalArea = effects.reduce((s, e) => s + e.installedArea, 0);
  const totalRecirc = effects.reduce((s, e) => s + e.brineRecirculation, 0);
  const totalSpray = effects.reduce((s, e) => s + e.minSprayFlow, 0);

  return (
    <Stack spacing={3}>
      {/* Temperature Profile — from pipeline H&M balance */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Temperature Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {effects.length} effects, {result.preheaters.length} preheaters, GOR{' '}
          {fmt(result.achievedGOR)}.
          {result.preheaters.length > 0 && (
            <>
              {' '}
              Feed temp: {fmt(result.preheaters[result.preheaters.length - 1]!.swOutlet)}&deg;C
              (after {result.preheaters.length} PHs).
            </>
          )}{' '}
          Non-BPE losses: NEA {effects[0]?.nea}&deg;C + Demister {effects[0]?.demisterLoss}&deg;C +
          Duct {effects[0]?.pressureDropLoss}&deg;C ={' '}
          {fmt(
            (effects[0]?.nea ?? 0) +
              (effects[0]?.demisterLoss ?? 0) +
              (effects[0]?.pressureDropLoss ?? 0),
            2
          )}
          &deg;C total.
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Effect</TableCell>
              <TableCell align="right">Vap In (&deg;C)</TableCell>
              <TableCell align="right">Brine (&deg;C)</TableCell>
              <TableCell align="right">BPE (&deg;C)</TableCell>
              <TableCell align="right">Vap Out (&deg;C)</TableCell>
              <TableCell align="right">Work &Delta;T (&deg;C)</TableCell>
              <TableCell align="right">U (W/m&sup2;&middot;K)</TableCell>
              <TableCell align="right">Spray T (&deg;C)</TableCell>
              <TableCell align="right">Duty (kW)</TableCell>
              <TableCell align="right">Req. Area (m&sup2;)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {effects.map((e) => (
              <TableRow key={e.effect}>
                <TableCell>
                  E{e.effect}
                  {e.hasVapourLanes ? ' *' : ''}
                </TableCell>
                <TableCell align="right">{fmt(e.incomingVapourTemp)}</TableCell>
                <TableCell align="right">{fmt(e.brineTemp)}</TableCell>
                <TableCell align="right">{fmt(e.bpe, 2)}</TableCell>
                <TableCell align="right">{fmt(e.vapourOutTemp)}</TableCell>
                <TableCell align="right">{fmt(e.workingDeltaT, 2)}</TableCell>
                <TableCell align="right">{Math.round(e.overallU)}</TableCell>
                <TableCell align="right">{fmt(e.sprayTemp)}&deg;C</TableCell>
                <TableCell align="right">{Math.round(e.duty)}</TableCell>
                <TableCell align="right">{Math.round(e.requiredArea)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Geometry Controls */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Equipment Geometry
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Adjust tube count or length. The design recomputes automatically with your selection.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Mode"
            value={geoMode}
            onChange={(e) => onGeoModeChange(e.target.value as GeoMode)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="fixed_tubes">Fixed Tube Count</MenuItem>
            <MenuItem value="fixed_length">Fixed Tube Length</MenuItem>
            <MenuItem value="uniform">Uniform Geometry</MenuItem>
          </TextField>
          {geoMode === 'uniform' && (
            <TextField
              select
              label="Input"
              value={geoUniformFix}
              onChange={(e) => onGeoUniformFixChange(e.target.value as UniformFix)}
              size="small"
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="tubes">Tubes</MenuItem>
              <MenuItem value="length">Length</MenuItem>
            </TextField>
          )}
          <TextField
            label={
              geoMode === 'fixed_length'
                ? 'Tube Length (m)'
                : geoMode === 'fixed_tubes'
                  ? 'Tubes per Effect'
                  : geoUniformFix === 'tubes'
                    ? 'Tubes per Effect'
                    : 'Tube Length (m)'
            }
            value={geoValue}
            onChange={(e) => onGeoValueChange(e.target.value)}
            type="number"
            size="small"
            sx={{ width: 180 }}
          />
        </Stack>

        {/* Equipment table — directly from pipeline results */}
        {hasGeo && hasEffects && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Shell ID: {maxShellID} mm{maxShellID < 1800 ? ' \u26A0' : ''} | Total Area:{' '}
              {Math.round(totalArea)} m&sup2; | Spray: {fmt(totalSpray)} T/h (recirc{' '}
              {fmt(totalRecirc)})
            </Typography>

            {maxShellID > 0 && maxShellID < 1800 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Shell ID {maxShellID} mm is below 1,800 mm minimum for person entry during
                maintenance.
              </Alert>
            )}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Effect</TableCell>
                  <TableCell align="right">Tubes</TableCell>
                  <TableCell align="right">Tube L (m)</TableCell>
                  <TableCell align="right">Shell ID (mm)</TableCell>
                  <TableCell align="right">Inst. Area (m&sup2;)</TableCell>
                  <TableCell align="right">Margin</TableCell>
                  <TableCell align="right">Spray (T/h)</TableCell>
                  <TableCell align="right">Recirc (T/h)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effects.map((e) => {
                  const eShellID = e.shellODmm - 2 * shellThk;
                  return (
                    <TableRow key={e.effect}>
                      <TableCell>E{e.effect}</TableCell>
                      <TableCell align="right">{e.tubes}</TableCell>
                      <TableCell align="right">{e.tubeLength.toFixed(1)}</TableCell>
                      <TableCell align="right">
                        {eShellID}
                        {eShellID < 1800 ? ' \u26A0' : ''}
                      </TableCell>
                      <TableCell align="right">{Math.round(e.installedArea)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: e.areaMargin >= 0 ? 'success.main' : 'error.main',
                          fontWeight: 600,
                        }}
                      >
                        {e.areaMargin >= 0 ? '+' : ''}
                        {e.areaMargin.toFixed(0)}%
                      </TableCell>
                      <TableCell align="right">{fmt(e.minSprayFlow)}</TableCell>
                      <TableCell align="right">{fmt(e.brineRecirculation)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>

      {/* Navigation */}
      <Stack direction="row" justifyContent="space-between">
        <Button startIcon={<BackIcon />} onClick={onBack}>
          Back to Design Inputs
        </Button>
        <Button variant="contained" endIcon={<NextIcon />} onClick={onNext} disabled={!hasGeo}>
          Proceed to Detailed Design
        </Button>
      </Stack>
    </Stack>
  );
}
