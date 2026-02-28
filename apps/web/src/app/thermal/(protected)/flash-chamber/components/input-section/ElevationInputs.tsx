'use client';

import { TextField, InputAdornment, Tooltip, IconButton, Divider, Typography } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { FlashChamberInput } from '@vapour/types';
import { FLASH_CHAMBER_LIMITS } from '@vapour/types';

interface ElevationInputsProps {
  inputs: FlashChamberInput;
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean) => void;
}

export function ElevationInputs({ inputs, onChange }: ElevationInputsProps) {
  return (
    <>
      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Elevation Reference (FFL Based)
      </Typography>

      {/* Pump Centerline Above FFL */}
      <TextField
        label="Pump Centerline Above FFL"
        type="number"
        value={inputs.pumpCenterlineAboveFFL}
        onChange={(e) => onChange('pumpCenterlineAboveFFL', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="Elevation of pump centerline above Finished Floor Level (FFL = 0.000m)">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.pumpCenterlineAboveFFL.min,
          max: FLASH_CHAMBER_LIMITS.pumpCenterlineAboveFFL.max,
          step: 0.1,
        }}
        helperText={`Typical: 500-750mm (${FLASH_CHAMBER_LIMITS.pumpCenterlineAboveFFL.min} - ${FLASH_CHAMBER_LIMITS.pumpCenterlineAboveFFL.max} m)`}
        fullWidth
      />

      {/* Operating Level Above Pump */}
      <TextField
        label="Operating Level Above Pump"
        type="number"
        value={inputs.operatingLevelAbovePump}
        onChange={(e) => onChange('operatingLevelAbovePump', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="Height of normal operating liquid level above pump centerline. Determines NPSHa.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.operatingLevelAbovePump.min,
          max: FLASH_CHAMBER_LIMITS.operatingLevelAbovePump.max,
          step: 0.5,
        }}
        helperText={`Typical: 4m or higher (${FLASH_CHAMBER_LIMITS.operatingLevelAbovePump.min} - ${FLASH_CHAMBER_LIMITS.operatingLevelAbovePump.max} m)`}
        fullWidth
      />

      {/* Operating Level Ratio */}
      <TextField
        label="Operating Level Ratio"
        type="number"
        value={inputs.operatingLevelRatio}
        onChange={(e) => onChange('operatingLevelRatio', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">-</InputAdornment>
              <Tooltip title="Where operating level sits between LG-L and LG-H. 0.5 = midpoint, lower values = operating level closer to LG-L">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.operatingLevelRatio.min,
          max: FLASH_CHAMBER_LIMITS.operatingLevelRatio.max,
          step: 0.1,
        }}
        helperText="0.5 = operating level at midpoint of retention zone"
        fullWidth
      />

      {/* BTL Gap Below LG-L */}
      <TextField
        label="BTL Gap Below LG-L"
        type="number"
        value={inputs.btlGapBelowLGL}
        onChange={(e) => onChange('btlGapBelowLGL', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="Gap between Level Gauge Low tapping and Bottom Tangent Line">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.btlGapBelowLGL.min,
          max: FLASH_CHAMBER_LIMITS.btlGapBelowLGL.max,
          step: 0.05,
        }}
        helperText={`Typical: ~100mm (${FLASH_CHAMBER_LIMITS.btlGapBelowLGL.min} - ${FLASH_CHAMBER_LIMITS.btlGapBelowLGL.max} m)`}
        fullWidth
      />
    </>
  );
}
