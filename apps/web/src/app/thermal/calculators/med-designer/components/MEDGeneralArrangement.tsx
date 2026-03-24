'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { MEDDesignerResult } from '@/lib/thermal';

interface MEDGeneralArrangementProps {
  result: MEDDesignerResult;
}

/**
 * SVG General Arrangement — Elevation + Cross-Section
 *
 * Shows the MED evaporator train elevation (side view) with shell dimensions,
 * and a cross-section showing the lateral tube bundle layout.
 */
export function MEDGeneralArrangement({ result }: MEDGeneralArrangementProps) {
  const theme = useTheme();
  const nEff = result.effects.length;
  const dims = result.overallDimensions;

  const shellCol = theme.palette.grey[600];
  const textCol = theme.palette.text.primary;
  const tubeCol = theme.palette.grey[400];
  const bgCol = theme.palette.background.paper;

  // SVG viewport
  const svgW = 960;
  const svgH = 600;

  // Elevation view (top half)
  const elevY = 60;
  const elevH = 120;

  // Scale: total train length → fit in svgW - 120
  const maxTrainLen = dims.totalLengthMM;
  const scale = Math.min((svgW - 160) / maxTrainLen, 0.15);

  // Cross-section view (bottom half)
  const csY = 330;
  const csCX = svgW / 2;
  const csCY = csY + 80;
  const shellID = Number(result.inputs.resolvedDefaults.shellID ?? 1800);
  const shellR = Math.min(100, (svgH - csY - 40) / 2); // scaled radius for display
  const realToCS = shellR / (shellID / 2); // mm → SVG px

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, overflow: 'auto' }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        General Arrangement
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ maxWidth: 960, minHeight: 360, background: bgCol }}
        >
          {/* Dimension arrow markers */}
          <defs>
            <marker
              id="dimArrowL"
              viewBox="0 0 6 6"
              refX="0"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M6,0 L0,3 L6,6" fill="none" stroke="#1565c0" strokeWidth="1" />
            </marker>
            <marker
              id="dimArrowR"
              viewBox="0 0 6 6"
              refX="6"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="#1565c0" strokeWidth="1" />
            </marker>
          </defs>

          {/* ── ELEVATION VIEW ─────────────────────────────────────── */}
          <text
            x={svgW / 2}
            y={25}
            textAnchor="middle"
            fontSize={18}
            fontWeight="bold"
            fill={textCol}
          >
            Elevation View — {nEff} Effect MED Train
          </text>
          <text x={svgW / 2} y={40} textAnchor="middle" fontSize={16} fill={shellCol}>
            Total length: {(maxTrainLen / 1000).toFixed(1)} m | Shell OD: {dims.shellODmm} mm
          </text>

          {/* Draw each shell with tube sheets and access space */}
          {(() => {
            let xCursor = 80;
            const headR = 10; // dished head depth
            const tsW = 3; // tube sheet width in SVG px
            const accessW = 750 * scale; // 750mm access space scaled
            const accessCol = '#e3f2fd'; // light blue for access space

            return result.effects.map((e, i) => {
              const shellLen = e.shellLengthMM * scale;
              const shellH = elevH;
              const x = xCursor;

              // Layout within shell: [head][TS][access 750][tubes][access 750][TS][head]
              // But adjacent effects share access space, so:
              // First effect: [head][TS][access][tubes][TS]
              // Middle effects: [access][TS][tubes][TS]  (access shared with previous)
              // Last effect: [access][TS][tubes][TS][head]
              const isFirst = i === 0;
              const isLast = i === nEff - 1;

              // Total for this shell segment
              const segmentLen = shellLen + (isFirst ? 0 : accessW);
              xCursor += segmentLen;

              const bodyX = x + (isFirst ? headR : accessW);
              const bodyW = shellLen - (isFirst ? headR : 0) - (isLast ? headR : 0);

              // Tube region within the shell
              const tubeX1 = bodyX + tsW + 2;
              const tubeX2 = bodyX + bodyW - tsW - 2;

              return (
                <g key={i}>
                  {/* Access space between effects (750mm) */}
                  {!isFirst && (
                    <g>
                      <rect
                        x={x}
                        y={elevY + 2}
                        width={accessW}
                        height={shellH - 4}
                        fill={accessCol}
                        stroke="none"
                        opacity={0.5}
                      />
                      <text
                        x={x + accessW / 2}
                        y={elevY + shellH + 30}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#1565c0"
                      >
                        750mm
                      </text>
                      {/* Dimension arrows */}
                      <line
                        x1={x + 1}
                        y1={elevY + shellH + 25}
                        x2={x + accessW - 1}
                        y2={elevY + shellH + 25}
                        stroke="#1565c0"
                        strokeWidth={0.5}
                        markerStart="url(#dimArrowL)"
                        markerEnd="url(#dimArrowR)"
                      />
                    </g>
                  )}

                  {/* Shell body (cylindrical section) */}
                  <rect
                    x={bodyX}
                    y={elevY}
                    width={bodyW}
                    height={shellH}
                    fill="none"
                    stroke={shellCol}
                    strokeWidth={1.5}
                  />

                  {/* Left dished head (only for first effect) */}
                  {isFirst && (
                    <ellipse
                      cx={bodyX}
                      cy={elevY + shellH / 2}
                      rx={headR}
                      ry={shellH / 2}
                      fill="none"
                      stroke={shellCol}
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Right dished head (only for last effect) */}
                  {isLast && (
                    <ellipse
                      cx={bodyX + bodyW}
                      cy={elevY + shellH / 2}
                      rx={headR}
                      ry={shellH / 2}
                      fill="none"
                      stroke={shellCol}
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Left tube sheet */}
                  <rect
                    x={bodyX}
                    y={elevY}
                    width={tsW}
                    height={shellH}
                    fill={shellCol}
                    stroke="none"
                  />

                  {/* Right tube sheet */}
                  <rect
                    x={bodyX + bodyW - tsW}
                    y={elevY}
                    width={tsW}
                    height={shellH}
                    fill={shellCol}
                    stroke="none"
                  />

                  {/* Tube bundle lines (horizontal) */}
                  {[0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map((frac, j) => (
                    <line
                      key={j}
                      x1={tubeX1}
                      y1={elevY + shellH * frac}
                      x2={tubeX2}
                      y2={elevY + shellH * frac}
                      stroke={tubeCol}
                      strokeWidth={0.5}
                    />
                  ))}

                  {/* Effect label */}
                  <text
                    x={bodyX + bodyW / 2}
                    y={elevY - 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight="bold"
                    fill={textCol}
                  >
                    E{e.effect}
                  </text>

                  {/* Dimension: shell length */}
                  <text
                    x={bodyX + bodyW / 2}
                    y={elevY + shellH + 15}
                    textAnchor="middle"
                    fontSize={11}
                    fill={shellCol}
                  >
                    {e.shellLengthMM} mm
                  </text>

                  {/* Tube length annotation */}
                  <text
                    x={bodyX + bodyW / 2}
                    y={elevY + shellH + 25}
                    textAnchor="middle"
                    fontSize={11}
                    fill={textCol}
                  >
                    L={e.tubeLength}m | {e.tubes} tubes
                  </text>

                  {/* Top nozzle: vapour */}
                  <line
                    x1={bodyX + bodyW * 0.3}
                    y1={elevY}
                    x2={bodyX + bodyW * 0.3}
                    y2={elevY - 10}
                    stroke={shellCol}
                    strokeWidth={1}
                  />
                  {/* Bottom nozzle: brine/distillate */}
                  <line
                    x1={bodyX + bodyW * 0.7}
                    y1={elevY + shellH}
                    x2={bodyX + bodyW * 0.7}
                    y2={elevY + shellH + 5}
                    stroke={shellCol}
                    strokeWidth={1}
                  />
                </g>
              );
            });
          })()}

          {/* Overall dimension line */}
          <line
            x1={80}
            y1={elevY + elevH + 38}
            x2={80 + maxTrainLen * scale + (nEff - 1) * 8}
            y2={elevY + elevH + 38}
            stroke={textCol}
            strokeWidth={0.5}
          />
          <text
            x={80 + (maxTrainLen * scale + (nEff - 1) * 8) / 2}
            y={elevY + elevH + 50}
            textAnchor="middle"
            fontSize={14}
            fill={textCol}
          >
            Overall: {(maxTrainLen / 1000).toFixed(1)} m ({maxTrainLen.toLocaleString()} mm)
          </text>

          {/* ── CROSS-SECTION VIEW ──────────────────────────────────── */}
          <text
            x={svgW / 2}
            y={csY - 15}
            textAnchor="middle"
            fontSize={18}
            fontWeight="bold"
            fill={textCol}
          >
            Cross-Section — Lateral Tube Bundle
          </text>
          <text x={svgW / 2} y={csY} textAnchor="middle" fontSize={16} fill={shellCol}>
            Shell ID: {shellID} mm | Tube OD: {result.inputs.resolvedDefaults.tubeOD} mm | Pitch:{' '}
            {result.inputs.resolvedDefaults.tubePitch} mm
          </text>

          {/* Shell circle */}
          <circle cx={csCX} cy={csCY} r={shellR} fill="none" stroke={shellCol} strokeWidth={2} />

          {/* Centre lines */}
          <line
            x1={csCX - shellR - 10}
            y1={csCY}
            x2={csCX + shellR + 10}
            y2={csCY}
            stroke={shellCol}
            strokeWidth={0.3}
            strokeDasharray="4,3"
          />
          <line
            x1={csCX}
            y1={csCY - shellR - 10}
            x2={csCX}
            y2={csCY + shellR + 10}
            stroke={shellCol}
            strokeWidth={0.3}
            strokeDasharray="4,3"
          />

          {/* Lateral bundle with clearance zones */}
          {(() => {
            const pitch = Number(result.inputs.resolvedDefaults.tubePitch ?? 33.4);
            const tubeOD = Number(result.inputs.resolvedDefaults.tubeOD ?? 25.4);
            const tubeR = (tubeOD / 2) * realToCS;
            const pitchPx = pitch * realToCS;
            const rowSpacing = pitchPx * Math.sin((60 * Math.PI) / 180);

            // Clearance zones (in mm, converted to SVG px via realToCS)
            const drainageMM = 250;
            const sprayZoneMM = 200;
            const demisterMM = 100;
            const drainagePx = drainageMM * realToCS;
            const sprayPx = sprayZoneMM * realToCS;
            const demisterPx = demisterMM * realToCS;

            const maxR = shellR - 3;

            // Tube bundle vertical limits (accounting for clearances)
            const bundleYMax = maxR - sprayPx; // top of bundle
            const bundleYMin = -maxR + drainagePx; // bottom of bundle

            const tubes: { cx: number; cy: number }[] = [];
            for (let y = bundleYMax; y >= bundleYMin; y -= rowSpacing) {
              const chord2 = maxR * maxR - y * y;
              if (chord2 < 0) continue;
              const chord = Math.sqrt(chord2);
              const rowIdx = Math.round((bundleYMax - y) / rowSpacing);
              const offset = rowIdx % 2 === 1 ? pitchPx / 2 : 0;

              for (let x = -chord + offset; x <= tubeR; x += pitchPx) {
                const dist = Math.sqrt(x * x + y * y);
                if (dist + tubeR <= maxR) {
                  tubes.push({ cx: csCX + x, cy: csCY - y }); // note: SVG y is inverted
                }
              }
            }

            return (
              <>
                {/* Drainage zone (bottom) — light blue */}
                <path
                  d={`M ${csCX - maxR} ${csCY + maxR - drainagePx}
                      A ${maxR} ${maxR} 0 0 0 ${csCX + maxR} ${csCY + maxR - drainagePx}
                      L ${csCX + maxR} ${csCY + maxR}
                      A ${maxR} ${maxR} 0 0 1 ${csCX - maxR} ${csCY + maxR} Z`}
                  fill="#e3f2fd"
                  opacity={0.5}
                />
                <text
                  x={csCX}
                  y={csCY + maxR - drainagePx / 2 + 3}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#1565c0"
                >
                  Drainage {drainageMM}mm
                </text>

                {/* Spray zone (top) — light orange */}
                <path
                  d={`M ${csCX - maxR} ${csCY - maxR + sprayPx}
                      A ${maxR} ${maxR} 0 0 1 ${csCX + maxR} ${csCY - maxR + sprayPx}
                      L ${csCX + maxR} ${csCY - maxR}
                      A ${maxR} ${maxR} 0 0 0 ${csCX - maxR} ${csCY - maxR} Z`}
                  fill="#fff3e0"
                  opacity={0.5}
                />
                <text
                  x={csCX}
                  y={csCY - maxR + sprayPx / 2 + 3}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#e65100"
                >
                  Spray Zone {sprayZoneMM}mm
                </text>

                {/* Demister — horizontal pad lying flat in the right half.
                    Vapour rises from below, passes UP through the demister,
                    then exits through the vapour cutout ABOVE the demister.
                    Demister thickness: 50-100mm, width spans the right half.
                    Demister length = tube length (into the page). */}
                {(() => {
                  // Position demister in the upper portion of right half
                  // Leave space above for vapour cutout
                  const demisterY = csCY - maxR * 0.35; // demister horizontal position
                  const demisterThickPx = demisterPx; // 50-100mm scaled
                  // Width: chord of the circle at this y position
                  const demChord2 = maxR * maxR - maxR * 0.35 * (maxR * 0.35);
                  const demHalfChord = demChord2 > 0 ? Math.sqrt(demChord2) : maxR * 0.5;

                  return (
                    <>
                      {/* Demister pad (horizontal rectangle) */}
                      <rect
                        x={csCX + 3}
                        y={demisterY}
                        width={demHalfChord - 3}
                        height={demisterThickPx}
                        fill="#e8f5e9"
                        stroke="#4caf50"
                        strokeWidth={0.8}
                        opacity={0.7}
                      />
                      <text
                        x={csCX + 3 + (demHalfChord - 3) / 2}
                        y={demisterY + demisterThickPx / 2 + 2}
                        textAnchor="middle"
                        fontSize={14}
                        fill="#2e7d32"
                      >
                        Demister ({demisterMM}mm)
                      </text>

                      {/* Vapour cutout zone — ABOVE the demister
                          This is the opening in the tube sheet for vapour
                          to pass to the next effect. */}
                      <path
                        d={`M ${csCX + 2} ${demisterY - 1}
                            L ${csCX + 2} ${csCY - maxR + 3}
                            A ${maxR} ${maxR} 0 0 1 ${csCX + demHalfChord} ${csCY - maxR + 3}
                            L ${csCX + demHalfChord} ${demisterY - 1} Z`}
                        fill="#f3e5f5"
                        stroke="#7b1fa2"
                        strokeWidth={0.6}
                        strokeDasharray="3,2"
                        opacity={0.4}
                      />
                      <text
                        x={csCX + demHalfChord / 2}
                        y={demisterY - demisterThickPx}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#7b1fa2"
                      >
                        Vapour Cutout
                      </text>

                      {/* Vapour flow arrows (rising from tube bundle through demister) */}
                      {[0.25, 0.45, 0.65].map((frac, i) => (
                        <line
                          key={i}
                          x1={csCX + demHalfChord * frac}
                          y1={demisterY + demisterThickPx + 8}
                          x2={csCX + demHalfChord * frac}
                          y2={demisterY + 2}
                          stroke="#9e9e9e"
                          strokeWidth={0.5}
                          markerEnd="url(#dimArrowR)"
                          opacity={0.5}
                        />
                      ))}
                    </>
                  );
                })()}

                {/* Tubes */}
                {tubes.map((t, i) => (
                  <circle
                    key={i}
                    cx={t.cx}
                    cy={t.cy}
                    r={Math.max(tubeR, 1)}
                    fill={tubeCol}
                    stroke={textCol}
                    strokeWidth={0.2}
                  />
                ))}

                {/* Spray nozzle symbols (triangles on right side, above bundle) */}
                {[0.2, 0.4, 0.6, 0.8].map((frac, i) => {
                  const ny = csCY - bundleYMax + (bundleYMax - bundleYMin) * frac;
                  return (
                    <polygon
                      key={i}
                      points={`${csCX + 8},${ny - 3} ${csCX + 14},${ny} ${csCX + 8},${ny + 3}`}
                      fill="#ff9800"
                      stroke="#e65100"
                      strokeWidth={0.5}
                    />
                  );
                })}

                {/* Vapour passage arrows (right half) */}
                <text
                  x={csCX + shellR * 0.5}
                  y={csCY - 5}
                  fontSize={11}
                  fill={shellCol}
                  textAnchor="middle"
                >
                  Vapour
                </text>
                <text
                  x={csCX + shellR * 0.5}
                  y={csCY + 5}
                  fontSize={11}
                  fill={shellCol}
                  textAnchor="middle"
                >
                  Passage
                </text>
              </>
            );
          })()}

          {/* Labels */}
          <text x={csCX - shellR - 15} y={csCY} fontSize={18} fill={textCol} textAnchor="end">
            Tube bundle
          </text>
          <text x={csCX + shellR + 15} y={csCY - 10} fontSize={18} fill={textCol}>
            Spray nozzles
          </text>
          <text x={csCX + shellR + 15} y={csCY + 2} fontSize={18} fill={textCol}>
            (open side)
          </text>

          {/* Shell OD dimension */}
          <text x={csCX} y={csCY + shellR + 20} textAnchor="middle" fontSize={18} fill={textCol}>
            Shell OD: {dims.shellODmm} mm
          </text>

          {/* Access annotation */}
          <text x={csCX} y={csCY + shellR + 32} textAnchor="middle" fontSize={11} fill={shellCol}>
            750 mm tube sheet access each side
          </text>
        </svg>
      </Box>
    </Paper>
  );
}
