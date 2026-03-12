'use client';

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';

import { DEFAULT_MED_PLANT_INPUTS } from '@vapour/constants';
import type {
  MEDPlantType,
  CondensateExtraction,
  TubeMaterial,
  MEDPlantInputs,
  MEDPlantResult,
  PreheaterConfig,
} from '@vapour/types';

import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { SaveCalculationDialog } from '../components/SaveCalculationDialog';
import { LoadCalculationDialog } from '../components/LoadCalculationDialog';
import { solveMEDPlant } from '@/lib/thermal/med/medSolver';
import { sizeEquipment, type EquipmentSizingResult } from '@/lib/thermal/med/equipmentSizing';

// ============================================================================
// Constants
// ============================================================================

const PLANT_TYPE_OPTIONS: { value: MEDPlantType; label: string }[] = [
  { value: 'MED', label: 'MED (without TVC)' },
  { value: 'MED_TVC', label: 'MED-TVC' },
];

const CONDENSATE_OPTIONS: { value: CondensateExtraction; label: string }[] = [
  { value: 'FINAL_CONDENSER', label: 'From Final Condenser' },
  { value: 'FIRST_EFFECT', label: 'From 1st Effect' },
];

const TUBE_MATERIAL_OPTIONS: { value: TubeMaterial; label: string }[] = [
  { value: 'titanium', label: 'Titanium Gr.2' },
  { value: 'al_brass', label: 'Aluminium Brass' },
  { value: 'cu_ni_90_10', label: 'Cu-Ni 90/10' },
  { value: 'cu_ni_70_30', label: 'Cu-Ni 70/30' },
  { value: 'al_alloy', label: 'Aluminium Alloy' },
  { value: 'ss_316l', label: 'SS 316L' },
  { value: 'duplex_2205', label: 'Duplex 2205' },
];

const d = DEFAULT_MED_PLANT_INPUTS;

const STEP_LABELS = [
  'Plant Configuration',
  'Steam & Seawater',
  'Design Parameters',
  'Tube Specifications',
  'Advanced Options',
];

// ============================================================================
// Component
// ============================================================================

export default function MEDPlantClient() {
  // ---- Input state ----
  const [plantType, setPlantType] = useState<MEDPlantType>(d.plantType);
  const [numberOfEffects, setNumberOfEffects] = useState(String(d.numberOfEffects));
  const [preheaters, setPreheaters] = useState<PreheaterConfig[]>(d.preheaters);

  const [capacity, setCapacity] = useState(String(d.capacity));
  const [gorTarget, setGorTarget] = useState(String(d.gorTarget));

  const [steamPressure, setSteamPressure] = useState(String(d.steamPressure));
  const [steamTemperature, setSteamTemperature] = useState(String(d.steamTemperature));

  const [seawaterInletTemp, setSeawaterInletTemp] = useState(String(d.seawaterInletTemp));
  const [seawaterDischargeTemp, setSeawaterDischargeTemp] = useState(
    String(d.seawaterDischargeTemp)
  );
  const [seawaterSalinity, setSeawaterSalinity] = useState(String(d.seawaterSalinity));

  const [topBrineTemp, setTopBrineTemp] = useState(String(d.topBrineTemp));
  const [brineConcentrationFactor, setBrineConcentrationFactor] = useState(
    String(d.brineConcentrationFactor)
  );
  const [condenserApproachTemp, setCondenserApproachTemp] = useState(
    String(d.condenserApproachTemp)
  );
  const [distillateTemp, setDistillateTemp] = useState(String(d.distillateTemp));
  const [condensateExtraction, setCondensateExtraction] = useState<CondensateExtraction>(
    d.condensateExtraction
  );
  const [foulingFactor, setFoulingFactor] = useState(String(d.foulingFactor));

  const [evapTubeOd, setEvapTubeOd] = useState(String(d.evaporatorTubes.od));
  const [evapTubeThickness, setEvapTubeThickness] = useState(String(d.evaporatorTubes.thickness));
  const [evapTubeLength, setEvapTubeLength] = useState(String(d.evaporatorTubes.length));
  const [evapTubeMaterial, setEvapTubeMaterial] = useState<TubeMaterial>(
    d.evaporatorTubes.material
  );

  const [condTubeOd, setCondTubeOd] = useState(String(d.condenserTubes.od));
  const [condTubeThickness, setCondTubeThickness] = useState(String(d.condenserTubes.thickness));
  const [condTubeLength, setCondTubeLength] = useState(String(d.condenserTubes.length));
  const [condTubeMaterial, setCondTubeMaterial] = useState<TubeMaterial>(d.condenserTubes.material);

  // TVC parameters
  const [tvcMotivePressure, setTvcMotivePressure] = useState('3');
  const [tvcEntrainedEffect, setTvcEntrainedEffect] = useState('');

  // Brine recirculation
  const [brineRecirculation, setBrineRecirculation] = useState(false);

  // Stepper state
  const [activeStep, setActiveStep] = useState(0);

  // ---- Dialog state ----
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // ---- Build inputs object ----
  const inputs: MEDPlantInputs | null = useMemo(() => {
    const n = parseInt(numberOfEffects);
    const cap = parseFloat(capacity);
    const gor = parseFloat(gorTarget);
    const sp = parseFloat(steamPressure);
    const st = parseFloat(steamTemperature);

    if ([n, cap, gor, sp, st].some((v) => isNaN(v) || v <= 0)) return null;

    return {
      plantType,
      numberOfEffects: n,
      preheaters,
      capacity: cap,
      gorTarget: gor,
      steamPressure: sp,
      steamTemperature: st,
      seawaterInletTemp: parseFloat(seawaterInletTemp) || 30,
      seawaterDischargeTemp: parseFloat(seawaterDischargeTemp) || 35,
      seawaterSalinity: parseFloat(seawaterSalinity) || 35000,
      topBrineTemp: parseFloat(topBrineTemp) || 55,
      brineConcentrationFactor: parseFloat(brineConcentrationFactor) || 1.5,
      condenserApproachTemp: parseFloat(condenserApproachTemp) || 2.6,
      distillateTemp: parseFloat(distillateTemp) || 37.6,
      condensateExtraction,
      foulingFactor: parseFloat(foulingFactor) || 0.00015,
      evaporatorTubes: {
        od: parseFloat(evapTubeOd) || 25.4,
        thickness: parseFloat(evapTubeThickness) || 1,
        length: parseFloat(evapTubeLength) || 1.2,
        material: evapTubeMaterial,
      },
      condenserTubes: {
        od: parseFloat(condTubeOd) || 17,
        thickness: parseFloat(condTubeThickness) || 0.4,
        length: parseFloat(condTubeLength) || 4,
        material: condTubeMaterial,
      },
      brineRecirculation,
      ...(plantType === 'MED_TVC' && {
        tvcMotivePressure: parseFloat(tvcMotivePressure) || 3,
        tvcEntrainedEffect: tvcEntrainedEffect ? parseInt(tvcEntrainedEffect) : undefined,
      }),
    };
  }, [
    plantType,
    numberOfEffects,
    preheaters,
    capacity,
    gorTarget,
    steamPressure,
    steamTemperature,
    seawaterInletTemp,
    seawaterDischargeTemp,
    seawaterSalinity,
    topBrineTemp,
    brineConcentrationFactor,
    condenserApproachTemp,
    distillateTemp,
    condensateExtraction,
    foulingFactor,
    evapTubeOd,
    evapTubeThickness,
    evapTubeLength,
    evapTubeMaterial,
    condTubeOd,
    condTubeThickness,
    condTubeLength,
    condTubeMaterial,
    brineRecirculation,
    tvcMotivePressure,
    tvcEntrainedEffect,
  ]);

  // ---- Solve ----
  const computed = useMemo<{ result: MEDPlantResult | null; error: string | null }>(() => {
    if (!inputs) return { result: null, error: null };
    try {
      return { result: solveMEDPlant(inputs), error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [inputs]);

  const { result, error } = computed;

  // ---- Equipment sizing (computed from H&M balance) ----
  const equipmentSizing = useMemo<EquipmentSizingResult | null>(() => {
    if (!result || !inputs) return null;
    try {
      return sizeEquipment(result.effects, result.finalCondenser, result.preheaters, inputs);
    } catch {
      return null;
    }
  }, [result, inputs]);

  // ---- Preheater management ----
  const addPreheater = useCallback(() => {
    const n = parseInt(numberOfEffects) || 8;
    // Find a free even-numbered effect
    const usedEffects = new Set(preheaters.map((p) => p.effectNumber));
    for (let e = 2; e <= n; e += 2) {
      if (!usedEffects.has(e)) {
        setPreheaters((prev) => [...prev, { effectNumber: e, vaporFlow: 75 }]);
        return;
      }
    }
  }, [numberOfEffects, preheaters]);

  const removePreheater = useCallback((idx: number) => {
    setPreheaters((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updatePreheater = useCallback(
    (idx: number, field: keyof PreheaterConfig, value: string) => {
      setPreheaters((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, [field]: parseFloat(value) || 0 } : p))
      );
    },
    []
  );

  // ---- Reset ----
  const handleReset = useCallback(() => {
    setPlantType(d.plantType);
    setNumberOfEffects(String(d.numberOfEffects));
    setPreheaters(d.preheaters);
    setCapacity(String(d.capacity));
    setGorTarget(String(d.gorTarget));
    setSteamPressure(String(d.steamPressure));
    setSteamTemperature(String(d.steamTemperature));
    setSeawaterInletTemp(String(d.seawaterInletTemp));
    setSeawaterDischargeTemp(String(d.seawaterDischargeTemp));
    setSeawaterSalinity(String(d.seawaterSalinity));
    setTopBrineTemp(String(d.topBrineTemp));
    setBrineConcentrationFactor(String(d.brineConcentrationFactor));
    setCondenserApproachTemp(String(d.condenserApproachTemp));
    setDistillateTemp(String(d.distillateTemp));
    setCondensateExtraction(d.condensateExtraction);
    setFoulingFactor(String(d.foulingFactor));
    setBrineRecirculation(false);
    setTvcMotivePressure('3');
    setTvcEntrainedEffect('');
    setActiveStep(0);
  }, []);

  // ---- Load callback ----
  const handleLoad = useCallback((saved: Record<string, unknown>) => {
    if (typeof saved.plantType === 'string') setPlantType(saved.plantType as MEDPlantType);
    if (saved.numberOfEffects != null) setNumberOfEffects(String(saved.numberOfEffects));
    if (Array.isArray(saved.preheaters)) setPreheaters(saved.preheaters as PreheaterConfig[]);
    if (saved.capacity != null) setCapacity(String(saved.capacity));
    if (saved.gorTarget != null) setGorTarget(String(saved.gorTarget));
    if (saved.steamPressure != null) setSteamPressure(String(saved.steamPressure));
    if (saved.steamTemperature != null) setSteamTemperature(String(saved.steamTemperature));
    if (saved.seawaterInletTemp != null) setSeawaterInletTemp(String(saved.seawaterInletTemp));
    if (saved.seawaterDischargeTemp != null)
      setSeawaterDischargeTemp(String(saved.seawaterDischargeTemp));
    if (saved.seawaterSalinity != null) setSeawaterSalinity(String(saved.seawaterSalinity));
    if (saved.topBrineTemp != null) setTopBrineTemp(String(saved.topBrineTemp));
    if (saved.brineConcentrationFactor != null)
      setBrineConcentrationFactor(String(saved.brineConcentrationFactor));
    if (saved.condenserApproachTemp != null)
      setCondenserApproachTemp(String(saved.condenserApproachTemp));
    if (saved.distillateTemp != null) setDistillateTemp(String(saved.distillateTemp));
    if (typeof saved.condensateExtraction === 'string')
      setCondensateExtraction(saved.condensateExtraction as CondensateExtraction);
    if (saved.foulingFactor != null) setFoulingFactor(String(saved.foulingFactor));
    if (typeof saved.brineRecirculation === 'boolean')
      setBrineRecirculation(saved.brineRecirculation);
    if (saved.tvcMotivePressure != null) setTvcMotivePressure(String(saved.tvcMotivePressure));
    if (saved.tvcEntrainedEffect != null) setTvcEntrainedEffect(String(saved.tvcEntrainedEffect));
  }, []);

  // ---- Collect all inputs for save ----
  const allInputsForSave: Record<string, unknown> = {
    plantType,
    numberOfEffects,
    preheaters,
    capacity,
    gorTarget,
    steamPressure,
    steamTemperature,
    seawaterInletTemp,
    seawaterDischargeTemp,
    seawaterSalinity,
    topBrineTemp,
    brineConcentrationFactor,
    condenserApproachTemp,
    distillateTemp,
    condensateExtraction,
    foulingFactor,
    brineRecirculation,
    tvcMotivePressure,
    tvcEntrainedEffect,
  };

  // ---- Stepper navigation ----
  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  // ---- Render ----
  return (
    <Box>
      <CalculatorBreadcrumb calculatorName="MED Plant Design" />

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* ---- INPUT COLUMN ---- */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="h6">Design Inputs</Typography>
              <Box>
                <Tooltip title="Load saved">
                  <IconButton size="small" onClick={() => setLoadOpen(true)}>
                    <FolderOpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reset defaults">
                  <IconButton size="small" onClick={handleReset}>
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Stepper activeStep={activeStep} orientation="vertical" nonLinear>
              {/* Step 1: Plant Configuration */}
              <Step completed={false}>
                <StepLabel onClick={() => setActiveStep(0)} sx={{ cursor: 'pointer' }}>
                  {STEP_LABELS[0]}
                </StepLabel>
                <StepContent>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Plant Type"
                        value={plantType}
                        onChange={(e) => setPlantType(e.target.value as MEDPlantType)}
                      >
                        {PLANT_TYPE_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Number of Effects"
                        type="number"
                        value={numberOfEffects}
                        onChange={(e) => setNumberOfEffects(e.target.value)}
                        inputProps={{ min: 2, max: 16, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Capacity (T/h)"
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        inputProps={{ min: 0.5, step: 0.5 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="GOR Target"
                        type="number"
                        value={gorTarget}
                        onChange={(e) => setGorTarget(e.target.value)}
                        inputProps={{ min: 2, max: 16, step: 0.5 }}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NavigateNextIcon />}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 2: Steam & Seawater */}
              <Step completed={false}>
                <StepLabel onClick={() => setActiveStep(1)} sx={{ cursor: 'pointer' }}>
                  {STEP_LABELS[1]}
                </StepLabel>
                <StepContent>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Steam Conditions
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Pressure (bar abs)"
                        type="number"
                        value={steamPressure}
                        onChange={(e) => setSteamPressure(e.target.value)}
                        inputProps={{ min: 0.05, step: 0.01 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Temperature (°C)"
                        type="number"
                        value={steamTemperature}
                        onChange={(e) => setSteamTemperature(e.target.value)}
                        inputProps={{ step: 0.1 }}
                      />
                    </Grid>
                  </Grid>

                  {plantType === 'MED_TVC' && (
                    <>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 2, mb: 1, display: 'block' }}
                      >
                        TVC Parameters
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Motive Steam (bar abs)"
                            type="number"
                            value={tvcMotivePressure}
                            onChange={(e) => setTvcMotivePressure(e.target.value)}
                            inputProps={{ min: 1, max: 45, step: 0.5 }}
                            helperText="High-pressure steam to ejector"
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Entrained Effect #"
                            type="number"
                            value={tvcEntrainedEffect}
                            onChange={(e) => setTvcEntrainedEffect(e.target.value)}
                            inputProps={{ min: 1, max: parseInt(numberOfEffects) || 16 }}
                            helperText={`Default: last effect (${numberOfEffects})`}
                          />
                        </Grid>
                      </Grid>
                    </>
                  )}

                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Seawater Conditions
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Inlet (°C)"
                        type="number"
                        value={seawaterInletTemp}
                        onChange={(e) => setSeawaterInletTemp(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Discharge (°C)"
                        type="number"
                        value={seawaterDischargeTemp}
                        onChange={(e) => setSeawaterDischargeTemp(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Salinity (ppm)"
                        type="number"
                        value={seawaterSalinity}
                        onChange={(e) => setSeawaterSalinity(e.target.value)}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleBack} startIcon={<NavigateBeforeIcon />}>
                      Back
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NavigateNextIcon />}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 3: Design Parameters */}
              <Step completed={false}>
                <StepLabel onClick={() => setActiveStep(2)} sx={{ cursor: 'pointer' }}>
                  {STEP_LABELS[2]}
                </StepLabel>
                <StepContent>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Top Brine Temp (°C)"
                        type="number"
                        value={topBrineTemp}
                        onChange={(e) => setTopBrineTemp(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Brine Conc. Factor"
                        type="number"
                        value={brineConcentrationFactor}
                        onChange={(e) => setBrineConcentrationFactor(e.target.value)}
                        inputProps={{ min: 1.1, max: 2.0, step: 0.05 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Condenser Approach (°C)"
                        type="number"
                        value={condenserApproachTemp}
                        onChange={(e) => setCondenserApproachTemp(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Distillate Temp (°C)"
                        type="number"
                        value={distillateTemp}
                        onChange={(e) => setDistillateTemp(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Condensate From"
                        value={condensateExtraction}
                        onChange={(e) =>
                          setCondensateExtraction(e.target.value as CondensateExtraction)
                        }
                      >
                        {CONDENSATE_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Fouling Factor (m²·°C/W)"
                        type="number"
                        value={foulingFactor}
                        onChange={(e) => setFoulingFactor(e.target.value)}
                        inputProps={{ step: 0.00005 }}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleBack} startIcon={<NavigateBeforeIcon />}>
                      Back
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NavigateNextIcon />}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 4: Tube Specifications */}
              <Step completed={false}>
                <StepLabel onClick={() => setActiveStep(3)} sx={{ cursor: 'pointer' }}>
                  {STEP_LABELS[3]}
                </StepLabel>
                <StepContent>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Evaporator Tubes
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="OD (mm)"
                        type="number"
                        value={evapTubeOd}
                        onChange={(e) => setEvapTubeOd(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Thk (mm)"
                        type="number"
                        value={evapTubeThickness}
                        onChange={(e) => setEvapTubeThickness(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Length (m)"
                        type="number"
                        value={evapTubeLength}
                        onChange={(e) => setEvapTubeLength(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Material"
                        value={evapTubeMaterial}
                        onChange={(e) => setEvapTubeMaterial(e.target.value as TubeMaterial)}
                      >
                        {TUBE_MATERIAL_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Condenser Tubes
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="OD (mm)"
                        type="number"
                        value={condTubeOd}
                        onChange={(e) => setCondTubeOd(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Thk (mm)"
                        type="number"
                        value={condTubeThickness}
                        onChange={(e) => setCondTubeThickness(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Length (m)"
                        type="number"
                        value={condTubeLength}
                        onChange={(e) => setCondTubeLength(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Material"
                        value={condTubeMaterial}
                        onChange={(e) => setCondTubeMaterial(e.target.value as TubeMaterial)}
                      >
                        {TUBE_MATERIAL_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleBack} startIcon={<NavigateBeforeIcon />}>
                      Back
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NavigateNextIcon />}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 5: Advanced Options */}
              <Step completed={false}>
                <StepLabel onClick={() => setActiveStep(4)} sx={{ cursor: 'pointer' }}>
                  {STEP_LABELS[4]}
                </StepLabel>
                <StepContent>
                  {/* Preheaters */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Preheaters
                    </Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={addPreheater}>
                      Add
                    </Button>
                  </Box>
                  {preheaters.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      No preheaters configured. Click Add to divert vapor from an effect.
                    </Typography>
                  )}
                  {preheaters.map((ph, idx) => (
                    <Grid container spacing={1} key={idx} sx={{ mb: 1 }} alignItems="center">
                      <Grid size={{ xs: 5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Effect #"
                          type="number"
                          value={ph.effectNumber}
                          onChange={(e) => updatePreheater(idx, 'effectNumber', e.target.value)}
                          inputProps={{
                            min: 2,
                            max: parseInt(numberOfEffects) || 16,
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Vapor %"
                          type="number"
                          value={ph.vaporFlow}
                          onChange={(e) => updatePreheater(idx, 'vaporFlow', e.target.value)}
                          inputProps={{ min: 5, max: 100, step: 5 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 2 }}>
                        <IconButton size="small" onClick={() => removePreheater(idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}

                  {/* Brine Recirculation */}
                  <Divider sx={{ my: 2 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={brineRecirculation}
                        onChange={(e) => setBrineRecirculation(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">Brine Recirculation</Typography>}
                  />
                  {brineRecirculation && equipmentSizing && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        Auto-recommended ratios per effect (targeting 1.5&times; minimum wetting
                        rate):
                      </Typography>
                      {equipmentSizing.evaporators
                        .filter((ev) => ev.recommendedRecircRatio > 1.0)
                        .map((ev) => (
                          <Typography key={ev.effectNumber} variant="body2">
                            Effect {ev.effectNumber}: {ev.recommendedRecircRatio.toFixed(1)}&times;{' '}
                            (tube length {ev.tubeLength} m, base wetting {ev.wettingRate.toFixed(4)}{' '}
                            kg/(m&middot;s))
                          </Typography>
                        ))}
                      {equipmentSizing.evaporators.every(
                        (ev) => ev.recommendedRecircRatio <= 1.0
                      ) && (
                        <Typography variant="body2">
                          All effects have adequate wetting rate — no recirculation needed.
                        </Typography>
                      )}
                    </Alert>
                  )}
                  {!brineRecirculation &&
                    equipmentSizing &&
                    equipmentSizing.evaporators.some((ev) => ev.wettingStatus === 'poor') && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          Poor wetting rate detected. Enable brine recirculation to improve tube
                          wetting.
                        </Typography>
                      </Alert>
                    )}

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleBack} startIcon={<NavigateBeforeIcon />}>
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>

            {/* Save button */}
            {result && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveOpen(true)}
                >
                  Save
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* ---- RESULTS COLUMN ---- */}
        <Grid size={{ xs: 12, md: 7 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <>
              {/* Performance Summary */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Performance Summary
                </Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'GOR', value: result.performance.gor, unit: '' },
                    {
                      label: 'Net Production',
                      value: result.performance.netProduction,
                      unit: 'T/h',
                    },
                    {
                      label: result.tvcResult ? 'Motive Steam' : 'Steam Flow',
                      value: result.performance.steamFlow.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'STE',
                      value: result.performance.specificThermalEnergy,
                      unit: 'kJ/kg',
                    },
                    {
                      label: 'STE',
                      value: result.performance.specificThermalEnergy_kWh,
                      unit: 'kWh/m³',
                    },
                    {
                      label: 'Seawater Intake',
                      value: result.performance.seawaterIntake.toFixed(1),
                      unit: 'T/h',
                    },
                    {
                      label: 'Cooling Water',
                      value: result.performance.coolingWater.toFixed(1),
                      unit: 'T/h',
                    },
                    {
                      label: 'Brine Flow',
                      value: result.performance.brineFlow.toFixed(2),
                      unit: 'T/h',
                    },
                    {
                      label: 'Brine Salinity',
                      value: result.performance.brineSalinity.toLocaleString(),
                      unit: 'ppm',
                    },
                    {
                      label: 'Overdesign',
                      value: (result.performance.overdesign * 100).toFixed(1),
                      unit: '%',
                    },
                  ].map((item) => (
                    <Grid size={{ xs: 6, sm: 4 }} key={item.label + item.unit}>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {item.value} {item.unit}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={result.converged ? 'Converged' : 'Not Converged'}
                    color={result.converged ? 'success' : 'warning'}
                    size="small"
                  />
                  <Chip label={`${result.iterations} iterations`} size="small" variant="outlined" />
                  <Chip
                    label={`Energy balance: ${result.overallBalance.energyBalanceError.toFixed(2)}%`}
                    size="small"
                    variant="outlined"
                    color={result.overallBalance.energyBalanceError < 1 ? 'success' : 'warning'}
                  />
                </Box>
              </Paper>

              {/* TVC Results */}
              {result.tvcResult && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    TVC Ejector Performance
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      {
                        label: 'Motive Steam',
                        value: result.tvcResult.motiveFlow.toFixed(0),
                        unit: 'kg/hr',
                      },
                      {
                        label: 'Entrained Vapor',
                        value: result.tvcResult.entrainedFlow.toFixed(0),
                        unit: 'kg/hr',
                      },
                      {
                        label: 'Discharge Flow',
                        value: result.tvcResult.dischargeFlow.toFixed(0),
                        unit: 'kg/hr',
                      },
                      {
                        label: 'Entrainment Ratio',
                        value: result.tvcResult.entrainmentRatio.toFixed(3),
                        unit: '',
                      },
                      {
                        label: 'Compression Ratio',
                        value: result.tvcResult.compressionRatio.toFixed(3),
                        unit: '',
                      },
                      {
                        label: 'Vapor to Eff. 1',
                        value: result.tvcResult.vaporToEffect1Temp.toFixed(1),
                        unit: '°C',
                      },
                      {
                        label: 'Superheated',
                        value: result.tvcResult.isSuperheated ? 'Yes' : 'No',
                        unit: '',
                      },
                      ...(result.tvcResult.sprayWaterFlow > 0
                        ? [
                            {
                              label: 'Desuperheating Spray',
                              value: result.tvcResult.sprayWaterFlow.toFixed(0),
                              unit: 'kg/hr',
                            },
                          ]
                        : []),
                    ].map((item) => (
                      <Grid size={{ xs: 6, sm: 4 }} key={item.label}>
                        <Typography variant="caption" color="text.secondary">
                          {item.label}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {item.value} {item.unit}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {result.warnings.map((w, i) => (
                    <Typography key={i} variant="body2">
                      {w}
                    </Typography>
                  ))}
                </Alert>
              )}

              {/* Effect-by-Effect H&M Balance */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Effect-by-Effect Heat &amp; Mass Balance
                </Typography>
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell>Unit</TableCell>
                        {result.effects.map((eff) => (
                          <TableCell key={eff.effectNumber} align="right">
                            Effect {eff.effectNumber}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Effect Temperature</TableCell>
                        <TableCell>&deg;C</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.temperature.toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>BPE</TableCell>
                        <TableCell>&deg;C</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.bpe.toFixed(3)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Effective &Delta;T</TableCell>
                        <TableCell>&deg;C</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.effectiveDeltaT.toFixed(3)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell>Vapor In</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.vaporIn.flow.toFixed(0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Feed Water In</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.sprayWater.flow.toFixed(0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell>Vapor Out</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.vaporOut.flow.toFixed(0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {result.effects.some((e) => e.vaporToPreheater) && (
                        <TableRow>
                          <TableCell>Vapor to Preheater</TableCell>
                          <TableCell>kg/hr</TableCell>
                          {result.effects.map((e) => (
                            <TableCell key={e.effectNumber} align="right">
                              {e.vaporToPreheater ? e.vaporToPreheater.flow.toFixed(0) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell>Brine Out</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.brineOut.flow.toFixed(0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Distillate Out</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.distillateOut.flow.toFixed(0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell>Heat Transferred</TableCell>
                        <TableCell>kW</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.heatTransferred.toFixed(1)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Mass Balance</TableCell>
                        <TableCell>kg/hr</TableCell>
                        {result.effects.map((e) => (
                          <TableCell key={e.effectNumber} align="right">
                            {e.massBalance.toFixed(1)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Equipment Sizing */}
              {equipmentSizing && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Equipment Sizing
                  </Typography>

                  {/* Evaporator sizing table */}
                  <Typography variant="subtitle2" gutterBottom>
                    Evaporator Effects
                  </Typography>
                  <TableContainer sx={{ mb: 2 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Parameter</TableCell>
                          <TableCell>Unit</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              Effect {ev.effectNumber}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>Heat Duty</TableCell>
                          <TableCell>kW</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.heatDuty.toFixed(1)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell>Overall U</TableCell>
                          <TableCell>W/(m&sup2;&middot;K)</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.overallHTC.toFixed(0)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell>Design Area</TableCell>
                          <TableCell>m&sup2;</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.designArea.toFixed(1)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell>Tube Count</TableCell>
                          <TableCell>-</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.tubeCount}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell>Bundle Dia.</TableCell>
                          <TableCell>mm</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.bundleDiameter}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell>
                            Wetting Rate
                            {brineRecirculation && (
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                (with recirc.)
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>kg/(m&middot;s)</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              <Box
                                component="span"
                                sx={{
                                  color:
                                    ev.wettingStatus === 'poor'
                                      ? 'error.main'
                                      : ev.wettingStatus === 'marginal'
                                        ? 'warning.main'
                                        : 'success.main',
                                }}
                              >
                                {(brineRecirculation
                                  ? ev.wettingRateWithRecirc
                                  : ev.wettingRate
                                ).toFixed(4)}
                              </Box>
                              {brineRecirculation && ev.recommendedRecircRatio > 1.0 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  {ev.recommendedRecircRatio.toFixed(1)}&times; recirc.
                                </Typography>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell>Demister Area</TableCell>
                          <TableCell>m&sup2;</TableCell>
                          {equipmentSizing.evaporators.map((ev) => (
                            <TableCell key={ev.effectNumber} align="right">
                              {ev.demisterArea.toFixed(2)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Rognoni Reference Comparison — Evaporators */}
                  <Accordion sx={{ mb: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        Reference Comparison (Dr. Rognoni Assumptions)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 1, display: 'block' }}
                      >
                        Compares our first-principles calculations with Dr. Rognoni&apos;s typical
                        fixed assumptions. Deviation shows how our computed value differs from the
                        reference.
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Parameter</TableCell>
                              <TableCell>Unit</TableCell>
                              {equipmentSizing.evaporators.map((ev) => (
                                <TableCell key={ev.effectNumber} align="right" colSpan={1}>
                                  Eff. {ev.effectNumber}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {equipmentSizing.evaporators[0]?.rognoniComparisons.map((comp, idx) => (
                              <TableRow
                                key={comp.label}
                                sx={idx % 2 === 0 ? { backgroundColor: 'action.hover' } : undefined}
                              >
                                <TableCell>{comp.label}</TableCell>
                                <TableCell>{comp.unit}</TableCell>
                                {equipmentSizing.evaporators.map((ev) => {
                                  const c = ev.rognoniComparisons[idx];
                                  if (!c)
                                    return (
                                      <TableCell key={ev.effectNumber} align="right">
                                        -
                                      </TableCell>
                                    );
                                  return (
                                    <TableCell key={ev.effectNumber} align="right">
                                      <Tooltip
                                        title={`Rognoni ref: ${c.rognoniRef.toFixed(1)} ${c.unit} | Deviation: ${c.deviation > 0 ? '+' : ''}${c.deviation.toFixed(1)}%`}
                                        arrow
                                      >
                                        <Box component="span">
                                          <Typography
                                            variant="body2"
                                            component="span"
                                            fontWeight="bold"
                                          >
                                            {c.calculated.toFixed(1)}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            component="span"
                                            sx={{
                                              ml: 0.5,
                                              color:
                                                Math.abs(c.deviation) > 20
                                                  ? 'warning.main'
                                                  : 'text.secondary',
                                            }}
                                          >
                                            ({c.rognoniRef.toFixed(0)})
                                          </Typography>
                                        </Box>
                                      </Tooltip>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        Format: <strong>Calculated</strong> (Rognoni Ref). Hover for deviation %.
                      </Typography>

                      {/* Condenser Rognoni comparison */}
                      {equipmentSizing.condenser.rognoniComparisons.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Final Condenser
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Parameter</TableCell>
                                  <TableCell>Unit</TableCell>
                                  <TableCell align="right">Calculated</TableCell>
                                  <TableCell align="right">Rognoni Ref</TableCell>
                                  <TableCell align="right">Deviation</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {equipmentSizing.condenser.rognoniComparisons.map((c, idx) => (
                                  <TableRow
                                    key={c.label}
                                    sx={
                                      idx % 2 === 0
                                        ? { backgroundColor: 'action.hover' }
                                        : undefined
                                    }
                                  >
                                    <TableCell>{c.label}</TableCell>
                                    <TableCell>{c.unit}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                      {c.calculated.toFixed(1)}
                                    </TableCell>
                                    <TableCell align="right">{c.rognoniRef.toFixed(1)}</TableCell>
                                    <TableCell
                                      align="right"
                                      sx={{
                                        color:
                                          Math.abs(c.deviation) > 20
                                            ? 'warning.main'
                                            : 'text.secondary',
                                      }}
                                    >
                                      {c.deviation > 0 ? '+' : ''}
                                      {c.deviation.toFixed(1)}%
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* Totals summary */}
                  <Grid container spacing={2} sx={{ mb: 1 }}>
                    {[
                      {
                        label: 'Total Evaporator Area',
                        value: equipmentSizing.totalEvaporatorArea.toFixed(1),
                        unit: 'm²',
                      },
                      {
                        label: 'Condenser Area',
                        value: equipmentSizing.totalCondenserArea.toFixed(1),
                        unit: 'm²',
                      },
                      {
                        label: 'Preheater Area',
                        value: equipmentSizing.totalPreheaterArea.toFixed(1),
                        unit: 'm²',
                      },
                      {
                        label: 'Grand Total Area',
                        value: equipmentSizing.grandTotalArea.toFixed(1),
                        unit: 'm²',
                      },
                      {
                        label: 'Condenser Tubes',
                        value: String(equipmentSizing.condenser.tubeCount),
                        unit: '',
                      },
                      {
                        label: 'Condenser Shell ID',
                        value: String(equipmentSizing.condenser.shellID),
                        unit: 'mm',
                      },
                      {
                        label: 'SW Tube Velocity',
                        value: equipmentSizing.condenser.tubeVelocity.toFixed(2),
                        unit: 'm/s',
                      },
                    ].map((item) => (
                      <Grid size={{ xs: 6, sm: 3 }} key={item.label}>
                        <Typography variant="caption" color="text.secondary">
                          {item.label}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {item.value} {item.unit}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>

                  {equipmentSizing.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {equipmentSizing.warnings.map((w, i) => (
                        <Typography key={i} variant="body2">
                          {w}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                </Paper>
              )}

              {/* Overall Balance */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Overall Plant H&amp;M Balance
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>Fluid</TableCell>
                        <TableCell align="right">Flow (kg/hr)</TableCell>
                        <TableCell align="right">Temp (&deg;C)</TableCell>
                        <TableCell align="right">Enthalpy (kJ/kg)</TableCell>
                        <TableCell align="right">Energy (kW)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell rowSpan={2}>
                          <strong>In</strong>
                        </TableCell>
                        <TableCell>Sea Water</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.seawater.flow.toFixed(0)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.seawater.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.seawater.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.seawater.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell>Steam</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.steam.flow.toFixed(0)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.steam.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.steam.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalIn.steam.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell rowSpan={4}>
                          <strong>Out</strong>
                        </TableCell>
                        <TableCell>Sea Water</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.seawater.flow.toFixed(0)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.seawater.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.seawater.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.seawater.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Distillate</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.distillate.flow.toFixed(0)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.distillate.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.distillate.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.distillate.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Brine</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.brine.flow.toFixed(0)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.brine.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.brine.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.brine.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Vent</TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.vent.flow.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.vent.temperature.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.vent.enthalpy.toFixed(1)}
                        </TableCell>
                        <TableCell align="right">
                          {result.overallBalance.totalOut.vent.energy.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Preheater Results */}
              {result.preheaters.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Preheater Results
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Effect</TableCell>
                          <TableCell align="right">Vapor (kg/hr)</TableCell>
                          <TableCell align="right">SW In (&deg;C)</TableCell>
                          <TableCell align="right">SW Out (&deg;C)</TableCell>
                          <TableCell align="right">Heat (kW)</TableCell>
                          <TableCell align="right">LMTD (&deg;C)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.preheaters.map((ph) => (
                          <TableRow key={ph.effectNumber}>
                            <TableCell>PH Effect {ph.effectNumber}</TableCell>
                            <TableCell align="right">{ph.vaporFlow.toFixed(0)}</TableCell>
                            <TableCell align="right">{ph.seawaterInletTemp.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.seawaterOutletTemp.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.heatExchanged.toFixed(1)}</TableCell>
                            <TableCell align="right">{ph.lmtd.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Final Condenser */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Final Condenser
                </Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      label: 'Seawater Flow',
                      value: result.finalCondenser.seawaterIn.flow.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Vapor In',
                      value: result.finalCondenser.vaporIn.flow.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Distillate Out',
                      value: result.finalCondenser.distillateOut.flow.toFixed(0),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Vent Out',
                      value: result.finalCondenser.ventOut.flow.toFixed(1),
                      unit: 'kg/hr',
                    },
                    {
                      label: 'Heat Transferred',
                      value: result.finalCondenser.heatTransferred.toFixed(1),
                      unit: 'kW',
                    },
                  ].map((item) => (
                    <Grid size={{ xs: 6, sm: 4 }} key={item.label}>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="body2">
                        {item.value} {item.unit}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </>
          )}

          {!result && !error && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Enter valid plant parameters to see the heat and mass balance.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="MED_PLANT"
        inputs={allInputsForSave}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="MED_PLANT"
        onLoad={handleLoad}
      />
    </Box>
  );
}
