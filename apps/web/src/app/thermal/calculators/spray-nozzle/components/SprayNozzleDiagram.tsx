'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type { NozzleMatch, NozzleCategory } from '@/lib/thermal/sprayNozzleCalculator';

interface SprayNozzleDiagramProps {
  /** Best match nozzle (first in results), or null for placeholder */
  bestMatch: NozzleMatch | null;
  /** Nozzle category for label */
  category: NozzleCategory;
  /** Spray distance in mm, if provided */
  sprayDistance?: number;
}

const CATEGORY_LABELS: Record<NozzleCategory, string> = {
  full_cone_circular: 'Full Cone',
  full_cone_wide: 'Full Cone (Wide)',
  full_cone_square: 'Full Cone (Square)',
  hollow_cone_circular: 'Hollow Cone',
};

/**
 * SVG diagram showing the spray nozzle pattern — cone shape with angle
 * annotation, coverage width at spray distance, and nozzle body.
 * Updates reactively with the selected nozzle's spray angle and distance.
 */
export function SprayNozzleDiagram({
  bestMatch,
  category,
  sprayDistance,
}: SprayNozzleDiagramProps) {
  const theme = useTheme();

  const pipeColor = theme.palette.grey[700];
  const sprayColor = theme.palette.info.main;
  const sprayFill = theme.palette.info.light;
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const bgColor = theme.palette.background.paper;

  const isHollow = category === 'hollow_cone_circular';
  const isSquare = category === 'full_cone_square';

  const svgW = 360;
  const svgH = 280;

  // Nozzle body position
  const nozzleCx = svgW / 2;
  const nozzleTopY = 30;
  const nozzleBodyH = 30;
  const nozzleTipY = nozzleTopY + nozzleBodyH;

  // Spray cone geometry
  const coneLength = 180; // px length of cone
  const targetY = nozzleTipY + coneLength;

  const angle = bestMatch ? bestMatch.sprayAngle : 60;
  const halfAngleRad = ((angle / 2) * Math.PI) / 180;
  const halfSpread = coneLength * Math.tan(halfAngleRad);

  // Clamp spread for rendering
  const maxSpread = (svgW - 40) / 2;
  const spread = Math.min(halfSpread, maxSpread);

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
        Spray Pattern
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: svgH }}>
        <defs>
          <marker id="sn-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
          </marker>
          <marker
            id="sn-arrow-rev"
            markerWidth="8"
            markerHeight="6"
            refX="0"
            refY="3"
            orient="auto"
          >
            <polygon points="8 0, 0 3, 8 6" fill={dimColor} />
          </marker>
          <marker
            id="sn-arrow-accent"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
          </marker>
          <marker
            id="sn-arrow-accent-rev"
            markerWidth="8"
            markerHeight="6"
            refX="0"
            refY="3"
            orient="auto"
          >
            <polygon points="8 0, 0 3, 8 6" fill={accentColor} />
          </marker>
          {/* Gradient for spray cone */}
          <linearGradient id="spray-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sprayFill} stopOpacity={0.7} />
            <stop offset="100%" stopColor={sprayFill} stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {/* === Nozzle body === */}
        <rect
          x={nozzleCx - 10}
          y={nozzleTopY}
          width={20}
          height={nozzleBodyH - 8}
          rx={3}
          fill={pipeColor}
        />
        {/* Nozzle tip (trapezoid) */}
        <polygon
          points={`${nozzleCx - 10},${nozzleTipY - 10} ${nozzleCx + 10},${nozzleTipY - 10} ${nozzleCx + 6},${nozzleTipY} ${nozzleCx - 6},${nozzleTipY}`}
          fill={pipeColor}
        />
        {/* Inlet pipe */}
        <rect
          x={nozzleCx - 5}
          y={nozzleTopY - 14}
          width={10}
          height={16}
          rx={2}
          fill={theme.palette.grey[500]}
        />
        <text x={nozzleCx} y={nozzleTopY - 18} textAnchor="middle" fontSize={9} fill={dimColor}>
          {bestMatch ? `${bestMatch.nozzle.inletConn}"` : 'Inlet'}
        </text>

        {/* === Spray cone === */}
        {isSquare ? (
          // Square pattern — draw a rectangle outline
          <rect
            x={nozzleCx - spread}
            y={targetY - 4}
            width={spread * 2}
            height={8}
            fill="none"
            stroke={sprayColor}
            strokeWidth={2}
            strokeDasharray="4,3"
            rx={1}
          />
        ) : null}

        {isHollow ? (
          // Hollow cone — two lines on each side with gap in the middle
          <>
            {/* Outer cone */}
            <line
              x1={nozzleCx - 4}
              y1={nozzleTipY}
              x2={nozzleCx - spread}
              y2={targetY}
              stroke={sprayColor}
              strokeWidth={2}
            />
            <line
              x1={nozzleCx + 4}
              y1={nozzleTipY}
              x2={nozzleCx + spread}
              y2={targetY}
              stroke={sprayColor}
              strokeWidth={2}
            />
            {/* Inner cone (smaller angle ~60% of outer) */}
            <line
              x1={nozzleCx - 3}
              y1={nozzleTipY}
              x2={nozzleCx - spread * 0.4}
              y2={targetY}
              stroke={sprayColor}
              strokeWidth={1.5}
              strokeDasharray="4,3"
              opacity={0.5}
            />
            <line
              x1={nozzleCx + 3}
              y1={nozzleTipY}
              x2={nozzleCx + spread * 0.4}
              y2={targetY}
              stroke={sprayColor}
              strokeWidth={1.5}
              strokeDasharray="4,3"
              opacity={0.5}
            />
            {/* Ring at target */}
            <ellipse
              cx={nozzleCx}
              cy={targetY}
              rx={spread}
              ry={6}
              fill="none"
              stroke={sprayColor}
              strokeWidth={2}
            />
            <ellipse
              cx={nozzleCx}
              cy={targetY}
              rx={spread * 0.4}
              ry={3}
              fill="none"
              stroke={sprayColor}
              strokeWidth={1}
              strokeDasharray="3,2"
              opacity={0.5}
            />
          </>
        ) : (
          // Full cone (circular or wide) — filled triangle
          <>
            <polygon
              points={`${nozzleCx},${nozzleTipY} ${nozzleCx - spread},${targetY} ${nozzleCx + spread},${targetY}`}
              fill="url(#spray-grad)"
              stroke={sprayColor}
              strokeWidth={1.5}
            />
            {/* Impact circle/ellipse at target */}
            <ellipse
              cx={nozzleCx}
              cy={targetY}
              rx={spread}
              ry={6}
              fill={sprayFill}
              fillOpacity={0.3}
              stroke={sprayColor}
              strokeWidth={1.5}
            />
          </>
        )}

        {/* === Annotations === */}
        {bestMatch && (
          <>
            {/* Spray angle arc */}
            {(() => {
              const arcR = 40;
              const arcStartX = nozzleCx - arcR * Math.sin(halfAngleRad);
              const arcStartY = nozzleTipY + arcR * Math.cos(halfAngleRad);
              const arcEndX = nozzleCx + arcR * Math.sin(halfAngleRad);
              const arcEndY = arcStartY;
              const largeArc = angle > 180 ? 1 : 0;
              return (
                <>
                  <path
                    d={`M ${arcStartX} ${arcStartY} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEndX} ${arcEndY}`}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={1.5}
                  />
                  <text
                    x={nozzleCx}
                    y={nozzleTipY + arcR + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="bold"
                    fill={accentColor}
                  >
                    {angle}°
                  </text>
                </>
              );
            })()}

            {/* Spray distance dimension (right side) */}
            {sprayDistance && sprayDistance > 0 && (
              <>
                <line
                  x1={nozzleCx + spread + 20}
                  y1={nozzleTipY}
                  x2={nozzleCx + spread + 20}
                  y2={targetY}
                  stroke={dimColor}
                  strokeWidth={1}
                  markerStart="url(#sn-arrow-rev)"
                  markerEnd="url(#sn-arrow)"
                />
                <text
                  x={nozzleCx + spread + 28}
                  y={(nozzleTipY + targetY) / 2 - 4}
                  fontSize={9}
                  fill={dimColor}
                >
                  {sprayDistance} mm
                </text>
                <text
                  x={nozzleCx + spread + 28}
                  y={(nozzleTipY + targetY) / 2 + 8}
                  fontSize={8}
                  fill={dimColor}
                >
                  (distance)
                </text>
              </>
            )}

            {/* Coverage dimension (bottom) */}
            {bestMatch.coverage !== undefined && (
              <>
                <line
                  x1={nozzleCx - spread}
                  y1={targetY + 16}
                  x2={nozzleCx + spread}
                  y2={targetY + 16}
                  stroke={accentColor}
                  strokeWidth={1.5}
                  markerStart="url(#sn-arrow-accent-rev)"
                  markerEnd="url(#sn-arrow-accent)"
                />
                <text
                  x={nozzleCx}
                  y={targetY + 30}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill={accentColor}
                >
                  {bestMatch.coverage} mm {isSquare ? '(side)' : '(dia.)'}
                </text>
              </>
            )}

            {/* Capacity size label */}
            <text
              x={nozzleCx - spread - 10}
              y={nozzleTipY + 20}
              textAnchor="end"
              fontSize={10}
              fontWeight="bold"
              fill={pipeColor}
            >
              {bestMatch.nozzle.capacitySize}
            </text>
            <text
              x={nozzleCx - spread - 10}
              y={nozzleTipY + 32}
              textAnchor="end"
              fontSize={9}
              fill={dimColor}
            >
              {CATEGORY_LABELS[category]}
            </text>

            {/* Flow label */}
            <text
              x={nozzleCx - spread - 10}
              y={nozzleTipY + 46}
              textAnchor="end"
              fontSize={9}
              fill={dimColor}
            >
              {bestMatch.flowAtPressure} lpm
            </text>
          </>
        )}

        {/* === Placeholder when no result === */}
        {!bestMatch && (
          <>
            {/* Static cone outline */}
            <polygon
              points={`${nozzleCx},${nozzleTipY} ${nozzleCx - spread},${targetY} ${nozzleCx + spread},${targetY}`}
              fill="none"
              stroke={theme.palette.grey[300]}
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
            <text
              x={nozzleCx}
              y={(nozzleTipY + targetY) / 2 + 10}
              textAnchor="middle"
              fontSize={11}
              fill={dimColor}
              opacity={0.5}
            >
              Enter parameters to see
            </text>
            <text
              x={nozzleCx}
              y={(nozzleTipY + targetY) / 2 + 24}
              textAnchor="middle"
              fontSize={11}
              fill={dimColor}
              opacity={0.5}
            >
              spray pattern
            </text>
          </>
        )}
      </svg>
    </Box>
  );
}
