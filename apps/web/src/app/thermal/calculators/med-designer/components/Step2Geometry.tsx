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
  // Geometry mode
  geoMode: GeoMode;
  geoValue: string;
  geoUniformFix: UniformFix;
  onGeoModeChange: (v: GeoMode) => void;
  onGeoValueChange: (v: string) => void;
  onGeoUniformFixChange: (v: UniformFix) => void;
  // Navigation
  onBack: () => void;
  onNext: () => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 2: Temperature Profile + Geometry Selection
 *
 * Shows the temperature profile for the selected configuration,
 * lets the user choose fixed tube length or fixed tube count,
 * and shows the resulting per-effect geometry.
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
  const detail = result;
  const val = parseFloat(geoValue);
  const hasGeo = !isNaN(val) && val > 0;

  // For uniform mode: compute tubes and length from average design area
  const tubeODVal = detail.inputs.tubeOD ?? 25.4;
  const areaPerTubePerMVal = (Math.PI * tubeODVal) / 1000;
  const avgDesignArea =
    detail.effects.length > 0
      ? detail.effects.reduce((s, e) => s + e.designArea, 0) / detail.effects.length
      : 0;
  let uniformTubes = 0;
  let uniformLength = 0;
  if (geoMode === 'uniform' && hasGeo) {
    if (geoUniformFix === 'tubes') {
      uniformTubes = Math.round(val);
      uniformLength = Math.ceil((avgDesignArea / (uniformTubes * areaPerTubePerMVal)) * 10) / 10;
    } else {
      uniformLength = val;
      uniformTubes = Math.ceil(avgDesignArea / (areaPerTubePerMVal * uniformLength));
    }
  }

  // Compute geometry comparison on the fly
  const geoRows = hasGeo
    ? detail.effects.map((e) => {
        const tubeOD = detail.inputs.tubeOD ?? 25.4;
        const pitch = detail.inputs.tubePitch ?? 33.4;
        const areaPerTubePerM = (Math.PI * tubeOD) / 1000;

        // Common helper to build a geo row
        // Shell ID from pipeline's bundleGeometry when tube count matches,
        // otherwise estimate for lateral (half-circle) bundle:
        // A half-circle of radius R holds ~N tubes → R ≈ √(2×N×pitch²/π)
        const buildRow = (tubes: number, tubeL: number) => {
          const instArea = tubes * areaPerTubePerM * tubeL;
          const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
          // Use pipeline shell ID if tubes match, otherwise estimate for half-circle
          const pipelineShellID = e.shellODmm - 2 * (detail.inputs.shellThickness ?? 8);
          const shellID =
            tubes === e.tubes
              ? pipelineShellID
              : Math.round(Math.sqrt((2 * tubes * pitch * pitch * 4) / Math.PI) + 100);
          const nRows = e.bundleGeometry?.numberOfRows ?? Math.round(shellID / 2 / (pitch * 0.866));
          const minSpray = 0.035 * 2 * nRows * tubeL * 3.6;
          const maxBrine = detail.inputs.maxBrineSalinity ?? 65000;
          const swSal = detail.inputs.seawaterSalinity ?? 35000;
          const feed = (e.distillateFlow * maxBrine) / (maxBrine - swSal);
          const recirc = Math.max(0, minSpray - feed);
          return {
            effect: e.effect,
            tubes,
            tubeLength: tubeL,
            shellID,
            instArea,
            margin,
            recirc,
            totalSpray: minSpray,
            feed,
          };
        };

        if (geoMode === 'fixed_length') {
          return buildRow(Math.ceil(e.designArea / (areaPerTubePerM * val)), val);
        } else if (geoMode === 'fixed_tubes') {
          const tubeL = Math.ceil((e.designArea / (Math.round(val) * areaPerTubePerM)) * 10) / 10;
          return buildRow(Math.round(val), tubeL);
        } else {
          // Uniform geometry: both tubes and length are the same for all effects
          // Based on average design area — val is tubes or length (user inputs one)
          return buildRow(uniformTubes, uniformLength);
        }
      })
    : [];

  const maxShellID = geoRows.length > 0 ? Math.max(...geoRows.map((r) => r.shellID)) : 0;
  const totalArea = geoRows.reduce((s, r) => s + r.instArea, 0);

  return (
    <Stack spacing={3}>
      {/* Temperature Profile */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Step 2 — Temperature Profile &amp; Geometry
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {detail.effects.length} effects, {detail.preheaters.length} preheaters, GOR{' '}
          {fmt(detail.achievedGOR)}.
          {detail.preheaters.length > 0 && (
            <>
              {' '}
              Spray temp: {fmt(detail.preheaters[detail.preheaters.length - 1]!.swOutlet)}&deg;C
              (after {detail.preheaters.length} PHs).
            </>
          )}{' '}
          Non-BPE losses: NEA {detail.effects[0]?.nea}°C + Demister{' '}
          {detail.effects[0]?.demisterLoss}°C + Duct {detail.effects[0]?.pressureDropLoss}°C ={' '}
          {fmt(
            (detail.effects[0]?.nea ?? 0) +
              (detail.effects[0]?.demisterLoss ?? 0) +
              (detail.effects[0]?.pressureDropLoss ?? 0),
            2
          )}
          °C total.
        </Typography>

        <Table size="small" sx={{ mb: 3 }}>
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
            {detail.effects.map((e) => (
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

      {/* Geometry Input */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Choose Tube Geometry
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {geoMode === 'uniform'
            ? 'All effects use the same tubes and length. Margin varies per effect.'
            : 'Fix one parameter \u2014 the other varies per effect to match the required area.'}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Mode"
            value={geoMode}
            onChange={(e) => onGeoModeChange(e.target.value as GeoMode)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="fixed_length">Fixed Tube Length</MenuItem>
            <MenuItem value="fixed_tubes">Fixed Tube Count</MenuItem>
            <MenuItem value="uniform">Uniform Geometry</MenuItem>
          </TextField>
          {geoMode === 'uniform' && (
            <TextField
              select
              label="Input"
              value={geoUniformFix}
              onChange={(e) => onGeoUniformFixChange(e.target.value as UniformFix)}
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
            sx={{ width: 180 }}
          />
        </Stack>

        {hasGeo && geoRows.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {geoMode === 'fixed_length'
                ? `All effects use ${val}m tubes. Tube count varies per effect.`
                : geoMode === 'fixed_tubes'
                  ? `All effects use ${Math.round(val)} tubes. Tube length varies per effect.`
                  : `All effects use ${uniformTubes} tubes \u00d7 ${uniformLength.toFixed(1)}m. Margin varies per effect.`}{' '}
              Max Shell ID: {maxShellID} mm
              {maxShellID < 1800 ? ' ⚠ (below 1,800mm man-entry)' : ''} | Total Area:{' '}
              {Math.round(totalArea)} m&sup2;
              {(() => {
                const totalSpray = geoRows.reduce((s, r) => s + r.totalSpray, 0);
                const totalFeed = geoRows.reduce((s, r) => s + r.feed, 0);
                const totalRecirc = totalSpray - totalFeed;
                const maxBrine = detail.inputs.maxBrineSalinity ?? 65000;
                const swSal = detail.inputs.seawaterSalinity ?? 35000;
                const blendedTDS =
                  totalFeed + totalRecirc > 0
                    ? Math.round((totalFeed * swSal + totalRecirc * maxBrine) / totalSpray)
                    : swSal;
                return ` | Pump flow: ${fmt(totalSpray)} T/h (make-up ${fmt(totalFeed)} + recirc ${fmt(totalRecirc)}) | Blended TDS: ${blendedTDS.toLocaleString()} ppm`;
              })()}
            </Typography>

            {maxShellID < 1800 && (
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
                {geoRows.map((r) => (
                  <TableRow
                    key={r.effect}
                    sx={{
                      bgcolor: r.shellID === maxShellID ? 'action.selected' : undefined,
                    }}
                  >
                    <TableCell>E{r.effect}</TableCell>
                    <TableCell align="right">{r.tubes}</TableCell>
                    <TableCell align="right">{r.tubeLength.toFixed(1)}</TableCell>
                    <TableCell align="right">
                      {r.shellID}
                      {r.shellID < 1800 ? ' ⚠' : ''}
                    </TableCell>
                    <TableCell align="right">{Math.round(r.instArea)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: r.margin >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600,
                      }}
                    >
                      {r.margin >= 0 ? '+' : ''}
                      {r.margin.toFixed(0)}%
                    </TableCell>
                    <TableCell align="right">{r.totalSpray.toFixed(1)}</TableCell>
                    <TableCell align="right">{r.recirc.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
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
