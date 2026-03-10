'use client';

/**
 * HTC Analysis Panel — Heat Transfer Coefficients
 *
 * Extracted from HeatTransferClient for the unified heat exchanger calculator.
 * Calculates tube-side, condensation, and overall heat transfer coefficients.
 */

import { useState, useMemo } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import {
  Save as SaveIcon,
  PictureAsPdf as PdfIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import {
  calculateTubeSideHTC,
  calculateNusseltCondensation,
  calculateOverallHTC,
} from '@/lib/thermal';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';
import dynamic from 'next/dynamic';
import {
  TubeSideInputs,
  CondensationInputs,
  OverallHTCInputs,
} from '../../heat-transfer/components';
import { HeatTransferDiagram } from '../../heat-transfer/components/HeatTransferDiagram';
import type { HeatTransferReportInputs } from '../../heat-transfer/components/HeatTransferReportPDF';

const GenerateReportDialog = dynamic(
  () =>
    import('../../heat-transfer/components/GenerateReportDialog').then((m) => ({
      default: m.GenerateReportDialog,
    })),
  { ssr: false }
);
import { SaveCalculationDialog } from '../../siphon-sizing/components/SaveCalculationDialog';
import { LoadCalculationDialog } from '../../siphon-sizing/components/LoadCalculationDialog';

type HTCConfigType = 'condensation';

interface ConfigOption {
  id: HTCConfigType | 'liquid-liquid' | 'boiling';
  label: string;
  subtitle: string;
  correlations: string;
  available: boolean;
}

const CONFIGS: ConfigOption[] = [
  {
    id: 'condensation',
    label: 'Condensation (Shell) + Forced Convection (Tube)',
    subtitle: 'Shell-and-tube condenser -- steam/vapor on shell side, cooling fluid in tubes',
    correlations: 'Dittus-Boelter \u00b7 Nusselt Film Condensation',
    available: true,
  },
  {
    id: 'liquid-liquid',
    label: 'Liquid\u2013Liquid (Shell & Tube)',
    subtitle: 'Both sides liquid phase -- shell-and-tube exchanger',
    correlations: 'Dittus-Boelter (tube) \u00b7 Bell-Delaware (shell)',
    available: false,
  },
  {
    id: 'boiling',
    label: 'Boiling / Evaporation (Shell)',
    subtitle: 'Kettle or falling-film evaporator -- boiling on shell side',
    correlations: 'Chen correlation \u00b7 Mostinski nucleate pool boiling',
    available: false,
  },
];

interface HTCAnalysisPanelProps {
  active: boolean;
}

export function HTCAnalysisPanel({ active }: HTCAnalysisPanelProps) {
  // Config type selection
  const [configType, setConfigType] = useState<HTCConfigType | null>(null);

  // Tube-side inputs
  const [tsDensity, setTsDensity] = useState<string>('');
  const [tsVelocity, setTsVelocity] = useState<string>('');
  const [tsTubeID, setTsTubeID] = useState<string>('');
  const [tsViscosity, setTsViscosity] = useState<string>('');
  const [tsSpecificHeat, setTsSpecificHeat] = useState<string>('');
  const [tsConductivity, setTsConductivity] = useState<string>('');
  const [tsIsHeating, setTsIsHeating] = useState<boolean>(false);

  // Shell-side (condensation) inputs
  const [condLiquidDensity, setCondLiquidDensity] = useState<string>('');
  const [condVaporDensity, setCondVaporDensity] = useState<string>('');
  const [condLatentHeat, setCondLatentHeat] = useState<string>('');
  const [condLiquidConductivity, setCondLiquidConductivity] = useState<string>('');
  const [condLiquidViscosity, setCondLiquidViscosity] = useState<string>('');
  const [condDimension, setCondDimension] = useState<string>('');
  const [condDeltaT, setCondDeltaT] = useState<string>('');
  const [condOrientation, setCondOrientation] = useState<'vertical' | 'horizontal'>('horizontal');

  // Tube wall & fouling inputs
  const [overallTubeOD, setOverallTubeOD] = useState<string>('');
  const [overallWallConductivity, setOverallWallConductivity] = useState<string>('');
  const [overallTubeSideFouling, setOverallTubeSideFouling] = useState<string>('0.0001');
  const [overallShellSideFouling, setOverallShellSideFouling] = useState<string>('0.0002');

  // Dialog state
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Calculations
  const tubeSideComputed = useMemo((): { result: TubeSideHTCResult | null; error: string | null } => {
    try {
      const density = parseFloat(tsDensity);
      const velocity = parseFloat(tsVelocity);
      const tubeIDmm = parseFloat(tsTubeID);
      const viscosity = parseFloat(tsViscosity);
      const specificHeat = parseFloat(tsSpecificHeat);
      const conductivity = parseFloat(tsConductivity);

      if (
        isNaN(density) ||
        density <= 0 ||
        isNaN(velocity) ||
        velocity <= 0 ||
        isNaN(tubeIDmm) ||
        tubeIDmm <= 0 ||
        isNaN(viscosity) ||
        viscosity <= 0 ||
        isNaN(specificHeat) ||
        specificHeat <= 0 ||
        isNaN(conductivity) ||
        conductivity <= 0
      )
        return { result: null, error: null };

      return {
        result: calculateTubeSideHTC({
          density,
          velocity,
          diameter: tubeIDmm / 1000,
          viscosity,
          specificHeat,
          conductivity,
          isHeating: tsIsHeating,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Tube-side calculation error' };
    }
  }, [tsDensity, tsVelocity, tsTubeID, tsViscosity, tsSpecificHeat, tsConductivity, tsIsHeating]);

  const tubeSideResult = tubeSideComputed.result;

  const condensationComputed = useMemo((): { result: CondensationHTCResult | null; error: string | null } => {
    try {
      const liquidDensity = parseFloat(condLiquidDensity);
      const vaporDensity = parseFloat(condVaporDensity);
      const latentHeat = parseFloat(condLatentHeat);
      const liquidConductivity = parseFloat(condLiquidConductivity);
      const liquidViscosity = parseFloat(condLiquidViscosity);
      const dimension = parseFloat(condDimension);
      const deltaT = parseFloat(condDeltaT);

      if (
        isNaN(liquidDensity) ||
        liquidDensity <= 0 ||
        isNaN(vaporDensity) ||
        vaporDensity <= 0 ||
        isNaN(latentHeat) ||
        latentHeat <= 0 ||
        isNaN(liquidConductivity) ||
        liquidConductivity <= 0 ||
        isNaN(liquidViscosity) ||
        liquidViscosity <= 0 ||
        isNaN(dimension) ||
        dimension <= 0 ||
        isNaN(deltaT) ||
        deltaT <= 0
      )
        return { result: null, error: null };

      return {
        result: calculateNusseltCondensation({
          liquidDensity,
          vaporDensity,
          latentHeat,
          liquidConductivity,
          liquidViscosity,
          dimension,
          deltaT,
          orientation: condOrientation,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Shell-side calculation error' };
    }
  }, [
    condLiquidDensity,
    condVaporDensity,
    condLatentHeat,
    condLiquidConductivity,
    condLiquidViscosity,
    condDimension,
    condDeltaT,
    condOrientation,
  ]);

  const condensationResult = condensationComputed.result;

  const overallComputed = useMemo((): { result: OverallHTCResult | null; error: string | null } => {
    if (!tubeSideResult || !condensationResult) return { result: null, error: null };
    try {
      const tubeODmm = parseFloat(overallTubeOD);
      const tubeIDmm = parseFloat(tsTubeID);
      const wallConductivity = parseFloat(overallWallConductivity);
      const tubeSideFouling = parseFloat(overallTubeSideFouling);
      const shellSideFouling = parseFloat(overallShellSideFouling);

      if (
        isNaN(tubeODmm) ||
        tubeODmm <= 0 ||
        isNaN(tubeIDmm) ||
        tubeIDmm <= 0 ||
        isNaN(wallConductivity) ||
        wallConductivity <= 0 ||
        isNaN(tubeSideFouling) ||
        isNaN(shellSideFouling)
      )
        return { result: null, error: null };
      if (tubeIDmm >= tubeODmm) return { result: null, error: null };

      return {
        result: calculateOverallHTC({
          tubeSideHTC: tubeSideResult.htc,
          shellSideHTC: condensationResult.htc,
          tubeOD: tubeODmm / 1000,
          tubeID: tubeIDmm / 1000,
          tubeWallConductivity: wallConductivity,
          tubeSideFouling,
          shellSideFouling,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Overall HTC calculation error' };
    }
  }, [
    tubeSideResult,
    condensationResult,
    overallTubeOD,
    tsTubeID,
    overallWallConductivity,
    overallTubeSideFouling,
    overallShellSideFouling,
  ]);

  const overallResult = overallComputed.result;
  const error = tubeSideComputed.error || condensationComputed.error || overallComputed.error;

  const hasFullResult = !!(tubeSideResult && condensationResult && overallResult);

  const savedInputs: Record<string, unknown> = {
    configType,
    tsDensity,
    tsVelocity,
    tsTubeID,
    tsViscosity,
    tsSpecificHeat,
    tsConductivity,
    tsIsHeating,
    condLiquidDensity,
    condVaporDensity,
    condLatentHeat,
    condLiquidConductivity,
    condLiquidViscosity,
    condDimension,
    condDeltaT,
    condOrientation,
    overallTubeOD,
    overallWallConductivity,
    overallTubeSideFouling,
    overallShellSideFouling,
  };

  const reportInputs: HeatTransferReportInputs = {
    tsDensity,
    tsVelocity,
    tsTubeID,
    tsViscosity,
    tsSpecificHeat,
    tsConductivity,
    tsIsHeating,
    condLiquidDensity,
    condVaporDensity,
    condLatentHeat,
    condLiquidConductivity,
    condLiquidViscosity,
    condDimension,
    condDeltaT,
    condOrientation,
    overallTubeOD,
    overallWallConductivity,
    overallTubeSideFouling,
    overallShellSideFouling,
  };

  const handleLoad = (inputs: Record<string, unknown>) => {
    if (typeof inputs.configType === 'string') setConfigType(inputs.configType as HTCConfigType);
    if (typeof inputs.tsDensity === 'string') setTsDensity(inputs.tsDensity);
    if (typeof inputs.tsVelocity === 'string') setTsVelocity(inputs.tsVelocity);
    if (typeof inputs.tsTubeID === 'string') setTsTubeID(inputs.tsTubeID);
    if (typeof inputs.tsViscosity === 'string') setTsViscosity(inputs.tsViscosity);
    if (typeof inputs.tsSpecificHeat === 'string') setTsSpecificHeat(inputs.tsSpecificHeat);
    if (typeof inputs.tsConductivity === 'string') setTsConductivity(inputs.tsConductivity);
    if (typeof inputs.tsIsHeating === 'boolean') setTsIsHeating(inputs.tsIsHeating);
    if (typeof inputs.condLiquidDensity === 'string')
      setCondLiquidDensity(inputs.condLiquidDensity);
    if (typeof inputs.condVaporDensity === 'string') setCondVaporDensity(inputs.condVaporDensity);
    if (typeof inputs.condLatentHeat === 'string') setCondLatentHeat(inputs.condLatentHeat);
    if (typeof inputs.condLiquidConductivity === 'string')
      setCondLiquidConductivity(inputs.condLiquidConductivity);
    if (typeof inputs.condLiquidViscosity === 'string')
      setCondLiquidViscosity(inputs.condLiquidViscosity);
    if (typeof inputs.condDimension === 'string') setCondDimension(inputs.condDimension);
    if (typeof inputs.condDeltaT === 'string') setCondDeltaT(inputs.condDeltaT);
    if (inputs.condOrientation === 'vertical' || inputs.condOrientation === 'horizontal')
      setCondOrientation(inputs.condOrientation);
    if (typeof inputs.overallTubeOD === 'string') setOverallTubeOD(inputs.overallTubeOD);
    if (typeof inputs.overallWallConductivity === 'string')
      setOverallWallConductivity(inputs.overallWallConductivity);
    if (typeof inputs.overallTubeSideFouling === 'string')
      setOverallTubeSideFouling(inputs.overallTubeSideFouling);
    if (typeof inputs.overallShellSideFouling === 'string')
      setOverallShellSideFouling(inputs.overallShellSideFouling);
  };

  if (!active) return null;

  return (
    <>
      {/* Configuration type selector */}
      {!configType && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Select Heat Exchanger Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Choose the type of heat transfer to calculate. Additional configurations are coming
            soon.
          </Typography>
          <Grid container spacing={2}>
            {CONFIGS.map((cfg) => (
              <Grid key={cfg.id} size={{ xs: 12, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    opacity: cfg.available ? 1 : 0.5,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {cfg.available ? (
                    <CardActionArea
                      onClick={() => setConfigType(cfg.id as HTCConfigType)}
                      sx={{ height: '100%' }}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          {cfg.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                          {cfg.subtitle}
                        </Typography>
                        <Chip
                          label={cfg.correlations}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </CardContent>
                    </CardActionArea>
                  ) : (
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {cfg.label}
                        </Typography>
                        <Chip label="Coming Soon" size="small" color="default" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {cfg.subtitle}
                      </Typography>
                      <Chip label={cfg.correlations} size="small" variant="outlined" />
                    </CardContent>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Inputs + Diagram */}
      {configType === 'condensation' && (
        <Grid container spacing={3}>
          {/* Left: unified input form */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={3}>
              <Button
                startIcon={<BackIcon />}
                onClick={() => setConfigType(null)}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Change Configuration
              </Button>

              {/* Tube Side */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Tube Side &mdash; Cold Fluid (Forced Convection)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <TubeSideInputs
                  density={tsDensity}
                  velocity={tsVelocity}
                  tubeID={tsTubeID}
                  viscosity={tsViscosity}
                  specificHeat={tsSpecificHeat}
                  conductivity={tsConductivity}
                  isHeating={tsIsHeating}
                  onDensityChange={setTsDensity}
                  onVelocityChange={setTsVelocity}
                  onTubeIDChange={setTsTubeID}
                  onViscosityChange={setTsViscosity}
                  onSpecificHeatChange={setTsSpecificHeat}
                  onConductivityChange={setTsConductivity}
                  onIsHeatingChange={setTsIsHeating}
                />
              </Paper>

              {/* Shell Side */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="error" gutterBottom>
                  Shell Side &mdash; Hot Fluid (Condensation)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <CondensationInputs
                  liquidDensity={condLiquidDensity}
                  vaporDensity={condVaporDensity}
                  latentHeat={condLatentHeat}
                  liquidConductivity={condLiquidConductivity}
                  liquidViscosity={condLiquidViscosity}
                  dimension={condDimension}
                  deltaT={condDeltaT}
                  orientation={condOrientation}
                  onLiquidDensityChange={setCondLiquidDensity}
                  onVaporDensityChange={setCondVaporDensity}
                  onLatentHeatChange={setCondLatentHeat}
                  onLiquidConductivityChange={setCondLiquidConductivity}
                  onLiquidViscosityChange={setCondLiquidViscosity}
                  onDimensionChange={setCondDimension}
                  onDeltaTChange={setCondDeltaT}
                  onOrientationChange={setCondOrientation}
                />
              </Paper>

              {/* Tube Wall & Fouling */}
              <Paper sx={{ p: 3 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  color="text.secondary"
                  gutterBottom
                >
                  Tube Wall &amp; Fouling
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <OverallHTCInputs
                  tubeSideHTC={tubeSideResult ? String(tubeSideResult.htc.toFixed(2)) : ''}
                  shellSideHTC={condensationResult ? String(condensationResult.htc.toFixed(2)) : ''}
                  tubeOD={overallTubeOD}
                  tubeID={tsTubeID}
                  wallConductivity={overallWallConductivity}
                  tubeSideFouling={overallTubeSideFouling}
                  shellSideFouling={overallShellSideFouling}
                  onTubeSideHTCChange={() => {}}
                  onShellSideHTCChange={() => {}}
                  onTubeODChange={setOverallTubeOD}
                  onTubeIDChange={() => {}}
                  onWallConductivityChange={setOverallWallConductivity}
                  onTubeSideFoulingChange={setOverallTubeSideFouling}
                  onShellSideFoulingChange={setOverallShellSideFouling}
                />
              </Paper>

              {error && (
                <Alert severity="error">
                  {error}
                </Alert>
              )}
            </Stack>
          </Grid>

          {/* Right: diagram + results */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Heat Exchanger Schematic
                </Typography>
                <HeatTransferDiagram
                  tubeSideResult={tubeSideResult}
                  condensationResult={condensationResult}
                  overallResult={overallResult}
                  orientation={condOrientation}
                />
              </Paper>

              {(tubeSideResult || condensationResult || overallResult) && (
                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Results
                    </Typography>
                    {hasFullResult && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SaveIcon />}
                          onClick={() => setSaveOpen(true)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PdfIcon />}
                          onClick={() => setReportOpen(true)}
                        >
                          PDF Report
                        </Button>
                      </Stack>
                    )}
                  </Stack>

                  <Grid container spacing={2} mb={2}>
                    {tubeSideResult && (
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Box
                          sx={{
                            bgcolor: '#e3f2fd',
                            border: '1.5px solid #1565c0',
                            borderRadius: 2,
                            p: 2,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="caption" color="primary.dark" display="block">
                            h_i &mdash; Tube Side HTC
                          </Typography>
                          <Typography variant="h6" color="primary.dark" fontWeight="bold">
                            {tubeSideResult.htc.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            W/(m&sup2;&middot;K)
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            mt={0.5}
                          >
                            Re = {tubeSideResult.reynoldsNumber.toFixed(0)} &middot; Pr ={' '}
                            {tubeSideResult.prandtlNumber.toFixed(3)}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {condensationResult && (
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Box
                          sx={{
                            bgcolor: '#ffebee',
                            border: '1.5px solid #c62828',
                            borderRadius: 2,
                            p: 2,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="caption" color="error.dark" display="block">
                            h_o &mdash; Shell Side HTC
                          </Typography>
                          <Typography variant="h6" color="error.dark" fontWeight="bold">
                            {condensationResult.htc.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            W/(m&sup2;&middot;K)
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            mt={0.5}
                          >
                            Nusselt Film ({condOrientation})
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {overallResult && (
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Box
                          sx={{
                            bgcolor: '#e8f5e9',
                            border: '1.5px solid #2e7d32',
                            borderRadius: 2,
                            p: 2,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="caption" color="success.dark" display="block">
                            U_o &mdash; Overall HTC
                          </Typography>
                          <Typography variant="h6" color="success.dark" fontWeight="bold">
                            {overallResult.overallHTC.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            W/(m&sup2;&middot;K)
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            mt={0.5}
                          >
                            Based on outer tube area
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>

                  {/* Resistance breakdown */}
                  {overallResult && (
                    <>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        gutterBottom
                        color="text.secondary"
                      >
                        Thermal Resistance Breakdown
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          {[
                            {
                              label: 'Tube-side convection (ref. OD)',
                              value: overallResult.resistances.tubeSide,
                            },
                            {
                              label: 'Tube-side fouling (ref. OD)',
                              value: overallResult.resistances.tubeSideFouling,
                            },
                            {
                              label: 'Tube wall conduction',
                              value: overallResult.resistances.tubeWall,
                            },
                            {
                              label: 'Shell-side fouling',
                              value: overallResult.resistances.shellSideFouling,
                            },
                            {
                              label: 'Shell-side convection',
                              value: overallResult.resistances.shellSide,
                            },
                          ].map((row, i) => {
                            const pct = (row.value / overallResult.resistances.total) * 100;
                            return (
                              <TableRow key={i}>
                                <TableCell
                                  sx={{ color: 'text.secondary', fontSize: '0.75rem', py: 0.5 }}
                                >
                                  {row.label}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                  {(row.value * 1000).toFixed(4)} &times;10&sup3;
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                  {pct.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5 }}>
                              Total &rarr; U_o
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5 }}
                            >
                              {(overallResult.resistances.total * 1000).toFixed(4)} &times;10&sup3;
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 'bold', fontSize: '0.75rem', py: 0.5 }}
                            >
                              100%
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Paper>
              )}

              {/* Empty state */}
              {!tubeSideResult && !condensationResult && !error && (
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'action.hover',
                    border: '2px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    Fill in the inputs on the left to see live results
                  </Typography>
                </Paper>
              )}

              {/* Correlations reference */}
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>Correlations:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    <li>
                      <strong>Dittus-Boelter (tube):</strong> Nu = 0.023 Re&#x2070;&middot;&#x2078;
                      Pr&#x207F;, h = Nu&middot;k/D
                    </li>
                    <li>
                      <strong>Nusselt Film Condensation (shell):</strong> h =
                      C&middot;[&rho;_l(&rho;_l&minus;&rho;_v)g&middot;h_fg&middot;k&sup3;/(&mu;&middot;D&middot;&Delta;T)]&#x2070;&middot;&sup2;&#x2075;
                    </li>
                    <li>
                      <strong>Overall HTC:</strong> 1/U_o = (1/h_i)(D_o/D_i) + R_fi(D_o/D_i) +
                      D_o&middot;ln(D_o/D_i)/(2k_w) + R_fo + 1/h_o
                    </li>
                  </ul>
                  <strong>References:</strong> Perry&apos;s Chemical Engineers&apos; Handbook
                  &middot; Kern&apos;s Process Heat Transfer
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Dialogs */}
      {hasFullResult && tubeSideResult && condensationResult && overallResult && (
        <GenerateReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          inputs={reportInputs}
          tubeSideResult={tubeSideResult}
          condensationResult={condensationResult}
          overallResult={overallResult}
        />
      )}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        inputs={savedInputs}
        calculatorType="HEAT_TRANSFER"
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="HEAT_TRANSFER"
        onLoad={handleLoad}
      />
    </>
  );
}
