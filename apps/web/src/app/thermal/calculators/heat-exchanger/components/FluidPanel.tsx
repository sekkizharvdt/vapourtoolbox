'use client';

/**
 * Reusable fluid input panel for tube-side or shell-side specification.
 * Collects fluid type, salinity, flow rate, and temperatures.
 */

import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { FluidType } from '@/lib/thermal/fluidProperties';

function Adornment({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
  );
}

// ── Tube-Side Panel ──────────────────────────────────────────────────────────

export interface TubeSideValues {
  fluid: FluidType;
  salinity: string;
  massFlowRate: string;
  inletTemp: string;
  outletTemp: string;
}

interface TubeSidePanelProps {
  values: TubeSideValues;
  onChange: (values: TubeSideValues) => void;
}

export function TubeSidePanel({ values, onChange }: TubeSidePanelProps) {
  const set = (patch: Partial<TubeSideValues>) => onChange({ ...values, ...patch });

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Tube Side (Cooling Fluid)
      </Typography>
      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>Fluid Type</InputLabel>
          <Select
            value={values.fluid}
            label="Fluid Type"
            onChange={(e) => set({ fluid: e.target.value as FluidType })}
          >
            <MenuItem value="SEAWATER">Seawater</MenuItem>
            <MenuItem value="PURE_WATER">Pure Water</MenuItem>
          </Select>
        </FormControl>

        {values.fluid === 'SEAWATER' && (
          <TextField
            label="Salinity"
            size="small"
            type="number"
            fullWidth
            value={values.salinity}
            onChange={(e) => set({ salinity: e.target.value })}
            slotProps={{ input: { endAdornment: <Adornment>ppm</Adornment> } }}
          />
        )}

        <TextField
          label="Mass Flow Rate"
          size="small"
          type="number"
          fullWidth
          value={values.massFlowRate}
          onChange={(e) => set({ massFlowRate: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
        />

        <TextField
          label="Inlet Temperature"
          size="small"
          type="number"
          fullWidth
          value={values.inletTemp}
          onChange={(e) => set({ inletTemp: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>{'\u00B0C'}</Adornment> } }}
        />

        <TextField
          label="Outlet Temperature"
          size="small"
          type="number"
          fullWidth
          value={values.outletTemp}
          onChange={(e) => set({ outletTemp: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>{'\u00B0C'}</Adornment> } }}
        />
      </Stack>
    </Box>
  );
}

// ── Shell-Side Panel (Condensing) ────────────────────────────────────────────

export interface ShellSideValues {
  massFlowRate: string;
  saturationTemp: string;
}

interface ShellSidePanelProps {
  values: ShellSideValues;
  onChange: (values: ShellSideValues) => void;
}

export function ShellSidePanel({ values, onChange }: ShellSidePanelProps) {
  const set = (patch: Partial<ShellSideValues>) => onChange({ ...values, ...patch });

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Shell Side (Condensing Steam)
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Vapor Flow Rate"
          size="small"
          type="number"
          fullWidth
          value={values.massFlowRate}
          onChange={(e) => set({ massFlowRate: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
        />

        <TextField
          label="Saturation Temperature"
          size="small"
          type="number"
          fullWidth
          value={values.saturationTemp}
          onChange={(e) => set({ saturationTemp: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>{'\u00B0C'}</Adornment> } }}
        />
      </Stack>
    </Box>
  );
}
