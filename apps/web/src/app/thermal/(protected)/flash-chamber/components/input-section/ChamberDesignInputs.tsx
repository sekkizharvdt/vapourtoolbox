'use client';

import { useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Tooltip,
  IconButton,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { FlashChamberInput } from '@vapour/types';
import { FLASH_CHAMBER_LIMITS } from '@vapour/types';
import { calculateSprayZoneHeight } from './helpers';

interface ChamberDesignInputsProps {
  inputs: FlashChamberInput;
  calculatedDiameter?: number;
  vaporVelocity?: number;
  vaporVelocityStatus?: 'OK' | 'HIGH' | 'VERY_HIGH';
  vaporLoading?: number;
  onChange: (field: keyof FlashChamberInput, value: number | string | boolean) => void;
  onDiameterModeChange: (autoCalculate: boolean) => void;
}

export function ChamberDesignInputs({
  inputs,
  calculatedDiameter,
  vaporVelocity,
  vaporVelocityStatus,
  vaporLoading,
  onChange,
  onDiameterModeChange,
}: ChamberDesignInputsProps) {
  // Effective diameter to use for spray zone reference calculation
  const effectiveDiameter = useMemo(() => {
    if (inputs.autoCalculateDiameter !== false) {
      return calculatedDiameter || 1000;
    }
    return inputs.userDiameter || 1000;
  }, [inputs.autoCalculateDiameter, inputs.userDiameter, calculatedDiameter]);

  // Calculate spray zone heights for reference table
  const sprayZoneReference = useMemo(() => {
    const angles = [70, 80, 90, 100];
    return angles.map((angle) => ({
      angle,
      halfAngle: angle / 2,
      height: calculateSprayZoneHeight(effectiveDiameter, angle),
    }));
  }, [effectiveDiameter]);

  return (
    <>
      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Chamber Design Parameters
      </Typography>

      {/* Vessel Diameter */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={inputs.autoCalculateDiameter !== false}
              onChange={(e) => onDiameterModeChange(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              Auto-calculate diameter
              {inputs.autoCalculateDiameter !== false && calculatedDiameter && (
                <Typography component="span" variant="body2" color="primary" sx={{ ml: 1 }}>
                  ({calculatedDiameter} mm)
                </Typography>
              )}
            </Typography>
          }
        />
        {inputs.autoCalculateDiameter === false && (
          <>
            <TextField
              label="Vessel Diameter"
              type="number"
              value={inputs.userDiameter || ''}
              onChange={(e) => onChange('userDiameter', parseFloat(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">mm</InputAdornment>,
              }}
              inputProps={{
                min: FLASH_CHAMBER_LIMITS.userDiameter.min,
                max: FLASH_CHAMBER_LIMITS.userDiameter.max,
                step: 100,
              }}
              helperText={`Range: ${FLASH_CHAMBER_LIMITS.userDiameter.min} - ${FLASH_CHAMBER_LIMITS.userDiameter.max} mm (in 100mm increments)`}
              fullWidth
              sx={{ mt: 1 }}
            />
            {/* Vapor Velocity Display */}
            {vaporVelocity !== undefined && (
              <Box
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor:
                    vaporVelocityStatus === 'OK'
                      ? 'success.50'
                      : vaporVelocityStatus === 'HIGH'
                        ? 'warning.50'
                        : 'error.50',
                  border: 1,
                  borderColor:
                    vaporVelocityStatus === 'OK'
                      ? 'success.main'
                      : vaporVelocityStatus === 'HIGH'
                        ? 'warning.main'
                        : 'error.main',
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  color={
                    vaporVelocityStatus === 'OK'
                      ? 'success.dark'
                      : vaporVelocityStatus === 'HIGH'
                        ? 'warning.dark'
                        : 'error.dark'
                  }
                >
                  Vapor Velocity: {vaporVelocity.toFixed(3)} m/s
                </Typography>
                {vaporLoading !== undefined && (
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    color={
                      vaporVelocityStatus === 'OK'
                        ? 'success.dark'
                        : vaporVelocityStatus === 'HIGH'
                          ? 'warning.dark'
                          : 'error.dark'
                    }
                  >
                    Vapor Loading: {vaporLoading.toFixed(3)} ton/hr/m²
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  color={
                    vaporVelocityStatus === 'OK'
                      ? 'success.dark'
                      : vaporVelocityStatus === 'HIGH'
                        ? 'warning.dark'
                        : 'error.dark'
                  }
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {vaporVelocityStatus === 'OK' && 'Good - minimal liquid entrainment risk'}
                  {vaporVelocityStatus === 'HIGH' &&
                    'Elevated - consider larger diameter or mist eliminator'}
                  {vaporVelocityStatus === 'VERY_HIGH' &&
                    'Too high - increase diameter to avoid entrainment'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Recommended velocity: &lt; 0.5 m/s
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Retention Time */}
      <TextField
        label="Retention Time"
        type="number"
        value={inputs.retentionTime}
        onChange={(e) => onChange('retentionTime', parseFloat(e.target.value) || 0)}
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
        onChange={(e) => onChange('flashingZoneHeight', parseFloat(e.target.value) || 0)}
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
        onChange={(e) => onChange('sprayAngle', parseFloat(e.target.value) || 0)}
        InputProps={{
          endAdornment: (
            <>
              <InputAdornment position="end">degrees</InputAdornment>
              <Tooltip title="Cone angle of spray nozzle. Wider angle = shorter spray zone height.">
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
        helperText={`Nozzle spray cone angle (${FLASH_CHAMBER_LIMITS.sprayAngle.min}° - ${FLASH_CHAMBER_LIMITS.sprayAngle.max}°). Wider angle = shorter spray zone.`}
        fullWidth
      />

      {/* Spray Angle Reference Table */}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Spray Zone Height Reference (for {effectiveDiameter}mm diameter chamber):
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>Spray Angle</TableCell>
                <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>Half Angle</TableCell>
                <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>Spray Zone Height</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sprayZoneReference.map((row) => (
                <TableRow
                  key={row.angle}
                  sx={{
                    bgcolor: row.angle === inputs.sprayAngle ? 'action.selected' : undefined,
                  }}
                >
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>{row.angle}°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>{row.halfAngle}°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>{row.height} mm</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Formula: Height = (Diameter/2) / tan(Angle/2)
        </Typography>
      </Box>
    </>
  );
}
