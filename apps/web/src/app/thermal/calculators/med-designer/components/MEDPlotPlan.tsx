'use client';

import { Paper, Typography, useTheme } from '@mui/material';
import type { MEDDesignerResult } from '@/lib/thermal';

interface MEDPlotPlanProps {
  result: MEDDesignerResult;
}

/**
 * Plan-view (top-down) SVG showing MED plant footprint.
 * Shows evaporator shells, condenser, preheaters, and pump positions.
 */
export function MEDPlotPlan({ result }: MEDPlotPlanProps) {
  const theme = useTheme();
  const shellCol = theme.palette.grey[600];
  const fillCol = theme.palette.grey[100];
  const pumpCol = theme.palette.primary.main;
  const condenserCol = theme.palette.info.main;
  const phCol = theme.palette.warning.main;
  const textCol = theme.palette.text.primary;
  const dimCol = theme.palette.grey[400];

  const effects = result.effects;
  const nEff = effects.length;

  if (nEff === 0) return null;

  // Scale: everything in mm, then convert to SVG coords
  const scale = 0.15; // mm → SVG pixels
  const gap = 300; // 300mm gap between shells

  // Shell dimensions
  const shellOD = result.overallDimensions.shellODmm;
  const shellLengths = effects.map((e) => e.shellLengthMM);

  // Calculate total train length
  const totalTrainLength = shellLengths.reduce((sum, l) => sum + l, 0) + (nEff - 1) * gap;

  // Condenser dimensions (estimate from area)
  const condenserLength = 3000; // mm (typical)
  const condenserWidth = Math.max(
    600,
    Math.round(Math.sqrt((result.condenser.designArea * 1e6) / 3))
  );

  // Preheater dimensions
  const phWidth = 400; // mm
  const phLength = 2000; // mm

  // Layout: shells in a horizontal line, condenser at right end, preheaters below
  const margin = 60; // SVG margin
  const pumpRow = shellOD + 800; // pumps 800mm below shell centreline
  const phRow = shellOD + 1600; // preheaters 1600mm below

  // Overall footprint
  const footprintWidth = totalTrainLength + gap + condenserLength + 1000;
  const footprintHeight = phRow + phLength + 500;

  const svgW = footprintWidth * scale + 2 * margin;
  const svgH = footprintHeight * scale + 2 * margin;

  // Convert mm to SVG coords
  const x = (mm: number) => margin + mm * scale;
  const y = (mm: number) => margin + mm * scale;

  // Draw shells
  let xPos = 0;
  const shellElements = effects.map((e, i) => {
    const sx = xPos;
    const len = shellLengths[i]!;
    xPos += len + gap;

    return (
      <g key={`shell-${i}`}>
        {/* Shell rectangle */}
        <rect
          x={x(sx)}
          y={y(0)}
          width={len * scale}
          height={shellOD * scale}
          rx={4}
          fill={fillCol}
          stroke={shellCol}
          strokeWidth={1.5}
        />
        {/* Effect label */}
        <text
          x={x(sx + len / 2)}
          y={y(shellOD / 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill={textCol}
        >
          E{e.effect}
        </text>
        {/* Dimensions */}
        <text
          x={x(sx + len / 2)}
          y={y(shellOD / 2 + 120)}
          textAnchor="middle"
          fontSize={7}
          fill={dimCol}
        >
          {Math.round(len)}×ø{Math.round(shellOD)}
        </text>
      </g>
    );
  });

  // Condenser
  const condenserX = xPos;
  const condenserElement = (
    <g key="condenser">
      <rect
        x={x(condenserX)}
        y={y((shellOD - condenserWidth) / 2)}
        width={condenserLength * scale}
        height={condenserWidth * scale}
        rx={4}
        fill="none"
        stroke={condenserCol}
        strokeWidth={2}
      />
      <text
        x={x(condenserX + condenserLength / 2)}
        y={y(shellOD / 2)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={600}
        fill={condenserCol}
      >
        FC
      </text>
      <text
        x={x(condenserX + condenserLength / 2)}
        y={y(shellOD / 2 + 100)}
        textAnchor="middle"
        fontSize={7}
        fill={dimCol}
      >
        {fmt(result.condenser.designArea)}m²
      </text>
    </g>
  );

  // Pumps
  const pumpR = 80; // mm radius for pump symbol
  const pumps = result.auxiliaryEquipment.pumps;
  const pumpElements = pumps.map((p, i) => {
    const px = 500 + i * (totalTrainLength / pumps.length);
    return (
      <g key={`pump-${i}`}>
        <circle
          cx={x(px)}
          cy={y(pumpRow)}
          r={pumpR * scale}
          fill="none"
          stroke={pumpCol}
          strokeWidth={1.5}
        />
        <text
          x={x(px)}
          y={y(pumpRow)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={6}
          fill={pumpCol}
        >
          P{i + 1}
        </text>
        <text x={x(px)} y={y(pumpRow + pumpR + 80)} textAnchor="middle" fontSize={6} fill={dimCol}>
          {p.service.replace(/\s*\(.*\)/, '').substring(0, 12)}
        </text>
      </g>
    );
  });

  // Preheaters
  const phElements = result.preheaters.map((ph, i) => {
    const px = 500 + i * (totalTrainLength / Math.max(result.preheaters.length, 1));
    return (
      <g key={`ph-${i}`}>
        <rect
          x={x(px - phWidth / 2)}
          y={y(phRow)}
          width={phWidth * scale}
          height={phLength * scale}
          rx={3}
          fill="none"
          stroke={phCol}
          strokeWidth={1.5}
        />
        <text
          x={x(px)}
          y={y(phRow + phLength / 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill={phCol}
        >
          PH{ph.id}
        </text>
      </g>
    );
  });

  // Overall dimension lines
  const footprintLengthM = (footprintWidth / 1000).toFixed(1);
  const footprintWidthM = (footprintHeight / 1000).toFixed(1);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        Plot Plan (Top View)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Overall footprint: {footprintLengthM} m × {footprintWidthM} m
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: 300 }}>
        {/* Background grid */}
        <rect x={0} y={0} width={svgW} height={svgH} fill="white" />

        {/* Shells */}
        {shellElements}

        {/* Condenser */}
        {condenserElement}

        {/* Pumps */}
        {pumpElements}

        {/* Preheaters */}
        {phElements}

        {/* Overall dimension */}
        <line
          x1={x(0)}
          y1={y(-200)}
          x2={x(footprintWidth)}
          y2={y(-200)}
          stroke={dimCol}
          strokeWidth={0.5}
          strokeDasharray="4,2"
        />
        <text x={x(footprintWidth / 2)} y={y(-300)} textAnchor="middle" fontSize={9} fill={textCol}>
          {footprintLengthM} m
        </text>
      </svg>
    </Paper>
  );
}

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}
