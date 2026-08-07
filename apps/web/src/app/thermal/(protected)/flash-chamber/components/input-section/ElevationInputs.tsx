'use client';

import { TextField, InputAdornment, Tooltip, IconButton, Divider, Typography } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { FlashChamberInput } from '@vapour/types';
import {
  FLASH_CHAMBER_LIMITS,
  DEFAULT_SUCTION_FRICTION_LOSS,
  DEFAULT_NPSH_SAFETY_MARGIN,
} from '@vapour/types';

interface ElevationInputsProps {
  inputs: FlashChamberInput;
  /**
   * `undefined` clears an optional field. It must not be coerced to 0 or '' —
   * the NPSHr check keys off `undefined` meaning "no pump named", and an empty
   * string would read as a named pump with an unusable value.
   */
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean | undefined) => void;
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
                <IconButton
                  size="small"
                  aria-label="Elevation of pump centerline above Finished Floor Level (FFL = 0.000m)"
                >
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
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
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
                <IconButton
                  size="small"
                  aria-label="Height of normal operating liquid level above pump centerline. Determines NPSHa."
                >
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
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
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
                <IconButton
                  size="small"
                  aria-label="Where operating level sits between LG-L and LG-H. 0.5 = midpoint, lower values = operating level closer to LG-L"
                >
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
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
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
                <IconButton
                  size="small"
                  aria-label="Gap between Level Gauge Low tapping and Bottom Tangent Line"
                >
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
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
        }}
        helperText={`Typical: ~100mm (${FLASH_CHAMBER_LIMITS.btlGapBelowLGL.min} - ${FLASH_CHAMBER_LIMITS.btlGapBelowLGL.max} m)`}
        fullWidth
      />

      {/* Suction Friction Loss — optional; the shown value is the one used */}
      <TextField
        label="Suction Friction Loss"
        type="number"
        value={inputs.suctionFrictionLoss ?? DEFAULT_SUCTION_FRICTION_LOSS}
        onChange={(e) => onChange('suctionFrictionLoss', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="Friction and fitting losses in the suction line to the extraction pump. This calculator has no pipe run to compute it from, so 0.5 m is a flat estimate — set it from a real hydraulic calculation (the suction system designer produces this number) where you have one. NPSHa moves metre for metre with it.">
                <IconButton
                  size="small"
                  aria-label="Friction and fitting losses in the suction line to the extraction pump. Defaults to a flat 0.5 m estimate."
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.suctionFrictionLoss.min,
          max: FLASH_CHAMBER_LIMITS.suctionFrictionLoss.max,
          step: 0.1,
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
        }}
        helperText={`Flat estimate — not computed from a pipe run (default ${DEFAULT_SUCTION_FRICTION_LOSS} m)`}
        fullWidth
      />

      {/* Pump NPSHr — optional; supplying it turns advice into a pass/fail */}
      <TextField
        label="Pump NPSHr (optional)"
        type="number"
        value={inputs.pumpNPSHr ?? ''}
        onChange={(e) =>
          onChange('pumpNPSHr', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)
        }
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="NPSHr of the extraction pump, from its datasheet. Supplied, the calculator checks NPSHa against it at every level and reports a pass or fail instead of a pump-class recommendation. Left blank, no check is performed.">
                <IconButton
                  size="small"
                  aria-label="NPSHr of the extraction pump from its datasheet. Optional; enables the adequacy check."
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.pumpNPSHr.min,
          max: FLASH_CHAMBER_LIMITS.pumpNPSHr.max,
          step: 0.1,
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
        }}
        helperText="Blank = no adequacy check, recommendation only"
        fullWidth
      />

      {/* NPSH Safety Margin — shows the value in use, not a blank */}
      <TextField
        label="NPSH Safety Margin"
        type="number"
        value={inputs.npshSafetyMargin ?? DEFAULT_NPSH_SAFETY_MARGIN}
        onChange={(e) =>
          onChange(
            'npshSafetyMargin',
            e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
          )
        }
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">m</InputAdornment>
              <Tooltip title="Head required above NPSHr before the vessel counts as adequate. The margin is case dependent — it depends on the service, the pump, how well the suction friction is known and how far the level swings — so there is no single right value. The results panel shows the verdict at each margin in use across the toolbox (0.5 / 1.0 / 1.5 m) and what raising the vessel would buy, so the choice can be made with the consequences visible.">
                <IconButton
                  size="small"
                  aria-label="Head required above NPSHr before the vessel counts as adequate. Case dependent — see the margin comparison in the results."
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ),
        }}
        inputProps={{
          min: FLASH_CHAMBER_LIMITS.npshSafetyMargin.min,
          max: FLASH_CHAMBER_LIMITS.npshSafetyMargin.max,
          step: 0.1,
          onWheel: (e) => (e.target as HTMLInputElement).blur(),
        }}
        helperText={
          inputs.pumpNPSHr === undefined
            ? 'Not applied — enter a pump NPSHr above to check against it'
            : 'Case dependent — the results panel compares 0.5 / 1.0 / 1.5 m against this vessel'
        }
        fullWidth
      />
    </>
  );
}
