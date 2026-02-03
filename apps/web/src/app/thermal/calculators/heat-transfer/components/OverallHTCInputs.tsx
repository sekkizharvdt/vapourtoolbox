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
import { FOULING_FACTORS, TUBE_CONDUCTIVITY, STANDARD_TUBES } from '@vapour/constants';

interface OverallHTCInputsProps {
  tubeSideHTC: string;
  shellSideHTC: string;
  tubeOD: string;
  tubeID: string;
  wallConductivity: string;
  tubeSideFouling: string;
  shellSideFouling: string;
  onTubeSideHTCChange: (value: string) => void;
  onShellSideHTCChange: (value: string) => void;
  onTubeODChange: (value: string) => void;
  onTubeIDChange: (value: string) => void;
  onWallConductivityChange: (value: string) => void;
  onTubeSideFoulingChange: (value: string) => void;
  onShellSideFoulingChange: (value: string) => void;
}

export function OverallHTCInputs({
  tubeSideHTC,
  shellSideHTC,
  tubeOD,
  tubeID,
  wallConductivity,
  tubeSideFouling,
  shellSideFouling,
  onTubeSideHTCChange,
  onShellSideHTCChange,
  onTubeODChange,
  onTubeIDChange,
  onWallConductivityChange,
  onTubeSideFoulingChange,
  onShellSideFoulingChange,
}: OverallHTCInputsProps) {
  const foulingEntries = Object.entries(FOULING_FACTORS);
  const materialEntries = Object.entries(TUBE_CONDUCTIVITY);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Film Coefficients
      </Typography>

      <TextField
        label="Tube-Side HTC"
        value={tubeSideHTC}
        onChange={(e) => onTubeSideHTCChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m²·K)</InputAdornment>,
        }}
      />

      <TextField
        label="Shell-Side HTC"
        value={shellSideHTC}
        onChange={(e) => onShellSideHTCChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m²·K)</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Tube Geometry
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Tube Size Preset</InputLabel>
        <Select
          value=""
          label="Tube Size Preset"
          onChange={(e) => {
            const idx = parseInt(e.target.value as string, 10);
            const tube = STANDARD_TUBES[idx];
            if (tube) {
              onTubeODChange(tube.od_mm.toString());
              onTubeIDChange(tube.id_mm.toString());
            }
          }}
        >
          {STANDARD_TUBES.map((tube, idx) => (
            <MenuItem key={idx} value={idx}>
              {tube.name} (ID: {tube.id_mm} mm)
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Tube OD"
        value={tubeOD}
        onChange={(e) => onTubeODChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
      />

      <TextField
        label="Tube ID"
        value={tubeID}
        onChange={(e) => onTubeIDChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Tube Material
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Material Preset</InputLabel>
        <Select
          value=""
          label="Material Preset"
          onChange={(e) => {
            const key = e.target.value as string;
            const material = TUBE_CONDUCTIVITY[key];
            if (material) {
              onWallConductivityChange(material.value.toString());
            }
          }}
        >
          {materialEntries.map(([key, mat]) => (
            <MenuItem key={key} value={key}>
              {mat.description} ({mat.value} W/(m·K))
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Wall Thermal Conductivity"
        value={wallConductivity}
        onChange={(e) => onWallConductivityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m·K)</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Fouling Factors
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Tube-Side Fouling Preset</InputLabel>
        <Select
          value=""
          label="Tube-Side Fouling Preset"
          onChange={(e) => {
            const key = e.target.value as string;
            const entry = FOULING_FACTORS[key];
            if (entry) {
              onTubeSideFoulingChange(entry.value.toString());
            }
          }}
        >
          {foulingEntries.map(([key, entry]) => (
            <MenuItem key={key} value={key}>
              {entry.description} ({entry.value})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Tube-Side Fouling Resistance"
        value={tubeSideFouling}
        onChange={(e) => onTubeSideFoulingChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m²·K/W</InputAdornment>,
        }}
      />

      <FormControl fullWidth>
        <InputLabel>Shell-Side Fouling Preset</InputLabel>
        <Select
          value=""
          label="Shell-Side Fouling Preset"
          onChange={(e) => {
            const key = e.target.value as string;
            const entry = FOULING_FACTORS[key];
            if (entry) {
              onShellSideFoulingChange(entry.value.toString());
            }
          }}
        >
          {foulingEntries.map(([key, entry]) => (
            <MenuItem key={key} value={key}>
              {entry.description} ({entry.value})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Shell-Side Fouling Resistance"
        value={shellSideFouling}
        onChange={(e) => onShellSideFoulingChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m²·K/W</InputAdornment>,
        }}
      />
    </Stack>
  );
}
