/**
 * Siphon Diagram for PDF — react-pdf native SVG
 *
 * Draws the siphon U-pipe diagram directly in the PDF using react-pdf's
 * SVG primitives. This replaces the previous DOM-capture approach
 * (SVG → canvas → PNG) which silently failed in production.
 *
 * Mirrors the layout logic in SiphonDiagram.tsx but uses react-pdf
 * components (<Svg>, <Rect>, <Line>, <Path>, <Circle>, <G>, <Text>)
 * instead of browser SVG elements.
 */

import React from 'react';
import { Svg, G, Rect, Line, Path, Circle, Polygon, Text } from '@react-pdf/renderer';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import type { ElbowConfig } from './types';

// Fixed colors for PDF (no theme dependency)
const COLORS = {
  pipe: '#616161', // grey[700]
  water: '#0288d1', // info.main
  waterLight: '#03a9f4', // info.light
  vessel: '#bdbdbd', // grey[400]
  vesselFill: '#f5f5f5', // grey[100]
  dim: '#666666', // text.secondary
  accent: '#1976d2', // primary.main
  bg: '#ffffff',
  otherSiphon: '#e0e0e0', // grey[300]
  otherSiphonText: '#bdbdbd', // grey[400]
};

interface SiphonDiagramPDFProps {
  result: SiphonSizingResult;
  elbowConfig: ElbowConfig;
  horizontalDistance: number;
  offsetDistance: number;
}

/** Draw a small arrowhead triangle pointing in the given direction */
function Arrowhead({
  x,
  y,
  direction,
  color,
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  color: string;
}) {
  const s = 4; // half-size
  let points: string;
  switch (direction) {
    case 'up':
      points = `${x},${y - s} ${x - s},${y + s} ${x + s},${y + s}`;
      break;
    case 'down':
      points = `${x},${y + s} ${x - s},${y - s} ${x + s},${y - s}`;
      break;
    case 'left':
      points = `${x - s},${y} ${x + s},${y - s} ${x + s},${y + s}`;
      break;
    case 'right':
      points = `${x + s},${y} ${x - s},${y - s} ${x - s},${y + s}`;
      break;
  }
  return <Polygon points={points} fill={color} />;
}

export function SiphonDiagramPDF({
  result,
  elbowConfig,
  horizontalDistance,
  offsetDistance,
}: SiphonDiagramPDFProps) {
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
  const ratio = result.staticHead / result.minimumHeight;
  const staticHeadPx = ratio * totalHeight;

  // Water levels
  const downstreamWaterY = nozzleY;
  const upstreamWaterY = nozzleY + staticHeadPx;

  // Midpoints for jog/offset rendering
  const midX = (leftNozzleX + rightNozzleX) / 2;
  const jogH = 30;

  // Build pipe path and elbow positions based on config
  let pipePath: string;
  let elbowPositions: Array<{ x: number; y: number }>;
  let waterBottomPath: string;
  let downstreamBottomY: number;

  switch (elbowConfig) {
    case '2_elbows':
      pipePath = `M ${leftNozzleX} ${nozzleY} L ${leftNozzleX} ${uBendY} L ${rightNozzleX} ${uBendY} L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY} L ${rightNozzleX} ${uBendY}`;
      downstreamBottomY = uBendY;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: rightNozzleX, y: uBendY },
      ];
      break;

    case '3_elbows':
      pipePath = `M ${leftNozzleX} ${nozzleY} L ${leftNozzleX} ${uBendY} L ${midX - 15} ${uBendY} L ${midX + 15} ${uBendY - jogH} L ${rightNozzleX} ${uBendY - jogH} L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY} L ${midX - 15} ${uBendY} L ${midX + 15} ${uBendY - jogH} L ${rightNozzleX} ${uBendY - jogH}`;
      downstreamBottomY = uBendY - jogH;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: midX - 15, y: uBendY },
        { x: rightNozzleX, y: uBendY - jogH },
      ];
      break;

    case '4_elbows':
      pipePath = `M ${leftNozzleX} ${nozzleY} L ${leftNozzleX} ${uBendY} L ${midX - 30} ${uBendY} L ${midX - 30} ${uBendY - jogH} L ${midX + 30} ${uBendY - jogH} L ${midX + 30} ${uBendY} L ${rightNozzleX} ${uBendY} L ${rightNozzleX} ${nozzleY}`;
      waterBottomPath = `M ${leftNozzleX} ${uBendY} L ${midX - 30} ${uBendY} L ${midX - 30} ${uBendY - jogH} L ${midX + 30} ${uBendY - jogH} L ${midX + 30} ${uBendY} L ${rightNozzleX} ${uBendY}`;
      downstreamBottomY = uBendY;
      elbowPositions = [
        { x: leftNozzleX, y: uBendY },
        { x: midX - 30, y: uBendY },
        { x: midX - 30, y: uBendY - jogH },
        { x: midX + 30, y: uBendY },
      ];
      break;
  }

  const showOtherSiphon = elbowConfig === '4_elbows';
  const pipeLabel =
    result.pipe.nps === 'CUSTOM'
      ? `Custom ID ${result.pipe.id_mm} mm`
      : `${result.pipe.nps}" Sch ${result.pipe.schedule} (DN${result.pipe.dn})`;

  return (
    <Svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: '85%', maxHeight: 220 }}>
      {/* === Vessels === */}
      <Rect
        x={String(leftVesselX)}
        y={String(vesselY)}
        width={String(vesselW)}
        height={String(vesselH)}
        rx="4"
        fill={COLORS.vesselFill}
        stroke={COLORS.vessel}
        strokeWidth={2}
      />
      <Text
        x={leftVesselX + vesselW / 2}
        y={vesselY + 18}
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'Helvetica-Bold',
          fill: COLORS.pipe,
          textAnchor: 'middle',
        }}
      >
        Effect N
      </Text>
      <Text
        x={leftVesselX + vesselW / 2}
        y={vesselY + 34}
        style={{ fontSize: 10, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'middle' }}
      >
        {`${result.fluidTemperature.toFixed(1)}\u00B0C`}
      </Text>

      <Rect
        x={String(rightVesselX)}
        y={String(vesselY)}
        width={String(vesselW)}
        height={String(vesselH)}
        rx="4"
        fill={COLORS.vesselFill}
        stroke={COLORS.vessel}
        strokeWidth={2}
      />
      <Text
        x={rightVesselX + vesselW / 2}
        y={vesselY + 18}
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'Helvetica-Bold',
          fill: COLORS.pipe,
          textAnchor: 'middle',
        }}
      >
        Effect N+1
      </Text>
      <Text
        x={rightVesselX + vesselW / 2}
        y={vesselY + 34}
        style={{ fontSize: 10, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'middle' }}
      >
        {`${result.downstreamSatTemp.toFixed(1)}\u00B0C`}
      </Text>

      {/* === "Other siphon" indicator for 4-elbow config === */}
      {showOtherSiphon && (
        <G>
          <Line
            x1={String(midX)}
            y1={String(nozzleY + 10)}
            x2={String(midX)}
            y2={String(uBendY + 5)}
            stroke={COLORS.otherSiphon}
            strokeWidth={6}
            strokeDasharray="8,4"
            strokeLinecap="round"
          />
          <Text
            x={midX}
            y={nozzleY + 25}
            style={{
              fontSize: 8,
              fontFamily: 'Helvetica',
              fill: COLORS.otherSiphonText,
              textAnchor: 'middle',
            }}
          >
            other
          </Text>
          <Text
            x={midX}
            y={nozzleY + 35}
            style={{
              fontSize: 8,
              fontFamily: 'Helvetica',
              fill: COLORS.otherSiphonText,
              textAnchor: 'middle',
            }}
          >
            siphon
          </Text>
        </G>
      )}

      {/* === Pipe outline === */}
      <Path
        d={pipePath}
        fill="none"
        stroke={COLORS.pipe}
        strokeWidth={pipeW}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* === Water fill === */}
      <G>
        {/* Downstream leg */}
        <Line
          x1={String(rightNozzleX)}
          y1={String(downstreamWaterY)}
          x2={String(rightNozzleX)}
          y2={String(downstreamBottomY)}
          stroke={COLORS.water}
          strokeWidth={pipeW - 2}
          strokeLinecap="round"
          opacity={0.5}
        />
        {/* Bottom section */}
        <Path
          d={waterBottomPath}
          fill="none"
          stroke={COLORS.water}
          strokeWidth={pipeW - 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.5}
        />
        {/* Upstream leg */}
        <Line
          x1={String(leftNozzleX)}
          y1={String(upstreamWaterY)}
          x2={String(leftNozzleX)}
          y2={String(uBendY)}
          stroke={COLORS.water}
          strokeWidth={pipeW - 2}
          strokeLinecap="round"
          opacity={0.5}
        />
        {/* Water level indicators */}
        <Line
          x1={String(leftNozzleX - 12)}
          y1={String(upstreamWaterY)}
          x2={String(leftNozzleX + 12)}
          y2={String(upstreamWaterY)}
          stroke={COLORS.waterLight}
          strokeWidth={2}
        />
        <Line
          x1={String(rightNozzleX - 12)}
          y1={String(downstreamWaterY)}
          x2={String(rightNozzleX + 12)}
          y2={String(downstreamWaterY)}
          stroke={COLORS.waterLight}
          strokeWidth={2}
        />
      </G>

      {/* === Elbow indicators === */}
      {elbowPositions.map((pos, i) => (
        <Circle key={i} cx={String(pos.x)} cy={String(pos.y)} r="3" fill={COLORS.pipe} />
      ))}

      {/* === Dimension annotations === */}
      <G>
        {/* Minimum siphon height — right side */}
        <Line
          x1={String(rightNozzleX + 30)}
          y1={String(nozzleY)}
          x2={String(rightNozzleX + 30)}
          y2={String(downstreamBottomY)}
          stroke={COLORS.accent}
          strokeWidth={1.5}
        />
        <Arrowhead x={rightNozzleX + 30} y={nozzleY} direction="up" color={COLORS.accent} />
        <Arrowhead
          x={rightNozzleX + 30}
          y={downstreamBottomY}
          direction="down"
          color={COLORS.accent}
        />
        <Text
          x={rightNozzleX + 38}
          y={(nozzleY + downstreamBottomY) / 2 - 6}
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'Helvetica-Bold',
            fill: COLORS.accent,
          }}
        >
          Min. Height
        </Text>
        <Text
          x={rightNozzleX + 38}
          y={(nozzleY + downstreamBottomY) / 2 + 8}
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'Helvetica-Bold',
            fill: COLORS.accent,
          }}
        >
          {`${result.minimumHeight.toFixed(2)} m`}
        </Text>

        {/* Static head — left side */}
        {staticHeadPx > 5 && (
          <G>
            <Line
              x1={String(leftNozzleX - 25)}
              y1={String(nozzleY)}
              x2={String(leftNozzleX - 25)}
              y2={String(upstreamWaterY)}
              stroke={COLORS.dim}
              strokeWidth={1}
              strokeDasharray="3,2"
            />
            <Arrowhead x={leftNozzleX - 25} y={nozzleY} direction="up" color={COLORS.dim} />
            <Arrowhead
              x={leftNozzleX - 25}
              y={upstreamWaterY}
              direction="down"
              color={COLORS.dim}
            />
            <Text
              x={leftNozzleX - 30}
              y={(nozzleY + upstreamWaterY) / 2}
              style={{ fontSize: 9, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'end' }}
            >
              {`${result.staticHead.toFixed(2)} m`}
            </Text>
            <Text
              x={leftNozzleX - 30}
              y={(nozzleY + upstreamWaterY) / 2 + 12}
              style={{ fontSize: 8, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'end' }}
            >
              (static head)
            </Text>
          </G>
        )}

        {/* Horizontal distance — bottom */}
        <Line
          x1={String(leftNozzleX)}
          y1={String(uBendY + 18)}
          x2={String(rightNozzleX)}
          y2={String(uBendY + 18)}
          stroke={COLORS.dim}
          strokeWidth={1}
        />
        <Arrowhead x={leftNozzleX} y={uBendY + 18} direction="left" color={COLORS.dim} />
        <Arrowhead x={rightNozzleX} y={uBendY + 18} direction="right" color={COLORS.dim} />
        <Text
          x={(leftNozzleX + rightNozzleX) / 2}
          y={uBendY + 30}
          style={{ fontSize: 9, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'middle' }}
        >
          {`${horizontalDistance.toFixed(1)} m${elbowConfig !== '2_elbows' && offsetDistance > 0 ? ` + ${offsetDistance.toFixed(1)} m offset` : ''}`}
        </Text>

        {/* Pipe size label */}
        <Text
          x={(leftNozzleX + rightNozzleX) / 2}
          y={elbowConfig === '4_elbows' ? uBendY - jogH - 8 : uBendY - 12}
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'Helvetica-Bold',
            fill: COLORS.pipe,
            textAnchor: 'middle',
          }}
        >
          {pipeLabel}
        </Text>

        {/* Flow direction labels */}
        <Text
          x={leftNozzleX + 10}
          y={nozzleY + 50}
          style={{ fontSize: 9, fontFamily: 'Helvetica', fill: COLORS.dim }}
        >
          {'\u2193 flow'}
        </Text>
        <Text
          x={rightNozzleX - 10}
          y={nozzleY + 50}
          style={{ fontSize: 9, fontFamily: 'Helvetica', fill: COLORS.dim, textAnchor: 'end' }}
        >
          {'flow \u2191'}
        </Text>
      </G>
    </Svg>
  );
}
