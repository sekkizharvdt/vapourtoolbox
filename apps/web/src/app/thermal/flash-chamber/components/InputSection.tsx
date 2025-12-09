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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { useMemo } from 'react';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlowRateUnit,
} from '@vapour/types';
import { FLASH_CHAMBER_LIMITS, FLOW_RATE_UNIT_LABELS } from '@vapour/types';
import { getSaturationTemperature, mbarAbsToBar } from '@vapour/constants';

interface InputSectionProps {
  inputs: FlashChamberInput;
  onChange: (inputs: FlashChamberInput) => void;
  /** Auto-calculated diameter from results (optional, for display) */
  calculatedDiameter?: number;
}

// Helper function to calculate spray zone height
function calculateSprayZoneHeight(diameter: number, angle: number): number {
  const radiusMM = diameter / 2;
  const halfAngleRad = (angle / 2) * (Math.PI / 180);
  return Math.round(radiusMM / Math.tan(halfAngleRad));
}

/**
 * Calculate sonic velocity and maximum recommended vapor velocity
 * For saturated steam, sonic velocity ≈ √(γRT) where:
 * - γ (gamma) ≈ 1.3 for steam
 * - R = 461.5 J/(kg·K) for steam
 * - T = temperature in Kelvin
 *
 * Maximum practical velocity is ~0.3-0.5 of sonic to avoid entrainment
 */
function calculateMaxVaporVelocity(operatingPressureMbar: number): {
  saturationTemp: number;
  sonicVelocity: number;
  maxRecommendedVelocity: number;
} {
  // Guard against invalid pressure values during user typing
  // Steam tables have minimum pressure of ~6.1 mbar (triple point)
  // Values below 10 mbar are likely incomplete user input
  if (operatingPressureMbar < 10) {
    return {
      saturationTemp: 0,
      sonicVelocity: 0,
      maxRecommendedVelocity: 0,
    };
  }

  const pressureBar = mbarAbsToBar(operatingPressureMbar);
  const satTempC = getSaturationTemperature(pressureBar);
  const satTempK = satTempC + 273.15;

  // Steam properties
  const gamma = 1.3; // Ratio of specific heats for steam
  const R_steam = 461.5; // J/(kg·K)

  // Sonic velocity for ideal gas approximation
  const sonicVelocity = Math.sqrt(gamma * R_steam * satTempK);

  // Maximum recommended velocity (35% of sonic - conservative)
  const maxRecommendedVelocity = sonicVelocity * 0.35;

  return {
    saturationTemp: satTempC,
    sonicVelocity,
    maxRecommendedVelocity,
  };
}

export function InputSection({ inputs, onChange, calculatedDiameter }: InputSectionProps) {
  const handleChange = (field: keyof FlashChamberInput, value: number | string | boolean) => {
    onChange({
      ...inputs,
      [field]: value,
    });
  };

  // Handle diameter mode toggle
  const handleDiameterModeChange = (autoCalculate: boolean) => {
    onChange({
      ...inputs,
      autoCalculateDiameter: autoCalculate,
      // When switching to manual, default to current calculated value if available
      userDiameter: !autoCalculate && calculatedDiameter ? calculatedDiameter : inputs.userDiameter,
    });
  };

  // Effective diameter to use for spray zone reference calculation
  const effectiveDiameter = useMemo(() => {
    if (inputs.autoCalculateDiameter !== false) {
      return calculatedDiameter || 1000; // Use calculated or fallback
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

  // Calculate maximum vapor velocity based on operating pressure
  const vaporVelocityLimits = useMemo(() => {
    return calculateMaxVaporVelocity(inputs.operatingPressure);
  }, [inputs.operatingPressure]);

  const handleModeChange = (mode: FlashChamberInputMode) => {
    onChange({
      ...inputs,
      mode,
      // Clear the non-applicable field when switching modes
      waterFlowRate: mode === 'WATER_FLOW' ? inputs.waterFlowRate || 100 : undefined,
      vaporQuantity: mode === 'VAPOR_QUANTITY' ? inputs.vaporQuantity || 5 : undefined,
    });
  };

  const handleWaterTypeChange = (waterType: FlashChamberWaterType) => {
    onChange({
      ...inputs,
      waterType,
      // Set appropriate default salinity based on water type
      salinity: waterType === 'SEAWATER' ? 35000 : 0,
    });
  };

  const handleFlowRateUnitChange = (flowRateUnit: FlowRateUnit) => {
    onChange({
      ...inputs,
      flowRateUnit,
    });
  };

  // Get the current flow rate unit label
  const flowRateUnitLabel = FLOW_RATE_UNIT_LABELS[inputs.flowRateUnit];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Process Inputs
      </Typography>

      <Stack spacing={3}>
        {/* Water Type Selection */}
        <FormControl fullWidth>
          <InputLabel>Water Type</InputLabel>
          <Select
            value={inputs.waterType}
            label="Water Type"
            onChange={(e) => handleWaterTypeChange(e.target.value as FlashChamberWaterType)}
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
            onChange={(e) => handleModeChange(e.target.value as FlashChamberInputMode)}
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
            onChange={(e) => handleFlowRateUnitChange(e.target.value as FlowRateUnit)}
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
            onChange={(e) => handleChange('vaporQuantity', parseFloat(e.target.value) || 0)}
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

        {/* Salinity - only shown for seawater */}
        {inputs.waterType === 'SEAWATER' ? (
          <TextField
            label="Seawater Salinity"
            type="number"
            value={inputs.salinity}
            onChange={(e) => handleChange('salinity', parseFloat(e.target.value) || 0)}
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
                onChange={(e) => handleDiameterModeChange(e.target.checked)}
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
            <TextField
              label="Vessel Diameter"
              type="number"
              value={inputs.userDiameter || ''}
              onChange={(e) => handleChange('userDiameter', parseFloat(e.target.value) || 0)}
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
          )}
        </Box>

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

        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          Elevation Reference (FFL Based)
        </Typography>

        {/* Pump Centerline Above FFL */}
        <TextField
          label="Pump Centerline Above FFL"
          type="number"
          value={inputs.pumpCenterlineAboveFFL}
          onChange={(e) => handleChange('pumpCenterlineAboveFFL', parseFloat(e.target.value) || 0)}
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
          onChange={(e) => handleChange('operatingLevelAbovePump', parseFloat(e.target.value) || 0)}
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
          onChange={(e) => handleChange('operatingLevelRatio', parseFloat(e.target.value) || 0)}
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
          onChange={(e) => handleChange('btlGapBelowLGL', parseFloat(e.target.value) || 0)}
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
          onChange={(e) => handleChange('vaporVelocity', parseFloat(e.target.value) || 0)}
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
      </Stack>
    </Paper>
  );
}
