'use client';

/**
 * Steam Tables Calculator
 *
 * Lookup steam properties for saturation, subcooled liquid, and superheated steam.
 * Uses IAPWS-IF97 correlations (Regions 1, 2, 4) from @vapour/constants.
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  getSaturationPressure,
  getSaturationTemperature,
  getEnthalpyLiquid,
  getEnthalpyVapor,
  getLatentHeat,
  getDensityLiquid,
  getDensityVapor,
  getSpecificVolumeLiquid,
  getSpecificVolumeVapor,
  mbarAbsToBar,
  barToMbarAbs,
  kgCm2GaugeToBar,
  barToKgCm2Gauge,
  waterHeadToBar,
  barToWaterHead,
  SATURATION_TABLE,
  CRITICAL_TEMPERATURE_C,
  CRITICAL_PRESSURE_BAR,
  // Subcooled (Region 1)
  getSubcooledProperties,
  // Superheated (Region 2)
  getSuperheatedProperties,
  // Region detection
  getRegion,
} from '@vapour/constants';

type SteamMode = 'saturation' | 'subcooled' | 'superheated';
type LookupMode = 'temperature' | 'pressure';
type PressureUnit = 'bar' | 'mbar' | 'kgcm2g' | 'mH2O';

interface SaturationResult {
  temperature: number;
  pressure: number;
  enthalpyLiquid: number;
  enthalpyVapor: number;
  latentHeat: number;
  densityLiquid: number;
  densityVapor: number;
  specificVolumeLiquid: number;
  specificVolumeVapor: number;
}

interface SubcooledResult {
  temperature: number;
  pressure: number;
  subcooling: number;
  enthalpy: number;
  density: number;
  specificVolume: number;
  specificHeat: number;
  speedOfSound: number;
  internalEnergy: number;
  entropy: number;
}

interface SuperheatedResult {
  temperature: number;
  pressure: number;
  superheat: number;
  enthalpy: number;
  density: number;
  specificVolume: number;
  specificHeat: number;
  speedOfSound: number;
  internalEnergy: number;
  entropy: number;
}

function convertPressureToBar(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'bar':
      return value;
    case 'mbar':
      return mbarAbsToBar(value);
    case 'kgcm2g':
      return kgCm2GaugeToBar(value);
    case 'mH2O':
      return waterHeadToBar(value);
    default:
      return value;
  }
}

function convertBarToPressureUnit(bar: number, unit: PressureUnit): number {
  switch (unit) {
    case 'bar':
      return bar;
    case 'mbar':
      return barToMbarAbs(bar);
    case 'kgcm2g':
      return barToKgCm2Gauge(bar);
    case 'mH2O':
      return barToWaterHead(bar);
    default:
      return bar;
  }
}

function getPressureUnitLabel(unit: PressureUnit): string {
  switch (unit) {
    case 'bar':
      return 'bar abs';
    case 'mbar':
      return 'mbar abs';
    case 'kgcm2g':
      return 'kg/cm²(g)';
    case 'mH2O':
      return 'm H₂O';
    default:
      return unit;
  }
}

export default function SteamTablesClient() {
  const [steamMode, setSteamMode] = useState<SteamMode>('saturation');
  const [lookupMode, setLookupMode] = useState<LookupMode>('temperature');
  const [temperatureInput, setTemperatureInput] = useState<string>('100');
  const [pressureInput, setPressureInput] = useState<string>('1.0');
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>('bar');
  const [error, setError] = useState<string | null>(null);

  // Calculate saturation properties
  const saturationResult = useMemo<SaturationResult | null>(() => {
    if (steamMode !== 'saturation') return null;
    setError(null);

    try {
      let tempC: number;
      let pressureBar: number;

      if (lookupMode === 'temperature') {
        tempC = parseFloat(temperatureInput);
        if (isNaN(tempC)) return null;
        if (tempC < 0.01 || tempC > CRITICAL_TEMPERATURE_C) {
          setError(`Temperature must be between 0.01°C and ${CRITICAL_TEMPERATURE_C.toFixed(1)}°C`);
          return null;
        }
        pressureBar = getSaturationPressure(tempC);
      } else {
        const pressureValue = parseFloat(pressureInput);
        if (isNaN(pressureValue)) return null;
        pressureBar = convertPressureToBar(pressureValue, pressureUnit);
        if (pressureBar < 0.00611 || pressureBar > CRITICAL_PRESSURE_BAR) {
          setError(
            `Pressure must be between 0.00611 bar and ${CRITICAL_PRESSURE_BAR.toFixed(1)} bar`
          );
          return null;
        }
        tempC = getSaturationTemperature(pressureBar);
      }

      return {
        temperature: tempC,
        pressure: pressureBar,
        enthalpyLiquid: getEnthalpyLiquid(tempC),
        enthalpyVapor: getEnthalpyVapor(tempC),
        latentHeat: getLatentHeat(tempC),
        densityLiquid: getDensityLiquid(tempC),
        densityVapor: getDensityVapor(tempC),
        specificVolumeLiquid: getSpecificVolumeLiquid(tempC),
        specificVolumeVapor: getSpecificVolumeVapor(tempC),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [steamMode, lookupMode, temperatureInput, pressureInput, pressureUnit]);

  // Calculate subcooled properties (Region 1)
  const subcooledResult = useMemo<SubcooledResult | null>(() => {
    if (steamMode !== 'subcooled') return null;
    setError(null);

    try {
      const tempC = parseFloat(temperatureInput);
      const pressureValue = parseFloat(pressureInput);
      if (isNaN(tempC) || isNaN(pressureValue)) return null;

      const pressureBar = convertPressureToBar(pressureValue, pressureUnit);

      // Validate ranges
      if (tempC < 0 || tempC > 350) {
        setError('Temperature must be between 0°C and 350°C for subcooled liquid');
        return null;
      }
      if (pressureBar < 0.00611 || pressureBar > 1000) {
        setError('Pressure must be between 0.00611 bar and 1000 bar');
        return null;
      }

      // Check if actually subcooled
      const region = getRegion(pressureBar, tempC);
      if (region !== 1) {
        const tSat = getSaturationTemperature(pressureBar);
        setError(
          `Not subcooled: T=${tempC}°C is above T_sat=${tSat.toFixed(1)}°C at P=${pressureBar.toFixed(2)} bar. Use Saturation or Superheated mode.`
        );
        return null;
      }

      const props = getSubcooledProperties(pressureBar, tempC);

      return {
        temperature: tempC,
        pressure: pressureBar,
        subcooling: props.subcooling,
        enthalpy: props.enthalpy,
        density: props.density,
        specificVolume: props.specificVolume,
        specificHeat: props.specificHeat,
        speedOfSound: props.speedOfSound,
        internalEnergy: props.internalEnergy,
        entropy: props.entropy,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [steamMode, temperatureInput, pressureInput, pressureUnit]);

  // Calculate superheated properties (Region 2)
  const superheatedResult = useMemo<SuperheatedResult | null>(() => {
    if (steamMode !== 'superheated') return null;
    setError(null);

    try {
      const tempC = parseFloat(temperatureInput);
      const pressureValue = parseFloat(pressureInput);
      if (isNaN(tempC) || isNaN(pressureValue)) return null;

      const pressureBar = convertPressureToBar(pressureValue, pressureUnit);

      // Validate ranges
      if (tempC < 0 || tempC > 800) {
        setError('Temperature must be between 0°C and 800°C for superheated steam');
        return null;
      }
      if (pressureBar <= 0 || pressureBar > 1000) {
        setError('Pressure must be between 0 and 1000 bar');
        return null;
      }

      // Check if actually superheated
      const region = getRegion(pressureBar, tempC);
      if (region !== 2) {
        const tSat = getSaturationTemperature(pressureBar);
        setError(
          `Not superheated: T=${tempC}°C is at or below T_sat=${tSat.toFixed(1)}°C at P=${pressureBar.toFixed(2)} bar. Use Saturation or Subcooled mode.`
        );
        return null;
      }

      const props = getSuperheatedProperties(pressureBar, tempC);

      return {
        temperature: tempC,
        pressure: pressureBar,
        superheat: props.superheat,
        enthalpy: props.enthalpy,
        density: props.density,
        specificVolume: props.specificVolume,
        specificHeat: props.specificHeat,
        speedOfSound: props.speedOfSound,
        internalEnergy: props.internalEnergy,
        entropy: props.entropy,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [steamMode, temperatureInput, pressureInput, pressureUnit]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Steam Tables
          </Typography>
          <Chip label="IAPWS-IF97" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Lookup steam properties for saturation, subcooled liquid, and superheated steam. Uses
          IAPWS-IF97 Regions 1, 2, and 4.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Steam State
            </Typography>

            {/* Steam Mode Selection */}
            <Box sx={{ mb: 3 }}>
              <ToggleButtonGroup
                value={steamMode}
                exclusive
                onChange={(_, newMode) => newMode && setSteamMode(newMode)}
                fullWidth
                size="small"
              >
                <ToggleButton value="saturation">Saturation</ToggleButton>
                <ToggleButton value="subcooled">Subcooled</ToggleButton>
                <ToggleButton value="superheated">Superheated</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {steamMode === 'saturation' && 'Two-phase equilibrium (Region 4)'}
                {steamMode === 'subcooled' && 'Compressed liquid below saturation (Region 1)'}
                {steamMode === 'superheated' && 'Steam above saturation (Region 2)'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Saturation Mode: Temperature OR Pressure */}
            {steamMode === 'saturation' && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Lookup by:
                  </Typography>
                  <ToggleButtonGroup
                    value={lookupMode}
                    exclusive
                    onChange={(_, newMode) => newMode && setLookupMode(newMode)}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="temperature">Temperature</ToggleButton>
                    <ToggleButton value="pressure">Pressure</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {lookupMode === 'temperature' && (
                  <TextField
                    label="Temperature"
                    value={temperatureInput}
                    onChange={(e) => setTemperatureInput(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                    helperText={`Valid range: 0.01 to ${CRITICAL_TEMPERATURE_C.toFixed(1)} °C`}
                  />
                )}

                {lookupMode === 'pressure' && (
                  <Stack spacing={2}>
                    <TextField
                      label="Pressure"
                      value={pressureInput}
                      onChange={(e) => setPressureInput(e.target.value)}
                      type="number"
                      fullWidth
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel>Unit</InputLabel>
                      <Select
                        value={pressureUnit}
                        label="Unit"
                        onChange={(e) => setPressureUnit(e.target.value as PressureUnit)}
                      >
                        <MenuItem value="bar">bar (absolute)</MenuItem>
                        <MenuItem value="mbar">mbar (absolute)</MenuItem>
                        <MenuItem value="kgcm2g">kg/cm² (gauge)</MenuItem>
                        <MenuItem value="mH2O">m H₂O</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                )}
              </>
            )}

            {/* Subcooled/Superheated Mode: Both P and T required */}
            {(steamMode === 'subcooled' || steamMode === 'superheated') && (
              <Stack spacing={2}>
                <TextField
                  label="Temperature"
                  value={temperatureInput}
                  onChange={(e) => setTemperatureInput(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                  }}
                  helperText={
                    steamMode === 'subcooled'
                      ? 'Valid range: 0 to 350°C'
                      : 'Valid range: 0 to 800°C'
                  }
                />
                <TextField
                  label="Pressure"
                  value={pressureInput}
                  onChange={(e) => setPressureInput(e.target.value)}
                  type="number"
                  fullWidth
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Pressure Unit</InputLabel>
                  <Select
                    value={pressureUnit}
                    label="Pressure Unit"
                    onChange={(e) => setPressureUnit(e.target.value as PressureUnit)}
                  >
                    <MenuItem value="bar">bar (absolute)</MenuItem>
                    <MenuItem value="mbar">mbar (absolute)</MenuItem>
                    <MenuItem value="kgcm2g">kg/cm² (gauge)</MenuItem>
                    <MenuItem value="mH2O">m H₂O</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}

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
          {/* Saturation Results */}
          {steamMode === 'saturation' && saturationResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Saturation Properties
              </Typography>

              {/* Primary Values */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mb: 3,
                  p: 2,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Saturation Temperature
                  </Typography>
                  <Typography variant="h5">{saturationResult.temperature.toFixed(2)} °C</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Saturation Pressure
                  </Typography>
                  <Typography variant="h5">
                    {convertBarToPressureUnit(saturationResult.pressure, pressureUnit).toFixed(4)}{' '}
                    {getPressureUnitLabel(pressureUnit)}
                  </Typography>
                  {pressureUnit !== 'bar' && (
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      ({saturationResult.pressure.toFixed(4)} bar)
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Detailed Properties Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Property</TableCell>
                      <TableCell align="right">Liquid (f)</TableCell>
                      <TableCell align="right">Vapor (g)</TableCell>
                      <TableCell align="right">Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Specific Enthalpy (h)</TableCell>
                      <TableCell align="right">
                        {saturationResult.enthalpyLiquid.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        {saturationResult.enthalpyVapor.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Latent Heat (h_fg)</TableCell>
                      <TableCell align="right" colSpan={2}>
                        {saturationResult.latentHeat.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Density (ρ)</TableCell>
                      <TableCell align="right">
                        {saturationResult.densityLiquid.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        {saturationResult.densityVapor.toFixed(4)}
                      </TableCell>
                      <TableCell align="right">kg/m³</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Volume (v)</TableCell>
                      <TableCell align="right">
                        {saturationResult.specificVolumeLiquid.toFixed(6)}
                      </TableCell>
                      <TableCell align="right">
                        {saturationResult.specificVolumeVapor.toFixed(4)}
                      </TableCell>
                      <TableCell align="right">m³/kg</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Subcooled Results */}
          {steamMode === 'subcooled' && subcooledResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Subcooled Liquid Properties
              </Typography>

              {/* Primary Values */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  mb: 3,
                  p: 2,
                  bgcolor: 'info.main',
                  color: 'info.contrastText',
                  borderRadius: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Temperature
                  </Typography>
                  <Typography variant="h5">{subcooledResult.temperature.toFixed(2)} °C</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Pressure
                  </Typography>
                  <Typography variant="h5">
                    {convertBarToPressureUnit(subcooledResult.pressure, pressureUnit).toFixed(4)}{' '}
                    {getPressureUnitLabel(pressureUnit)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Subcooling
                  </Typography>
                  <Typography variant="h5">{subcooledResult.subcooling.toFixed(2)} °C</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Properties Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Property</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Specific Enthalpy (h)</TableCell>
                      <TableCell align="right">{subcooledResult.enthalpy.toFixed(2)}</TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Density (ρ)</TableCell>
                      <TableCell align="right">{subcooledResult.density.toFixed(2)}</TableCell>
                      <TableCell align="right">kg/m³</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Volume (v)</TableCell>
                      <TableCell align="right">
                        {subcooledResult.specificVolume.toFixed(6)}
                      </TableCell>
                      <TableCell align="right">m³/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Heat (Cp)</TableCell>
                      <TableCell align="right">{subcooledResult.specificHeat.toFixed(4)}</TableCell>
                      <TableCell align="right">kJ/(kg·K)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Internal Energy (u)</TableCell>
                      <TableCell align="right">
                        {subcooledResult.internalEnergy.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Entropy (s)</TableCell>
                      <TableCell align="right">{subcooledResult.entropy.toFixed(4)}</TableCell>
                      <TableCell align="right">kJ/(kg·K)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Speed of Sound (w)</TableCell>
                      <TableCell align="right">{subcooledResult.speedOfSound.toFixed(1)}</TableCell>
                      <TableCell align="right">m/s</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Superheated Results */}
          {steamMode === 'superheated' && superheatedResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Superheated Steam Properties
              </Typography>

              {/* Primary Values */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  mb: 3,
                  p: 2,
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  borderRadius: 1,
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Temperature
                  </Typography>
                  <Typography variant="h5">
                    {superheatedResult.temperature.toFixed(2)} °C
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Pressure
                  </Typography>
                  <Typography variant="h5">
                    {convertBarToPressureUnit(superheatedResult.pressure, pressureUnit).toFixed(4)}{' '}
                    {getPressureUnitLabel(pressureUnit)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Superheat
                  </Typography>
                  <Typography variant="h5">{superheatedResult.superheat.toFixed(2)} °C</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Properties Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Property</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Specific Enthalpy (h)</TableCell>
                      <TableCell align="right">{superheatedResult.enthalpy.toFixed(2)}</TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Density (ρ)</TableCell>
                      <TableCell align="right">{superheatedResult.density.toFixed(4)}</TableCell>
                      <TableCell align="right">kg/m³</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Volume (v)</TableCell>
                      <TableCell align="right">
                        {superheatedResult.specificVolume.toFixed(4)}
                      </TableCell>
                      <TableCell align="right">m³/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Heat (Cp)</TableCell>
                      <TableCell align="right">
                        {superheatedResult.specificHeat.toFixed(4)}
                      </TableCell>
                      <TableCell align="right">kJ/(kg·K)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Internal Energy (u)</TableCell>
                      <TableCell align="right">
                        {superheatedResult.internalEnergy.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Entropy (s)</TableCell>
                      <TableCell align="right">{superheatedResult.entropy.toFixed(4)}</TableCell>
                      <TableCell align="right">kJ/(kg·K)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Speed of Sound (w)</TableCell>
                      <TableCell align="right">
                        {superheatedResult.speedOfSound.toFixed(1)}
                      </TableCell>
                      <TableCell align="right">m/s</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Empty State */}
          {!saturationResult && !subcooledResult && !superheatedResult && !error && (
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
                Enter values to lookup properties
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will update automatically
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Reference Table */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Quick Reference Table (10°C intervals)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>T (°C)</TableCell>
                  <TableCell align="right">P_sat (bar)</TableCell>
                  <TableCell align="right">h_f (kJ/kg)</TableCell>
                  <TableCell align="right">h_g (kJ/kg)</TableCell>
                  <TableCell align="right">h_fg (kJ/kg)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SATURATION_TABLE.map((row: (typeof SATURATION_TABLE)[number]) => (
                  <TableRow
                    key={row.tempC}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSteamMode('saturation');
                      setLookupMode('temperature');
                      setTemperatureInput(row.tempC.toString());
                    }}
                  >
                    <TableCell>{row.tempC}</TableCell>
                    <TableCell align="right">{row.pBar.toFixed(4)}</TableCell>
                    <TableCell align="right">{row.hf.toFixed(1)}</TableCell>
                    <TableCell align="right">{row.hg.toFixed(1)}</TableCell>
                    <TableCell align="right">{row.hfg.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Click any row to lookup full properties at that temperature
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Reference
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          IAPWS-IF97: International Association for the Properties of Water and Steam - Industrial
          Formulation 1997.
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <strong>Valid ranges:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            <li>
              <strong>Saturation (Region 4):</strong> 0.01°C to 373.946°C (critical point)
            </li>
            <li>
              <strong>Subcooled Liquid (Region 1):</strong> 0-350°C, P &gt; P_sat, up to 1000 bar
            </li>
            <li>
              <strong>Superheated Steam (Region 2):</strong> T_sat to 800°C, up to 1000 bar
            </li>
          </ul>
        </Typography>
      </Box>
    </Container>
  );
}
