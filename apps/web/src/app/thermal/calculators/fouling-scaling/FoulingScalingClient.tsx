'use client';

/**
 * Fouling & Scaling Prediction Calculator
 *
 * Evaluates CaSO4, CaCO3, and Mg(OH)2 scaling tendency across a temperature
 * range for thermal desalination (MED/MSF) design.
 */

import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
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
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateFoulingScaling,
  STANDARD_SEAWATER_CHEMISTRY,
  SCALING_THRESHOLDS,
  type FoulingScalingResult,
  type ScalingPoint,
} from '@/lib/thermal';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Status color helpers ────────────────────────────────────────────────────

function getCaSO4Color(status: ScalingPoint['CaSO4_status']): string {
  switch (status) {
    case 'safe':
      return '#2e7d32';
    case 'warning':
      return '#f57f17';
    case 'critical':
      return '#c62828';
  }
}

function getCaSO4BgColor(status: ScalingPoint['CaSO4_status']): string {
  switch (status) {
    case 'safe':
      return '#e8f5e9';
    case 'warning':
      return '#fff8e1';
    case 'critical':
      return '#ffebee';
  }
}

function getCaCO3Color(status: ScalingPoint['CaCO3_status']): string {
  switch (status) {
    case 'safe':
      return '#2e7d32';
    case 'warning':
      return '#f57f17';
    case 'scaling':
      return '#c62828';
  }
}

function getCaCO3BgColor(status: ScalingPoint['CaCO3_status']): string {
  switch (status) {
    case 'safe':
      return '#e8f5e9';
    case 'warning':
      return '#fff8e1';
    case 'scaling':
      return '#ffebee';
  }
}

function getTBTColor(tbt: number, tMax: number): string {
  if (tbt >= tMax) return '#2e7d32';
  if (tbt >= tMax - 10) return '#f57f17';
  return '#c62828';
}

function getTBTBgColor(tbt: number, tMax: number): string {
  if (tbt >= tMax) return '#e8f5e9';
  if (tbt >= tMax - 10) return '#fff8e1';
  return '#ffebee';
}

const SCALANT_LABELS: Record<string, string> = {
  CaSO4: 'CaSO\u2084',
  CaCO3: 'CaCO\u2083',
  MgOH2: 'Mg(OH)\u2082',
  none: 'None',
};

// ── SVG Chart Component ─────────────────────────────────────────────────────

function CaSO4Chart({ profile }: { profile: ScalingPoint[] }) {
  if (profile.length < 2) return null;

  const W = 560;
  const H = 280;
  const PAD = { top: 20, right: 30, bottom: 45, left: 55 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const temps = profile.map((p) => p.temperature);
  const sis = profile.map((p) => p.CaSO4_saturationIndex);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const siMax = Math.max(...sis, 1.2);

  const xScale = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const yScale = (si: number) => PAD.top + plotH - (si / siMax) * plotH;

  // Build path
  const points = profile.map((p) => `${xScale(p.temperature)},${yScale(p.CaSO4_saturationIndex)}`);
  const polyline = points.join(' ');

  // Zone boundaries
  const y08 = yScale(SCALING_THRESHOLDS.CaSO4_WARNING);
  const y10 = yScale(SCALING_THRESHOLDS.CaSO4_CRITICAL);
  const yBottom = PAD.top + plotH;
  const yTop = PAD.top;

  // Y-axis ticks
  const siTicks: number[] = [];
  const siStep = siMax > 2 ? 0.5 : siMax > 1.5 ? 0.25 : 0.2;
  for (let s = 0; s <= siMax; s += siStep) {
    siTicks.push(Math.round(s * 100) / 100);
  }

  // X-axis ticks
  const xTicks: number[] = [];
  const tStep = (tMax - tMin) / Math.min(profile.length - 1, 8);
  for (let t = tMin; t <= tMax + 0.01; t += tStep) {
    xTicks.push(Math.round(t * 10) / 10);
  }

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Zones */}
        <rect
          x={PAD.left}
          y={yTop}
          width={plotW}
          height={Math.max(0, y10 - yTop)}
          fill="#ffebee"
          opacity={0.4}
        />
        <rect
          x={PAD.left}
          y={y10}
          width={plotW}
          height={Math.max(0, y08 - y10)}
          fill="#fff8e1"
          opacity={0.4}
        />
        <rect
          x={PAD.left}
          y={y08}
          width={plotW}
          height={Math.max(0, yBottom - y08)}
          fill="#e8f5e9"
          opacity={0.4}
        />

        {/* Grid lines and Y-axis ticks */}
        {siTicks.map((s) => (
          <g key={`y-${s}`}>
            <line
              x1={PAD.left}
              y1={yScale(s)}
              x2={PAD.left + plotW}
              y2={yScale(s)}
              stroke="#e0e0e0"
              strokeWidth={0.5}
            />
            <text x={PAD.left - 8} y={yScale(s) + 4} textAnchor="end" fontSize={10} fill="#666">
              {s.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line
              x1={xScale(t)}
              y1={yBottom}
              x2={xScale(t)}
              y2={yBottom + 5}
              stroke="#666"
              strokeWidth={0.5}
            />
            <text x={xScale(t)} y={yBottom + 18} textAnchor="middle" fontSize={10} fill="#666">
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Threshold lines */}
        <line
          x1={PAD.left}
          y1={y10}
          x2={PAD.left + plotW}
          y2={y10}
          stroke="#c62828"
          strokeWidth={1}
          strokeDasharray="6,3"
        />
        <text x={PAD.left + plotW + 4} y={y10 + 4} fontSize={9} fill="#c62828">
          SI=1.0
        </text>

        <line
          x1={PAD.left}
          y1={y08}
          x2={PAD.left + plotW}
          y2={y08}
          stroke="#f57f17"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <text x={PAD.left + plotW + 4} y={y08 + 4} fontSize={9} fill="#f57f17">
          SI=0.85
        </text>

        {/* Data line */}
        <polyline points={polyline} fill="none" stroke="#1565c0" strokeWidth={2} />

        {/* Data points */}
        {profile.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.temperature)}
            cy={yScale(p.CaSO4_saturationIndex)}
            r={3.5}
            fill={getCaSO4Color(p.CaSO4_status)}
            stroke="#fff"
            strokeWidth={1}
          />
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={yTop} x2={PAD.left} y2={yBottom} stroke="#333" strokeWidth={1} />
        <line
          x1={PAD.left}
          y1={yBottom}
          x2={PAD.left + plotW}
          y2={yBottom}
          stroke="#333"
          strokeWidth={1}
        />

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#333">
          Temperature (&deg;C)
        </text>
        <text
          x={14}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#333"
          transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
        >
          CaSO&#x2084; Saturation Index
        </text>
      </svg>
    </Box>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FoulingScalingClient() {
  // Water chemistry
  const [feedSalinity, setFeedSalinity] = useState<string>('35000');
  const [calciumConcentration, setCalciumConcentration] = useState<string>('420');
  const [sulfateConcentration, setSulfateConcentration] = useState<string>('2700');
  const [bicarbonateAlkalinity, setBicarbonateAlkalinity] = useState<string>('140');
  const [magnesiumConcentration, setMagnesiumConcentration] = useState<string>('1290');
  const [pH, setPH] = useState<string>('8.1');

  // Operating range
  const [temperatureMin, setTemperatureMin] = useState<string>('40');
  const [temperatureMax, setTemperatureMax] = useState<string>('75');
  const [temperatureSteps, setTemperatureSteps] = useState<string>('8');

  // Concentration
  const [concentrationFactor, setConcentrationFactor] = useState<string>('1.5');

  // Antiscalant
  const [antiscalantDosed, setAntiscalantDosed] = useState<boolean>(false);
  const [antiscalantEfficiency, setAntiscalantEfficiency] = useState<string>('85');

  // Dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ── Main calculation ────────────────────────────────────────────────────────

  const computedResult = useMemo<{
    result: FoulingScalingResult | null;
    error: string | null;
  }>(() => {
    try {
      const sal = parseFloat(feedSalinity);
      const ca = parseFloat(calciumConcentration);
      const so4 = parseFloat(sulfateConcentration);
      const hco3 = parseFloat(bicarbonateAlkalinity);
      const mg = parseFloat(magnesiumConcentration);
      const phVal = parseFloat(pH);
      const tMin = parseFloat(temperatureMin);
      const tMax = parseFloat(temperatureMax);
      const steps = parseInt(temperatureSteps, 10);
      const cf = parseFloat(concentrationFactor);

      // Require at least salinity and calcium to be entered
      if (isNaN(sal) || sal <= 0) return { result: null, error: null };
      if (isNaN(ca) || ca <= 0) return { result: null, error: null };
      if (isNaN(so4) || so4 <= 0) return { result: null, error: null };
      if (isNaN(hco3) || hco3 <= 0) return { result: null, error: null };
      if (isNaN(mg) || mg <= 0) return { result: null, error: null };
      if (isNaN(phVal)) return { result: null, error: null };
      if (isNaN(tMin) || isNaN(tMax)) return { result: null, error: null };
      if (isNaN(steps) || steps < 2) return { result: null, error: null };
      if (isNaN(cf) || cf < 1) return { result: null, error: null };

      const efficiencyPct = parseFloat(antiscalantEfficiency);
      const efficiency =
        antiscalantDosed && !isNaN(efficiencyPct) ? efficiencyPct / 100 : undefined;

      const r = calculateFoulingScaling({
        feedSalinity: sal,
        calciumConcentration: ca,
        sulfateConcentration: so4,
        bicarbonateAlkalinity: hco3,
        magnesiumConcentration: mg,
        pH: phVal,
        temperatureMin: tMin,
        temperatureMax: tMax,
        temperatureSteps: steps,
        concentrationFactor: cf,
        antiscalantDosed,
        antiscalantEfficiency: efficiency,
      });
      return { result: r, error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    feedSalinity,
    calciumConcentration,
    sulfateConcentration,
    bicarbonateAlkalinity,
    magnesiumConcentration,
    pH,
    temperatureMin,
    temperatureMax,
    temperatureSteps,
    concentrationFactor,
    antiscalantDosed,
    antiscalantEfficiency,
  ]);

  // Sync error state
  useEffect(() => {
    setError(computedResult.error);
  }, [computedResult.error]);

  const calcResult = computedResult.result;

  // ── Standard seawater reset ─────────────────────────────────────────────────

  const handleUseStandardSeawater = () => {
    setFeedSalinity(String(STANDARD_SEAWATER_CHEMISTRY.salinity));
    setCalciumConcentration(String(STANDARD_SEAWATER_CHEMISTRY.calcium));
    setSulfateConcentration(String(STANDARD_SEAWATER_CHEMISTRY.sulfate));
    setBicarbonateAlkalinity(String(STANDARD_SEAWATER_CHEMISTRY.bicarbonate));
    setMagnesiumConcentration(String(STANDARD_SEAWATER_CHEMISTRY.magnesium));
    setPH(String(STANDARD_SEAWATER_CHEMISTRY.pH));
  };

  // ── Report inputs ───────────────────────────────────────────────────────────

  const reportInputs = useMemo(
    () => ({
      feedSalinity,
      calciumConcentration,
      sulfateConcentration,
      bicarbonateAlkalinity,
      magnesiumConcentration,
      pH,
      temperatureMin,
      temperatureMax,
      temperatureSteps,
      concentrationFactor,
      antiscalantDosed,
      antiscalantEfficiency,
    }),
    [
      feedSalinity,
      calciumConcentration,
      sulfateConcentration,
      bicarbonateAlkalinity,
      magnesiumConcentration,
      pH,
      temperatureMin,
      temperatureMax,
      temperatureSteps,
      concentrationFactor,
      antiscalantDosed,
      antiscalantEfficiency,
    ]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Fouling & Scaling Prediction" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Fouling &amp; Scaling Prediction
        </Typography>
        <Chip
          label="CaSO&#x2084; / CaCO&#x2083; / Mg(OH)&#x2082;"
          size="small"
          color="primary"
          variant="outlined"
        />
      </Stack>
      <Typography variant="body1" color="text.secondary">
        CaSO&#x2084;, CaCO&#x2083;, and Mg(OH)&#x2082; scaling tendency analysis for thermal
        desalination (MED/MSF) design.
      </Typography>
      <Button
        startIcon={<LoadIcon />}
        size="small"
        onClick={() => setLoadOpen(true)}
        sx={{ mt: 1, mb: 2 }}
      >
        Load Saved
      </Button>

      <Grid container spacing={3}>
        {/* ── Left: Inputs ── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            {/* Water Chemistry */}
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ScienceIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Water Chemistry
                  </Typography>
                </Stack>
                <Button size="small" variant="text" onClick={handleUseStandardSeawater}>
                  Use Standard Seawater
                </Button>
              </Stack>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <TextField
                  label="Feed Salinity"
                  value={feedSalinity}
                  onChange={(e) => setFeedSalinity(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          ppm TDS
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Calcium (Ca&#xB2;&#x207A;)"
                  value={calciumConcentration}
                  onChange={(e) => setCalciumConcentration(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Standard seawater: ~420 mg/L"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mg/L
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Sulfate (SO&#x2084;&#xB2;&#x207B;)"
                  value={sulfateConcentration}
                  onChange={(e) => setSulfateConcentration(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Standard seawater: ~2700 mg/L"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mg/L
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Bicarbonate Alkalinity"
                  value={bicarbonateAlkalinity}
                  onChange={(e) => setBicarbonateAlkalinity(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="As CaCO&#x2083;. Standard seawater: ~140 mg/L"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mg/L as CaCO&#x2083;
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Magnesium (Mg&#xB2;&#x207A;)"
                  value={magnesiumConcentration}
                  onChange={(e) => setMagnesiumConcentration(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Standard seawater: ~1290 mg/L"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mg/L
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="pH"
                  value={pH}
                  onChange={(e) => setPH(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Feed water pH. Standard seawater: ~8.1"
                  inputProps={{ step: 0.1 }}
                />
              </Stack>
            </Paper>

            {/* Operating Range */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Operating Range
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <TextField
                  label="Temperature Min"
                  value={temperatureMin}
                  onChange={(e) => setTemperatureMin(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          &deg;C
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Temperature Max"
                  value={temperatureMax}
                  onChange={(e) => setTemperatureMax(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          &deg;C
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Temperature Steps"
                  value={temperatureSteps}
                  onChange={(e) => setTemperatureSteps(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Number of evaluation points (2-50)"
                />
              </Stack>
            </Paper>

            {/* Concentration */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Concentration
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                label="Concentration Factor (CF)"
                value={concentrationFactor}
                onChange={(e) => setConcentrationFactor(e.target.value)}
                fullWidth
                size="small"
                type="number"
                helperText="Brine/feed ratio. Typical MED: 1.3-1.8, MSF: 1.1-1.5"
                inputProps={{ step: 0.1 }}
              />
            </Paper>

            {/* Antiscalant */}
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Antiscalant
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={antiscalantDosed}
                      onChange={(e) => setAntiscalantDosed(e.target.checked)}
                      size="small"
                    />
                  }
                  label=""
                />
              </Stack>
              <Divider sx={{ mb: 2 }} />

              {antiscalantDosed ? (
                <TextField
                  label="Antiscalant Efficiency"
                  value={antiscalantEfficiency}
                  onChange={(e) => setAntiscalantEfficiency(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Typical: 80-90%. Allows operation at higher SI thresholds."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          %
                        </Typography>
                      ),
                    },
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Enable to evaluate maximum TBT with antiscalant dosing.
                </Typography>
              )}
            </Paper>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* ── Right: Results ── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {calcResult ? (
            <Stack spacing={3}>
              {/* Maximum TBT — Primary Result */}
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Maximum Top Brine Temperature
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={() => setSaveOpen(true)}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => setReportDialogOpen(true)}
                    >
                      PDF Report
                    </Button>
                  </Stack>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2} mb={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box
                      sx={{
                        bgcolor: getTBTBgColor(
                          calcResult.maxTBT_noAntiscalant,
                          parseFloat(temperatureMax)
                        ),
                        border: `1.5px solid ${getTBTColor(calcResult.maxTBT_noAntiscalant, parseFloat(temperatureMax))}`,
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block">
                        Max TBT (no antiscalant)
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color={getTBTColor(
                          calcResult.maxTBT_noAntiscalant,
                          parseFloat(temperatureMax)
                        )}
                      >
                        {calcResult.maxTBT_noAntiscalant.toFixed(1)} &deg;C
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box
                      sx={{
                        bgcolor: getTBTBgColor(
                          calcResult.maxTBT_withAntiscalant,
                          parseFloat(temperatureMax)
                        ),
                        border: `1.5px solid ${getTBTColor(calcResult.maxTBT_withAntiscalant, parseFloat(temperatureMax))}`,
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block">
                        Max TBT (with antiscalant)
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color={getTBTColor(
                          calcResult.maxTBT_withAntiscalant,
                          parseFloat(temperatureMax)
                        )}
                      >
                        {calcResult.maxTBT_withAntiscalant.toFixed(1)} &deg;C
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box
                      sx={{
                        bgcolor: '#e3f2fd',
                        border: '1.5px solid #1565c0',
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block">
                        Dominant Scalant
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary.dark">
                        {SCALANT_LABELS[calcResult.dominantScalant]}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Scaling Profile Table */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Scaling Profile
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          Temp (&deg;C)
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          CaSO&#x2084; SI
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          CaSO&#x2084; Status
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          LSI
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          CaCO&#x2083; Status
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          Mg(OH)&#x2082;
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          Fouling (m&sup2;&middot;K/W)
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calcResult.scalingProfile.map((pt, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {pt.temperature.toFixed(1)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {pt.CaSO4_saturationIndex.toFixed(4)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={pt.CaSO4_status}
                              size="small"
                              sx={{
                                bgcolor: getCaSO4BgColor(pt.CaSO4_status),
                                color: getCaSO4Color(pt.CaSO4_status),
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                                textTransform: 'capitalize',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                            {pt.LSI.toFixed(4)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={pt.CaCO3_status}
                              size="small"
                              sx={{
                                bgcolor: getCaCO3BgColor(pt.CaCO3_status),
                                color: getCaCO3Color(pt.CaCO3_status),
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                                textTransform: 'capitalize',
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {pt.MgOH2_risk ? (
                              <Chip
                                label="Risk"
                                size="small"
                                sx={{
                                  bgcolor: '#ffebee',
                                  color: '#c62828',
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                &mdash;
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                            {pt.recommendedFouling.toExponential(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* CaSO4 Saturation Chart */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  CaSO&#x2084; Saturation Index vs Temperature
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <CaSO4Chart profile={calcResult.scalingProfile} />
                <Stack direction="row" spacing={2} justifyContent="center" mt={1}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#2e7d32' }} />
                    <Typography variant="caption">Safe</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f57f17' }} />
                    <Typography variant="caption">Warning</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#c62828' }} />
                    <Typography variant="caption">Critical</Typography>
                  </Stack>
                </Stack>
              </Paper>

              {/* Brine Properties */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Brine Properties
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Brine Concentration
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.brineConcentration.toLocaleString()} ppm TDS
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Brine CaSO&#x2084;
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.brineCaSO4.toFixed(2)} mg/L
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        LSI at Max TBT
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.brineLSI_at_maxTBT.toFixed(4)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Concentration Factor
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {concentrationFactor}x
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Warnings */}
              {calcResult.warnings.length > 0 && (
                <Stack spacing={1}>
                  {calcResult.warnings.map((w, i) => (
                    <Alert key={i} severity="warning" sx={{ fontSize: '0.85rem' }}>
                      {w}
                    </Alert>
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <ScienceIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Enter Water Chemistry
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fill in the feed water analysis and operating parameters to evaluate scaling
                tendency across the temperature range.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Report Dialog */}
      {calcResult && reportDialogOpen && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportDialogOpen}
            onClose={() => setReportDialogOpen(false)}
            result={calcResult}
            inputs={reportInputs}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="FOULING_SCALING"
        inputs={{
          feedSalinity,
          calciumConcentration,
          sulfateConcentration,
          bicarbonateAlkalinity,
          magnesiumConcentration,
          pH,
          temperatureMin,
          temperatureMax,
          temperatureSteps,
          concentrationFactor,
          antiscalantDosed,
          antiscalantEfficiency,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="FOULING_SCALING"
        onLoad={(inputs) => {
          if (typeof inputs.feedSalinity === 'string') setFeedSalinity(inputs.feedSalinity);
          if (typeof inputs.calciumConcentration === 'string')
            setCalciumConcentration(inputs.calciumConcentration);
          if (typeof inputs.sulfateConcentration === 'string')
            setSulfateConcentration(inputs.sulfateConcentration);
          if (typeof inputs.bicarbonateAlkalinity === 'string')
            setBicarbonateAlkalinity(inputs.bicarbonateAlkalinity);
          if (typeof inputs.magnesiumConcentration === 'string')
            setMagnesiumConcentration(inputs.magnesiumConcentration);
          if (typeof inputs.pH === 'string') setPH(inputs.pH);
          if (typeof inputs.temperatureMin === 'string') setTemperatureMin(inputs.temperatureMin);
          if (typeof inputs.temperatureMax === 'string') setTemperatureMax(inputs.temperatureMax);
          if (typeof inputs.temperatureSteps === 'string')
            setTemperatureSteps(inputs.temperatureSteps);
          if (typeof inputs.concentrationFactor === 'string')
            setConcentrationFactor(inputs.concentrationFactor);
          if (typeof inputs.antiscalantDosed === 'boolean')
            setAntiscalantDosed(inputs.antiscalantDosed);
          if (typeof inputs.antiscalantEfficiency === 'string')
            setAntiscalantEfficiency(inputs.antiscalantEfficiency);
        }}
      />
    </Container>
  );
}
