'use client';

import { useMemo, useState } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateThermalExpansion,
  type ConstraintMode,
  type ThermalExpansionResult,
} from '@/lib/thermal';
import { ThermalExpansionInputs } from './components/ThermalExpansionInputs';
import { ThermalExpansionResults } from './components/ThermalExpansionResults';

const DEFAULT_MATERIAL = 'carbon_steel';

export default function ThermalExpansionClient() {
  const [materialKey, setMaterialKey] = useState<string>(DEFAULT_MATERIAL);
  const [length, setLength] = useState<string>('1000');
  const [installationTemperature, setInstallationTemperature] = useState<string>('20');
  const [operatingTemperature, setOperatingTemperature] = useState<string>('');
  const [constraintMode, setConstraintMode] = useState<ConstraintMode>('free');

  const handleReset = () => {
    setMaterialKey(DEFAULT_MATERIAL);
    setLength('1000');
    setInstallationTemperature('20');
    setOperatingTemperature('');
    setConstraintMode('free');
  };

  const computed = useMemo<{
    result: ThermalExpansionResult | null;
    error: string | null;
  }>(() => {
    const L = parseFloat(length);
    const Tinst = parseFloat(installationTemperature);
    const Top = parseFloat(operatingTemperature);

    if (!Number.isFinite(L) || L <= 0 || !Number.isFinite(Tinst) || !Number.isFinite(Top)) {
      return { result: null, error: null };
    }

    try {
      return {
        result: calculateThermalExpansion({
          materialKey,
          length: L,
          installationTemperature: Tinst,
          operatingTemperature: Top,
          constraintMode,
        }),
        error: null,
      };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err.message : 'Calculation error',
      };
    }
  }, [materialKey, length, installationTemperature, operatingTemperature, constraintMode]);

  const { result, error } = computed;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Thermal Expansion" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Thermal Expansion Calculator
          </Typography>
          <Chip label="Perry's / ASM" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Free linear thermal expansion (ΔL) and restrained thermal stress for piping, shells, and
          tube bundles. Uses temperature-dependent α(T) and E(T) for carbon steel, SS 304/304L,
          aluminium 5052-O and titanium SB 338 Gr 2.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <ThermalExpansionInputs
              materialKey={materialKey}
              length={length}
              installationTemperature={installationTemperature}
              operatingTemperature={operatingTemperature}
              constraintMode={constraintMode}
              onMaterialChange={setMaterialKey}
              onLengthChange={setLength}
              onInstallationTemperatureChange={setInstallationTemperature}
              onOperatingTemperatureChange={setOperatingTemperature}
              onConstraintModeChange={setConstraintMode}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <ThermalExpansionResults
              result={result}
              constraintMode={constraintMode}
              reportInputs={{
                materialKey,
                length,
                installationTemperature,
                operatingTemperature,
                constraintMode,
              }}
            />
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
                  Enter material, length and operating temperature
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Formulae
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Free expansion:</strong> ΔL = L₀ × α_eff × (T_op − T_install)
            </li>
            <li>
              <strong>Thermal strain:</strong> ε = α_eff × ΔT
            </li>
            <li>
              <strong>Restrained stress:</strong> σ = E(T_op) × ε &nbsp;(compressive on heating,
              tensile on cooling)
            </li>
            <li>
              <strong>α_eff</strong> is derived from tabulated mean α(20°C → T) so the result is
              correct even when T_install ≠ 20 °C.
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>References:</strong> Perry&apos;s Chemical Engineers&apos; Handbook §28; ASM
          Handbook Vol. 1 & 2; ASME B31.3 Appendix C.
        </Typography>
      </Box>
    </Container>
  );
}
