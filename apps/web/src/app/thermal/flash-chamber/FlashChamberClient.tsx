'use client';

/**
 * Flash Chamber Calculator Page
 *
 * Design calculator for flash evaporation chambers used in
 * thermal desalination processes.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Button,
  Stack,
} from '@mui/material';
import { Refresh as RefreshIcon, Description as DatasheetIcon } from '@mui/icons-material';
import { useSearchParams, useRouter } from 'next/navigation';

import {
  InputSection,
  HeatMassBalance,
  ChamberSizing,
  NozzleSizing,
  NPSHaCalculation,
  GenerateDatasheetDialog,
} from './components';

import { calculateFlashChamber, validateFlashChamberInput } from '@/lib/thermal';
import type { FlashChamberInput, FlashChamberResult } from '@vapour/types';
import { DEFAULT_FLASH_CHAMBER_INPUT } from '@vapour/types';

export default function FlashChamberClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [inputs, setInputs] = useState<FlashChamberInput>(DEFAULT_FLASH_CHAMBER_INPUT);
  const [result, setResult] = useState<FlashChamberResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasheetDialogOpen, setDatasheetDialogOpen] = useState(false);

  // Initialize from URL parameters (only on mount)
  useEffect(() => {
    const paramsJson = searchParams.get('params');
    if (paramsJson) {
      try {
        const parsedInputs = JSON.parse(paramsJson) as FlashChamberInput;
        setInputs({ ...DEFAULT_FLASH_CHAMBER_INPUT, ...parsedInputs });
      } catch {
        // Invalid JSON, use defaults
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-calculation on input change (debounced)
  const performCalculation = useCallback(() => {
    // Validate inputs first
    const validation = validateFlashChamberInput(inputs);

    if (!validation.isValid) {
      setError(validation.errors.join('; '));
      setResult(null);
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const calcResult = calculateFlashChamber(inputs);
      setResult(calcResult);
      // Warnings are shown in the result UI, not as main error
    } catch (err) {
      console.error('Calculation error:', err);
      setError(err instanceof Error ? err.message : 'Calculation failed');
      setResult(null);
    } finally {
      setCalculating(false);
    }
  }, [inputs]);

  // Debounced auto-calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      performCalculation();
    }, 300);

    return () => clearTimeout(timer);
  }, [performCalculation]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('params', JSON.stringify(inputs));
    const newUrl = `?${params.toString()}`;
    if (newUrl !== `?${searchParams.toString()}`) {
      router.replace(`/thermal/flash-chamber${newUrl}`, { scroll: false });
    }
  }, [inputs, router, searchParams]);

  // Reset to defaults
  const handleReset = () => {
    setInputs(DEFAULT_FLASH_CHAMBER_INPUT);
    setError(null);
    router.replace('/thermal/flash-chamber', { scroll: false });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Flash Chamber Calculator
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Design flash evaporation chambers for thermal desalination processes. Calculate heat/mass
          balance, chamber sizing, nozzle sizing, and NPSHa.
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            variant="outlined"
            color="secondary"
          >
            Reset to Defaults
          </Button>
          <Button
            startIcon={<DatasheetIcon />}
            onClick={() => setDatasheetDialogOpen(true)}
            variant="contained"
            disabled={!result}
          >
            Generate Datasheet
          </Button>
        </Stack>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Sidebar - Inputs */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <InputSection
            inputs={inputs}
            onChange={setInputs}
            calculatedDiameter={result?.chamberSizing.diameter}
            vaporVelocity={result?.chamberSizing.vaporVelocity}
            vaporVelocityStatus={result?.chamberSizing.vaporVelocityStatus}
            vaporLoading={result?.chamberSizing.vaporLoading}
          />
        </Grid>

        {/* Right Panel - Results */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* Calculating indicator */}
          {calculating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Calculating...
              </Typography>
            </Box>
          )}

          {/* Error display */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Warnings display */}
          {result && result.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                Warnings:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {result.warnings.map((warning, index) => (
                  <li key={index}>
                    <Typography variant="body2">{warning}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Results */}
          {result ? (
            <>
              <HeatMassBalance balance={result.heatMassBalance} />
              <ChamberSizing
                sizing={result.chamberSizing}
                elevations={result.elevations}
                nozzles={result.nozzles}
              />
              <NozzleSizing nozzles={result.nozzles} />
              <NPSHaCalculation npsha={result.npsha} />

              {/* Metadata */}
              <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  Calculated at: {result.calculatedAt.toLocaleString()} | Steam Tables:{' '}
                  {result.metadata?.steamTableSource} | Seawater: {result.metadata?.seawaterSource}{' '}
                  | Version: {result.metadata?.calculatorVersion}
                </Typography>
              </Paper>
            </>
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
                  Enter process parameters to see results
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically as you change inputs
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Datasheet Dialog */}
      {result && (
        <GenerateDatasheetDialog
          open={datasheetDialogOpen}
          onClose={() => setDatasheetDialogOpen(false)}
          result={result}
        />
      )}
    </Container>
  );
}
