'use client';

/**
 * Falling Film Evaporator Design Calculator
 *
 * Designs horizontal-tube falling film evaporators for MED desalination.
 * Calculates wetting rates, heat transfer coefficients, tube bundle layout,
 * and thermal performance with an SVG tube layout visualisation.
 */

import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
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
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateFallingFilm,
  validateFallingFilmInput,
  TUBE_MATERIALS,
  STANDARD_TUBE_SIZES,
  WETTING_LIMITS,
  type FallingFilmInput,
  type FallingFilmResult,
} from '@/lib/thermal/fallingFilmCalculator';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Wetting status colors ────────────────────────────────────────────────────

function getWettingColor(status: string): string {
  switch (status) {
    case 'excellent':
      return '#2e7d32';
    case 'good':
      return '#1565c0';
    case 'marginal':
      return '#f57f17';
    case 'poor':
      return '#c62828';
    default:
      return '#666';
  }
}

function getWettingBgColor(status: string): string {
  switch (status) {
    case 'excellent':
      return '#e8f5e9';
    case 'good':
      return '#e3f2fd';
    case 'marginal':
      return '#fff8e1';
    case 'poor':
      return '#ffebee';
    default:
      return '#f5f5f5';
  }
}

// ── Tube layout SVG visualisation ────────────────────────────────────────────

function TubeLayoutSVG({
  tubeLayout,
  tubesPerRow,
  tubeRows,
  pitch,
  rowSpacing,
  tubeOD,
}: {
  tubeLayout: 'triangular' | 'square';
  tubesPerRow: number;
  tubeRows: number;
  pitch: number;
  rowSpacing: number;
  tubeOD: number;
}) {
  const maxCols = Math.min(tubesPerRow, 15);
  const maxRows = Math.min(tubeRows, 8);
  const r = tubeOD / 2;

  // Scale factor to fit SVG nicely
  const margin = tubeOD * 1.2;
  const svgWidth = (maxCols - 1) * pitch + tubeOD + margin * 2;
  const svgHeight = (maxRows - 1) * rowSpacing + tubeOD + margin * 2;

  const tubes: { cx: number; cy: number; row: number }[] = [];
  for (let row = 0; row < maxRows; row++) {
    const offset = tubeLayout === 'triangular' && row % 2 === 1 ? pitch / 2 : 0;
    for (let col = 0; col < maxCols; col++) {
      const cx = margin + r + col * pitch + offset;
      const cy = margin + r + row * rowSpacing;
      tubes.push({ cx, cy, row });
    }
  }

  // Gradient colours from top (feed entry) to bottom (concentrate)
  const topColor = '#42a5f5';
  const bottomColor = '#1565c0';

  return (
    <Box sx={{ textAlign: 'center', mt: 1 }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ maxWidth: 500, maxHeight: 300 }}
      >
        <defs>
          <linearGradient id="tubeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={bottomColor} stopOpacity={0.8} />
          </linearGradient>
        </defs>

        {/* Tubes */}
        {tubes.map((t, i) => (
          <circle
            key={i}
            cx={t.cx}
            cy={t.cy}
            r={r * 0.9}
            fill="url(#tubeGrad)"
            stroke="#1565c0"
            strokeWidth={1}
          />
        ))}

        {/* Pitch dimension line (top row) */}
        {maxCols >= 2 && (
          <>
            <line
              x1={margin + r}
              y1={margin - tubeOD * 0.3}
              x2={margin + r + pitch}
              y2={margin - tubeOD * 0.3}
              stroke="#666"
              strokeWidth={0.8}
              markerStart="url(#arrowLeft)"
              markerEnd="url(#arrowRight)"
            />
            <text
              x={margin + r + pitch / 2}
              y={margin - tubeOD * 0.5}
              textAnchor="middle"
              fontSize={tubeOD * 0.35}
              fill="#666"
            >
              P = {pitch.toFixed(1)} mm
            </text>
            <defs>
              <marker
                id="arrowLeft"
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M6,0 L0,3 L6,6" fill="none" stroke="#666" strokeWidth="0.8" />
              </marker>
              <marker
                id="arrowRight"
                markerWidth="6"
                markerHeight="6"
                refX="0"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6" fill="none" stroke="#666" strokeWidth="0.8" />
              </marker>
            </defs>
          </>
        )}

        {/* Row spacing dimension line (left side) */}
        {maxRows >= 2 && (
          <>
            <line
              x1={margin * 0.3}
              y1={margin + r}
              x2={margin * 0.3}
              y2={margin + r + rowSpacing}
              stroke="#666"
              strokeWidth={0.8}
              markerStart="url(#arrowUp)"
              markerEnd="url(#arrowDown)"
            />
            <text
              x={margin * 0.15}
              y={margin + r + rowSpacing / 2}
              textAnchor="middle"
              fontSize={tubeOD * 0.3}
              fill="#666"
              transform={`rotate(-90, ${margin * 0.15}, ${margin + r + rowSpacing / 2})`}
            >
              {rowSpacing.toFixed(1)} mm
            </text>
            <defs>
              <marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
                <path d="M0,6 L3,0 L6,6" fill="none" stroke="#666" strokeWidth="0.8" />
              </marker>
              <marker
                id="arrowDown"
                markerWidth="6"
                markerHeight="6"
                refX="3"
                refY="0"
                orient="auto"
              >
                <path d="M0,0 L3,6 L6,0" fill="none" stroke="#666" strokeWidth="0.8" />
              </marker>
            </defs>
          </>
        )}

        {/* Label */}
        <text
          x={svgWidth / 2}
          y={svgHeight - margin * 0.3}
          textAnchor="middle"
          fontSize={tubeOD * 0.4}
          fill="#333"
          fontWeight="bold"
        >
          {tubeLayout === 'triangular' ? 'Triangular Pitch' : 'Square Pitch'}
        </text>
      </svg>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FallingFilmClient() {
  // Operating conditions
  const [feedFlowRate, setFeedFlowRate] = useState<string>('');
  const [feedSalinity, setFeedSalinity] = useState<string>('35000');
  const [feedTemperature, setFeedTemperature] = useState<string>('');
  const [steamTemperature, setSteamTemperature] = useState<string>('');

  // Tube geometry
  const [selectedTubeSize, setSelectedTubeSize] = useState<string>('1'); // index into STANDARD_TUBE_SIZES, or 'custom'
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [tubeID, setTubeID] = useState<string>('22.1');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [numberOfTubes, setNumberOfTubes] = useState<string>('');
  const [tubeMaterial, setTubeMaterial] = useState<string>('cu_ni_90_10');

  // Tube layout
  const [tubeLayout, setTubeLayout] = useState<'triangular' | 'square'>('triangular');
  const [pitchRatio, setPitchRatio] = useState<string>('1.25');
  const [tubeRows, setTubeRows] = useState<string>('');

  // Design parameters
  const [foulingResistance, setFoulingResistance] = useState<string>('0.00009');
  const [designMargin, setDesignMargin] = useState<string>('15');

  // Dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setFeedFlowRate('');
    setFeedSalinity('35000');
    setFeedTemperature('');
    setSteamTemperature('');
    setSelectedTubeSize('1');
    setTubeOD('25.4');
    setTubeID('22.1');
    setTubeLength('');
    setNumberOfTubes('');
    setTubeMaterial('cu_ni_90_10');
    setTubeLayout('triangular');
    setPitchRatio('1.25');
    setTubeRows('');
    setFoulingResistance('0.00009');
    setDesignMargin('15');
  };

  // Auto-set tube OD/ID when selecting a standard size
  useEffect(() => {
    if (selectedTubeSize !== 'custom') {
      const idx = parseInt(selectedTubeSize, 10);
      const size = STANDARD_TUBE_SIZES[idx];
      if (size) {
        setTubeOD(String(size.od));
        setTubeID(String(size.id));
      }
    }
  }, [selectedTubeSize]);

  // ── Main calculation ────────────────────────────────────────────────────────

  const computedResult = useMemo<{ result: FallingFilmResult | null; error: string | null }>(() => {
    try {
      const flow = parseFloat(feedFlowRate);
      const salinity = parseFloat(feedSalinity);
      const feedTemp = parseFloat(feedTemperature);
      const steamTemp = parseFloat(steamTemperature);
      const od = parseFloat(tubeOD);
      const id = parseFloat(tubeID);
      const length = parseFloat(tubeLength);
      const tubes = parseInt(numberOfTubes, 10);
      const pr = parseFloat(pitchRatio);
      const rows = parseInt(tubeRows, 10);
      const fouling = parseFloat(foulingResistance);
      const margin = parseFloat(designMargin) / 100;

      // Wait until all required fields are filled
      if (
        isNaN(flow) ||
        flow <= 0 ||
        isNaN(feedTemp) ||
        isNaN(steamTemp) ||
        isNaN(od) ||
        od <= 0 ||
        isNaN(id) ||
        id <= 0 ||
        isNaN(length) ||
        length <= 0 ||
        isNaN(tubes) ||
        tubes <= 0 ||
        isNaN(rows) ||
        rows <= 0 ||
        isNaN(pr)
      ) {
        return { result: null, error: null };
      }

      const input: FallingFilmInput = {
        feedFlowRate: flow,
        feedSalinity: isNaN(salinity) ? 35000 : salinity,
        feedTemperature: feedTemp,
        steamTemperature: steamTemp,
        tubeOD: od,
        tubeID: id,
        tubeLength: length,
        numberOfTubes: tubes,
        tubeMaterial,
        tubeLayout,
        pitchRatio: pr,
        tubeRows: rows,
        foulingResistance: isNaN(fouling) ? undefined : fouling,
        designMargin: isNaN(margin) ? undefined : margin,
      };

      // Validate first
      const validation = validateFallingFilmInput(input);
      if (!validation.isValid) {
        return { result: null, error: validation.errors.join('; ') };
      }

      const result = calculateFallingFilm(input);
      return { result, error: null };
    } catch (err: unknown) {
      return { result: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [
    feedFlowRate,
    feedSalinity,
    feedTemperature,
    steamTemperature,
    tubeOD,
    tubeID,
    tubeLength,
    numberOfTubes,
    tubeMaterial,
    tubeLayout,
    pitchRatio,
    tubeRows,
    foulingResistance,
    designMargin,
  ]);

  // Sync error state from useMemo
  useEffect(() => {
    setError(computedResult.error);
  }, [computedResult.error]);

  const calcResult = computedResult.result;

  // ── Collect inputs for report ──────────────────────────────────────────────

  const reportInputs = useMemo(
    () => ({
      feedFlowRate,
      feedSalinity,
      feedTemperature,
      steamTemperature,
      tubeOD,
      tubeID,
      tubeLength,
      numberOfTubes,
      tubeMaterial,
      tubeLayout,
      pitchRatio,
      tubeRows,
      foulingResistance,
      designMargin,
    }),
    [
      feedFlowRate,
      feedSalinity,
      feedTemperature,
      steamTemperature,
      tubeOD,
      tubeID,
      tubeLength,
      numberOfTubes,
      tubeMaterial,
      tubeLayout,
      pitchRatio,
      tubeRows,
      foulingResistance,
      designMargin,
    ]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Falling Film Evaporator" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Falling Film Evaporator Design
        </Typography>
        <Chip label="MED / Horizontal-Tube" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Wetting rate analysis, heat transfer, and tube bundle design for horizontal-tube falling
        film evaporators
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
        <Button
          startIcon={<LoadIcon />}
          size="small"
          onClick={() => setLoadOpen(true)}
        >
          Load Saved
        </Button>
        <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
          Reset
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* ── Left: Inputs ── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            {/* Operating Conditions */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Operating Conditions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  label="Feed Flow Rate"
                  value={feedFlowRate}
                  onChange={(e) => setFeedFlowRate(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          kg/s
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Feed Salinity (TDS)"
                  value={feedSalinity}
                  onChange={(e) => setFeedSalinity(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Seawater typically 35,000 ppm"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          ppm
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Feed Temperature"
                  value={feedTemperature}
                  onChange={(e) => setFeedTemperature(e.target.value)}
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
                  label="Steam Temperature"
                  value={steamTemperature}
                  onChange={(e) => setSteamTemperature(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Condensing steam temperature inside the tubes"
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
              </Stack>
            </Paper>

            {/* Tube Geometry */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Tube Geometry
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tube Size</InputLabel>
                  <Select
                    value={selectedTubeSize}
                    label="Tube Size"
                    onChange={(e) => setSelectedTubeSize(e.target.value)}
                  >
                    {STANDARD_TUBE_SIZES.map((s, i) => (
                      <MenuItem key={i} value={String(i)}>
                        {s.label}
                      </MenuItem>
                    ))}
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>

                {selectedTubeSize === 'custom' && (
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Tube OD"
                      value={tubeOD}
                      onChange={(e) => setTubeOD(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              mm
                            </Typography>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label="Tube ID"
                      value={tubeID}
                      onChange={(e) => setTubeID(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              mm
                            </Typography>
                          ),
                        },
                      }}
                    />
                  </Stack>
                )}

                {selectedTubeSize !== 'custom' && (
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      OD = {tubeOD} mm &nbsp;|&nbsp; ID = {tubeID} mm &nbsp;|&nbsp; Wall ={' '}
                      {((parseFloat(tubeOD) - parseFloat(tubeID)) / 2).toFixed(2)} mm
                    </Typography>
                  </Box>
                )}

                <TextField
                  label="Tube Length"
                  value={tubeLength}
                  onChange={(e) => setTubeLength(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          m
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Number of Tubes"
                  value={numberOfTubes}
                  onChange={(e) => setNumberOfTubes(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Tube Material</InputLabel>
                  <Select
                    value={tubeMaterial}
                    label="Tube Material"
                    onChange={(e) => setTubeMaterial(e.target.value)}
                  >
                    {Object.entries(TUBE_MATERIALS).map(([key, mat]) => (
                      <MenuItem key={key} value={key}>
                        {mat.label} ({mat.conductivity} W/(m&middot;K))
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>

            {/* Tube Layout */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Tube Layout
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Layout Pattern</InputLabel>
                  <Select
                    value={tubeLayout}
                    label="Layout Pattern"
                    onChange={(e) => setTubeLayout(e.target.value as 'triangular' | 'square')}
                  >
                    <MenuItem value="triangular">Triangular (60&deg;)</MenuItem>
                    <MenuItem value="square">Square (90&deg;)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Pitch Ratio (P/D)"
                  value={pitchRatio}
                  onChange={(e) => setPitchRatio(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Tube pitch / tube OD. Typical: 1.25 - 1.5"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          &mdash;
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Number of Tube Rows"
                  value={tubeRows}
                  onChange={(e) => setTubeRows(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Vertical rows (feed cascades over rows top to bottom)"
                />
              </Stack>
            </Paper>

            {/* Design Parameters */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Design Parameters
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  label="Fouling Resistance"
                  value={foulingResistance}
                  onChange={(e) => setFoulingResistance(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Total fouling (inside + outside). Default: 0.00009"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                          m&sup2;&middot;K/W
                        </Typography>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Design Margin"
                  value={designMargin}
                  onChange={(e) => setDesignMargin(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Extra area beyond calculated requirement. Typical: 10-20%"
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
        <Grid size={{ xs: 12, lg: 7 }}>
          {calcResult ? (
            <Stack spacing={3}>
              {/* Key results banner */}
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Results
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={() => setSaveOpen(true)}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => setReportDialogOpen(true)}
                    >
                      PDF Report
                    </Button>
                  </Stack>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2} mb={2}>
                  {[
                    {
                      label: 'Overall HTC',
                      value: calcResult.overallHTC.toFixed(1),
                      unit: 'W/(m\u00B2\u00B7K)',
                      color: '#e3f2fd',
                      border: '#1565c0',
                      text: 'primary.dark',
                    },
                    {
                      label: 'Wetting Ratio',
                      value: calcResult.wettingRatio.toFixed(2),
                      unit: `\u0393/\u0393_min (${calcResult.wettingStatus})`,
                      color: getWettingBgColor(calcResult.wettingStatus),
                      border: getWettingColor(calcResult.wettingStatus),
                      text: getWettingColor(calcResult.wettingStatus),
                    },
                    {
                      label: 'Heat Duty',
                      value: calcResult.heatDuty.toFixed(1),
                      unit: 'kW',
                      color: '#fff8e1',
                      border: '#f57f17',
                      text: 'warning.dark',
                    },
                    {
                      label: 'Evaporation Rate',
                      value: calcResult.evaporationRate.toFixed(4),
                      unit: 'kg/s',
                      color: '#e8f5e9',
                      border: '#2e7d32',
                      text: 'success.dark',
                    },
                  ].map((card) => (
                    <Grid key={card.label} size={{ xs: 6, sm: 3 }}>
                      <Box
                        sx={{
                          bgcolor: card.color,
                          border: `1.5px solid ${card.border}`,
                          borderRadius: 2,
                          p: 2,
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="caption" color={card.text} display="block">
                          {card.label}
                        </Typography>
                        <Typography variant="h6" color={card.text} fontWeight="bold">
                          {card.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {card.unit}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Wetting Analysis */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Wetting Analysis
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Actual Wetting Rate (&Gamma;)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.wettingRate.toFixed(5)} kg/(m&middot;s)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Minimum Wetting Rate (&Gamma;_min)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.minimumWettingRate.toFixed(5)} kg/(m&middot;s)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Wetting Ratio (&Gamma; / &Gamma;_min)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        <Chip
                          label={`${calcResult.wettingRatio.toFixed(2)} — ${calcResult.wettingStatus}`}
                          size="small"
                          sx={{
                            color: 'white',
                            bgcolor: getWettingColor(calcResult.wettingStatus),
                            fontWeight: 'bold',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Film Reynolds Number
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.filmReynolds.toFixed(1)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Flow Regime
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        <Chip
                          label={calcResult.flowRegime}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>Thresholds:</strong> Excellent &gt; {WETTING_LIMITS.EXCELLENT} | Good
                    &gt; {WETTING_LIMITS.GOOD} | Marginal &gt; {WETTING_LIMITS.MARGINAL} | Poor &lt;{' '}
                    {WETTING_LIMITS.MARGINAL}
                  </Typography>
                </Box>
              </Paper>

              {/* Heat Transfer */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Heat Transfer Coefficients
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Component
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Value
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Resistance
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Film HTC (outside)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.filmHTC.toFixed(1)} W/(m&sup2;&middot;K)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {(1 / calcResult.filmHTC).toExponential(3)} m&sup2;&middot;K/W
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Condensation HTC (inside)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.condensationHTC.toFixed(1)} W/(m&sup2;&middot;K)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {(1 / calcResult.condensationHTC).toExponential(3)} m&sup2;&middot;K/W
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Tube Wall
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        &mdash;
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.wallResistance.toExponential(3)} m&sup2;&middot;K/W
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Fouling
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        &mdash;
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.foulingResistance.toExponential(3)} m&sup2;&middot;K/W
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        Overall HTC (U_o)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {calcResult.overallHTC.toFixed(1)} W/(m&sup2;&middot;K)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {(1 / calcResult.overallHTC).toExponential(3)} m&sup2;&middot;K/W
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Thermal Performance */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Thermal Performance
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Boiling Point Elevation (BPE)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.boilingPointElevation.toFixed(3)} &deg;C
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Effective &Delta;T (steam - boiling)
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.effectiveTemperatureDiff.toFixed(2)} &deg;C
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Heat Duty
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.heatDuty.toFixed(1)} kW
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Evaporation Rate
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.evaporationRate.toFixed(4)} kg/s (
                        {(calcResult.evaporationRate * 3600).toFixed(1)} kg/h)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Specific Evaporation Rate
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.specificEvaporationRate.toFixed(2)} kg/(m&sup2;&middot;h)
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Tube Bundle Layout */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Tube Bundle Layout
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TubeLayoutSVG
                  tubeLayout={tubeLayout}
                  tubesPerRow={calcResult.tubesPerRow}
                  tubeRows={parseInt(tubeRows, 10)}
                  pitch={calcResult.pitch}
                  rowSpacing={calcResult.rowSpacing}
                  tubeOD={parseFloat(tubeOD)}
                />

                <Divider sx={{ my: 2 }} />

                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Tubes per Row
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.tubesPerRow}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Tube Pitch
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.pitch.toFixed(1)} mm
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Row Spacing
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.rowSpacing.toFixed(1)} mm
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Bundle Width
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.bundleWidth.toFixed(1)} mm (
                        {(calcResult.bundleWidth / 1000).toFixed(3)} m)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Bundle Height
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.bundleHeight.toFixed(1)} mm (
                        {(calcResult.bundleHeight / 1000).toFixed(3)} m)
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Design Check */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Design Check
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Installed Heat Transfer Area
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {calcResult.heatTransferArea.toFixed(2)} m&sup2;
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Design Area (with {designMargin}% margin)
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {calcResult.designArea.toFixed(2)} m&sup2;
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Excess Area
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          color:
                            calcResult.excessArea >= 0
                              ? calcResult.excessArea > 50
                                ? '#f57f17'
                                : '#2e7d32'
                              : '#c62828',
                        }}
                      >
                        {calcResult.excessArea >= 0 ? '+' : ''}
                        {calcResult.excessArea.toFixed(1)}%
                        {calcResult.excessArea < 0 && ' (UNDERSIZED)'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Warnings */}
              {calcResult.warnings.length > 0 && (
                <Stack spacing={1}>
                  {calcResult.warnings.map((w, i) => (
                    <Alert key={i} severity="warning" sx={{ py: 0 }}>
                      <Typography variant="caption">{w}</Typography>
                    </Alert>
                  ))}
                </Stack>
              )}

              {/* Reference note */}
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>Film HTC:</strong> Chun-Seban (1971) correlation for horizontal-tube
                  falling films
                  <br />
                  <strong>Condensation HTC:</strong> Nusselt (1916) horizontal tube condensation
                  model
                  <br />
                  <strong>Wetting Rate:</strong> El-Dessouky &amp; Ettouney (2002) minimum wetting
                  correlation
                  <br />
                  <strong>Seawater Properties:</strong> Sharqawy et al. (2010) thermophysical
                  correlations
                </Typography>
              </Box>
            </Stack>
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
                Enter operating conditions, tube geometry, and layout parameters to design the
                falling film evaporator
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* PDF Report Dialog */}
      {calcResult && (
        <Suspense fallback={null}>
          <GenerateReportDialog
            open={reportDialogOpen}
            onClose={() => setReportDialogOpen(false)}
            result={calcResult}
            inputs={reportInputs}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="FALLING_FILM"
        inputs={{
          feedFlowRate,
          feedSalinity,
          feedTemperature,
          steamTemperature,
          tubeOD,
          tubeID,
          tubeLength,
          numberOfTubes,
          tubeMaterial,
          tubeLayout,
          pitchRatio,
          tubeRows,
          foulingResistance,
          designMargin,
          selectedTubeSize,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="FALLING_FILM"
        onLoad={(inputs) => {
          if (typeof inputs.feedFlowRate === 'string') setFeedFlowRate(inputs.feedFlowRate);
          if (typeof inputs.feedSalinity === 'string') setFeedSalinity(inputs.feedSalinity);
          if (typeof inputs.feedTemperature === 'string')
            setFeedTemperature(inputs.feedTemperature);
          if (typeof inputs.steamTemperature === 'string')
            setSteamTemperature(inputs.steamTemperature);
          if (typeof inputs.tubeOD === 'string') setTubeOD(inputs.tubeOD);
          if (typeof inputs.tubeID === 'string') setTubeID(inputs.tubeID);
          if (typeof inputs.tubeLength === 'string') setTubeLength(inputs.tubeLength);
          if (typeof inputs.numberOfTubes === 'string') setNumberOfTubes(inputs.numberOfTubes);
          if (typeof inputs.tubeMaterial === 'string') setTubeMaterial(inputs.tubeMaterial);
          if (inputs.tubeLayout === 'triangular' || inputs.tubeLayout === 'square')
            setTubeLayout(inputs.tubeLayout);
          if (typeof inputs.pitchRatio === 'string') setPitchRatio(inputs.pitchRatio);
          if (typeof inputs.tubeRows === 'string') setTubeRows(inputs.tubeRows);
          if (typeof inputs.foulingResistance === 'string')
            setFoulingResistance(inputs.foulingResistance);
          if (typeof inputs.designMargin === 'string') setDesignMargin(inputs.designMargin);
          if (typeof inputs.selectedTubeSize === 'string')
            setSelectedTubeSize(inputs.selectedTubeSize);
        }}
      />
    </Container>
  );
}
