'use client';

/**
 * Demister / Mist Eliminator Sizing Calculator
 *
 * Sizes demister pads using the Souders-Brown correlation.
 * Supports steam/water auto-lookup from saturation conditions
 * or manual density entry for other fluids.
 * Includes brine carryover estimation for desalination applications.
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
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardActionArea,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Water as WaterIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateDemisterSizing,
  calculateCarryoverComparison,
  DEFAULT_PAD_THICKNESS,
  type DemisterType,
  type DemisterOrientation,
  type VesselGeometry,
  type DemisterResult,
} from '@/lib/thermal';
import {
  getSaturationTemperature,
  getSaturationPressure,
  getDensityVapor,
  getDensityLiquid,
} from '@vapour/constants';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Demister type cards ───────────────────────────────────────────────────────

const DEMISTER_TYPES: {
  id: DemisterType;
  label: string;
  subtitle: string;
  kHoriz: string;
  kVert: string;
}[] = [
  {
    id: 'wire_mesh',
    label: 'Standard Wire Mesh',
    subtitle: 'Standard knitted wire — most common for MED effects',
    kHoriz: '0.107',
    kVert: '0.076',
  },
  {
    id: 'wire_mesh_hc',
    label: 'High-Capacity Wire Mesh',
    subtitle: 'High-capacity mesh — larger wire diameter, higher throughput',
    kHoriz: '0.140',
    kVert: '0.100',
  },
  {
    id: 'vane',
    label: 'Vane / Chevron Pack',
    subtitle: 'Vane / chevron pack — low pressure drop, high efficiency',
    kHoriz: '0.150',
    kVert: '0.100',
  },
  {
    id: 'structured',
    label: 'Structured Packing',
    subtitle: 'Structured packing — used in distillation / high-pressure systems',
    kHoriz: '0.120',
    kVert: '0.080',
  },
];

// ── Quality color helper ─────────────────────────────────────────────────────

function getQualityColor(assessment: string): string {
  switch (assessment) {
    case 'excellent':
      return '#2e7d32';
    case 'good':
      return '#1565c0';
    case 'marginal':
      return '#f57f17';
    case 'poor':
      return '#c62828';
    default:
      return '#666';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemisterClient() {
  // Fluid input mode
  const [fluidMode, setFluidMode] = useState<'saturation' | 'manual'>('saturation');

  // Saturation mode
  const [satInput, setSatInput] = useState<'pressure' | 'temperature'>('pressure');
  const [satPressure, setSatPressure] = useState<string>('0.08'); // bar a (typical MED last effect)
  const [satTemperature, setSatTemperature] = useState<string>('');

  // Manual mode
  const [manualVaporDensity, setManualVaporDensity] = useState<string>('');
  const [manualLiquidDensity, setManualLiquidDensity] = useState<string>('');

  // Common inputs
  const [vaporMassFlow, setVaporMassFlow] = useState<string>('');
  const [demisterType, setDemisterType] = useState<DemisterType>('wire_mesh');
  const [orientation, setOrientation] = useState<DemisterOrientation>('horizontal');
  const [designMargin, setDesignMargin] = useState<string>('80');
  const [geometry, setGeometry] = useState<VesselGeometry>('circular');
  const [rectWidth, setRectWidth] = useState<string>('');
  const [padThickness, setPadThickness] = useState<string>('');

  // Carryover inputs
  const [enableCarryover, setEnableCarryover] = useState(false);
  const [brineSalinity, setBrineSalinity] = useState<string>('70000');
  const [entrainmentMode, setEntrainmentMode] = useState<'estimate' | 'manual'>('estimate');
  const [manualEntrainment, setManualEntrainment] = useState<string>('0.5');

  // Report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Error state — synced via useEffect instead of inside useMemo
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setFluidMode('saturation');
    setSatInput('pressure');
    setSatPressure('0.08');
    setSatTemperature('');
    setManualVaporDensity('');
    setManualLiquidDensity('');
    setVaporMassFlow('');
    setDemisterType('wire_mesh');
    setOrientation('horizontal');
    setDesignMargin('80');
    setGeometry('circular');
    setRectWidth('');
    setPadThickness('');
    setEnableCarryover(false);
    setBrineSalinity('70000');
    setEntrainmentMode('estimate');
    setManualEntrainment('0.5');
  };

  // Reset pad thickness when demister type changes
  useEffect(() => {
    setPadThickness('');
  }, [demisterType]);

  // ── Steam table auto-lookup ─────────────────────────────────────────────────

  const steamProps = useMemo(() => {
    if (fluidMode !== 'saturation') return null;
    try {
      let tSat: number;
      if (satInput === 'pressure') {
        const p = parseFloat(satPressure);
        if (isNaN(p) || p <= 0) return null;
        tSat = getSaturationTemperature(p);
      } else {
        const t = parseFloat(satTemperature);
        if (isNaN(t) || t <= 0) return null;
        tSat = t;
        getSaturationPressure(t);
      }
      const rhoV = getDensityVapor(tSat);
      const rhoL = getDensityLiquid(tSat);
      return { tSat, rhoV, rhoL };
    } catch {
      return null;
    }
  }, [fluidMode, satInput, satPressure, satTemperature]);

  // ── Main calculation (error handling separated from useMemo) ────────────────
  const computedResult = useMemo<{ result: DemisterResult | null; error: string | null }>(() => {
    try {
      const flow = parseFloat(vaporMassFlow);
      if (isNaN(flow) || flow <= 0) return { result: null, error: null };

      const margin = parseFloat(designMargin) / 100;
      if (isNaN(margin) || margin <= 0 || margin > 1) return { result: null, error: null };

      let rhoV: number;
      let rhoL: number;

      if (fluidMode === 'saturation') {
        if (!steamProps) return { result: null, error: null };
        rhoV = steamProps.rhoV;
        rhoL = steamProps.rhoL;
      } else {
        rhoV = parseFloat(manualVaporDensity);
        rhoL = parseFloat(manualLiquidDensity);
        if (isNaN(rhoV) || rhoV <= 0 || isNaN(rhoL) || rhoL <= 0)
          return { result: null, error: null };
      }

      const thickness = padThickness ? parseFloat(padThickness) : undefined;

      const r = calculateDemisterSizing({
        vaporMassFlow: flow,
        vaporDensity: rhoV,
        liquidDensity: rhoL,
        demisterType,
        orientation,
        designMargin: margin,
        geometry,
        rectangleWidth: geometry === 'rectangular' ? parseFloat(rectWidth) || undefined : undefined,
        padThickness: thickness && thickness > 0 ? thickness : undefined,
        carryover: enableCarryover
          ? {
              brineSalinity: parseFloat(brineSalinity) || 0,
              primaryEntrainment:
                entrainmentMode === 'manual'
                  ? (parseFloat(manualEntrainment) || 0) / 100
                  : undefined,
            }
          : undefined,
      });
      return { result: r, error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    vaporMassFlow,
    fluidMode,
    steamProps,
    manualVaporDensity,
    manualLiquidDensity,
    demisterType,
    orientation,
    designMargin,
    geometry,
    rectWidth,
    padThickness,
    enableCarryover,
    brineSalinity,
    entrainmentMode,
    manualEntrainment,
  ]);

  // Sync error state from computed result
  useEffect(() => {
    setError(computedResult.error);
  }, [computedResult.error]);

  const calcResult = computedResult.result;

  const loadingColor =
    calcResult?.loadingStatus === 'high'
      ? 'error.main'
      : calcResult?.loadingStatus === 'low'
        ? 'warning.main'
        : 'success.main';

  // ── Carryover comparison across all demister types ────────────────────────

  const comparisonRows = useMemo(() => {
    if (!calcResult?.carryover) return null;
    return calculateCarryoverComparison(
      calcResult.carryover.primaryEntrainment,
      parseFloat(brineSalinity) || 0,
      calcResult.loadingFraction
    );
  }, [calcResult, brineSalinity]);

  // ── Collect inputs for report ──────────────────────────────────────────────

  const reportInputs = useMemo(
    () => ({
      fluidMode,
      satInput,
      satPressure,
      satTemperature,
      manualVaporDensity,
      manualLiquidDensity,
      vaporMassFlow,
      demisterType,
      orientation,
      designMargin,
      geometry,
      rectWidth,
      padThickness: padThickness || String(DEFAULT_PAD_THICKNESS[demisterType]),
      enableCarryover,
      brineSalinity,
      entrainmentMode,
      manualEntrainment,
      steamProps,
    }),
    [
      fluidMode,
      satInput,
      satPressure,
      satTemperature,
      manualVaporDensity,
      manualLiquidDensity,
      vaporMassFlow,
      demisterType,
      orientation,
      designMargin,
      geometry,
      rectWidth,
      padThickness,
      enableCarryover,
      brineSalinity,
      entrainmentMode,
      manualEntrainment,
      steamProps,
    ]
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Demister Sizing" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Demister / Mist Eliminator Sizing
        </Typography>
        <Chip label="Souders-Brown" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Size demister pads for flash chambers, evaporator effects, and separators. Includes brine
        carryover estimation for desalination applications.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
        <Button
          startIcon={<LoadIcon />}
          size="small"
          onClick={() => setLoadOpen(true)}
        >
          Load Saved
        </Button>
        <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
          Reset
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* ── Left: Inputs ── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            {/* Fluid properties */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Fluid Properties
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <ToggleButtonGroup
                value={fluidMode}
                exclusive
                onChange={(_, v) => v && setFluidMode(v)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              >
                <ToggleButton value="saturation">Steam / Sat. Water (auto-lookup)</ToggleButton>
                <ToggleButton value="manual">Manual Entry</ToggleButton>
              </ToggleButtonGroup>

              {fluidMode === 'saturation' && (
                <>
                  <ToggleButtonGroup
                    value={satInput}
                    exclusive
                    onChange={(_, v) => v && setSatInput(v)}
                    size="small"
                    sx={{ mb: 2 }}
                  >
                    <ToggleButton value="pressure">By Pressure</ToggleButton>
                    <ToggleButton value="temperature">By Temperature</ToggleButton>
                  </ToggleButtonGroup>

                  {satInput === 'pressure' ? (
                    <TextField
                      label="Saturation Pressure"
                      value={satPressure}
                      onChange={(e) => setSatPressure(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              bar a
                            </Typography>
                          ),
                        },
                      }}
                    />
                  ) : (
                    <TextField
                      label="Saturation Temperature"
                      value={satTemperature}
                      onChange={(e) => setSatTemperature(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              °C
                            </Typography>
                          ),
                        },
                      }}
                    />
                  )}

                  {steamProps && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        T_sat = {steamProps.tSat.toFixed(2)}°C &nbsp;|&nbsp; ρ_V ={' '}
                        {steamProps.rhoV.toFixed(4)} kg/m³ &nbsp;|&nbsp; ρ_L ={' '}
                        {steamProps.rhoL.toFixed(2)} kg/m³
                      </Typography>
                    </Box>
                  )}
                </>
              )}

              {fluidMode === 'manual' && (
                <Stack spacing={2}>
                  <TextField
                    label="Vapor Density (ρ_V)"
                    value={manualVaporDensity}
                    onChange={(e) => setManualVaporDensity(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            kg/m³
                          </Typography>
                        ),
                      },
                    }}
                  />
                  <TextField
                    label="Liquid Density (ρ_L)"
                    value={manualLiquidDensity}
                    onChange={(e) => setManualLiquidDensity(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            kg/m³
                          </Typography>
                        ),
                      },
                    }}
                  />
                </Stack>
              )}
            </Paper>

            {/* Demister type */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Demister Type
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {DEMISTER_TYPES.map((dt) => (
                  <Grid key={dt.id} size={{ xs: 12, sm: 6 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        border: '1.5px solid',
                        borderColor: demisterType === dt.id ? 'primary.main' : 'divider',
                        bgcolor: demisterType === dt.id ? 'primary.50' : 'background.paper',
                      }}
                    >
                      <CardActionArea onClick={() => setDemisterType(dt.id)} sx={{ p: 1.5 }}>
                        <CardContent sx={{ p: 0 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {dt.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {dt.subtitle}
                          </Typography>
                          <Typography variant="caption" color="primary" display="block" mt={0.5}>
                            K = {dt.kHoriz} (horiz) / {dt.kVert} (vert) m/s
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* Operating conditions */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Operating Conditions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  label="Vapor Mass Flow Rate"
                  value={vaporMassFlow}
                  onChange={(e) => setVaporMassFlow(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          kg/s
                        </Typography>
                      ),
                    },
                  }}
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Orientation</InputLabel>
                  <Select
                    value={orientation}
                    label="Orientation"
                    onChange={(e) => setOrientation(e.target.value as DemisterOrientation)}
                  >
                    <MenuItem value="horizontal">Horizontal (vapor flows horizontally)</MenuItem>
                    <MenuItem value="vertical">Vertical — upflow</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Design Margin"
                  value={designMargin}
                  onChange={(e) => setDesignMargin(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Operate at this % of V_max. Typical: 75–85%"
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

                <TextField
                  label="Pad Thickness"
                  value={padThickness}
                  onChange={(e) => setPadThickness(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  placeholder={String(DEFAULT_PAD_THICKNESS[demisterType])}
                  helperText={`Default: ${DEFAULT_PAD_THICKNESS[demisterType]} mm for ${demisterType.replace(/_/g, ' ')}`}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mm
                        </Typography>
                      ),
                    },
                  }}
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Vessel Geometry</InputLabel>
                  <Select
                    value={geometry}
                    label="Vessel Geometry"
                    onChange={(e) => setGeometry(e.target.value as VesselGeometry)}
                  >
                    <MenuItem value="circular">Circular (compute min. diameter)</MenuItem>
                    <MenuItem value="rectangular">Rectangular (enter width)</MenuItem>
                  </Select>
                </FormControl>

                {geometry === 'rectangular' && (
                  <TextField
                    label="Vessel Width"
                    value={rectWidth}
                    onChange={(e) => setRectWidth(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            m
                          </Typography>
                        ),
                      },
                    }}
                  />
                )}
              </Stack>
            </Paper>

            {/* Brine Carryover */}
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WaterIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Brine Carryover Estimation
                  </Typography>
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableCarryover}
                      onChange={(e) => setEnableCarryover(e.target.checked)}
                      size="small"
                    />
                  }
                  label=""
                />
              </Stack>
              <Divider sx={{ mb: 2 }} />

              {enableCarryover ? (
                <Stack spacing={2}>
                  <TextField
                    label="Brine Salinity (TDS)"
                    value={brineSalinity}
                    onChange={(e) => setBrineSalinity(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Total dissolved solids of the brine/liquid"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            ppm
                          </Typography>
                        ),
                      },
                    }}
                  />

                  <ToggleButtonGroup
                    value={entrainmentMode}
                    exclusive
                    onChange={(_, v) => v && setEntrainmentMode(v)}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="estimate">
                      <Tooltip title="Estimate from vapor loading using Sterman-type correlation">
                        <span>Auto-Estimate Entrainment</span>
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="manual">
                      <Tooltip title="Enter a known primary entrainment value">
                        <span>Manual Entrainment</span>
                      </Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {entrainmentMode === 'manual' && (
                    <TextField
                      label="Primary Entrainment (before demister)"
                      value={manualEntrainment}
                      onChange={(e) => setManualEntrainment(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Liquid carried by vapor before reaching demister. Typical: 0.1–2%"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              % of vapor
                            </Typography>
                          ),
                        },
                      }}
                    />
                  )}

                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Carryover = Primary Entrainment × (1 − Demister Efficiency). The primary
                      entrainment depends on vapor velocity at the boiling surface and liquid
                      properties. For MED effects, typical values are 0.1–2% of vapor mass flow.
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Enable to estimate brine carryover and distillate quality for desalination
                  applications.
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
              {/* Key results */}
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Results
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
                  {[
                    {
                      label: 'K Factor',
                      value: calcResult.kFactor.toFixed(3),
                      unit: 'm/s',
                      color: '#e3f2fd',
                      border: '#1565c0',
                      text: 'primary.dark',
                    },
                    {
                      label: 'Max. Velocity (V_max)',
                      value: calcResult.maxVelocity.toFixed(3),
                      unit: 'm/s',
                      color: '#fff8e1',
                      border: '#f57f17',
                      text: 'warning.dark',
                    },
                    {
                      label: 'Design Velocity',
                      value: calcResult.designVelocity.toFixed(3),
                      unit: 'm/s',
                      color: '#e8f5e9',
                      border: '#2e7d32',
                      text: 'success.dark',
                    },
                  ].map((card) => (
                    <Grid key={card.label} size={{ xs: 12, sm: 4 }}>
                      <Box
                        sx={{
                          bgcolor: card.color,
                          border: `1.5px solid ${card.border}`,
                          borderRadius: 2,
                          p: 2,
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="caption" color={card.text} display="block">
                          {card.label}
                        </Typography>
                        <Typography variant="h6" color={card.text} fontWeight="bold">
                          {card.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {card.unit}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Vapor volumetric flow
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.vaporVolumetricFlow.toFixed(4)} m³/s
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {(calcResult.vaporVolumetricFlow * 3600).toFixed(2)} m³/h
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Required demister area
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.requiredArea.toFixed(3)} m²
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {calcResult.vesselDiameter !== undefined && (
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Min. vessel diameter
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {calcResult.vesselDiameter.toFixed(3)} m
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {(calcResult.vesselDiameter * 1000).toFixed(0)} mm
                        </TableCell>
                      </TableRow>
                    )}
                    {calcResult.rectangleHeight !== undefined && (
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Required height (at given width)
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {calcResult.rectangleHeight.toFixed(3)} m
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Pad thickness
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.padThickness} mm
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Pressure drop (calculated)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.pressureDrop.toFixed(1)} Pa
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        ref: {calcResult.pressureDropRange.min}–{calcResult.pressureDropRange.max}{' '}
                        Pa
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Loading at design point
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: loadingColor }}
                      >
                        {(calcResult.loadingFraction * 100).toFixed(0)}% of V_max
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: loadingColor }}>
                        {calcResult.loadingStatus === 'high'
                          ? 'Over-loaded'
                          : calcResult.loadingStatus === 'low'
                            ? 'Under-loaded'
                            : 'Acceptable'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Carryover results */}
              {calcResult.carryover && (
                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <WaterIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Brine Carryover Analysis
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />

                  {/* Distillate TDS banner */}
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor:
                        calcResult.carryover.qualityAssessment === 'excellent'
                          ? '#e8f5e9'
                          : calcResult.carryover.qualityAssessment === 'good'
                            ? '#e3f2fd'
                            : calcResult.carryover.qualityAssessment === 'marginal'
                              ? '#fff8e1'
                              : '#ffebee',
                      border: '1.5px solid',
                      borderColor: getQualityColor(calcResult.carryover.qualityAssessment),
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" display="block" color="text.secondary">
                      Predicted Distillate TDS
                    </Typography>
                    <Typography
                      variant="h5"
                      fontWeight="bold"
                      sx={{
                        color: getQualityColor(calcResult.carryover.qualityAssessment),
                      }}
                    >
                      {calcResult.carryover.distillateTDS.toFixed(2)} ppm
                    </Typography>
                    <Chip
                      label={calcResult.carryover.qualityAssessment.toUpperCase()}
                      size="small"
                      sx={{
                        mt: 0.5,
                        color: 'white',
                        bgcolor: getQualityColor(calcResult.carryover.qualityAssessment),
                      }}
                    />
                  </Box>

                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Primary entrainment
                          {calcResult.carryover.primaryEntrainmentSource === 'estimated' && (
                            <Chip
                              label="estimated"
                              size="small"
                              variant="outlined"
                              sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {(calcResult.carryover.primaryEntrainment * 100).toFixed(3)}% of vapor
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {(
                            calcResult.carryover.primaryEntrainment *
                            parseFloat(vaporMassFlow || '0')
                          ).toFixed(5)}{' '}
                          kg/s
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Demister efficiency
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {(calcResult.carryover.demisterEfficiency * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Net carryover (after demister)
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {calcResult.carryover.carryoverPPM.toFixed(1)} ppm of vapor
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {calcResult.carryover.carryoverMassFlow.toExponential(3)} kg/s
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Brine salinity
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {parseFloat(brineSalinity || '0').toLocaleString()} ppm
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>

                  {calcResult.carryover.warnings.length > 0 && (
                    <Stack spacing={1} mt={2}>
                      {calcResult.carryover.warnings.map((w, i) => (
                        <Alert key={i} severity="warning" sx={{ py: 0 }}>
                          <Typography variant="caption">{w}</Typography>
                        </Alert>
                      ))}
                    </Stack>
                  )}

                  {/* Comparison table across all demister types */}
                  {comparisonRows && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        Distillate TDS Comparison — All Demister Types
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Same primary entrainment (
                        {(calcResult.carryover.primaryEntrainment * 100).toFixed(3)}% of vapor) and
                        brine salinity ({parseFloat(brineSalinity || '0').toLocaleString()} ppm) at{' '}
                        {(calcResult.loadingFraction * 100).toFixed(0)}% loading.
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                                Scenario
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                Efficiency
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                Min. Droplet
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                Net Carryover
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                Distillate TDS
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                              >
                                Quality
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {comparisonRows.map((row) => {
                              const isSelected = row.type === demisterType;
                              return (
                                <TableRow
                                  key={row.label}
                                  sx={{
                                    bgcolor: isSelected ? 'primary.50' : undefined,
                                    '& td': isSelected ? { fontWeight: 'bold' } : undefined,
                                  }}
                                >
                                  <TableCell sx={{ fontSize: '0.75rem' }}>
                                    {row.label}
                                    {isSelected && (
                                      <Chip
                                        label="selected"
                                        size="small"
                                        color="primary"
                                        sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                    {row.type === null
                                      ? '—'
                                      : `${(row.efficiency * 100).toFixed(2)}%`}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                    {row.minDroplet_um !== null ? `${row.minDroplet_um} µm` : '—'}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                    {row.netCarryover > 0.001
                                      ? `${(row.netCarryover * 100).toFixed(3)}%`
                                      : `${(row.netCarryover * 1e6).toFixed(1)} ppm`}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold',
                                      color: getQualityColor(row.qualityAssessment),
                                    }}
                                  >
                                    {row.distillateTDS < 0.01
                                      ? '< 0.01'
                                      : row.distillateTDS.toFixed(2)}{' '}
                                    ppm
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                                    <Chip
                                      label={row.qualityAssessment}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        color: 'white',
                                        bgcolor: getQualityColor(row.qualityAssessment),
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </Paper>
              )}

              {/* Reference note */}
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>Sizing:</strong> V_max = K × √((ρ_L − ρ_V) / ρ_V) &nbsp;|&nbsp; A_min =
                  Q_v / V_design &nbsp;|&nbsp; D_min = √(4A/π)
                  <br />
                  <strong>Pressure drop:</strong> ΔP = C × (t/t_ref) × ρ_V × V^n (velocity-based
                  model, calibrated to GPSA/Koch data)
                  <br />
                  {calcResult.carryover && (
                    <>
                      <strong>Carryover:</strong> Net = E₀ × (1 − η) &nbsp;|&nbsp; Distillate TDS =
                      net carryover × brine TDS
                      <br />
                    </>
                  )}
                  <strong>K factors:</strong> GPSA Engineering Data Book / Koch-Otto York.
                  Horizontal orientation uses higher K than vertical upflow.
                  <br />
                  <strong>Typical design margin:</strong> 75–85% of V_max to allow for load
                  variations.
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Enter vapor mass flow and fluid properties to size the demister
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* PDF Report Dialog */}
      {calcResult && (
        <Suspense fallback={null}>
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
        calculatorType="DEMISTER"
        inputs={{
          fluidMode,
          satInput,
          satPressure,
          satTemperature,
          manualVaporDensity,
          manualLiquidDensity,
          vaporMassFlow,
          demisterType,
          orientation,
          designMargin,
          geometry,
          rectWidth,
          padThickness,
          enableCarryover,
          brineSalinity,
          entrainmentMode,
          manualEntrainment,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="DEMISTER"
        onLoad={(inputs) => {
          if (inputs.fluidMode === 'saturation' || inputs.fluidMode === 'manual')
            setFluidMode(inputs.fluidMode);
          if (inputs.satInput === 'pressure' || inputs.satInput === 'temperature')
            setSatInput(inputs.satInput);
          if (typeof inputs.satPressure === 'string') setSatPressure(inputs.satPressure);
          if (typeof inputs.satTemperature === 'string') setSatTemperature(inputs.satTemperature);
          if (typeof inputs.manualVaporDensity === 'string')
            setManualVaporDensity(inputs.manualVaporDensity);
          if (typeof inputs.manualLiquidDensity === 'string')
            setManualLiquidDensity(inputs.manualLiquidDensity);
          if (typeof inputs.vaporMassFlow === 'string') setVaporMassFlow(inputs.vaporMassFlow);
          if (typeof inputs.demisterType === 'string')
            setDemisterType(inputs.demisterType as DemisterType);
          if (inputs.orientation === 'horizontal' || inputs.orientation === 'vertical')
            setOrientation(inputs.orientation);
          if (typeof inputs.designMargin === 'string') setDesignMargin(inputs.designMargin);
          if (inputs.geometry === 'circular' || inputs.geometry === 'rectangular')
            setGeometry(inputs.geometry);
          if (typeof inputs.rectWidth === 'string') setRectWidth(inputs.rectWidth);
          if (typeof inputs.padThickness === 'string') setPadThickness(inputs.padThickness);
          if (typeof inputs.enableCarryover === 'boolean')
            setEnableCarryover(inputs.enableCarryover);
          if (typeof inputs.brineSalinity === 'string') setBrineSalinity(inputs.brineSalinity);
          if (inputs.entrainmentMode === 'estimate' || inputs.entrainmentMode === 'manual')
            setEntrainmentMode(inputs.entrainmentMode);
          if (typeof inputs.manualEntrainment === 'string')
            setManualEntrainment(inputs.manualEntrainment);
        }}
      />
    </Container>
  );
}
