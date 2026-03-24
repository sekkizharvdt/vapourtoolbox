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
  MenuItem,
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
import {
  designMED,
  generateDesignOptions,
  type MEDDesignerInput,
  type MEDDesignerResult,
} from '@/lib/thermal';

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

/** Export equipment list as CSV for procurement and weight estimation */
function exportEquipmentCSV(detail: MEDDesignerResult) {
  const rows: string[][] = [];
  const h = (s: string) => `"${s}"`;

  // Header
  rows.push([
    'Item',
    'Description',
    'Qty',
    'Material',
    'Specification',
    'Calc Weight (kg)',
    'Material Weight (kg)',
    'Mfg Weight (kg)',
    'Total Weight (kg)',
    'Notes',
  ]);

  // Evaporator shells
  detail.effects.forEach((e) => {
    rows.push([
      `Evap Shell E${e.effect}`,
      `Evaporator Effect ${e.effect}`,
      '1',
      'Duplex SS S32304',
      `${e.shellODmm}mm OD × ${e.shellLengthMM}mm L × 8mm thk`,
      '',
      '',
      '',
      '',
      e.hasVapourLanes ? 'With vapour lanes' : '',
    ]);
  });

  // Evaporator tubes
  detail.effects.forEach((e) => {
    rows.push([
      `Evap Tubes E${e.effect}`,
      `Al 5052 tubes for Effect ${e.effect}`,
      String(e.tubes),
      'Al 5052',
      `25.4mm OD × 1.0mm wall × ${e.tubeLength * 1000}mm L`,
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  // Tube sheets
  detail.effects.forEach((e) => {
    rows.push([
      `Tube Sheet E${e.effect}`,
      `Tube sheet for Effect ${e.effect}`,
      '2',
      'Duplex SS S32304',
      `${e.shellODmm}mm dia × 8mm thk`,
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  // Dished heads (2:1 SE)
  detail.effects.forEach((e) => {
    rows.push([
      `Dished Head E${e.effect}`,
      `2:1 SE dished head for Effect ${e.effect}`,
      '2',
      'Duplex SS S32304',
      `${e.shellODmm}mm OD`,
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  // Condenser
  rows.push([
    'Final Condenser',
    'Shell & tube condenser',
    '1',
    'Ti Gr2 tubes / SS316L shell',
    `${detail.condenser.tubes} tubes, ${detail.condenser.passes} passes, ${detail.condenser.tubeOD}mm × ${detail.condenser.tubeLengthMM}mm`,
    '',
    '',
    '',
    '',
    `${fmt(detail.condenser.designArea)} m², U=${fmt(detail.condenser.overallU, 0)} W/m²K`,
  ]);

  // Preheaters
  detail.preheaters.forEach((ph) => {
    rows.push([
      `Preheater PH${ph.id}`,
      `Shell & tube preheater (${ph.vapourSource})`,
      '1',
      'Ti Gr2 tubes / SS316L shell',
      `${ph.tubes} tubes, ${ph.passes} passes, ${ph.tubeOD}mm × ${ph.tubeLengthMM}mm`,
      '',
      '',
      '',
      '',
      `${fmt(ph.duty, 0)} kW, LMTD ${fmt(ph.lmtd)}°C`,
    ]);
  });

  // Pumps
  detail.auxiliaryEquipment.pumps.forEach((p) => {
    rows.push([
      p.service,
      `Pump ${p.quantity}`,
      p.quantity,
      'Duplex SS',
      `${fmt(p.flowRateM3h)} m³/h, ${fmt(p.totalHead)} m TDH, ${p.motorPower} kW motor`,
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  // Demisters
  rows.push([
    'Demisters',
    'Wire mesh demister pads',
    String(detail.effects.length),
    'SS316',
    `100mm thick, one per effect`,
    '',
    '',
    '',
    '',
    '',
  ]);

  // Blank rows for user additions
  rows.push([]);
  rows.push(['', 'SUBTOTAL (Equipment)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Piping (15%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Instrumentation (10%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Electrical (8%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Civil (12%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Installation (20%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'Contingency (15%)', '', '', '', '', '', '', '', '']);
  rows.push(['', 'TOTAL INSTALLED COST', '', '', '', '', '', '', '', '']);

  // Convert to CSV
  const csv = rows.map((r) => r.map((c) => h(c)).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MED_Equipment_${detail.effects.length}eff_GOR${fmt(detail.achievedGOR)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  const [tiTubeLength, setTiTubeLength] = useState('2.1');
  const [tiTargetVelocity, setTiTargetVelocity] = useState('1.6');

  // ── Per-effect overrides ─────────────────────────────────────────────
  const [tubeLengthOverrides, setTubeLengthOverrides] = useState<Record<number, string>>({});
  const [tubeCountOverrides, setTubeCountOverrides] = useState<Record<number, string>>({});

  // ── Geometry comparison ──────────────────────────────────────────────
  const [geoCompareMode, setGeoCompareMode] = useState<'fixed_length' | 'fixed_tubes'>(
    'fixed_length'
  );
  const [geoCompareValue, setGeoCompareValue] = useState<string>('1.5');

  // ── Vacuum & Turndown ────────────────────────────────────────────────
  const [vacuumConfig, setVacuumConfig] = useState<string>('hybrid');
  const [includeTurndown, setIncludeTurndown] = useState(false);

  // ── Selected option ──────────────────────────────────────────────────
  const [selectedEffects, setSelectedEffects] = useState<number | null>(null);
  const [selectedPreheaters, setSelectedPreheaters] = useState<number | null>(null);
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
    setSelectedPreheaters(null);
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
      tiTubeLength: parseFloat(tiTubeLength) || undefined,
      tiTargetVelocity: parseFloat(tiTargetVelocity) || undefined,
      ...(selectedEffects ? { numberOfEffects: selectedEffects } : {}),
      ...(selectedPreheaters !== null ? { numberOfPreheaters: selectedPreheaters } : {}),
      vacuumTrainConfig: vacuumConfig as
        | 'single_ejector'
        | 'two_stage_ejector'
        | 'lrvp_only'
        | 'hybrid',
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
    selectedPreheaters,
    includeTurndown,
    vacuumConfig,
    tiTubeLength,
    tiTargetVelocity,
    tubeLengthOverrides,
    tubeCountOverrides,
  ]);

  // ── Generate options ─────────────────────────────────────────────────
  const computed = useMemo(() => {
    if (!input) return null;
    try {
      const options = generateDesignOptions(input);
      const detail = selectedEffects
        ? designMED({
            ...input,
            numberOfEffects: selectedEffects,
            ...(selectedPreheaters !== null ? { numberOfPreheaters: selectedPreheaters } : {}),
          })
        : (options.find((o) => o.feasible)?.detail ?? options[0]?.detail ?? null);
      return { options, detail, error: null };
    } catch (err) {
      return { options: [], detail: null, error: err instanceof Error ? err.message : 'Error' };
    }
  }, [input, selectedEffects, selectedPreheaters]);

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
          <>
            <Button
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={() => setReportOpen(true)}
              size="small"
              color="primary"
            >
              PDF Report
            </Button>
            <Button variant="outlined" size="small" onClick={() => exportEquipmentCSV(detail)}>
              Export CSV
            </Button>
          </>
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
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Ti Tube Length (cond/PH)"
                value={tiTubeLength}
                onChange={(e) => setTiTubeLength(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                helperText="Standardised for procurement"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Ti Target Velocity"
                value={tiTargetVelocity}
                onChange={(e) => setTiTargetVelocity(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                }}
                helperText="Range: 1.4–1.8 m/s"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                select
                label="Vacuum System"
                value={vacuumConfig}
                onChange={(e) => setVacuumConfig(e.target.value)}
                fullWidth
              >
                <MenuItem value="two_stage_ejector">2-Stage Steam Ejector</MenuItem>
                <MenuItem value="single_ejector">Single Steam Ejector</MenuItem>
                <MenuItem value="lrvp_only">Liquid Ring Vacuum Pump</MenuItem>
                <MenuItem value="hybrid">Hybrid (Ejector + LRVP)</MenuItem>
              </TextField>
            </Grid>
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

      {/* ── GOR Configurations: How to achieve target GOR ────────────────── */}
      {detail?.gorConfigurations && detail.gorConfigurations.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Configurations to Achieve GOR {targetGOR}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Effects × preheaters combinations near target GOR. Click a row to design that
            configuration.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">Effects</TableCell>
                  <TableCell align="right">Preheaters</TableCell>
                  <TableCell align="right">GOR</TableCell>
                  <TableCell align="right">Output (m&sup3;/day)</TableCell>
                  <TableCell align="right">Feed Temp (&deg;C)</TableCell>
                  <TableCell align="right">Work &Delta;T/eff (&deg;C)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.gorConfigurations.map((gc, i) => (
                  <TableRow
                    key={i}
                    hover
                    selected={
                      gc.effects === selectedEffects && gc.preheaters === selectedPreheaters
                    }
                    onClick={() => {
                      setSelectedEffects(gc.effects);
                      setSelectedPreheaters(gc.preheaters);
                    }}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: gc.recommended ? 'action.selected' : undefined,
                    }}
                  >
                    <TableCell>
                      {gc.recommended ? (
                        <FeasibleIcon color="success" fontSize="small" />
                      ) : gc.feasible ? (
                        <FeasibleIcon color="info" fontSize="small" />
                      ) : (
                        <WarningIcon color="warning" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">{gc.effects}</TableCell>
                    <TableCell align="right">{gc.preheaters}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: gc.recommended ? 700 : 400 }}>
                      {fmt(gc.gor)}
                    </TableCell>
                    <TableCell align="right">{fmt(gc.outputM3Day, 0)}</TableCell>
                    <TableCell align="right">{fmt(gc.feedTemp)}&deg;C</TableCell>
                    <TableCell align="right">{fmt(gc.workDTPerEffect, 2)}</TableCell>
                  </TableRow>
                ))}
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

          {/* STEP 2: Geometry — user picks tubes/length before seeing effect details */}
          {/* (Geometry Comparison section is rendered here — moved up from below) */}
          {/* Geometry Comparison — Interactive */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Effect Geometry Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose a constraint and enter a value. The calculator will vary the other parameter
              per effect to match the required area.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
              <TextField
                select
                label="Compare by"
                value={geoCompareMode}
                onChange={(e) =>
                  setGeoCompareMode(e.target.value as 'fixed_length' | 'fixed_tubes')
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="fixed_length">Fixed Tube Length</MenuItem>
                <MenuItem value="fixed_tubes">Fixed Tube Count</MenuItem>
              </TextField>
              <TextField
                label={geoCompareMode === 'fixed_length' ? 'Tube Length (m)' : 'Tubes per Effect'}
                value={geoCompareValue}
                onChange={(e) => setGeoCompareValue(e.target.value)}
                type="number"
                sx={{ width: 160 }}
              />
            </Stack>
            {(() => {
              // Compute comparison on the fly from the detail result
              const val = parseFloat(geoCompareValue);
              if (!detail || isNaN(val) || val <= 0) return null;

              const rows = detail.effects.map((e) => {
                if (geoCompareMode === 'fixed_length') {
                  // Fixed length: vary tube count per effect
                  const tubeL = val;
                  const areaPerTube = ((Math.PI * (detail.inputs.tubeOD ?? 25.4)) / 1000) * tubeL;
                  const tubes = Math.ceil(e.designArea / areaPerTube);
                  const instArea = tubes * areaPerTube;
                  const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
                  // Estimate shell ID from tube count
                  const pitch = detail.inputs.tubePitch ?? 33.4;
                  const shellID = Math.round(
                    Math.sqrt((tubes * pitch * pitch * 4) / Math.PI) * 1.15
                  );
                  const tpr = Math.round(shellID / 2 / pitch);
                  const minSpray = 0.035 * 2 * tpr * tubeL * 3.6;
                  const feed =
                    (e.distillateFlow * (detail.inputs.maxBrineSalinity ?? 65000)) /
                    ((detail.inputs.maxBrineSalinity ?? 65000) -
                      (detail.inputs.seawaterSalinity ?? 35000));
                  const recirc = Math.max(0, minSpray - feed);
                  return {
                    effect: e.effect,
                    tubes,
                    tubeLength: tubeL,
                    shellID,
                    instArea,
                    margin,
                    recirc,
                  };
                } else {
                  // Fixed tubes: vary tube length per effect
                  const tubes = Math.round(val);
                  const areaPerTubePerM = (Math.PI * (detail.inputs.tubeOD ?? 25.4)) / 1000;
                  const tubeL = Math.ceil((e.designArea / (tubes * areaPerTubePerM)) * 10) / 10; // round to 0.1m
                  const instArea = tubes * areaPerTubePerM * tubeL;
                  const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
                  const pitch = detail.inputs.tubePitch ?? 33.4;
                  const shellID = Math.round(
                    Math.sqrt((tubes * pitch * pitch * 4) / Math.PI) * 1.15
                  );
                  const tpr = Math.round(shellID / 2 / pitch);
                  const minSpray = 0.035 * 2 * tpr * tubeL * 3.6;
                  const feed =
                    (e.distillateFlow * (detail.inputs.maxBrineSalinity ?? 65000)) /
                    ((detail.inputs.maxBrineSalinity ?? 65000) -
                      (detail.inputs.seawaterSalinity ?? 35000));
                  const recirc = Math.max(0, minSpray - feed);
                  return {
                    effect: e.effect,
                    tubes,
                    tubeLength: tubeL,
                    shellID,
                    instArea,
                    margin,
                    recirc,
                  };
                }
              });

              const maxShellID = Math.max(...rows.map((r) => r.shellID));
              const totalArea = rows.reduce((s, r) => s + r.instArea, 0);
              const totalRecirc = rows.reduce((s, r) => s + r.recirc, 0);

              return (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {geoCompareMode === 'fixed_length'
                      ? `All effects use ${val}m tubes. Tube count varies per effect.`
                      : `All effects use ${Math.round(val)} tubes. Tube length varies per effect.`}{' '}
                    Max Shell ID: {maxShellID} mm
                    {maxShellID < 1800 ? ' ⚠ (below 1,800mm man-entry)' : ''} | Total Area:{' '}
                    {totalArea.toFixed(0)} m² | Recirc: {totalRecirc.toFixed(1)} T/h
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Effect</TableCell>
                        <TableCell align="right">Tubes</TableCell>
                        <TableCell align="right">Tube L (m)</TableCell>
                        <TableCell align="right">Shell ID (mm)</TableCell>
                        <TableCell align="right">Inst. Area (m²)</TableCell>
                        <TableCell align="right">Margin</TableCell>
                        <TableCell align="right">Recirc (T/h)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow
                          key={r.effect}
                          sx={{ bgcolor: r.shellID === maxShellID ? 'action.selected' : undefined }}
                        >
                          <TableCell>E{r.effect}</TableCell>
                          <TableCell align="right">{r.tubes}</TableCell>
                          <TableCell align="right">{r.tubeLength.toFixed(1)}</TableCell>
                          <TableCell align="right">
                            {r.shellID}
                            {r.shellID < 1800 ? ' ⚠' : ''}
                          </TableCell>
                          <TableCell align="right">{r.instArea.toFixed(0)}</TableCell>
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
                </Box>
              );
            })()}
          </Paper>

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

          {/* Preheater Contribution to Distillate */}
          {detail.preheaterContributions && detail.preheaterContributions.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Preheater Effect on Distillate Production
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Each preheater raises the spray temperature, reducing sensible heating inside the
                effect and increasing latent heat available for evaporation.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Preheater</TableCell>
                    <TableCell align="right">Temp Rise (&deg;C)</TableCell>
                    <TableCell align="right">Extra Distillate (%)</TableCell>
                    <TableCell align="right">Cumulative (%)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.preheaterContributions.map((pc) => (
                    <TableRow key={pc.phId}>
                      <TableCell>PH-{pc.phId}</TableCell>
                      <TableCell align="right">{pc.tempRise.toFixed(1)}</TableCell>
                      <TableCell align="right">+{pc.extraDistillatePercent.toFixed(1)}%</TableCell>
                      <TableCell align="right">+{pc.cumulativePercent.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

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
                      <TableCell>U-value</TableCell>
                      <TableCell align="right">
                        {fmt(detail.condenser.overallU, 0)} W/(m&sup2;&middot;K)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Tubes / Passes</TableCell>
                      <TableCell align="right">
                        {detail.condenser.tubes} tubes, {detail.condenser.passes} passes
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Velocity</TableCell>
                      <TableCell align="right">{fmt(detail.condenser.velocity, 2)} m/s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SW Flow</TableCell>
                      <TableCell align="right">
                        {fmt(detail.condenser.seawaterFlowM3h, 0)} m&sup3;/h
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Ti Tube</TableCell>
                      <TableCell align="right">
                        {detail.condenser.tubeOD} mm OD &times; {detail.condenser.tubeLengthMM} mm L
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Pass Options */}
                {detail.condenser.passOptions && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Pass options (Ti {detail.condenser.tubeOD}mm &times;{' '}
                      {detail.condenser.tubeLengthMM}mm):
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Passes</TableCell>
                          <TableCell align="right">Tubes</TableCell>
                          <TableCell align="right">Vel (m/s)</TableCell>
                          <TableCell align="right">U (W/m&sup2;K)</TableCell>
                          <TableCell align="right">Area (m&sup2;)</TableCell>
                          <TableCell align="right">Shell (mm)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detail.condenser.passOptions.map((po) => (
                          <TableRow
                            key={po.passes}
                            sx={{
                              bgcolor:
                                po.passes === detail.condenser.passes
                                  ? 'action.selected'
                                  : undefined,
                              fontWeight: po.inRange ? 600 : 400,
                            }}
                          >
                            <TableCell>{po.passes}</TableCell>
                            <TableCell align="right">{po.totalTubes}</TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: po.inRange ? 'success.main' : 'text.secondary' }}
                            >
                              {po.velocity.toFixed(2)}
                            </TableCell>
                            <TableCell align="right">{po.calculatedU?.toFixed(0) ?? '—'}</TableCell>
                            <TableCell align="right">{po.area.toFixed(1)}</TableCell>
                            <TableCell align="right">{po.shellODmm}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
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
                        <TableCell align="right">Flow (T/h)</TableCell>
                        <TableCell align="right">Duty (kW)</TableCell>
                        <TableCell align="right">Tubes</TableCell>
                        <TableCell align="right">Passes</TableCell>
                        <TableCell align="right">Vel (m/s)</TableCell>
                        <TableCell align="right">U (W/m&sup2;K)</TableCell>
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
                          <TableCell align="right">{fmt(ph.flowTh)}</TableCell>
                          <TableCell align="right">{fmt(ph.duty, 0)}</TableCell>
                          <TableCell align="right">{ph.tubes}</TableCell>
                          <TableCell align="right">{ph.passes}</TableCell>
                          <TableCell align="right">{fmt(ph.velocity, 2)}</TableCell>
                          <TableCell align="right">
                            {ph.passOptions
                              ?.find((p) => p.passes === ph.passes)
                              ?.calculatedU?.toFixed(0) ?? '—'}
                          </TableCell>
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
