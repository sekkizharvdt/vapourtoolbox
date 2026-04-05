'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { SaveCalculationDialog } from '../components/SaveCalculationDialog';
import { LoadCalculationDialog } from '../components/LoadCalculationDialog';
import {
  calculateMED,
  type MEDEngineInput,
  type MEDEngineResult,
} from '@/lib/thermal/med/medEngine';
import MEDEffectBalanceTable from './MEDEffectBalanceTable';

// ============================================================================
// Component
// ============================================================================

export default function MEDPlantClient() {
  // ---- Primary inputs ----
  const [steamFlow, setSteamFlow] = useState('790'); // kg/hr
  const [steamTemp, setSteamTemp] = useState('57'); // °C
  const [swTemp, setSwTemp] = useState('30'); // °C
  const [swSalinity, setSwSalinity] = useState('35000'); // ppm
  const [maxBrineSalinity, setMaxBrineSalinity] = useState('59500'); // ppm
  const [numberOfEffects, setNumberOfEffects] = useState('6');

  // ---- Condenser ----
  const [condenserApproach, setCondenserApproach] = useState('4'); // °C
  const [condenserOutletTemp, setCondenserOutletTemp] = useState(''); // °C, blank = auto

  // ---- Preheaters (checkboxes for which effects have preheaters) ----
  const [preheaterEffects, setPreheaterEffects] = useState<number[]>([]);

  // ---- TVC ----
  const [tvcEnabled, setTvcEnabled] = useState(false);
  const [tvcMotivePressure, setTvcMotivePressure] = useState('10'); // bar abs
  const [tvcEntrainedEffect, setTvcEntrainedEffect] = useState(''); // blank = last effect

  // ---- Save/Load ----
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // ---- Number of effects as integer ----
  const nEff = parseInt(numberOfEffects) || 6;

  // ---- Toggle preheater for an effect ----
  const togglePreheater = (effNum: number) => {
    setPreheaterEffects((prev) =>
      prev.includes(effNum)
        ? prev.filter((e) => e !== effNum)
        : [...prev, effNum].sort((a, b) => a - b)
    );
  };

  // ---- Reset ----
  const handleReset = () => {
    setSteamFlow('790');
    setSteamTemp('57');
    setSwTemp('30');
    setSwSalinity('35000');
    setMaxBrineSalinity('59500');
    setNumberOfEffects('6');
    setCondenserApproach('4');
    setCondenserOutletTemp('');
    setPreheaterEffects([]);
    setTvcEnabled(false);
    setTvcMotivePressure('10');
    setTvcEntrainedEffect('');
  };

  // ---- Live calculation ----
  const computed = useMemo<{ result: MEDEngineResult | null; error: string | null }>(() => {
    try {
      const sf = parseFloat(steamFlow);
      const st = parseFloat(steamTemp);
      const sw = parseFloat(swTemp);
      const sal = parseFloat(swSalinity);
      const maxBrine = parseFloat(maxBrineSalinity);
      const n = parseInt(numberOfEffects);
      const ca = parseFloat(condenserApproach);

      if ([sf, st, sw, sal, maxBrine].some((v) => isNaN(v) || v <= 0))
        return { result: null, error: null };
      if (isNaN(n) || n < 2 || n > 16) return { result: null, error: null };

      const input: MEDEngineInput = {
        steamFlow: sf,
        steamTemperature: st,
        numberOfEffects: n,
        seawaterInletTemp: sw,
        seawaterSalinity: sal,
        maxBrineSalinity: maxBrine,
        condenserApproach: isNaN(ca) ? 4 : ca,
        ...(condenserOutletTemp && { condenserOutletTemp: parseFloat(condenserOutletTemp) }),
        ...(preheaterEffects.length > 0 && { preheaterEffects }),
        ...(tvcEnabled && {
          tvcMotivePressure: parseFloat(tvcMotivePressure) || 10,
          ...(tvcEntrainedEffect && { tvcEntrainedEffect: parseInt(tvcEntrainedEffect) }),
        }),
      };

      return { result: calculateMED(input), error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    steamFlow,
    steamTemp,
    swTemp,
    swSalinity,
    maxBrineSalinity,
    numberOfEffects,
    condenserApproach,
    condenserOutletTemp,
    preheaterEffects,
    tvcEnabled,
    tvcMotivePressure,
    tvcEntrainedEffect,
  ]);

  const result = computed.result;
  const error = computed.error;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="MED Process Calculator" />

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            MED Process Calculator
          </Typography>
          <Chip label="Heat &amp; Mass Balance" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 800 }}>
          Calculate the thermodynamic heat and mass balance for a Multi-Effect Distillation plant.
          Enter the steam supply conditions and the calculator will determine GOR, distillate
          production, and per-effect balance. Add preheaters to see the effect on performance.
        </Typography>
        <Alert severity="info" sx={{ mt: 1 }}>
          This calculator computes the <strong>process thermodynamics only</strong> — the heat and
          mass balance across effects, condenser, and preheaters. It does not size equipment (tubes,
          shells, pumps). For complete plant design with equipment sizing, use the MED Plant
          Designer.
        </Alert>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => setLoadOpen(true)}
          size="small"
        >
          Load
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => setSaveOpen(true)}
          size="small"
          disabled={!result}
        >
          Save
        </Button>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Reset
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* ---- LEFT: Inputs ---- */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Steam Supply
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Steam Flow"
                value={steamFlow}
                onChange={(e) => setSteamFlow(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">kg/hr</Typography> },
                }}
              />
              <TextField
                label="Steam Temperature"
                value={steamTemp}
                onChange={(e) => setSteamTemp(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">&deg;C</Typography> },
                }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Seawater
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Inlet Temperature"
                value={swTemp}
                onChange={(e) => setSwTemp(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">&deg;C</Typography> },
                }}
              />
              <TextField
                label="Salinity"
                value={swSalinity}
                onChange={(e) => setSwSalinity(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">ppm</Typography> },
                }}
              />
              <TextField
                label="Max Brine Salinity"
                value={maxBrineSalinity}
                onChange={(e) => setMaxBrineSalinity(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">ppm</Typography> },
                }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Configuration
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Number of Effects"
                value={numberOfEffects}
                onChange={(e) => setNumberOfEffects(e.target.value)}
                size="small"
                type="number"
                slotProps={{ htmlInput: { min: 2, max: 16 } }}
              />
              <TextField
                label="Condenser Approach"
                value={condenserApproach}
                onChange={(e) => setCondenserApproach(e.target.value)}
                size="small"
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">&deg;C</Typography> },
                }}
              />
              <TextField
                label="Condenser SW Outlet"
                value={condenserOutletTemp}
                onChange={(e) => setCondenserOutletTemp(e.target.value)}
                size="small"
                placeholder={`Auto (${parseFloat(swTemp) + 5})`}
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">&deg;C</Typography> },
                }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Preheaters
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Select which effects supply vapor to preheaters. Each preheater is sized individually
              with its own LMTD. E1 vapor cannot be used (it is the motive steam condensation
              stage). E{nEff} vapor goes to the final condenser.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {Array.from({ length: Math.max(0, nEff - 2) }, (_, i) => i + 2).map((effNum) => (
                <FormControlLabel
                  key={effNum}
                  control={
                    <Checkbox
                      size="small"
                      checked={preheaterEffects.includes(effNum)}
                      onChange={() => togglePreheater(effNum)}
                    />
                  }
                  label={`E${effNum}`}
                  sx={{ mr: 0 }}
                />
              ))}
            </Stack>
            {nEff <= 2 && (
              <Typography variant="caption" color="text.secondary">
                Need at least 3 effects for preheaters.
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Thermo Vapor Compressor (TVC)
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={tvcEnabled}
                  onChange={(e) => setTvcEnabled(e.target.checked)}
                />
              }
              label="Enable TVC"
            />
            {tvcEnabled && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Motive Steam Pressure"
                  value={tvcMotivePressure}
                  onChange={(e) => setTvcMotivePressure(e.target.value)}
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: <Typography variant="caption">bar abs</Typography>,
                    },
                  }}
                />
                <TextField
                  label="Entrained Effect"
                  value={tvcEntrainedEffect}
                  onChange={(e) => setTvcEntrainedEffect(e.target.value)}
                  size="small"
                  placeholder={`Last (E${nEff})`}
                  helperText="Which effect supplies vapor to the TVC"
                  type="number"
                  slotProps={{ htmlInput: { min: 1, max: nEff } }}
                />
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* ---- RIGHT: Results ---- */}
        <Grid size={{ xs: 12, md: 8 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result && !error && (
            <>
              {/* Performance Summary */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Performance Summary
                </Typography>
                {result.warnings.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {result.warnings.map((w, i) => (
                      <Typography key={i} variant="body2">
                        {w}
                      </Typography>
                    ))}
                  </Alert>
                )}
                <Grid container spacing={2}>
                  {[
                    { label: 'GOR', value: result.performance.gor.toFixed(2), unit: '' },
                    {
                      label: 'Net Distillate',
                      value: result.performance.netDistillate.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Output',
                      value: result.performance.netDistillateM3Day.toFixed(1),
                      unit: 'm\u00B3/day',
                    },
                    {
                      label: 'Specific Energy',
                      value: result.performance.specificThermalEnergy_kWh.toFixed(1),
                      unit: 'kWh/m\u00B3',
                    },
                    {
                      label: 'Seawater Intake',
                      value: result.performance.seawaterIntake.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Brine Blowdown',
                      value: result.performance.brineBlowdown.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Brine Salinity',
                      value: result.performance.brineSalinity.toFixed(0),
                      unit: 'ppm',
                    },
                    {
                      label: 'Iterations',
                      value: `${result.iterations}`,
                      unit: result.converged ? 'converged' : 'not converged',
                    },
                  ].map(({ label, value, unit }) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={label}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {unit}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* TVC Result */}
              {result.tvc && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Thermo Vapor Compressor
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { label: 'Motive Steam', value: `${result.tvc.motiveFlow.toFixed(0)} kg/hr` },
                      {
                        label: 'Entrained Vapor',
                        value: `${result.tvc.entrainedFlow.toFixed(0)} kg/hr`,
                      },
                      {
                        label: 'Discharge to E1',
                        value: `${result.tvc.dischargeFlow.toFixed(0)} kg/hr`,
                      },
                      { label: 'Entrainment Ratio', value: result.tvc.entrainmentRatio.toFixed(3) },
                      { label: 'Compression Ratio', value: result.tvc.compressionRatio.toFixed(3) },
                      {
                        label: 'Vapor to E1 Temp',
                        value: `${result.tvc.vaporToEffect1Temp.toFixed(1)} \u00B0C`,
                      },
                    ].map(({ label, value }) => (
                      <Grid size={{ xs: 6, sm: 4 }} key={label}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {value}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}

              {/* Temperature Profile */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Temperature Profile
                </Typography>
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Effect</TableCell>
                        <TableCell align="right">Brine T (&deg;C)</TableCell>
                        <TableCell align="right">Vapor Out T (&deg;C)</TableCell>
                        <TableCell align="right">BPE (&deg;C)</TableCell>
                        <TableCell align="right">Working &Delta;T (&deg;C)</TableCell>
                        <TableCell align="right">Pressure (mbar)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.temperatureProfile.map((tp) => (
                        <TableRow key={tp.effectNumber}>
                          <TableCell>Effect {tp.effectNumber}</TableCell>
                          <TableCell align="right">{tp.brineTemp.toFixed(2)}</TableCell>
                          <TableCell align="right">{tp.vaporOutTemp.toFixed(2)}</TableCell>
                          <TableCell align="right">{tp.bpe.toFixed(3)}</TableCell>
                          <TableCell align="right">{tp.workingDeltaT.toFixed(3)}</TableCell>
                          <TableCell align="right">{tp.pressure.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Preheater Details */}
              {result.preheaters.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Preheater Details
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Each preheater is individually sized — different vapor source, different LMTD,
                    different duty.
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Vapor Source</TableCell>
                          <TableCell align="right">Vapor T (&deg;C)</TableCell>
                          <TableCell align="right">SW In (&deg;C)</TableCell>
                          <TableCell align="right">SW Out (&deg;C)</TableCell>
                          <TableCell align="right">Temp Rise (&deg;C)</TableCell>
                          <TableCell align="right">LMTD (&deg;C)</TableCell>
                          <TableCell align="right">Duty (kW)</TableCell>
                          <TableCell align="right">Vapor Used (kg/hr)</TableCell>
                          <TableCell align="right">Condensate &rarr;</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.preheaters.map((ph) => (
                          <TableRow key={ph.effectNumber}>
                            <TableCell>Effect {ph.effectNumber}</TableCell>
                            <TableCell align="right">{ph.vaporTemp.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.swInletTemp.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.swOutletTemp.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.tempRise.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.lmtd.toFixed(2)}</TableCell>
                            <TableCell align="right">{ph.duty.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.vaporFlow.toFixed(0)}</TableCell>
                            <TableCell align="right">Effect {ph.condensateToEffect}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Detailed Per-Effect H&M Balance */}
              <MEDEffectBalanceTable effects={result.effects} />

              {/* Final Condenser */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Final Condenser
                </Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      label: 'Vapor In',
                      value: `${result.finalCondenser.vaporIn.flow.toFixed(0)} kg/hr @ ${result.finalCondenser.vaporIn.temperature.toFixed(1)}\u00B0C`,
                    },
                    {
                      label: 'Seawater Flow',
                      value: `${result.finalCondenser.seawaterIn.flow.toFixed(0)} kg/hr`,
                    },
                    {
                      label: 'Distillate Out',
                      value: `${result.finalCondenser.distillateOut.flow.toFixed(0)} kg/hr @ ${result.finalCondenser.distillateOut.temperature.toFixed(1)}\u00B0C`,
                    },
                    {
                      label: 'Heat Transferred',
                      value: `${result.finalCondenser.heatTransferred.toFixed(1)} kW`,
                    },
                  ].map(({ label, value }) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={label}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Equipment Sizing */}
              {result.equipmentSizing && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Equipment Sizing
                  </Typography>

                  {/* Evaporator Effects */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                    Evaporator Effects
                  </Typography>
                  <TableContainer>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Parameter</TableCell>
                          <TableCell>Unit</TableCell>
                          {result.equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              Effect {ev.effectNumber}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          {
                            label: 'Heat Duty',
                            unit: 'kW',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.heatDuty.toFixed(1),
                          },
                          {
                            label: 'Overall U',
                            unit: 'W/(m\u00B2\u00B7K)',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.overallHTC.toFixed(0),
                          },
                          {
                            label: 'Required Area',
                            unit: 'm\u00B2',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.requiredArea.toFixed(1),
                          },
                          {
                            label: 'Design Area',
                            unit: 'm\u00B2',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.designArea.toFixed(1),
                          },
                          {
                            label: 'Tube Count',
                            unit: '-',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.tubeCount.toString(),
                          },
                          {
                            label: 'Bundle Dia.',
                            unit: 'mm',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.bundleDiameter.toString(),
                          },
                          {
                            label: 'Wetting Rate',
                            unit: 'kg/(m\u00B7s)',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.wettingRate.toFixed(4),
                          },
                          {
                            label: 'Demister Area',
                            unit: 'm\u00B2',
                            get: (ev: (typeof result.equipmentSizing.evaporators)[0]) =>
                              ev.demisterArea.toFixed(2),
                          },
                        ].map(({ label, unit, get }) => (
                          <TableRow key={label}>
                            <TableCell>{label}</TableCell>
                            <TableCell>{unit}</TableCell>
                            {result.equipmentSizing!.evaporators.map((ev) => (
                              <TableCell key={ev.effectNumber} align="right">
                                {get(ev)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Totals */}
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    {[
                      {
                        label: 'Total Evaporator Area',
                        value: `${result.equipmentSizing.totalEvaporatorArea.toFixed(1)} m\u00B2`,
                      },
                      {
                        label: 'Condenser Area',
                        value: `${result.equipmentSizing.totalCondenserArea.toFixed(1)} m\u00B2`,
                      },
                      {
                        label: 'Preheater Area',
                        value: `${result.equipmentSizing.totalPreheaterArea.toFixed(1)} m\u00B2`,
                      },
                      {
                        label: 'Grand Total Area',
                        value: `${result.equipmentSizing.grandTotalArea.toFixed(1)} m\u00B2`,
                      },
                    ].map(({ label, value }) => (
                      <Grid size={{ xs: 6, sm: 3 }} key={label}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {value}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Condenser Sizing */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                    Final Condenser Sizing
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      {
                        label: 'LMTD',
                        value: `${result.equipmentSizing.condenser.lmtd.toFixed(2)} \u00B0C`,
                      },
                      {
                        label: 'Overall U',
                        value: `${result.equipmentSizing.condenser.overallHTC.toFixed(0)} W/(m\u00B2\u00B7K)`,
                      },
                      {
                        label: 'Design Area',
                        value: `${result.equipmentSizing.condenser.designArea.toFixed(1)} m\u00B2`,
                      },
                      { label: 'Tubes', value: `${result.equipmentSizing.condenser.tubeCount}` },
                      {
                        label: 'Tube Velocity',
                        value: `${result.equipmentSizing.condenser.tubeVelocity.toFixed(2)} m/s`,
                      },
                      {
                        label: 'Shell ID',
                        value: `${result.equipmentSizing.condenser.shellID} mm`,
                      },
                    ].map(({ label, value }) => (
                      <Grid size={{ xs: 6, sm: 4 }} key={label}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {value}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Preheater Sizing */}
                  {result.equipmentSizing.preheaters.length > 0 && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                        Preheater Sizing
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Preheater</TableCell>
                              <TableCell align="right">LMTD (&deg;C)</TableCell>
                              <TableCell align="right">U (W/m&sup2;&middot;K)</TableCell>
                              <TableCell align="right">Area (m&sup2;)</TableCell>
                              <TableCell align="right">Tubes</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {result.equipmentSizing.preheaters.map((ph) => (
                              <TableRow key={ph.effectNumber}>
                                <TableCell>PH on Effect {ph.effectNumber}</TableCell>
                                <TableCell align="right">{ph.lmtd.toFixed(2)}</TableCell>
                                <TableCell align="right">{ph.overallHTC.toFixed(0)}</TableCell>
                                <TableCell align="right">{ph.designArea.toFixed(1)}</TableCell>
                                <TableCell align="right">{ph.tubeCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  {/* Sizing Warnings */}
                  {result.equipmentSizing.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {result.equipmentSizing.warnings.map((w, i) => (
                        <Typography key={i} variant="body2">
                          {w}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                </Paper>
              )}
            </>
          )}

          {!result && !error && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Enter steam supply conditions to see the heat and mass balance.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="MED_PLANT"
        inputs={{
          steamFlow,
          steamTemp,
          swTemp,
          swSalinity,
          maxBrineSalinity,
          numberOfEffects,
          condenserApproach,
          condenserOutletTemp,
          preheaterEffects,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="MED_PLANT"
        onLoad={(inputs) => {
          if (typeof inputs.steamFlow === 'string') setSteamFlow(inputs.steamFlow);
          if (typeof inputs.steamTemp === 'string') setSteamTemp(inputs.steamTemp);
          if (typeof inputs.swTemp === 'string') setSwTemp(inputs.swTemp);
          if (typeof inputs.swSalinity === 'string') setSwSalinity(inputs.swSalinity);
          if (typeof inputs.maxBrineSalinity === 'string')
            setMaxBrineSalinity(inputs.maxBrineSalinity);
          if (typeof inputs.numberOfEffects === 'string')
            setNumberOfEffects(inputs.numberOfEffects);
          if (typeof inputs.condenserApproach === 'string')
            setCondenserApproach(inputs.condenserApproach);
          if (typeof inputs.condenserOutletTemp === 'string')
            setCondenserOutletTemp(inputs.condenserOutletTemp);
          if (Array.isArray(inputs.preheaterEffects))
            setPreheaterEffects(inputs.preheaterEffects as number[]);
        }}
      />
    </Container>
  );
}
