'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';

interface SuctionDiagramProps {
  result: SuctionSystemResult | null;
}

/**
 * SVG side-view diagram of the MED suction system:
 * Vessel → nozzle standpipe (holdup + level gauge) → reducer → suction pipe
 *   → TEE (1W+1S) → elbow → valve → strainer → pump
 */
export function SuctionDiagram({ result }: SuctionDiagramProps) {
  const theme = useTheme();

  // Colors
  const pipeColor = theme.palette.grey[700];
  const waterColor = theme.palette.info.main;
  const vesselColor = theme.palette.grey[400];
  const vesselFill = theme.palette.grey[100];
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const holdupColor = theme.palette.warning.light;
  const bgColor = theme.palette.background.paper;

  // SVG dimensions
  const svgW = 520;
  const svgH = 320;

  // Layout positions
  const vesselX = 30;
  const vesselY = 20;
  const vesselW = 70;
  const vesselH = 60;
  const nozzleX = vesselX + vesselW / 2;
  const nozzleTopY = vesselY + vesselH;

  // Standpipe (holdup) goes down from vessel
  const holdupTopY = nozzleTopY + 5;
  const holdupH = 120;
  const holdupBottomY = holdupTopY + holdupH;

  // Reducer at bottom of standpipe
  const reducerY = holdupBottomY;
  const reducerH = 15;

  // Suction pipe horizontal run
  const suctionY = reducerY + reducerH;
  const suctionStartX = nozzleX;
  const teeX = suctionStartX + 60;
  const elbowX = teeX + 50;
  const valveStartX = elbowX + 10;
  const valveEndX = valveStartX + 40;
  const strainerStartX = valveEndX + 10;
  const strainerEndX = strainerStartX + 35;
  const pumpX = strainerEndX + 25;
  const pumpR = 20;

  // Pump CL
  const pumpCLY = suctionY;

  // Pipe widths
  const nozzleW = 10;
  const suctionW = 6;

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
        Suction System Arrangement
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: svgH }}>
        <defs>
          <marker id="arr-dim" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
          </marker>
          <marker id="arr-dim-rev" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill={dimColor} />
          </marker>
          <marker id="arr-acc" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
          </marker>
          <marker id="arr-acc-rev" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill={accentColor} />
          </marker>
        </defs>

        {/* === Vessel === */}
        <rect
          x={vesselX}
          y={vesselY}
          width={vesselW}
          height={vesselH}
          rx={4}
          fill={vesselFill}
          stroke={vesselColor}
          strokeWidth={2}
        />
        <text
          x={vesselX + vesselW / 2}
          y={vesselY + 20}
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          fill={pipeColor}
        >
          Effect
        </text>
        {result && (
          <text
            x={vesselX + vesselW / 2}
            y={vesselY + 35}
            textAnchor="middle"
            fontSize={9}
            fill={dimColor}
          >
            {result.fluidTemperature.toFixed(0)}°C
          </text>
        )}
        <text
          x={vesselX + vesselW / 2}
          y={vesselY + 48}
          textAnchor="middle"
          fontSize={8}
          fill={dimColor}
        >
          {result
            ? `${(parseFloat(result.vaporPressure.toFixed(3)) * 1000).toFixed(0)} mbar`
            : 'P (vacuum)'}
        </text>

        {/* === Nozzle / Standpipe (holdup) === */}
        <rect
          x={nozzleX - nozzleW / 2}
          y={holdupTopY}
          width={nozzleW}
          height={holdupH}
          fill="none"
          stroke={pipeColor}
          strokeWidth={2}
        />

        {/* Holdup highlight */}
        <rect
          x={nozzleX - nozzleW / 2 + 1}
          y={holdupTopY + 1}
          width={nozzleW - 2}
          height={holdupH - 2}
          fill={holdupColor}
          opacity={0.25}
        />

        {/* Level gauge indicator (alongside standpipe) */}
        <line
          x1={nozzleX + nozzleW / 2 + 6}
          y1={holdupTopY + 10}
          x2={nozzleX + nozzleW / 2 + 6}
          y2={holdupBottomY - 10}
          stroke={theme.palette.success.main}
          strokeWidth={2}
          strokeDasharray="4,3"
        />
        <text
          x={nozzleX + nozzleW / 2 + 12}
          y={holdupTopY + holdupH / 2}
          fontSize={7}
          fill={theme.palette.success.main}
        >
          LG
        </text>

        {/* Nozzle pipe label */}
        {result && (
          <text
            x={nozzleX - nozzleW / 2 - 4}
            y={holdupTopY + holdupH / 2}
            textAnchor="end"
            fontSize={8}
            fill={pipeColor}
          >
            {result.nozzlePipe.nps}&quot;
          </text>
        )}

        {/* === Reducer (nozzle → suction) === */}
        <path
          d={`M ${nozzleX - nozzleW / 2} ${reducerY}
              L ${nozzleX - suctionW / 2} ${reducerY + reducerH}
              L ${nozzleX + suctionW / 2} ${reducerY + reducerH}
              L ${nozzleX + nozzleW / 2} ${reducerY}
              Z`}
          fill="none"
          stroke={pipeColor}
          strokeWidth={1.5}
        />

        {/* === Suction pipe horizontal run === */}
        <line
          x1={suctionStartX}
          y1={suctionY}
          x2={pumpX - pumpR}
          y2={suctionY}
          stroke={pipeColor}
          strokeWidth={suctionW}
          strokeLinecap="round"
        />

        {/* Water fill in suction pipe */}
        <line
          x1={suctionStartX}
          y1={suctionY}
          x2={pumpX - pumpR}
          y2={suctionY}
          stroke={waterColor}
          strokeWidth={suctionW - 2}
          strokeLinecap="round"
          opacity={0.35}
        />

        {/* === TEE indicator === */}
        <circle cx={teeX} cy={suctionY} r={3} fill={pipeColor} />
        <line
          x1={teeX}
          y1={suctionY}
          x2={teeX}
          y2={suctionY + 25}
          stroke={pipeColor}
          strokeWidth={suctionW - 1}
        />
        <text x={teeX} y={suctionY + 38} textAnchor="middle" fontSize={7} fill={dimColor}>
          TEE
        </text>
        <text x={teeX} y={suctionY + 48} textAnchor="middle" fontSize={6} fill={dimColor}>
          (1W+1S)
        </text>

        {/* === Elbow indicator === */}
        <circle cx={elbowX} cy={suctionY} r={3} fill={pipeColor} />
        <text x={elbowX} y={suctionY - 8} textAnchor="middle" fontSize={7} fill={dimColor}>
          {result
            ? `${result.fittings.find((f) => f.name.includes('Elbow'))?.count ?? 0}× 90°`
            : '90°'}
        </text>

        {/* === Valve symbol (simplified) === */}
        <path
          d={`M ${valveStartX} ${suctionY - 6}
              L ${(valveStartX + valveEndX) / 2} ${suctionY + 6}
              L ${valveEndX} ${suctionY - 6}`}
          fill="none"
          stroke={pipeColor}
          strokeWidth={1.5}
        />
        <path
          d={`M ${valveStartX} ${suctionY + 6}
              L ${(valveStartX + valveEndX) / 2} ${suctionY - 6}
              L ${valveEndX} ${suctionY + 6}`}
          fill="none"
          stroke={pipeColor}
          strokeWidth={1.5}
        />
        <text
          x={(valveStartX + valveEndX) / 2}
          y={suctionY + 20}
          textAnchor="middle"
          fontSize={7}
          fill={dimColor}
        >
          {result ? (result.valveType === 'gate' ? 'Gate' : 'Ball') : 'Valve'}
        </text>

        {/* === Strainer symbol (Y shape) === */}
        <line
          x1={strainerStartX}
          y1={suctionY}
          x2={strainerEndX}
          y2={suctionY}
          stroke={pipeColor}
          strokeWidth={1.5}
        />
        <line
          x1={(strainerStartX + strainerEndX) / 2}
          y1={suctionY}
          x2={(strainerStartX + strainerEndX) / 2 + 8}
          y2={suctionY + 14}
          stroke={pipeColor}
          strokeWidth={1.5}
        />
        <circle
          cx={(strainerStartX + strainerEndX) / 2 + 8}
          cy={suctionY + 14}
          r={4}
          fill="none"
          stroke={pipeColor}
          strokeWidth={1}
        />
        <text
          x={(strainerStartX + strainerEndX) / 2}
          y={suctionY - 8}
          textAnchor="middle"
          fontSize={7}
          fill={dimColor}
        >
          {result ? (result.strainerType === 'bucket_type' ? 'Bucket' : 'Y-Type') : 'Strainer'}
        </text>

        {/* === Pump symbol (circle with arrow) === */}
        <circle
          cx={pumpX}
          cy={pumpCLY}
          r={pumpR}
          fill={vesselFill}
          stroke={pipeColor}
          strokeWidth={2}
        />
        {/* Impeller arrow inside pump */}
        <path
          d={`M ${pumpX - 8} ${pumpCLY + 5}
              L ${pumpX + 5} ${pumpCLY - 8}
              L ${pumpX + 2} ${pumpCLY - 2}
              L ${pumpX + 8} ${pumpCLY - 5}
              L ${pumpX - 5} ${pumpCLY + 8}
              L ${pumpX - 2} ${pumpCLY + 2}Z`}
          fill={pipeColor}
          opacity={0.4}
        />
        <text
          x={pumpX}
          y={pumpCLY + pumpR + 14}
          textAnchor="middle"
          fontSize={9}
          fontWeight="bold"
          fill={pipeColor}
        >
          PUMP
        </text>

        {/* === Dimension: Total elevation === */}
        {result && (
          <>
            {/* Elevation arrow on the far left */}
            <line
              x1={vesselX - 15}
              y1={nozzleTopY}
              x2={vesselX - 15}
              y2={pumpCLY}
              stroke={accentColor}
              strokeWidth={1.5}
              markerStart="url(#arr-acc-rev)"
              markerEnd="url(#arr-acc)"
            />
            <text
              x={vesselX - 20}
              y={(nozzleTopY + pumpCLY) / 2 - 6}
              textAnchor="end"
              fontSize={9}
              fontWeight="bold"
              fill={accentColor}
            >
              {result.requiredElevation.toFixed(2)} m
            </text>
            <text
              x={vesselX - 20}
              y={(nozzleTopY + pumpCLY) / 2 + 6}
              textAnchor="end"
              fontSize={7}
              fill={accentColor}
            >
              (required)
            </text>

            {/* Holdup height dimension */}
            <line
              x1={nozzleX + nozzleW / 2 + 22}
              y1={holdupTopY}
              x2={nozzleX + nozzleW / 2 + 22}
              y2={holdupBottomY}
              stroke={dimColor}
              strokeWidth={1}
              strokeDasharray="3,2"
              markerStart="url(#arr-dim-rev)"
              markerEnd="url(#arr-dim)"
            />
            <text
              x={nozzleX + nozzleW / 2 + 28}
              y={holdupTopY + holdupH / 2}
              fontSize={7}
              fill={dimColor}
            >
              {result.holdup.governingHeight.toFixed(1)} m
            </text>
            <text
              x={nozzleX + nozzleW / 2 + 28}
              y={holdupTopY + holdupH / 2 + 10}
              fontSize={6}
              fill={dimColor}
            >
              holdup
            </text>

            {/* Suction pipe label */}
            <text
              x={(suctionStartX + pumpX) / 2}
              y={suctionY + suctionW + 12}
              textAnchor="middle"
              fontSize={8}
              fill={pipeColor}
            >
              {result.suctionPipe.nps}&quot; Sch 40 (DN{result.suctionPipe.dn})
            </text>

            {/* Flow direction */}
            <text x={nozzleX} y={holdupTopY + 16} textAnchor="middle" fontSize={7} fill={dimColor}>
              {'↓'}
            </text>
            <text
              x={(teeX + elbowX) / 2}
              y={suctionY - 12}
              textAnchor="middle"
              fontSize={7}
              fill={dimColor}
            >
              flow →
            </text>
          </>
        )}

        {/* === No-result placeholder === */}
        {!result && (
          <>
            <text
              x={svgW / 2}
              y={svgH / 2 - 8}
              textAnchor="middle"
              fontSize={12}
              fill={dimColor}
              opacity={0.5}
            >
              Suction System Layout
            </text>
            <text
              x={svgW / 2}
              y={svgH / 2 + 8}
              textAnchor="middle"
              fontSize={10}
              fill={dimColor}
              opacity={0.5}
            >
              Enter parameters to see dimensions
            </text>
          </>
        )}
      </svg>
    </Box>
  );
}
