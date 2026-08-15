'use client';

/**
 * Stream Form Dialog
 *
 * Create/Edit dialog for process streams.
 * Auto-calculates density and enthalpy based on fluid type.
 */

import { useState, useEffect, useMemo } from 'react';
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
import type {
  ProcessStream,
  ProcessStreamInput,
  FluidType,
  GasComposition,
  GasAnalysisBasis,
  H2SUnit,
  FlowUnit,
} from '@vapour/types';
import { FLUID_TYPES, FLOW_UNIT_LABELS } from '@vapour/types';
import { FLUID_CODE } from '@/lib/ssot/generatorHelpers';
import { createStream, updateStream } from '@/lib/ssot/streamService';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import {
  inferFluidType,
  calculateStreamProperties,
  hasPropertyCorrelations,
  requiresComposition,
  calculateCompositionProperties,
  convertFlowToKgS,
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
  const [flowValue, setFlowValue] = useState<number | ''>('');
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('KG_S');
  const [pressureMbar, setPressureMbar] = useState<number | ''>('');
  const [temperature, setTemperature] = useState<number | ''>('');
  const [tds, setTds] = useState<number | ''>('');

  // Gas analysis, for fluids whose properties follow from a composition
  const [methane, setMethane] = useState<number | ''>('');
  const [carbonDioxide, setCarbonDioxide] = useState<number | ''>('');
  const [h2s, setH2s] = useState<number | ''>('');
  const [h2sUnit, setH2sUnit] = useState<H2SUnit>('PPMV');
  const [basis, setBasis] = useState<GasAnalysisBasis>('DRY');
  const [saturated, setSaturated] = useState(true);
  const [analysisSource, setAnalysisSource] = useState('');

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
        // Rule 22: show the number the specification is written in, not the
        // mass flow it was converted to.
        setFlowValue(stream.flowInput?.value ?? stream.flowRateKgS);
        setFlowUnit(stream.flowInput?.unit ?? 'KG_S');
        setPressureMbar(stream.pressureMbar);
        setTemperature(stream.temperature);
        setTds(stream.tds || '');
        setFlowRateKgHr(stream.flowRateKgHr);
        setPressureBar(stream.pressureBar);
        setDensity(stream.density);
        setEnthalpy(stream.enthalpy);
        // Rule 22: every saved field restored, or the round trip loses it
        setMethane(stream.composition?.methaneMolPercent ?? '');
        setCarbonDioxide(stream.composition?.carbonDioxideMolPercent ?? '');
        setH2s(stream.composition?.hydrogenSulphide ?? '');
        setH2sUnit(stream.composition?.hydrogenSulphideUnit ?? 'PPMV');
        setBasis(stream.composition?.basis ?? 'DRY');
        setSaturated(stream.composition?.saturatedAtStreamTemperature ?? true);
        setAnalysisSource(stream.composition?.sourceReference ?? '');
      } else {
        // Creating new stream
        resetForm();
      }
      setError('');
    }
  }, [open, stream]);

  // Whether this repo can derive density and enthalpy from T and P alone.
  const propertiesAreComputed = hasPropertyCorrelations(fluidType);
  // Whether it can derive them once an analysis is supplied.
  const needsComposition = requiresComposition(fluidType);

  // The analysis as entered, or null while it is still incomplete. CH₄ and CO₂
  // are the minimum; H₂S may legitimately be zero on a scrubbed gas.
  const composition = useMemo<GasComposition | null>(() => {
    if (!needsComposition) return null;
    if (methane === '' || carbonDioxide === '') return null;
    return {
      methaneMolPercent: Number(methane),
      carbonDioxideMolPercent: Number(carbonDioxide),
      hydrogenSulphide: h2s === '' ? 0 : Number(h2s),
      hydrogenSulphideUnit: h2sUnit,
      basis,
      ...(basis === 'DRY' && { saturatedAtStreamTemperature: saturated }),
      ...(analysisSource.trim() && { sourceReference: analysisSource.trim() }),
    };
  }, [needsComposition, methane, carbonDioxide, h2s, h2sUnit, basis, saturated, analysisSource]);

  // Derived gas properties, plus what the resolution actually did to the
  // numbers — the normalisation and the saturation water are shown rather than
  // applied silently, because both change the density the line is sized on.
  const gasResult = useMemo(() => {
    if (!composition || temperature === '' || pressureMbar === '') return null;
    try {
      return {
        ...calculateCompositionProperties(composition, Number(temperature), Number(pressureMbar)),
        error: null as string | null,
      };
    } catch (err) {
      return {
        resolved: null,
        properties: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [composition, temperature, pressureMbar]);

  // A composition that resolved is the source of density and enthalpy; without
  // one they stay hand-entered.
  const propertiesFromComposition = !!gasResult?.properties;

  // Density without reference to the flow, because a volumetric flow cannot be
  // converted to a mass flow until the density is known — and density does not
  // depend on the flow at all. Computing it with a zero flow breaks that
  // ordering knot without inventing anything.
  const derivedDensity = useMemo(() => {
    if (pressureMbar === '' || temperature === '') return undefined;
    try {
      return calculateStreamProperties({
        fluidType,
        temperature: Number(temperature),
        pressureMbar: Number(pressureMbar),
        flowRateKgS: 0,
        tds: tds !== '' ? Number(tds) : undefined,
        composition: composition ?? undefined,
      }).density;
    } catch {
      // An out-of-range or incomplete input is normal while typing; the field
      // below simply reports that the conversion is not available yet.
      return undefined;
    }
  }, [fluidType, temperature, pressureMbar, tds, composition]);

  // The entered flow in kg/s, or null when a volumetric entry has no density
  // to convert with yet.
  const flowRateKgS = useMemo(() => {
    if (flowValue === '') return '' as const;
    const converted = convertFlowToKgS(Number(flowValue), flowUnit, {
      density: derivedDensity,
      temperatureC: temperature === '' ? undefined : Number(temperature),
      pressureMbar: pressureMbar === '' ? undefined : Number(pressureMbar),
    });
    return converted === null ? '' : converted;
  }, [flowValue, flowUnit, derivedDensity, temperature, pressureMbar]);

  const flowNeedsDensity = flowUnit === 'M3_HR' || flowUnit === 'NM3_HR';
  const flowConversionBlocked = flowValue !== '' && flowNeedsDensity && flowRateKgS === '';

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
          composition: composition ?? undefined,
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
  }, [fluidType, flowRateKgS, pressureMbar, temperature, tds, composition]);

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
    setFlowValue('');
    setFlowUnit('KG_S');
    setPressureMbar('');
    setTemperature('');
    setTds('');
    setFlowRateKgHr(null);
    setPressureBar(null);
    setDensity(null);
    setEnthalpy(null);
    setMethane('');
    setCarbonDioxide('');
    setH2s('');
    setH2sUnit('PPMV');
    setBasis('DRY');
    setSaturated(true);
    setAnalysisSource('');
  };

  const handleSubmit = async () => {
    // Validation
    if (!lineTag.trim()) {
      setError('Line Tag is required');
      return;
    }
    if (flowConversionBlocked) {
      setError(
        `A flow in ${FLOW_UNIT_LABELS[flowUnit]} needs the density to become a mass flow. ` +
          'Enter the gas analysis, or switch the unit to kg/s or kg/hr.'
      );
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
    if (!propertiesAreComputed && !propertiesFromComposition && density === null) {
      setError(`Density must be entered for ${fluidType} — it cannot be calculated from T and P`);
      return;
    }
    if (!propertiesAreComputed && !propertiesFromComposition && enthalpy === null) {
      setError(`Enthalpy must be entered for ${fluidType} — it cannot be calculated from T and P`);
      return;
    }
    if (gasResult?.error) {
      setError(gasResult.error);
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
        ...(composition && { composition }),
        ...(flowUnit !== 'KG_S' && { flowInput: { value: Number(flowValue), unit: flowUnit } }),
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
          <Grid size={{ xs: 8, sm: 3 }}>
            <TextField
              label="Flow Rate"
              type="number"
              value={flowValue}
              onChange={(e) => setFlowValue(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              required
              inputProps={{ step: flowUnit === 'KG_S' ? 0.001 : 1, min: 0 }}
              error={flowConversionBlocked}
              helperText={
                flowConversionBlocked
                  ? 'Needs density — enter the analysis'
                  : flowUnit !== 'KG_S' && flowRateKgS !== ''
                    ? `= ${Number(flowRateKgS).toFixed(4)} kg/s`
                    : ' '
              }
            />
          </Grid>
          <Grid size={{ xs: 4, sm: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                value={flowUnit}
                onChange={(e) => setFlowUnit(e.target.value as FlowUnit)}
                label="Unit"
              >
                {(Object.keys(FLOW_UNIT_LABELS) as FlowUnit[]).map((u) => (
                  <MenuItem key={u} value={u}>
                    {FLOW_UNIT_LABELS[u]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

          {needsComposition && (
            <>
              <Grid size={12}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Gas Analysis
                  </Typography>
                </Divider>
                <Alert severity="info" sx={{ mb: 1 }}>
                  {fluidType} properties follow from the composition, not from temperature and
                  pressure. Enter the analysis and density, enthalpy, Cp, viscosity and conductivity
                  are all derived from it.
                </Alert>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Methane (CH₄)"
                  type="number"
                  value={methane}
                  onChange={(e) => setMethane(e.target.value ? Number(e.target.value) : '')}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mol%</InputAdornment>,
                  }}
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Carbon Dioxide (CO₂)"
                  type="number"
                  value={carbonDioxide}
                  onChange={(e) => setCarbonDioxide(e.target.value ? Number(e.target.value) : '')}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mol%</InputAdornment>,
                  }}
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField
                  label="H₂S"
                  type="number"
                  value={h2s}
                  onChange={(e) => setH2s(e.target.value ? Number(e.target.value) : '')}
                  fullWidth
                  inputProps={{ step: h2sUnit === 'PPMV' ? 10 : 0.01, min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>H₂S unit</InputLabel>
                  <Select
                    value={h2sUnit}
                    onChange={(e) => setH2sUnit(e.target.value as H2SUnit)}
                    label="H₂S unit"
                  >
                    <MenuItem value="PPMV">ppmv</MenuItem>
                    <MenuItem value="MOL_PERCENT">mol%</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Analysis basis</InputLabel>
                  <Select
                    value={basis}
                    onChange={(e) => setBasis(e.target.value as GasAnalysisBasis)}
                    label="Analysis basis"
                  >
                    <MenuItem value="DRY">Dry — as a lab reports it</MenuItem>
                    <MenuItem value="WET">Wet — water already included</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {basis === 'DRY' && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Actual stream</InputLabel>
                    <Select
                      value={saturated ? 'SATURATED' : 'DRY_STREAM'}
                      onChange={(e) => setSaturated(e.target.value === 'SATURATED')}
                      label="Actual stream"
                    >
                      <MenuItem value="SATURATED">Saturated with water</MenuItem>
                      <MenuItem value="DRY_STREAM">Genuinely dry</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Analysis reference"
                  value={analysisSource}
                  onChange={(e) => setAnalysisSource(e.target.value)}
                  fullWidth
                  placeholder="Lab report or client document"
                />
              </Grid>

              {gasResult?.error && (
                <Grid size={12}>
                  <Alert severity="error">{gasResult.error}</Alert>
                </Grid>
              )}

              {gasResult?.resolved && gasResult.properties && (
                <Grid size={12}>
                  <Alert severity="success" icon={false}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Composition used:</strong>{' '}
                      {(gasResult.resolved.moleFractions.CH4 * 100).toFixed(2)}% CH₄,{' '}
                      {(gasResult.resolved.moleFractions.CO2 * 100).toFixed(2)}% CO₂,{' '}
                      {(gasResult.resolved.moleFractions.H2S * 100).toFixed(4)}% H₂S
                      {gasResult.resolved.waterMolPercent > 0 &&
                        `, ${gasResult.resolved.waterMolPercent.toFixed(2)}% H₂O (saturation)`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Molar mass {gasResult.properties.molarMassGmol.toFixed(2)} g/mol · Cp{' '}
                      {gasResult.properties.specificHeat.toFixed(3)} kJ/kg·K · k{' '}
                      {gasResult.properties.isentropicExponent.toFixed(3)} · µ{' '}
                      {(gasResult.properties.viscosity * 1e6).toFixed(2)} µPa·s · LHV{' '}
                      {gasResult.properties.lowerHeatingValueMJNm3.toFixed(2)} MJ/Nm³ · H₂S partial
                      pressure {gasResult.properties.h2sPartialPressureMbar.toFixed(3)} mbar
                    </Typography>
                    {gasResult.resolved.warnings.map((w) => (
                      <Typography key={w} variant="body2" sx={{ mt: 0.5 }} color="warning.main">
                        {w}
                      </Typography>
                    ))}
                  </Alert>
                </Grid>
              )}
            </>
          )}

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {propertiesAreComputed || propertiesFromComposition
                  ? 'Calculated Values (auto-updated)'
                  : 'Flow and pressure calculated — density and enthalpy must be supplied'}
              </Typography>
            </Divider>
          </Grid>

          {!propertiesAreComputed && !propertiesFromComposition && (
            <Grid size={12}>
              <Alert severity="info" sx={{ mb: 1 }}>
                No analysis entered, so density and enthalpy have to come from the basic design.
                Fill in the gas analysis above and they are derived instead.
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
            {propertiesAreComputed || propertiesFromComposition ? (
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
            {propertiesAreComputed || propertiesFromComposition ? (
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
