'use client';

/**
 * NPSHa (Net Positive Suction Head Available) Calculator
 *
 * Calculate NPSHa for pump suction systems under various conditions.
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  calculateNPSHa,
  calculateMinimumLiquidLevel,
  type VesselType,
  type LiquidType,
} from '@/lib/thermal';

function getNPSHaStatusIcon(npsha: number) {
  if (npsha < 0) return <ErrorIcon color="error" />;
  if (npsha < 2) return <WarningIcon color="warning" />;
  return <CheckIcon color="success" />;
}

function getNPSHaStatusColor(npsha: number) {
  if (npsha < 0) return 'error.main';
  if (npsha < 2) return 'warning.main';
  return 'success.main';
}

export default function NPSHaClient() {
  // Vessel parameters
  const [vesselType, setVesselType] = useState<VesselType>('OPEN');
  const [vesselPressure, setVesselPressure] = useState<string>('100'); // mbar abs for vacuum
  const [atmosphericPressure, setAtmosphericPressure] = useState<string>('1013.25'); // mbar

  // Liquid parameters
  const [liquidType, setLiquidType] = useState<LiquidType>('SEAWATER');
  const [temperature, setTemperature] = useState<string>('40');
  const [salinity, setSalinity] = useState<string>('35000');

  // System parameters
  const [liquidLevel, setLiquidLevel] = useState<string>('2.0');
  const [frictionLoss, setFrictionLoss] = useState<string>('0.5');

  // NPSHr comparison
  const [npshr, setNpshr] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Calculate NPSHa
  const result = useMemo(() => {
    setError(null);

    try {
      const level = parseFloat(liquidLevel);
      const friction = parseFloat(frictionLoss);
      const temp = parseFloat(temperature);
      const sal = parseFloat(salinity);

      if (isNaN(level) || isNaN(friction) || isNaN(temp)) return null;

      let vesselPressureBar: number | undefined;
      let atmPressureBar: number | undefined;

      if (vesselType === 'OPEN') {
        atmPressureBar = parseFloat(atmosphericPressure) / 1000; // mbar to bar
      } else {
        vesselPressureBar = parseFloat(vesselPressure) / 1000; // mbar to bar
      }

      return calculateNPSHa({
        vesselType,
        liquidLevelAbovePump: level,
        vesselPressure: vesselPressureBar,
        atmosphericPressure: atmPressureBar,
        liquidTemperature: temp,
        liquidType,
        salinity: liquidType === 'SEAWATER' ? sal : undefined,
        frictionLoss: friction,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    vesselType,
    vesselPressure,
    atmosphericPressure,
    liquidType,
    temperature,
    salinity,
    liquidLevel,
    frictionLoss,
  ]);

  // Calculate minimum level for given NPSHr
  const minLevel = useMemo(() => {
    const npshrValue = parseFloat(npshr);
    if (isNaN(npshrValue) || npshrValue <= 0) return null;

    try {
      const temp = parseFloat(temperature);
      const sal = parseFloat(salinity);
      const friction = parseFloat(frictionLoss);

      if (isNaN(temp) || isNaN(friction)) return null;

      let vesselPressureBar: number | undefined;
      let atmPressureBar: number | undefined;

      if (vesselType === 'OPEN') {
        atmPressureBar = parseFloat(atmosphericPressure) / 1000;
      } else {
        vesselPressureBar = parseFloat(vesselPressure) / 1000;
      }

      return calculateMinimumLiquidLevel(npshrValue, {
        vesselType,
        vesselPressure: vesselPressureBar,
        atmosphericPressure: atmPressureBar,
        liquidTemperature: temp,
        liquidType,
        salinity: liquidType === 'SEAWATER' ? sal : undefined,
        frictionLoss: friction,
      });
    } catch {
      return null;
    }
  }, [
    npshr,
    vesselType,
    vesselPressure,
    atmosphericPressure,
    liquidType,
    temperature,
    salinity,
    frictionLoss,
  ]);

  // Check margin if NPSHr provided
  const npshrValue = parseFloat(npshr);
  const margin = result && !isNaN(npshrValue) ? result.npshAvailable - npshrValue : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            NPSHa Calculator
          </Typography>
          <Chip label="Hydraulic Institute" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate Net Positive Suction Head Available for pump suction systems. NPSHa must exceed
          pump NPSHr with adequate margin to prevent cavitation.
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
              {/* Vessel Type */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Vessel Type:
                </Typography>
                <ToggleButtonGroup
                  value={vesselType}
                  exclusive
                  onChange={(_, v) => v && setVesselType(v)}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="OPEN">Open Tank</ToggleButton>
                  <ToggleButton value="CLOSED">Closed</ToggleButton>
                  <ToggleButton value="VACUUM">Vacuum</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Vessel Pressure */}
              {vesselType === 'OPEN' ? (
                <TextField
                  label="Atmospheric Pressure"
                  value={atmosphericPressure}
                  onChange={(e) => setAtmosphericPressure(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mbar</InputAdornment>,
                  }}
                  helperText="Standard: 1013.25 mbar"
                />
              ) : (
                <TextField
                  label="Vessel Pressure"
                  value={vesselPressure}
                  onChange={(e) => setVesselPressure(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
                  }}
                  helperText={
                    vesselType === 'VACUUM'
                      ? 'Vacuum vessel absolute pressure'
                      : 'Closed vessel pressure'
                  }
                />
              )}

              <Divider />

              {/* Liquid Type */}
              <FormControl fullWidth>
                <InputLabel>Liquid Type</InputLabel>
                <Select
                  value={liquidType}
                  label="Liquid Type"
                  onChange={(e) => setLiquidType(e.target.value as LiquidType)}
                >
                  <MenuItem value="PURE_WATER">Pure Water</MenuItem>
                  <MenuItem value="SEAWATER">Seawater</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Liquid Temperature"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                }}
              />

              {liquidType === 'SEAWATER' && (
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

              <Divider />

              <TextField
                label="Liquid Level Above Pump"
                value={liquidLevel}
                onChange={(e) => setLiquidLevel(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                helperText="Positive = above pump centerline"
              />

              <TextField
                label="Friction Loss (Suction Piping)"
                value={frictionLoss}
                onChange={(e) => setFrictionLoss(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                helperText="Pressure drop in suction line"
              />

              <Divider />

              <TextField
                label="Pump NPSHr (Optional)"
                value={npshr}
                onChange={(e) => setNpshr(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                helperText="From pump datasheet - to check margin"
              />
            </Stack>
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
                sx={{
                  mb: 3,
                  borderColor: getNPSHaStatusColor(result.npshAvailable),
                  borderWidth: 2,
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {getNPSHaStatusIcon(result.npshAvailable)}
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        NPSHa (Net Positive Suction Head Available)
                      </Typography>
                      <Typography variant="h3" color={getNPSHaStatusColor(result.npshAvailable)}>
                        {result.npshAvailable.toFixed(2)} m
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Margin check */}
                  {margin !== null && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Pump NPSHr:
                        </Typography>
                        <Typography variant="body2">{npshrValue.toFixed(2)} m</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={
                            margin >= 0.5
                              ? 'success.main'
                              : margin >= 0
                                ? 'warning.main'
                                : 'error.main'
                          }
                        >
                          Margin:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={
                            margin >= 0.5
                              ? 'success.main'
                              : margin >= 0
                                ? 'warning.main'
                                : 'error.main'
                          }
                        >
                          {margin >= 0 ? '+' : ''}
                          {margin.toFixed(2)} m
                        </Typography>
                      </Stack>
                      {margin < 0.5 && margin >= 0 && (
                        <Typography variant="caption" color="warning.main">
                          Recommended margin is 0.5m or more
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Calculation Breakdown */}
              <Typography variant="subtitle2" gutterBottom>
                Calculation Breakdown
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                NPSHa = Hs + Hp - Hvp - Hf
              </Typography>

              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Component</TableCell>
                      <TableCell align="center" width={50}>
                        Sign
                      </TableCell>
                      <TableCell align="right">Value (m)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.breakdown
                      .filter((b) => b.component !== 'BPE Note')
                      .map((b, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Typography variant="body2">{b.component}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {b.description}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography
                              variant="body2"
                              color={b.sign === '+' ? 'success.main' : 'error.main'}
                            >
                              {b.sign}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{Math.abs(b.value).toFixed(3)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" fontWeight="bold">
                          NPSHa
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {result.npshAvailable.toFixed(3)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Additional Info */}
              <Grid container spacing={2} mb={3}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Liquid Density
                      </Typography>
                      <Typography variant="body1">{result.liquidDensity.toFixed(1)}</Typography>
                      <Typography variant="caption">kg/m³</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Vapor Pressure
                      </Typography>
                      <Typography variant="body1">
                        {(result.vaporPressure * 1000).toFixed(1)}
                      </Typography>
                      <Typography variant="caption">mbar</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                {liquidType === 'SEAWATER' && result.boilingPointElevation > 0 && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          BPE
                        </Typography>
                        <Typography variant="body1">
                          {result.boilingPointElevation.toFixed(2)}
                        </Typography>
                        <Typography variant="caption">°C</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>

              {/* Minimum Level Calculation */}
              {minLevel !== null && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Minimum liquid level</strong> for NPSHr of {npshrValue.toFixed(1)} m
                    (with 0.5m margin): <strong>{minLevel.toFixed(2)} m</strong> above pump
                    centerline
                  </Typography>
                </Alert>
              )}

              {/* Recommendation */}
              <Alert
                severity={
                  result.npshAvailable < 0
                    ? 'error'
                    : result.npshAvailable < 2
                      ? 'warning'
                      : 'success'
                }
              >
                <Typography variant="body2">{result.recommendation}</Typography>
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
                  Enter parameters to calculate NPSHa
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          NPSHa Formula
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>NPSHa = Hs + Hp - Hvp - Hf</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Hs</strong> = Static head (liquid level above pump centerline)
            </li>
            <li>
              <strong>Hp</strong> = Pressure head (vessel or atmospheric pressure)
            </li>
            <li>
              <strong>Hvp</strong> = Vapor pressure head (at liquid temperature)
            </li>
            <li>
              <strong>Hf</strong> = Friction loss in suction piping
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Rule of thumb:</strong> NPSHa should be at least 0.5m greater than pump NPSHr.
          Higher margins (1-2m) recommended for critical applications or variable conditions.
        </Typography>
      </Box>
    </Container>
  );
}
