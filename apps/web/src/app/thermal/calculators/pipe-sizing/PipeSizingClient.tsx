'use client';

/**
 * Pipe Sizing Calculator
 *
 * Size pipes based on flow rate and velocity constraints, or calculate velocity for a given pipe.
 * Uses ASME B36.10 Schedule 40 pipe data.
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Divider,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  SCHEDULE_40_PIPES,
  selectPipeByVelocity,
  calculateVelocity,
  calculateRequiredArea,
  getPipeByNPS,
  type PipeVariant,
} from '@/lib/thermal';
import { getSeawaterDensity, getDensityLiquid } from '@vapour/constants';

type CalculationMode = 'size_by_flow' | 'check_velocity';
type FlowUnit = 'tonhr' | 'kghr' | 'kgsec' | 'm3hr';
type FluidType = 'water' | 'seawater' | 'steam' | 'custom';

interface VelocityLimits {
  min: number;
  max: number;
  target: number;
}

const DEFAULT_VELOCITY_LIMITS: Record<string, VelocityLimits> = {
  water_liquid: { min: 0.5, max: 3.0, target: 1.5 },
  seawater_liquid: { min: 0.5, max: 2.5, target: 1.5 },
  steam_vapor: { min: 15.0, max: 40.0, target: 25.0 },
  vacuum_vapor: { min: 20.0, max: 60.0, target: 35.0 },
};

function convertFlowToTonHr(value: number, unit: FlowUnit): number {
  switch (unit) {
    case 'tonhr':
      return value;
    case 'kghr':
      return value / 1000;
    case 'kgsec':
      return (value * 3600) / 1000;
    case 'm3hr':
      return value; // Will multiply by density later
    default:
      return value;
  }
}

function getVelocityStatusIcon(status: 'OK' | 'HIGH' | 'LOW') {
  switch (status) {
    case 'OK':
      return <CheckCircleIcon color="success" fontSize="small" />;
    case 'HIGH':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'LOW':
      return <WarningIcon color="warning" fontSize="small" />;
  }
}

function getVelocityStatusColor(status: 'OK' | 'HIGH' | 'LOW') {
  switch (status) {
    case 'OK':
      return 'success.main';
    case 'HIGH':
      return 'error.main';
    case 'LOW':
      return 'warning.main';
  }
}

export default function PipeSizingClient() {
  // Mode
  const [mode, setMode] = useState<CalculationMode>('size_by_flow');

  // Flow inputs
  const [flowRate, setFlowRate] = useState<string>('100');
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('tonhr');

  // Fluid properties
  const [fluidType, setFluidType] = useState<FluidType>('water');
  const [temperature, setTemperature] = useState<string>('40');
  const [salinity, setSalinity] = useState<string>('35000');
  const [customDensity, setCustomDensity] = useState<string>('1000');

  // Velocity settings
  const [targetVelocity, setTargetVelocity] = useState<string>('1.5');
  const [minVelocity, setMinVelocity] = useState<string>('0.5');
  const [maxVelocity, setMaxVelocity] = useState<string>('3.0');

  // Check velocity mode - selected pipe
  const [selectedNPS, setSelectedNPS] = useState<string>('4');

  const [error, setError] = useState<string | null>(null);

  // Calculate fluid density
  const density = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        try {
          return getDensityLiquid(temp);
        } catch {
          return 1000; // fallback
        }
      case 'seawater':
        try {
          return getSeawaterDensity(sal, temp);
        } catch {
          return 1025; // fallback
        }
      case 'steam':
        // For steam, user needs to specify density based on pressure
        return parseFloat(customDensity) || 0.6;
      case 'custom':
        return parseFloat(customDensity) || 1000;
      default:
        return 1000;
    }
  }, [fluidType, temperature, salinity, customDensity]);

  // Calculate mass flow in ton/hr
  const massFlowTonHr = useMemo(() => {
    const flow = parseFloat(flowRate) || 0;

    if (flowUnit === 'm3hr') {
      // Convert volumetric to mass flow
      return (flow * density) / 1000; // m³/hr × kg/m³ / 1000 = ton/hr
    }

    return convertFlowToTonHr(flow, flowUnit);
  }, [flowRate, flowUnit, density]);

  // Main calculation result
  const result = useMemo(() => {
    setError(null);

    try {
      if (massFlowTonHr <= 0 || density <= 0) return null;

      const target = parseFloat(targetVelocity) || 1.5;
      const min = parseFloat(minVelocity) || 0.5;
      const max = parseFloat(maxVelocity) || 3.0;

      if (mode === 'size_by_flow') {
        // Convert mass flow to volumetric flow (m³/s)
        const volumetricFlow = (massFlowTonHr * 1000) / (density * 3600);

        // Select pipe by velocity
        const selectedPipe = selectPipeByVelocity(volumetricFlow, target, { min, max });

        // Also get alternatives (one size smaller and larger if available)
        const pipeIndex = SCHEDULE_40_PIPES.findIndex((p) => p.nps === selectedPipe.nps);
        const alternatives: Array<
          PipeVariant & { velocity: number; status: 'OK' | 'HIGH' | 'LOW' }
        > = [];

        // One size smaller
        if (pipeIndex > 0) {
          const smallerPipe = SCHEDULE_40_PIPES[pipeIndex - 1];
          if (smallerPipe) {
            const vel = calculateVelocity(massFlowTonHr, density, smallerPipe);
            const status: 'OK' | 'HIGH' | 'LOW' = vel > max ? 'HIGH' : vel < min ? 'LOW' : 'OK';
            alternatives.push({
              ...smallerPipe,
              velocity: vel,
              status,
            });
          }
        }

        // One size larger
        if (pipeIndex < SCHEDULE_40_PIPES.length - 1) {
          const largerPipe = SCHEDULE_40_PIPES[pipeIndex + 1];
          if (largerPipe) {
            const vel = calculateVelocity(massFlowTonHr, density, largerPipe);
            const status: 'OK' | 'HIGH' | 'LOW' = vel > max ? 'HIGH' : vel < min ? 'LOW' : 'OK';
            alternatives.push({
              ...largerPipe,
              velocity: vel,
              status,
            });
          }
        }

        return {
          mode: 'size_by_flow' as const,
          pipe: selectedPipe,
          velocity: selectedPipe.actualVelocity,
          velocityStatus: selectedPipe.velocityStatus,
          requiredArea: calculateRequiredArea(massFlowTonHr, density, target),
          alternatives,
        };
      } else {
        // Check velocity mode
        const pipe = getPipeByNPS(selectedNPS);
        if (!pipe) {
          setError(`Pipe size NPS ${selectedNPS} not found`);
          return null;
        }

        const velocity = calculateVelocity(massFlowTonHr, density, pipe);
        const status: 'OK' | 'HIGH' | 'LOW' =
          velocity > max ? 'HIGH' : velocity < min ? 'LOW' : 'OK';

        return {
          mode: 'check_velocity' as const,
          pipe,
          velocity,
          velocityStatus: status,
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, massFlowTonHr, density, targetVelocity, minVelocity, maxVelocity, selectedNPS]);

  // Apply velocity presets based on fluid type
  const handleFluidTypeChange = (newType: FluidType) => {
    setFluidType(newType);

    // Apply default velocity limits
    if (newType === 'water' || newType === 'seawater') {
      const limits = DEFAULT_VELOCITY_LIMITS[`${newType}_liquid`];
      if (limits) {
        setTargetVelocity(limits.target.toString());
        setMinVelocity(limits.min.toString());
        setMaxVelocity(limits.max.toString());
      }
    } else if (newType === 'steam') {
      const limits = DEFAULT_VELOCITY_LIMITS.steam_vapor;
      if (limits) {
        setTargetVelocity(limits.target.toString());
        setMinVelocity(limits.min.toString());
        setMaxVelocity(limits.max.toString());
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Pipe Sizing Calculator
          </Typography>
          <Chip label="ASME B36.10" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Size pipes based on flow rate and velocity constraints, or check velocity for a given pipe
          size. Uses Schedule 40 pipe data.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>

            {/* Mode Toggle */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Calculation Mode:
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, newMode) => newMode && setMode(newMode)}
                fullWidth
                size="small"
              >
                <ToggleButton value="size_by_flow">Size by Flow</ToggleButton>
                <ToggleButton value="check_velocity">Check Velocity</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Flow Rate */}
            <Stack spacing={2}>
              <Box>
                <TextField
                  label="Flow Rate"
                  value={flowRate}
                  onChange={(e) => setFlowRate(e.target.value)}
                  type="number"
                  fullWidth
                />
                <FormControl fullWidth sx={{ mt: 1 }} size="small">
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={flowUnit}
                    label="Unit"
                    onChange={(e) => setFlowUnit(e.target.value as FlowUnit)}
                  >
                    <MenuItem value="tonhr">ton/hr (mass)</MenuItem>
                    <MenuItem value="kghr">kg/hr (mass)</MenuItem>
                    <MenuItem value="kgsec">kg/s (mass)</MenuItem>
                    <MenuItem value="m3hr">m³/hr (volumetric)</MenuItem>
                  </Select>
                </FormControl>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  = {massFlowTonHr.toFixed(3)} ton/hr
                </Typography>
              </Box>

              {/* Fluid Type */}
              <FormControl fullWidth>
                <InputLabel>Fluid Type</InputLabel>
                <Select
                  value={fluidType}
                  label="Fluid Type"
                  onChange={(e) => handleFluidTypeChange(e.target.value as FluidType)}
                >
                  <MenuItem value="water">Pure Water</MenuItem>
                  <MenuItem value="seawater">Seawater</MenuItem>
                  <MenuItem value="steam">Steam/Vapor</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>

              {/* Temperature (for water/seawater) */}
              {(fluidType === 'water' || fluidType === 'seawater') && (
                <TextField
                  label="Temperature"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                  }}
                />
              )}

              {/* Salinity (for seawater) */}
              {fluidType === 'seawater' && (
                <TextField
                  label="Salinity"
                  value={salinity}
                  onChange={(e) => setSalinity(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
                  }}
                />
              )}

              {/* Custom density */}
              {(fluidType === 'steam' || fluidType === 'custom') && (
                <TextField
                  label="Fluid Density"
                  value={customDensity}
                  onChange={(e) => setCustomDensity(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
                  }}
                  helperText={fluidType === 'steam' ? 'Depends on steam pressure' : ''}
                />
              )}

              {/* Show calculated density */}
              <Typography variant="body2" color="text.secondary">
                Fluid density: <strong>{density.toFixed(2)} kg/m³</strong>
              </Typography>

              <Divider />

              {/* Velocity Limits */}
              <Typography variant="subtitle2">Velocity Limits</Typography>

              <TextField
                label="Target Velocity"
                value={targetVelocity}
                onChange={(e) => setTargetVelocity(e.target.value)}
                type="number"
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                }}
              />

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Min"
                  value={minVelocity}
                  onChange={(e) => setMinVelocity(e.target.value)}
                  type="number"
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                  }}
                />
                <TextField
                  label="Max"
                  value={maxVelocity}
                  onChange={(e) => setMaxVelocity(e.target.value)}
                  type="number"
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                  }}
                />
              </Stack>

              {/* Pipe selection (check velocity mode) */}
              {mode === 'check_velocity' && (
                <>
                  <Divider />
                  <FormControl fullWidth>
                    <InputLabel>Pipe Size</InputLabel>
                    <Select
                      value={selectedNPS}
                      label="Pipe Size"
                      onChange={(e) => setSelectedNPS(e.target.value)}
                    >
                      {SCHEDULE_40_PIPES.map((pipe) => (
                        <MenuItem key={pipe.nps} value={pipe.nps}>
                          {pipe.nps}&quot; (DN{pipe.dn}) - ID: {pipe.id_mm.toFixed(1)} mm
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </Stack>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {mode === 'size_by_flow' ? 'Recommended Pipe Size' : 'Velocity Check Result'}
              </Typography>

              {/* Main Result Card */}
              <Card
                variant="outlined"
                sx={{
                  mb: 3,
                  borderColor: getVelocityStatusColor(result.velocityStatus),
                  borderWidth: 2,
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    {getVelocityStatusIcon(result.velocityStatus)}
                    <Typography variant="h4">{result.pipe.nps}&quot; Sch 40</Typography>
                    <Chip
                      label={result.velocityStatus}
                      color={
                        result.velocityStatus === 'OK'
                          ? 'success'
                          : result.velocityStatus === 'HIGH'
                            ? 'error'
                            : 'warning'
                      }
                      size="small"
                    />
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Nominal Diameter
                      </Typography>
                      <Typography variant="body1">DN{result.pipe.dn}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Inner Diameter
                      </Typography>
                      <Typography variant="body1">{result.pipe.id_mm.toFixed(1)} mm</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Flow Area
                      </Typography>
                      <Typography variant="body1">
                        {(result.pipe.area_mm2 / 1e6).toFixed(6)} m²
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Actual Velocity
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight="bold"
                        color={getVelocityStatusColor(result.velocityStatus)}
                      >
                        {result.velocity.toFixed(2)} m/s
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Alternatives (size by flow mode) */}
              {result.mode === 'size_by_flow' && result.alternatives.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Alternative Sizes
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Size</TableCell>
                          <TableCell align="right">ID (mm)</TableCell>
                          <TableCell align="right">Velocity (m/s)</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.alternatives.map((alt) => (
                          <TableRow key={alt.nps}>
                            <TableCell>
                              {alt.nps}&quot; (DN{alt.dn})
                            </TableCell>
                            <TableCell align="right">{alt.id_mm.toFixed(1)}</TableCell>
                            <TableCell align="right">{alt.velocity.toFixed(2)}</TableCell>
                            <TableCell align="center">
                              {getVelocityStatusIcon(alt.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Velocity Guideline */}
              <Alert
                severity={
                  result.velocityStatus === 'OK'
                    ? 'success'
                    : result.velocityStatus === 'HIGH'
                      ? 'error'
                      : 'warning'
                }
              >
                {result.velocityStatus === 'OK' && (
                  <>
                    Velocity is within acceptable range ({minVelocity} - {maxVelocity} m/s)
                  </>
                )}
                {result.velocityStatus === 'HIGH' && (
                  <>
                    Velocity exceeds maximum limit ({maxVelocity} m/s). Consider using a larger pipe
                    size to reduce erosion risk.
                  </>
                )}
                {result.velocityStatus === 'LOW' && (
                  <>
                    Velocity below minimum limit ({minVelocity} m/s). Consider using a smaller pipe
                    size to prevent solids settling.
                  </>
                )}
              </Alert>
            </Paper>
          ) : (
            !error && (
              <Paper
                sx={{
                  p: 6,
                  textAlign: 'center',
                  bgcolor: 'action.hover',
                  border: '2px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Enter flow rate to calculate pipe size
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Reference Table */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Schedule 40 Pipe Data (ASME B36.10)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>NPS</TableCell>
                  <TableCell>DN</TableCell>
                  <TableCell align="right">OD (mm)</TableCell>
                  <TableCell align="right">WT (mm)</TableCell>
                  <TableCell align="right">ID (mm)</TableCell>
                  <TableCell align="right">Area (mm²)</TableCell>
                  <TableCell align="right">Weight (kg/m)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SCHEDULE_40_PIPES.map((pipe) => (
                  <TableRow
                    key={pipe.nps}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setMode('check_velocity');
                      setSelectedNPS(pipe.nps);
                    }}
                  >
                    <TableCell>{pipe.nps}&quot;</TableCell>
                    <TableCell>{pipe.dn}</TableCell>
                    <TableCell align="right">{pipe.od_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.wt_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.id_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.area_mm2.toFixed(1)}</TableCell>
                    <TableCell align="right">{pipe.weight_kgm.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Click any row to check velocity for that pipe size
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Velocity Guidelines */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Typical Velocity Guidelines</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Min (m/s)</TableCell>
                  <TableCell align="right">Typical (m/s)</TableCell>
                  <TableCell align="right">Max (m/s)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Water (liquid)</TableCell>
                  <TableCell align="right">0.5</TableCell>
                  <TableCell align="right">1.5 - 2.0</TableCell>
                  <TableCell align="right">3.0</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Seawater (liquid)</TableCell>
                  <TableCell align="right">0.5</TableCell>
                  <TableCell align="right">1.5</TableCell>
                  <TableCell align="right">2.5</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Steam (saturated)</TableCell>
                  <TableCell align="right">15</TableCell>
                  <TableCell align="right">25 - 35</TableCell>
                  <TableCell align="right">40</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Vacuum Vapor</TableCell>
                  <TableCell align="right">20</TableCell>
                  <TableCell align="right">35 - 45</TableCell>
                  <TableCell align="right">60</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Pump Suction</TableCell>
                  <TableCell align="right">0.3</TableCell>
                  <TableCell align="right">0.6 - 1.0</TableCell>
                  <TableCell align="right">1.5</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Reference
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ASME B36.10M: Welded and Seamless Wrought Steel Pipe. Schedule 40 (STD) is the default for
          general process piping applications.
        </Typography>
      </Box>
    </Container>
  );
}
