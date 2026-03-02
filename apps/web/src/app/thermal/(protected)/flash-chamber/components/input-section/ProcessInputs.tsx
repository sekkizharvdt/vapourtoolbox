'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Divider,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlashingInputMode,
  FlowRateUnit,
} from '@vapour/types';
import { FLASH_CHAMBER_LIMITS, FLOW_RATE_UNIT_LABELS } from '@vapour/types';
import { getSaturationPressure } from '@vapour/constants';
import { calculateMaxVaporVelocity } from './helpers';

interface ProcessInputsProps {
  inputs: FlashChamberInput;
  onWaterTypeChange: (waterType: FlashChamberWaterType) => void;
  onModeChange: (mode: FlashChamberInputMode) => void;
  onFlowRateUnitChange: (unit: FlowRateUnit) => void;
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean) => void;
  onFlashingInputModeChange: (mode: FlashingInputMode) => void;
  onFlashingTemperatureChange: (tempC: number) => void;
}

export function ProcessInputs({
  inputs,
  onWaterTypeChange,
  onModeChange,
  onFlowRateUnitChange,
  onChange,
  onFlashingInputModeChange,
  onFlashingTemperatureChange,
}: ProcessInputsProps) {
  const flowRateUnitLabel = FLOW_RATE_UNIT_LABELS[inputs.flowRateUnit];
  const flashingMode = inputs.flashingInputMode ?? 'PRESSURE';

  // Draft values for pressure/temperature fields — held locally while the user
  // is actively typing so that intermediate (out-of-range) keystrokes don't
  // trigger validation errors or reset the field.
  const [pressureDraft, setPressureDraft] = useState<string | null>(null);
  const [tempDraft, setTempDraft] = useState<string | null>(null);

  // Clear drafts whenever the user switches between Pressure and Temperature mode
  useEffect(() => {
    setPressureDraft(null);
    setTempDraft(null);
  }, [flashingMode]);

  // Derived saturation temperature (shown in helper text when PRESSURE mode)
  const derivedSatTemp = useMemo(() => {
    return calculateMaxVaporVelocity(inputs.operatingPressure).saturationTemp;
  }, [inputs.operatingPressure]);

  // Derived pressure (shown in helper text when TEMPERATURE mode)
  const derivedPressureMbar = useMemo(() => {
    const temp = inputs.flashingTemperature ?? 60;
    if (temp < FLASH_CHAMBER_LIMITS.flashingTemperature.min) return null;
    if (temp > FLASH_CHAMBER_LIMITS.flashingTemperature.max) return null;
    return Math.round(getSaturationPressure(temp) * 1000);
  }, [inputs.flashingTemperature]);

  return (
    <>
      {/* Water Type Selection */}
      <FormControl fullWidth>
        <InputLabel>Water Type</InputLabel>
        <Select
          value={inputs.waterType}
          label="Water Type"
          onChange={(e) => onWaterTypeChange(e.target.value as FlashChamberWaterType)}
        >
          <MenuItem value="SEAWATER">Seawater</MenuItem>
          <MenuItem value="DM_WATER">DM Water (Demineralized)</MenuItem>
        </Select>
      </FormControl>

      {/* Calculation Mode Selection */}
      <FormControl fullWidth>
        <InputLabel>Calculation Mode</InputLabel>
        <Select
          value={inputs.mode}
          label="Calculation Mode"
          onChange={(e) => onModeChange(e.target.value as FlashChamberInputMode)}
        >
          <MenuItem value="WATER_FLOW">Water Flow Known</MenuItem>
          <MenuItem value="VAPOR_QUANTITY">Vapor Quantity Known</MenuItem>
        </Select>
      </FormControl>

      {/* Flow Rate Unit Selection */}
      <FormControl fullWidth>
        <InputLabel>Flow Rate Unit</InputLabel>
        <Select
          value={inputs.flowRateUnit}
          label="Flow Rate Unit"
          onChange={(e) => onFlowRateUnitChange(e.target.value as FlowRateUnit)}
        >
          <MenuItem value="KG_SEC">kg/sec</MenuItem>
          <MenuItem value="KG_HR">kg/hr</MenuItem>
          <MenuItem value="TON_HR">ton/hr</MenuItem>
        </Select>
      </FormControl>

      {/* Mode-dependent input */}
      {inputs.mode === 'WATER_FLOW' ? (
        <TextField
          label="Water Flow Rate"
          type="number"
          value={inputs.waterFlowRate || ''}
          onChange={(e) => onChange('waterFlowRate', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{flowRateUnitLabel}</InputAdornment>,
          }}
          inputProps={{
            step: inputs.flowRateUnit === 'KG_SEC' ? 0.1 : 1,
            onWheel: (e) => (e.target as HTMLInputElement).blur(),
          }}
          helperText={`Inlet ${inputs.waterType === 'SEAWATER' ? 'seawater' : 'DM water'} flow rate`}
          fullWidth
        />
      ) : (
        <TextField
          label="Vapor Quantity"
          type="number"
          value={inputs.vaporQuantity || ''}
          onChange={(e) => onChange('vaporQuantity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{flowRateUnitLabel}</InputAdornment>,
          }}
          inputProps={{
            step: inputs.flowRateUnit === 'KG_SEC' ? 0.01 : 0.1,
            onWheel: (e) => (e.target as HTMLInputElement).blur(),
          }}
          helperText="Desired vapor production"
          fullWidth
        />
      )}

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Flash Chamber Operating Condition
      </Typography>

      {/* Specify by: Pressure / Temperature toggle */}
      <ToggleButtonGroup
        value={flashingMode}
        exclusive
        onChange={(_e, value: FlashingInputMode | null) => {
          if (value) onFlashingInputModeChange(value);
        }}
        size="small"
        fullWidth
      >
        <ToggleButton value="PRESSURE">Pressure</ToggleButton>
        <ToggleButton value="TEMPERATURE">Temperature</ToggleButton>
      </ToggleButtonGroup>

      {/* Operating Pressure (shown when PRESSURE mode) */}
      {flashingMode === 'PRESSURE' && (
        <TextField
          label="Operating Pressure"
          type="number"
          value={pressureDraft !== null ? pressureDraft : String(inputs.operatingPressure)}
          onFocus={() => setPressureDraft(String(inputs.operatingPressure))}
          onChange={(e) => setPressureDraft(e.target.value)}
          onBlur={() => {
            const val = parseFloat(pressureDraft ?? '');
            if (!isNaN(val)) onChange('operatingPressure', val);
            setPressureDraft(null);
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.operatingPressure.min,
            max: FLASH_CHAMBER_LIMITS.operatingPressure.max,
            step: 10,
            onWheel: (e) => (e.target as HTMLInputElement).blur(),
          }}
          helperText={
            derivedSatTemp > 0
              ? `→ Saturation temp: ${derivedSatTemp.toFixed(1)} °C`
              : `Range: ${FLASH_CHAMBER_LIMITS.operatingPressure.min}–${FLASH_CHAMBER_LIMITS.operatingPressure.max} mbar abs`
          }
          fullWidth
        />
      )}

      {/* Flashing Temperature (shown when TEMPERATURE mode) */}
      {flashingMode === 'TEMPERATURE' && (
        <TextField
          label="Flashing Temperature"
          type="number"
          value={tempDraft !== null ? tempDraft : String(inputs.flashingTemperature ?? 60)}
          onFocus={() => setTempDraft(String(inputs.flashingTemperature ?? 60))}
          onChange={(e) => setTempDraft(e.target.value)}
          onBlur={() => {
            const val = parseFloat(tempDraft ?? '');
            if (!isNaN(val)) onFlashingTemperatureChange(val);
            setTempDraft(null);
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.flashingTemperature.min,
            max: FLASH_CHAMBER_LIMITS.flashingTemperature.max,
            step: 1,
            onWheel: (e) => (e.target as HTMLInputElement).blur(),
          }}
          helperText={
            derivedPressureMbar !== null
              ? `→ Operating pressure: ${derivedPressureMbar} mbar abs`
              : `Range: ${FLASH_CHAMBER_LIMITS.flashingTemperature.min}–${FLASH_CHAMBER_LIMITS.flashingTemperature.max} °C`
          }
          fullWidth
        />
      )}

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        {inputs.waterType === 'SEAWATER' ? 'Seawater' : 'DM Water'} Inlet Conditions
      </Typography>

      {/* Inlet Temperature */}
      <TextField
        label="Inlet Temperature"
        type="number"
        value={inputs.inletTemperature}
        onChange={(e) => onChange('inletTemperature', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.inletTemperature.min,
          max: FLASH_CHAMBER_LIMITS.inletTemperature.max,
          step: 1,
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
        }}
        helperText="Must be above flash chamber saturation temperature"
        fullWidth
      />

      {/* Salinity - only shown for seawater */}
      {inputs.waterType === 'SEAWATER' ? (
        <TextField
          label="Seawater Salinity"
          type="number"
          value={inputs.salinity}
          onChange={(e) => onChange('salinity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
          }}
          inputProps={{
            min: 1000,
            max: FLASH_CHAMBER_LIMITS.salinity.max,
            step: 1000,
            onWheel: (e) => (e.target as HTMLInputElement).blur(),
          }}
          helperText="Typical seawater: 35,000 ppm"
          fullWidth
        />
      ) : (
        <TextField
          label="Water Salinity"
          type="number"
          value={inputs.salinity}
          disabled
          InputProps={{
            endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
          }}
          helperText="DM water has negligible salinity (0 ppm)"
          fullWidth
        />
      )}
    </>
  );
}
