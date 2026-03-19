/**
 * @react-pdf SVG Diagrams for MED Designer PDF Reports
 *
 * Recreates the PFD and GA drawings using @react-pdf/renderer's SVG primitives.
 * These cannot use HTML SVG — @react-pdf has its own Svg/G/Rect/Circle/Line/Text/Path.
 */

import { Svg, G, Rect, Circle, Line, Text, Ellipse, Path, View } from '@react-pdf/renderer';
import type { MEDDesignerResult } from '@/lib/thermal';

// ============================================================================
// Colours (hardcoded — no theme in PDF context)
// ============================================================================
const STEAM = '#e53935';
const VAPOUR = '#ff7043';
const SW = '#1565c0';
const BRINE = '#6d4c41';
const DIST = '#2e7d32';
const SHELL = '#757575';
const TXT = '#212121';
const TUBE = '#bdbdbd';

// ============================================================================
// Arrow helper — @react-pdf doesn't support <marker>, so draw triangles
// ============================================================================
function Arrow({
  x,
  y,
  dir,
  color,
  size = 5,
}: {
  x: number;
  y: number;
  dir: 'right' | 'left' | 'down' | 'up';
  color: string;
  size?: number;
}) {
  const s = size;
  let d = '';
  switch (dir) {
    case 'right':
      d = `M${x},${y - s / 2} L${x + s},${y} L${x},${y + s / 2} Z`;
      break;
    case 'left':
      d = `M${x},${y - s / 2} L${x - s},${y} L${x},${y + s / 2} Z`;
      break;
    case 'down':
      d = `M${x - s / 2},${y} L${x},${y + s} L${x + s / 2},${y} Z`;
      break;
    case 'up':
      d = `M${x - s / 2},${y} L${x},${y - s} L${x + s / 2},${y} Z`;
      break;
  }
  return <Path d={d} fill={color} />;
}

// ============================================================================
// Process Flow Diagram (PFD)
// ============================================================================

export function PdfProcessFlowDiagram({ result }: { result: MEDDesignerResult }) {
  const nEff = result.effects.length;
  const svgW = 540; // A4 width minus margins
  const svgH = 300;
  const effW = 40;
  const effH = 55;
  const effGap = Math.min(20, (svgW - 140) / nEff - effW);
  const effStartX = 70;
  const effY = 90;

  const effPositions = result.effects.map((_, i) => ({
    x: effStartX + i * (effW + effGap),
    y: effY,
  }));

  const lastPos = effPositions[nEff - 1] ?? { x: effStartX, y: effY };
  const condX = lastPos.x + effW + effGap + 15;
  const condY = effY - 5;
  const condW = 40;
  const condH = 65;

  const phY = effY + effH + 50;
  const fmt = (n: number, d = 1) => n.toFixed(d);

  return (
    <View style={{ marginBottom: 10 }}>
      <Svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH * 0.85 }}>
        {/* Title */}
        <Text
          x={svgW / 2}
          y={12}
          style={{ fontSize: 9, fontWeight: 700, textAnchor: 'middle' }}
          fill={TXT}
        >
          {`MED Plant — ${nEff} Effects, GOR ${fmt(result.achievedGOR)}`}
        </Text>
        <Text x={svgW / 2} y={24} style={{ fontSize: 7, textAnchor: 'middle' }} fill={SHELL}>
          {`${fmt(result.totalDistillateM3Day, 0)} m³/day | Steam ${fmt(result.inputs.steamFlow, 2)} T/h @ ${fmt(result.inputs.steamTemperature)}°C`}
        </Text>

        {/* Steam inlet */}
        <Text x={10} y={effY + effH / 2 - 8} style={{ fontSize: 6, fontWeight: 700 }} fill={STEAM}>
          STEAM
        </Text>
        <Text x={10} y={effY + effH / 2 + 2} style={{ fontSize: 5 }} fill={STEAM}>
          {`${fmt(result.inputs.steamFlow, 2)} T/h`}
        </Text>
        <Text x={10} y={effY + effH / 2 + 10} style={{ fontSize: 5 }} fill={STEAM}>
          {`${fmt(result.inputs.steamTemperature)}°C`}
        </Text>
        <Line
          x1={50}
          y1={effY + effH / 2}
          x2={effStartX - 5}
          y2={effY + effH / 2}
          stroke={STEAM}
          strokeWidth={1.5}
        />
        <Arrow x={effStartX - 5} y={effY + effH / 2} dir="right" color={STEAM} size={4} />

        {/* Effect boxes */}
        {result.effects.map((e, i) => {
          const pos = effPositions[i]!;
          return (
            <G key={`eff-${e.effect}`}>
              <Rect
                x={pos.x}
                y={pos.y}
                width={effW}
                height={effH}
                rx={3}
                fill="none"
                stroke={SHELL}
                strokeWidth={1}
              />
              <Text
                x={pos.x + effW / 2}
                y={pos.y + 10}
                style={{ fontSize: 7, fontWeight: 700, textAnchor: 'middle' }}
                fill={TXT}
              >
                {`E${e.effect}`}
              </Text>
              <Text
                x={pos.x + effW / 2}
                y={pos.y + 20}
                style={{ fontSize: 5, textAnchor: 'middle' }}
                fill={SHELL}
              >
                {`${fmt(e.brineTemp)}°C`}
              </Text>
              <Text
                x={pos.x + effW / 2}
                y={pos.y + 28}
                style={{ fontSize: 5, textAnchor: 'middle' }}
                fill={SHELL}
              >
                {`${fmt(e.duty, 0)} kW`}
              </Text>
              <Text
                x={pos.x + effW / 2}
                y={pos.y + 36}
                style={{ fontSize: 5, textAnchor: 'middle' }}
                fill={DIST}
              >
                {`${fmt(e.distillateFlow, 2)} T/h`}
              </Text>
              <Text
                x={pos.x + effW / 2}
                y={pos.y + 44}
                style={{ fontSize: 4, textAnchor: 'middle' }}
                fill={SHELL}
              >
                {`${e.tubes}t × ${e.tubeLength}m`}
              </Text>

              {/* Vapour line to next effect */}
              {i < nEff - 1 && effPositions[i + 1] && (
                <G>
                  <Line
                    x1={pos.x + effW}
                    y1={pos.y + 14}
                    x2={effPositions[i + 1]!.x}
                    y2={effPositions[i + 1]!.y + 14}
                    stroke={VAPOUR}
                    strokeWidth={1}
                    strokeDasharray="3,2"
                  />
                  <Arrow
                    x={effPositions[i + 1]!.x}
                    y={effPositions[i + 1]!.y + 14}
                    dir="right"
                    color={VAPOUR}
                    size={3}
                  />
                </G>
              )}

              {/* Distillate drip */}
              <Line
                x1={pos.x + effW / 2}
                y1={pos.y + effH}
                x2={pos.x + effW / 2}
                y2={pos.y + effH + 10}
                stroke={DIST}
                strokeWidth={0.5}
              />
            </G>
          );
        })}

        {/* Vapour to condenser */}
        <Line
          x1={lastPos.x + effW}
          y1={effY + 14}
          x2={condX}
          y2={condY + condH / 3}
          stroke={VAPOUR}
          strokeWidth={1}
          strokeDasharray="3,2"
        />
        <Arrow x={condX} y={condY + condH / 3} dir="right" color={VAPOUR} size={3} />

        {/* Final Condenser */}
        <Rect
          x={condX}
          y={condY}
          width={condW}
          height={condH}
          rx={3}
          fill="none"
          stroke={SW}
          strokeWidth={1.5}
        />
        <Text
          x={condX + condW / 2}
          y={condY + 10}
          style={{ fontSize: 7, fontWeight: 700, textAnchor: 'middle' }}
          fill={SW}
        >
          FC
        </Text>
        <Text
          x={condX + condW / 2}
          y={condY + 20}
          style={{ fontSize: 5, textAnchor: 'middle' }}
          fill={SHELL}
        >
          {`${fmt(result.condenser.duty, 0)} kW`}
        </Text>
        <Text
          x={condX + condW / 2}
          y={condY + 28}
          style={{ fontSize: 5, textAnchor: 'middle' }}
          fill={SHELL}
        >
          {`${fmt(result.condenser.designArea)} m²`}
        </Text>
        <Text
          x={condX + condW / 2}
          y={condY + 38}
          style={{ fontSize: 5, textAnchor: 'middle' }}
          fill={SW}
        >
          {`SW ${fmt(result.condenser.seawaterFlowM3h, 0)} m³/h`}
        </Text>

        {/* Distillate collection line */}
        <Line
          x1={effPositions[0]!.x + effW / 2}
          y1={effY + effH + 10}
          x2={lastPos.x + effW / 2}
          y2={effY + effH + 10}
          stroke={DIST}
          strokeWidth={1}
        />
        <Text
          x={(effPositions[0]!.x + lastPos.x + effW) / 2}
          y={effY + effH + 22}
          style={{ fontSize: 6, fontWeight: 700, textAnchor: 'middle' }}
          fill={DIST}
        >
          {`DISTILLATE: ${fmt(result.totalDistillate, 2)} T/h (${fmt(result.totalDistillateM3Day, 0)} m³/day)`}
        </Text>

        {/* Brine recirculation */}
        {result.totalBrineRecirculation > 0 && (
          <G>
            <Text
              x={(effPositions[0]!.x + lastPos.x + effW) / 2}
              y={effY - 20}
              style={{ fontSize: 5, textAnchor: 'middle' }}
              fill={BRINE}
            >
              {`BRINE RECIRC: ${fmt(result.totalBrineRecirculation)} T/h @ ${result.spraySalinity.toLocaleString()} ppm`}
            </Text>
            <Line
              x1={effPositions[0]!.x + 5}
              y1={effY - 10}
              x2={lastPos.x + effW - 5}
              y2={effY - 10}
              stroke={BRINE}
              strokeWidth={0.7}
              strokeDasharray="2,2"
            />
            {effPositions.map((pos, i) => (
              <Arrow
                key={`recirc-${i}`}
                x={pos.x + effW / 2 + 8}
                y={effY}
                dir="down"
                color={BRINE}
                size={3}
              />
            ))}
          </G>
        )}

        {/* Brine blowdown */}
        <Text x={lastPos.x + effW + 5} y={effY + effH + 35} style={{ fontSize: 5 }} fill={BRINE}>
          {`BRINE: ${fmt(result.brineBlowdown)} T/h`}
        </Text>

        {/* Preheaters */}
        {result.preheaters.length > 0 && (
          <G>
            <Text x={effStartX} y={phY - 5} style={{ fontSize: 6, fontWeight: 700 }} fill={TXT}>
              PREHEATERS
            </Text>
            {result.preheaters.map((ph, i) => {
              const phX = effStartX + i * 80;
              return (
                <G key={`ph-${ph.id}`}>
                  <Rect
                    x={phX}
                    y={phY}
                    width={70}
                    height={28}
                    rx={2}
                    fill="none"
                    stroke={SHELL}
                    strokeWidth={0.8}
                  />
                  <Text
                    x={phX + 35}
                    y={phY + 10}
                    style={{ fontSize: 5, fontWeight: 700, textAnchor: 'middle' }}
                    fill={TXT}
                  >
                    {`PH${ph.id} (${ph.vapourSource})`}
                  </Text>
                  <Text
                    x={phX + 35}
                    y={phY + 18}
                    style={{ fontSize: 4, textAnchor: 'middle' }}
                    fill={SW}
                  >
                    {`SW ${fmt(ph.swInlet)}→${fmt(ph.swOutlet)}°C`}
                  </Text>
                  <Text
                    x={phX + 35}
                    y={phY + 25}
                    style={{ fontSize: 4, textAnchor: 'middle' }}
                    fill={SHELL}
                  >
                    {`${fmt(ph.duty, 0)} kW | ${fmt(ph.designArea)} m²`}
                  </Text>
                </G>
              );
            })}
            <Text x={effStartX} y={phY + 38} style={{ fontSize: 5 }} fill={SW}>
              {`FEED: ${fmt(result.makeUpFeed)} T/h → ${nEff} effects`}
            </Text>
          </G>
        )}

        {/* Legend */}
        <G>
          <Line
            x1={svgW - 100}
            y1={svgH - 40}
            x2={svgW - 85}
            y2={svgH - 40}
            stroke={STEAM}
            strokeWidth={1.5}
          />
          <Text x={svgW - 82} y={svgH - 37} style={{ fontSize: 4 }} fill={TXT}>
            Steam
          </Text>
          <Line
            x1={svgW - 100}
            y1={svgH - 32}
            x2={svgW - 85}
            y2={svgH - 32}
            stroke={VAPOUR}
            strokeWidth={1}
            strokeDasharray="3,2"
          />
          <Text x={svgW - 82} y={svgH - 29} style={{ fontSize: 4 }} fill={TXT}>
            Vapour
          </Text>
          <Line
            x1={svgW - 100}
            y1={svgH - 24}
            x2={svgW - 85}
            y2={svgH - 24}
            stroke={SW}
            strokeWidth={1}
          />
          <Text x={svgW - 82} y={svgH - 21} style={{ fontSize: 4 }} fill={TXT}>
            Seawater
          </Text>
          <Line
            x1={svgW - 100}
            y1={svgH - 16}
            x2={svgW - 85}
            y2={svgH - 16}
            stroke={DIST}
            strokeWidth={1}
          />
          <Text x={svgW - 82} y={svgH - 13} style={{ fontSize: 4 }} fill={TXT}>
            Distillate
          </Text>
          <Line
            x1={svgW - 50}
            y1={svgH - 40}
            x2={svgW - 35}
            y2={svgH - 40}
            stroke={BRINE}
            strokeWidth={0.7}
            strokeDasharray="2,2"
          />
          <Text x={svgW - 32} y={svgH - 37} style={{ fontSize: 4 }} fill={TXT}>
            Brine
          </Text>
        </G>
      </Svg>
    </View>
  );
}

// ============================================================================
// General Arrangement (Elevation + Cross-Section)
// ============================================================================

export function PdfGeneralArrangement({ result }: { result: MEDDesignerResult }) {
  const nEff = result.effects.length;
  const dims = result.overallDimensions;
  const svgW = 540;
  const svgH = 320;

  // Elevation
  const elevY = 50;
  const elevH = 75;
  const maxTrainLen = dims.totalLengthMM;
  const scale = Math.min((svgW - 120) / maxTrainLen, 0.12);

  // Cross-section
  const csY = 190;
  const csCX = svgW / 2;
  const csCY = csY + 55;
  const shellID = Number(result.inputs.resolvedDefaults.shellID ?? 1800);
  const shellR = Math.min(50, (svgH - csY - 30) / 2);
  const realToCS = shellR / (shellID / 2);

  return (
    <View style={{ marginBottom: 10 }}>
      <Svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH * 0.85 }}>
        {/* Elevation title */}
        <Text
          x={svgW / 2}
          y={15}
          style={{ fontSize: 9, fontWeight: 700, textAnchor: 'middle' }}
          fill={TXT}
        >
          {`Elevation View — ${nEff} Effect MED Train`}
        </Text>
        <Text x={svgW / 2} y={27} style={{ fontSize: 6, textAnchor: 'middle' }} fill={SHELL}>
          {`Total: ${(maxTrainLen / 1000).toFixed(1)} m | Shell OD: ${dims.shellODmm} mm`}
        </Text>

        {/* Draw shells */}
        {(() => {
          let xCursor = 60;
          return result.effects.map((e, i) => {
            const shellLen = e.shellLengthMM * scale;
            const x = xCursor;
            xCursor += shellLen + 5;
            const headR = 8;

            return (
              <G key={`shell-${i}`}>
                <Rect
                  x={x + headR}
                  y={elevY}
                  width={Math.max(shellLen - 2 * headR, 8)}
                  height={elevH}
                  fill="none"
                  stroke={SHELL}
                  strokeWidth={1}
                />
                <Ellipse
                  cx={x + headR}
                  cy={elevY + elevH / 2}
                  rx={headR}
                  ry={elevH / 2}
                  fill="none"
                  stroke={SHELL}
                  strokeWidth={1}
                />
                <Ellipse
                  cx={x + shellLen - headR}
                  cy={elevY + elevH / 2}
                  rx={headR}
                  ry={elevH / 2}
                  fill="none"
                  stroke={SHELL}
                  strokeWidth={1}
                />

                {/* Tube bundle lines */}
                {[0.35, 0.45, 0.55, 0.65].map((frac, j) => (
                  <Line
                    key={`tube-${j}`}
                    x1={x + headR + 3}
                    y1={elevY + elevH * frac}
                    x2={x + shellLen - headR - 3}
                    y2={elevY + elevH * frac}
                    stroke={TUBE}
                    strokeWidth={0.4}
                  />
                ))}

                {/* Labels */}
                <Text
                  x={x + shellLen / 2}
                  y={elevY - 4}
                  style={{ fontSize: 6, fontWeight: 700, textAnchor: 'middle' }}
                  fill={TXT}
                >
                  {`E${e.effect}`}
                </Text>
                <Text
                  x={x + shellLen / 2}
                  y={elevY + elevH + 10}
                  style={{ fontSize: 4, textAnchor: 'middle' }}
                  fill={SHELL}
                >
                  {`${e.shellLengthMM}mm`}
                </Text>
                <Text
                  x={x + shellLen / 2}
                  y={elevY + elevH + 18}
                  style={{ fontSize: 4, textAnchor: 'middle' }}
                  fill={TXT}
                >
                  {`L=${e.tubeLength}m | ${e.tubes}t`}
                </Text>

                {/* Nozzle stubs */}
                <Line
                  x1={x + shellLen * 0.3}
                  y1={elevY}
                  x2={x + shellLen * 0.3}
                  y2={elevY - 6}
                  stroke={SHELL}
                  strokeWidth={0.8}
                />
                <Line
                  x1={x + shellLen * 0.7}
                  y1={elevY + elevH}
                  x2={x + shellLen * 0.7}
                  y2={elevY + elevH + 3}
                  stroke={SHELL}
                  strokeWidth={0.8}
                />
              </G>
            );
          });
        })()}

        {/* Overall dimension */}
        <Text
          x={svgW / 2}
          y={elevY + elevH + 30}
          style={{ fontSize: 6, textAnchor: 'middle' }}
          fill={TXT}
        >
          {`Overall: ${(maxTrainLen / 1000).toFixed(1)} m`}
        </Text>

        {/* Cross-section title */}
        <Text
          x={svgW / 2}
          y={csY - 12}
          style={{ fontSize: 8, fontWeight: 700, textAnchor: 'middle' }}
          fill={TXT}
        >
          Cross-Section — Lateral Tube Bundle
        </Text>
        <Text x={svgW / 2} y={csY} style={{ fontSize: 6, textAnchor: 'middle' }} fill={SHELL}>
          {`Shell ID: ${shellID} mm`}
        </Text>

        {/* Shell circle */}
        <Circle cx={csCX} cy={csCY} r={shellR} fill="none" stroke={SHELL} strokeWidth={1.5} />

        {/* Centre lines */}
        <Line
          x1={csCX - shellR - 8}
          y1={csCY}
          x2={csCX + shellR + 8}
          y2={csCY}
          stroke={SHELL}
          strokeWidth={0.2}
          strokeDasharray="3,2"
        />
        <Line
          x1={csCX}
          y1={csCY - shellR - 8}
          x2={csCX}
          y2={csCY + shellR + 8}
          stroke={SHELL}
          strokeWidth={0.2}
          strokeDasharray="3,2"
        />

        {/* Lateral tube bundle (left half) */}
        {(() => {
          const pitch = Number(result.inputs.resolvedDefaults.tubePitch ?? 33.4);
          const tubeOD = Number(result.inputs.resolvedDefaults.tubeOD ?? 25.4);
          const tubeR = Math.max((tubeOD / 2) * realToCS, 0.8);
          const pitchPx = pitch * realToCS;
          const rowSpacing = pitchPx * Math.sin((60 * Math.PI) / 180);
          const tubes: { cx: number; cy: number }[] = [];
          const maxR = shellR - 2;

          for (
            let row = -Math.ceil(maxR / rowSpacing);
            row <= Math.ceil(maxR / rowSpacing);
            row++
          ) {
            const y = row * rowSpacing;
            if (Math.abs(y) > maxR) continue;
            const chord = Math.sqrt(maxR * maxR - y * y);
            const offset = Math.abs(row) % 2 === 1 ? pitchPx / 2 : 0;
            for (let x = -chord + offset; x <= tubeR; x += pitchPx) {
              if (Math.sqrt(x * x + y * y) + tubeR <= maxR) {
                tubes.push({ cx: csCX + x, cy: csCY + y });
              }
            }
          }

          return tubes.map((t, i) => (
            <Circle
              key={`ct-${i}`}
              cx={t.cx}
              cy={t.cy}
              r={tubeR}
              fill={TUBE}
              stroke={TXT}
              strokeWidth={0.15}
            />
          ));
        })()}

        {/* Labels */}
        <Text x={csCX + shellR + 8} y={csCY - 5} style={{ fontSize: 5 }} fill={TXT}>
          Spray nozzles
        </Text>
        <Text x={csCX + shellR + 8} y={csCY + 3} style={{ fontSize: 5 }} fill={TXT}>
          (open side)
        </Text>
        <Text x={csCX - shellR - 8} y={csCY} style={{ fontSize: 5, textAnchor: 'end' }} fill={TXT}>
          Tube bundle
        </Text>
        <Text
          x={csCX}
          y={csCY + shellR + 12}
          style={{ fontSize: 5, textAnchor: 'middle' }}
          fill={TXT}
        >
          {`Shell OD: ${dims.shellODmm} mm | 750mm TS access each side`}
        </Text>
      </Svg>
    </View>
  );
}
