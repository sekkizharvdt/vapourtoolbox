'use client';

/**
 * Stream Form Dialog
 *
 * Create/Edit dialog for process streams.
 * Auto-calculates density and enthalpy based on fluid type.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  InputAdornment,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import type { ProcessStream, ProcessStreamInput, FluidType } from '@vapour/types';
import { FLUID_TYPES } from '@vapour/types';
import { FLUID_CODE } from '@/lib/ssot/generatorHelpers';
import { createStream, updateStream } from '@/lib/ssot/streamService';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import {
  inferFluidType,
  calculateStreamProperties,
  hasPropertyCorrelations,
} from '@/lib/ssot/streamCalculations';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'StreamFormDialog' });

interface StreamFormDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
  accessCheck: SSOTAccessCheck;
  stream?: ProcessStream | null;
}

export default function StreamFormDialog({
  open,
  onClose,
  projectId,
  userId,
  accessCheck,
  stream,
}: StreamFormDialogProps) {
  const isEditing = !!stream;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [lineTag, setLineTag] = useState('');
  const [description, setDescription] = useState('');
  const [fluidType, setFluidType] = useState<FluidType>('SEA WATER');
  // Once the engineer picks a fluid from the dropdown, the tag stops changing
  // it. Otherwise selecting BIOGAS and then typing a third-party tag such as
  // "S-101" silently reclassifies the stream as steam — inference is a
  // convenience for our own tags, not an authority over a stated choice.
  const [fluidChosenExplicitly, setFluidChosenExplicitly] = useState(false);
  const [flowRateKgS, setFlowRateKgS] = useState<number | ''>('');
  const [pressureMbar, setPressureMbar] = useState<number | ''>('');
  const [temperature, setTemperature] = useState<number | ''>('');
  const [tds, setTds] = useState<number | ''>('');

  // Calculated fields (display only)
  const [flowRateKgHr, setFlowRateKgHr] = useState<number | null>(null);
  const [pressureBar, setPressureBar] = useState<number | null>(null);
  const [density, setDensity] = useState<number | null>(null);
  const [enthalpy, setEnthalpy] = useState<number | null>(null);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (stream) {
        // Editing existing stream
        setLineTag(stream.lineTag);
        setDescription(stream.description || '');
        setFluidType(stream.fluidType);
        setFlowRateKgS(stream.flowRateKgS);
        setPressureMbar(stream.pressureMbar);
        setTemperature(stream.temperature);
        setTds(stream.tds || '');
        setFlowRateKgHr(stream.flowRateKgHr);
        setPressureBar(stream.pressureBar);
        setDensity(stream.density);
        setEnthalpy(stream.enthalpy);
      } else {
        // Creating new stream
        resetForm();
      }
      setError('');
    }
  }, [open, stream]);

  // Whether this repo can derive density and enthalpy for the chosen fluid.
  // When it cannot (biogas), the two fields become inputs the engineer fills in
  // from the basic design rather than read-only outputs.
  const propertiesAreComputed = hasPropertyCorrelations(fluidType);

  // Auto-calculate when inputs change
  useEffect(() => {
    if (flowRateKgS !== '' && pressureMbar !== '' && temperature !== '') {
      try {
        const result = calculateStreamProperties({
          fluidType,
          temperature: Number(temperature),
          pressureMbar: Number(pressureMbar),
          flowRateKgS: Number(flowRateKgS),
          tds: tds !== '' ? Number(tds) : undefined,
        });
        setFlowRateKgHr(result.flowRateKgHr);
        setPressureBar(result.pressureBar);
        // A fluid with no correlation returns these undefined. Leave whatever
        // the engineer has typed in place rather than clearing it.
        if (result.density !== undefined) setDensity(result.density);
        if (result.enthalpy !== undefined) setEnthalpy(result.enthalpy);
      } catch (err) {
        // Keep previous calculated values if calculation fails
        logger.warn('Stream calculation failed', { error: err });
      }
    }
  }, [fluidType, flowRateKgS, pressureMbar, temperature, tds]);

  // Choosing a fluid proposes the tag prefix for that service, so the naming
  // convention comes from the system rather than from memory. The tag stays
  // editable — a stream table from another engineering house arrives with its
  // own tags, and those have to be enterable as they are.
  const handleFluidTypeChange = (value: FluidType) => {
    setFluidType(value);
    setFluidChosenExplicitly(true);

    const prefix = FLUID_CODE[value];
    const trimmed = lineTag.trim();
    // Only rewrite a tag that is empty or is still just another service's
    // prefix. Anything the engineer has actually typed is left alone.
    const isUntouched =
      trimmed === '' || Object.values(FLUID_CODE).some((code) => trimmed === `${code}-`);
    if (isUntouched) {
      setLineTag(`${prefix}-`);
    }
  };

  // Infer the fluid from a typed tag, unless the engineer has already stated it
  const handleLineTagChange = (value: string) => {
    setLineTag(value);
    if (!isEditing && !fluidChosenExplicitly && value.length >= 1) {
      const inferredType = inferFluidType(value);
      // `null` means the tag matched no known prefix. Leave the fluid on
      // whatever is currently selected so the engineer chooses it deliberately
      // — the old behaviour silently defaulted every unrecognised tag to sea
      // water, which is how feed streams ended up classified as seawater.
      if (inferredType !== null) {
        setFluidType(inferredType);
      }
    }
  };

  const resetForm = () => {
    setLineTag('');
    setDescription('');
    setFluidType('SEA WATER');
    setFluidChosenExplicitly(false);
    setFlowRateKgS('');
    setPressureMbar('');
    setTemperature('');
    setTds('');
    setFlowRateKgHr(null);
    setPressureBar(null);
    setDensity(null);
    setEnthalpy(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!lineTag.trim()) {
      setError('Line Tag is required');
      return;
    }
    if (flowRateKgS === '' || Number(flowRateKgS) <= 0) {
      setError('Flow Rate must be greater than 0');
      return;
    }
    if (pressureMbar === '' || Number(pressureMbar) <= 0) {
      setError('Pressure must be greater than 0');
      return;
    }
    if (temperature === '') {
      setError('Temperature is required');
      return;
    }
    if ((fluidType === 'SEA WATER' || fluidType === 'BRINE WATER') && tds === '') {
      setError('TDS is required for seawater/brine');
      return;
    }
    // Nothing can derive these for a fluid with no correlation, so they have to
    // be supplied. Previously the payload fell back to 1000 kg/m³ when density
    // was blank — water's density, written silently onto a gas stream.
    if (!propertiesAreComputed && density === null) {
      setError(`Density must be entered for ${fluidType} — it cannot be calculated from T and P`);
      return;
    }
    if (!propertiesAreComputed && enthalpy === null) {
      setError(`Enthalpy must be entered for ${fluidType} — it cannot be calculated from T and P`);
      return;
    }
    if (density === null) {
      setError('Density could not be calculated. Check the temperature and pressure.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const input: ProcessStreamInput = {
        lineTag: lineTag.trim(),
        description: description.trim() || undefined,
        fluidType,
        flowRateKgS: Number(flowRateKgS),
        flowRateKgHr: flowRateKgHr || Number(flowRateKgS) * 3600,
        pressureMbar: Number(pressureMbar),
        pressureBar: pressureBar || Number(pressureMbar) / 1000,
        temperature: Number(temperature),
        tds: tds !== '' ? Number(tds) : undefined,
        density,
        enthalpy: enthalpy ?? 0,
      };

      if (isEditing && stream) {
        await updateStream(projectId, stream.id, input, userId, accessCheck);
      } else {
        await createStream(projectId, input, userId, accessCheck);
      }

      onClose();
    } catch (err) {
      logger.error('Error saving stream', { error: err });
      setError('Failed to save stream. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if TDS is required
  const tdsRequired = fluidType === 'SEA WATER' || fluidType === 'BRINE WATER';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? `Edit Stream: ${stream?.lineTag}` : 'Add New Stream'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Basic Info */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Line Tag"
              value={lineTag}
              onChange={(e) => handleLineTagChange(e.target.value)}
              fullWidth
              required
              placeholder="e.g., SW1, D19, S13"
              helperText="Picking a fluid fills in its prefix; typing a tag infers the fluid until you pick one"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Fluid Type</InputLabel>
              <Select
                value={fluidType}
                onChange={(e) => handleFluidTypeChange(e.target.value as FluidType)}
                label="Fluid Type"
              >
                {FLUID_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={12}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Grid>

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Input Parameters
              </Typography>
            </Divider>
          </Grid>

          {/* Input Parameters */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Flow Rate"
              type="number"
              value={flowRateKgS}
              onChange={(e) => setFlowRateKgS(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
              }}
              inputProps={{ step: 0.001, min: 0 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Pressure"
              type="number"
              value={pressureMbar}
              onChange={(e) => setPressureMbar(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">mbar(a)</InputAdornment>,
              }}
              inputProps={{ step: 1, min: 0 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Temperature"
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">°C</InputAdornment>,
              }}
              inputProps={{ step: 0.1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="TDS"
              type="number"
              value={tds}
              onChange={(e) => setTds(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              required={tdsRequired}
              disabled={!tdsRequired}
              InputProps={{
                endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
              }}
              inputProps={{ step: 1, min: 0 }}
              helperText={tdsRequired ? 'Required for seawater/brine' : 'N/A for this fluid'}
            />
          </Grid>

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {propertiesAreComputed
                  ? 'Calculated Values (auto-updated)'
                  : 'Flow and pressure calculated — density and enthalpy must be supplied'}
              </Typography>
            </Divider>
          </Grid>

          {!propertiesAreComputed && (
            <Grid size={12}>
              <Alert severity="info" sx={{ mb: 1 }}>
                {fluidType} properties cannot be derived from temperature and pressure — they follow
                from the gas composition. Enter the density and enthalpy from the basic design or
                the gas analysis.
              </Alert>
            </Grid>
          )}

          {/* Calculated Values (Read-only display) */}
          <Grid size={{ xs: 12, sm: 3 }}>
            <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Flow Rate
              </Typography>
              <Typography variant="body1">
                {flowRateKgHr !== null ? flowRateKgHr.toFixed(1) : '-'} kg/hr
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Pressure
              </Typography>
              <Typography variant="body1">
                {pressureBar !== null ? pressureBar.toFixed(3) : '-'} bar(a)
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            {propertiesAreComputed ? (
              <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Density
                </Typography>
                <Typography variant="body1">
                  {density !== null ? density.toFixed(2) : '-'} kg/m³
                </Typography>
              </Box>
            ) : (
              <TextField
                label="Density"
                type="number"
                value={density ?? ''}
                onChange={(e) => setDensity(e.target.value ? Number(e.target.value) : null)}
                fullWidth
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
                }}
                inputProps={{ step: 0.01, min: 0 }}
                helperText="From the gas analysis"
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            {propertiesAreComputed ? (
              <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Enthalpy
                </Typography>
                <Typography variant="body1">
                  {enthalpy !== null ? enthalpy.toFixed(2) : '-'} kJ/kg
                </Typography>
              </Box>
            ) : (
              <TextField
                label="Enthalpy"
                type="number"
                value={enthalpy ?? ''}
                onChange={(e) => setEnthalpy(e.target.value ? Number(e.target.value) : null)}
                fullWidth
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">kJ/kg</InputAdornment>,
                }}
                inputProps={{ step: 0.01 }}
                helperText="From the basic design"
              />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
