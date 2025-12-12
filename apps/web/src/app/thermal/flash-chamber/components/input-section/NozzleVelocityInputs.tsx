'use client';

import { useMemo } from 'react';
import { TextField, InputAdornment, Tooltip, IconButton, Divider, Typography } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { FlashChamberInput } from '@vapour/types';
import { FLASH_CHAMBER_LIMITS } from '@vapour/types';
import { calculateMaxVaporVelocity } from './helpers';

interface NozzleVelocityInputsProps {
  inputs: FlashChamberInput;
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean) => void;
}

export function NozzleVelocityInputs({ inputs, onChange }: NozzleVelocityInputsProps) {
  // Calculate maximum vapor velocity based on operating pressure
  const vaporVelocityLimits = useMemo(() => {
    return calculateMaxVaporVelocity(inputs.operatingPressure);
  }, [inputs.operatingPressure]);

  return (
    <>
      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Nozzle Velocity Inputs
      </Typography>

      {/* Inlet Water Velocity */}
      <TextField
        label="Inlet Water Velocity"
        type="number"
        value={inputs.inletWaterVelocity}
        onChange={(e) => onChange('inletWaterVelocity', parseFloat(e.target.value) || 0)}
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
        onChange={(e) => onChange('outletWaterVelocity', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.outletWaterVelocity.min,
          max: FLASH_CHAMBER_LIMITS.outletWaterVelocity.max,
          step: 0.01,
        }}
        helperText={`Max: ${FLASH_CHAMBER_LIMITS.outletWaterVelocity.max} m/s (very low to minimize vortexing)`}
        fullWidth
      />

      {/* Vapor Velocity */}
      <TextField
        label="Vapor Outlet Velocity"
        type="number"
        value={inputs.vaporVelocity}
        onChange={(e) => onChange('vaporVelocity', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m/s</InputAdornment>
              <Tooltip
                title={`At ${vaporVelocityLimits.saturationTemp.toFixed(1)}°C saturation: Sonic velocity = ${vaporVelocityLimits.sonicVelocity.toFixed(0)} m/s, Max recommended (35% sonic) = ${vaporVelocityLimits.maxRecommendedVelocity.toFixed(0)} m/s`}
              >
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.vaporVelocity.min,
          max: FLASH_CHAMBER_LIMITS.vaporVelocity.max,
          step: 1,
        }}
        helperText={`Max recommended: ${vaporVelocityLimits.maxRecommendedVelocity.toFixed(0)} m/s (35% of sonic at ${inputs.operatingPressure} mbar)`}
        fullWidth
        error={inputs.vaporVelocity > vaporVelocityLimits.maxRecommendedVelocity}
      />
    </>
  );
}
