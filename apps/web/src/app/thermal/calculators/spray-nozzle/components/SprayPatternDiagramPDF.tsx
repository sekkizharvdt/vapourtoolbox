/**
 * Spray Pattern Diagram — react-pdf/renderer version
 *
 * Shows a spray nozzle with cone pattern, angle arc, and dimension lines.
 * All coordinates as strings, no useTheme. Uses react-pdf SVG primitives only.
 */

import { Svg, Rect, Line, Polygon, Path, Text, G } from '@react-pdf/renderer';

// Fixed colours
const PIPE_COLOR = '#616161';
const SPRAY_COLOR = '#0288d1';
const SPRAY_FILL = '#b3e5fc';
const DIM_COLOR = '#757575';
const ACCENT_COLOR = '#1565c0';

interface SprayPatternDiagramPDFProps {
  sprayAngle: number; // degrees
  coverageMm?: number; // coverage diameter in mm (optional)
  distanceMm?: number; // spray distance in mm (optional)
  modelNumber: string; // e.g. "1HH-WSQ-130"
  flowLpm: number; // flow at pressure
  isHollow?: boolean; // hollow cone vs full cone
}

export function SprayPatternDiagramPDF({
  sprayAngle,
  coverageMm,
  distanceMm,
  modelNumber,
  flowLpm,
  isHollow = false,
}: SprayPatternDiagramPDFProps) {
  const svgW = 300;
  const svgH = 220;

  // Nozzle body position
  const nozzleCx = 150; // center x
  const nozzleTopY = 28;
  const nozzleBodyW = 24;
  const nozzleBodyH = 18;
  const nozzleTipH = 10;
  const nozzleTipW = 12;

  // Spray cone geometry
  const tipY = nozzleTopY + nozzleBodyH + nozzleTipH;
  const coneLength = 130; // vertical length of cone
  const coneBottomY = tipY + coneLength;

  // Clamp angle for display
  const halfAngleRad = (Math.min(Math.max(sprayAngle, 10), 170) / 2) * (Math.PI / 180);
  const halfSpread = Math.tan(halfAngleRad) * coneLength;

  // Outer cone endpoints
  const coneLeftX = nozzleCx - halfSpread;
  const coneRightX = nozzleCx + halfSpread;

  // Inner cone for hollow pattern (about 60% of outer radius)
  const innerSpread = halfSpread * 0.6;
  const innerLeftX = nozzleCx - innerSpread;
  const innerRightX = nozzleCx + innerSpread;

  // Angle arc — small arc near nozzle tip
  const arcRadius = 22;
  const arcStartAngle = Math.PI / 2 - halfAngleRad;
  const arcEndAngle = Math.PI / 2 + halfAngleRad;
  const arcX1 = nozzleCx + arcRadius * Math.cos(arcStartAngle);
  const arcY1 = tipY + arcRadius * Math.sin(arcStartAngle);
  const arcX2 = nozzleCx + arcRadius * Math.cos(arcEndAngle);
  const arcY2 = tipY + arcRadius * Math.sin(arcEndAngle);
  const largeArcFlag = sprayAngle > 180 ? 1 : 0;

  const arcPath = `M ${arcX1.toFixed(1)} ${arcY1.toFixed(1)} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${arcX2.toFixed(1)} ${arcY2.toFixed(1)}`;

  // Angle label position — just below the arc
  const angleLabelY = tipY + arcRadius + 12;

  // Dimension lines
  const coverageDimY = coneBottomY + 12;
  const distDimX = Math.max(coneRightX, nozzleCx + halfSpread) + 16;

  // Full cone fill path
  const coneTriPath = `M ${nozzleCx} ${tipY} L ${coneRightX.toFixed(1)} ${coneBottomY} L ${coneLeftX.toFixed(1)} ${coneBottomY} Z`;

  return (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* Model number — top left */}
      <Text x="6" y="12" style={{ fontSize: 8, fontWeight: 'bold', fill: ACCENT_COLOR }}>
        {modelNumber}
      </Text>

      {/* Flow rate — top right */}
      <Text x={String(svgW - 6)} y="12" style={{ fontSize: 8, fill: DIM_COLOR, textAnchor: 'end' }}>
        {`${flowLpm.toFixed(2)} L/min`}
      </Text>

      {/* Nozzle body — rectangle */}
      <Rect
        x={String(nozzleCx - nozzleBodyW / 2)}
        y={String(nozzleTopY)}
        width={String(nozzleBodyW)}
        height={String(nozzleBodyH)}
        style={{ fill: '#e0e0e0', stroke: PIPE_COLOR, strokeWidth: 1.5 }}
      />

      {/* Nozzle tip — trapezoid pointing down */}
      <Polygon
        points={`${nozzleCx - nozzleBodyW / 2},${nozzleTopY + nozzleBodyH} ${nozzleCx + nozzleBodyW / 2},${nozzleTopY + nozzleBodyH} ${nozzleCx + nozzleTipW / 2},${tipY} ${nozzleCx - nozzleTipW / 2},${tipY}`}
        style={{ fill: '#bdbdbd', stroke: PIPE_COLOR, strokeWidth: 1.5 }}
      />

      {/* Spray cone fill — full cone only */}
      {!isHollow && <Path d={coneTriPath} style={{ fill: SPRAY_FILL, fillOpacity: 0.45 }} />}

      {/* Outer cone lines */}
      <Line
        x1={String(nozzleCx)}
        y1={String(tipY)}
        x2={String(coneLeftX.toFixed(1))}
        y2={String(coneBottomY)}
        style={{ stroke: SPRAY_COLOR, strokeWidth: 1.5 }}
      />
      <Line
        x1={String(nozzleCx)}
        y1={String(tipY)}
        x2={String(coneRightX.toFixed(1))}
        y2={String(coneBottomY)}
        style={{ stroke: SPRAY_COLOR, strokeWidth: 1.5 }}
      />

      {/* Inner cone lines — hollow cone only */}
      {isHollow && (
        <G>
          <Line
            x1={String(nozzleCx)}
            y1={String(tipY)}
            x2={String(innerLeftX.toFixed(1))}
            y2={String(coneBottomY)}
            style={{ stroke: SPRAY_COLOR, strokeWidth: 1, strokeDasharray: '4 3' }}
          />
          <Line
            x1={String(nozzleCx)}
            y1={String(tipY)}
            x2={String(innerRightX.toFixed(1))}
            y2={String(coneBottomY)}
            style={{ stroke: SPRAY_COLOR, strokeWidth: 1, strokeDasharray: '4 3' }}
          />
        </G>
      )}

      {/* Angle arc */}
      <Path d={arcPath} style={{ fill: 'none', stroke: DIM_COLOR, strokeWidth: 1 }} />

      {/* Angle label */}
      <Text
        x={String(nozzleCx)}
        y={String(angleLabelY)}
        style={{ fontSize: 9, fontWeight: 'bold', fill: ACCENT_COLOR, textAnchor: 'middle' }}
      >
        {`${sprayAngle}°`}
      </Text>

      {/* Cone type label */}
      <Text
        x={String(nozzleCx)}
        y={String(angleLabelY + 12)}
        style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
      >
        {isHollow ? 'Hollow Cone' : 'Full Cone'}
      </Text>

      {/* Coverage dimension line at the bottom */}
      {coverageMm != null && (
        <G>
          {/* Left tick */}
          <Line
            x1={String(coneLeftX.toFixed(1))}
            y1={String(coneBottomY)}
            x2={String(coneLeftX.toFixed(1))}
            y2={String(coverageDimY + 4)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.5 }}
          />
          {/* Right tick */}
          <Line
            x1={String(coneRightX.toFixed(1))}
            y1={String(coneBottomY)}
            x2={String(coneRightX.toFixed(1))}
            y2={String(coverageDimY + 4)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.5 }}
          />
          {/* Dimension line */}
          <Line
            x1={String(coneLeftX.toFixed(1))}
            y1={String(coverageDimY)}
            x2={String(coneRightX.toFixed(1))}
            y2={String(coverageDimY)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.8 }}
          />
          {/* Left arrowhead */}
          <Polygon
            points={`${coneLeftX.toFixed(1)},${coverageDimY} ${(coneLeftX + 5).toFixed(1)},${coverageDimY - 2.5} ${(coneLeftX + 5).toFixed(1)},${coverageDimY + 2.5}`}
            style={{ fill: DIM_COLOR }}
          />
          {/* Right arrowhead */}
          <Polygon
            points={`${coneRightX.toFixed(1)},${coverageDimY} ${(coneRightX - 5).toFixed(1)},${coverageDimY - 2.5} ${(coneRightX - 5).toFixed(1)},${coverageDimY + 2.5}`}
            style={{ fill: DIM_COLOR }}
          />
          {/* Coverage label */}
          <Text
            x={String(nozzleCx)}
            y={String(coverageDimY + 12)}
            style={{ fontSize: 8, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {`⌀ ${coverageMm.toFixed(0)} mm`}
          </Text>
        </G>
      )}

      {/* Distance dimension line on the right */}
      {distanceMm != null && (
        <G>
          {/* Top tick */}
          <Line
            x1={String(distDimX - 4)}
            y1={String(tipY)}
            x2={String(distDimX + 4)}
            y2={String(tipY)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.5 }}
          />
          {/* Bottom tick */}
          <Line
            x1={String(distDimX - 4)}
            y1={String(coneBottomY)}
            x2={String(distDimX + 4)}
            y2={String(coneBottomY)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.5 }}
          />
          {/* Vertical dimension line */}
          <Line
            x1={String(distDimX)}
            y1={String(tipY)}
            x2={String(distDimX)}
            y2={String(coneBottomY)}
            style={{ stroke: DIM_COLOR, strokeWidth: 0.8 }}
          />
          {/* Top arrowhead */}
          <Polygon
            points={`${distDimX},${tipY} ${distDimX - 2.5},${tipY + 5} ${distDimX + 2.5},${tipY + 5}`}
            style={{ fill: DIM_COLOR }}
          />
          {/* Bottom arrowhead */}
          <Polygon
            points={`${distDimX},${coneBottomY} ${distDimX - 2.5},${coneBottomY - 5} ${distDimX + 2.5},${coneBottomY - 5}`}
            style={{ fill: DIM_COLOR }}
          />
          {/* Distance label — rotated text not supported, place beside line */}
          <Text
            x={String(distDimX + 6)}
            y={String((tipY + coneBottomY) / 2 + 3)}
            style={{ fontSize: 8, fill: DIM_COLOR }}
          >
            {`${distanceMm.toFixed(0)} mm`}
          </Text>
        </G>
      )}
    </Svg>
  );
}
