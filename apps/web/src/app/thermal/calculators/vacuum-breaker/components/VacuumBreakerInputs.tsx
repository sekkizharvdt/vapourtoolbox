'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { VALVE_TYPE_LABELS, VALVE_CD, type ValveType } from '@/lib/thermal/vacuumBreakerCalculator';

interface VacuumBreakerInputsProps {
  totalVolume: string;
  numberOfBreakers: string;
  operatingPressure: string;
  equalizationTime: string;
  ambientTemperature: string;
  valveType: ValveType;
  onTotalVolumeChange: (value: string) => void;
  onNumberOfBreakersChange: (value: string) => void;
  onOperatingPressureChange: (value: string) => void;
  onEqualizationTimeChange: (value: string) => void;
  onAmbientTemperatureChange: (value: string) => void;
  onValveTypeChange: (value: ValveType) => void;
}

export function VacuumBreakerInputs({
  totalVolume,
  numberOfBreakers,
  operatingPressure,
  equalizationTime,
  ambientTemperature,
  valveType,
  onTotalVolumeChange,
  onNumberOfBreakersChange,
  onOperatingPressureChange,
  onEqualizationTimeChange,
  onAmbientTemperatureChange,
  onValveTypeChange,
}: VacuumBreakerInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Vessel Configuration
      </Typography>

      <TextField
        label="Total Volume (all effects)"
        value={totalVolume}
        onChange={(e) => onTotalVolumeChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m&sup3;</InputAdornment>,
        }}
        helperText="Combined volume of all 9 MED effects (shell + tube sides)"
      />

      <TextField
        label="Number of Vacuum Breakers"
        value={numberOfBreakers}
        onChange={(e) => onNumberOfBreakersChange(e.target.value)}
        type="number"
        fullWidth
        helperText="Volume is split equally between breakers (typically 2: shell side + tube side)"
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Operating Conditions
      </Typography>

      <TextField
        label="Operating Vacuum Pressure"
        value={operatingPressure}
        onChange={(e) => onOperatingPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kPa abs</InputAdornment>,
        }}
        helperText="Absolute pressure inside MED effects (typical: 5-15 kPa abs)"
      />

      <TextField
        label="Equalization Time"
        value={equalizationTime}
        onChange={(e) => onEqualizationTimeChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">minutes</InputAdornment>,
        }}
        helperText="Time allowed to bring vessel to near-atmospheric pressure"
      />

      <TextField
        label="Ambient Air Temperature"
        value={ambientTemperature}
        onChange={(e) => onAmbientTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Valve Configuration
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Valve Type</InputLabel>
        <Select
          value={valveType}
          label="Valve Type"
          onChange={(e) => onValveTypeChange(e.target.value as ValveType)}
        >
          {(Object.keys(VALVE_TYPE_LABELS) as ValveType[]).map((vt) => (
            <MenuItem key={vt} value={vt}>
              {VALVE_TYPE_LABELS[vt]} (C_d = {VALVE_CD[vt]})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
