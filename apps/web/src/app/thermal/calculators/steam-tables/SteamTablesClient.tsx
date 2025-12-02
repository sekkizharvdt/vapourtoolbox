'use client';

/**
 * Steam Tables Calculator
 *
 * Lookup saturation properties for water/steam by temperature or pressure.
 * Uses IAPWS-IF97 correlations from @vapour/constants.
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
} from '@vapour/constants';

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
  const [mode, setMode] = useState<LookupMode>('temperature');
  const [temperatureInput, setTemperatureInput] = useState<string>('100');
  const [pressureInput, setPressureInput] = useState<string>('1.0');
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>('bar');
  const [error, setError] = useState<string | null>(null);

  // Calculate saturation properties
  const result = useMemo<SaturationResult | null>(() => {
    setError(null);

    try {
      let tempC: number;
      let pressureBar: number;

      if (mode === 'temperature') {
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
  }, [mode, temperatureInput, pressureInput, pressureUnit]);

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
          Lookup saturation properties for water and steam. Properties are calculated using the
          IAPWS Industrial Formulation 1997 for valid temperatures (0.01-374°C).
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Lookup Input
            </Typography>

            {/* Mode Toggle */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Lookup by:
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, newMode) => newMode && setMode(newMode)}
                fullWidth
              >
                <ToggleButton value="temperature">Temperature</ToggleButton>
                <ToggleButton value="pressure">Pressure</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Temperature Input */}
            {mode === 'temperature' && (
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

            {/* Pressure Input */}
            {mode === 'pressure' && (
              <Stack spacing={2}>
                <TextField
                  label="Pressure"
                  value={pressureInput}
                  onChange={(e) => setPressureInput(e.target.value)}
                  type="number"
                  fullWidth
                />
                <FormControl fullWidth>
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
                  <Typography variant="h5">{result.temperature.toFixed(2)} °C</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Saturation Pressure
                  </Typography>
                  <Typography variant="h5">
                    {convertBarToPressureUnit(result.pressure, pressureUnit).toFixed(4)}{' '}
                    {getPressureUnitLabel(pressureUnit)}
                  </Typography>
                  {pressureUnit !== 'bar' && (
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      ({result.pressure.toFixed(4)} bar)
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
                      <TableCell align="right">{result.enthalpyLiquid.toFixed(2)}</TableCell>
                      <TableCell align="right">{result.enthalpyVapor.toFixed(2)}</TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Latent Heat (h_fg)</TableCell>
                      <TableCell align="right" colSpan={2}>
                        {result.latentHeat.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">kJ/kg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Density (ρ)</TableCell>
                      <TableCell align="right">{result.densityLiquid.toFixed(2)}</TableCell>
                      <TableCell align="right">{result.densityVapor.toFixed(4)}</TableCell>
                      <TableCell align="right">kg/m³</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Specific Volume (v)</TableCell>
                      <TableCell align="right">{result.specificVolumeLiquid.toFixed(6)}</TableCell>
                      <TableCell align="right">{result.specificVolumeVapor.toFixed(4)}</TableCell>
                      <TableCell align="right">m³/kg</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
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
                  Enter a value to lookup properties
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
                      setMode('temperature');
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
        <Typography variant="body2" color="text.secondary">
          IAPWS-IF97: International Association for the Properties of Water and Steam - Industrial
          Formulation 1997. Valid for saturation conditions from triple point (0.01°C) to critical
          point (373.946°C).
        </Typography>
      </Box>
    </Container>
  );
}
