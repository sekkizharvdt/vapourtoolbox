'use client';

/**
 * Flash Chamber Input Section
 *
 * Form for entering flash chamber design parameters.
 * Supports two modes: Water Flow Known and Vapor Quantity Known.
 */

import {
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  InputAdornment,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { FlashChamberInput, FlashChamberInputMode } from '@vapour/types';
import { FLASH_CHAMBER_LIMITS } from '@vapour/types';

interface InputSectionProps {
  inputs: FlashChamberInput;
  onChange: (inputs: FlashChamberInput) => void;
}

export function InputSection({ inputs, onChange }: InputSectionProps) {
  const handleChange = (field: keyof FlashChamberInput, value: number | string) => {
    onChange({
      ...inputs,
      [field]: value,
    });
  };

  const handleModeChange = (mode: FlashChamberInputMode) => {
    onChange({
      ...inputs,
      mode,
      // Clear the non-applicable field when switching modes
      waterFlowRate: mode === 'WATER_FLOW' ? inputs.waterFlowRate || 100 : undefined,
      vaporQuantity: mode === 'VAPOR_QUANTITY' ? inputs.vaporQuantity || 5 : undefined,
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Process Inputs
      </Typography>

      <Stack spacing={3}>
        {/* Mode Selection */}
        <FormControl fullWidth>
          <InputLabel>Calculation Mode</InputLabel>
          <Select
            value={inputs.mode}
            label="Calculation Mode"
            onChange={(e) => handleModeChange(e.target.value as FlashChamberInputMode)}
          >
            <MenuItem value="WATER_FLOW">Water Flow Known</MenuItem>
            <MenuItem value="VAPOR_QUANTITY">Vapor Quantity Known</MenuItem>
          </Select>
        </FormControl>

        {/* Operating Pressure */}
        <TextField
          label="Operating Pressure"
          type="number"
          value={inputs.operatingPressure}
          onChange={(e) => handleChange('operatingPressure', parseFloat(e.target.value) || 0)}
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
            onChange={(e) => handleChange('waterFlowRate', parseFloat(e.target.value) || 0)}
            InputProps={{
              endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
            }}
            inputProps={{
              min: FLASH_CHAMBER_LIMITS.waterFlowRate.min,
              max: FLASH_CHAMBER_LIMITS.waterFlowRate.max,
              step: 1,
            }}
            helperText="Inlet seawater flow rate"
            fullWidth
          />
        ) : (
          <TextField
            label="Vapor Quantity"
            type="number"
            value={inputs.vaporQuantity || ''}
            onChange={(e) => handleChange('vaporQuantity', parseFloat(e.target.value) || 0)}
            InputProps={{
              endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
            }}
            inputProps={{
              min: FLASH_CHAMBER_LIMITS.vaporQuantity.min,
              max: FLASH_CHAMBER_LIMITS.vaporQuantity.max,
              step: 0.1,
            }}
            helperText="Desired vapor production"
            fullWidth
          />
        )}

        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          Seawater Inlet Conditions
        </Typography>

        {/* Inlet Temperature */}
        <TextField
          label="Inlet Temperature"
          type="number"
          value={inputs.inletTemperature}
          onChange={(e) => handleChange('inletTemperature', parseFloat(e.target.value) || 0)}
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

        {/* Salinity */}
        <TextField
          label="Seawater Salinity"
          type="number"
          value={inputs.seawaterSalinity}
          onChange={(e) => handleChange('seawaterSalinity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.seawaterSalinity.min,
            max: FLASH_CHAMBER_LIMITS.seawaterSalinity.max,
            step: 1000,
          }}
          helperText="Typical seawater: 35,000 ppm"
          fullWidth
        />

        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          Chamber Design Parameters
        </Typography>

        {/* Retention Time */}
        <TextField
          label="Retention Time"
          type="number"
          value={inputs.retentionTime}
          onChange={(e) => handleChange('retentionTime', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">minutes</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.retentionTime.min,
            max: FLASH_CHAMBER_LIMITS.retentionTime.max,
            step: 0.5,
          }}
          helperText="Liquid hold-up time in chamber"
          fullWidth
        />

        {/* Flashing Zone Height */}
        <TextField
          label="Flashing Zone Height"
          type="number"
          value={inputs.flashingZoneHeight}
          onChange={(e) => handleChange('flashingZoneHeight', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.flashingZoneHeight.min,
            max: FLASH_CHAMBER_LIMITS.flashingZoneHeight.max,
            step: 50,
          }}
          helperText="Zone where flash evaporation occurs (typical: 500mm)"
          fullWidth
        />

        {/* Spray Angle */}
        <TextField
          label="Spray Angle"
          type="number"
          value={inputs.sprayAngle}
          onChange={(e) => handleChange('sprayAngle', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: (
              <>
                <InputAdornment position="end">degrees</InputAdornment>
                <Tooltip title="Cone angle of spray nozzle. Used to calculate spray zone height (triangle geometry).">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ),
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.sprayAngle.min,
            max: FLASH_CHAMBER_LIMITS.sprayAngle.max,
            step: 5,
          }}
          helperText="Nozzle spray cone angle"
          fullWidth
        />

        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          Nozzle Velocity Inputs
        </Typography>

        {/* Inlet Water Velocity */}
        <TextField
          label="Inlet Water Velocity"
          type="number"
          value={inputs.inletWaterVelocity}
          onChange={(e) => handleChange('inletWaterVelocity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.inletWaterVelocity.min,
            max: FLASH_CHAMBER_LIMITS.inletWaterVelocity.max,
            step: 0.1,
          }}
          helperText={`Typical: ${FLASH_CHAMBER_LIMITS.inletWaterVelocity.min} - ${FLASH_CHAMBER_LIMITS.inletWaterVelocity.max} m/s`}
          fullWidth
        />

        {/* Outlet Water Velocity */}
        <TextField
          label="Outlet Brine Velocity"
          type="number"
          value={inputs.outletWaterVelocity}
          onChange={(e) => handleChange('outletWaterVelocity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.outletWaterVelocity.min,
            max: FLASH_CHAMBER_LIMITS.outletWaterVelocity.max,
            step: 0.1,
          }}
          helperText={`Typical: ${FLASH_CHAMBER_LIMITS.outletWaterVelocity.min} - ${FLASH_CHAMBER_LIMITS.outletWaterVelocity.max} m/s`}
          fullWidth
        />

        {/* Vapor Velocity */}
        <TextField
          label="Vapor Outlet Velocity"
          type="number"
          value={inputs.vaporVelocity}
          onChange={(e) => handleChange('vaporVelocity', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.vaporVelocity.min,
            max: FLASH_CHAMBER_LIMITS.vaporVelocity.max,
            step: 1,
          }}
          helperText={`Typical: ${FLASH_CHAMBER_LIMITS.vaporVelocity.min} - ${FLASH_CHAMBER_LIMITS.vaporVelocity.max} m/s`}
          fullWidth
        />
      </Stack>
    </Paper>
  );
}
