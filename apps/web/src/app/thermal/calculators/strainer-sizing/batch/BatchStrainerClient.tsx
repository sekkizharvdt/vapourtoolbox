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
  Alert,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import {
  calculateStrainerSizing,
  FLUID_TYPE_LABELS,
  type FluidType as StrainerFluidType,
} from '@/lib/thermal/strainerSizingCalculator';
import { CalculatorBreadcrumb } from '../../components/CalculatorBreadcrumb';
import { SaveCalculationDialog } from '../components/SaveCalculationDialog';
import { LoadCalculationDialog } from '../components/LoadCalculationDialog';
import {
  StrainerInputTable,
  createDefaultRows,
  type StrainerRow,
} from './components/StrainerInputTable';
import { BatchResultsTable, type BatchStrainerResult } from './components/BatchResultsTable';

export default function BatchStrainerClient() {
  // Strainer rows
  const [rows, setRows] = useState<StrainerRow[]>(createDefaultRows);

  // Common inputs
  const [fluidType, setFluidType] = useState<StrainerFluidType>('seawater');
  const [fluidDensity, setFluidDensity] = useState<string>('1025');
  const [fluidViscosity, setFluidViscosity] = useState<string>('1.08');
  const [fluidTemperature, setFluidTemperature] = useState<string>('25');

  // Dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Batch calculation
  const { results, errors } = useMemo(() => {
    const batchResults: BatchStrainerResult[] = [];
    const batchErrors: string[] = [];
    const density = parseFloat(fluidDensity);
    const viscosity = parseFloat(fluidViscosity);
    const temp = parseFloat(fluidTemperature);

    if (isNaN(density) || density <= 0 || isNaN(viscosity) || viscosity <= 0) {
      return { results: [], errors: ['Invalid fluid density or viscosity'] };
    }

    for (const row of rows) {
      const flow = parseFloat(row.flowRate);
      if (isNaN(flow) || flow <= 0) continue;

      try {
        const result = calculateStrainerSizing({
          fluidType,
          flowRate: flow,
          lineSize: row.lineSize,
          strainerType: row.strainerType,
          fluidDensity: density,
          fluidViscosity: viscosity,
          fluidTemperature: isNaN(temp) ? undefined : temp,
        });
        batchResults.push({ tag: row.tag, result });
      } catch (err) {
        batchErrors.push(`${row.tag}: ${err instanceof Error ? err.message : 'Error'}`);
      }
    }

    return { results: batchResults, errors: batchErrors };
  }, [rows, fluidType, fluidDensity, fluidViscosity, fluidTemperature]);

  // Save/Load
  const batchInputs: Record<string, unknown> = {
    rows,
    fluidType,
    fluidDensity,
    fluidViscosity,
    fluidTemperature,
  };

  const handleLoad = (inputs: Record<string, unknown>) => {
    if (Array.isArray(inputs.rows)) setRows(inputs.rows as StrainerRow[]);
    if (typeof inputs.fluidType === 'string') setFluidType(inputs.fluidType as StrainerFluidType);
    if (typeof inputs.fluidDensity === 'string') setFluidDensity(inputs.fluidDensity);
    if (typeof inputs.fluidViscosity === 'string') setFluidViscosity(inputs.fluidViscosity);
    if (typeof inputs.fluidTemperature === 'string') setFluidTemperature(inputs.fluidTemperature);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Batch Strainer Sizing" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Batch Strainer Sizing
          </Typography>
          <Chip label="Crane TP-410" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Size multiple strainers at once with common fluid properties.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            component={Link}
            href="/thermal/calculators/strainer-sizing"
            startIcon={<BackIcon />}
            size="small"
          >
            Single Mode
          </Button>
          <Button startIcon={<LoadIcon />} size="small" onClick={() => setLoadDialogOpen(true)}>
            Load Saved
          </Button>
          <Button
            startIcon={<SaveIcon />}
            size="small"
            onClick={() => setSaveDialogOpen(true)}
            disabled={results.length === 0}
          >
            Save
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Common parameters */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Common Parameters
            </Typography>

            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Fluid Type</InputLabel>
                <Select
                  value={fluidType}
                  label="Fluid Type"
                  onChange={(e) => setFluidType(e.target.value as StrainerFluidType)}
                >
                  {(Object.entries(FLUID_TYPE_LABELS) as [StrainerFluidType, string][]).map(
                    ([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>

              <TextField
                label="Fluid Density"
                value={fluidDensity}
                onChange={(e) => setFluidDensity(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">kg/m&sup3;</InputAdornment>,
                }}
              />

              <TextField
                label="Dynamic Viscosity"
                value={fluidViscosity}
                onChange={(e) => setFluidViscosity(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">cP</InputAdornment>,
                }}
              />

              <TextField
                label="Fluid Temperature"
                value={fluidTemperature}
                onChange={(e) => setFluidTemperature(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary">
              Set the common fluid properties above. Each strainer row can have its own flow rate,
              line size, and strainer type.
            </Typography>
          </Paper>
        </Grid>

        {/* Input table + results */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="h6" gutterBottom>
            Strainer List
          </Typography>
          <StrainerInputTable rows={rows} onChange={setRows} />

          {errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </Alert>
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Results
          </Typography>
          <BatchResultsTable results={results} />
        </Grid>
      </Grid>

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        calculatorType="STRAINER_SIZING_BATCH"
        inputs={batchInputs}
      />
      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        calculatorType="STRAINER_SIZING_BATCH"
        onLoad={handleLoad}
      />
    </Container>
  );
}
