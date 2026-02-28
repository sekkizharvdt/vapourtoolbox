'use client';

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Divider,
  Typography,
} from '@mui/material';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlowRateUnit,
} from '@vapour/types';
import { FLASH_CHAMBER_LIMITS, FLOW_RATE_UNIT_LABELS } from '@vapour/types';

interface ProcessInputsProps {
  inputs: FlashChamberInput;
  onWaterTypeChange: (waterType: FlashChamberWaterType) => void;
  onModeChange: (mode: FlashChamberInputMode) => void;
  onFlowRateUnitChange: (unit: FlowRateUnit) => void;
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean) => void;
}

export function ProcessInputs({
  inputs,
  onWaterTypeChange,
  onModeChange,
  onFlowRateUnitChange,
  onChange,
}: ProcessInputsProps) {
  const flowRateUnitLabel = FLOW_RATE_UNIT_LABELS[inputs.flowRateUnit];

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

      {/* Operating Pressure */}
      <TextField
        label="Operating Pressure"
        type="number"
        value={inputs.operatingPressure}
        onChange={(e) => onChange('operatingPressure', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.operatingPressure.min,
          max: FLASH_CHAMBER_LIMITS.operatingPressure.max,
          step: 10,
        }}
        helperText={`Vacuum range: ${FLASH_CHAMBER_LIMITS.operatingPressure.min} - ${FLASH_CHAMBER_LIMITS.operatingPressure.max} mbar abs (1013 = atmospheric)`}
        fullWidth
      />

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
          }}
          helperText="Desired vapor production"
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
