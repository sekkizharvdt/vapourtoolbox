'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type { TVCResult } from '@/lib/thermal/tvcCalculator';

interface TVCDiagramProps {
  result: TVCResult | null;
}

/**
 * SVG diagram of the steam ejector (TVC).
 *
 * Shows:
 *  - Motive steam nozzle (left, narrowing cone)
 *  - Suction vapor inlet (bottom)
 *  - Mixing chamber and diffuser
 *  - Discharge outlet (right)
 *  - Flow and pressure annotations when result is available
 */
export function TVCDiagram({ result }: TVCDiagramProps) {
  const theme = useTheme();

  const pipeColor = theme.palette.grey[700];
  const vesselFill = theme.palette.grey[100];
  const vesselColor = theme.palette.grey[400];
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const motiveColor = theme.palette.error.light;
  const suctionColor = theme.palette.info.main;
  const dischargeColor = theme.palette.success.light;
  const bgColor = theme.palette.background.paper;

  const svgW = 480;
  const svgH = 270;

  // Ejector body dimensions
  const bodyY = 90;
  const bodyH = 60; // overall height
  const bodyMidY = bodyY + bodyH / 2;

  // Motive nozzle (converging cone, left side)
  // Nozzle inlet = full pipe, nozzle throat is narrowed
  const nozzleInletX = 20;
  const nozzleThroatX = 130;
  const nozzleHalfH = bodyH / 2; // half-height at inlet
  const nozzleThroatHalfH = 10; // half-height at throat

  // Mixing chamber (throat to diffuser inlet)
  const mixingX1 = nozzleThroatX;
  const mixingX2 = 280;

  // Diffuser (expanding from mixingX2 to outlet)
  const diffuserX2 = 420;
  const diffuserOutHalfH = 16;

  // Discharge pipe
  const dischargeX1 = diffuserX2;
  const dischargeX2 = svgW - 20;
  const dischargePipeH = 12;

  // Suction inlet (bottom)
  const suctionX = 180;
  const suctionY1 = bodyY + bodyH;
  const suctionY2 = svgH - 20;

  // Ejector body path (closed polygon)
  const ejectorBodyPath = `
    M ${nozzleInletX} ${bodyMidY - nozzleHalfH}
    L ${nozzleThroatX} ${bodyMidY - nozzleThroatHalfH}
    L ${mixingX2} ${bodyMidY - nozzleThroatHalfH}
    L ${diffuserX2} ${bodyMidY - diffuserOutHalfH}
    L ${diffuserX2} ${bodyMidY + diffuserOutHalfH}
    L ${mixingX2} ${bodyMidY + nozzleThroatHalfH}
    L ${nozzleThroatX} ${bodyMidY + nozzleThroatHalfH}
    L ${nozzleInletX} ${bodyMidY + nozzleHalfH}
    Z
  `;

  // Motive nozzle inner path (fills just the converging nozzle section)
  const nozzleFillPath = `
    M ${nozzleInletX} ${bodyMidY - nozzleHalfH}
    L ${nozzleThroatX} ${bodyMidY - nozzleThroatHalfH}
    L ${nozzleThroatX} ${bodyMidY + nozzleThroatHalfH}
    L ${nozzleInletX} ${bodyMidY + nozzleHalfH}
    Z
  `;

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
        TVC Ejector Arrangement
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: svgH }}>
        <defs>
          <marker id="tvc-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
          </marker>
          <marker
            id="tvc-arrow-accent"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
          </marker>
          <marker
            id="tvc-arrow-suction"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 8 3, 0 6" fill={suctionColor} />
          </marker>
        </defs>

        {/* === Ejector body (filled) === */}
        <path d={ejectorBodyPath} fill={vesselFill} stroke={vesselColor} strokeWidth={2} />

        {/* === Motive nozzle fill (coloured) === */}
        <path d={nozzleFillPath} fill={motiveColor} fillOpacity={0.25} />

        {/* === Motive inlet pipe (left) === */}
        <line
          x1={nozzleInletX - 20}
          y1={bodyMidY}
          x2={nozzleInletX}
          y2={bodyMidY}
          stroke={motiveColor}
          strokeWidth={8}
          strokeLinecap="round"
        />

        {/* === Discharge pipe (right) === */}
        <rect
          x={dischargeX1}
          y={bodyMidY - dischargePipeH / 2}
          width={dischargeX2 - dischargeX1}
          height={dischargePipeH}
          fill={dischargeColor}
          fillOpacity={0.35}
          stroke={pipeColor}
          strokeWidth={1.5}
        />

        {/* === Suction inlet pipe (bottom) === */}
        <line
          x1={suctionX}
          y1={suctionY1}
          x2={suctionX}
          y2={suctionY2}
          stroke={suctionColor}
          strokeWidth={6}
          strokeLinecap="round"
        />

        {/* === Zone labels inside body === */}
        <text
          x={(nozzleInletX + nozzleThroatX) / 2}
          y={bodyMidY - nozzleHalfH / 2 - 4}
          textAnchor="middle"
          fontSize={8}
          fill={dimColor}
        >
          Nozzle
        </text>
        <text
          x={(mixingX1 + mixingX2) / 2}
          y={bodyMidY - nozzleThroatHalfH - 6}
          textAnchor="middle"
          fontSize={8}
          fill={dimColor}
        >
          Mixing chamber
        </text>
        <text
          x={(mixingX2 + diffuserX2) / 2}
          y={bodyMidY - 14}
          textAnchor="middle"
          fontSize={8}
          fill={dimColor}
        >
          Diffuser
        </text>

        {/* === Nozzle throat divider line === */}
        <line
          x1={nozzleThroatX}
          y1={bodyMidY - nozzleThroatHalfH}
          x2={nozzleThroatX}
          y2={bodyMidY + nozzleThroatHalfH}
          stroke={vesselColor}
          strokeWidth={1}
          strokeDasharray="3,2"
        />
        <line
          x1={mixingX2}
          y1={bodyMidY - nozzleThroatHalfH}
          x2={mixingX2}
          y2={bodyMidY + nozzleThroatHalfH}
          stroke={vesselColor}
          strokeWidth={1}
          strokeDasharray="3,2"
        />

        {/* === Flow direction arrows === */}
        {/* Motive → right */}
        <line
          x1={nozzleInletX - 12}
          y1={bodyMidY}
          x2={nozzleInletX - 2}
          y2={bodyMidY}
          stroke={dimColor}
          strokeWidth={1.5}
          markerEnd="url(#tvc-arrow)"
        />
        {/* Discharge → right */}
        <line
          x1={dischargeX2 - 40}
          y1={bodyMidY}
          x2={dischargeX2 - 10}
          y2={bodyMidY}
          stroke={dimColor}
          strokeWidth={1.5}
          markerEnd="url(#tvc-arrow)"
        />
        {/* Suction ↑ */}
        <line
          x1={suctionX}
          y1={suctionY2 - 30}
          x2={suctionX}
          y2={suctionY2 - 10}
          stroke={suctionColor}
          strokeWidth={1.5}
          markerEnd="url(#tvc-arrow-suction)"
        />

        {/* === Labels & annotations when result available === */}
        {result ? (
          <>
            {/* Motive steam label (above inlet pipe) */}
            <text
              x={nozzleInletX - 10}
              y={bodyMidY - 16}
              fontSize={9}
              fontWeight="bold"
              fill={motiveColor.replace('light', '')}
            >
              Motive
            </text>
            <text x={nozzleInletX - 10} y={bodyMidY - 6} fontSize={8} fill={dimColor}>
              {result.motiveFlow.toFixed(2)} t/hr
            </text>
            <text x={nozzleInletX - 10} y={bodyMidY + 18} fontSize={8} fill={dimColor}>
              {result.motiveEnthalpy.toFixed(0)} kJ/kg
            </text>

            {/* Suction label */}
            <text
              x={suctionX + 8}
              y={suctionY2 - 18}
              fontSize={9}
              fontWeight="bold"
              fill={suctionColor}
            >
              Suction
            </text>
            <text x={suctionX + 8} y={suctionY2 - 6} fontSize={8} fill={dimColor}>
              {result.entrainedFlow.toFixed(2)} t/hr
            </text>
            <text x={suctionX + 8} y={suctionY2 + 6} fontSize={8} fill={dimColor}>
              {result.suctionEnthalpy.toFixed(0)} kJ/kg
            </text>

            {/* Discharge label */}
            <text
              x={dischargeX1 + (dischargeX2 - dischargeX1) / 2}
              y={bodyMidY - dischargePipeH / 2 - 12}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={accentColor}
            >
              Discharge
            </text>
            <text
              x={dischargeX1 + (dischargeX2 - dischargeX1) / 2}
              y={bodyMidY - dischargePipeH / 2 - 2}
              textAnchor="middle"
              fontSize={8}
              fill={dimColor}
            >
              {result.dischargeFlow.toFixed(2)} t/hr
            </text>
            <text
              x={dischargeX1 + (dischargeX2 - dischargeX1) / 2}
              y={bodyMidY + dischargePipeH / 2 + 10}
              textAnchor="middle"
              fontSize={8}
              fill={dimColor}
            >
              {result.dischargeEnthalpy.toFixed(0)} kJ/kg
            </text>

            {/* Entrainment ratio banner at top */}
            <text
              x={svgW / 2}
              y={bodyY - 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill={accentColor}
            >
              Ra = {result.entrainmentRatio.toFixed(3)} | CR = {result.compressionRatio.toFixed(2)}{' '}
              | η = {(result.ejectorEfficiency * 100).toFixed(1)}%
            </text>

            {/* Superheat annotation */}
            <text
              x={dischargeX1 + (dischargeX2 - dischargeX1) / 2}
              y={bodyMidY + dischargePipeH / 2 + 20}
              textAnchor="middle"
              fontSize={8}
              fill={dimColor}
            >
              +{result.dischargeSuperheat.toFixed(1)}°C SH
            </text>
          </>
        ) : (
          <>
            {/* Static labels */}
            <text
              x={nozzleInletX - 18}
              y={bodyMidY - 14}
              fontSize={9}
              fill={dimColor}
              opacity={0.6}
              textAnchor="middle"
            >
              Motive
            </text>
            <text
              x={nozzleInletX - 18}
              y={bodyMidY - 4}
              fontSize={9}
              fill={dimColor}
              opacity={0.6}
              textAnchor="middle"
            >
              steam
            </text>
            <text
              x={suctionX}
              y={suctionY2 - 6}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
              opacity={0.6}
            >
              Suction vapor
            </text>
            <text
              x={dischargeX1 + (dischargeX2 - dischargeX1) / 2}
              y={bodyMidY - dischargePipeH / 2 - 6}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
              opacity={0.6}
            >
              Discharge
            </text>
          </>
        )}
      </svg>
    </Box>
  );
}
