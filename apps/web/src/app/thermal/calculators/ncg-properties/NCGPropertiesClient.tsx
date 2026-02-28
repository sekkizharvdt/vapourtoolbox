'use client';

/**
 * NCG Properties Calculator — interactive client component.
 *
 * Calculates thermophysical properties of NCG + water-vapour mixtures
 * for thermal desalination vacuum system design.
 *
 * Four input modes:
 *   1. Seawater feed → dissolved gas content via Weiss (1970)
 *   2. Dry NCG flow rate entered directly
 *   3. Total (wet) gas flow rate entered directly
 *   4. Split flows: both NCG and water vapour known → pressure derived via Dalton's law
 */

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
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  Tooltip,
  Button,
} from '@mui/material';
import {
  InfoOutlined as InfoIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Download as DownloadIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateNCGProperties, type NCGInputMode, type NCGResult } from '@/lib/thermal';
import { exportNCGToExcel, type NCGReportInputs } from '@/lib/thermal/ncgExcelExport';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';
import { GenerateReportDialog } from './components/GenerateReportDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

function fmtSci(value: number): string {
  return value.toExponential(3);
}

// ── Result display sub-components ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  color = '#f5f5f5',
  border = '#e0e0e0',
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
  border?: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: color,
        border: `1.5px solid ${border}`,
        borderRadius: 1,
        p: 1.5,
        textAlign: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {unit}
      </Typography>
    </Box>
  );
}

function ResultTable({
  rows,
}: {
  rows: { label: string; value: string; unit: string; note?: string }[];
}) {
  return (
    <Table size="small">
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} sx={{ '&:last-child td': { border: 0 } }}>
            <TableCell sx={{ py: 0.75, color: 'text.secondary', width: '55%' }}>
              {row.label}
              {row.note && (
                <Tooltip title={row.note} placement="right">
                  <InfoIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', opacity: 0.5 }} />
                </Tooltip>
              )}
            </TableCell>
            <TableCell align="right" sx={{ py: 0.75, fontWeight: 500 }}>
              {row.value}
            </TableCell>
            <TableCell sx={{ py: 0.75, color: 'text.secondary', width: '25%' }}>
              {row.unit}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NCGPropertiesClient() {
  // ── Input state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<NCGInputMode>('seawater');
  const [temperatureC, setTemperatureC] = useState('40');
  const [pressureBar, setPressureBar] = useState('0.075');
  const [useSatPressure, setUseSatPressure] = useState(true);

  // Seawater mode
  const [seawaterFlow, setSeawaterFlow] = useState('1000');
  const [seawaterTemp, setSeawaterTemp] = useState('28');
  const [salinity, setSalinity] = useState('35');

  // Dry NCG mode
  const [dryNcgFlow, setDryNcgFlow] = useState('10');

  // Wet NCG mode
  const [wetNcgFlow, setWetNcgFlow] = useState('50');

  // Split flows mode
  const [splitNcgFlow, setSplitNcgFlow] = useState('10');
  const [splitVapourFlow, setSplitVapourFlow] = useState('80');

  const [error, setError] = useState<string | null>(null);

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // ── Calculation ──────────────────────────────────────────────────────────────
  const result = useMemo((): NCGResult | null => {
    setError(null);
    try {
      const T = parseFloat(temperatureC);
      if (isNaN(T)) return null;

      // split_flows derives its own pressure — no pressureBar needed
      if (mode === 'split_flows') {
        const mNCG = parseFloat(splitNcgFlow);
        const mVapour = parseFloat(splitVapourFlow);
        if (isNaN(mNCG) || isNaN(mVapour)) return null;
        return calculateNCGProperties({
          mode,
          temperatureC: T,
          dryNcgFlowKgH: mNCG,
          vapourFlowKgH: mVapour,
        });
      }

      const P = parseFloat(pressureBar);
      if (isNaN(P)) return null;

      const baseInput = { mode, temperatureC: T, pressureBar: P, useSatPressure };

      if (mode === 'seawater') {
        const Q = parseFloat(seawaterFlow);
        const Tsw = parseFloat(seawaterTemp);
        const S = parseFloat(salinity);
        if (isNaN(Q) || isNaN(Tsw) || isNaN(S)) return null;
        return calculateNCGProperties({
          ...baseInput,
          seawaterFlowM3h: Q,
          seawaterTempC: Tsw,
          salinityGkg: S,
        });
      }

      if (mode === 'dry_ncg') {
        const Q = parseFloat(dryNcgFlow);
        if (isNaN(Q)) return null;
        return calculateNCGProperties({ ...baseInput, dryNcgFlowKgH: Q });
      }

      if (mode === 'wet_ncg') {
        const Q = parseFloat(wetNcgFlow);
        if (isNaN(Q)) return null;
        return calculateNCGProperties({ ...baseInput, wetNcgFlowKgH: Q });
      }

      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    mode,
    temperatureC,
    pressureBar,
    useSatPressure,
    seawaterFlow,
    seawaterTemp,
    salinity,
    dryNcgFlow,
    wetNcgFlow,
    splitNcgFlow,
    splitVapourFlow,
  ]);

  // ── Derived: inputs bundle for save/report ───────────────────────────────────
  const reportInputs: NCGReportInputs = {
    mode,
    temperatureC,
    pressureBar,
    useSatPressure,
    ...(mode === 'seawater' && {
      seawaterFlowM3h: seawaterFlow,
      seawaterTempC: seawaterTemp,
      salinityGkg: salinity,
    }),
    ...(mode === 'dry_ncg' && { dryNcgFlowKgH: dryNcgFlow }),
    ...(mode === 'wet_ncg' && { wetNcgFlowKgH: wetNcgFlow }),
    ...(mode === 'split_flows' && {
      splitNcgFlowKgH: splitNcgFlow,
      splitVapourFlowKgH: splitVapourFlow,
    }),
  };

  // ── Excel export handler ─────────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    if (!result) return;
    const blob = await exportNCGToExcel(result, reportInputs);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NCG_Properties_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Load saved calculation ───────────────────────────────────────────────────
  const handleLoad = (saved: Record<string, unknown>) => {
    if (saved.mode) setMode(saved.mode as NCGInputMode);
    if (saved.temperatureC !== undefined) setTemperatureC(String(saved.temperatureC));
    if (saved.pressureBar !== undefined) setPressureBar(String(saved.pressureBar));
    if (saved.useSatPressure !== undefined) setUseSatPressure(Boolean(saved.useSatPressure));
    if (saved.seawaterFlow !== undefined) setSeawaterFlow(String(saved.seawaterFlow));
    if (saved.seawaterTemp !== undefined) setSeawaterTemp(String(saved.seawaterTemp));
    if (saved.salinity !== undefined) setSalinity(String(saved.salinity));
    if (saved.dryNcgFlow !== undefined) setDryNcgFlow(String(saved.dryNcgFlow));
    if (saved.wetNcgFlow !== undefined) setWetNcgFlow(String(saved.wetNcgFlow));
    if (saved.splitNcgFlow !== undefined) setSplitNcgFlow(String(saved.splitNcgFlow));
    if (saved.splitVapourFlow !== undefined) setSplitVapourFlow(String(saved.splitVapourFlow));
  };

  // ── Inputs bundle for save ───────────────────────────────────────────────────
  const saveInputs: Record<string, unknown> = {
    mode,
    temperatureC,
    pressureBar,
    useSatPressure,
    seawaterFlow,
    seawaterTemp,
    salinity,
    dryNcgFlow,
    wetNcgFlow,
    splitNcgFlow,
    splitVapourFlow,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="NCG Properties" />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h4" component="h1">
            NCG Properties Calculator
          </Typography>
          <Chip label="Dalton / Weiss 1970" size="small" variant="outlined" color="primary" />
          <Chip label="Wilke / Wassiljewa" size="small" variant="outlined" color="primary" />
        </Stack>

        {/* Action buttons — shown when a result is available */}
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<LoadIcon />} onClick={() => setLoadDialogOpen(true)}>
            Load Saved
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={() => setSaveDialogOpen(true)}
            disabled={!result}
          >
            Save
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ExcelIcon />}
            onClick={handleExcelDownload}
            disabled={!result}
          >
            Excel
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setReportDialogOpen(true)}
            disabled={!result}
          >
            PDF Report
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Thermophysical properties of non-condensable gas + water-vapour mixtures in thermal
        desalination vacuum systems. NCG is treated as dry air (N₂ 78.09% · O₂ 20.95% · Ar 0.93%).
      </Typography>

      <Grid container spacing={3}>
        {/* ── LEFT: Inputs ─────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper sx={{ p: 2.5 }}>
            {/* Input mode selector */}
            <Typography variant="subtitle2" gutterBottom>
              Input Mode
            </Typography>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_e, v) => v && setMode(v)}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            >
              <ToggleButton value="seawater">Seawater Feed</ToggleButton>
              <ToggleButton value="dry_ncg">Dry NCG</ToggleButton>
              <ToggleButton value="wet_ncg">Wet NCG</ToggleButton>
              <ToggleButton value="split_flows">NCG + Vapour</ToggleButton>
            </ToggleButtonGroup>

            {/* ── Mixture conditions (common) ────────────────────────────── */}
            <Typography variant="subtitle2" gutterBottom>
              Mixture Conditions
            </Typography>

            <Stack spacing={2} mb={3}>
              <TextField
                label="Temperature"
                value={temperatureC}
                onChange={(e) => setTemperatureC(e.target.value)}
                size="small"
                fullWidth
                slotProps={{
                  input: { endAdornment: <Typography variant="caption">°C</Typography> },
                }}
              />

              {mode !== 'split_flows' && (
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={useSatPressure}
                        onChange={(e) => setUseSatPressure(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Set pressure as NCG partial pressure above P_sat(T)
                      </Typography>
                    }
                  />
                  <TextField
                    label={useSatPressure ? 'NCG Partial Pressure' : 'Total System Pressure (abs)'}
                    value={pressureBar}
                    onChange={(e) => setPressureBar(e.target.value)}
                    size="small"
                    fullWidth
                    helperText={
                      useSatPressure
                        ? 'P_total = P_sat(T) + this value'
                        : 'Must exceed P_sat at the specified temperature'
                    }
                    sx={{ mt: 1 }}
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">bar</Typography> },
                    }}
                  />
                </Box>
              )}
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            {/* ── Mode-specific inputs ───────────────────────────────────── */}
            {mode === 'seawater' && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Seawater Feed
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Seawater Flow Rate"
                    value={seawaterFlow}
                    onChange={(e) => setSeawaterFlow(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">m³/h</Typography> },
                    }}
                  />
                  <TextField
                    label="Seawater Inlet Temperature"
                    value={seawaterTemp}
                    onChange={(e) => setSeawaterTemp(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Temperature at which dissolved gas is released. Weiss (1970) valid 0–36 °C."
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">°C</Typography> },
                    }}
                  />
                  <TextField
                    label="Salinity"
                    value={salinity}
                    onChange={(e) => setSalinity(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Typical Red Sea / Arabian Gulf seawater: 40–45 g/kg"
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">g/kg</Typography> },
                    }}
                  />
                </Stack>
                <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon fontSize="small" />}>
                  The Weiss (1970) correlation gives dissolved gas at equilibrium with air at 1 atm.
                  All dissolved gas is assumed to be released into the vacuum system.
                </Alert>
              </>
            )}

            {mode === 'dry_ncg' && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Dry NCG Flow
                </Typography>
                <TextField
                  label="Dry NCG Mass Flow"
                  value={dryNcgFlow}
                  onChange={(e) => setDryNcgFlow(e.target.value)}
                  size="small"
                  fullWidth
                  helperText="Gas only — water vapour is added from mixture thermodynamics at T and P."
                  slotProps={{
                    input: { endAdornment: <Typography variant="caption">kg/h</Typography> },
                  }}
                />
              </>
            )}

            {mode === 'wet_ncg' && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Wet NCG Flow
                </Typography>
                <TextField
                  label="Total (Wet) Gas Flow"
                  value={wetNcgFlow}
                  onChange={(e) => setWetNcgFlow(e.target.value)}
                  size="small"
                  fullWidth
                  helperText="Total mass flow of NCG + water vapour. The split is derived from T and P."
                  slotProps={{
                    input: { endAdornment: <Typography variant="caption">kg/h</Typography> },
                  }}
                />
              </>
            )}

            {mode === 'split_flows' && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Known Flow Rates
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Dry NCG Mass Flow"
                    value={splitNcgFlow}
                    onChange={(e) => setSplitNcgFlow(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Gas only, no water vapour included."
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">kg/h</Typography> },
                    }}
                  />
                  <TextField
                    label="Water Vapour Mass Flow"
                    value={splitVapourFlow}
                    onChange={(e) => setSplitVapourFlow(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Must be positive. Total pressure is derived via Dalton's law."
                    slotProps={{
                      input: { endAdornment: <Typography variant="caption">kg/h</Typography> },
                    }}
                  />
                </Stack>
                <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon fontSize="small" />}>
                  Both flows known → system pressure is derived: P_total = P_sat(T) / y_H₂O
                </Alert>
              </>
            )}
          </Paper>
        </Grid>

        {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!result && !error && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Enter valid inputs to see results.</Typography>
            </Paper>
          )}

          {result && (
            <Stack spacing={2}>
              {/* ── Conditions ─────────────────────────────────────────────── */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  System Conditions
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <MetricCard
                      label="Temperature"
                      value={fmt(result.temperatureC, 1)}
                      unit="°C"
                      color="#e3f2fd"
                      border="#90caf9"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <MetricCard
                      label={mode === 'split_flows' ? 'Total Pressure (derived)' : 'Total Pressure'}
                      value={fmt(result.totalPressureBar, 4)}
                      unit="bar abs"
                      color="#fce4ec"
                      border="#f48fb1"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <MetricCard
                      label="Vapour P_sat"
                      value={fmt(result.satPressureBar, 4)}
                      unit="bar"
                      color="#f3e5f5"
                      border="#ce93d8"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <MetricCard
                      label="NCG Partial P"
                      value={fmt(result.ncgPartialPressureBar, 4)}
                      unit="bar"
                      color="#e8f5e9"
                      border="#a5d6a7"
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* ── Key Properties ─────────────────────────────────────────── */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Mixture Properties
                </Typography>
                <Grid container spacing={1.5} mb={2}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <MetricCard
                      label="Density"
                      value={fmt(result.density, 4)}
                      unit="kg/m³"
                      color="#fff3e0"
                      border="#ffcc80"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <MetricCard
                      label="Specific Volume"
                      value={fmt(result.specificVolume, 3)}
                      unit="m³/kg"
                      color="#fff3e0"
                      border="#ffcc80"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <MetricCard
                      label="Molar Mass"
                      value={fmt(result.mixMolarMass, 3)}
                      unit="g/mol"
                      color="#fff3e0"
                      border="#ffcc80"
                    />
                  </Grid>
                </Grid>

                <ResultTable
                  rows={[
                    {
                      label: 'Specific Enthalpy (h_mix)',
                      value: fmt(result.specificEnthalpy, 2),
                      unit: 'kJ/kg',
                      note: 'Reference: dry air @ 0 °C; liquid water @ 0 °C (IAPWS)',
                    },
                    {
                      label: '  └ Vapour enthalpy (h_g)',
                      value: fmt(result.vaporEnthalpy, 2),
                      unit: 'kJ/kg',
                    },
                    {
                      label: '  └ Air enthalpy (Cp·T)',
                      value: fmt(result.airEnthalpy, 2),
                      unit: 'kJ/kg',
                    },
                    {
                      label: 'Specific Heat (Cp)',
                      value: fmt(result.cpMix, 4),
                      unit: 'kJ/(kg·K)',
                    },
                    {
                      label: 'Specific Heat (Cv)',
                      value: fmt(result.cvMix, 4),
                      unit: 'kJ/(kg·K)',
                    },
                    { label: 'Heat Ratio γ = Cp/Cv', value: fmt(result.gammaMix, 4), unit: '—' },
                  ]}
                />
              </Paper>

              {/* ── Composition ────────────────────────────────────────────── */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Composition
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Component</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Mole Frac.
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Mass Frac.
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Partial P (bar)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Water Vapour (H₂O)</TableCell>
                      <TableCell align="right">{fmt(result.waterVapourMoleFrac, 4)}</TableCell>
                      <TableCell align="right">{fmt(result.waterVapourMassFrac, 4)}</TableCell>
                      <TableCell align="right">
                        {fmt(result.waterVapourPartialPressureBar, 5)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>NCG (Dry Air)</TableCell>
                      <TableCell align="right">{fmt(result.ncgMoleFrac, 4)}</TableCell>
                      <TableCell align="right">{fmt(result.ncgMassFrac, 4)}</TableCell>
                      <TableCell align="right">{fmt(result.ncgPartialPressureBar, 5)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        1.0000
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        1.0000
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {fmt(result.totalPressureBar, 5)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* ── Transport Properties ────────────────────────────────────── */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Transport Properties
                </Typography>
                <ResultTable
                  rows={[
                    {
                      label: 'Dynamic Viscosity (μ)',
                      value: fmt(result.dynamicViscosityPas * 1e6, 3),
                      unit: 'μPa·s',
                      note: "Wilke's mixing rule",
                    },
                    {
                      label: 'Thermal Conductivity (λ)',
                      value: fmt(result.thermalConductivityWmK * 1000, 3),
                      unit: 'mW/(m·K)',
                      note: 'Wassiljewa–Mason–Saxena mixing rule',
                    },
                    {
                      label: 'Prandtl Number (Pr)',
                      value: fmt(
                        (result.cpMix * 1000 * result.dynamicViscosityPas) /
                          result.thermalConductivityWmK,
                        3
                      ),
                      unit: '—',
                    },
                  ]}
                />
              </Paper>

              {/* ── Flow Breakdown ──────────────────────────────────────────── */}
              {result.totalFlowKgH !== null && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Flow Breakdown
                  </Typography>
                  <ResultTable
                    rows={[
                      {
                        label: 'Dry NCG',
                        value: fmt(result.dryNcgFlowKgH ?? 0, 4),
                        unit: 'kg/h',
                      },
                      {
                        label: 'Water Vapour',
                        value: fmt(result.waterVapourFlowKgH ?? 0, 4),
                        unit: 'kg/h',
                      },
                      {
                        label: 'Total (wet)',
                        value: fmt(result.totalFlowKgH, 4),
                        unit: 'kg/h',
                      },
                      {
                        label: 'Volumetric Flow (at T, P)',
                        value: fmt(result.volumetricFlowM3h ?? 0, 3),
                        unit: 'm³/h',
                      },
                    ]}
                  />
                </Paper>
              )}

              {/* ── Seawater Dissolution Info ───────────────────────────────── */}
              {result.seawaterInfo && (
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Typography variant="subtitle2">Dissolved Gas Content</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Weiss (1970) at {fmt(result.seawaterInfo.gasTempC, 1)} °C,{' '}
                      {result.seawaterInfo.salinityGkg} g/kg
                    </Typography>
                    {result.seawaterInfo.extrapolated && (
                      <Chip
                        label="Outside Weiss valid range (0–36 °C)"
                        size="small"
                        color="warning"
                      />
                    )}
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Gas</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          mL(STP)/L
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          mg/L
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>O₂</TableCell>
                        <TableCell align="right">{fmtSci(result.seawaterInfo.o2MlL)}</TableCell>
                        <TableCell align="right">{fmt(result.seawaterInfo.o2MgL, 3)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>N₂</TableCell>
                        <TableCell align="right">{fmtSci(result.seawaterInfo.n2MlL)}</TableCell>
                        <TableCell align="right">{fmt(result.seawaterInfo.n2MgL, 3)}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {fmtSci(result.seawaterInfo.o2MlL + result.seawaterInfo.n2MlL)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {fmt(result.seawaterInfo.totalGasMgL, 3)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Stack>
          )}
        </Grid>
      </Grid>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <SaveCalculationDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        inputs={saveInputs}
      />

      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={handleLoad}
      />

      {result && (
        <GenerateReportDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          result={result}
          inputs={reportInputs}
        />
      )}
    </Container>
  );
}
