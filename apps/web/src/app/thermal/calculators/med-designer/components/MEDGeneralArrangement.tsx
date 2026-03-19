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
  const svgH = 460;

  // Elevation view (top half)
  const elevY = 60;
  const elevH = 120;

  // Scale: total train length → fit in svgW - 120
  const maxTrainLen = dims.totalLengthMM;
  const scale = Math.min((svgW - 160) / maxTrainLen, 0.15);

  // Cross-section view (bottom half)
  const csY = 280;
  const csCX = svgW / 2;
  const csCY = csY + 80;
  const shellID = Number(result.inputs.resolvedDefaults.shellID ?? 1800);
  const shellR = Math.min(70, (svgH - csY - 40) / 2); // scaled radius for display
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
          {/* ── ELEVATION VIEW ─────────────────────────────────────── */}
          <text
            x={svgW / 2}
            y={25}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill={textCol}
          >
            Elevation View — {nEff} Effect MED Train
          </text>
          <text x={svgW / 2} y={40} textAnchor="middle" fontSize={9} fill={shellCol}>
            Total length: {(maxTrainLen / 1000).toFixed(1)} m | Shell OD: {dims.shellODmm} mm
          </text>

          {/* Draw each shell */}
          {(() => {
            let xCursor = 80;
            return result.effects.map((e, i) => {
              const shellLen = e.shellLengthMM * scale;
              const shellH = elevH;
              const x = xCursor;
              xCursor += shellLen + 8; // 8px gap between shells

              // Dished head arcs
              const headR = 12;

              return (
                <g key={i}>
                  {/* Shell body */}
                  <rect
                    x={x + headR}
                    y={elevY}
                    width={Math.max(shellLen - 2 * headR, 10)}
                    height={shellH}
                    fill="none"
                    stroke={shellCol}
                    strokeWidth={1.5}
                  />
                  {/* Left dished head (2:1 SE approximation) */}
                  <ellipse
                    cx={x + headR}
                    cy={elevY + shellH / 2}
                    rx={headR}
                    ry={shellH / 2}
                    fill="none"
                    stroke={shellCol}
                    strokeWidth={1.5}
                  />
                  {/* Right dished head */}
                  <ellipse
                    cx={x + shellLen - headR}
                    cy={elevY + shellH / 2}
                    rx={headR}
                    ry={shellH / 2}
                    fill="none"
                    stroke={shellCol}
                    strokeWidth={1.5}
                  />

                  {/* Tube bundle lines (horizontal) */}
                  {[0.3, 0.4, 0.5, 0.6, 0.7].map((frac, j) => (
                    <line
                      key={j}
                      x1={x + headR + 5}
                      y1={elevY + shellH * frac}
                      x2={x + shellLen - headR - 5}
                      y2={elevY + shellH * frac}
                      stroke={tubeCol}
                      strokeWidth={0.5}
                    />
                  ))}

                  {/* Effect label */}
                  <text
                    x={x + shellLen / 2}
                    y={elevY - 5}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight="bold"
                    fill={textCol}
                  >
                    E{e.effect}
                  </text>

                  {/* Dimension: shell length */}
                  <text
                    x={x + shellLen / 2}
                    y={elevY + shellH + 15}
                    textAnchor="middle"
                    fontSize={6}
                    fill={shellCol}
                  >
                    {e.shellLengthMM} mm
                  </text>

                  {/* Tube length annotation */}
                  <text
                    x={x + shellLen / 2}
                    y={elevY + shellH + 25}
                    textAnchor="middle"
                    fontSize={6}
                    fill={textCol}
                  >
                    L={e.tubeLength}m | {e.tubes} tubes
                  </text>

                  {/* Nozzles (simplified) */}
                  {/* Top: vapour inlet/outlet */}
                  <line
                    x1={x + shellLen * 0.3}
                    y1={elevY}
                    x2={x + shellLen * 0.3}
                    y2={elevY - 10}
                    stroke={shellCol}
                    strokeWidth={1}
                  />
                  {/* Bottom: brine/distillate */}
                  <line
                    x1={x + shellLen * 0.7}
                    y1={elevY + shellH}
                    x2={x + shellLen * 0.7}
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
            fontSize={8}
            fill={textCol}
          >
            Overall: {(maxTrainLen / 1000).toFixed(1)} m ({maxTrainLen.toLocaleString()} mm)
          </text>

          {/* ── CROSS-SECTION VIEW ──────────────────────────────────── */}
          <text
            x={svgW / 2}
            y={csY - 15}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill={textCol}
          >
            Cross-Section — Lateral Tube Bundle
          </text>
          <text x={svgW / 2} y={csY} textAnchor="middle" fontSize={9} fill={shellCol}>
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

          {/* Lateral bundle (left half filled with tubes) */}
          {(() => {
            const pitch = Number(result.inputs.resolvedDefaults.tubePitch ?? 33.4);
            const tubeOD = Number(result.inputs.resolvedDefaults.tubeOD ?? 25.4);
            const tubeR = (tubeOD / 2) * realToCS;
            const pitchPx = pitch * realToCS;
            const rowSpacing = pitchPx * Math.sin((60 * Math.PI) / 180);
            const tubes: { cx: number; cy: number }[] = [];

            const maxR = shellR - 3;
            for (
              let row = -Math.ceil(maxR / rowSpacing);
              row <= Math.ceil(maxR / rowSpacing);
              row++
            ) {
              const y = row * rowSpacing;
              if (Math.abs(y) > maxR) continue;
              const chord = Math.sqrt(maxR * maxR - y * y);
              const offset = Math.abs(row) % 2 === 1 ? pitchPx / 2 : 0;

              // Left half only for lateral bundle
              for (let x = -chord + offset; x <= tubeR; x += pitchPx) {
                const dist = Math.sqrt(x * x + y * y);
                if (dist + tubeR <= maxR) {
                  tubes.push({ cx: csCX + x, cy: csCY + y });
                }
              }
            }

            return tubes.map((t, i) => (
              <circle
                key={i}
                cx={t.cx}
                cy={t.cy}
                r={Math.max(tubeR, 1)}
                fill={tubeCol}
                stroke={textCol}
                strokeWidth={0.2}
              />
            ));
          })()}

          {/* Labels: spray side */}
          <text x={csCX + shellR + 15} y={csCY - 10} fontSize={7} fill={textCol}>
            Spray nozzles
          </text>
          <text x={csCX + shellR + 15} y={csCY + 2} fontSize={7} fill={textCol}>
            (open side)
          </text>

          {/* Label: tube bundle side */}
          <text x={csCX - shellR - 50} y={csCY} fontSize={7} fill={textCol} textAnchor="end">
            Tube bundle
          </text>

          {/* Demister area label */}
          <text x={csCX + shellR * 0.5} y={csCY - shellR + 15} fontSize={6} fill={shellCol}>
            Demister
          </text>

          {/* Shell OD dimension */}
          <text x={csCX} y={csCY + shellR + 20} textAnchor="middle" fontSize={7} fill={textCol}>
            Shell OD: {dims.shellODmm} mm
          </text>

          {/* Access annotation */}
          <text x={csCX} y={csCY + shellR + 32} textAnchor="middle" fontSize={6} fill={shellCol}>
            750 mm tube sheet access each side
          </text>
        </svg>
      </Box>
    </Paper>
  );
}
