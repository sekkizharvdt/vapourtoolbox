'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Collapse,
} from '@mui/material';

interface TVCInputsProps {
  motivePressure: string;
  motiveTemperature: string;
  suctionPressure: string;
  dischargePressure: string;
  flowMode: 'entrained' | 'motive';
  flowValue: string;
  desuperheatEnabled: boolean;
  sprayWaterTemperature: string;
  showDesuperheatOption: boolean;
  onMotivePressureChange: (value: string) => void;
  onMotiveTemperatureChange: (value: string) => void;
  onSuctionPressureChange: (value: string) => void;
  onDischargePressureChange: (value: string) => void;
  onFlowModeChange: (value: 'entrained' | 'motive') => void;
  onFlowValueChange: (value: string) => void;
  onDesuperheatEnabledChange: (value: boolean) => void;
  onSprayWaterTemperatureChange: (value: string) => void;
}

// Hide number input spinners
const numberInputSx = {
  '& input[type=number]': {
    MozAppearance: 'textfield',
  },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
    {
      WebkitAppearance: 'none',
      margin: 0,
    },
};

export function TVCInputs({
  motivePressure,
  motiveTemperature,
  suctionPressure,
  dischargePressure,
  flowMode,
  flowValue,
  desuperheatEnabled,
  sprayWaterTemperature,
  showDesuperheatOption,
  onMotivePressureChange,
  onMotiveTemperatureChange,
  onSuctionPressureChange,
  onDischargePressureChange,
  onFlowModeChange,
  onFlowValueChange,
  onDesuperheatEnabledChange,
  onSprayWaterTemperatureChange,
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
        sx={numberInputSx}
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
        sx={numberInputSx}
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
        sx={numberInputSx}
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
        sx={numberInputSx}
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
        sx={numberInputSx}
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />

      {showDesuperheatOption && (
        <>
          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Desuperheating
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={desuperheatEnabled}
                onChange={(e) => onDesuperheatEnabledChange(e.target.checked)}
              />
            }
            label="Desuperheat discharge vapor"
          />

          <Collapse in={desuperheatEnabled}>
            <TextField
              label="Spray Water Temperature"
              value={sprayWaterTemperature}
              onChange={(e) => onSprayWaterTemperatureChange(e.target.value)}
              type="number"
              fullWidth
              sx={numberInputSx}
              InputProps={{
                endAdornment: <InputAdornment position="end">°C</InputAdornment>,
              }}
              helperText="Temperature of water used to desuperheat"
            />
          </Collapse>
        </>
      )}
    </Stack>
  );
}
