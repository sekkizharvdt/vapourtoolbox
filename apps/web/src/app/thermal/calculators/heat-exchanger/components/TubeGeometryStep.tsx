'use client';

/**
 * Step 3 — Tube Geometry & Fouling
 *
 * Tube selection (OD, BWG, material, layout, passes, length) and fouling resistances.
 * Extracted from the existing HeatExchangerClient.tsx Step 3.
 */

import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  TUBE_MATERIALS,
  TUBE_LAYOUT_LABELS,
  getDistinctODs,
  getBWGsForOD,
} from '@/lib/thermal/heatExchangerSizing';
import type { TubeLayout } from '@/lib/thermal/heatExchangerSizing';

function Adornment({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
  );
}

export interface TubeGeometryValues {
  tubeOD: number;
  tubeBWG: number;
  tubeMaterial: string;
  tubeLayout: TubeLayout;
  pitchRatio: string;
  tubePasses: number;
  tubeLength: string;
  foulingTubeSide: string;
  foulingShellSide: string;
}

interface TubeGeometryStepProps {
  values: TubeGeometryValues;
  onChange: (values: TubeGeometryValues) => void;
}

export function TubeGeometryStep({ values, onChange }: TubeGeometryStepProps) {
  const set = (patch: Partial<TubeGeometryValues>) => onChange({ ...values, ...patch });

  const distinctODs = getDistinctODs();
  const availableBWGs = getBWGsForOD(values.tubeOD);

  const handleODChange = (od: number) => {
    const bwgs = getBWGsForOD(od);
    const newBWG = bwgs.includes(values.tubeBWG) ? values.tubeBWG : bwgs[0]!;
    set({ tubeOD: od, tubeBWG: newBWG });
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Tube Geometry & Fouling
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select tube specification and fouling resistances. The design engine will iterate to
        converge on the final tube count and overall HTC.
      </Typography>

      <Grid container spacing={2}>
        {/* Tube OD */}
        <Grid size={{ xs: 6, md: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Tube OD</InputLabel>
            <Select
              value={values.tubeOD}
              label="Tube OD"
              onChange={(e) => handleODChange(Number(e.target.value))}
            >
              {distinctODs.map((od) => (
                <MenuItem key={od} value={od}>
                  {od} mm
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* BWG */}
        <Grid size={{ xs: 6, md: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>BWG</InputLabel>
            <Select
              value={values.tubeBWG}
              label="BWG"
              onChange={(e) => set({ tubeBWG: Number(e.target.value) })}
            >
              {availableBWGs.map((bwg) => (
                <MenuItem key={bwg} value={bwg}>
                  {bwg}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Material */}
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Material</InputLabel>
            <Select
              value={values.tubeMaterial}
              label="Material"
              onChange={(e) => set({ tubeMaterial: e.target.value })}
            >
              {Object.entries(TUBE_MATERIALS).map(([key, mat]) => (
                <MenuItem key={key} value={key}>
                  {mat.label} ({mat.conductivity} W/m{'\u00B7'}K)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Layout */}
        <Grid size={{ xs: 6, md: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Layout</InputLabel>
            <Select
              value={values.tubeLayout}
              label="Layout"
              onChange={(e) => set({ tubeLayout: e.target.value as TubeLayout })}
            >
              {Object.entries(TUBE_LAYOUT_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Pitch Ratio */}
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField
            label="Pitch Ratio"
            size="small"
            type="number"
            fullWidth
            value={values.pitchRatio}
            onChange={(e) => set({ pitchRatio: e.target.value })}
            slotProps={{ input: { endAdornment: <Adornment>{'\u2265'}1.25</Adornment> } }}
          />
        </Grid>

        {/* Passes */}
        <Grid size={{ xs: 6, md: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Passes</InputLabel>
            <Select
              value={values.tubePasses}
              label="Passes"
              onChange={(e) => set({ tubePasses: Number(e.target.value) })}
            >
              {[1, 2, 4, 6].map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Tube Length */}
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField
            label="Tube Length"
            size="small"
            type="number"
            fullWidth
            value={values.tubeLength}
            onChange={(e) => set({ tubeLength: e.target.value })}
            slotProps={{ input: { endAdornment: <Adornment>m</Adornment> } }}
          />
        </Grid>

        {/* Fouling */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1, mb: 1 }}>
            Fouling Resistances
          </Typography>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Tube-side Fouling"
            size="small"
            type="number"
            fullWidth
            value={values.foulingTubeSide}
            onChange={(e) => set({ foulingTubeSide: e.target.value })}
            slotProps={{
              input: {
                endAdornment: <Adornment>m{'\u00B2\u00B7'}K/W</Adornment>,
              },
            }}
            helperText="Seawater <50\u00B0C: 0.000088"
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Shell-side Fouling"
            size="small"
            type="number"
            fullWidth
            value={values.foulingShellSide}
            onChange={(e) => set({ foulingShellSide: e.target.value })}
            slotProps={{
              input: {
                endAdornment: <Adornment>m{'\u00B2\u00B7'}K/W</Adornment>,
              },
            }}
            helperText="Clean steam: 0.0000088"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
