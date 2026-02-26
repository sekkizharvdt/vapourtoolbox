'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';

interface DesuperheatingDiagramProps {
  result: DesuperheatingResult | null;
  steamPressure: number | null;
}

/**
 * SVG diagram of the inline desuperheater.
 *
 * Shows:
 *  - Superheated steam inlet (left)
 *  - Spray water injection (bottom centre)
 *  - Desuperheated steam outlet (right)
 *  - Temperature and enthalpy annotations when a result is available
 */
export function DesuperheatingDiagram({ result, steamPressure }: DesuperheatingDiagramProps) {
  const theme = useTheme();

  // Colors
  const pipeColor = theme.palette.grey[700];
  const vesselFill = theme.palette.grey[100];
  const vesselColor = theme.palette.grey[400];
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const waterColor = theme.palette.info.main;
  const hotColor = theme.palette.error.light;
  const coolColor = theme.palette.success.light;
  const bgColor = theme.palette.background.paper;

  // SVG dimensions
  const svgW = 480;
  const svgH = 260;

  // Main pipe (desuperheater body) – a horizontal vessel
  const bodyX = 100;
  const bodyY = 90;
  const bodyW = 280;
  const bodyH = 60;
  const bodyMidY = bodyY + bodyH / 2;

  // Inlet pipe (left)
  const inletX1 = 20;
  const inletX2 = bodyX;
  const pipeH = 12;

  // Outlet pipe (right)
  const outletX1 = bodyX + bodyW;
  const outletX2 = svgW - 20;

  // Spray nozzle (bottom centre)
  const sprayX = bodyX + bodyW / 2;
  const sprayY1 = bodyY + bodyH;
  const sprayY2 = svgH - 20;
  const sprayNozzleH = 20;

  return (
    <Box
      sx={{
        bgcolor: bgColor,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        mb: 2,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Desuperheater Arrangement
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: svgH }}>
        <defs>
          <marker id="dsh-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
          </marker>
          <marker
            id="dsh-arrow-accent"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
          </marker>
          <marker
            id="dsh-arrow-water"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={waterColor} />
          </marker>
          {/* hot fill for inlet */}
          <linearGradient id="dsh-hot-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={hotColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={hotColor} stopOpacity={0.1} />
          </linearGradient>
          {/* cool fill for outlet */}
          <linearGradient id="dsh-cool-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={coolColor} stopOpacity={0.1} />
            <stop offset="100%" stopColor={coolColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>

        {/* === Inlet pipe === */}
        <rect
          x={inletX1}
          y={bodyMidY - pipeH / 2}
          width={inletX2 - inletX1}
          height={pipeH}
          fill="url(#dsh-hot-grad)"
          stroke={pipeColor}
          strokeWidth={1.5}
        />

        {/* === Outlet pipe === */}
        <rect
          x={outletX1}
          y={bodyMidY - pipeH / 2}
          width={outletX2 - outletX1}
          height={pipeH}
          fill="url(#dsh-cool-grad)"
          stroke={pipeColor}
          strokeWidth={1.5}
        />

        {/* === Desuperheater body (vessel) === */}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          rx={8}
          fill={vesselFill}
          stroke={vesselColor}
          strokeWidth={2}
        />
        <text
          x={bodyX + bodyW / 2}
          y={bodyY + 24}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill={pipeColor}
        >
          Desuperheater
        </text>
        <text
          x={bodyX + bodyW / 2}
          y={bodyY + 42}
          textAnchor="middle"
          fontSize={10}
          fill={dimColor}
        >
          {steamPressure !== null ? `P = ${steamPressure.toFixed(2)} bar abs` : 'spray-type inline'}
        </text>

        {/* === Spray nozzle pipe (bottom) === */}
        <line
          x1={sprayX}
          y1={sprayY1}
          x2={sprayX}
          y2={sprayY2}
          stroke={waterColor}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Nozzle tip triangle */}
        <polygon
          points={`${sprayX - 8},${sprayY1 + sprayNozzleH} ${sprayX + 8},${sprayY1 + sprayNozzleH} ${sprayX},${sprayY1}`}
          fill={waterColor}
          opacity={0.7}
        />
        {/* Arrow showing spray direction (upward into vessel) */}
        <line
          x1={sprayX}
          y1={sprayY1 + sprayNozzleH + 10}
          x2={sprayX}
          y2={sprayY1 + sprayNozzleH + 2}
          stroke={waterColor}
          strokeWidth={1.5}
          markerEnd="url(#dsh-arrow-water)"
        />

        {/* === Flow direction arrows on pipes === */}
        <line
          x1={inletX1 + 20}
          y1={bodyMidY}
          x2={inletX1 + 50}
          y2={bodyMidY}
          stroke={dimColor}
          strokeWidth={1.5}
          markerEnd="url(#dsh-arrow)"
        />
        <line
          x1={outletX2 - 50}
          y1={bodyMidY}
          x2={outletX2 - 20}
          y2={bodyMidY}
          stroke={dimColor}
          strokeWidth={1.5}
          markerEnd="url(#dsh-arrow)"
        />

        {/* === Labels & annotations when result is available === */}
        {result ? (
          <>
            {/* Inlet label */}
            <text
              x={inletX1 + (inletX2 - inletX1) / 2}
              y={bodyMidY - pipeH / 2 - 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={hotColor.replace('light', '')}
            >
              Steam in
            </text>
            <text
              x={inletX1 + (inletX2 - inletX1) / 2}
              y={bodyMidY - pipeH / 2 - 4}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
            >
              {result.steamEnthalpy.toFixed(0)} kJ/kg
            </text>
            <text
              x={inletX1 + (inletX2 - inletX1) / 2}
              y={bodyMidY + pipeH / 2 + 12}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
            >
              +{result.degreesOfSuperheat.toFixed(1)}°C SH
            </text>

            {/* Outlet label */}
            <text
              x={outletX1 + (outletX2 - outletX1) / 2}
              y={bodyMidY - pipeH / 2 - 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={accentColor}
            >
              Desuperheated
            </text>
            <text
              x={outletX1 + (outletX2 - outletX1) / 2}
              y={bodyMidY - pipeH / 2 - 4}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
            >
              {result.targetEnthalpy.toFixed(0)} kJ/kg
            </text>
            <text
              x={outletX1 + (outletX2 - outletX1) / 2}
              y={bodyMidY + pipeH / 2 + 12}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
            >
              {result.outletSuperheat > 0.1
                ? `+${result.outletSuperheat.toFixed(1)}°C SH`
                : 'Saturated vapor'}
            </text>

            {/* Spray water label */}
            <text x={sprayX + 12} y={sprayY2 - 16} fontSize={9} fontWeight="bold" fill={waterColor}>
              Spray water
            </text>
            <text x={sprayX + 12} y={sprayY2 - 4} fontSize={9} fill={dimColor}>
              {result.sprayWaterFlow.toFixed(3)} t/hr
            </text>
            <text x={sprayX + 12} y={sprayY2 + 8} fontSize={9} fill={dimColor}>
              {result.sprayWaterEnthalpy.toFixed(0)} kJ/kg
            </text>

            {/* Tsat annotation inside body */}
            <text x={bodyX + 12} y={bodyY + bodyH - 8} fontSize={9} fill={dimColor}>
              T_sat = {result.saturationTemperature.toFixed(1)}°C
            </text>

            {/* Heat removed annotation (right inside body) */}
            <text
              x={bodyX + bodyW - 12}
              y={bodyY + bodyH - 8}
              textAnchor="end"
              fontSize={9}
              fill={accentColor}
            >
              Q = {(result.heatRemoved / 1000).toFixed(1)} MW
            </text>
          </>
        ) : (
          <>
            {/* Static labels when no result */}
            <text
              x={inletX1 + (inletX2 - inletX1) / 2}
              y={bodyMidY - pipeH / 2 - 8}
              textAnchor="middle"
              fontSize={10}
              fill={dimColor}
              opacity={0.6}
            >
              Superheated steam
            </text>
            <text
              x={outletX1 + (outletX2 - outletX1) / 2}
              y={bodyMidY - pipeH / 2 - 8}
              textAnchor="middle"
              fontSize={10}
              fill={dimColor}
              opacity={0.6}
            >
              Desuperheated steam
            </text>
            <text x={sprayX + 12} y={sprayY2 - 4} fontSize={10} fill={dimColor} opacity={0.6}>
              Spray water
            </text>
          </>
        )}
      </svg>
    </Box>
  );
}
