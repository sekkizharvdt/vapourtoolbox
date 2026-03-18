'use client';

import { TextField, InputAdornment, Stack, Typography, Divider, MenuItem } from '@mui/material';

interface LateralBundleInputsProps {
  // Shell geometry
  shellID: string;
  side: 'left' | 'right';
  // Tube geometry
  tubeOD: string;
  wallThickness: string;
  tubeLength: string;
  tubeMaterialName: string;
  wallConductivity: string;
  // Pitch
  pitch: string;
  tubeHoleDiameter: string;
  edgeClearance: string;
  // Vapour lanes
  numberOfLanes: string;
  laneWidth: string;
  // Nozzle exclusions
  nozzleDia1: string;
  nozzleDia2: string;
  // Spray
  sprayFlowRate: string;
  sprayPressure: string;
  // Callbacks
  onShellIDChange: (v: string) => void;
  onSideChange: (v: 'left' | 'right') => void;
  onTubeODChange: (v: string) => void;
  onWallThicknessChange: (v: string) => void;
  onTubeLengthChange: (v: string) => void;
  onTubeMaterialNameChange: (v: string) => void;
  onWallConductivityChange: (v: string) => void;
  onPitchChange: (v: string) => void;
  onTubeHoleDiameterChange: (v: string) => void;
  onEdgeClearanceChange: (v: string) => void;
  onNumberOfLanesChange: (v: string) => void;
  onLaneWidthChange: (v: string) => void;
  onNozzleDia1Change: (v: string) => void;
  onNozzleDia2Change: (v: string) => void;
  onSprayFlowRateChange: (v: string) => void;
  onSprayPressureChange: (v: string) => void;
}

export function LateralBundleInputs(props: LateralBundleInputsProps) {
  return (
    <Stack spacing={2}>
      {/* --- Shell Geometry --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Shell Geometry
      </Typography>

      <TextField
        label="Shell Inner Diameter"
        value={props.shellID}
        onChange={(e) => props.onShellIDChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
      />

      <TextField
        select
        label="Bundle Side"
        value={props.side}
        onChange={(e) => props.onSideChange(e.target.value as 'left' | 'right')}
        fullWidth
      >
        <MenuItem value="left">Left Half</MenuItem>
        <MenuItem value="right">Right Half</MenuItem>
      </TextField>

      <Divider />

      {/* --- Tube Geometry --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Tube Geometry
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Tube OD"
          value={props.tubeOD}
          onChange={(e) => props.onTubeODChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
        <TextField
          label="Wall Thickness"
          value={props.wallThickness}
          onChange={(e) => props.onWallThicknessChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
      </Stack>

      <TextField
        label="Tube Length"
        value={props.tubeLength}
        onChange={(e) => props.onTubeLengthChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m</InputAdornment>,
        }}
      />

      <Divider />

      {/* --- Pitch & Layout --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Pitch &amp; Layout
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Triangular Pitch"
          value={props.pitch}
          onChange={(e) => props.onPitchChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
        <TextField
          label="Tube Hole Dia"
          value={props.tubeHoleDiameter}
          onChange={(e) => props.onTubeHoleDiameterChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          helperText="For rubber grommet"
        />
      </Stack>

      <TextField
        label="Edge Clearance"
        value={props.edgeClearance}
        onChange={(e) => props.onEdgeClearanceChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
      />

      <Divider />

      {/* --- Vapour Lanes --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Vapour Escape Lanes
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Number of Lanes"
          value={props.numberOfLanes}
          onChange={(e) => props.onNumberOfLanesChange(e.target.value)}
          type="number"
          fullWidth
        />
        <TextField
          label="Lane Width"
          value={props.laneWidth}
          onChange={(e) => props.onLaneWidthChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
      </Stack>

      <Divider />

      {/* --- Nozzle Exclusions --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Nozzle Penetrations
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Nozzle 1 Dia"
          value={props.nozzleDia1}
          onChange={(e) => props.onNozzleDia1Change(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          helperText="Vapour inlet"
        />
        <TextField
          label="Nozzle 2 Dia"
          value={props.nozzleDia2}
          onChange={(e) => props.onNozzleDia2Change(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          helperText="Condensate/brine"
        />
      </Stack>

      <Divider />

      {/* --- Spray Nozzle Parameters --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Spray System
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Total Spray Flow"
          value={props.sprayFlowRate}
          onChange={(e) => props.onSprayFlowRateChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
          }}
        />
        <TextField
          label="Nozzle Pressure"
          value={props.sprayPressure}
          onChange={(e) => props.onSprayPressureChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">bar</InputAdornment>,
          }}
        />
      </Stack>
    </Stack>
  );
}
