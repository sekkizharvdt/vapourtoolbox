'use client';

/**
 * Heat Duty Calculator
 *
 * Calculate sensible and latent heat duty for thermal processes
 * with LMTD calculation for heat exchanger sizing.
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  calculateHeatExchangerArea,
  TYPICAL_HTC,
  type HeatFluidType,
  type FlowArrangement,
} from '@/lib/thermal';

type CalculationMode = 'sensible' | 'latent' | 'lmtd';

export default function HeatDutyClient() {
  // Mode
  const [mode, setMode] = useState<CalculationMode>('sensible');

  // Sensible heat inputs
  const [fluidType, setFluidType] = useState<HeatFluidType>('SEAWATER');
  const [salinity, setSalinity] = useState<string>('35000');
  const [massFlowRate, setMassFlowRate] = useState<string>('100');
  const [inletTemp, setInletTemp] = useState<string>('25');
  const [outletTemp, setOutletTemp] = useState<string>('40');

  // Latent heat inputs
  const [latentFlowRate, setLatentFlowRate] = useState<string>('10');
  const [saturationTemp, setSaturationTemp] = useState<string>('60');
  const [process, setProcess] = useState<'EVAPORATION' | 'CONDENSATION'>('EVAPORATION');

  // LMTD inputs
  const [hotInlet, setHotInlet] = useState<string>('90');
  const [hotOutlet, setHotOutlet] = useState<string>('50');
  const [coldInlet, setColdInlet] = useState<string>('25');
  const [coldOutlet, setColdOutlet] = useState<string>('40');
  const [flowArrangement, setFlowArrangement] = useState<FlowArrangement>('COUNTER');

  // Heat exchanger sizing
  const [overallHTC, setOverallHTC] = useState<string>('1500');
  const [heatDutyForArea, setHeatDutyForArea] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Calculate sensible heat
  const sensibleResult = useMemo(() => {
    if (mode !== 'sensible') return null;
    setError(null);

    try {
      const flow = parseFloat(massFlowRate);
      const tIn = parseFloat(inletTemp);
      const tOut = parseFloat(outletTemp);

      if (isNaN(flow) || flow <= 0 || isNaN(tIn) || isNaN(tOut)) return null;

      return calculateSensibleHeat({
        fluidType,
        salinity: fluidType === 'SEAWATER' ? parseFloat(salinity) || 35000 : undefined,
        massFlowRate: flow,
        inletTemperature: tIn,
        outletTemperature: tOut,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, fluidType, salinity, massFlowRate, inletTemp, outletTemp]);

  // Calculate latent heat
  const latentResult = useMemo(() => {
    if (mode !== 'latent') return null;
    setError(null);

    try {
      const flow = parseFloat(latentFlowRate);
      const temp = parseFloat(saturationTemp);

      if (isNaN(flow) || flow <= 0 || isNaN(temp)) return null;

      return calculateLatentHeat({
        massFlowRate: flow,
        temperature: temp,
        process,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, latentFlowRate, saturationTemp, process]);

  // Calculate LMTD
  const lmtdResult = useMemo(() => {
    if (mode !== 'lmtd') return null;
    setError(null);

    try {
      const hIn = parseFloat(hotInlet);
      const hOut = parseFloat(hotOutlet);
      const cIn = parseFloat(coldInlet);
      const cOut = parseFloat(coldOutlet);

      if (isNaN(hIn) || isNaN(hOut) || isNaN(cIn) || isNaN(cOut)) return null;

      return calculateLMTD({
        hotInlet: hIn,
        hotOutlet: hOut,
        coldInlet: cIn,
        coldOutlet: cOut,
        flowArrangement,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, hotInlet, hotOutlet, coldInlet, coldOutlet, flowArrangement]);

  // Calculate required area
  const requiredArea = useMemo(() => {
    if (mode !== 'lmtd' || !lmtdResult) return null;

    const htc = parseFloat(overallHTC);
    const duty = parseFloat(heatDutyForArea);

    if (isNaN(htc) || htc <= 0 || isNaN(duty) || duty <= 0) return null;
    if (lmtdResult.correctedLMTD <= 0) return null;

    return calculateHeatExchangerArea(duty, htc, lmtdResult.correctedLMTD);
  }, [mode, lmtdResult, overallHTC, heatDutyForArea]);

  // Note: currentHeatDuty could be used to auto-populate the heatDutyForArea field
  // Currently not implemented but keeping logic for potential future use
  void (sensibleResult?.heatDuty || latentResult?.heatDuty);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Heat Duty Calculator
          </Typography>
          <Chip label="First Law" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate sensible and latent heat duty for thermal processes. Includes LMTD calculation
          for heat exchanger sizing.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Calculation Mode
            </Typography>

            {/* Mode Toggle */}
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            >
              <ToggleButton value="sensible">Sensible</ToggleButton>
              <ToggleButton value="latent">Latent</ToggleButton>
              <ToggleButton value="lmtd">LMTD</ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ mb: 2 }} />

            {/* Sensible Heat Inputs */}
            {mode === 'sensible' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Fluid Type</InputLabel>
                  <Select
                    value={fluidType}
                    label="Fluid Type"
                    onChange={(e) => setFluidType(e.target.value as HeatFluidType)}
                  >
                    <MenuItem value="PURE_WATER">Pure Water</MenuItem>
                    <MenuItem value="SEAWATER">Seawater</MenuItem>
                  </Select>
                </FormControl>

                {fluidType === 'SEAWATER' && (
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

                <TextField
                  label="Mass Flow Rate"
                  value={massFlowRate}
                  onChange={(e) => setMassFlowRate(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
                  }}
                />

                <TextField
                  label="Inlet Temperature"
                  value={inletTemp}
                  onChange={(e) => setInletTemp(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                  }}
                />

                <TextField
                  label="Outlet Temperature"
                  value={outletTemp}
                  onChange={(e) => setOutletTemp(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                  }}
                />
              </Stack>
            )}

            {/* Latent Heat Inputs */}
            {mode === 'latent' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Process</InputLabel>
                  <Select
                    value={process}
                    label="Process"
                    onChange={(e) => setProcess(e.target.value as 'EVAPORATION' | 'CONDENSATION')}
                  >
                    <MenuItem value="EVAPORATION">Evaporation</MenuItem>
                    <MenuItem value="CONDENSATION">Condensation</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label={process === 'EVAPORATION' ? 'Vapor Production Rate' : 'Condensate Rate'}
                  value={latentFlowRate}
                  onChange={(e) => setLatentFlowRate(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
                  }}
                />

                <TextField
                  label="Saturation Temperature"
                  value={saturationTemp}
                  onChange={(e) => setSaturationTemp(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                  }}
                  helperText="Temperature at which evaporation/condensation occurs"
                />
              </Stack>
            )}

            {/* LMTD Inputs */}
            {mode === 'lmtd' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Flow Arrangement</InputLabel>
                  <Select
                    value={flowArrangement}
                    label="Flow Arrangement"
                    onChange={(e) => setFlowArrangement(e.target.value as FlowArrangement)}
                  >
                    <MenuItem value="COUNTER">Counter-Current</MenuItem>
                    <MenuItem value="PARALLEL">Parallel Flow</MenuItem>
                    <MenuItem value="CROSSFLOW">Crossflow</MenuItem>
                  </Select>
                </FormControl>

                <Typography variant="subtitle2" color="text.secondary">
                  Hot Side
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Inlet"
                    value={hotInlet}
                    onChange={(e) => setHotInlet(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                  />
                  <TextField
                    label="Outlet"
                    value={hotOutlet}
                    onChange={(e) => setHotOutlet(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                  />
                </Stack>

                <Typography variant="subtitle2" color="text.secondary">
                  Cold Side
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Inlet"
                    value={coldInlet}
                    onChange={(e) => setColdInlet(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                  />
                  <TextField
                    label="Outlet"
                    value={coldOutlet}
                    onChange={(e) => setColdOutlet(e.target.value)}
                    type="number"
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                  />
                </Stack>

                <Divider />

                <Typography variant="subtitle2">Heat Exchanger Sizing</Typography>

                <TextField
                  label="Overall HTC (U)"
                  value={overallHTC}
                  onChange={(e) => setOverallHTC(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">W/(m²·K)</InputAdornment>,
                  }}
                />

                <TextField
                  label="Heat Duty (Q)"
                  value={heatDutyForArea}
                  onChange={(e) => setHeatDutyForArea(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kW</InputAdornment>,
                  }}
                  helperText="Enter to calculate required area"
                />
              </Stack>
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
          {/* Sensible Heat Result */}
          {mode === 'sensible' && sensibleResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Sensible Heat Result
              </Typography>

              <Card
                variant="outlined"
                sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
              >
                <CardContent>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Heat Duty (Q = m × Cp × ΔT)
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={2}>
                    <Typography variant="h3">{sensibleResult.heatDuty.toFixed(1)}</Typography>
                    <Typography variant="h6">kW</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                    = {(sensibleResult.heatDuty / 1000).toFixed(3)} MW
                  </Typography>
                </CardContent>
              </Card>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Specific Heat
                      </Typography>
                      <Typography variant="h6">{sensibleResult.specificHeat.toFixed(3)}</Typography>
                      <Typography variant="caption">kJ/(kg·K)</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Temperature Change
                      </Typography>
                      <Typography variant="h6">{sensibleResult.deltaT.toFixed(1)}</Typography>
                      <Typography variant="caption">°C</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Process
                      </Typography>
                      <Typography variant="h6">
                        {sensibleResult.isHeating ? 'Heating' : 'Cooling'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Formula:</strong> Q = ṁ × Cp × ΔT
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Q = {sensibleResult.massFlowKgS.toFixed(3)} kg/s ×{' '}
                  {sensibleResult.specificHeat.toFixed(3)} kJ/(kg·K) ×{' '}
                  {sensibleResult.deltaT.toFixed(1)} K
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Latent Heat Result */}
          {mode === 'latent' && latentResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Latent Heat Result
              </Typography>

              <Card
                variant="outlined"
                sx={{ mb: 3, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
              >
                <CardContent>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Heat Duty (Q = m × hfg)
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={2}>
                    <Typography variant="h3">{latentResult.heatDuty.toFixed(1)}</Typography>
                    <Typography variant="h6">kW</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                    = {(latentResult.heatDuty / 1000).toFixed(3)} MW
                  </Typography>
                </CardContent>
              </Card>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Latent Heat
                      </Typography>
                      <Typography variant="h6">{latentResult.latentHeat.toFixed(1)}</Typography>
                      <Typography variant="caption">kJ/kg</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Mass Flow
                      </Typography>
                      <Typography variant="h6">{latentResult.massFlowKgS.toFixed(3)}</Typography>
                      <Typography variant="caption">kg/s</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Process
                      </Typography>
                      <Typography variant="h6">
                        {latentResult.process === 'EVAPORATION' ? 'Evap.' : 'Cond.'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Formula:</strong> Q = ṁ × hfg
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Q = {latentResult.massFlowKgS.toFixed(3)} kg/s ×{' '}
                  {latentResult.latentHeat.toFixed(1)} kJ/kg
                </Typography>
              </Box>
            </Paper>
          )}

          {/* LMTD Result */}
          {mode === 'lmtd' && lmtdResult && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                LMTD Result
              </Typography>

              {lmtdResult.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {lmtdResult.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </Alert>
              )}

              <Card
                variant="outlined"
                sx={{ mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}
              >
                <CardContent>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Log Mean Temperature Difference
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={2}>
                    <Typography variant="h3">{lmtdResult.correctedLMTD.toFixed(2)}</Typography>
                    <Typography variant="h6">°C</Typography>
                  </Stack>
                  {lmtdResult.correctionFactor < 1 && (
                    <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                      (Uncorrected: {lmtdResult.lmtd.toFixed(2)}°C, F ={' '}
                      {lmtdResult.correctionFactor.toFixed(3)})
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Grid container spacing={2} mb={3}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        ΔT₁
                      </Typography>
                      <Typography variant="h6">{lmtdResult.deltaT1.toFixed(1)}</Typography>
                      <Typography variant="caption">°C</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        ΔT₂
                      </Typography>
                      <Typography variant="h6">{lmtdResult.deltaT2.toFixed(1)}</Typography>
                      <Typography variant="caption">°C</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Flow Type
                      </Typography>
                      <Typography variant="h6">{lmtdResult.flowArrangement}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Required Area */}
              {requiredArea !== null && (
                <Card variant="outlined" sx={{ mb: 3, borderColor: 'success.main' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Required Heat Transfer Area (A = Q / U × LMTD)
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {requiredArea.toFixed(2)} m²
                    </Typography>
                  </CardContent>
                </Card>
              )}

              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Formula:</strong> LMTD = (ΔT₁ - ΔT₂) / ln(ΔT₁/ΔT₂)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Q = U × A × LMTD
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Empty State */}
          {((mode === 'sensible' && !sensibleResult) ||
            (mode === 'latent' && !latentResult) ||
            (mode === 'lmtd' && !lmtdResult)) &&
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
                  Enter parameters to calculate heat duty
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )}
        </Grid>
      </Grid>

      {/* Reference Tables */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Typical Overall Heat Transfer Coefficients</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Min (W/m²·K)</TableCell>
                  <TableCell align="right">Typical (W/m²·K)</TableCell>
                  <TableCell align="right">Max (W/m²·K)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(TYPICAL_HTC).map(([key, values]) => (
                  <TableRow
                    key={key}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setOverallHTC(values.typical.toString())}
                  >
                    <TableCell>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </TableCell>
                    <TableCell align="right">{values.min}</TableCell>
                    <TableCell align="right">{values.typical}</TableCell>
                    <TableCell align="right">{values.max}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Click any row to use that typical value
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Formulas
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Sensible Heat:</strong> Q = ṁ × Cp × ΔT (kW)
            </li>
            <li>
              <strong>Latent Heat:</strong> Q = ṁ × hfg (kW)
            </li>
            <li>
              <strong>LMTD:</strong> (ΔT₁ - ΔT₂) / ln(ΔT₁/ΔT₂) (°C)
            </li>
            <li>
              <strong>Heat Exchanger:</strong> Q = U × A × LMTD
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> Perry&apos;s Chemical Engineers&apos; Handbook
        </Typography>
      </Box>
    </Container>
  );
}
