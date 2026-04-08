'use client';

import {
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { MEDDesignerResult } from '@/lib/thermal';

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Renders all computed auxiliary equipment as collapsible sections.
 * Data comes directly from designResult — no local computation.
 */
export function AuxiliaryEquipmentSections({ result }: { result: MEDDesignerResult }) {
  const aux = result.auxiliaryEquipment;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        Auxiliary Equipment
      </Typography>

      {/* ── Demisters ──────────────────────────────────────────── */}
      {aux.demisters.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Demisters</Typography>
              <Chip label={`${aux.demisters.length} effects`} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Effect</TableCell>
                  <TableCell align="right">Req. Area (m&sup2;)</TableCell>
                  <TableCell align="right">Design Velocity (m/s)</TableCell>
                  <TableCell align="right">&Delta;P (Pa)</TableCell>
                  <TableCell align="center">Loading</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aux.demisters.map((d) => (
                  <TableRow key={d.effect}>
                    <TableCell>E{d.effect}</TableCell>
                    <TableCell align="right">{fmt(d.requiredArea, 2)}</TableCell>
                    <TableCell align="right">{fmt(d.designVelocity, 2)}</TableCell>
                    <TableCell align="right">{Math.round(d.pressureDrop)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={d.loadingStatus}
                        size="small"
                        color={
                          d.loadingStatus === 'normal'
                            ? 'success'
                            : d.loadingStatus === 'high' || d.loadingStatus === 'overload'
                              ? 'error'
                              : 'default'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Spray Nozzles ──────────────────────────────────────── */}
      {aux.sprayNozzles.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Spray Nozzles</Typography>
              <Chip
                label={`${aux.sprayNozzles.reduce((s, n) => s + n.nozzleCount, 0)} total`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Effect</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Flow/Nozzle (lpm)</TableCell>
                  <TableCell align="right">Spray Angle (&deg;)</TableCell>
                  <TableCell align="right">Height (mm)</TableCell>
                  <TableCell align="right">Coverage (mm)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aux.sprayNozzles.map((n) => (
                  <TableRow key={n.effect}>
                    <TableCell>E{n.effect}</TableCell>
                    <TableCell>{n.nozzleModel}</TableCell>
                    <TableCell align="right">{n.nozzleCount}</TableCell>
                    <TableCell align="right">{fmt(n.flowPerNozzle, 1)}</TableCell>
                    <TableCell align="right">{fmt(n.sprayAngle, 0)}</TableCell>
                    <TableCell align="right">{Math.round(n.sprayHeight)}</TableCell>
                    <TableCell align="right">{Math.round(n.coverageWidth)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Siphons ────────────────────────────────────────────── */}
      {aux.siphons.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Inter-Effect Siphons</Typography>
              <Chip label={`${aux.siphons.length} lines`} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Fluid</TableCell>
                  <TableCell align="right">Flow (T/h)</TableCell>
                  <TableCell align="right">Pipe</TableCell>
                  <TableCell align="right">Velocity (m/s)</TableCell>
                  <TableCell align="right">Min Height (m)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aux.siphons.map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell>E{s.fromEffect}</TableCell>
                    <TableCell>E{s.toEffect}</TableCell>
                    <TableCell>{s.fluidType}</TableCell>
                    <TableCell align="right">{fmt(s.flowRate, 2)}</TableCell>
                    <TableCell align="right">{s.pipeSize}</TableCell>
                    <TableCell align="right">{fmt(s.velocity, 2)}</TableCell>
                    <TableCell align="right">{fmt(s.minimumHeight, 3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Pumps ──────────────────────────────────────────────── */}
      {aux.pumps.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Pumps</Typography>
              <Chip
                label={`${fmt(
                  aux.pumps.reduce((s, p) => s + p.motorPower, 0),
                  0
                )} kW total`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Flow (m&sup3;/h)</TableCell>
                  <TableCell align="right">Head (m)</TableCell>
                  <TableCell align="right">Hyd. Power (kW)</TableCell>
                  <TableCell align="right">Motor (kW)</TableCell>
                  <TableCell align="right">Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aux.pumps.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{p.service}</TableCell>
                    <TableCell align="right">{fmt(p.flowRateM3h, 1)}</TableCell>
                    <TableCell align="right">{fmt(p.totalHead, 1)}</TableCell>
                    <TableCell align="right">{fmt(p.hydraulicPower, 2)}</TableCell>
                    <TableCell align="right">{fmt(p.motorPower, 1)}</TableCell>
                    <TableCell align="right">{p.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Line Sizing ────────────────────────────────────────── */}
      {aux.lineSizing.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Line Sizing</Typography>
              <Chip label={`${aux.lineSizing.length} lines`} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Flow (T/h)</TableCell>
                  <TableCell align="right">Pipe</TableCell>
                  <TableCell align="right">DN</TableCell>
                  <TableCell align="right">Velocity (m/s)</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aux.lineSizing.map((l, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{l.service}</TableCell>
                    <TableCell align="right">{fmt(l.flowRate, 2)}</TableCell>
                    <TableCell align="right">{l.pipeSize}</TableCell>
                    <TableCell align="right">{l.dn}</TableCell>
                    <TableCell align="right">{fmt(l.velocity, 2)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={l.velocityStatus}
                        size="small"
                        color={l.velocityStatus === 'ok' ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Vacuum System ──────────────────────────────────────── */}
      {result.vacuumSystem && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Vacuum System</Typography>
              <Chip label={result.vacuumSystem.trainConfig} size="small" variant="outlined" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Train Configuration</TableCell>
                  <TableCell align="right">{result.vacuumSystem.trainConfig}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Last Effect Pressure</TableCell>
                  <TableCell align="right">
                    {fmt(result.vacuumSystem.lastEffectPressureMbar, 0)} mbar
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>NCG Load (dry)</TableCell>
                  <TableCell align="right">
                    {fmt(result.vacuumSystem.totalDryNcgKgH, 1)} kg/h
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Motive Steam</TableCell>
                  <TableCell align="right">
                    {fmt(result.vacuumSystem.totalMotiveSteamKgH, 0)} kg/h
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Power</TableCell>
                  <TableCell align="right">{fmt(result.vacuumSystem.totalPowerKW, 1)} kW</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Evacuation Time</TableCell>
                  <TableCell align="right">
                    {fmt(result.vacuumSystem.evacuationTimeMinutes, 0)} min
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── Chemical Dosing ────────────────────────────────────── */}
      {result.dosing && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Chemical Dosing</Typography>
              <Chip
                label={`${fmt(result.dosing.dailyConsumptionKg, 1)} kg/day`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Feed Flow</TableCell>
                  <TableCell align="right">{fmt(result.dosing.feedFlowM3h, 1)} m&sup3;/h</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Dose Rate</TableCell>
                  <TableCell align="right">{result.dosing.doseMgL} mg/L</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Chemical Flow</TableCell>
                  <TableCell align="right">{fmt(result.dosing.chemicalFlowLh, 2)} L/h</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Monthly Consumption</TableCell>
                  <TableCell align="right">
                    {fmt(result.dosing.monthlyConsumptionKg, 0)} kg
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Storage Tank</TableCell>
                  <TableCell align="right">{fmt(result.dosing.storageTankM3, 2)} m&sup3;</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Dosing Line</TableCell>
                  <TableCell align="right">{result.dosing.dosingLineOD}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
}
