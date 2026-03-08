'use client';

/**
 * Spray Nozzle Selection Calculator
 *
 * Two modes:
 *  1. Selection — find nozzles matching a required flow rate
 *  2. Layout — calculate nozzle grid for a tube bundle area
 *
 * Both use the Spraying Systems Co. CAT75HYD catalogue.
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
  Card,
  CardActionArea,
  CardContent,
  Tooltip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Opacity as FullConeIcon,
  BlurCircular as HollowConeIcon,
  CropSquare as SquareIcon,
  ZoomOutMap as WideIcon,
  PictureAsPdf as PdfIcon,
  Search as SelectionIcon,
  GridView as LayoutIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  selectSprayNozzles,
  calculateNozzleLayout,
  NOZZLE_CATEGORIES,
  type NozzleCategory,
  type NozzleMatch,
  type NozzleLayoutMatch,
} from '@/lib/thermal/sprayNozzleCalculator';
import { SprayNozzleDiagram } from './components/SprayNozzleDiagram';
import { NozzleLayoutDiagram } from './components/NozzleLayoutDiagram';
import { GenerateReportDialog } from './components/GenerateReportDialog';
import { GenerateLayoutReportDialog } from './components/GenerateLayoutReportDialog';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// ── Types ────────────────────────────────────────────────────────────────────

type CalculatorMode = 'selection' | 'layout';

// ── Category card config ─────────────────────────────────────────────────────

const CATEGORY_CARDS: {
  id: NozzleCategory;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'full_cone_circular',
    label: 'Full Cone — Circular',
    subtitle: 'FullJet G/H — solid cone, round impact area (43\u00B0\u201394\u00B0)',
    icon: <FullConeIcon sx={{ fontSize: 28 }} />,
  },
  {
    id: 'full_cone_wide',
    label: 'Full Cone — Wide',
    subtitle: 'FullJet G-W/H-W — wide cone, max coverage (112\u00B0\u2013125\u00B0)',
    icon: <WideIcon sx={{ fontSize: 28 }} />,
  },
  {
    id: 'full_cone_square',
    label: 'Full Cone — Square',
    subtitle: 'FullJet SQ/WSQ — square impact area for matrix layouts',
    icon: <SquareIcon sx={{ fontSize: 28 }} />,
  },
  {
    id: 'hollow_cone_circular',
    label: 'Hollow Cone — Circular',
    subtitle: 'WhirlJet AX/BX — hollow cone, fine atomisation (43\u00B0\u201391\u00B0)',
    icon: <HollowConeIcon sx={{ fontSize: 28 }} />,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SprayNozzleClient() {
  // Shared state
  const [mode, setMode] = useState<CalculatorMode>('selection');
  const [category, setCategory] = useState<NozzleCategory>('full_cone_circular');
  const [requiredFlow, setRequiredFlow] = useState<string>('');
  const [operatingPressure, setOperatingPressure] = useState<string>('3');
  const [tolerance, setTolerance] = useState<string>('25');
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [layoutReportOpen, setLayoutReportOpen] = useState(false);
  const [layoutSelectedIdx, setLayoutSelectedIdx] = useState(0);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Selection-mode state
  const [numberOfNozzles, setNumberOfNozzles] = useState<string>('1');
  const [sprayDistance, setSprayDistance] = useState<string>('');

  // Layout-mode state
  const [bundleLength, setBundleLength] = useState<string>('');
  const [bundleWidth, setBundleWidth] = useState<string>('');
  const [sprayHeight, setSprayHeight] = useState<string>('');
  const [minOverlap, setMinOverlap] = useState<string>('15');

  const config = NOZZLE_CATEGORIES[category];

  // ── Selection result ────────────────────────────────────────────────────

  const selectionResult = useMemo(() => {
    if (mode !== 'selection') return null;
    setError(null);
    try {
      const flow = parseFloat(requiredFlow);
      if (isNaN(flow) || flow <= 0) return null;
      const pressure = parseFloat(operatingPressure);
      if (isNaN(pressure) || pressure <= 0) return null;
      const nozzles = parseInt(numberOfNozzles, 10);
      if (isNaN(nozzles) || nozzles < 1) return null;
      const tol = parseFloat(tolerance) / 100;
      if (isNaN(tol) || tol <= 0) return null;
      const dist = parseFloat(sprayDistance);
      const distMm = !isNaN(dist) && dist > 0 ? dist : undefined;
      return selectSprayNozzles({
        category,
        requiredFlow: flow,
        operatingPressure: pressure,
        numberOfNozzles: nozzles,
        sprayDistance: distMm,
        tolerance: tol,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, category, requiredFlow, operatingPressure, numberOfNozzles, sprayDistance, tolerance]);

  // ── Layout result ───────────────────────────────────────────────────────

  const layoutResult = useMemo(() => {
    if (mode !== 'layout') return null;
    setError(null);
    try {
      const flow = parseFloat(requiredFlow);
      if (isNaN(flow) || flow <= 0) return null;
      const pressure = parseFloat(operatingPressure);
      if (isNaN(pressure) || pressure <= 0) return null;
      const bLen = parseFloat(bundleLength);
      if (isNaN(bLen) || bLen <= 0) return null;
      const bWid = parseFloat(bundleWidth);
      if (isNaN(bWid) || bWid <= 0) return null;
      const height = parseFloat(sprayHeight);
      if (isNaN(height) || height <= 0) return null;
      const tol = parseFloat(tolerance) / 100;
      if (isNaN(tol) || tol <= 0) return null;
      const overlap = parseFloat(minOverlap) / 100;
      if (isNaN(overlap) || overlap < 0 || overlap >= 1) return null;
      return calculateNozzleLayout({
        category,
        totalFlow: flow,
        operatingPressure: pressure,
        bundleLength: bLen,
        bundleWidth: bWid,
        sprayHeight: height,
        minOverlap: overlap,
        tolerance: tol,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    mode,
    category,
    requiredFlow,
    operatingPressure,
    bundleLength,
    bundleWidth,
    sprayHeight,
    tolerance,
    minOverlap,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Spray Nozzle Selection" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Spray Nozzle Selection
        </Typography>
        <Chip label="Spraying Systems Co." size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={2}>
        Select spray nozzles from the CAT75HYD catalogue by required flow rate and operating
        pressure.
      </Typography>

      {/* Mode toggle + Load button */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_e, v) => v && setMode(v)}
          size="small"
        >
          <ToggleButton value="selection">
            <SelectionIcon sx={{ mr: 0.5, fontSize: 18 }} /> Nozzle Selection
          </ToggleButton>
          <ToggleButton value="layout">
            <LayoutIcon sx={{ mr: 0.5, fontSize: 18 }} /> Bundle Layout
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
            {/* Nozzle category */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Nozzle Type
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {CATEGORY_CARDS.map((cat) => (
                  <Grid key={cat.id} size={{ xs: 12, sm: 6 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        border: '1.5px solid',
                        borderColor: category === cat.id ? 'primary.main' : 'divider',
                        bgcolor: category === cat.id ? 'primary.50' : 'background.paper',
                      }}
                    >
                      <CardActionArea onClick={() => setCategory(cat.id)} sx={{ p: 1.5 }}>
                        <CardContent sx={{ p: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                            <Box
                              sx={{
                                color: category === cat.id ? 'primary.main' : 'text.secondary',
                              }}
                            >
                              {cat.icon}
                            </Box>
                            <Typography variant="body2" fontWeight="bold">
                              {cat.label}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {cat.subtitle}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* Operating conditions — shared fields */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {mode === 'selection' ? 'Operating Conditions' : 'Flow & Pressure'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <TextField
                  label="Total Required Flow Rate"
                  value={requiredFlow}
                  onChange={(e) => setRequiredFlow(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          lpm
                        </Typography>
                      ),
                    },
                  }}
                />

                <TextField
                  label="Operating Pressure"
                  value={operatingPressure}
                  onChange={(e) => setOperatingPressure(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
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

                {/* Selection-mode fields */}
                {mode === 'selection' && (
                  <>
                    <TextField
                      label="Number of Nozzles"
                      value={numberOfNozzles}
                      onChange={(e) => setNumberOfNozzles(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Total flow is divided equally across nozzles"
                      slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    />

                    <TextField
                      label="Spray Distance (optional)"
                      value={sprayDistance}
                      onChange={(e) => setSprayDistance(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Distance from nozzle to target — for coverage calculation"
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
                  </>
                )}

                <TextField
                  label="Flow Tolerance"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Show nozzles within &plusmn; this % of required flow"
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

            {/* Layout-mode: bundle dimensions */}
            {mode === 'layout' && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Tube Bundle Dimensions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Bundle Length"
                    value={bundleLength}
                    onChange={(e) => setBundleLength(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Nozzles are arrayed along this dimension"
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
                    label="Bundle Width"
                    value={bundleWidth}
                    onChange={(e) => setBundleWidth(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Rows are added across this dimension"
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
                    label="Spray Height"
                    value={sprayHeight}
                    onChange={(e) => setSprayHeight(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Distance from nozzle orifice to tube bundle top"
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
                    label="Minimum Overlap"
                    value={minOverlap}
                    onChange={(e) => setMinOverlap(e.target.value)}
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Minimum overlap between adjacent nozzle coverages"
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
            )}

            {/* Spray pattern diagram (selection mode) */}
            {mode === 'selection' && (
              <SprayNozzleDiagram
                bestMatch={selectionResult?.matches[0] ?? null}
                category={category}
                sprayDistance={(() => {
                  const d = parseFloat(sprayDistance);
                  return !isNaN(d) && d > 0 ? d : undefined;
                })()}
              />
            )}

            {/* Reference info */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" component="div">
                <strong>Series:</strong> {config.seriesName}
                <br />
                <strong>Flow scaling:</strong> Q = Q_rated &times; (P / P_rated)
                <sup>{config.flowExponent}</sup>
                <br />
                <strong>Rated pressure:</strong> {config.ratedPressure} bar
                <br />
                <strong>Catalogue nozzles:</strong> {config.nozzles.length}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* ── Right: Results ── */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {mode === 'selection' ? (
            <SelectionResults
              result={selectionResult}
              requiredFlow={requiredFlow}
              tolerance={tolerance}
              config={config}
              onReportOpen={() => setReportOpen(true)}
              onSaveOpen={() => setSaveDialogOpen(true)}
            />
          ) : (
            <LayoutResults
              result={layoutResult}
              category={category}
              bundleLength={parseFloat(bundleLength)}
              bundleWidth={parseFloat(bundleWidth)}
              sprayHeight={parseFloat(sprayHeight)}
              onReportOpen={(idx) => {
                setLayoutSelectedIdx(idx);
                setLayoutReportOpen(true);
              }}
              onSaveOpen={() => setSaveDialogOpen(true)}
            />
          )}
        </Grid>
      </Grid>

      {/* PDF Report Dialog — Selection mode */}
      {selectionResult && selectionResult.matches.length > 0 && (
        <GenerateReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          result={selectionResult}
          inputs={{
            category,
            requiredFlow,
            operatingPressure,
            numberOfNozzles,
            sprayDistance,
            tolerance,
          }}
        />
      )}

      {/* PDF Report Dialog — Layout mode */}
      {layoutResult && layoutResult.matches.length > 0 && (
        <GenerateLayoutReportDialog
          open={layoutReportOpen}
          onClose={() => setLayoutReportOpen(false)}
          result={layoutResult}
          selectedIdx={layoutSelectedIdx}
          inputs={{
            category,
            totalFlow: requiredFlow,
            operatingPressure,
            bundleLength,
            bundleWidth,
            sprayHeight,
            minOverlap,
            tolerance,
          }}
        />
      )}

      {/* Save Calculation Dialog */}
      <SaveCalculationDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        calculatorType={mode === 'selection' ? 'SPRAY_NOZZLE' : 'SPRAY_NOZZLE_LAYOUT'}
        inputs={{
          mode,
          category,
          requiredFlow,
          operatingPressure,
          tolerance,
          ...(mode === 'selection'
            ? { numberOfNozzles, sprayDistance }
            : { bundleLength, bundleWidth, sprayHeight, minOverlap }),
        }}
      />

      {/* Load Calculation Dialog */}
      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        calculatorType={mode === 'selection' ? 'SPRAY_NOZZLE' : 'SPRAY_NOZZLE_LAYOUT'}
        onLoad={(inputs) => {
          if (typeof inputs.mode === 'string') setMode(inputs.mode as CalculatorMode);
          if (typeof inputs.category === 'string') setCategory(inputs.category as NozzleCategory);
          if (typeof inputs.requiredFlow === 'string') setRequiredFlow(inputs.requiredFlow);
          if (typeof inputs.operatingPressure === 'string')
            setOperatingPressure(inputs.operatingPressure);
          if (typeof inputs.tolerance === 'string') setTolerance(inputs.tolerance);
          if (typeof inputs.numberOfNozzles === 'string')
            setNumberOfNozzles(inputs.numberOfNozzles);
          if (typeof inputs.sprayDistance === 'string') setSprayDistance(inputs.sprayDistance);
          if (typeof inputs.bundleLength === 'string') setBundleLength(inputs.bundleLength);
          if (typeof inputs.bundleWidth === 'string') setBundleWidth(inputs.bundleWidth);
          if (typeof inputs.sprayHeight === 'string') setSprayHeight(inputs.sprayHeight);
          if (typeof inputs.minOverlap === 'string') setMinOverlap(inputs.minOverlap);
        }}
      />
    </Container>
  );
}

// ── Selection Results ─────────────────────────────────────────────────────────

function SelectionResults({
  result,
  requiredFlow,
  tolerance,
  config,
  onReportOpen,
  onSaveOpen,
}: {
  result: ReturnType<typeof selectSprayNozzles> | null;
  requiredFlow: string;
  tolerance: string;
  config: (typeof NOZZLE_CATEGORIES)[NozzleCategory];
  onReportOpen: () => void;
  onSaveOpen: () => void;
}) {
  if (!result) {
    return (
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
          Enter a required flow rate and operating pressure to find matching nozzles
        </Typography>
      </Paper>
    );
  }

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
            <SummaryItem label="Required Flow (total)" value={`${parseFloat(requiredFlow)} lpm`} />
            {result.numberOfNozzles > 1 && (
              <SummaryItem label="Flow per Nozzle" value={`${result.flowPerNozzle} lpm`} />
            )}
            <SummaryItem label="Pressure" value={`${result.operatingPressure} bar`} />
            <SummaryItem
              label="Matches"
              value={`${result.matches.length} nozzle${result.matches.length !== 1 ? 's' : ''}`}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {result.matches.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={onSaveOpen}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={onReportOpen}
                >
                  Report
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Results table */}
      {result.matches.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Capacity Size</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Connection</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  <Tooltip title="Nominal orifice diameter">
                    <span>Orifice (mm)</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  <Tooltip title="Maximum free passage diameter">
                    <span>Free Pass. (mm)</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Flow (lpm)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Deviation
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Spray Angle
                </TableCell>
                {result.matches[0]?.coverage !== undefined && (
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Coverage (mm)
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {result.matches.map((match: NozzleMatch, idx: number) => (
                <TableRow
                  key={`${match.nozzle.capacitySize}-${match.nozzle.inletConn}-${idx}`}
                  sx={{
                    bgcolor:
                      idx === 0
                        ? 'success.50'
                        : Math.abs(match.deviationPercent) <= 5
                          ? 'action.hover'
                          : undefined,
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={idx === 0 ? 'bold' : undefined}>
                        {match.nozzle.capacitySize}
                      </Typography>
                      {idx === 0 && (
                        <Chip label="Best" size="small" color="success" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{match.nozzle.inletConn}&quot;</TableCell>
                  <TableCell align="right">{match.nozzle.orificeDia}</TableCell>
                  <TableCell align="right">{match.nozzle.maxFreePassage}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {match.flowAtPressure}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        Math.abs(match.deviationPercent) <= 5
                          ? 'success.main'
                          : Math.abs(match.deviationPercent) <= 15
                            ? 'warning.main'
                            : 'text.secondary',
                    }}
                  >
                    {match.deviationPercent > 0 ? '+' : ''}
                    {match.deviationPercent}%
                  </TableCell>
                  <TableCell align="right">{match.sprayAngle}&deg;</TableCell>
                  {match.coverage !== undefined && (
                    <TableCell align="right">{match.coverage}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'warning.50',
            border: '1px solid',
            borderColor: 'warning.main',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No matching nozzles found within &plusmn;{tolerance}% tolerance.
            <br />
            Try increasing the tolerance or adjusting the flow rate / number of nozzles.
          </Typography>
        </Paper>
      )}

      {/* Reference note */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>Source:</strong> Spraying Systems Co. Industrial Hydraulic Spray Products,
          Catalogue CAT75HYD (Metric).
          <br />
          <strong>Flow formula:</strong> Q = Q_rated &times; (P / P_rated)
          <sup>n</sup> where n = {config.flowExponent} for {config.seriesName}.
          <br />
          <strong>Coverage:</strong> Theoretical coverage = 2 &times; distance &times; tan(angle /
          2). Actual coverage varies with spray distance and operating conditions.
          <br />
          <strong>Note:</strong> All flow rates are for water. Spray angles are interpolated from
          catalogue data at {config.anglePressures.join(', ')} bar.
        </Typography>
      </Box>
    </Stack>
  );
}

// ── Layout Results ────────────────────────────────────────────────────────────

function LayoutResults({
  result,
  category,
  bundleLength,
  bundleWidth,
  sprayHeight,
  onReportOpen,
  onSaveOpen,
}: {
  result: ReturnType<typeof calculateNozzleLayout> | null;
  category: NozzleCategory;
  bundleLength: number;
  bundleWidth: number;
  sprayHeight: number;
  onReportOpen: (selectedIdx: number) => void;
  onSaveOpen: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!result) {
    return (
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
          Enter flow rate, pressure, and tube bundle dimensions to calculate nozzle layout
        </Typography>
      </Paper>
    );
  }

  const best = result.matches[selectedIdx] ?? result.matches[0];

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
            <SummaryItem label="Total Flow" value={`${result.totalFlow} lpm`} />
            <SummaryItem label="Pressure" value={`${result.operatingPressure} bar`} />
            <SummaryItem
              label="Bundle"
              value={`${result.bundleLength} \u00D7 ${result.bundleWidth} mm`}
            />
            <SummaryItem label="Spray Height" value={`${result.sprayHeight} mm`} />
            <SummaryItem
              label="Matches"
              value={`${result.matches.length} nozzle${result.matches.length !== 1 ? 's' : ''}`}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {result.matches.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={onSaveOpen}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={() => onReportOpen(selectedIdx)}
                >
                  Report
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      {result.matches.length > 0 ? (
        <>
          {/* Layout diagram for selected nozzle */}
          {best && !isNaN(bundleLength) && !isNaN(bundleWidth) && !isNaN(sprayHeight) && (
            <NozzleLayoutDiagram
              match={best}
              category={category}
              bundleLength={bundleLength}
              bundleWidth={bundleWidth}
              sprayHeight={sprayHeight}
            />
          )}

          {/* Best match summary card */}
          {best && (
            <Paper
              sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}
            >
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {selectedIdx === 0 ? 'Best Match' : `Option ${selectedIdx + 1}`}:{' '}
                {best.nozzle.capacitySize}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem
                    label="Layout"
                    value={`${best.nozzlesAlongLength} \u00D7 ${best.rowsAcrossWidth}`}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem label="Total Nozzles" value={String(best.totalNozzles)} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem label="Flow / Nozzle" value={`${best.flowAtPressure} lpm`} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem
                    label="Deviation"
                    value={`${best.deviationPercent > 0 ? '+' : ''}${best.deviationPercent}%`}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem label="Coverage" value={`${best.coverageDiameter} mm`} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem label="Pitch (L)" value={`${best.pitchAlongLength} mm`} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem label="Pitch (W)" value={`${best.pitchAcrossWidth} mm`} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <SummaryItem
                    label="Overlap"
                    value={`L=${best.actualOverlapLength}%, W=${best.actualOverlapWidth}%`}
                  />
                </Grid>
                {best.wastedFlowPercent > 0 && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <SummaryItem
                      label="Overspray (wasted)"
                      value={`${best.wastedFlowLpm} lpm (${best.wastedFlowPercent}%)`}
                    />
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* Results table */}
          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Capacity</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Conn.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Layout
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    <Tooltip title="Flow this nozzle delivers at operating pressure">
                      <span>Flow (lpm)</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Deviation
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    <Tooltip title="Coverage diameter at spray height">
                      <span>Coverage (mm)</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Pitch (mm)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    <Tooltip title="Actual overlap between adjacent nozzles (length / width)">
                      <span>Overlap</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    <Tooltip title="Flow sprayed outside the tube bundle area">
                      <span>Overspray</span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.matches.map((match: NozzleLayoutMatch, idx: number) => (
                  <TableRow
                    key={`${match.nozzle.capacitySize}-${match.nozzle.inletConn}-${idx}`}
                    hover
                    selected={idx === selectedIdx}
                    onClick={() => setSelectedIdx(idx)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor:
                        idx === selectedIdx
                          ? 'success.50'
                          : Math.abs(match.deviationPercent) <= 5
                            ? 'action.hover'
                            : undefined,
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="body2"
                          fontWeight={idx === selectedIdx ? 'bold' : undefined}
                        >
                          {match.nozzle.capacitySize}
                        </Typography>
                        {idx === 0 && (
                          <Chip label="Best" size="small" color="success" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{match.nozzle.inletConn}&quot;</TableCell>
                    <TableCell align="right">
                      {match.nozzlesAlongLength} &times; {match.rowsAcrossWidth}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {match.totalNozzles}
                    </TableCell>
                    <TableCell align="right">{match.flowAtPressure}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          Math.abs(match.deviationPercent) <= 5
                            ? 'success.main'
                            : Math.abs(match.deviationPercent) <= 15
                              ? 'warning.main'
                              : 'text.secondary',
                      }}
                    >
                      {match.deviationPercent > 0 ? '+' : ''}
                      {match.deviationPercent}%
                    </TableCell>
                    <TableCell align="right">{match.coverageDiameter}</TableCell>
                    <TableCell align="right">
                      {match.pitchAlongLength} / {match.pitchAcrossWidth}
                    </TableCell>
                    <TableCell align="right">
                      {match.actualOverlapLength}% / {match.actualOverlapWidth}%
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          match.wastedFlowPercent <= 5
                            ? 'success.main'
                            : match.wastedFlowPercent <= 15
                              ? 'warning.main'
                              : 'error.main',
                      }}
                    >
                      {match.wastedFlowPercent}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'warning.50',
            border: '1px solid',
            borderColor: 'warning.main',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No matching nozzle layout found. Try increasing the flow tolerance or adjusting the
            bundle dimensions / spray height.
          </Typography>
        </Paper>
      )}

      {/* Reference note */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>Layout method:</strong> Nozzles are evenly distributed to cover the bundle area
          with at least {result.minOverlap * 100}% overlap between adjacent coverages.
          <br />
          <strong>Coverage:</strong> Theoretical coverage = 2 &times; height &times; tan(angle / 2).
          <br />
          <strong>Note:</strong> Click any row to see its layout diagram. Actual coverage depends on
          spray distance and operating conditions.
        </Typography>
      </Box>
    </Stack>
  );
}

// ── Helper sub-component ─────────────────────────────────────────────────────

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
