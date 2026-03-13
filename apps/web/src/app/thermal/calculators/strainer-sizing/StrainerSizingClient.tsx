'use client';

/**
 * Strainer Sizing Calculator
 *
 * Size Y-type and bucket-type strainers — mesh selection,
 * pressure drop at clean and 50% clogged conditions.
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  ViewList as BatchIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateStrainerSizing,
  type StrainerType,
  type FluidType as StrainerFluidType,
} from '@/lib/thermal/strainerSizingCalculator';
import { StrainerSizingInputs, StrainerSizingResults } from './components';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({ default: m.GenerateReportDialog }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

export default function StrainerSizingClient() {
  // Input state
  const [fluidType, setFluidType] = useState<StrainerFluidType>('seawater');
  const [flowRate, setFlowRate] = useState<string>('');
  const [lineSize, setLineSize] = useState<string>('4');
  const [strainerType, setStrainerType] = useState<StrainerType>('y_type');
  const [fluidDensity, setFluidDensity] = useState<string>('1025');
  const [fluidViscosity, setFluidViscosity] = useState<string>('1.08');
  const [fluidTemperature, setFluidTemperature] = useState<string>('25');

  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const handleReset = () => {
    setFluidType('seawater');
    setFlowRate('');
    setLineSize('4');
    setStrainerType('y_type');
    setFluidDensity('1025');
    setFluidViscosity('1.08');
    setFluidTemperature('25');
  };

  // Calculate strainer sizing
  const computed = useMemo(() => {
    try {
      const flow = parseFloat(flowRate);
      const density = parseFloat(fluidDensity);
      const viscosity = parseFloat(fluidViscosity);

      if (isNaN(flow) || flow <= 0) return null;
      if (isNaN(density) || density <= 0) return null;
      if (isNaN(viscosity) || viscosity <= 0) return null;

      const temp = parseFloat(fluidTemperature);

      return {
        result: calculateStrainerSizing({
          fluidType,
          flowRate: flow,
          lineSize,
          strainerType,
          fluidDensity: density,
          fluidViscosity: viscosity,
          fluidTemperature: isNaN(temp) ? undefined : temp,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [fluidType, flowRate, lineSize, strainerType, fluidDensity, fluidViscosity, fluidTemperature]);

  const result = computed?.result ?? null;
  const error = computed?.error ?? null;

  const inputsForSave = {
    fluidType,
    flowRate,
    lineSize,
    strainerType,
    fluidDensity,
    fluidViscosity,
    fluidTemperature,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Strainer Sizing" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Strainer Sizing Calculator
          </Typography>
          <Chip label="Crane TP-410" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Size Y-type and bucket-type strainers &mdash; mesh selection, pressure drop at clean and
          50% clogged conditions.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button startIcon={<LoadIcon />} size="small" onClick={() => setLoadOpen(true)}>
            Load Saved
          </Button>
          <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
            Reset
          </Button>
          <Button
            component={Link}
            href="/thermal/calculators/strainer-sizing/batch"
            startIcon={<BatchIcon />}
            size="small"
          >
            Batch Mode
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>

            <StrainerSizingInputs
              fluidType={fluidType}
              flowRate={flowRate}
              lineSize={lineSize}
              strainerType={strainerType}
              fluidDensity={fluidDensity}
              fluidViscosity={fluidViscosity}
              fluidTemperature={fluidTemperature}
              onFluidTypeChange={setFluidType}
              onFlowRateChange={setFlowRate}
              onLineSizeChange={setLineSize}
              onStrainerTypeChange={setStrainerType}
              onFluidDensityChange={setFluidDensity}
              onFluidViscosityChange={setFluidViscosity}
              onFluidTemperatureChange={setFluidTemperature}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {result && <StrainerSizingResults result={result} />}

          {!result && !error && (
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
                Enter flow rate to calculate strainer sizing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will update automatically
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Action Buttons */}
      {result && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveOpen(true)}>
            Save
          </Button>
          <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => setReportOpen(true)}>
            Generate Report
          </Button>
        </Box>
      )}

      {/* Formulas */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Formulas
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Body &Delta;P:</strong> &Delta;P = K_body &times; &rho; &times; v&sup2; / 2
            </li>
            <li>
              <strong>Screen &Delta;P:</strong> &Delta;P = K_screen &times; &rho; &times;
              v_screen&sup2; / 2
            </li>
            <li>
              <strong>Screen velocity:</strong> v_screen = Q / A_open (where A_open = screen area
              &times; open area ratio)
            </li>
            <li>
              <strong>50% clogged:</strong> A_open halved &rarr; v_screen &times; 2 &rarr;
              &Delta;P_screen &times; 4
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> Crane TP-410, Flow of Fluids through Valves, Fittings, and
          Pipe
        </Typography>
      </Box>

      {/* Report Dialog */}
      {reportOpen && result && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={result}
            inputs={{
              ...inputsForSave,
            }}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="STRAINER_SIZING"
        inputs={inputsForSave}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="STRAINER_SIZING"
        onLoad={(inputs) => {
          if (typeof inputs.fluidType === 'string')
            setFluidType(inputs.fluidType as StrainerFluidType);
          if (typeof inputs.flowRate === 'string') setFlowRate(inputs.flowRate);
          if (typeof inputs.lineSize === 'string') setLineSize(inputs.lineSize);
          if (typeof inputs.strainerType === 'string')
            setStrainerType(inputs.strainerType as StrainerType);
          if (typeof inputs.fluidDensity === 'string') setFluidDensity(inputs.fluidDensity);
          if (typeof inputs.fluidViscosity === 'string') setFluidViscosity(inputs.fluidViscosity);
          if (typeof inputs.fluidTemperature === 'string')
            setFluidTemperature(inputs.fluidTemperature);
        }}
      />
    </Container>
  );
}
