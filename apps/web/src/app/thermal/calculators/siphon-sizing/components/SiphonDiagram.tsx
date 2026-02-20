'use client';

import { Box, Typography, useTheme } from '@mui/material';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import type { ElbowConfig } from './types';

interface SiphonDiagramProps {
  result: SiphonSizingResult | null;
  elbowConfig: ElbowConfig;
  horizontalDistance: number;
  offsetDistance: number;
}

/**
 * SVG diagram of the siphon U-pipe between two effects.
 *
 * Configurations:
 * - 2 elbows: simple U-pipe in same plane
 * - 3 elbows: lateral offset (different plane nozzles)
 * - 4 elbows: same plane, but routes around adjacent siphon (jog out + jog back)
 */
export function SiphonDiagram({
  result,
  elbowConfig,
  horizontalDistance,
  offsetDistance,
}: SiphonDiagramProps) {
  const theme = useTheme();

  // Colors
  const pipeColor = theme.palette.grey[700];
  const waterColor = theme.palette.info.main;
  const waterLightColor = theme.palette.info.light;
  const vesselColor = theme.palette.grey[400];
  const vesselFill = theme.palette.grey[100];
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const bgColor = theme.palette.background.paper;

  // SVG dimensions
  const svgW = 480;
  const svgH = elbowConfig === '2_elbows' ? 300 : 340;

  // Layout constants
  const vesselW = 80;
  const vesselH = 50;
  const pipeW = 8;

  // Vessel positions
  const leftVesselX = 50;
  const rightVesselX = 350;
  const vesselY = 20;

  // Nozzle positions (bottom center of vessels)
  const leftNozzleX = leftVesselX + vesselW / 2;
  const rightNozzleX = rightVesselX + vesselW / 2;
  const nozzleY = vesselY + vesselH;

  // U-bend bottom
  const uBendY = svgH - 40;

  // Compute proportional heights for static head
  const totalHeight = uBendY - nozzleY;
  let staticHeadPx = 0;
  if (result) {
    const ratio = result.staticHead / result.minimumHeight;
    staticHeadPx = ratio * totalHeight;
  }

  // Water levels
  const downstreamWaterY = nozzleY;
  const upstreamWaterY = nozzleY + staticHeadPx;

  // Midpoints for jog/offset rendering
  const midX = (leftNozzleX + rightNozzleX) / 2;
  const jogH = 30; // vertical pixels for the jog visual

  // Build pipe path and elbow positions based on config
  let pipePath: string;
  let elbowPositions: Array<{ x: number; y: number }>;
  let waterBottomPath: string;
  let downstreamBottomY: number;

  switch (elbowConfig) {
    case '2_elbows':
      // Simple U: down → horizontal → up
      pipePath = `M ${leftNozzleX} ${nozzleY}
        L ${leftNozzleX} ${uBendY}
        L ${rightNozzleX} ${uBendY}
        L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY} L ${rightNozzleX} ${uBendY}`;
      downstreamBottomY = uBendY;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: rightNozzleX, y: uBendY },
      ];
      break;

    case '3_elbows':
      // Different plane: down → horizontal → diagonal offset → up
      pipePath = `M ${leftNozzleX} ${nozzleY}
        L ${leftNozzleX} ${uBendY}
        L ${midX - 15} ${uBendY}
        L ${midX + 15} ${uBendY - jogH}
        L ${rightNozzleX} ${uBendY - jogH}
        L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY}
        L ${midX - 15} ${uBendY}
        L ${midX + 15} ${uBendY - jogH}
        L ${rightNozzleX} ${uBendY - jogH}`;
      downstreamBottomY = uBendY - jogH;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: midX - 15, y: uBendY },
        { x: rightNozzleX, y: uBendY - jogH },
      ];
      break;

    case '4_elbows':
      // Same plane, routing around: down → horizontal → jog out → jog back → horizontal → up
      pipePath = `M ${leftNozzleX} ${nozzleY}
        L ${leftNozzleX} ${uBendY}
        L ${midX - 30} ${uBendY}
        L ${midX - 30} ${uBendY - jogH}
        L ${midX + 30} ${uBendY - jogH}
        L ${midX + 30} ${uBendY}
        L ${rightNozzleX} ${uBendY}
        L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY}
        L ${midX - 30} ${uBendY}
        L ${midX - 30} ${uBendY - jogH}
        L ${midX + 30} ${uBendY - jogH}
        L ${midX + 30} ${uBendY}
        L ${rightNozzleX} ${uBendY}`;
      downstreamBottomY = uBendY;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: midX - 30, y: uBendY },
        { x: midX - 30, y: uBendY - jogH },
        { x: midX + 30, y: uBendY },
      ];
      break;
  }

  // Label for the "other siphon" in 4-elbow mode
  const showOtherSiphon = elbowConfig === '4_elbows';

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
        Siphon Arrangement
      </Typography>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: svgH }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
          </marker>
          <marker
            id="arrowhead-rev"
            markerWidth="8"
            markerHeight="6"
            refX="0"
            refY="3"
            orient="auto"
          >
            <polygon points="8 0, 0 3, 8 6" fill={dimColor} />
          </marker>
          <marker
            id="arrowhead-accent"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
          </marker>
          <marker
            id="arrowhead-accent-rev"
            markerWidth="8"
            markerHeight="6"
            refX="0"
            refY="3"
            orient="auto"
          >
            <polygon points="8 0, 0 3, 8 6" fill={accentColor} />
          </marker>
        </defs>

        {/* === Vessels === */}
        <rect
          x={leftVesselX}
          y={vesselY}
          width={vesselW}
          height={vesselH}
          rx={4}
          fill={vesselFill}
          stroke={vesselColor}
          strokeWidth={2}
        />
        <text
          x={leftVesselX + vesselW / 2}
          y={vesselY + 18}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill={pipeColor}
        >
          Effect N
        </text>
        <text
          x={leftVesselX + vesselW / 2}
          y={vesselY + 34}
          textAnchor="middle"
          fontSize={10}
          fill={dimColor}
        >
          {result ? `${result.fluidTemperature.toFixed(1)}°C` : 'P\u2081 (higher)'}
        </text>

        <rect
          x={rightVesselX}
          y={vesselY}
          width={vesselW}
          height={vesselH}
          rx={4}
          fill={vesselFill}
          stroke={vesselColor}
          strokeWidth={2}
        />
        <text
          x={rightVesselX + vesselW / 2}
          y={vesselY + 18}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill={pipeColor}
        >
          Effect N+1
        </text>
        <text
          x={rightVesselX + vesselW / 2}
          y={vesselY + 34}
          textAnchor="middle"
          fontSize={10}
          fill={dimColor}
        >
          {result ? `${result.downstreamSatTemp.toFixed(1)}°C` : 'P\u2082 (lower)'}
        </text>

        {/* === "Other siphon" indicator for 4-elbow config === */}
        {showOtherSiphon && (
          <>
            <line
              x1={midX}
              y1={nozzleY + 10}
              x2={midX}
              y2={uBendY + 5}
              stroke={theme.palette.grey[300]}
              strokeWidth={6}
              strokeDasharray="8,4"
              strokeLinecap="round"
            />
            <text
              x={midX}
              y={nozzleY + 25}
              textAnchor="middle"
              fontSize={8}
              fill={theme.palette.grey[400]}
            >
              other
            </text>
            <text
              x={midX}
              y={nozzleY + 35}
              textAnchor="middle"
              fontSize={8}
              fill={theme.palette.grey[400]}
            >
              siphon
            </text>
          </>
        )}

        {/* === Pipe outline === */}
        <path
          d={pipePath}
          fill="none"
          stroke={pipeColor}
          strokeWidth={pipeW}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* === Water fill === */}
        {result && (
          <>
            {/* Downstream leg */}
            <line
              x1={rightNozzleX}
              y1={downstreamWaterY}
              x2={rightNozzleX}
              y2={downstreamBottomY}
              stroke={waterColor}
              strokeWidth={pipeW - 2}
              strokeLinecap="round"
              opacity={0.5}
            />

            {/* Bottom section */}
            <path
              d={waterBottomPath}
              fill="none"
              stroke={waterColor}
              strokeWidth={pipeW - 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.5}
            />

            {/* Upstream leg */}
            <line
              x1={leftNozzleX}
              y1={upstreamWaterY}
              x2={leftNozzleX}
              y2={uBendY}
              stroke={waterColor}
              strokeWidth={pipeW - 2}
              strokeLinecap="round"
              opacity={0.5}
            />

            {/* Water level indicators */}
            <line
              x1={leftNozzleX - 12}
              y1={upstreamWaterY}
              x2={leftNozzleX + 12}
              y2={upstreamWaterY}
              stroke={waterLightColor}
              strokeWidth={2}
            />
            <line
              x1={rightNozzleX - 12}
              y1={downstreamWaterY}
              x2={rightNozzleX + 12}
              y2={downstreamWaterY}
              stroke={waterLightColor}
              strokeWidth={2}
            />
          </>
        )}

        {/* === Elbow indicators === */}
        {elbowPositions.map((pos, i) => (
          <circle key={i} cx={pos.x} cy={pos.y} r={3} fill={pipeColor} />
        ))}

        {/* === Dimension annotations === */}
        {result && (
          <>
            {/* Minimum siphon height — right side */}
            <line
              x1={rightNozzleX + 30}
              y1={nozzleY}
              x2={rightNozzleX + 30}
              y2={downstreamBottomY}
              stroke={accentColor}
              strokeWidth={1.5}
              markerStart="url(#arrowhead-accent-rev)"
              markerEnd="url(#arrowhead-accent)"
            />
            <text
              x={rightNozzleX + 38}
              y={(nozzleY + downstreamBottomY) / 2 - 6}
              fontSize={10}
              fontWeight="bold"
              fill={accentColor}
            >
              Min. Height
            </text>
            <text
              x={rightNozzleX + 38}
              y={(nozzleY + downstreamBottomY) / 2 + 8}
              fontSize={10}
              fontWeight="bold"
              fill={accentColor}
            >
              {result.minimumHeight.toFixed(2)} m
            </text>

            {/* Static head — left side */}
            {staticHeadPx > 5 && (
              <>
                <line
                  x1={leftNozzleX - 25}
                  y1={nozzleY}
                  x2={leftNozzleX - 25}
                  y2={upstreamWaterY}
                  stroke={dimColor}
                  strokeWidth={1}
                  strokeDasharray="3,2"
                  markerStart="url(#arrowhead-rev)"
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={leftNozzleX - 30}
                  y={(nozzleY + upstreamWaterY) / 2}
                  textAnchor="end"
                  fontSize={9}
                  fill={dimColor}
                >
                  {result.staticHead.toFixed(2)} m
                </text>
                <text
                  x={leftNozzleX - 30}
                  y={(nozzleY + upstreamWaterY) / 2 + 12}
                  textAnchor="end"
                  fontSize={8}
                  fill={dimColor}
                >
                  (static head)
                </text>
              </>
            )}

            {/* Horizontal distance — bottom */}
            <line
              x1={leftNozzleX}
              y1={uBendY + 18}
              x2={rightNozzleX}
              y2={uBendY + 18}
              stroke={dimColor}
              strokeWidth={1}
              markerStart="url(#arrowhead-rev)"
              markerEnd="url(#arrowhead)"
            />
            <text
              x={(leftNozzleX + rightNozzleX) / 2}
              y={uBendY + 30}
              textAnchor="middle"
              fontSize={9}
              fill={dimColor}
            >
              {horizontalDistance.toFixed(1)} m
              {elbowConfig !== '2_elbows' && offsetDistance > 0
                ? ` + ${offsetDistance.toFixed(1)} m offset`
                : ''}
            </text>

            {/* Pipe size label */}
            <text
              x={(leftNozzleX + rightNozzleX) / 2}
              y={elbowConfig === '4_elbows' ? uBendY - jogH - 8 : uBendY - 12}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill={pipeColor}
            >
              {result.pipe.nps}&quot; Sch 40 (DN{result.pipe.dn})
            </text>

            {/* Flow direction arrows */}
            <text x={leftNozzleX + 10} y={nozzleY + 50} fontSize={9} fill={dimColor}>
              &#x2193; flow
            </text>
            <text
              x={rightNozzleX - 10}
              y={nozzleY + 50}
              textAnchor="end"
              fontSize={9}
              fill={dimColor}
            >
              flow &#x2191;
            </text>
          </>
        )}

        {/* === Labels when no result === */}
        {!result && (
          <>
            <text
              x={(leftNozzleX + rightNozzleX) / 2}
              y={(nozzleY + uBendY) / 2}
              textAnchor="middle"
              fontSize={12}
              fill={dimColor}
              opacity={0.5}
            >
              Siphon U-pipe
            </text>
            <text
              x={(leftNozzleX + rightNozzleX) / 2}
              y={(nozzleY + uBendY) / 2 + 16}
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
