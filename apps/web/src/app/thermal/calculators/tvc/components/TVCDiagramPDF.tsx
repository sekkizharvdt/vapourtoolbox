/**
 * TVC Ejector Diagram — react-pdf/renderer version
 *
 * All coordinates as strings, no useTheme. Uses react-pdf SVG primitives only.
 */

import { Svg, Rect, Line, Polygon, Path, Text, G } from '@react-pdf/renderer';
import type { TVCResult } from '@/lib/thermal/tvcCalculator';

// Fixed colours
const PIPE_COLOR = '#616161';
const VESSEL_FILL = '#f5f5f5';
const VESSEL_STROKE = '#bdbdbd';
const DIM_COLOR = '#757575';
const ACCENT_COLOR = '#1565c0';
const MOTIVE_COLOR = '#ef9a9a';
const SUCTION_COLOR = '#0288d1';
const DISCHARGE_COLOR = '#a5d6a7';

interface Props {
  result: TVCResult | null;
}

/** Arrow polygon pointing right at (x, y) */
function Arrow({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Polygon points={`${x - 5},${y - 3} ${x + 5},${y} ${x - 5},${y + 3}`} style={{ fill: color }} />
  );
}

/** Arrow polygon pointing up at (x, y) */
function ArrowUp({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Polygon points={`${x - 3},${y + 5} ${x},${y - 5} ${x + 3},${y + 5}`} style={{ fill: color }} />
  );
}

export function TVCDiagramPDF({ result }: Props) {
  const svgW = 480;
  const svgH = 230;

  const bodyMidY = 110;
  const bodyH = 60;
  const nozzleInletX = 20;
  const nozzleThroatX = 130;
  const nozzleHalfH = bodyH / 2;
  const nozzleThroatHalfH = 10;
  const mixingX2 = 280;
  const diffuserX2 = 420;
  const diffuserOutHalfH = 16;

  const dischargeX1 = diffuserX2;
  const dischargeX2 = svgW - 20;
  const dischargePipeH = 12;

  const suctionX = 180;
  const suctionY1 = bodyMidY + bodyH / 2;
  const suctionY2 = svgH - 10;

  // Ejector body path
  const ejectorBodyPath = `M ${nozzleInletX} ${bodyMidY - nozzleHalfH} L ${nozzleThroatX} ${bodyMidY - nozzleThroatHalfH} L ${mixingX2} ${bodyMidY - nozzleThroatHalfH} L ${diffuserX2} ${bodyMidY - diffuserOutHalfH} L ${diffuserX2} ${bodyMidY + diffuserOutHalfH} L ${mixingX2} ${bodyMidY + nozzleThroatHalfH} L ${nozzleThroatX} ${bodyMidY + nozzleThroatHalfH} L ${nozzleInletX} ${bodyMidY + nozzleHalfH} Z`;

  const nozzleFillPath = `M ${nozzleInletX} ${bodyMidY - nozzleHalfH} L ${nozzleThroatX} ${bodyMidY - nozzleThroatHalfH} L ${nozzleThroatX} ${bodyMidY + nozzleThroatHalfH} L ${nozzleInletX} ${bodyMidY + nozzleHalfH} Z`;

  return (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* Ejector body */}
      <Path
        d={ejectorBodyPath}
        style={{ fill: VESSEL_FILL, stroke: VESSEL_STROKE, strokeWidth: 2 }}
      />

      {/* Nozzle fill */}
      <Path d={nozzleFillPath} style={{ fill: MOTIVE_COLOR, fillOpacity: 0.25 }} />

      {/* Motive inlet pipe */}
      <Line
        x1={String(nozzleInletX - 20)}
        y1={String(bodyMidY)}
        x2={String(nozzleInletX)}
        y2={String(bodyMidY)}
        style={{ stroke: MOTIVE_COLOR, strokeWidth: 7, strokeLinecap: 'round' }}
      />

      {/* Discharge pipe */}
      <Rect
        x={String(dischargeX1)}
        y={String(bodyMidY - dischargePipeH / 2)}
        width={String(dischargeX2 - dischargeX1)}
        height={String(dischargePipeH)}
        style={{
          fill: DISCHARGE_COLOR,
          fillOpacity: 0.35,
          stroke: PIPE_COLOR,
          strokeWidth: 1.5,
        }}
      />

      {/* Suction pipe */}
      <Line
        x1={String(suctionX)}
        y1={String(suctionY1)}
        x2={String(suctionX)}
        y2={String(suctionY2)}
        style={{ stroke: SUCTION_COLOR, strokeWidth: 5, strokeLinecap: 'round' }}
      />

      {/* Zone labels */}
      <Text
        x={String((nozzleInletX + nozzleThroatX) / 2)}
        y={String(bodyMidY - nozzleHalfH / 2 - 4)}
        style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
      >
        Nozzle
      </Text>
      <Text
        x={String((nozzleThroatX + mixingX2) / 2)}
        y={String(bodyMidY - nozzleThroatHalfH - 5)}
        style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
      >
        Mixing
      </Text>
      <Text
        x={String((mixingX2 + diffuserX2) / 2)}
        y={String(bodyMidY - 14)}
        style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
      >
        Diffuser
      </Text>

      {/* Flow arrows */}
      <G>
        <Arrow x={nozzleInletX - 5} y={bodyMidY} color={DIM_COLOR} />
        <Arrow x={dischargeX2 - 12} y={bodyMidY} color={DIM_COLOR} />
        <ArrowUp x={suctionX} y={suctionY2 - 12} color={SUCTION_COLOR} />
      </G>

      {/* Annotations */}
      {result ? (
        <G>
          {/* Entrainment ratio banner */}
          <Text
            x={String(svgW / 2)}
            y={String(bodyMidY - nozzleHalfH - 8)}
            style={{ fontSize: 9, fontWeight: 'bold', fill: ACCENT_COLOR, textAnchor: 'middle' }}
          >
            {`Ra = ${result.entrainmentRatio.toFixed(3)}  |  CR = ${result.compressionRatio.toFixed(2)}  |  η = ${(result.ejectorEfficiency * 100).toFixed(1)}%`}
          </Text>

          {/* Motive */}
          <Text
            x={String(nozzleInletX - 10)}
            y={String(bodyMidY - 16)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: '#c62828' }}
          >
            Motive
          </Text>
          <Text
            x={String(nozzleInletX - 10)}
            y={String(bodyMidY - 6)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.motiveFlow.toFixed(2)} t/hr
          </Text>
          <Text
            x={String(nozzleInletX - 10)}
            y={String(bodyMidY + 18)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.motiveEnthalpy.toFixed(0)} kJ/kg
          </Text>

          {/* Suction */}
          <Text
            x={String(suctionX + 8)}
            y={String(suctionY2 - 20)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: SUCTION_COLOR }}
          >
            Suction
          </Text>
          <Text
            x={String(suctionX + 8)}
            y={String(suctionY2 - 10)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.entrainedFlow.toFixed(2)} t/hr
          </Text>
          <Text
            x={String(suctionX + 8)}
            y={String(suctionY2)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.suctionEnthalpy.toFixed(0)} kJ/kg
          </Text>

          {/* Discharge */}
          <Text
            x={String(dischargeX1 + (dischargeX2 - dischargeX1) / 2)}
            y={String(bodyMidY - dischargePipeH / 2 - 12)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: ACCENT_COLOR, textAnchor: 'middle' }}
          >
            Discharge
          </Text>
          <Text
            x={String(dischargeX1 + (dischargeX2 - dischargeX1) / 2)}
            y={String(bodyMidY - dischargePipeH / 2 - 3)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {result.dischargeFlow.toFixed(2)} t/hr
          </Text>
          <Text
            x={String(dischargeX1 + (dischargeX2 - dischargeX1) / 2)}
            y={String(bodyMidY + dischargePipeH / 2 + 9)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {result.dischargeEnthalpy.toFixed(0)} kJ/kg
          </Text>
          <Text
            x={String(dischargeX1 + (dischargeX2 - dischargeX1) / 2)}
            y={String(bodyMidY + dischargePipeH / 2 + 18)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            +{result.dischargeSuperheat.toFixed(1)}°C SH
          </Text>
        </G>
      ) : (
        <G>
          <Text
            x={String(nozzleInletX - 10)}
            y={String(bodyMidY - 10)}
            style={{ fontSize: 8, fill: DIM_COLOR, fillOpacity: 0.6 }}
          >
            Motive
          </Text>
          <Text
            x={String(suctionX)}
            y={String(suctionY2 - 4)}
            style={{ fontSize: 8, fill: DIM_COLOR, fillOpacity: 0.6, textAnchor: 'middle' }}
          >
            Suction
          </Text>
          <Text
            x={String(dischargeX1 + (dischargeX2 - dischargeX1) / 2)}
            y={String(bodyMidY - dischargePipeH / 2 - 6)}
            style={{ fontSize: 8, fill: DIM_COLOR, fillOpacity: 0.6, textAnchor: 'middle' }}
          >
            Discharge
          </Text>
        </G>
      )}
    </Svg>
  );
}
