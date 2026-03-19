'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { MEDDesignerResult } from '@/lib/thermal';

interface MEDProcessFlowDiagramProps {
  result: MEDDesignerResult;
}

/**
 * SVG Process Flow Diagram for MED Plant
 *
 * Shows: Steam → Effects (1..N) → Final Condenser, with preheaters,
 * brine recirculation, distillate collection, and seawater circuit.
 */
export function MEDProcessFlowDiagram({ result }: MEDProcessFlowDiagramProps) {
  const theme = useTheme();
  const nEff = result.effects.length;

  // Layout constants
  const svgW = 960;
  const svgH = 520;
  const effW = 60; // effect box width
  const effH = 80; // effect box height
  const effGap = Math.min(30, (svgW - 200) / nEff - effW); // gap between effects
  const effStartX = 100;
  const effY = 160;

  // Colours
  const steamCol = '#e53935'; // red
  const vapourCol = '#ff7043'; // orange
  const swCol = '#1565c0'; // blue
  const brineCol = '#6d4c41'; // brown
  const distCol = '#2e7d32'; // green
  const shellCol = theme.palette.grey[600];
  const textCol = theme.palette.text.primary;
  const bgCol = theme.palette.background.paper;

  // Effect positions
  const effPositions = result.effects.map((_, i) => ({
    x: effStartX + i * (effW + effGap),
    y: effY,
  }));

  // Condenser position (after last effect)
  const lastEffPos = effPositions[nEff - 1] ?? { x: effStartX, y: effY };
  const condX = lastEffPos.x + effW + effGap + 20;
  const condY = effY - 10;
  const condW = 55;
  const condH = 100;

  // Preheater positions (below effects, before condenser)
  const phY = effY + effH + 70;

  const fmt = (n: number, d = 1) => n.toFixed(d);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, overflow: 'auto' }}>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        Process Flow Diagram
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ maxWidth: 960, minHeight: 400, background: bgCol }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Marker definitions */}
          <defs>
            <marker
              id="arrowSteam"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill={steamCol} />
            </marker>
            <marker
              id="arrowVapour"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill={vapourCol} />
            </marker>
            <marker id="arrowSW" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill={swCol} />
            </marker>
            <marker
              id="arrowBrine"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill={brineCol} />
            </marker>
            <marker id="arrowDist" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill={distCol} />
            </marker>
          </defs>

          {/* Title */}
          <text
            x={svgW / 2}
            y={20}
            textAnchor="middle"
            fontSize={14}
            fontWeight="bold"
            fill={textCol}
          >
            MED Plant — {nEff} Effects, GOR {fmt(result.achievedGOR)}
          </text>
          <text x={svgW / 2} y={36} textAnchor="middle" fontSize={10} fill={shellCol}>
            {fmt(result.totalDistillateM3Day, 0)} m³/day | Steam {fmt(result.inputs.steamFlow, 2)}{' '}
            T/h @ {fmt(result.inputs.steamTemperature)}°C
          </text>

          {/* ── Steam inlet ────────────────────────────────────────── */}
          <text x={20} y={effY + effH / 2 - 12} fontSize={8} fill={steamCol} fontWeight="bold">
            STEAM
          </text>
          <text x={20} y={effY + effH / 2} fontSize={7} fill={steamCol}>
            {fmt(result.inputs.steamFlow, 2)} T/h
          </text>
          <text x={20} y={effY + effH / 2 + 10} fontSize={7} fill={steamCol}>
            {fmt(result.inputs.steamTemperature)}°C
          </text>
          <line
            x1={70}
            y1={effY + effH / 2}
            x2={effStartX - 2}
            y2={effY + effH / 2}
            stroke={steamCol}
            strokeWidth={2}
            markerEnd="url(#arrowSteam)"
          />

          {/* ── Effect boxes ───────────────────────────────────────── */}
          {result.effects.map((e, i) => {
            const pos = effPositions[i]!;
            return (
              <g key={e.effect}>
                {/* Effect shell */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={effW}
                  height={effH}
                  rx={4}
                  fill="none"
                  stroke={shellCol}
                  strokeWidth={1.5}
                />
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="bold"
                  fill={textCol}
                >
                  E{e.effect}
                </text>
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 27}
                  textAnchor="middle"
                  fontSize={7}
                  fill={shellCol}
                >
                  {fmt(e.brineTemp)}°C
                </text>
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 38}
                  textAnchor="middle"
                  fontSize={6}
                  fill={shellCol}
                >
                  {fmt(e.duty, 0)} kW
                </text>
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 49}
                  textAnchor="middle"
                  fontSize={6}
                  fill={shellCol}
                >
                  {e.tubes} tubes
                </text>
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 60}
                  textAnchor="middle"
                  fontSize={6}
                  fill={distCol}
                >
                  {fmt(e.distillateFlow, 2)} T/h
                </text>
                <text
                  x={pos.x + effW / 2}
                  y={pos.y + 71}
                  textAnchor="middle"
                  fontSize={6}
                  fill={shellCol}
                >
                  {e.tubeLength}m L
                </text>

                {/* Vapour line to next effect */}
                {i < nEff - 1 && effPositions[i + 1] && (
                  <line
                    x1={pos.x + effW}
                    y1={pos.y + 20}
                    x2={effPositions[i + 1]!.x}
                    y2={effPositions[i + 1]!.y + 20}
                    stroke={vapourCol}
                    strokeWidth={1.5}
                    markerEnd="url(#arrowVapour)"
                    strokeDasharray="4,2"
                  />
                )}

                {/* Distillate drip down */}
                <line
                  x1={pos.x + effW / 2}
                  y1={pos.y + effH}
                  x2={pos.x + effW / 2}
                  y2={pos.y + effH + 15}
                  stroke={distCol}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* ── Vapour to condenser ────────────────────────────────── */}
          <line
            x1={lastEffPos.x + effW}
            y1={effY + 20}
            x2={condX}
            y2={condY + condH / 3}
            stroke={vapourCol}
            strokeWidth={1.5}
            markerEnd="url(#arrowVapour)"
            strokeDasharray="4,2"
          />

          {/* ── Final Condenser ─────────────────────────────────────── */}
          <rect
            x={condX}
            y={condY}
            width={condW}
            height={condH}
            rx={4}
            fill="none"
            stroke={swCol}
            strokeWidth={2}
          />
          <text
            x={condX + condW / 2}
            y={condY + 14}
            textAnchor="middle"
            fontSize={8}
            fontWeight="bold"
            fill={swCol}
          >
            FC
          </text>
          <text
            x={condX + condW / 2}
            y={condY + 28}
            textAnchor="middle"
            fontSize={7}
            fill={shellCol}
          >
            {fmt(result.condenser.duty, 0)} kW
          </text>
          <text
            x={condX + condW / 2}
            y={condY + 40}
            textAnchor="middle"
            fontSize={7}
            fill={shellCol}
          >
            {fmt(result.condenser.designArea)} m²
          </text>
          <text x={condX + condW / 2} y={condY + 54} textAnchor="middle" fontSize={6} fill={swCol}>
            SW {fmt(result.condenser.seawaterFlowM3h, 0)} m³/h
          </text>
          <text x={condX + condW / 2} y={condY + 66} textAnchor="middle" fontSize={6} fill={swCol}>
            {fmt(result.inputs.seawaterTemperature)}→
            {fmt(Number(result.inputs.resolvedDefaults.condenserSWOutlet ?? 35))}°C
          </text>

          {/* ── SW inlet arrow to condenser ──────────────────────────── */}
          <text x={condX + condW + 10} y={condY + 15} fontSize={7} fill={swCol}>
            SW IN
          </text>
          <line
            x1={condX + condW + 8}
            y1={condY + condH / 3}
            x2={condX + condW + 2}
            y2={condY + condH / 3}
            stroke={swCol}
            strokeWidth={1.5}
            markerEnd="url(#arrowSW)"
          />
          <text x={condX + condW + 10} y={condY + condH - 15} fontSize={7} fill={swCol}>
            SW OUT
          </text>
          <line
            x1={condX + condW + 2}
            y1={condY + (2 * condH) / 3}
            x2={condX + condW + 8}
            y2={condY + (2 * condH) / 3}
            stroke={swCol}
            strokeWidth={1.5}
          />

          {/* ── Distillate collection header ────────────────────────── */}
          <line
            x1={effPositions[0]!.x + effW / 2}
            y1={effY + effH + 15}
            x2={lastEffPos.x + effW / 2}
            y2={effY + effH + 15}
            stroke={distCol}
            strokeWidth={1.5}
          />
          <text
            x={(effPositions[0]!.x + lastEffPos.x + effW) / 2}
            y={effY + effH + 30}
            textAnchor="middle"
            fontSize={8}
            fill={distCol}
            fontWeight="bold"
          >
            DISTILLATE: {fmt(result.totalDistillate, 2)} T/h ({fmt(result.totalDistillateM3Day, 0)}{' '}
            m³/day)
          </text>

          {/* ── Brine recirculation ──────────────────────────────────── */}
          {result.totalBrineRecirculation > 0 && (
            <g>
              <text
                x={(effPositions[0]!.x + lastEffPos.x + effW) / 2}
                y={effY - 25}
                textAnchor="middle"
                fontSize={7}
                fill={brineCol}
              >
                BRINE RECIRCULATION: {fmt(result.totalBrineRecirculation)} T/h
              </text>
              {/* Arrows looping over effects */}
              <line
                x1={effPositions[0]!.x + 10}
                y1={effY - 15}
                x2={lastEffPos.x + effW - 10}
                y2={effY - 15}
                stroke={brineCol}
                strokeWidth={1}
                strokeDasharray="3,2"
              />
              {/* Down arrows to each effect */}
              {effPositions.map((pos, i) => (
                <line
                  key={i}
                  x1={pos.x + effW / 2 + 10}
                  y1={effY - 15}
                  x2={pos.x + effW / 2 + 10}
                  y2={effY}
                  stroke={brineCol}
                  strokeWidth={0.8}
                  markerEnd="url(#arrowBrine)"
                />
              ))}
            </g>
          )}

          {/* ── Brine blowdown ──────────────────────────────────────── */}
          <text x={lastEffPos.x + effW + 5} y={effY + effH + 45} fontSize={7} fill={brineCol}>
            BRINE: {fmt(result.brineBlowdown)} T/h
          </text>
          <text x={lastEffPos.x + effW + 5} y={effY + effH + 55} fontSize={6} fill={brineCol}>
            @ {Number(result.inputs.resolvedDefaults.maxBrineSalinity).toLocaleString()} ppm
          </text>

          {/* ── Preheaters (if any) ─────────────────────────────────── */}
          {result.preheaters.length > 0 && (
            <g>
              <text x={effStartX} y={phY - 8} fontSize={8} fontWeight="bold" fill={textCol}>
                PREHEATERS
              </text>
              {result.preheaters.map((ph, i) => {
                const phX = effStartX + i * 110;
                return (
                  <g key={ph.id}>
                    <rect
                      x={phX}
                      y={phY}
                      width={95}
                      height={40}
                      rx={3}
                      fill="none"
                      stroke={shellCol}
                      strokeWidth={1}
                    />
                    <text
                      x={phX + 48}
                      y={phY + 14}
                      textAnchor="middle"
                      fontSize={7}
                      fontWeight="bold"
                      fill={textCol}
                    >
                      PH{ph.id} ({ph.vapourSource})
                    </text>
                    <text x={phX + 48} y={phY + 25} textAnchor="middle" fontSize={6} fill={swCol}>
                      SW {fmt(ph.swInlet)}→{fmt(ph.swOutlet)}°C
                    </text>
                    <text
                      x={phX + 48}
                      y={phY + 35}
                      textAnchor="middle"
                      fontSize={6}
                      fill={shellCol}
                    >
                      {fmt(ph.duty, 0)} kW | {fmt(ph.designArea)} m²
                    </text>
                  </g>
                );
              })}
              {/* Feed line through preheaters */}
              <text x={effStartX} y={phY + 55} fontSize={7} fill={swCol}>
                FEED: {fmt(result.makeUpFeed)} T/h → {nEff} effects
              </text>
            </g>
          )}

          {/* ── Legend ──────────────────────────────────────────────── */}
          <g transform={`translate(${svgW - 150}, ${svgH - 60})`}>
            <text x={0} y={0} fontSize={7} fontWeight="bold" fill={textCol}>
              Legend
            </text>
            <line x1={0} y1={8} x2={20} y2={8} stroke={steamCol} strokeWidth={2} />
            <text x={25} y={11} fontSize={6} fill={textCol}>
              Steam
            </text>
            <line
              x1={0}
              y1={18}
              x2={20}
              y2={18}
              stroke={vapourCol}
              strokeWidth={1.5}
              strokeDasharray="4,2"
            />
            <text x={25} y={21} fontSize={6} fill={textCol}>
              Vapour
            </text>
            <line x1={0} y1={28} x2={20} y2={28} stroke={swCol} strokeWidth={1.5} />
            <text x={25} y={31} fontSize={6} fill={textCol}>
              Seawater
            </text>
            <line x1={0} y1={38} x2={20} y2={38} stroke={distCol} strokeWidth={1.5} />
            <text x={25} y={41} fontSize={6} fill={textCol}>
              Distillate
            </text>
            <line
              x1={80}
              y1={8}
              x2={100}
              y2={8}
              stroke={brineCol}
              strokeWidth={1}
              strokeDasharray="3,2"
            />
            <text x={105} y={11} fontSize={6} fill={textCol}>
              Brine
            </text>
          </g>
        </svg>
      </Box>
    </Paper>
  );
}
