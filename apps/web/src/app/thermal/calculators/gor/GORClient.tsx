'use client';

/**
 * Performance Ratio / GOR Calculator
 *
 * Estimates the Gain Output Ratio (GOR) and thermal performance
 * of a Multi-Effect Distillation (MED) plant.
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  TextField,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Button,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, FolderOpen as LoadIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateGOR,
  PLANT_CONFIGURATIONS,
  TYPICAL_RANGES,
  type PlantConfiguration,
  type GORResult,
} from '@/lib/thermal/gorCalculator';
import { getSaturationTemperature } from '@vapour/constants';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONFIGURATIONS = Object.entries(PLANT_CONFIGURATIONS) as [
  PlantConfiguration,
  { label: string; description: string },
][];

function getGORRating(
  gor: number,
  config: PlantConfiguration
): { label: string; color: 'success' | 'warning' | 'error' | 'info' } {
  const range = config === 'MED_TVC' ? TYPICAL_RANGES.GOR_MED_TVC : TYPICAL_RANGES.GOR_MED;
  if (gor >= range.min && gor <= range.max) return { label: 'Typical', color: 'success' };
  if (gor < range.min) return { label: 'Below typical', color: 'warning' };
  return { label: 'Above typical', color: 'info' };
}

// ── SVG Temperature Profile Chart ────────────────────────────────────────────

function TemperatureProfileChart({ effects }: { effects: GORResult['effects'] }) {
  const N = effects.length;
  const chartWidth = 500;
  const chartHeight = 220;
  const marginLeft = 50;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 35;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Find temperature range
  const maxTemp = Math.max(...effects.map((e) => e.steamTemperature));
  const minTemp = Math.min(...effects.map((e) => e.temperature - 2));
  const tempRange = maxTemp - minTemp || 1;

  const barWidth = Math.min(plotWidth / N - 4, 40);
  const barGap = (plotWidth - barWidth * N) / (N + 1);

  const yScale = (temp: number) =>
    marginTop + plotHeight - ((temp - minTemp) / tempRange) * plotHeight;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const temp = minTemp + (tempRange * i) / tickCount;
    return { temp: Math.round(temp), y: yScale(temp) };
  });

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', my: 1 }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
        style={{ maxWidth: chartWidth }}
      >
        {/* Y-axis grid and labels */}
        {yTicks.map(({ temp, y }) => (
          <g key={temp}>
            <line
              x1={marginLeft}
              y1={y}
              x2={chartWidth - marginRight}
              y2={y}
              stroke="#e0e0e0"
              strokeWidth={0.5}
            />
            <text x={marginLeft - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#666">
              {temp}
            </text>
          </g>
        ))}
        {/* Y-axis label */}
        <text
          x={12}
          y={marginTop + plotHeight / 2}
          textAnchor="middle"
          fontSize={9}
          fill="#666"
          transform={`rotate(-90 12 ${marginTop + plotHeight / 2})`}
        >
          Temperature (&deg;C)
        </text>

        {/* Bars */}
        {effects.map((e, i) => {
          const x = marginLeft + barGap + i * (barWidth + barGap);
          const yTop = yScale(e.temperature);
          const yBot = yScale(minTemp);
          const barHeight = yBot - yTop;

          // BPE loss band (red) on top
          const bpeHeight = (e.bpElevation / tempRange) * plotHeight;
          // Usable portion (blue)
          const usableHeight = Math.max(barHeight - bpeHeight, 0);

          return (
            <g key={e.effectNumber}>
              {/* Usable driving force */}
              <rect
                x={x}
                y={yTop + bpeHeight}
                width={barWidth}
                height={usableHeight}
                fill="#1976d2"
                opacity={0.7}
                rx={2}
              />
              {/* BPE loss band */}
              <rect
                x={x}
                y={yTop}
                width={barWidth}
                height={bpeHeight}
                fill="#d32f2f"
                opacity={0.5}
                rx={2}
              />
              {/* Temperature label */}
              <text x={x + barWidth / 2} y={yTop - 4} textAnchor="middle" fontSize={8} fill="#333">
                {e.temperature.toFixed(1)}
              </text>
              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - marginBottom + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#666"
              >
                {e.effectNumber}
              </text>
            </g>
          );
        })}

        {/* X-axis label */}
        <text
          x={marginLeft + plotWidth / 2}
          y={chartHeight - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#666"
        >
          Effect Number
        </text>

        {/* Legend */}
        <rect
          x={chartWidth - marginRight - 130}
          y={marginTop}
          width={10}
          height={10}
          fill="#1976d2"
          opacity={0.7}
          rx={1}
        />
        <text x={chartWidth - marginRight - 116} y={marginTop + 9} fontSize={8} fill="#666">
          Effective &Delta;T
        </text>
        <rect
          x={chartWidth - marginRight - 130}
          y={marginTop + 14}
          width={10}
          height={10}
          fill="#d32f2f"
          opacity={0.5}
          rx={1}
        />
        <text x={chartWidth - marginRight - 116} y={marginTop + 23} fontSize={8} fill="#666">
          BPE Loss
        </text>
      </svg>
    </Box>
  );
}

// ── Temperature Loss Budget Bar ──────────────────────────────────────────────

function LossBudgetBar({ result }: { result: GORResult }) {
  const total = result.availableDeltaT || 1;
  const bpePct = (result.totalBPELoss / total) * 100;
  const neaPct = (result.totalNEALoss / total) * 100;
  const effPct = (result.effectiveDeltaT / total) * 100;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', height: 24, borderRadius: 1, overflow: 'hidden' }}>
        <Box
          sx={{
            width: `${effPct}%`,
            bgcolor: '#1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem' }}>
            Eff. {result.effectiveDeltaT.toFixed(1)}&deg;C
          </Typography>
        </Box>
        <Box
          sx={{
            width: `${bpePct}%`,
            bgcolor: '#d32f2f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem' }}>
            BPE {result.totalBPELoss.toFixed(1)}
          </Typography>
        </Box>
        <Box
          sx={{
            width: `${neaPct}%`,
            bgcolor: '#ed6c02',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem' }}>
            NEA {result.totalNEALoss.toFixed(1)}
          </Typography>
        </Box>
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#1976d2' }}>
          Effective: {effPct.toFixed(1)}%
        </Typography>
        <Typography variant="caption" sx={{ color: '#d32f2f' }}>
          BPE: {bpePct.toFixed(1)}%
        </Typography>
        <Typography variant="caption" sx={{ color: '#ed6c02' }}>
          NEA: {neaPct.toFixed(1)}%
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function GORClient() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [numberOfEffects, setNumberOfEffects] = useState('6');
  const [configuration, setConfiguration] = useState<PlantConfiguration>('MED_PARALLEL');
  const [topBrineTemperature, setTopBrineTemperature] = useState('65');
  const [lastEffectTemperature, setLastEffectTemperature] = useState('40');
  const [seawaterTemperature, setSeawaterTemperature] = useState('28');
  const [steamPressure, setSteamPressure] = useState('2.5');
  const [feedSalinity, setFeedSalinity] = useState('35000');
  const [maxBrineSalinity, setMaxBrineSalinity] = useState('65000');
  const [condenserApproach, setCondenserApproach] = useState('4');
  const [condenserTTD, setCondenserTTD] = useState('3');
  const [tvcEntrainmentRatio, setTvcEntrainmentRatio] = useState('1.0');
  const [tvcCompressionRatio, setTvcCompressionRatio] = useState('');
  const [distillateCapacity, setDistillateCapacity] = useState('');

  // Dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────

  const steamSatTemp = useMemo(() => {
    const p = parseFloat(steamPressure);
    if (isNaN(p) || p <= 0) return null;
    try {
      return getSaturationTemperature(p);
    } catch {
      return null;
    }
  }, [steamPressure]);

  const calculatedRecovery = useMemo(() => {
    const feed = parseFloat(feedSalinity);
    const maxBrine = parseFloat(maxBrineSalinity);
    if (isNaN(feed) || isNaN(maxBrine) || maxBrine <= feed || feed <= 0) return null;
    return 1 - feed / maxBrine;
  }, [feedSalinity, maxBrineSalinity]);

  // ── Calculation ────────────────────────────────────────────────────────────

  const calcResult = useMemo<{ result: GORResult | null; error: string | null }>(() => {
    try {
      const n = parseInt(numberOfEffects, 10);
      const tbt = parseFloat(topBrineTemperature);
      const tLast = parseFloat(lastEffectTemperature);
      const tsw = parseFloat(seawaterTemperature);
      const sp = parseFloat(steamPressure);
      const fs = parseFloat(feedSalinity);
      const mbs = parseFloat(maxBrineSalinity);
      const ca = parseFloat(condenserApproach);
      const cttd = parseFloat(condenserTTD);

      if ([n, tbt, tLast, tsw, sp, fs, mbs, ca, cttd].some(isNaN)) {
        return { result: null, error: null };
      }

      const cap = parseFloat(distillateCapacity);
      const ra = parseFloat(tvcEntrainmentRatio);
      const cr = parseFloat(tvcCompressionRatio);

      const result = calculateGOR({
        numberOfEffects: n,
        configuration,
        topBrineTemperature: tbt,
        lastEffectTemperature: tLast,
        seawaterTemperature: tsw,
        steamPressure: sp,
        feedSalinity: fs,
        maxBrineSalinity: mbs,
        condenserApproach: ca,
        condenserTTD: cttd,
        ...(configuration === 'MED_TVC' && !isNaN(ra) && { tvcEntrainmentRatio: ra }),
        ...(configuration === 'MED_TVC' && !isNaN(cr) && { tvcCompressionRatio: cr }),
        ...(!isNaN(cap) && cap > 0 && { distillateCapacity: cap }),
      });

      return { result, error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    numberOfEffects,
    configuration,
    topBrineTemperature,
    lastEffectTemperature,
    seawaterTemperature,
    steamPressure,
    feedSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserTTD,
    tvcEntrainmentRatio,
    tvcCompressionRatio,
    distillateCapacity,
  ]);

  const { result, error } = calcResult;

  // ── Report inputs ──────────────────────────────────────────────────────────

  const reportInputs = useMemo(
    () => ({
      numberOfEffects,
      configuration,
      topBrineTemperature,
      lastEffectTemperature,
      seawaterTemperature,
      steamPressure,
      feedSalinity,
      maxBrineSalinity,
      condenserApproach,
      condenserTTD,
      tvcEntrainmentRatio,
      tvcCompressionRatio,
      distillateCapacity,
      steamSatTemp,
    }),
    [
      numberOfEffects,
      configuration,
      topBrineTemperature,
      lastEffectTemperature,
      seawaterTemperature,
      steamPressure,
      feedSalinity,
      maxBrineSalinity,
      condenserApproach,
      condenserTTD,
      tvcEntrainmentRatio,
      tvcCompressionRatio,
      distillateCapacity,
      steamSatTemp,
    ]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <CalculatorBreadcrumb calculatorName="Performance Ratio / GOR" />

      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Performance Ratio / GOR
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gain Output Ratio estimation and thermal performance analysis for MED desalination
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<LoadIcon />} onClick={() => setLoadOpen(true)}>
            Load Saved
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* ── Left Column: Inputs ─────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* Plant Configuration */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Plant Configuration
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Configuration"
                  value={configuration}
                  onChange={(e) => setConfiguration(e.target.value as PlantConfiguration)}
                  fullWidth
                  size="small"
                >
                  {CONFIGURATIONS.map(([key, { label, description }]) => (
                    <MenuItem key={key} value={key}>
                      <Box>
                        <Typography variant="body2">{label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Number of Effects"
                  type="number"
                  value={numberOfEffects}
                  onChange={(e) => setNumberOfEffects(e.target.value)}
                  inputProps={{ min: 2, max: 16, step: 1 }}
                  helperText={`Typical: ${TYPICAL_RANGES.EFFECTS.min}\u2013${TYPICAL_RANGES.EFFECTS.max}`}
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>

            {/* Temperature Parameters */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Temperature Parameters
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Top Brine Temperature (\u00B0C)"
                  type="number"
                  value={topBrineTemperature}
                  onChange={(e) => setTopBrineTemperature(e.target.value)}
                  helperText={`Typical: ${TYPICAL_RANGES.TBT.min}\u2013${TYPICAL_RANGES.TBT.max} \u00B0C`}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Last Effect Temperature (\u00B0C)"
                  type="number"
                  value={lastEffectTemperature}
                  onChange={(e) => setLastEffectTemperature(e.target.value)}
                  helperText={`Typical: ${TYPICAL_RANGES.LAST_EFFECT_TEMP.min}\u2013${TYPICAL_RANGES.LAST_EFFECT_TEMP.max} \u00B0C`}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Seawater Temperature (\u00B0C)"
                  type="number"
                  value={seawaterTemperature}
                  onChange={(e) => setSeawaterTemperature(e.target.value)}
                  helperText="Intake seawater temperature"
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Steam Pressure (bar abs)"
                  type="number"
                  value={steamPressure}
                  onChange={(e) => setSteamPressure(e.target.value)}
                  helperText={
                    steamSatTemp != null
                      ? `T_sat = ${steamSatTemp.toFixed(1)} \u00B0C`
                      : 'Enter a valid pressure'
                  }
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>

            {/* Feed & Concentration */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Feed &amp; Concentration
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Feed Salinity (ppm)"
                  type="number"
                  value={feedSalinity}
                  onChange={(e) => setFeedSalinity(e.target.value)}
                  helperText="Typical seawater: 35,000\u201345,000 ppm"
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Max Brine Salinity (ppm)"
                  type="number"
                  value={maxBrineSalinity}
                  onChange={(e) => setMaxBrineSalinity(e.target.value)}
                  helperText={
                    calculatedRecovery != null
                      ? `Recovery = ${(calculatedRecovery * 100).toFixed(1)}%`
                      : 'Must exceed feed salinity'
                  }
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>

            {/* Condenser */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Condenser
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Condenser Approach (\u00B0C)"
                  type="number"
                  value={condenserApproach}
                  onChange={(e) => setCondenserApproach(e.target.value)}
                  helperText={`Typical: ${TYPICAL_RANGES.CONDENSER_APPROACH.min}\u2013${TYPICAL_RANGES.CONDENSER_APPROACH.max} \u00B0C`}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Terminal Temperature Difference (\u00B0C)"
                  type="number"
                  value={condenserTTD}
                  onChange={(e) => setCondenserTTD(e.target.value)}
                  helperText="Condenser terminal temperature difference"
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>

            {/* TVC Parameters */}
            {configuration === 'MED_TVC' && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  TVC Parameters
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Entrainment Ratio (Ra)"
                    type="number"
                    value={tvcEntrainmentRatio}
                    onChange={(e) => setTvcEntrainmentRatio(e.target.value)}
                    helperText="kg entrained vapor / kg motive steam (typical 0.8\u20131.5)"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Compression Ratio (optional)"
                    type="number"
                    value={tvcCompressionRatio}
                    onChange={(e) => setTvcCompressionRatio(e.target.value)}
                    helperText="Discharge pressure / suction pressure"
                    fullWidth
                    size="small"
                  />
                </Stack>
              </Paper>
            )}

            {/* Plant Capacity (optional) */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Plant Capacity
                <Chip label="Optional" size="small" variant="outlined" sx={{ ml: 1 }} />
              </Typography>
              <TextField
                label="Distillate Capacity (m\u00B3/day)"
                type="number"
                value={distillateCapacity}
                onChange={(e) => setDistillateCapacity(e.target.value)}
                helperText="If provided, absolute mass flow rates will be calculated"
                fullWidth
                size="small"
              />
            </Paper>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => setSaveOpen(true)}
                disabled={!result}
              >
                Save
              </Button>
              <Button
                variant="contained"
                onClick={() => setReportDialogOpen(true)}
                disabled={!result}
              >
                Generate Report
              </Button>
            </Stack>
          </Stack>
        </Grid>

        {/* ── Right Column: Results ───────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            {/* Error */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* No result yet */}
            {!result && !error && (
              <Alert severity="info">Enter valid inputs to see performance results.</Alert>
            )}

            {result && (
              <>
                {/* Key Performance Metrics */}
                <Card
                  sx={{
                    border: '2px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      Key Performance Metrics
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h2" color="primary.main" sx={{ fontWeight: 700 }}>
                        {result.gor.toFixed(2)}
                      </Typography>
                      <Box>
                        <Typography variant="h6" color="text.secondary">
                          GOR
                        </Typography>
                        <Chip
                          label={getGORRating(result.gor, configuration).label}
                          color={getGORRating(result.gor, configuration).color}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          STE (kJ/kg)
                        </Typography>
                        <Typography variant="h6">
                          {result.specificThermalEnergy.toFixed(1)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          STE (kWh/m&sup3;)
                        </Typography>
                        <Typography variant="h6">
                          {result.specificThermalEnergy_kWh.toFixed(1)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Thermal Efficiency
                        </Typography>
                        <Typography variant="h6">
                          {(result.thermalEfficiency * 100).toFixed(1)}%
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Total Recovery
                        </Typography>
                        <Typography variant="h6">
                          {(result.totalRecovery * 100).toFixed(1)}%
                        </Typography>
                      </Grid>
                    </Grid>
                    {result.tvcBoost != null && (
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={`TVC Boost: \u00D7${result.tvcBoost.toFixed(2)}`}
                          color="info"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Temperature Profile Chart */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Effect Temperature Profile
                  </Typography>
                  <TemperatureProfileChart effects={result.effects} />
                </Paper>

                {/* Effect Details Table */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Effect Details
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell align="right">Temp (&deg;C)</TableCell>
                          <TableCell align="right">Steam (&deg;C)</TableCell>
                          <TableCell align="right">BPE (&deg;C)</TableCell>
                          <TableCell align="right">NEA (&deg;C)</TableCell>
                          <TableCell align="right">Eff. &Delta;T (&deg;C)</TableCell>
                          <TableCell align="right">L (kJ/kg)</TableCell>
                          <TableCell align="right">Salinity (ppm)</TableCell>
                          <TableCell align="right">Dist. %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.effects.map((e) => (
                          <TableRow
                            key={e.effectNumber}
                            sx={{
                              bgcolor:
                                e.effectNumber === 1 || e.effectNumber === result.effects.length
                                  ? 'action.hover'
                                  : undefined,
                            }}
                          >
                            <TableCell>{e.effectNumber}</TableCell>
                            <TableCell align="right">{e.temperature.toFixed(1)}</TableCell>
                            <TableCell align="right">{e.steamTemperature.toFixed(1)}</TableCell>
                            <TableCell align="right">{e.bpElevation.toFixed(2)}</TableCell>
                            <TableCell align="right">{e.neAllowance.toFixed(2)}</TableCell>
                            <TableCell align="right">{e.effectiveDeltaT.toFixed(2)}</TableCell>
                            <TableCell align="right">{e.latentHeat.toFixed(1)}</TableCell>
                            <TableCell align="right">
                              {Math.round(e.salinity).toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              {(e.distillateRate * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                {/* Temperature Loss Budget */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Temperature Loss Budget
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Available &Delta;T</TableCell>
                          <TableCell align="right">
                            {result.availableDeltaT.toFixed(1)} &deg;C
                          </TableCell>
                          <TableCell align="right">100%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total BPE Loss</TableCell>
                          <TableCell align="right">
                            {result.totalBPELoss.toFixed(1)} &deg;C
                          </TableCell>
                          <TableCell align="right">
                            {(
                              (result.totalBPELoss / Math.max(result.availableDeltaT, 0.01)) *
                              100
                            ).toFixed(1)}
                            %
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total NEA Loss</TableCell>
                          <TableCell align="right">
                            {result.totalNEALoss.toFixed(1)} &deg;C
                          </TableCell>
                          <TableCell align="right">
                            {(
                              (result.totalNEALoss / Math.max(result.availableDeltaT, 0.01)) *
                              100
                            ).toFixed(1)}
                            %
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Effective &Delta;T</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {result.effectiveDeltaT.toFixed(1)} &deg;C
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {(
                              (result.effectiveDeltaT / Math.max(result.availableDeltaT, 0.01)) *
                              100
                            ).toFixed(1)}
                            %
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Mean &Delta;T per Effect</TableCell>
                          <TableCell align="right">
                            {result.meanEffectiveDeltaT.toFixed(2)} &deg;C
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <LossBudgetBar result={result} />
                </Paper>

                {/* Mass Flows */}
                {result.steamFlow != null && (
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Mass Flows
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Steam Flow</TableCell>
                            <TableCell align="right">{result.steamFlow!.toFixed(4)} kg/s</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Feed Flow</TableCell>
                            <TableCell align="right">{result.feedFlow!.toFixed(4)} kg/s</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Distillate Flow</TableCell>
                            <TableCell align="right">
                              {result.distillateFlow!.toFixed(4)} kg/s
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Brine Flow</TableCell>
                            <TableCell align="right">{result.brineFlow!.toFixed(4)} kg/s</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Cooling Water Flow</TableCell>
                            <TableCell align="right">
                              {result.coolingWaterFlow!.toFixed(4)} kg/s
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}

                {/* Specific Ratios */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Specific Ratios
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Specific Feed</TableCell>
                          <TableCell align="right">
                            {result.specificFeed.toFixed(2)} kg / kg distillate
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Specific Cooling Water</TableCell>
                          <TableCell align="right">
                            {result.specificCoolingWater.toFixed(2)} kg / kg distillate
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Condenser Duty</TableCell>
                          <TableCell align="right">
                            {result.condenserDuty.toFixed(1)} kJ/kg
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Stack spacing={1}>
                    {result.warnings.map((w, i) => (
                      <Alert key={i} severity="warning">
                        {w}
                      </Alert>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Grid>
      </Grid>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      {result && reportDialogOpen && (
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <GenerateReportDialog
            open={reportDialogOpen}
            onClose={() => setReportDialogOpen(false)}
            result={result}
            inputs={reportInputs}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="GOR"
        inputs={{
          numberOfEffects,
          configuration,
          topBrineTemperature,
          lastEffectTemperature,
          seawaterTemperature,
          steamPressure,
          feedSalinity,
          maxBrineSalinity,
          condenserApproach,
          condenserTTD,
          tvcEntrainmentRatio,
          tvcCompressionRatio,
          distillateCapacity,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="GOR"
        onLoad={(inputs) => {
          if (typeof inputs.numberOfEffects === 'string')
            setNumberOfEffects(inputs.numberOfEffects);
          if (typeof inputs.configuration === 'string')
            setConfiguration(inputs.configuration as PlantConfiguration);
          if (typeof inputs.topBrineTemperature === 'string')
            setTopBrineTemperature(inputs.topBrineTemperature);
          if (typeof inputs.lastEffectTemperature === 'string')
            setLastEffectTemperature(inputs.lastEffectTemperature);
          if (typeof inputs.seawaterTemperature === 'string')
            setSeawaterTemperature(inputs.seawaterTemperature);
          if (typeof inputs.steamPressure === 'string') setSteamPressure(inputs.steamPressure);
          if (typeof inputs.feedSalinity === 'string') setFeedSalinity(inputs.feedSalinity);
          if (typeof inputs.maxBrineSalinity === 'string')
            setMaxBrineSalinity(inputs.maxBrineSalinity);
          if (typeof inputs.condenserApproach === 'string')
            setCondenserApproach(inputs.condenserApproach);
          if (typeof inputs.condenserTTD === 'string') setCondenserTTD(inputs.condenserTTD);
          if (typeof inputs.tvcEntrainmentRatio === 'string')
            setTvcEntrainmentRatio(inputs.tvcEntrainmentRatio);
          if (typeof inputs.tvcCompressionRatio === 'string')
            setTvcCompressionRatio(inputs.tvcCompressionRatio);
          if (typeof inputs.distillateCapacity === 'string')
            setDistillateCapacity(inputs.distillateCapacity);
        }}
      />
    </Container>
  );
}
