'use client';

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Card,
  CardContent,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as FeasibleIcon,
  Warning as WarningIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { GenerateReportDialog } from './components/GenerateReportDialog';
import { MEDProcessFlowDiagram } from './components/MEDProcessFlowDiagram';
import { MEDGeneralArrangement } from './components/MEDGeneralArrangement';
import { MEDPlotPlan } from './components/MEDPlotPlan';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designMED, generateDesignOptions, type MEDDesignerInput } from '@/lib/thermal';

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

export default function MEDDesignerClient() {
  // ── Required inputs ──────────────────────────────────────────────────
  const [steamFlow, setSteamFlow] = useState('0.79');
  const [steamTemp, setSteamTemp] = useState('57');
  const [swTemp, setSwTemp] = useState('30');
  const [targetGOR, setTargetGOR] = useState('6');

  // ── Overrides (empty = use default) ──────────────────────────────────
  const [shellID, setShellID] = useState('1800');
  const [tubeOD, setTubeOD] = useState('25.4');
  const [tubeWall, setTubeWall] = useState('1.0');
  const [tubeConductivity, setTubeConductivity] = useState('138');
  const [tubeMaterial, setTubeMaterial] = useState('Al 5052');
  const [pitch, setPitch] = useState('33.4');
  const [swSalinity, setSwSalinity] = useState('35000');
  const [maxBrine, setMaxBrine] = useState('65000');
  const [condenserApproach, setCondenserApproach] = useState('4');
  const [swOutlet, setSwOutlet] = useState('35');
  const [designMargin, setDesignMargin] = useState('15');
  // bundleType removed — only lateral bundles are implemented

  // ── Per-effect overrides ─────────────────────────────────────────────
  const [tubeLengthOverrides, setTubeLengthOverrides] = useState<Record<number, string>>({});
  const [tubeCountOverrides, setTubeCountOverrides] = useState<Record<number, string>>({});

  // ── Turndown analysis ────────────────────────────────────────────────
  const [includeTurndown, setIncludeTurndown] = useState(false);

  // ── Selected option ──────────────────────────────────────────────────
  const [selectedEffects, setSelectedEffects] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const handleReset = () => {
    setSteamFlow('0.79');
    setSteamTemp('57');
    setSwTemp('30');
    setTargetGOR('6');
    setShellID('1800');
    setTubeOD('25.4');
    setTubeWall('1.0');
    setTubeConductivity('138');
    setTubeMaterial('Al 5052');
    setPitch('33.4');
    setSwSalinity('35000');
    setMaxBrine('65000');
    setCondenserApproach('4');
    setSwOutlet('35');
    setDesignMargin('15');
    setSelectedEffects(null);
    setTubeLengthOverrides({});
    setTubeCountOverrides({});
  };

  // ── Build input ──────────────────────────────────────────────────────
  const input: MEDDesignerInput | null = useMemo(() => {
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const gor = parseFloat(targetGOR);
    if ([sf, st, sw, gor].some((v) => isNaN(v) || v <= 0)) return null;

    return {
      steamFlow: sf,
      steamTemperature: st,
      seawaterTemperature: sw,
      targetGOR: gor,
      shellID: parseFloat(shellID) || undefined,
      tubeOD: parseFloat(tubeOD) || undefined,
      tubeWallThickness: parseFloat(tubeWall) || undefined,
      tubeConductivity: parseFloat(tubeConductivity) || undefined,
      tubeMaterialName: tubeMaterial || undefined,
      tubePitch: parseFloat(pitch) || undefined,
      seawaterSalinity: parseFloat(swSalinity) || undefined,
      maxBrineSalinity: parseFloat(maxBrine) || undefined,
      condenserApproach: parseFloat(condenserApproach) || undefined,
      condenserSWOutlet: parseFloat(swOutlet) || undefined,
      designMargin: (parseFloat(designMargin) || 15) / 100,
      ...(selectedEffects ? { numberOfEffects: selectedEffects } : {}),
      ...(includeTurndown ? { includeTurndown: true } : {}),
      // Per-effect overrides: convert Record<number, string> → (number | null)[]
      ...(Object.keys(tubeLengthOverrides).length > 0
        ? {
            tubeLengthOverrides: Array.from({ length: 12 }, (_, i) => {
              const v = parseFloat(tubeLengthOverrides[i] ?? '');
              return isNaN(v) || v <= 0 ? null : v;
            }),
          }
        : {}),
      ...(Object.keys(tubeCountOverrides).length > 0
        ? {
            tubeCountOverrides: Array.from({ length: 12 }, (_, i) => {
              const v = parseInt(tubeCountOverrides[i] ?? '', 10);
              return isNaN(v) || v <= 0 ? null : v;
            }),
          }
        : {}),
    };
  }, [
    steamFlow,
    steamTemp,
    swTemp,
    targetGOR,
    shellID,
    tubeOD,
    tubeWall,
    tubeConductivity,
    tubeMaterial,
    pitch,
    swSalinity,
    maxBrine,
    condenserApproach,
    swOutlet,
    designMargin,
    selectedEffects,
    includeTurndown,
    tubeLengthOverrides,
    tubeCountOverrides,
  ]);

  // ── Generate options ─────────────────────────────────────────────────
  const computed = useMemo(() => {
    if (!input) return null;
    try {
      const options = generateDesignOptions(input);
      const detail = selectedEffects
        ? designMED({ ...input, numberOfEffects: selectedEffects })
        : (options.find((o) => o.feasible)?.detail ?? options[0]?.detail ?? null);
      return { options, detail, error: null };
    } catch (err) {
      return { options: [], detail: null, error: err instanceof Error ? err.message : 'Error' };
    }
  }, [input, selectedEffects]);

  const options = computed?.options ?? [];
  const detail = computed?.detail ?? null;
  const error = computed?.error ?? null;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="MED Plant Designer" />

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            MED Plant Designer
          </Typography>
          <Chip label="Multi-Effect Distillation" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Design a complete MED plant from 4 inputs. The engine auto-selects the optimal number of
          effects, sizes tube bundles, condenser, preheaters, and brine recirculation. Compare
          options from compact/light to high-GOR/heavy.
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {detail && (
          <Button
            variant="outlined"
            startIcon={<PdfIcon />}
            onClick={() => setReportOpen(true)}
            size="small"
            color="primary"
          >
            PDF Report
          </Button>
        )}
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Reset
        </Button>
      </Box>

      {/* ── Required Inputs ─────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Design Inputs
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              label="Vapour Flow"
              value={steamFlow}
              onChange={(e) => setSteamFlow(e.target.value)}
              type="number"
              fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">T/h</InputAdornment> }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              label="Vapour Temperature"
              value={steamTemp}
              onChange={(e) => setSteamTemp(e.target.value)}
              type="number"
              fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">&deg;C</InputAdornment> }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              label="Seawater Temperature"
              value={swTemp}
              onChange={(e) => setSwTemp(e.target.value)}
              type="number"
              fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">&deg;C</InputAdornment> }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              label="Target GOR"
              value={targetGOR}
              onChange={(e) => setTargetGOR(e.target.value)}
              type="number"
              fullWidth
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Overrides ───────────────────────────────────────────────────── */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Advanced Settings (Overrides)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Shell ID"
                value={shellID}
                onChange={(e) => setShellID(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
                helperText="Warn if < 1800mm"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Tube OD"
                value={tubeOD}
                onChange={(e) => setTubeOD(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Tube Wall"
                value={tubeWall}
                onChange={(e) => setTubeWall(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Conductivity"
                value={tubeConductivity}
                onChange={(e) => setTubeConductivity(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">W/m&middot;K</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Tube Material"
                value={tubeMaterial}
                onChange={(e) => setTubeMaterial(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Pitch"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="SW Salinity"
                value={swSalinity}
                onChange={(e) => setSwSalinity(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">ppm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Max Brine"
                value={maxBrine}
                onChange={(e) => setMaxBrine(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">ppm</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Condenser Approach"
                value={condenserApproach}
                onChange={(e) => setCondenserApproach(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="SW Outlet (condenser)"
                value={swOutlet}
                onChange={(e) => setSwOutlet(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Design Margin"
                value={designMargin}
                onChange={(e) => setDesignMargin(e.target.value)}
                type="number"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
            </Grid>
            {/* Bundle type: only lateral (half-shell) is implemented */}
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeTurndown}
                    onChange={(e) => setIncludeTurndown(e.target.checked)}
                  />
                }
                label="Include Turndown Analysis"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* ── Design Options Table ────────────────────────────────────────── */}
      {options.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Design Options — Trade-off Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click a row to select that configuration for detailed design.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Option</TableCell>
                  <TableCell align="right">Effects</TableCell>
                  <TableCell align="right">GOR</TableCell>
                  <TableCell align="right">Output (m&sup3;/day)</TableCell>
                  <TableCell align="right">Evap Area (m&sup2;)</TableCell>
                  <TableCell align="right">Shell ID (mm)</TableCell>
                  <TableCell align="right">Train L (m)</TableCell>
                  <TableCell align="right">Energy (kWh/m&sup3;)</TableCell>
                  <TableCell align="right">Dry Wt (kg)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {options.map((o) => {
                  const isSelected =
                    selectedEffects === o.effects ||
                    (!selectedEffects && o.feasible && o === options.find((x) => x.feasible));
                  return (
                    <TableRow
                      key={o.effects}
                      hover
                      selected={isSelected}
                      onClick={() => setSelectedEffects(o.effects)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {o.feasible ? (
                          <FeasibleIcon color="success" fontSize="small" />
                        ) : (
                          <WarningIcon color="warning" fontSize="small" />
                        )}
                      </TableCell>
                      <TableCell>{o.label}</TableCell>
                      <TableCell align="right">{o.effects}</TableCell>
                      <TableCell align="right">{fmt(o.gor)}</TableCell>
                      <TableCell align="right">{fmt(o.distillateM3Day, 0)}</TableCell>
                      <TableCell align="right">{fmt(o.totalEvaporatorArea, 0)}</TableCell>
                      <TableCell align="right">{o.largestShellID.toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(o.trainLengthMM / 1000, 1)}</TableCell>
                      <TableCell align="right">{fmt(o.specificEnergy, 0)}</TableCell>
                      <TableCell align="right">
                        {o.weight.totalDryWeight.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* ── Detailed Results ─────────────────────────────────────────────── */}
      {detail && (
        <>
          {/* Warnings */}
          {detail.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {detail.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </Alert>
          )}

          {/* Process Flow Diagram */}
          <MEDProcessFlowDiagram result={detail} />

          {/* General Arrangement */}
          <MEDGeneralArrangement result={detail} />
          <MEDPlotPlan result={detail} />

          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    GOR
                  </Typography>
                  <Typography variant="h4">{fmt(detail.achievedGOR)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Distillate
                  </Typography>
                  <Typography variant="h4">{fmt(detail.totalDistillateM3Day, 0)}</Typography>
                  <Typography variant="caption">m&sup3;/day</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Effects
                  </Typography>
                  <Typography variant="h4">{detail.effects.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Evap Area
                  </Typography>
                  <Typography variant="h4">{fmt(detail.totalEvaporatorArea, 0)}</Typography>
                  <Typography variant="caption">m&sup2;</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Brine Recirc
                  </Typography>
                  <Typography variant="h4">{fmt(detail.totalBrineRecirculation, 0)}</Typography>
                  <Typography variant="caption">T/h</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    SW Flow
                  </Typography>
                  <Typography variant="h4">{fmt(detail.condenser.seawaterFlowM3h, 0)}</Typography>
                  <Typography variant="caption">m&sup3;/h</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Effect-by-Effect Table */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Effect-by-Effect Design
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Non-BPE losses per effect: NEA {detail.effects[0]?.nea ?? 0.25}&deg;C + Demister{' '}
              {detail.effects[0]?.demisterLoss ?? 0.15}&deg;C + Vapour duct{' '}
              {detail.effects[0]?.pressureDropLoss ?? 0.3}&deg;C ={' '}
              {(
                (detail.effects[0]?.nea ?? 0.25) +
                (detail.effects[0]?.demisterLoss ?? 0.15) +
                (detail.effects[0]?.pressureDropLoss ?? 0.3)
              ).toFixed(2)}
              &deg;C total
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Effect</TableCell>
                    <TableCell align="right">Brine T (&deg;C)</TableCell>
                    <TableCell align="right">Vap Out (&deg;C)</TableCell>
                    <TableCell align="right">BPE (&deg;C)</TableCell>
                    <TableCell align="right">Work &Delta;T (&deg;C)</TableCell>
                    <TableCell align="right">U (W/m&sup2;&middot;K)</TableCell>
                    <TableCell align="right">Duty (kW)</TableCell>
                    <TableCell align="right">Tubes</TableCell>
                    <TableCell align="right">Tube L (m)</TableCell>
                    <TableCell align="right">Inst. Area (m&sup2;)</TableCell>
                    <TableCell align="right">Margin</TableCell>
                    <TableCell align="right">Distillate (T/h)</TableCell>
                    <TableCell align="right">Recirc (T/h)</TableCell>
                    <TableCell align="right">Shell L (mm)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.effects.map((e) => (
                    <TableRow key={e.effect}>
                      <TableCell>
                        E{e.effect}
                        {e.hasVapourLanes ? ' *' : ''}
                      </TableCell>
                      <TableCell align="right">{fmt(e.brineTemp)}</TableCell>
                      <TableCell align="right">{fmt(e.vapourOutTemp)}</TableCell>
                      <TableCell align="right">{fmt(e.bpe, 2)}</TableCell>
                      <TableCell align="right">{fmt(e.workingDeltaT, 2)}</TableCell>
                      <TableCell align="right">{fmt(e.overallU, 0)}</TableCell>
                      <TableCell align="right">{fmt(e.duty, 0)}</TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          placeholder={String(e.tubes)}
                          value={tubeCountOverrides[e.effect - 1] ?? ''}
                          onChange={(ev) =>
                            setTubeCountOverrides((prev) => ({
                              ...prev,
                              [e.effect - 1]: ev.target.value,
                            }))
                          }
                          sx={{ width: 80 }}
                          inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          placeholder={String(e.tubeLength)}
                          value={tubeLengthOverrides[e.effect - 1] ?? ''}
                          onChange={(ev) =>
                            setTubeLengthOverrides((prev) => ({
                              ...prev,
                              [e.effect - 1]: ev.target.value,
                            }))
                          }
                          sx={{ width: 70 }}
                          inputProps={{
                            step: 0.1,
                            style: { textAlign: 'right', fontSize: '0.8rem' },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">{fmt(e.installedArea, 0)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: e.areaMargin < -10 ? 'error.main' : 'success.main' }}
                      >
                        {e.areaMargin >= 0 ? '+' : ''}
                        {fmt(e.areaMargin, 0)}%
                      </TableCell>
                      <TableCell align="right">{fmt(e.distillateFlow, 2)}</TableCell>
                      <TableCell align="right">{fmt(e.brineRecirculation)}</TableCell>
                      <TableCell align="right">{e.shellLengthMM.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              * = with vapour escape lanes | Shell length includes 750 mm tube sheet access on each
              side
            </Typography>
          </Paper>

          {/* Overall Dimensions */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Evaporator Dimensions
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Shell OD</TableCell>
                  <TableCell align="right">
                    {detail.overallDimensions.shellODmm.toLocaleString()} mm
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Shell Length (per effect)</TableCell>
                  <TableCell align="right">
                    {detail.overallDimensions.shellLengthRange.min ===
                    detail.overallDimensions.shellLengthRange.max
                      ? `${detail.overallDimensions.shellLengthRange.min.toLocaleString()} mm`
                      : `${detail.overallDimensions.shellLengthRange.min.toLocaleString()} – ${detail.overallDimensions.shellLengthRange.max.toLocaleString()} mm`}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total Train Length</TableCell>
                  <TableCell align="right">
                    {detail.overallDimensions.totalLengthMM.toLocaleString()} mm (
                    {(detail.overallDimensions.totalLengthMM / 1000).toFixed(1)} m)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tube Sheet Access (inside)</TableCell>
                  <TableCell align="right">750 mm each side</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Number of Shells</TableCell>
                  <TableCell align="right">{detail.numberOfShells}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Condenser & Preheaters */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Final Condenser
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Vapour</TableCell>
                      <TableCell align="right">
                        {fmt(detail.condenser.vapourFlow, 3)} T/h @{' '}
                        {fmt(detail.condenser.vapourTemp)}&deg;C
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Duty</TableCell>
                      <TableCell align="right">{fmt(detail.condenser.duty, 0)} kW</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>LMTD</TableCell>
                      <TableCell align="right">{fmt(detail.condenser.lmtd, 2)}&deg;C</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Design Area</TableCell>
                      <TableCell align="right">
                        {fmt(detail.condenser.designArea)} m&sup2;
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SW Flow</TableCell>
                      <TableCell align="right">
                        {fmt(detail.condenser.seawaterFlowM3h, 0)} m&sup3;/h
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Preheaters
                </Typography>
                {detail.preheaters.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>PH</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell align="right">SW In&rarr;Out</TableCell>
                        <TableCell align="right">Duty (kW)</TableCell>
                        <TableCell align="right">Area (m&sup2;)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.preheaters.map((ph) => (
                        <TableRow key={ph.id}>
                          <TableCell>PH{ph.id}</TableCell>
                          <TableCell>{ph.vapourSource}</TableCell>
                          <TableCell align="right">
                            {fmt(ph.swInlet)}&rarr;{fmt(ph.swOutlet)}&deg;C
                          </TableCell>
                          <TableCell align="right">{fmt(ph.duty, 0)}</TableCell>
                          <TableCell align="right">{fmt(ph.designArea)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No preheaters for this configuration.
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Mass Balance */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Mass Balance
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Heating Steam (in)</TableCell>
                  <TableCell align="right">
                    {fmt(detail.inputs.steamFlow, 2)} T/h @ {fmt(detail.inputs.steamTemperature)}
                    &deg;C
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Make-up Feed (in)</TableCell>
                  <TableCell align="right">{fmt(detail.makeUpFeed)} T/h</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Distillate (out)</TableCell>
                  <TableCell align="right">
                    {fmt(detail.totalDistillate, 2)} T/h ({fmt(detail.totalDistillateM3Day, 0)}{' '}
                    m&sup3;/day)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Brine Blowdown (out)</TableCell>
                  <TableCell align="right">{fmt(detail.brineBlowdown)} T/h</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Brine Recirculation</TableCell>
                  <TableCell align="right">{fmt(detail.totalBrineRecirculation)} T/h</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total Spray (make-up + recirc)</TableCell>
                  <TableCell align="right">
                    {fmt(detail.makeUpFeed + detail.totalBrineRecirculation)} T/h @{' '}
                    {detail.spraySalinity.toLocaleString()} ppm
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Condenser SW</TableCell>
                  <TableCell align="right">
                    {fmt(detail.condenser.seawaterFlowM3h, 0)} m&sup3;/h
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* ── Auxiliary Equipment ─────────────────────────────────────────── */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Line Sizing */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Line Sizing
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell align="right">Flow (T/h)</TableCell>
                      <TableCell align="right">Pipe</TableCell>
                      <TableCell align="right">Vel (m/s)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.auxiliaryEquipment.lineSizing.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.service}</TableCell>
                        <TableCell align="right">{fmt(l.flowRate)}</TableCell>
                        <TableCell align="right">{l.pipeSize}</TableCell>
                        <TableCell align="right">{fmt(l.velocity, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>

            {/* Pumps */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Pump Sizing
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell align="right">Flow (m&sup3;/h)</TableCell>
                      <TableCell align="right">Head (m)</TableCell>
                      <TableCell align="right">Motor (kW)</TableCell>
                      <TableCell align="right">Qty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.auxiliaryEquipment.pumps.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.service}</TableCell>
                        <TableCell align="right">{fmt(p.flowRateM3h)}</TableCell>
                        <TableCell align="right">{fmt(p.totalHead)}</TableCell>
                        <TableCell align="right">{p.motorPower}</TableCell>
                        <TableCell align="right">{p.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Demisters */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Demister Sizing
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Effect</TableCell>
                      <TableCell align="right">Area (m&sup2;)</TableCell>
                      <TableCell align="right">Vel (m/s)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.auxiliaryEquipment.demisters.map((d) => (
                      <TableRow key={d.effect}>
                        <TableCell>E{d.effect}</TableCell>
                        <TableCell align="right">{fmt(d.requiredArea, 2)}</TableCell>
                        <TableCell align="right">{fmt(d.designVelocity, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>

            {/* Spray Nozzles */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Spray Nozzles
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Effect</TableCell>
                      <TableCell align="right">Model</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">lpm/noz</TableCell>
                      <TableCell align="right">H (mm)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.auxiliaryEquipment.sprayNozzles.map((sn) => (
                      <TableRow key={sn.effect}>
                        <TableCell>E{sn.effect}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                          {sn.nozzleModel}
                        </TableCell>
                        <TableCell align="right">{sn.nozzleCount}</TableCell>
                        <TableCell align="right">{fmt(sn.flowPerNozzle, 1)}</TableCell>
                        <TableCell align="right">{sn.sprayHeight.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>

            {/* Siphons */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  Siphon Sizing
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>From→To</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Pipe</TableCell>
                      <TableCell align="right">H (mm)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.auxiliaryEquipment.siphons.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          E{s.fromEffect}→E{s.toEffect}
                        </TableCell>
                        <TableCell>{s.fluidType}</TableCell>
                        <TableCell align="right">{s.pipeSize}</TableCell>
                        <TableCell align="right">{(s.minimumHeight * 1000).toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>

          {/* ── Nozzle Schedule, Dosing, Vacuum ─────────────────────────────── */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Nozzle Schedule */}
            {detail.auxiliaryEquipment.nozzleSchedule && (
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                    Shell Nozzle Schedule
                  </Typography>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Effect</TableCell>
                          <TableCell>Service</TableCell>
                          <TableCell align="right">Flow (T/h)</TableCell>
                          <TableCell align="right">Nozzle</TableCell>
                          <TableCell align="right">Vel (m/s)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detail.auxiliaryEquipment.nozzleSchedule.nozzles.map((n, i) => (
                          <TableRow key={i}>
                            <TableCell>E{n.effect}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              {n.service.replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell align="right">{fmt(n.flowRate, 2)}</TableCell>
                            <TableCell align="right">{n.pipeSize}</TableCell>
                            <TableCell align="right">{fmt(n.velocity, 1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* Dosing & Vacuum Summary */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={3}>
                {/* Dosing */}
                {detail.dosing && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                      Anti-Scalant Dosing
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Feed flow</TableCell>
                          <TableCell align="right">
                            {fmt(detail.dosing.feedFlowM3h)} m&sup3;/h
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Dose rate</TableCell>
                          <TableCell align="right">{detail.dosing.doseMgL} mg/L</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Chemical flow</TableCell>
                          <TableCell align="right">
                            {fmt(detail.dosing.chemicalFlowLh, 2)} L/h
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Daily consumption</TableCell>
                          <TableCell align="right">
                            {fmt(detail.dosing.dailyConsumptionKg, 2)} kg/day
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Storage tank (30 days)</TableCell>
                          <TableCell align="right">
                            {fmt(detail.dosing.storageTankM3, 2)} m&sup3;
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Dosing line</TableCell>
                          <TableCell align="right">{detail.dosing.dosingLineOD}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Paper>
                )}

                {/* Vacuum System */}
                {detail.vacuumSystem && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                      Vacuum System
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Suction pressure</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.lastEffectPressureMbar, 0)} mbar
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>System volume</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.systemVolumeM3)} m&sup3;
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>NCG load (dry)</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.totalDryNcgKgH, 2)} kg/h
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Train config</TableCell>
                          <TableCell align="right">
                            {detail.vacuumSystem.trainConfig.replace(/_/g, ' ')}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Motive steam</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.totalMotiveSteamKgH, 0)} kg/h
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Power</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.totalPowerKW)} kW
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Evacuation time</TableCell>
                          <TableCell align="right">
                            {fmt(detail.vacuumSystem.evacuationTimeMinutes, 0)} min
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </Stack>
            </Grid>
          </Grid>

          {/* Turndown Analysis */}
          {detail.turndownAnalysis && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Turndown Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Minimum feasible load:{' '}
                <strong>{detail.turndownAnalysis.minimumLoadPercent}%</strong>
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Load (%)</TableCell>
                    <TableCell align="right">Steam (T/h)</TableCell>
                    <TableCell align="right">Distillate (m&sup3;/day)</TableCell>
                    <TableCell align="right">GOR</TableCell>
                    <TableCell align="center">Wetting</TableCell>
                    <TableCell align="center">Siphons</TableCell>
                    <TableCell align="right">FC Margin (%)</TableCell>
                    <TableCell align="center">Feasible</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.turndownAnalysis.points.map((pt) => (
                    <TableRow
                      key={pt.loadPercent}
                      sx={{
                        bgcolor: pt.feasible ? undefined : 'error.50',
                      }}
                    >
                      <TableCell>
                        <strong>{pt.loadPercent}%</strong>
                      </TableCell>
                      <TableCell align="right">{fmt(pt.steamFlow, 2)}</TableCell>
                      <TableCell align="right">{fmt(pt.distillateM3Day, 0)}</TableCell>
                      <TableCell align="right">{fmt(pt.gor, 1)}</TableCell>
                      <TableCell align="center">
                        {pt.wettingAdequacy.every((w) => w.adequate) ? (
                          <Chip label="OK" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip
                            label={`${pt.wettingAdequacy.filter((w) => !w.adequate).length} dry`}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {pt.siphonsSealOk ? (
                          <Chip label="OK" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip label="Risk" size="small" color="warning" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">+{fmt(pt.condenserMarginPct, 0)}</TableCell>
                      <TableCell align="center">
                        {pt.feasible ? (
                          <Chip label="Yes" size="small" color="success" />
                        ) : (
                          <Chip label="No" size="small" color="error" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Auxiliary Warnings */}
          {detail.auxiliaryEquipment.auxWarnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Auxiliary Equipment Warnings
              </Typography>
              {detail.auxiliaryEquipment.auxWarnings.map((w, i) => (
                <Typography key={i} variant="body2">
                  {w}
                </Typography>
              ))}
            </Alert>
          )}
        </>
      )}

      {!detail && !error && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Enter vapour flow, temperature, seawater temperature, and target GOR to see the design.
          </Typography>
        </Paper>
      )}
      {/* PDF Report Dialog */}
      {detail && (
        <GenerateReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          result={detail}
          options={options}
        />
      )}
    </Container>
  );
}
