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
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlowRateUnit,
} from '@vapour/types';
import { FLASH_CHAMBER_LIMITS, FLOW_RATE_UNIT_LABELS } from '@vapour/types';

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
            Spray Zone Height Reference (for 1000mm diameter chamber):
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
                <TableRow>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>70°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>35°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>714 mm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>80°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>40°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>596 mm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>90°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>45°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>500 mm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>100°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>50°</TableCell>
                  <TableCell sx={{ py: 0.25, fontSize: '0.75rem' }}>420 mm</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Formula: Height = (Diameter/2) / tan(Angle/2)
          </Typography>
        </Box>

        {/* BTL Above Pump Inlet */}
        <TextField
          label="BTL Above Pump Inlet"
          type="number"
          value={inputs.btlAbovePumpInlet}
          onChange={(e) => handleChange('btlAbovePumpInlet', parseFloat(e.target.value) || 0)}
          InputProps={{
            endAdornment: (
              <>
                <InputAdornment position="end">m</InputAdornment>
                <Tooltip title="Height of Bottom Tangent Line above pump inlet centerline. Affects NPSHa calculation.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ),
          }}
          inputProps={{
            min: FLASH_CHAMBER_LIMITS.btlAbovePumpInlet.min,
            max: FLASH_CHAMBER_LIMITS.btlAbovePumpInlet.max,
            step: 0.5,
          }}
          helperText={`Distance from pump inlet to BTL (${FLASH_CHAMBER_LIMITS.btlAbovePumpInlet.min} - ${FLASH_CHAMBER_LIMITS.btlAbovePumpInlet.max} m)`}
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
