'use client';

/**
 * Per-Effect Detailed Heat & Mass Balance Table
 *
 * Displays the tube-side, shell-side spray zone, shell-side flash zone,
 * and combined summary for a single MED evaporator effect — matching the
 * engineering H&M balance format.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import type { MEDEffectResult } from '@vapour/types';

// ============================================================================
// Helpers
// ============================================================================

/** Format a number for display — large flows as integers, small values with decimals */
function fmt(value: number, decimals = 1): string {
  if (Math.abs(value) < 0.001) return '-';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(decimals);
}

function fmtEnergy(value: number): string {
  if (Math.abs(value) < 0.01) return '-';
  return value.toFixed(1);
}

function fmtSalinity(value: number): string {
  if (value === 0) return '-';
  return (value / 1000).toFixed(1) + ' g/kg';
}

// ============================================================================
// Stream Row Component
// ============================================================================

interface StreamRowProps {
  direction: 'IN' | 'OUT';
  label: string;
  flow: number;
  temp: number;
  salinity: number;
  enthalpy: number;
  energy: number;
  highlight?: boolean;
}

function StreamRow({
  direction,
  label,
  flow,
  temp,
  salinity,
  enthalpy,
  energy,
  highlight,
}: StreamRowProps) {
  return (
    <TableRow sx={highlight ? { backgroundColor: 'action.hover' } : undefined}>
      <TableCell sx={{ pl: 2 }}>
        <Chip
          label={direction}
          size="small"
          color={direction === 'IN' ? 'primary' : 'secondary'}
          variant="outlined"
          sx={{ mr: 1, minWidth: 36, fontSize: '0.7rem' }}
        />
        {label}
      </TableCell>
      <TableCell align="right">{fmt(flow, 1)}</TableCell>
      <TableCell align="right">{fmt(temp, 2)}</TableCell>
      <TableCell align="right">{fmtSalinity(salinity)}</TableCell>
      <TableCell align="right">{fmt(enthalpy, 1)}</TableCell>
      <TableCell align="right">{fmtEnergy(energy)}</TableCell>
    </TableRow>
  );
}

// ============================================================================
// Section Header Row
// ============================================================================

function SectionHeader({ title, bgcolor }: { title: string; bgcolor: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={6}
        sx={{
          fontWeight: 'bold',
          backgroundColor: bgcolor,
          color: 'white',
          py: 0.75,
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {title}
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Balance Summary Row
// ============================================================================

function BalanceSummaryRow({
  label,
  massIn,
  massOut,
  energyIn,
  energyOut,
}: {
  label: string;
  massIn: number;
  massOut: number;
  energyIn: number;
  energyOut: number;
}) {
  const massError = massIn - massOut;
  const energyError =
    energyIn !== 0 ? (Math.abs(energyIn - energyOut) / Math.abs(energyIn)) * 100 : 0;

  return (
    <TableRow sx={{ backgroundColor: 'grey.100' }}>
      <TableCell sx={{ fontWeight: 'bold', pl: 2, fontSize: '0.75rem' }}>{label}</TableCell>
      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
        &Delta;m = {fmt(massError, 1)} kg/hr
      </TableCell>
      <TableCell colSpan={2} />
      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
        &Delta;E = {energyError.toFixed(2)}%
      </TableCell>
      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
        {fmtEnergy(energyIn)} / {fmtEnergy(energyOut)}
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Single Effect Table
// ============================================================================

function EffectTable({ effect }: { effect: MEDEffectResult }) {
  const { tubeSide: ts, shellSprayZone: sp, shellFlashZone: fz } = effect;

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 280 }}>Stream</TableCell>
            <TableCell align="right" sx={{ minWidth: 90 }}>
              Flow (kg/hr)
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 80 }}>
              Temp (&deg;C)
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 80 }}>
              Salinity
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 80 }}>
              h (kJ/kg)
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 80 }}>
              Energy (kW)
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* ---- TUBE SIDE ---- */}
          <SectionHeader title="Tube Side" bgcolor="#1565c0" />

          <StreamRow
            direction="IN"
            label={ts.vaporIn.label}
            flow={ts.vaporIn.flow}
            temp={ts.vaporIn.temperature}
            salinity={0}
            enthalpy={ts.vaporIn.enthalpy}
            energy={ts.vaporIn.energy}
          />
          {ts.distillateIn && (
            <StreamRow
              direction="IN"
              label={ts.distillateIn.label}
              flow={ts.distillateIn.flow}
              temp={ts.distillateIn.temperature}
              salinity={0}
              enthalpy={ts.distillateIn.enthalpy}
              energy={ts.distillateIn.energy}
              highlight
            />
          )}
          {ts.ncgIn > 0.001 && (
            <TableRow>
              <TableCell sx={{ pl: 2 }}>
                <Chip
                  label="IN"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mr: 1, minWidth: 36, fontSize: '0.7rem' }}
                />
                NCG Carried Over
              </TableCell>
              <TableCell align="right">{fmt(ts.ncgIn, 3)}</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          )}

          {ts.distillateFlashVapor > 0.01 && (
            <StreamRow
              direction="OUT"
              label="Distillate Flash Vapor (→ shell vapor space)"
              flow={ts.distillateFlashVapor}
              temp={effect.temperature}
              salinity={0}
              enthalpy={ts.condensateOut.enthalpy}
              energy={(ts.distillateFlashVapor * ts.condensateOut.enthalpy) / 3600}
            />
          )}
          <StreamRow
            direction="OUT"
            label={ts.condensateOut.label}
            flow={ts.condensateOut.flow}
            temp={ts.condensateOut.temperature}
            salinity={0}
            enthalpy={ts.condensateOut.enthalpy}
            energy={ts.condensateOut.energy}
            highlight
          />
          {ts.carrierSteam > 0.01 && (
            <TableRow>
              <TableCell sx={{ pl: 2 }}>
                <Chip
                  label="OUT"
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ mr: 1, minWidth: 36, fontSize: '0.7rem' }}
                />
                NCG Vent + Carrier Steam (→ shell)
              </TableCell>
              <TableCell align="right">{fmt(ts.ncgVent + ts.carrierSteam, 2)}</TableCell>
              <TableCell align="right">{fmt(effect.temperature, 2)}</TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          )}
          <TableRow sx={{ backgroundColor: 'primary.50' }}>
            <TableCell sx={{ pl: 2, fontWeight: 'bold', fontSize: '0.75rem' }}>
              Heat Released to Shell Side (Q_tube)
            </TableCell>
            <TableCell colSpan={4} />
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              {fmtEnergy(ts.heatReleased)}
            </TableCell>
          </TableRow>

          <BalanceSummaryRow
            label="Tube Side Balance"
            massIn={ts.massIn}
            massOut={ts.massOut}
            energyIn={ts.energyIn}
            energyOut={ts.energyOut}
          />

          {/* ---- SHELL SIDE — SPRAY ZONE ---- */}
          <SectionHeader title="Shell Side — Spray Zone (Falling Film)" bgcolor="#2e7d32" />

          <StreamRow
            direction="IN"
            label={sp.seawaterIn.label}
            flow={sp.seawaterIn.flow}
            temp={sp.seawaterIn.temperature}
            salinity={sp.seawaterIn.salinity}
            enthalpy={sp.seawaterIn.enthalpy}
            energy={sp.seawaterIn.energy}
          />
          {sp.recircBrineIn.flow > 0 && (
            <StreamRow
              direction="IN"
              label={sp.recircBrineIn.label}
              flow={sp.recircBrineIn.flow}
              temp={sp.recircBrineIn.temperature}
              salinity={sp.recircBrineIn.salinity}
              enthalpy={sp.recircBrineIn.enthalpy}
              energy={sp.recircBrineIn.energy}
              highlight
            />
          )}
          <TableRow sx={{ backgroundColor: 'success.50' }}>
            <TableCell sx={{ pl: 2, fontWeight: 'bold', fontSize: '0.75rem' }}>
              Heat Absorbed from Tube Side
            </TableCell>
            <TableCell colSpan={4} />
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
              {fmtEnergy(sp.heatAbsorbed)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ pl: 4, color: 'text.secondary', fontSize: '0.75rem' }}>
              &mdash; Sensible heating: {fmtEnergy(sp.sensibleHeat)} kW | Evaporation:{' '}
              {fmtEnergy(sp.latentHeat)} kW
            </TableCell>
            <TableCell colSpan={5} />
          </TableRow>

          <StreamRow
            direction="OUT"
            label={sp.vaporProduced.label}
            flow={sp.vaporProduced.flow}
            temp={sp.vaporProduced.temperature}
            salinity={0}
            enthalpy={sp.vaporProduced.enthalpy}
            energy={sp.vaporProduced.energy}
          />
          <StreamRow
            direction="OUT"
            label={sp.brineOut.label}
            flow={sp.brineOut.flow}
            temp={sp.brineOut.temperature}
            salinity={sp.brineOut.salinity}
            enthalpy={sp.brineOut.enthalpy}
            energy={sp.brineOut.energy}
            highlight
          />
          {sp.ncgReleased > 0.0001 && (
            <TableRow>
              <TableCell sx={{ pl: 2 }}>
                <Chip
                  label="OUT"
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ mr: 1, minWidth: 36, fontSize: '0.7rem' }}
                />
                Dissolved Gases Released (NCG)
              </TableCell>
              <TableCell align="right">{(sp.ncgReleased * 1000).toFixed(1)} g/hr</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          )}

          <BalanceSummaryRow
            label="Spray Zone Balance"
            massIn={sp.massIn}
            massOut={sp.massOut}
            energyIn={sp.energyIn}
            energyOut={sp.energyOut}
          />

          {/* ---- SHELL SIDE — FLASH ZONE ---- */}
          {fz.brineIn && (
            <>
              <SectionHeader title="Shell Side — Flash Zone (Cascaded Brine)" bgcolor="#e65100" />

              <StreamRow
                direction="IN"
                label={fz.brineIn.label}
                flow={fz.brineIn.flow}
                temp={fz.brineIn.temperature}
                salinity={fz.brineIn.salinity}
                enthalpy={fz.brineIn.enthalpy}
                energy={fz.brineIn.energy}
              />
              {fz.flashVapor && fz.flashVapor.flow > 0.01 && (
                <StreamRow
                  direction="OUT"
                  label={fz.flashVapor.label}
                  flow={fz.flashVapor.flow}
                  temp={fz.flashVapor.temperature}
                  salinity={0}
                  enthalpy={fz.flashVapor.enthalpy}
                  energy={fz.flashVapor.energy}
                />
              )}
              {fz.brineOut && (
                <StreamRow
                  direction="OUT"
                  label={fz.brineOut.label}
                  flow={fz.brineOut.flow}
                  temp={fz.brineOut.temperature}
                  salinity={fz.brineOut.salinity}
                  enthalpy={fz.brineOut.enthalpy}
                  energy={fz.brineOut.energy}
                  highlight
                />
              )}
              <TableRow>
                <TableCell sx={{ pl: 4, color: 'text.secondary', fontSize: '0.75rem' }}>
                  Flash fraction: {(fz.flashFraction * 100).toFixed(3)}%
                </TableCell>
                <TableCell colSpan={5} />
              </TableRow>

              <BalanceSummaryRow
                label="Flash Zone Balance"
                massIn={fz.massIn}
                massOut={fz.massOut}
                energyIn={fz.energyIn}
                energyOut={fz.energyOut}
              />
            </>
          )}

          {/* ---- COMBINED SUMMARY ---- */}
          <SectionHeader
            title="Effect Combined Summary — Streams to Next Effect"
            bgcolor="#424242"
          />

          <StreamRow
            direction="OUT"
            label={`Vapor through Demister → Effect ${effect.effectNumber + 1} Tube Side`}
            flow={effect.totalVaporOut.flow}
            temp={effect.totalVaporOut.temperature}
            salinity={0}
            enthalpy={effect.totalVaporOut.enthalpy}
            energy={effect.totalVaporOut.energy}
          />
          <StreamRow
            direction="OUT"
            label={`Brine (Bottom Pool) → Effect ${effect.effectNumber + 1} Shell Side`}
            flow={effect.totalBrineOut.flow}
            temp={effect.totalBrineOut.temperature}
            salinity={effect.totalBrineOut.salinity}
            enthalpy={effect.totalBrineOut.enthalpy}
            energy={effect.totalBrineOut.energy}
            highlight
          />
          <StreamRow
            direction="OUT"
            label={`Distillate (Siphon) → Effect ${effect.effectNumber + 1} Tube Side`}
            flow={effect.distillateOut.flow}
            temp={effect.distillateOut.temperature}
            salinity={0}
            enthalpy={effect.distillateOut.enthalpy}
            energy={effect.distillateOut.energy}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================================
// Effect Header — conditions card
// ============================================================================

function EffectConditions({ effect }: { effect: MEDEffectResult }) {
  const pressureMbar = effect.pressure * 1000;
  return (
    <Box
      sx={{
        mb: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1,
        backgroundColor: 'grey.50',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {[
        { label: 'Temperature', value: effect.temperature.toFixed(2), unit: '°C' },
        { label: 'Pressure', value: pressureMbar.toFixed(1), unit: 'mbar abs' },
        { label: 'BPE', value: effect.bpe.toFixed(3), unit: '°C' },
        { label: 'NEA', value: effect.nea.toFixed(3), unit: '°C' },
        { label: 'Effective ΔT', value: effect.effectiveDeltaT.toFixed(3), unit: '°C' },
        { label: 'Heat Transferred', value: effect.heatTransferred.toFixed(1), unit: 'kW' },
        { label: 'Mass Balance Error', value: effect.massBalance.toFixed(2), unit: 'kg/hr' },
        { label: 'Energy Balance Error', value: effect.energyBalanceError.toFixed(2), unit: '%' },
      ].map(({ label, value, unit }) => (
        <Box key={label}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.2 }}
          >
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {value}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              {unit}
            </Typography>
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Main Exported Component
// ============================================================================

interface MEDEffectBalanceTableProps {
  effects: MEDEffectResult[];
}

export default function MEDEffectBalanceTable({ effects }: MEDEffectBalanceTableProps) {
  const [selectedEffect, setSelectedEffect] = useState(0);

  if (effects.length === 0) return null;

  const effect = effects[selectedEffect]!;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Detailed Effect Heat &amp; Mass Balance
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Tube side / shell side breakdown per effect — select an effect to view its detailed balance.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={selectedEffect}
          onChange={(_, v) => setSelectedEffect(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {effects.map((eff, idx) => (
            <Tab key={idx} label={`Effect ${eff.effectNumber}`} />
          ))}
        </Tabs>
      </Box>

      <EffectConditions effect={effect} />
      <EffectTable effect={effect} />
    </Paper>
  );
}
