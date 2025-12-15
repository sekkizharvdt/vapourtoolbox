'use client';

/**
 * Steam Tables Calculator
 *
 * Lookup steam properties for saturation, subcooled liquid, and superheated steam.
 * Uses IAPWS-IF97 correlations (Regions 1, 2, 4) from @vapour/constants.
 *
 * This component has been split into smaller, focused subcomponents.
 * See components/ directory for implementation:
 * - types.ts - TypeScript types and interfaces
 * - pressureUtils.ts - Pressure unit conversion utilities
 * - SteamInputs.tsx - Input form for steam state selection
 * - SaturationResults.tsx - Results display for saturation properties
 * - SubcooledResults.tsx - Results display for subcooled liquid properties
 * - SuperheatedResults.tsx - Results display for superheated steam properties
 * - ReferenceTable.tsx - Quick reference saturation table
 */

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Grid, Paper, Chip, Stack } from '@mui/material';
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
  CRITICAL_TEMPERATURE_C,
  CRITICAL_PRESSURE_BAR,
  getSubcooledProperties,
  getSuperheatedProperties,
  getRegion,
} from '@vapour/constants';

import {
  type SteamMode,
  type LookupMode,
  type PressureUnit,
  type SaturationResult,
  type SubcooledResult,
  type SuperheatedResult,
  convertPressureToBar,
  SteamInputs,
  SaturationResults,
  SubcooledResults,
  SuperheatedResults,
  ReferenceTable,
} from './components';

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

      if (tempC < 0 || tempC > 350) {
        setError('Temperature must be between 0°C and 350°C for subcooled liquid');
        return null;
      }
      if (pressureBar < 0.00611 || pressureBar > 1000) {
        setError('Pressure must be between 0.00611 bar and 1000 bar');
        return null;
      }

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

      if (tempC < 0 || tempC > 800) {
        setError('Temperature must be between 0°C and 800°C for superheated steam');
        return null;
      }
      if (pressureBar <= 0 || pressureBar > 1000) {
        setError('Pressure must be between 0 and 1000 bar');
        return null;
      }

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

  const handleReferenceRowClick = (mode: SteamMode, lookup: LookupMode, temperature: string) => {
    setSteamMode(mode);
    setLookupMode(lookup);
    setTemperatureInput(temperature);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
          <SteamInputs
            steamMode={steamMode}
            lookupMode={lookupMode}
            temperatureInput={temperatureInput}
            pressureInput={pressureInput}
            pressureUnit={pressureUnit}
            error={error}
            onSteamModeChange={setSteamMode}
            onLookupModeChange={setLookupMode}
            onTemperatureChange={setTemperatureInput}
            onPressureChange={setPressureInput}
            onPressureUnitChange={setPressureUnit}
          />
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {steamMode === 'saturation' && saturationResult && (
            <SaturationResults result={saturationResult} pressureUnit={pressureUnit} />
          )}

          {steamMode === 'subcooled' && subcooledResult && (
            <SubcooledResults result={subcooledResult} pressureUnit={pressureUnit} />
          )}

          {steamMode === 'superheated' && superheatedResult && (
            <SuperheatedResults result={superheatedResult} pressureUnit={pressureUnit} />
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
      <ReferenceTable onRowClick={handleReferenceRowClick} />

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
