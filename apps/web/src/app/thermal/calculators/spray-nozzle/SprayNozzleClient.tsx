'use client';

/**
 * Spray Nozzle Selection Calculator
 *
 * Selects spray nozzles from the Spraying Systems Co. CAT75HYD catalogue
 * based on required flow, operating pressure, and nozzle category.
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
} from '@mui/material';
import {
  Opacity as FullConeIcon,
  BlurCircular as HollowConeIcon,
  CropSquare as SquareIcon,
  ZoomOutMap as WideIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  selectSprayNozzles,
  NOZZLE_CATEGORIES,
  type NozzleCategory,
  type NozzleMatch,
} from '@/lib/thermal/sprayNozzleCalculator';

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
    subtitle: 'FullJet G/H — solid cone, round impact area (43°–94°)',
    icon: <FullConeIcon sx={{ fontSize: 28 }} />,
  },
  {
    id: 'full_cone_wide',
    label: 'Full Cone — Wide',
    subtitle: 'FullJet G-W/H-W — wide cone, max coverage (112°–125°)',
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
    subtitle: 'WhirlJet AX/BX — hollow cone, fine atomisation (43°–91°)',
    icon: <HollowConeIcon sx={{ fontSize: 28 }} />,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SprayNozzleClient() {
  const [category, setCategory] = useState<NozzleCategory>('full_cone_circular');
  const [requiredFlow, setRequiredFlow] = useState<string>('');
  const [operatingPressure, setOperatingPressure] = useState<string>('3');
  const [numberOfNozzles, setNumberOfNozzles] = useState<string>('1');
  const [sprayDistance, setSprayDistance] = useState<string>('');
  const [tolerance, setTolerance] = useState<string>('25');
  const [error, setError] = useState<string | null>(null);

  const config = NOZZLE_CATEGORIES[category];

  // ── Run selection ─────────────────────────────────────────────────────────

  const result = useMemo(() => {
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
  }, [category, requiredFlow, operatingPressure, numberOfNozzles, sprayDistance, tolerance]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Spray Nozzle Selection" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Spray Nozzle Selection
        </Typography>
        <Chip label="Spraying Systems Co." size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Select spray nozzles from the CAT75HYD catalogue by required flow rate and operating
        pressure.
      </Typography>

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

            {/* Operating conditions */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Operating Conditions
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

                <TextField
                  label="Flow Tolerance"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  helperText="Show nozzles within ± this % of required flow"
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

            {/* Reference info */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" component="div">
                <strong>Series:</strong> {config.seriesName}
                <br />
                <strong>Flow scaling:</strong> Q = Q_rated × (P / P_rated)
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
          {result ? (
            <Stack spacing={3}>
              {/* Summary bar */}
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  <SummaryItem
                    label="Required Flow (total)"
                    value={`${parseFloat(requiredFlow)} lpm`}
                  />
                  {result.numberOfNozzles > 1 && (
                    <SummaryItem label="Flow per Nozzle" value={`${result.flowPerNozzle} lpm`} />
                  )}
                  <SummaryItem label="Pressure" value={`${result.operatingPressure} bar`} />
                  <SummaryItem
                    label="Matches"
                    value={`${result.matches.length} nozzle${result.matches.length !== 1 ? 's' : ''}`}
                  />
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
                          Spray Angle (°)
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
                              <Typography
                                variant="body2"
                                fontWeight={idx === 0 ? 'bold' : undefined}
                              >
                                {match.nozzle.capacitySize}
                              </Typography>
                              {idx === 0 && (
                                <Chip
                                  label="Best"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
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
                          <TableCell align="right">{match.sprayAngle}°</TableCell>
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
                    No matching nozzles found within ±{tolerance}% tolerance.
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
                  <strong>Flow formula:</strong> Q = Q_rated × (P / P_rated)
                  <sup>n</sup> where n = {config.flowExponent} for {config.seriesName}.
                  <br />
                  <strong>Coverage:</strong> Theoretical coverage = 2 × distance × tan(angle / 2).
                  Actual coverage varies with spray distance and operating conditions.
                  <br />
                  <strong>Note:</strong> All flow rates are for water. Spray angles are interpolated
                  from catalogue data at {config.anglePressures.join(', ')} bar.
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
                Enter a required flow rate and operating pressure to find matching nozzles
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
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
