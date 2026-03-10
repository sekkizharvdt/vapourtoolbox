'use client';

/**
 * Design Results Panel
 *
 * Displays the full output of the iterative heat exchanger design:
 * convergence summary, key design cards, HTC breakdown, geometry table,
 * velocity/pressure drop, iteration history, and warnings.
 */

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { IterativeHXResult } from '@/lib/thermal/iterativeHXDesign.types';
import { TUBE_MATERIALS, TUBE_LAYOUT_LABELS } from '@/lib/thermal/heatExchangerSizing';

const fmt = (v: number, d = 1) => v.toFixed(d);

function ResultCard({
  label,
  value,
  unit,
  color = 'primary.main',
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, textAlign: 'center', flex: 1, minWidth: 120, borderColor: color }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight="bold" sx={{ color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {unit}
      </Typography>
    </Paper>
  );
}

function TdLabel({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell
      sx={{
        color: bold ? 'text.primary' : 'text.secondary',
        fontSize: '0.8rem',
        fontWeight: bold ? 'bold' : 'normal',
        py: 0.5,
      }}
    >
      {children}
    </TableCell>
  );
}

function TdValue({ children, bold }: { children?: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell
      align="right"
      sx={{ fontSize: '0.8rem', fontWeight: bold ? 'bold' : 'normal', py: 0.5 }}
    >
      {children}
    </TableCell>
  );
}

interface DesignResultsPanelProps {
  result: IterativeHXResult | null;
  error: string | null;
}

export function DesignResultsPanel({ result, error }: DesignResultsPanelProps) {
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!result) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: 'action.hover',
          borderStyle: 'dashed',
        }}
      >
        <Typography color="text.secondary">
          Configure all steps and click &ldquo;Run Design&rdquo; to see results.
        </Typography>
      </Paper>
    );
  }

  const g = result.geometry;
  const v = result.velocity;
  const materialLabel = TUBE_MATERIALS[g.tubeMaterial]?.label ?? g.tubeMaterial;
  const layoutLabel = TUBE_LAYOUT_LABELS[g.tubeLayout] ?? g.tubeLayout;

  return (
    <Stack spacing={2}>
      {/* Convergence badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={result.converged ? 'Converged' : 'Not Converged'}
          color={result.converged ? 'success' : 'warning'}
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          {result.iterationCount} iteration{result.iterationCount !== 1 ? 's' : ''}
          {' \u00A0|\u00A0 '}U = {fmt(result.htcResult.overallHTC, 0)} W/m{'\u00B2\u00B7'}K
        </Typography>
      </Box>

      {/* Key result cards */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <ResultCard
          label="Required Area"
          value={fmt(g.requiredArea)}
          unit="m\u00B2"
          color="primary.main"
        />
        <ResultCard
          label="Tube Count"
          value={`${g.actualTubeCount}`}
          unit={`(+${fmt(g.excessArea, 0)}% excess)`}
          color="secondary.main"
        />
        <ResultCard label="Shell ID" value={`${g.shellID}`} unit="mm" color="info.main" />
      </Stack>

      {/* Design basis summary */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
          Design Basis
        </Typography>
        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
          <Typography variant="caption">Q = {fmt(result.heatDuty.heatDutyKW)} kW</Typography>
          <Typography variant="caption">
            LMTD = {fmt(result.lmtdResult.correctedLMTD)}
            {'\u00B0C'}
          </Typography>
          <Typography variant="caption">
            U = {fmt(result.htcResult.overallHTC, 0)} W/m{'\u00B2\u00B7'}K
          </Typography>
          <Typography variant="caption">
            h_i = {fmt(result.tubeSideHTC, 0)} W/m{'\u00B2\u00B7'}K
          </Typography>
          <Typography variant="caption">
            h_o = {fmt(result.shellSideHTC, 0)} W/m{'\u00B2\u00B7'}K
          </Typography>
        </Stack>
      </Paper>

      {/* HTC Resistance Breakdown */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight="bold">
            HTC Resistance Breakdown
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size="small">
            <TableBody>
              {[
                { label: 'Tube-side convection', r: result.htcResult.resistances.tubeSide },
                { label: 'Tube-side fouling', r: result.htcResult.resistances.tubeSideFouling },
                { label: 'Tube wall', r: result.htcResult.resistances.tubeWall },
                { label: 'Shell-side fouling', r: result.htcResult.resistances.shellSideFouling },
                { label: 'Shell-side convection', r: result.htcResult.resistances.shellSide },
              ].map(({ label, r }) => (
                <TableRow key={label}>
                  <TdLabel>{label}</TdLabel>
                  <TdValue>
                    {(r * 1e4).toFixed(4)} {'\u00D7'}10{'\u207B\u2074'}
                  </TdValue>
                  <TdValue>{((r / result.htcResult.resistances.total) * 100).toFixed(1)}%</TdValue>
                </TableRow>
              ))}
              <TableRow>
                <TdLabel bold>Total</TdLabel>
                <TdValue bold>
                  {(result.htcResult.resistances.total * 1e4).toFixed(4)} {'\u00D7'}10
                  {'\u207B\u2074'} m{'\u00B2\u00B7'}K/W
                </TdValue>
                <TdValue bold>100%</TdValue>
              </TableRow>
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>

      {/* Geometry table */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight="bold">
            Geometry & Sizing
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TdLabel>Tube Spec</TdLabel>
                <TdValue>
                  {g.tubeSpec.od_mm} mm OD {'\u00D7'} {g.tubeSpec.wall_mm} mm wall (BWG{' '}
                  {g.tubeSpec.bwg})
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Material</TdLabel>
                <TdValue>
                  {materialLabel} ({g.tubeMaterialConductivity} W/m{'\u00B7'}K)
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Layout / Pitch</TdLabel>
                <TdValue>
                  {layoutLabel}, {fmt(g.tubePitch)} mm
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Passes / Length</TdLabel>
                <TdValue>
                  {g.tubePasses} passes, {fmt(g.tubeLength)} m
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Tube Count</TdLabel>
                <TdValue>
                  {g.actualTubeCount} ({g.actualTubeCount / g.tubePasses} per pass)
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Area (required / actual)</TdLabel>
                <TdValue>
                  {fmt(g.requiredArea)} / {fmt(g.actualArea)} m{'\u00B2'} (+{fmt(g.excessArea, 0)}%)
                </TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Bundle Diameter</TdLabel>
                <TdValue>{fmt(g.bundleDiameter, 0)} mm</TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Shell ID / Clearance</TdLabel>
                <TdValue>
                  {g.shellID} mm / {fmt(g.bundleClearance)} mm
                </TdValue>
              </TableRow>
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>

      {/* Velocity & Pressure Drop */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight="bold">
            Velocity & Pressure Drop
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2">
              Tube-side velocity: <strong>{fmt(v.tubeSideVelocity, 2)} m/s</strong>
            </Typography>
            <Chip
              label={v.tubeSideVelocity < 0.5 ? 'LOW' : v.tubeSideVelocity > 3 ? 'HIGH' : 'OK'}
              color={
                v.tubeSideVelocity < 0.5 ? 'warning' : v.tubeSideVelocity > 3 ? 'error' : 'success'
              }
              size="small"
            />
          </Stack>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TdLabel>Reynolds Number</TdLabel>
                <TdValue>{v.tubeSideReynolds.toLocaleString()}</TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Est. Pressure Drop</TdLabel>
                <TdValue>{(v.tubeSidePressureDrop / 1000).toFixed(2)} kPa</TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Friction Factor</TdLabel>
                <TdValue>{v.tubeSideFrictionFactor.toFixed(6)}</TdValue>
              </TableRow>
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>

      {/* Iteration History */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight="bold">
            Iteration History ({result.iterations.length} steps)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.7rem' }}>#</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    U assumed
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    U calc
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    Area (m{'\u00B2'})
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    Tubes
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    v (m/s)
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                    Error
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.iterations.map((it) => (
                  <TableRow key={it.iteration}>
                    <TableCell sx={{ fontSize: '0.7rem' }}>{it.iteration}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {fmt(it.assumedU, 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {fmt(it.calculatedU, 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {fmt(it.requiredArea)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {it.tubeCount}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {fmt(it.tubeSideVelocity, 2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem' }}>
                      {(it.relativeError * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert severity="warning">
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Warnings
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.warnings.map((w, i) => (
              <li key={i}>
                <Typography variant="body2">{w}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </Stack>
  );
}
