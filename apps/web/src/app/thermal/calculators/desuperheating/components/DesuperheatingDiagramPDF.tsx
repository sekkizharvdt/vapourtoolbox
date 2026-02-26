/**
 * Desuperheating Diagram — react-pdf/renderer version
 *
 * All coordinates as strings, no useTheme. Uses react-pdf SVG primitives only.
 */

import { Svg, Rect, Line, Polygon, Text, G } from '@react-pdf/renderer';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';

// Fixed colours
const PIPE_COLOR = '#616161'; // grey[700]
const VESSEL_FILL = '#f5f5f5'; // grey[100]
const VESSEL_STROKE = '#bdbdbd'; // grey[400]
const DIM_COLOR = '#757575'; // text.secondary
const ACCENT_COLOR = '#1565c0'; // primary
const WATER_COLOR = '#0288d1'; // info.main
const HOT_COLOR = '#ef9a9a'; // error.light
const COOL_COLOR = '#a5d6a7'; // success.light

interface Props {
  result: DesuperheatingResult | null;
  steamPressure: number | null;
}

/** Arrow polygon (pointing right) centred at (x, y) */
function Arrow({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Polygon points={`${x - 5},${y - 3} ${x + 5},${y} ${x - 5},${y + 3}`} style={{ fill: color }} />
  );
}

/** Arrow polygon pointing upward, centred at (x, y) */
function ArrowUp({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Polygon points={`${x - 3},${y + 5} ${x},${y - 5} ${x + 3},${y + 5}`} style={{ fill: color }} />
  );
}

export function DesuperheatingDiagramPDF({ result, steamPressure }: Props) {
  const svgW = 480;
  const svgH = 220;

  const bodyX = 100;
  const bodyY = 70;
  const bodyW = 280;
  const bodyH = 60;
  const bodyMidY = bodyY + bodyH / 2;
  const pipeH = 12;

  const inletX1 = 20;
  const inletX2 = bodyX;
  const outletX1 = bodyX + bodyW;
  const outletX2 = svgW - 20;

  const sprayX = bodyX + bodyW / 2;
  const sprayY1 = bodyY + bodyH;
  const sprayY2 = svgH - 10;

  return (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      {/* === Inlet pipe === */}
      <Rect
        x={String(inletX1)}
        y={String(bodyMidY - pipeH / 2)}
        width={String(inletX2 - inletX1)}
        height={String(pipeH)}
        style={{ fill: HOT_COLOR, fillOpacity: 0.35, stroke: PIPE_COLOR, strokeWidth: 1.5 }}
      />

      {/* === Outlet pipe === */}
      <Rect
        x={String(outletX1)}
        y={String(bodyMidY - pipeH / 2)}
        width={String(outletX2 - outletX1)}
        height={String(pipeH)}
        style={{ fill: COOL_COLOR, fillOpacity: 0.35, stroke: PIPE_COLOR, strokeWidth: 1.5 }}
      />

      {/* === Desuperheater body === */}
      <Rect
        x={String(bodyX)}
        y={String(bodyY)}
        width={String(bodyW)}
        height={String(bodyH)}
        rx="8"
        style={{ fill: VESSEL_FILL, stroke: VESSEL_STROKE, strokeWidth: 2 }}
      />

      {/* Body labels */}
      <Text
        x={String(bodyX + bodyW / 2)}
        y={String(bodyY + 20)}
        style={{
          fontSize: 10,
          fontWeight: 'bold',
          fill: PIPE_COLOR,
          textAnchor: 'middle',
        }}
      >
        Desuperheater
      </Text>
      <Text
        x={String(bodyX + bodyW / 2)}
        y={String(bodyY + 34)}
        style={{ fontSize: 8, fill: DIM_COLOR, textAnchor: 'middle' }}
      >
        {steamPressure !== null ? `P = ${steamPressure.toFixed(2)} bar abs` : 'spray-type inline'}
      </Text>

      {/* === Spray nozzle === */}
      <Line
        x1={String(sprayX)}
        y1={String(sprayY1)}
        x2={String(sprayX)}
        y2={String(sprayY2)}
        style={{ stroke: WATER_COLOR, strokeWidth: 5, strokeLinecap: 'round' }}
      />
      {/* Nozzle tip */}
      <Polygon
        points={`${sprayX - 7},${sprayY1 + 16} ${sprayX + 7},${sprayY1 + 16} ${sprayX},${sprayY1}`}
        style={{ fill: WATER_COLOR, fillOpacity: 0.7 }}
      />

      {/* Flow arrows */}
      <G>
        <Arrow x={inletX1 + 40} y={bodyMidY} color={DIM_COLOR} />
        <Arrow x={outletX2 - 25} y={bodyMidY} color={DIM_COLOR} />
        <ArrowUp x={sprayX} y={sprayY1 + 22} color={WATER_COLOR} />
      </G>

      {/* === Annotations === */}
      {result ? (
        <G>
          {/* Inlet */}
          <Text
            x={String(inletX1 + (inletX2 - inletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 12)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: '#c62828', textAnchor: 'middle' }}
          >
            Steam in
          </Text>
          <Text
            x={String(inletX1 + (inletX2 - inletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 4)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {result.steamEnthalpy.toFixed(0)} kJ/kg
          </Text>
          <Text
            x={String(inletX1 + (inletX2 - inletX1) / 2)}
            y={String(bodyMidY + pipeH / 2 + 10)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            +{result.degreesOfSuperheat.toFixed(1)}°C SH
          </Text>

          {/* Outlet */}
          <Text
            x={String(outletX1 + (outletX2 - outletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 12)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: ACCENT_COLOR, textAnchor: 'middle' }}
          >
            Desuperheated
          </Text>
          <Text
            x={String(outletX1 + (outletX2 - outletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 4)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {result.targetEnthalpy.toFixed(0)} kJ/kg
          </Text>
          <Text
            x={String(outletX1 + (outletX2 - outletX1) / 2)}
            y={String(bodyMidY + pipeH / 2 + 10)}
            style={{ fontSize: 7, fill: DIM_COLOR, textAnchor: 'middle' }}
          >
            {result.outletSuperheat > 0.1
              ? `+${result.outletSuperheat.toFixed(1)}°C SH`
              : 'Saturated vapor'}
          </Text>

          {/* Spray water */}
          <Text
            x={String(sprayX + 10)}
            y={String(sprayY2 - 20)}
            style={{ fontSize: 8, fontWeight: 'bold', fill: WATER_COLOR }}
          >
            Spray water
          </Text>
          <Text
            x={String(sprayX + 10)}
            y={String(sprayY2 - 10)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.sprayWaterFlow.toFixed(3)} t/hr
          </Text>
          <Text
            x={String(sprayX + 10)}
            y={String(sprayY2)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            {result.sprayWaterEnthalpy.toFixed(0)} kJ/kg
          </Text>

          {/* Tsat inside body */}
          <Text
            x={String(bodyX + 8)}
            y={String(bodyY + bodyH - 6)}
            style={{ fontSize: 7, fill: DIM_COLOR }}
          >
            T_sat = {result.saturationTemperature.toFixed(1)}°C
          </Text>

          {/* Heat removed */}
          <Text
            x={String(bodyX + bodyW - 8)}
            y={String(bodyY + bodyH - 6)}
            style={{ fontSize: 7, fill: ACCENT_COLOR, textAnchor: 'end' }}
          >
            Q = {(result.heatRemoved / 1000).toFixed(1)} MW
          </Text>
        </G>
      ) : (
        <G>
          <Text
            x={String(inletX1 + (inletX2 - inletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 6)}
            style={{ fontSize: 9, fill: DIM_COLOR, textAnchor: 'middle', fillOpacity: 0.6 }}
          >
            Superheated steam
          </Text>
          <Text
            x={String(outletX1 + (outletX2 - outletX1) / 2)}
            y={String(bodyMidY - pipeH / 2 - 6)}
            style={{ fontSize: 9, fill: DIM_COLOR, textAnchor: 'middle', fillOpacity: 0.6 }}
          >
            Desuperheated steam
          </Text>
          <Text
            x={String(sprayX + 10)}
            y={String(sprayY2 - 6)}
            style={{ fontSize: 9, fill: DIM_COLOR, fillOpacity: 0.6 }}
          >
            Spray water
          </Text>
        </G>
      )}
    </Svg>
  );
}
