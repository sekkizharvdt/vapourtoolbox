'use client';

/**
 * Pressure Drop Calculator
 *
 * Calculate pressure drop in piping systems including straight pipe and fittings.
 * Uses Darcy-Weisbach equation with Colebrook-White friction factor.
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
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
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  SCHEDULE_40_PIPES,
  calculatePressureDrop,
  getAvailableFittings,
  FITTING_NAMES,
  type FittingType,
  type FittingCount,
} from '@/lib/thermal';
import { getSeawaterDensity, getSeawaterViscosity, getDensityLiquid } from '@vapour/constants';

type FluidType = 'water' | 'seawater' | 'custom';

const AVAILABLE_FITTINGS = getAvailableFittings();

// Water viscosity approximation (Pa·s)
function getWaterViscosity(tempC: number): number {
  // Simplified correlation for water viscosity
  // μ = 0.001 × (1 + 0.0168T - 0.000133T²)^-1
  const factor = 1 + 0.0168 * tempC - 0.000133 * tempC * tempC;
  return 0.001 / factor;
}

export default function PressureDropClient() {
  // Pipe parameters
  const [selectedNPS, setSelectedNPS] = useState<string>('4');
  const [pipeLength, setPipeLength] = useState<string>('100');
  const [roughness, setRoughness] = useState<string>('0.045');

  // Flow parameters
  const [flowRate, setFlowRate] = useState<string>('50');

  // Fluid parameters
  const [fluidType, setFluidType] = useState<FluidType>('water');
  const [temperature, setTemperature] = useState<string>('40');
  const [salinity, setSalinity] = useState<string>('35000');
  const [customDensity, setCustomDensity] = useState<string>('1000');
  const [customViscosity, setCustomViscosity] = useState<string>('0.001');

  // Fittings
  const [fittings, setFittings] = useState<FittingCount[]>([
    { type: '90_elbow_standard', count: 4 },
    { type: 'gate_valve', count: 2 },
  ]);
  const [newFittingType, setNewFittingType] = useState<FittingType>('90_elbow_standard');

  // Elevation
  const [elevationChange, setElevationChange] = useState<string>('0');

  const [error, setError] = useState<string | null>(null);

  // Calculate fluid properties
  const fluidDensity = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        try {
          return getDensityLiquid(temp);
        } catch {
          return 1000;
        }
      case 'seawater':
        try {
          return getSeawaterDensity(sal, temp);
        } catch {
          return 1025;
        }
      case 'custom':
        return parseFloat(customDensity) || 1000;
      default:
        return 1000;
    }
  }, [fluidType, temperature, salinity, customDensity]);

  const fluidViscosity = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        return getWaterViscosity(temp);
      case 'seawater':
        try {
          return getSeawaterViscosity(sal, temp);
        } catch {
          return 0.001;
        }
      case 'custom':
        return parseFloat(customViscosity) || 0.001;
      default:
        return 0.001;
    }
  }, [fluidType, temperature, salinity, customViscosity]);

  // Calculate pressure drop
  const result = useMemo(() => {
    setError(null);

    try {
      const flow = parseFloat(flowRate);
      const length = parseFloat(pipeLength);
      const rough = parseFloat(roughness);
      const elevation = parseFloat(elevationChange);

      if (isNaN(flow) || flow <= 0) return null;
      if (isNaN(length) || length <= 0) return null;

      return calculatePressureDrop({
        pipeNPS: selectedNPS,
        pipeLength: length,
        flowRate: flow,
        fluidDensity,
        fluidViscosity,
        roughness: rough,
        fittings: fittings.filter((f) => f.count > 0),
        elevationChange: elevation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    selectedNPS,
    pipeLength,
    flowRate,
    fluidDensity,
    fluidViscosity,
    roughness,
    fittings,
    elevationChange,
  ]);

  // Add fitting
  const handleAddFitting = () => {
    const existing = fittings.find((f) => f.type === newFittingType);
    if (existing) {
      setFittings(
        fittings.map((f) => (f.type === newFittingType ? { ...f, count: f.count + 1 } : f))
      );
    } else {
      setFittings([...fittings, { type: newFittingType, count: 1 }]);
    }
  };

  // Update fitting count
  const handleFittingCountChange = (type: FittingType, count: number) => {
    if (count <= 0) {
      setFittings(fittings.filter((f) => f.type !== type));
    } else {
      setFittings(fittings.map((f) => (f.type === type ? { ...f, count } : f)));
    }
  };

  // Remove fitting
  const handleRemoveFitting = (type: FittingType) => {
    setFittings(fittings.filter((f) => f.type !== type));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Pressure Drop Calculator
          </Typography>
          <Chip label="Darcy-Weisbach" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate pressure drop in piping systems including straight pipe and fittings. Uses
          Darcy-Weisbach equation with Colebrook-White friction factor.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>

            <Stack spacing={2}>
              {/* Pipe Selection */}
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

              <TextField
                label="Pipe Length"
                value={pipeLength}
                onChange={(e) => setPipeLength(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
              />

              <TextField
                label="Pipe Roughness"
                value={roughness}
                onChange={(e) => setRoughness(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                }}
                helperText="Commercial steel: 0.045 mm"
              />

              <Divider />

              <TextField
                label="Mass Flow Rate"
                value={flowRate}
                onChange={(e) => setFlowRate(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
                }}
              />

              {/* Fluid Type */}
              <FormControl fullWidth>
                <InputLabel>Fluid Type</InputLabel>
                <Select
                  value={fluidType}
                  label="Fluid Type"
                  onChange={(e) => setFluidType(e.target.value as FluidType)}
                >
                  <MenuItem value="water">Pure Water</MenuItem>
                  <MenuItem value="seawater">Seawater</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>

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

              {fluidType === 'custom' && (
                <>
                  <TextField
                    label="Fluid Density"
                    value={customDensity}
                    onChange={(e) => setCustomDensity(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
                    }}
                  />
                  <TextField
                    label="Dynamic Viscosity"
                    value={customViscosity}
                    onChange={(e) => setCustomViscosity(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">Pa·s</InputAdornment>,
                    }}
                    helperText="Water at 20°C: 0.001 Pa·s"
                  />
                </>
              )}

              <Typography variant="body2" color="text.secondary">
                ρ = {fluidDensity.toFixed(1)} kg/m³, μ = {(fluidViscosity * 1000).toFixed(3)} mPa·s
              </Typography>

              <Divider />

              <TextField
                label="Elevation Change"
                value={elevationChange}
                onChange={(e) => setElevationChange(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                helperText="Positive = upward flow"
              />
            </Stack>
          </Paper>

          {/* Fittings Section */}
          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Fittings
            </Typography>

            {/* Add Fitting */}
            <Stack direction="row" spacing={1} mb={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Fitting Type</InputLabel>
                <Select
                  value={newFittingType}
                  label="Fitting Type"
                  onChange={(e) => setNewFittingType(e.target.value as FittingType)}
                >
                  {AVAILABLE_FITTINGS.map((f) => (
                    <MenuItem key={f.type} value={f.type}>
                      {f.name} (K={f.kFactor})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton color="primary" onClick={handleAddFitting}>
                <AddIcon />
              </IconButton>
            </Stack>

            {/* Fittings List */}
            {fittings.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fitting</TableCell>
                      <TableCell align="center">Count</TableCell>
                      <TableCell align="right">K</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fittings.map((fitting) => (
                      <TableRow key={fitting.type}>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {FITTING_NAMES[fitting.type]}
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            value={fitting.count}
                            onChange={(e) =>
                              handleFittingCountChange(fitting.type, parseInt(e.target.value) || 0)
                            }
                            size="small"
                            sx={{ width: 60 }}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {(
                            AVAILABLE_FITTINGS.find((f) => f.type === fitting.type)?.kFactor ?? 0
                          ).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFitting(fitting.type)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No fittings added
              </Typography>
            )}
          </Paper>

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Results
              </Typography>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {result.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </Alert>
              )}

              {/* Main Result */}
              <Card
                variant="outlined"
                sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
              >
                <CardContent>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Total Pressure Drop
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={2}>
                    <Typography variant="h3">{result.totalPressureDropMH2O.toFixed(2)}</Typography>
                    <Typography variant="h6">m H₂O</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} mt={1}>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      = {result.totalPressureDropBar.toFixed(4)} bar
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      = {result.totalPressureDropMbar.toFixed(1)} mbar
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      = {result.totalPressureDropKPa.toFixed(2)} kPa
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* Breakdown */}
              <Grid container spacing={2} mb={3}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Velocity
                      </Typography>
                      <Typography variant="h6">{result.velocity.toFixed(2)}</Typography>
                      <Typography variant="caption">m/s</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Reynolds No.
                      </Typography>
                      <Typography variant="h6">
                        {result.reynoldsNumber > 10000
                          ? (result.reynoldsNumber / 1000).toFixed(1) + 'k'
                          : result.reynoldsNumber.toFixed(0)}
                      </Typography>
                      <Typography variant="caption">{result.flowRegime}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Friction Factor
                      </Typography>
                      <Typography variant="h6">{result.frictionFactor.toFixed(4)}</Typography>
                      <Typography variant="caption">Darcy</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Total K
                      </Typography>
                      <Typography variant="h6">{result.totalKFactor.toFixed(2)}</Typography>
                      <Typography variant="caption">
                        ({result.equivalentLength.toFixed(1)} m eq.)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Loss Components */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Component</TableCell>
                      <TableCell align="right">Loss (m H₂O)</TableCell>
                      <TableCell align="right">%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Straight Pipe ({pipeLength} m)</TableCell>
                      <TableCell align="right">{result.straightPipeLoss.toFixed(3)}</TableCell>
                      <TableCell align="right">
                        {((result.straightPipeLoss / result.totalPressureDropMH2O) * 100).toFixed(
                          1
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        Fittings ({fittings.reduce((sum, f) => sum + f.count, 0)} items)
                      </TableCell>
                      <TableCell align="right">{result.fittingsLoss.toFixed(3)}</TableCell>
                      <TableCell align="right">
                        {((result.fittingsLoss / result.totalPressureDropMH2O) * 100).toFixed(1)}
                      </TableCell>
                    </TableRow>
                    {result.elevationHead !== 0 && (
                      <TableRow>
                        <TableCell>Elevation ({elevationChange} m)</TableCell>
                        <TableCell align="right">{result.elevationHead.toFixed(3)}</TableCell>
                        <TableCell align="right">
                          {((result.elevationHead / result.totalPressureDropMH2O) * 100).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow sx={{ fontWeight: 'bold' }}>
                      <TableCell>
                        <strong>Total</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{result.totalPressureDropMH2O.toFixed(3)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>100</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Fittings Breakdown */}
              {result.fittingsBreakdown.length > 0 && (
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Fittings Breakdown</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Fitting</TableCell>
                            <TableCell align="center">Count</TableCell>
                            <TableCell align="right">K</TableCell>
                            <TableCell align="right">Loss (m)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.fittingsBreakdown.map((fb) => (
                            <TableRow key={fb.type}>
                              <TableCell>{FITTING_NAMES[fb.type]}</TableCell>
                              <TableCell align="center">{fb.count}</TableCell>
                              <TableCell align="right">{fb.kFactor.toFixed(2)}</TableCell>
                              <TableCell align="right">{fb.loss.toFixed(4)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}
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
                  Enter parameters to calculate pressure drop
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* K-Factors Reference */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">K-Factor Reference (Crane TP-410)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fitting</TableCell>
                  <TableCell align="right">K-Factor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {AVAILABLE_FITTINGS.map((f) => (
                  <TableRow key={f.type}>
                    <TableCell>{f.name}</TableCell>
                    <TableCell align="right">{f.kFactor.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Method
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Darcy-Weisbach equation:</strong> ΔP = f × (L/D) × (ρv²/2) + ΣK × (ρv²/2) + ρgh
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Friction factor:</strong> Swamee-Jain approximation for Colebrook-White equation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Reference:</strong> Crane Technical Paper No. 410 &quot;Flow of Fluids Through
          Valves, Fittings, and Pipe&quot;
        </Typography>
      </Box>
    </Container>
  );
}
