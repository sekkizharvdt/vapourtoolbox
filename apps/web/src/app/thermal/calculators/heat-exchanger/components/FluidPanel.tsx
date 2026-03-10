'use client';

/**
 * Reusable fluid input panels for tube-side and shell-side specification.
 * Collects fluid type, salinity, flow rate, and temperatures.
 *
 * Shell-side panels vary by exchanger type:
 *   - CONDENSER: condensing vapor (mass flow + saturation temp)
 *   - EVAPORATOR: boiling liquid (mass flow + saturation temp)
 *   - LIQUID_LIQUID: sensible fluid (type + flow + inlet/outlet temps)
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

// -- Tube-Side Panel --

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
  /** Label override for the panel header */
  label?: string;
}

export function TubeSidePanel({ values, onChange, label }: TubeSidePanelProps) {
  const set = (patch: Partial<TubeSideValues>) => onChange({ ...values, ...patch });

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        {label ?? 'Tube Side (Cooling Fluid)'}
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

// -- Shell-Side Panel (Condensing) --

export interface ShellSideCondensingValues {
  massFlowRate: string;
  saturationTemp: string;
}

/** @deprecated Use ShellSideCondensingValues — kept for backward compatibility */
export type ShellSideValues = ShellSideCondensingValues;

interface ShellSideCondensingPanelProps {
  values: ShellSideCondensingValues;
  onChange: (values: ShellSideCondensingValues) => void;
}

export function ShellSidePanel({ values, onChange }: ShellSideCondensingPanelProps) {
  const set = (patch: Partial<ShellSideCondensingValues>) => onChange({ ...values, ...patch });

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

// -- Shell-Side Panel (Boiling / Evaporator) --

export interface ShellSideBoilingValues {
  massFlowRate: string;
  saturationTemp: string;
}

interface ShellSideBoilingPanelProps {
  values: ShellSideBoilingValues;
  onChange: (values: ShellSideBoilingValues) => void;
}

export function ShellSideBoilingPanel({ values, onChange }: ShellSideBoilingPanelProps) {
  const set = (patch: Partial<ShellSideBoilingValues>) => onChange({ ...values, ...patch });

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Shell Side (Boiling Liquid)
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Vapor Production Rate"
          size="small"
          type="number"
          fullWidth
          value={values.massFlowRate}
          onChange={(e) => set({ massFlowRate: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
          helperText="Rate of vapor produced by boiling"
        />

        <TextField
          label="Boiling Temperature"
          size="small"
          type="number"
          fullWidth
          value={values.saturationTemp}
          onChange={(e) => set({ saturationTemp: e.target.value })}
          slotProps={{ input: { endAdornment: <Adornment>{'\u00B0C'}</Adornment> } }}
          helperText="Saturation temperature at operating pressure"
        />
      </Stack>
    </Box>
  );
}

// -- Shell-Side Panel (Liquid-Liquid / Sensible) --

export interface ShellSideSensibleValues {
  fluid: FluidType;
  salinity: string;
  massFlowRate: string;
  inletTemp: string;
  outletTemp: string;
}

interface ShellSideSensiblePanelProps {
  values: ShellSideSensibleValues;
  onChange: (values: ShellSideSensibleValues) => void;
}

export function ShellSideSensiblePanel({ values, onChange }: ShellSideSensiblePanelProps) {
  const set = (patch: Partial<ShellSideSensibleValues>) => onChange({ ...values, ...patch });

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Shell Side (Liquid)
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
