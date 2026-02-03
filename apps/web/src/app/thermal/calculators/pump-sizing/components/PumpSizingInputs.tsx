'use client';

import { TextField, InputAdornment, Stack, Typography, Divider } from '@mui/material';

interface PumpSizingInputsProps {
  flowRate: string;
  fluidDensity: string;
  suctionVesselPressure: string;
  dischargeVesselPressure: string;
  staticHead: string;
  suctionPressureDrop: string;
  dischargePressureDrop: string;
  pumpEfficiency: string;
  motorEfficiency: string;
  onFlowRateChange: (value: string) => void;
  onFluidDensityChange: (value: string) => void;
  onSuctionVesselPressureChange: (value: string) => void;
  onDischargeVesselPressureChange: (value: string) => void;
  onStaticHeadChange: (value: string) => void;
  onSuctionPressureDropChange: (value: string) => void;
  onDischargePressureDropChange: (value: string) => void;
  onPumpEfficiencyChange: (value: string) => void;
  onMotorEfficiencyChange: (value: string) => void;
}

export function PumpSizingInputs({
  flowRate,
  fluidDensity,
  suctionVesselPressure,
  dischargeVesselPressure,
  staticHead,
  suctionPressureDrop,
  dischargePressureDrop,
  pumpEfficiency,
  motorEfficiency,
  onFlowRateChange,
  onFluidDensityChange,
  onSuctionVesselPressureChange,
  onDischargeVesselPressureChange,
  onStaticHeadChange,
  onSuctionPressureDropChange,
  onDischargePressureDropChange,
  onPumpEfficiencyChange,
  onMotorEfficiencyChange,
}: PumpSizingInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Flow &amp; Fluid
      </Typography>

      <TextField
        label="Mass Flow Rate"
        value={flowRate}
        onChange={(e) => onFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />

      <TextField
        label="Fluid Density"
        value={fluidDensity}
        onChange={(e) => onFluidDensityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Pressures &amp; Elevation
      </Typography>

      <TextField
        label="Suction Vessel Pressure"
        value={suctionVesselPressure}
        onChange={(e) => onSuctionVesselPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <TextField
        label="Discharge Vessel Pressure"
        value={dischargeVesselPressure}
        onChange={(e) => onDischargeVesselPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <TextField
        label="Static Head"
        value={staticHead}
        onChange={(e) => onStaticHeadChange(e.target.value)}
        type="number"
        fullWidth
        helperText="Elevation difference: discharge - suction"
        InputProps={{
          endAdornment: <InputAdornment position="end">m</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Friction Losses
      </Typography>

      <TextField
        label="Suction Piping Pressure Drop"
        value={suctionPressureDrop}
        onChange={(e) => onSuctionPressureDropChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar</InputAdornment>,
        }}
      />

      <TextField
        label="Discharge Piping Pressure Drop"
        value={dischargePressureDrop}
        onChange={(e) => onDischargePressureDropChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Efficiency
      </Typography>

      <TextField
        label="Pump Efficiency"
        value={pumpEfficiency}
        onChange={(e) => onPumpEfficiencyChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
        }}
      />

      <TextField
        label="Motor Efficiency"
        value={motorEfficiency}
        onChange={(e) => onMotorEfficiencyChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
        }}
      />
    </Stack>
  );
}
