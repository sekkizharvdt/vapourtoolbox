'use client';

/**
 * Demister / Mist Eliminator Sizing Calculator
 *
 * Sizes demister pads using the Souders-Brown correlation.
 * Supports steam/water auto-lookup from saturation conditions
 * or manual density entry for other fluids.
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateDemisterSizing,
  type DemisterType,
  type DemisterOrientation,
  type VesselGeometry,
} from '@/lib/thermal';
import {
  getSaturationTemperature,
  getSaturationPressure,
  getDensityVapor,
  getDensityLiquid,
} from '@vapour/constants';

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

  const [error, setError] = useState<string | null>(null);

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
        // Verify T is valid for steam tables
        getSaturationPressure(t);
      }
      const rhoV = getDensityVapor(tSat);
      const rhoL = getDensityLiquid(tSat);
      return { tSat, rhoV, rhoL };
    } catch {
      return null;
    }
  }, [fluidMode, satInput, satPressure, satTemperature]);

  // ── Main calculation ────────────────────────────────────────────────────────

  const result = useMemo(() => {
    setError(null);
    try {
      const flow = parseFloat(vaporMassFlow);
      if (isNaN(flow) || flow <= 0) return null;

      const margin = parseFloat(designMargin) / 100;
      if (isNaN(margin) || margin <= 0 || margin > 1) return null;

      let rhoV: number;
      let rhoL: number;

      if (fluidMode === 'saturation') {
        if (!steamProps) return null;
        rhoV = steamProps.rhoV;
        rhoL = steamProps.rhoL;
      } else {
        rhoV = parseFloat(manualVaporDensity);
        rhoL = parseFloat(manualLiquidDensity);
        if (isNaN(rhoV) || rhoV <= 0 || isNaN(rhoL) || rhoL <= 0) return null;
      }

      return calculateDemisterSizing({
        vaporMassFlow: flow,
        vaporDensity: rhoV,
        liquidDensity: rhoL,
        demisterType,
        orientation,
        designMargin: margin,
        geometry,
        rectangleWidth: geometry === 'rectangular' ? parseFloat(rectWidth) || undefined : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
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
  ]);

  const loadingColor =
    result?.loadingStatus === 'high'
      ? 'error.main'
      : result?.loadingStatus === 'low'
        ? 'warning.main'
        : 'success.main';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Demister Sizing" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Demister / Mist Eliminator Sizing
        </Typography>
        <Chip label="Souders-Brown" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Size demister pads for flash chambers, evaporator effects, and separators.
      </Typography>

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

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* ── Right: Results ── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {result ? (
            <Stack spacing={3}>
              {/* Key results */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Results
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2} mb={2}>
                  {[
                    {
                      label: 'K Factor',
                      value: result.kFactor.toFixed(3),
                      unit: 'm/s',
                      color: '#e3f2fd',
                      border: '#1565c0',
                      text: 'primary.dark',
                    },
                    {
                      label: 'Max. Velocity (V_max)',
                      value: result.maxVelocity.toFixed(3),
                      unit: 'm/s',
                      color: '#fff8e1',
                      border: '#f57f17',
                      text: 'warning.dark',
                    },
                    {
                      label: 'Design Velocity',
                      value: result.designVelocity.toFixed(3),
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
                        {result.vaporVolumetricFlow.toFixed(4)} m³/s
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {(result.vaporVolumetricFlow * 3600).toFixed(2)} m³/h
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Required demister area
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {result.requiredArea.toFixed(3)} m²
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {result.vesselDiameter !== undefined && (
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Min. vessel diameter
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {result.vesselDiameter.toFixed(3)} m
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                          {(result.vesselDiameter * 1000).toFixed(0)} mm
                        </TableCell>
                      </TableRow>
                    )}
                    {result.rectangleHeight !== undefined && (
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          Required height (at given width)
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {result.rectangleHeight.toFixed(3)} m
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Estimated pressure drop
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {result.pressureDropMin}–{result.pressureDropMax} Pa
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Loading at design point
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: '0.8rem', fontWeight: 'bold', color: loadingColor }}
                      >
                        {(result.loadingFraction * 100).toFixed(0)}% of V_max
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: loadingColor }}>
                        {result.loadingStatus === 'high'
                          ? '⚠ Over-loaded'
                          : result.loadingStatus === 'low'
                            ? 'Under-loaded'
                            : '✓ Acceptable'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Reference note */}
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>Correlation:</strong> V_max = K × √((ρ_L − ρ_V) / ρ_V) &nbsp;|&nbsp; A_min
                  = Q_v / V_design &nbsp;|&nbsp; D_min = √(4A/π)
                  <br />
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
    </Container>
  );
}
