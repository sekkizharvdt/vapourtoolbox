'use client';

/**
 * Seawater Properties Calculator
 *
 * Calculate thermophysical properties of seawater at given temperature and salinity.
 * Uses MIT correlations (Sharqawy et al., 2010).
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Alert,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  getSeawaterDensity,
  getSeawaterSpecificHeat,
  getSeawaterEnthalpy,
  getBoilingPointElevation,
  getSeawaterThermalConductivity,
  getSeawaterViscosity,
  SEAWATER_35000_PPM_TABLE,
  BPE_REFERENCE_TABLE,
} from '@vapour/constants';

type SalinityUnit = 'ppm' | 'gkg' | 'percent';

interface SeawaterResult {
  density: number;
  specificHeat: number;
  enthalpy: number;
  bpe: number;
  thermalConductivity: number;
  viscosity: number;
}

interface SalinityPreset {
  label: string;
  value: number;
  description: string;
}

const SALINITY_PRESETS: SalinityPreset[] = [
  { label: 'Brackish', value: 5000, description: 'Low salinity brackish water' },
  { label: 'Standard Seawater', value: 35000, description: 'Average ocean salinity' },
  { label: 'Gulf Seawater', value: 45000, description: 'Arabian Gulf typical' },
  { label: 'Brine (50g/kg)', value: 50000, description: 'Concentrated brine' },
  { label: 'Brine (70g/kg)', value: 70000, description: 'High concentration brine' },
  { label: 'Brine (100g/kg)', value: 100000, description: 'Very high concentration' },
];

function convertSalinityToPPM(value: number, unit: SalinityUnit): number {
  switch (unit) {
    case 'ppm':
      return value;
    case 'gkg':
      return value * 1000;
    case 'percent':
      return value * 10000;
    default:
      return value;
  }
}

function formatNumber(value: number, decimals: number): string {
  if (Math.abs(value) < 0.0001) {
    return value.toExponential(decimals);
  }
  return value.toFixed(decimals);
}

export default function SeawaterPropertiesClient() {
  const [temperatureInput, setTemperatureInput] = useState<string>('40');
  const [salinityInput, setSalinityInput] = useState<string>('35000');
  const [salinityUnit, setSalinityUnit] = useState<SalinityUnit>('ppm');
  const [error, setError] = useState<string | null>(null);

  const salinityPPM = useMemo(() => {
    const value = parseFloat(salinityInput);
    if (isNaN(value)) return 0;
    return convertSalinityToPPM(value, salinityUnit);
  }, [salinityInput, salinityUnit]);

  const temperature = useMemo(() => {
    return parseFloat(temperatureInput) || 0;
  }, [temperatureInput]);

  // Calculate seawater properties
  const result = useMemo<SeawaterResult | null>(() => {
    setError(null);

    try {
      if (isNaN(temperature) || isNaN(salinityPPM)) return null;

      // Validate inputs
      if (temperature < 0 || temperature > 180) {
        setError('Temperature must be between 0°C and 180°C');
        return null;
      }
      if (salinityPPM < 0 || salinityPPM > 120000) {
        setError('Salinity must be between 0 and 120,000 ppm (12%)');
        return null;
      }

      return {
        density: getSeawaterDensity(salinityPPM, temperature),
        specificHeat: getSeawaterSpecificHeat(salinityPPM, temperature),
        enthalpy: getSeawaterEnthalpy(salinityPPM, temperature),
        bpe: getBoilingPointElevation(salinityPPM, temperature),
        thermalConductivity: getSeawaterThermalConductivity(salinityPPM, temperature),
        viscosity: getSeawaterViscosity(salinityPPM, temperature),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [temperature, salinityPPM]);

  const handlePresetClick = (preset: SalinityPreset) => {
    setSalinityUnit('ppm');
    setSalinityInput(preset.value.toString());
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Seawater Properties
          </Typography>
          <Chip label="MIT Correlations" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate thermophysical properties of seawater and brine at given temperature and
          salinity. Uses the Sharqawy et al. (2010) correlations.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>

            <Stack spacing={3}>
              {/* Temperature */}
              <TextField
                label="Temperature"
                value={temperatureInput}
                onChange={(e) => setTemperatureInput(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                }}
                helperText="Valid range: 0 to 180 °C"
              />

              {/* Salinity */}
              <Box>
                <TextField
                  label="Salinity"
                  value={salinityInput}
                  onChange={(e) => setSalinityInput(e.target.value)}
                  type="number"
                  fullWidth
                />
                <FormControl fullWidth sx={{ mt: 1 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={salinityUnit}
                    label="Unit"
                    onChange={(e) => setSalinityUnit(e.target.value as SalinityUnit)}
                    size="small"
                  >
                    <MenuItem value="ppm">ppm (mg/L)</MenuItem>
                    <MenuItem value="gkg">g/kg (‰)</MenuItem>
                    <MenuItem value="percent">% (w/w)</MenuItem>
                  </Select>
                </FormControl>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  = {salinityPPM.toLocaleString()} ppm ({(salinityPPM / 1000).toFixed(1)} g/kg)
                </Typography>
              </Box>

              {/* Salinity Presets */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Quick presets:
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {SALINITY_PRESETS.map((preset) => (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      size="small"
                      variant={salinityPPM === preset.value ? 'filled' : 'outlined'}
                      color={salinityPPM === preset.value ? 'primary' : 'default'}
                      onClick={() => handlePresetClick(preset)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Box>
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
                Calculated Properties
              </Typography>

              <Grid container spacing={2}>
                {/* Density */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Density (ρ)
                      </Typography>
                      <Typography variant="h5">{result.density.toFixed(1)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        kg/m³
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Specific Heat */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Specific Heat (Cp)
                      </Typography>
                      <Typography variant="h5">{result.specificHeat.toFixed(3)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        kJ/(kg·K)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Enthalpy */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Specific Enthalpy (h)
                      </Typography>
                      <Typography variant="h5">{result.enthalpy.toFixed(1)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        kJ/kg
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* BPE */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card
                    variant="outlined"
                    sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}
                  >
                    <CardContent>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Boiling Point Elevation (BPE)
                      </Typography>
                      <Typography variant="h5">{result.bpe.toFixed(3)}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        °C
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Thermal Conductivity */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Thermal Conductivity (k)
                      </Typography>
                      <Typography variant="h5">{result.thermalConductivity.toFixed(4)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        W/(m·K)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Viscosity */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Dynamic Viscosity (μ)
                      </Typography>
                      <Typography variant="h5">
                        {formatNumber(result.viscosity * 1000, 3)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        mPa·s (cP)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
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
                  Enter temperature and salinity
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Reference Tables */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Reference: Standard Seawater (35 g/kg)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>T (°C)</TableCell>
                  <TableCell align="right">ρ (kg/m³)</TableCell>
                  <TableCell align="right">Cp (kJ/kg·K)</TableCell>
                  <TableCell align="right">μ (mPa·s)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SEAWATER_35000_PPM_TABLE.map((row: (typeof SEAWATER_35000_PPM_TABLE)[number]) => (
                  <TableRow
                    key={row.tempC}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setTemperatureInput(row.tempC.toString());
                      setSalinityUnit('ppm');
                      setSalinityInput('35000');
                    }}
                  >
                    <TableCell>{row.tempC}</TableCell>
                    <TableCell align="right">{row.density.toFixed(1)}</TableCell>
                    <TableCell align="right">{row.cp.toFixed(3)}</TableCell>
                    <TableCell align="right">{(row.viscosity * 1000).toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Click any row to use that temperature with standard seawater salinity
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Reference: Boiling Point Elevation at 100°C</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Salinity (ppm)</TableCell>
                  <TableCell align="right">Salinity (g/kg)</TableCell>
                  <TableCell align="right">BPE (°C)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {BPE_REFERENCE_TABLE.map((row: (typeof BPE_REFERENCE_TABLE)[number]) => (
                  <TableRow
                    key={row.salinity}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setTemperatureInput('100');
                      setSalinityUnit('ppm');
                      setSalinityInput(row.salinity.toString());
                    }}
                  >
                    <TableCell>{row.salinity.toLocaleString()}</TableCell>
                    <TableCell align="right">{(row.salinity / 1000).toFixed(0)}</TableCell>
                    <TableCell align="right">{row.bpe.toFixed(2)}</TableCell>
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
          Reference
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Sharqawy, M.H., Lienhard V, J.H., and Zubair, S.M., &quot;Thermophysical properties of
          seawater: A review of existing correlations and data,&quot; Desalination and Water
          Treatment, Vol. 16, pp. 354-380, 2010.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Valid ranges: Temperature 0-180°C, Salinity 0-120,000 ppm (0-12% w/w)
        </Typography>
      </Box>
    </Container>
  );
}
