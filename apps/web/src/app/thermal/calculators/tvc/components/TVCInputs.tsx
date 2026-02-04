'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

interface TVCInputsProps {
  motivePressure: string;
  motiveTemperature: string;
  suctionPressure: string;
  dischargePressure: string;
  flowMode: 'entrained' | 'motive';
  flowValue: string;
  onMotivePressureChange: (value: string) => void;
  onMotiveTemperatureChange: (value: string) => void;
  onSuctionPressureChange: (value: string) => void;
  onDischargePressureChange: (value: string) => void;
  onFlowModeChange: (value: 'entrained' | 'motive') => void;
  onFlowValueChange: (value: string) => void;
}

export function TVCInputs({
  motivePressure,
  motiveTemperature,
  suctionPressure,
  dischargePressure,
  flowMode,
  flowValue,
  onMotivePressureChange,
  onMotiveTemperatureChange,
  onSuctionPressureChange,
  onDischargePressureChange,
  onFlowModeChange,
  onFlowValueChange,
}: TVCInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Motive Steam
      </Typography>

      <TextField
        label="Motive Steam Pressure"
        value={motivePressure}
        onChange={(e) => onMotivePressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <TextField
        label="Motive Steam Temperature"
        value={motiveTemperature}
        onChange={(e) => onMotiveTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText="Leave blank for saturated steam"
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Suction Vapor
      </Typography>

      <TextField
        label="Suction Vapor Pressure"
        value={suctionPressure}
        onChange={(e) => onSuctionPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Discharge
      </Typography>

      <TextField
        label="Discharge Pressure"
        value={dischargePressure}
        onChange={(e) => onDischargePressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Flow Specification
      </Typography>

      <ToggleButtonGroup
        value={flowMode}
        exclusive
        onChange={(_, v) => v && onFlowModeChange(v as 'entrained' | 'motive')}
        fullWidth
        size="small"
      >
        <ToggleButton value="entrained">Specify Entrained</ToggleButton>
        <ToggleButton value="motive">Specify Motive</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        label={flowMode === 'entrained' ? 'Entrained Vapor Flow' : 'Motive Steam Flow'}
        value={flowValue}
        onChange={(e) => onFlowValueChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />
    </Stack>
  );
}
