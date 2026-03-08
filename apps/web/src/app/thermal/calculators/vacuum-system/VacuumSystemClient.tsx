'use client';

/**
 * Vacuum System Design Calculator
 *
 * Sizes steam ejector trains and liquid ring vacuum pumps (LRVP) for
 * maintaining condenser vacuum in MED / MSF plants.
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  Air as EjectorIcon,
  Settings as LRVPIcon,
  MergeType as HybridIcon,
  Layers as TwoStageIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateVacuumSystem,
  type NCGLoadMode,
  type TrainConfig,
  type VacuumSystemResult,
  type StageResult,
} from '@/lib/thermal/vacuumSystemCalculator';
import { VacuumTrainDiagram } from './components/VacuumTrainDiagram';
import { GenerateReportDialog } from './components/GenerateReportDialog';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Component ────────────────────────────────────────────────────────────────

export default function VacuumSystemClient() {
  // Operating conditions
  const [suctionPressure, setSuctionPressure] = useState<string>('70');
  const [suctionTemperature, setSuctionTemperature] = useState<string>('39');
  const [dischargePressure, setDischargePressure] = useState<string>('1013');

  // NCG load
  const [ncgMode, setNcgMode] = useState<NCGLoadMode>('manual');
  const [dryNcgFlow, setDryNcgFlow] = useState<string>('5');
  const [systemVolume, setSystemVolume] = useState<string>('20');
  const [connectionCount, setConnectionCount] = useState<string>('50');
  const [seawaterFlow, setSeawaterFlow] = useState<string>('500');
  const [seawaterTemp, setSeawaterTemp] = useState<string>('25');
  const [salinity, setSalinity] = useState<string>('35');

  // Ejector parameters
  const [motivePressure, setMotivePressure] = useState<string>('8');
  const [coolingWaterTemp, setCoolingWaterTemp] = useState<string>('32');
  const [interCondenserApproach, setInterCondenserApproach] = useState<string>('5');

  // LRVP parameters
  const [sealWaterTemp, setSealWaterTemp] = useState<string>('32');

  // Configuration
  const [trainConfig, setTrainConfig] = useState<TrainConfig>('two_stage_ejector');
  const [designMargin, setDesignMargin] = useState<string>('10');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // ── Calculation ────────────────────────────────────────────────────────

  const result = useMemo(() => {
    setError(null);
    try {
      const pSuction = parseFloat(suctionPressure);
      const tSuction = parseFloat(suctionTemperature);
      const pDischarge = parseFloat(dischargePressure);
      if (isNaN(pSuction) || pSuction <= 0) return null;
      if (isNaN(tSuction) || tSuction < 0) return null;
      if (isNaN(pDischarge) || pDischarge <= pSuction) return null;

      const pMotive = parseFloat(motivePressure);
      if (isNaN(pMotive) || pMotive <= 0) return null;

      const margin = parseFloat(designMargin) / 100;

      return calculateVacuumSystem({
        suctionPressureMbar: pSuction,
        suctionTemperatureC: tSuction,
        dischargePressureMbar: pDischarge,
        ncgMode,
        dryNcgFlowKgH: parseFloat(dryNcgFlow) || undefined,
        systemVolumeM3: parseFloat(systemVolume) || undefined,
        connectionCount: parseInt(connectionCount, 10) || undefined,
        seawaterFlowM3h: parseFloat(seawaterFlow) || undefined,
        seawaterTemperatureC: parseFloat(seawaterTemp) || undefined,
        salinityGkg: parseFloat(salinity) || undefined,
        motivePressureBar: pMotive,
        coolingWaterTempC: parseFloat(coolingWaterTemp) || 32,
        interCondenserApproachC: parseFloat(interCondenserApproach) || 5,
        sealWaterTempC: parseFloat(sealWaterTemp) || 32,
        trainConfig,
        designMargin: isNaN(margin) ? 0.1 : margin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    suctionPressure,
    suctionTemperature,
    dischargePressure,
    ncgMode,
    dryNcgFlow,
    systemVolume,
    connectionCount,
    seawaterFlow,
    seawaterTemp,
    salinity,
    motivePressure,
    coolingWaterTemp,
    interCondenserApproach,
    sealWaterTemp,
    trainConfig,
    designMargin,
  ]);

  const allInputs = {
    suctionPressure,
    suctionTemperature,
    dischargePressure,
    ncgMode,
    dryNcgFlow,
    systemVolume,
    connectionCount,
    seawaterFlow,
    seawaterTemp,
    salinity,
    motivePressure,
    coolingWaterTemp,
    interCondenserApproach,
    sealWaterTemp,
    trainConfig,
    designMargin,
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Vacuum System Design" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Vacuum System Design
        </Typography>
        <Chip label="HEI Standards" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={2}>
        Size steam ejector trains and liquid ring vacuum pumps to maintain condenser vacuum.
      </Typography>

      {/* Train config toggle + Load button */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ mb: 3 }}
        flexWrap="wrap"
        useFlexGap
      >
        <ToggleButtonGroup
          value={trainConfig}
          exclusive
          onChange={(_e, v) => v && setTrainConfig(v)}
          size="small"
        >
          <ToggleButton value="single_ejector">
            <EjectorIcon sx={{ mr: 0.5, fontSize: 18 }} /> Single Ejector
          </ToggleButton>
          <ToggleButton value="two_stage_ejector">
            <TwoStageIcon sx={{ mr: 0.5, fontSize: 18 }} /> 2-Stage Ejector
          </ToggleButton>
          <ToggleButton value="lrvp_only">
            <LRVPIcon sx={{ mr: 0.5, fontSize: 18 }} /> LRVP Only
          </ToggleButton>
          <ToggleButton value="hybrid">
            <HybridIcon sx={{ mr: 0.5, fontSize: 18 }} /> Hybrid
          </ToggleButton>
        </ToggleButtonGroup>
        <Button startIcon={<LoadIcon />} size="small" onClick={() => setLoadDialogOpen(true)}>
          Load Saved
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* ── Left: Inputs ── */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            {/* Operating Conditions */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Operating Conditions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  label="Suction Pressure"
                  value={suctionPressure}
                  onChange={(e) => setSuctionPressure(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Condenser vent pressure"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mbar abs
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Suction Temperature"
                  value={suctionTemperature}
                  onChange={(e) => setSuctionTemperature(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Vent gas temperature"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          &deg;C
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Discharge Pressure"
                  value={dischargePressure}
                  onChange={(e) => setDischargePressure(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Atmospheric or back-pressure"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          mbar abs
                        </Typography>
                      ),
                    },
                  }}
                />
              </Stack>
            </Paper>

            {/* NCG Load */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                NCG Load
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  select
                  label="NCG Estimation Method"
                  value={ncgMode}
                  onChange={(e) => setNcgMode(e.target.value as NCGLoadMode)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="manual">Manual — Known NCG Flow</MenuItem>
                  <MenuItem value="hei_leakage">HEI — Air Leakage from System Volume</MenuItem>
                  <MenuItem value="seawater">Seawater — Dissolved Gas Release</MenuItem>
                </TextField>

                {ncgMode === 'manual' && (
                  <TextField
                    label="Dry NCG Flow"
                    value={dryNcgFlow}
                    onChange={(e) => setDryNcgFlow(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Total dry air + NCG mass flow"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            kg/h
                          </Typography>
                        ),
                      },
                    }}
                  />
                )}

                {ncgMode === 'hei_leakage' && (
                  <>
                    <TextField
                      label="System Volume"
                      value={systemVolume}
                      onChange={(e) => setSystemVolume(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Vapour-side volume of condenser + piping"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              m&sup3;
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Flanged Connections"
                      value={connectionCount}
                      onChange={(e) => setConnectionCount(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Number of flanges, joints, and penetrations"
                    />
                  </>
                )}

                {ncgMode === 'seawater' && (
                  <>
                    <TextField
                      label="Seawater Feed Flow"
                      value={seawaterFlow}
                      onChange={(e) => setSeawaterFlow(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Total seawater feed to plant"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              m&sup3;/h
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Seawater Temperature"
                      value={seawaterTemp}
                      onChange={(e) => setSeawaterTemp(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              &deg;C
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Salinity"
                      value={salinity}
                      onChange={(e) => setSalinity(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              g/kg
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Additional Air Leakage"
                      value={dryNcgFlow}
                      onChange={(e) => setDryNcgFlow(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Air leakage in addition to dissolved gas"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              kg/h
                            </Typography>
                          ),
                        },
                      }}
                    />
                  </>
                )}
              </Stack>
            </Paper>

            {/* Equipment Parameters */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Equipment Parameters
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                {trainConfig !== 'lrvp_only' && (
                  <TextField
                    label="Motive Steam Pressure"
                    value={motivePressure}
                    onChange={(e) => setMotivePressure(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="High-pressure steam supply for ejector(s)"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            bar
                          </Typography>
                        ),
                      },
                    }}
                  />
                )}
                {(trainConfig === 'two_stage_ejector' || trainConfig === 'hybrid') && (
                  <>
                    <TextField
                      label="Cooling Water Temperature"
                      value={coolingWaterTemp}
                      onChange={(e) => setCoolingWaterTemp(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="For inter-condenser"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              &deg;C
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Inter-condenser Approach"
                      value={interCondenserApproach}
                      onChange={(e) => setInterCondenserApproach(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Temperature approach above cooling water"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              &deg;C
                            </Typography>
                          ),
                        },
                      }}
                    />
                  </>
                )}
                {(trainConfig === 'lrvp_only' || trainConfig === 'hybrid') && (
                  <TextField
                    label="Seal Water Temperature"
                    value={sealWaterTemp}
                    onChange={(e) => setSealWaterTemp(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="LRVP seal water supply temperature"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            &deg;C
                          </Typography>
                        ),
                      },
                    }}
                  />
                )}
                <TextField
                  label="Design Margin"
                  value={designMargin}
                  onChange={(e) => setDesignMargin(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Safety margin on suction volume"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          %
                        </Typography>
                      ),
                    },
                  }}
                />
              </Stack>
            </Paper>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* ── Right: Results ── */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {result ? (
            <VacuumResults
              result={result}
              onReportOpen={() => setReportOpen(true)}
              onSaveOpen={() => setSaveDialogOpen(true)}
            />
          ) : (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Enter operating conditions and NCG load to size the vacuum system
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Dialogs */}
      {result && (
        <GenerateReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          result={result}
          inputs={allInputs}
        />
      )}

      <SaveCalculationDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        calculatorType="VACUUM_SYSTEM"
        inputs={allInputs}
      />

      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        calculatorType="VACUUM_SYSTEM"
        onLoad={(inputs) => {
          if (typeof inputs.suctionPressure === 'string')
            setSuctionPressure(inputs.suctionPressure);
          if (typeof inputs.suctionTemperature === 'string')
            setSuctionTemperature(inputs.suctionTemperature);
          if (typeof inputs.dischargePressure === 'string')
            setDischargePressure(inputs.dischargePressure);
          if (typeof inputs.ncgMode === 'string') setNcgMode(inputs.ncgMode as NCGLoadMode);
          if (typeof inputs.dryNcgFlow === 'string') setDryNcgFlow(inputs.dryNcgFlow);
          if (typeof inputs.systemVolume === 'string') setSystemVolume(inputs.systemVolume);
          if (typeof inputs.connectionCount === 'string')
            setConnectionCount(inputs.connectionCount);
          if (typeof inputs.seawaterFlow === 'string') setSeawaterFlow(inputs.seawaterFlow);
          if (typeof inputs.seawaterTemp === 'string') setSeawaterTemp(inputs.seawaterTemp);
          if (typeof inputs.salinity === 'string') setSalinity(inputs.salinity);
          if (typeof inputs.motivePressure === 'string') setMotivePressure(inputs.motivePressure);
          if (typeof inputs.coolingWaterTemp === 'string')
            setCoolingWaterTemp(inputs.coolingWaterTemp);
          if (typeof inputs.interCondenserApproach === 'string')
            setInterCondenserApproach(inputs.interCondenserApproach);
          if (typeof inputs.sealWaterTemp === 'string') setSealWaterTemp(inputs.sealWaterTemp);
          if (typeof inputs.trainConfig === 'string')
            setTrainConfig(inputs.trainConfig as TrainConfig);
          if (typeof inputs.designMargin === 'string') setDesignMargin(inputs.designMargin);
        }}
      />
    </Container>
  );
}

// ── Results Component ────────────────────────────────────────────────────────

const TRAIN_LABELS: Record<TrainConfig, string> = {
  single_ejector: 'Single-Stage Ejector',
  two_stage_ejector: 'Two-Stage Ejector',
  lrvp_only: 'LRVP Only',
  hybrid: 'Hybrid (Ejector + LRVP)',
};

function VacuumResults({
  result,
  onReportOpen,
  onSaveOpen,
}: {
  result: VacuumSystemResult;
  onReportOpen: () => void;
  onSaveOpen: () => void;
}) {
  return (
    <Stack spacing={3}>
      {/* Summary bar */}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          spacing={3}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <SummaryItem label="Configuration" value={TRAIN_LABELS[result.trainConfig]} />
            <SummaryItem label="Suction" value={`${result.suctionPressureMbar} mbar`} />
            <SummaryItem label="Dry NCG" value={`${result.totalDryNcgKgH} kg/h`} />
            <SummaryItem
              label="Suction Volume"
              value={`${result.designSuctionVolumeM3h} m\u00B3/h`}
            />
            {result.totalMotiveSteamKgH > 0 && (
              <SummaryItem label="Motive Steam" value={`${result.totalMotiveSteamKgH} kg/h`} />
            )}
            {result.totalPowerKW > 0 && (
              <SummaryItem label="LRVP Power" value={`${result.totalPowerKW} kW`} />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<SaveIcon />} onClick={onSaveOpen}>
              Save
            </Button>
            <Button variant="outlined" size="small" startIcon={<PdfIcon />} onClick={onReportOpen}>
              Report
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Stack spacing={1}>
          {result.warnings.map((w, i) => (
            <Alert key={i} severity="warning" variant="outlined">
              {w}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Train diagram */}
      <VacuumTrainDiagram result={result} />

      {/* Gas Load Breakdown */}
      <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.main' }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Gas Load Breakdown
        </Typography>
        <Grid container spacing={2}>
          {result.airLeakageKgH > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <SummaryItem label="Air Leakage" value={`${result.airLeakageKgH} kg/h`} />
            </Grid>
          )}
          {result.dissolvedGasKgH > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <SummaryItem label="Dissolved Gas" value={`${result.dissolvedGasKgH} kg/h`} />
            </Grid>
          )}
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem label="Total Dry NCG" value={`${result.totalDryNcgKgH} kg/h`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem label="Water Vapour" value={`${result.vapourWithNcgKgH} kg/h`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem label="Total Suction" value={`${result.totalSuctionFlowKgH} kg/h`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem
              label="Suction Volume"
              value={`${result.totalSuctionVolumeM3h} m\u00B3/h`}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem
              label={`Design Volume (+${result.designMargin * 100}%)`}
              value={`${result.designSuctionVolumeM3h} m\u00B3/h`}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <SummaryItem label="Sat. Pressure" value={`${result.satPressureAtSuctionMbar} mbar`} />
          </Grid>
        </Grid>
      </Paper>

      {/* Stage Details Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Stage</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                <Tooltip title="Suction → Discharge">
                  <span>Pressure (mbar)</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                CR
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                <Tooltip title="NCG + Vapour entering stage">
                  <span>Suction (kg/h)</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                Volume (m&sup3;/h)
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                Key Result
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.stages.map((stage) => (
              <StageRow key={stage.stageNumber} stage={stage} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Totals */}
      <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Totals
        </Typography>
        <Grid container spacing={2}>
          {result.totalMotiveSteamKgH > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <SummaryItem label="Motive Steam" value={`${result.totalMotiveSteamKgH} kg/h`} />
            </Grid>
          )}
          {result.totalCoolingWaterM3h > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <SummaryItem
                label="Cooling Water"
                value={`${result.totalCoolingWaterM3h} m\u00B3/h`}
              />
            </Grid>
          )}
          {result.totalPowerKW > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <SummaryItem label="LRVP Power" value={`${result.totalPowerKW} kW`} />
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Reference */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>References:</strong> HEI Standards for Steam Surface Condensers (air leakage),
          Huang et al. 1999 (ejector model), Ryans &amp; Roper 1986 (LRVP capacity correction),
          Weiss 1970 (dissolved gas).
          <br />
          <strong>Note:</strong> This is a preliminary sizing tool. Final equipment selection should
          be verified against manufacturer performance curves.
        </Typography>
      </Box>
    </Stack>
  );
}

// ── Stage Row ────────────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: StageResult }) {
  const typeLabel =
    stage.type === 'ejector' ? 'Steam Ejector' : stage.type === 'lrvp' ? 'LRVP' : 'Inter-Condenser';

  let keyResult = '';
  if (stage.type === 'ejector') {
    keyResult = `Ra = ${stage.entrainmentRatio}, Steam = ${stage.motiveSteamKgH} kg/h`;
  } else if (stage.type === 'lrvp') {
    keyResult = `${stage.lrvpModel}, ${stage.lrvpPowerKW} kW`;
  } else if (stage.type === 'inter_condenser') {
    keyResult = `Q = ${stage.condenserDutyKW} kW, CW = ${stage.coolingWaterM3h} m\u00B3/h`;
  }

  return (
    <TableRow
      sx={{
        bgcolor: stage.type === 'inter_condenser' ? 'action.hover' : undefined,
      }}
    >
      <TableCell>{stage.stageNumber}</TableCell>
      <TableCell>
        <Chip
          label={typeLabel}
          size="small"
          color={
            stage.type === 'ejector' ? 'primary' : stage.type === 'lrvp' ? 'secondary' : 'default'
          }
          variant="outlined"
        />
      </TableCell>
      <TableCell align="right">
        {stage.type === 'inter_condenser'
          ? `${stage.suctionPressureMbar}`
          : `${stage.suctionPressureMbar} \u2192 ${stage.dischargePressureMbar}`}
      </TableCell>
      <TableCell align="right">
        {stage.type === 'inter_condenser' ? '\u2014' : stage.compressionRatio}
      </TableCell>
      <TableCell align="right">{Math.round(stage.totalSuctionKgH * 10) / 10}</TableCell>
      <TableCell align="right">
        {stage.suctionVolumeM3h > 0 ? stage.suctionVolumeM3h : '\u2014'}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
          {keyResult}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="bold">
        {value}
      </Typography>
    </Box>
  );
}
