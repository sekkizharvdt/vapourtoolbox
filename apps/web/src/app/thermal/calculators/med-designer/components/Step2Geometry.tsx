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

interface Step2GeometryProps {
  result: MEDDesignerResult;
  // Geometry mode
  geoMode: 'fixed_length' | 'fixed_tubes';
  geoValue: string;
  onGeoModeChange: (v: 'fixed_length' | 'fixed_tubes') => void;
  onGeoValueChange: (v: string) => void;
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
  onGeoModeChange,
  onGeoValueChange,
  onBack,
  onNext,
}: Step2GeometryProps) {
  const detail = result;
  const val = parseFloat(geoValue);
  const hasGeo = !isNaN(val) && val > 0;

  // Compute geometry comparison on the fly
  const geoRows = hasGeo
    ? detail.effects.map((e) => {
        const tubeOD = detail.inputs.tubeOD ?? 25.4;
        const pitch = detail.inputs.tubePitch ?? 33.4;
        const areaPerTubePerM = (Math.PI * tubeOD) / 1000;

        if (geoMode === 'fixed_length') {
          const tubeL = val;
          const tubes = Math.ceil(e.designArea / (areaPerTubePerM * tubeL));
          const instArea = tubes * areaPerTubePerM * tubeL;
          const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
          const shellID = Math.round(Math.sqrt((tubes * pitch * pitch * 4) / Math.PI) * 1.15);
          const tpr = Math.round(shellID / 2 / pitch);
          const minSpray = 0.035 * 2 * tpr * tubeL * 3.6;
          const maxBrine = detail.inputs.maxBrineSalinity ?? 65000;
          const swSal = detail.inputs.seawaterSalinity ?? 35000;
          const feed = (e.distillateFlow * maxBrine) / (maxBrine - swSal);
          const recirc = Math.max(0, minSpray - feed);
          return { effect: e.effect, tubes, tubeLength: tubeL, shellID, instArea, margin, recirc };
        } else {
          const tubes = Math.round(val);
          const tubeL = Math.ceil((e.designArea / (tubes * areaPerTubePerM)) * 10) / 10;
          const instArea = tubes * areaPerTubePerM * tubeL;
          const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
          const shellID = Math.round(Math.sqrt((tubes * pitch * pitch * 4) / Math.PI) * 1.15);
          const tpr = Math.round(shellID / 2 / pitch);
          const minSpray = 0.035 * 2 * tpr * tubeL * 3.6;
          const maxBrine = detail.inputs.maxBrineSalinity ?? 65000;
          const swSal = detail.inputs.seawaterSalinity ?? 35000;
          const feed = (e.distillateFlow * maxBrine) / (maxBrine - swSal);
          const recirc = Math.max(0, minSpray - feed);
          return { effect: e.effect, tubes, tubeLength: tubeL, shellID, instArea, margin, recirc };
        }
      })
    : [];

  const maxShellID = geoRows.length > 0 ? Math.max(...geoRows.map((r) => r.shellID)) : 0;
  const totalArea = geoRows.reduce((s, r) => s + r.instArea, 0);
  const totalRecirc = geoRows.reduce((s, r) => s + r.recirc, 0);

  return (
    <Stack spacing={3}>
      {/* Temperature Profile */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Step 2 — Temperature Profile &amp; Geometry
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {detail.effects.length} effects, GOR {fmt(detail.achievedGOR)}. Non-BPE losses: NEA{' '}
          {detail.effects[0]?.nea}°C + Demister {detail.effects[0]?.demisterLoss}°C + Duct{' '}
          {detail.effects[0]?.pressureDropLoss}°C ={' '}
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
          Fix one parameter — the other varies per effect to match the required area.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Fix"
            value={geoMode}
            onChange={(e) => onGeoModeChange(e.target.value as 'fixed_length' | 'fixed_tubes')}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="fixed_length">Fixed Tube Length</MenuItem>
            <MenuItem value="fixed_tubes">Fixed Tube Count</MenuItem>
          </TextField>
          <TextField
            label={geoMode === 'fixed_length' ? 'Tube Length (m)' : 'Tubes per Effect'}
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
                : `All effects use ${Math.round(val)} tubes. Tube length varies per effect.`}{' '}
              Max Shell ID: {maxShellID} mm
              {maxShellID < 1800 ? ' ⚠ (below 1,800mm man-entry)' : ''} | Total Area:{' '}
              {Math.round(totalArea)} m&sup2; | Total Recirc: {fmt(totalRecirc)} T/h
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
          Back to Configurations
        </Button>
        <Button variant="contained" endIcon={<NextIcon />} onClick={onNext} disabled={!hasGeo}>
          Proceed to Detailed Design
        </Button>
      </Stack>
    </Stack>
  );
}
