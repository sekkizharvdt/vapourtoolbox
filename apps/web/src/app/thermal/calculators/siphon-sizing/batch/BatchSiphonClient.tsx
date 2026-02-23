'use client';

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Stack,
  Paper,
  Divider,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Chip,
} from '@mui/material';
import { TableChart as ExcelIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import Link from 'next/link';
import {
  calculateSiphonSizing,
  type SiphonSizingInput,
  type SiphonFluidType,
  type PressureUnit,
  type ElbowConfig,
} from '@/lib/thermal/siphonSizingCalculator';
import { exportBatchSiphonToExcel } from '@/lib/thermal/siphonExcelExport';
import { CalculatorBreadcrumb } from '../../components/CalculatorBreadcrumb';
import {
  PRESSURE_UNIT_LABELS,
  FLUID_TYPE_LABELS,
  ELBOW_CONFIG_LABELS,
  PIPE_SCHEDULE_OPTIONS,
} from '../components/types';
import {
  EffectInputTable,
  createDefaultEffects,
  type EffectRow,
} from './components/EffectInputTable';
import { BatchResultsTable, type BatchResult } from './components/BatchResultsTable';

export default function BatchSiphonClient() {
  // Effect data
  const [effects, setEffects] = useState<EffectRow[]>(createDefaultEffects);

  // Common inputs
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>('mbar_abs');
  const [fluidType, setFluidType] = useState<SiphonFluidType>('seawater');
  const [salinity, setSalinity] = useState<string>('35000');
  const [targetVelocity, setTargetVelocity] = useState<string>('1.0');
  const [pipeSchedule, setPipeSchedule] = useState<string>('40');
  const [elbowConfig, setElbowConfig] = useState<ElbowConfig>('2_elbows');
  const [horizontalDistance, setHorizontalDistance] = useState<string>('3');
  const [offsetDistance, setOffsetDistance] = useState<string>('1.5');
  const [safetyFactor, setSafetyFactor] = useState<string>('20');

  const unitLabel = PRESSURE_UNIT_LABELS[pressureUnit] || pressureUnit;

  // Batch calculation
  const { results, errors } = useMemo(() => {
    const batchResults: BatchResult[] = [];
    const batchErrors: string[] = [];

    for (let i = 0; i < effects.length - 1; i++) {
      const currentEffect = effects[i]!;
      const nextEffect = effects[i + 1]!;
      const upP = parseFloat(currentEffect.pressure);
      const downP = parseFloat(nextEffect.pressure);
      const flow = parseFloat(currentEffect.flowToNext);
      const vel = parseFloat(targetVelocity);
      const hDist = parseFloat(horizontalDistance);
      const oDist = parseFloat(offsetDistance);
      const sf = parseFloat(safetyFactor);
      const sal = parseFloat(salinity);

      if (isNaN(upP) || isNaN(downP) || isNaN(flow) || isNaN(vel) || isNaN(hDist) || isNaN(sf)) {
        batchErrors.push(`S-${i + 1}: Missing input values`);
        continue;
      }
      if (upP <= downP) {
        batchErrors.push(`S-${i + 1}: E${i + 1} pressure must be higher than E${i + 2}`);
        continue;
      }

      try {
        const input: SiphonSizingInput = {
          upstreamPressure: upP,
          downstreamPressure: downP,
          pressureUnit,
          fluidType,
          salinity: fluidType === 'distillate' ? 0 : sal,
          flowRate: flow,
          elbowConfig,
          horizontalDistance: hDist,
          offsetDistance: elbowConfig !== '2_elbows' ? oDist : 0,
          targetVelocity: vel,
          safetyFactor: sf,
          pipeSchedule,
        };

        const result = calculateSiphonSizing(input);
        batchResults.push({
          fromEffect: i + 1,
          toEffect: i + 2,
          result,
        });
      } catch (err) {
        batchErrors.push(`S-${i + 1}: ${err instanceof Error ? err.message : 'Calculation error'}`);
      }
    }

    return { results: batchResults, errors: batchErrors };
  }, [
    effects,
    pressureUnit,
    fluidType,
    salinity,
    targetVelocity,
    pipeSchedule,
    elbowConfig,
    horizontalDistance,
    offsetDistance,
    safetyFactor,
  ]);

  const handleExcelDownload = async () => {
    if (results.length === 0) return;
    const blob = await exportBatchSiphonToExcel(results, {
      fluidType,
      salinity,
      targetVelocity,
      pipeSchedule,
      elbowConfig,
      horizontalDistance,
      offsetDistance,
      safetyFactor,
      pressureUnit,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Batch_Siphon_Sizing.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Siphon Sizing — Batch Mode" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Batch Siphon Sizing
          </Typography>
          <Chip label="Multi-Effect" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Size all inter-effect siphons at once. Enter effect pressures and flows, then review all
          siphon pipes in a single table.
        </Typography>
        <Button
          component={Link}
          href="/thermal/calculators/siphon-sizing"
          startIcon={<BackIcon />}
          size="small"
        >
          Single Siphon Mode
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Common Inputs */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Common Parameters
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Pressure Unit</InputLabel>
                <Select
                  value={pressureUnit}
                  label="Pressure Unit"
                  onChange={(e) => setPressureUnit(e.target.value as PressureUnit)}
                >
                  {Object.entries(PRESSURE_UNIT_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              <FormControl fullWidth size="small">
                <InputLabel>Fluid Type</InputLabel>
                <Select
                  value={fluidType}
                  label="Fluid Type"
                  onChange={(e) => setFluidType(e.target.value as SiphonFluidType)}
                >
                  {Object.entries(FLUID_TYPE_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(fluidType === 'seawater' || fluidType === 'brine') && (
                <TextField
                  label="Salinity"
                  value={salinity}
                  onChange={(e) => setSalinity(e.target.value)}
                  type="number"
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
                    },
                  }}
                />
              )}

              <Divider />

              <TextField
                label="Target Velocity"
                value={targetVelocity}
                onChange={(e) => setTargetVelocity(e.target.value)}
                type="number"
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
                  },
                }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Pipe Schedule</InputLabel>
                <Select
                  value={pipeSchedule}
                  label="Pipe Schedule"
                  onChange={(e) => setPipeSchedule(e.target.value)}
                >
                  {PIPE_SCHEDULE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              <ToggleButtonGroup
                value={elbowConfig}
                exclusive
                onChange={(_, newVal) => newVal && setElbowConfig(newVal as ElbowConfig)}
                fullWidth
                size="small"
              >
                {Object.entries(ELBOW_CONFIG_LABELS).map(([key, label]) => (
                  <ToggleButton key={key} value={key}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <TextField
                label="Horizontal Distance"
                value={horizontalDistance}
                onChange={(e) => setHorizontalDistance(e.target.value)}
                type="number"
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  },
                }}
              />

              {elbowConfig !== '2_elbows' && (
                <TextField
                  label="Offset Distance"
                  value={offsetDistance}
                  onChange={(e) => setOffsetDistance(e.target.value)}
                  type="number"
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">m</InputAdornment>,
                    },
                  }}
                />
              )}

              <TextField
                label="Safety Factor"
                value={safetyFactor}
                onChange={(e) => setSafetyFactor(e.target.value)}
                type="number"
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  },
                }}
              />
            </Stack>
          </Paper>
        </Grid>

        {/* Right: Effect Table + Results */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Effect Input Table */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Effect Pressures &amp; Flows
              </Typography>
              <EffectInputTable
                effects={effects}
                pressureUnitLabel={unitLabel}
                onEffectsChange={setEffects}
              />
            </Box>

            {/* Errors */}
            {errors.length > 0 && (
              <Box>
                {errors.map((err, i) => (
                  <Alert key={i} severity="error" sx={{ mb: 1 }}>
                    {err}
                  </Alert>
                ))}
              </Box>
            )}

            {/* Results */}
            {results.length > 0 && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6">
                    Results ({results.length} siphon{results.length !== 1 ? 's' : ''})
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<ExcelIcon />}
                    onClick={handleExcelDownload}
                  >
                    Download Excel
                  </Button>
                </Box>
                <BatchResultsTable results={results} pipeSchedule={pipeSchedule} />

                {/* Warnings */}
                {results.some((r) => r.result.warnings.length > 0) && (
                  <Box>
                    {results.map(({ fromEffect, toEffect, result }) =>
                      result.warnings.map((w, j) => (
                        <Alert key={`${fromEffect}-${j}`} severity="warning" sx={{ mb: 1 }}>
                          S-{fromEffect} (E{fromEffect}→E{toEffect}): {w}
                        </Alert>
                      ))
                    )}
                  </Box>
                )}
              </>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
