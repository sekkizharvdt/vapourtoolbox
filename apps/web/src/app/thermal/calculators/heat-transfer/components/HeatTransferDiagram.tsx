'use client';

/**
 * Shell-and-Tube Heat Exchanger Diagram
 *
 * Shows a horizontal shell-and-tube heat exchanger with:
 *   - Cold fluid (tube side) flowing left → right
 *   - Hot fluid / condensing vapor (shell side) entering from top, condensate exiting bottom
 *   - Live coefficient annotations (h_i, h_o, U_o) once results are available
 */

import { useTheme } from '@mui/material';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';

interface HeatTransferDiagramProps {
  tubeSideResult: TubeSideHTCResult | null;
  condensationResult: CondensationHTCResult | null;
  overallResult: OverallHTCResult | null;
  orientation: 'vertical' | 'horizontal';
}

export function HeatTransferDiagram({
  tubeSideResult,
  condensationResult,
  overallResult,
  orientation,
}: HeatTransferDiagramProps) {
  const theme = useTheme();

  const hotColor = theme.palette.error.main;
  const coldColor = theme.palette.info.main;
  const shellColor = theme.palette.mode === 'dark' ? '#555' : '#888';
  const tubeColor = theme.palette.mode === 'dark' ? '#aaa' : '#555';
  const labelColor = theme.palette.text.primary;
  const subLabelColor = theme.palette.text.secondary;
  const resultBg = theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5';

  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(2)} kW/(m²·K)` : `${v.toFixed(1)} W/(m²·K)`;

  const hiText = tubeSideResult ? fmt(tubeSideResult.htc) : '—';
  const hoText = condensationResult ? fmt(condensationResult.htc) : '—';
  const uoText = overallResult ? fmt(overallResult.overallHTC) : '—';

  // SVG dimensions
  const W = 560;
  const H = 280;

  // Shell geometry
  const shellX = 90;
  const shellY = 75;
  const shellW = 380;
  const shellH = 130;
  const sheetW = 16;

  // Tube geometry (4 horizontal tubes)
  const tubeYPositions = [105, 120, 140, 155];
  const tubeX1 = shellX + sheetW;
  const tubeX2 = shellX + shellW - sheetW;

  // Nozzle geometry (hot side)
  const nozzleW = 30;
  const nozzleH = 28;
  const inletNozzleX = shellX + shellW * 0.3 - nozzleW / 2;
  const outletNozzleX = shellX + shellW * 0.65 - nozzleW / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }}
      aria-label="Shell-and-tube heat exchanger diagram"
    >
      {/* Background */}
      <rect width={W} height={H} fill="none" />

      {/* ── Hot side nozzle labels ── */}
      <text
        x={inletNozzleX + nozzleW / 2}
        y={18}
        textAnchor="middle"
        fontSize={11}
        fill={hotColor}
        fontWeight="600"
      >
        Vapor In
      </text>
      <text
        x={outletNozzleX + nozzleW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={11}
        fill={hotColor}
      >
        Condensate Out
      </text>

      {/* ── Hot side inlet nozzle ── */}
      <rect
        x={inletNozzleX}
        y={shellY - nozzleH}
        width={nozzleW}
        height={nozzleH}
        fill={hotColor}
        fillOpacity={0.15}
        stroke={hotColor}
        strokeWidth={1.5}
      />
      {/* Arrow into shell (hot inlet) */}
      <line
        x1={inletNozzleX + nozzleW / 2}
        y1={shellY - nozzleH + 4}
        x2={inletNozzleX + nozzleW / 2}
        y2={shellY - 2}
        stroke={hotColor}
        strokeWidth={2}
        markerEnd="url(#arrowHot)"
      />

      {/* ── Hot side outlet nozzle ── */}
      <rect
        x={outletNozzleX}
        y={shellY + shellH}
        width={nozzleW}
        height={nozzleH}
        fill={hotColor}
        fillOpacity={0.15}
        stroke={hotColor}
        strokeWidth={1.5}
      />
      <line
        x1={outletNozzleX + nozzleW / 2}
        y1={shellY + shellH + 2}
        x2={outletNozzleX + nozzleW / 2}
        y2={shellY + shellH + nozzleH - 4}
        stroke={hotColor}
        strokeWidth={2}
        markerEnd="url(#arrowHot)"
      />

      {/* ── Shell body ── */}
      <rect
        x={shellX}
        y={shellY}
        width={shellW}
        height={shellH}
        fill="none"
        stroke={shellColor}
        strokeWidth={2.5}
        rx={4}
      />

      {/* ── Tube sheets ── */}
      <rect
        x={shellX}
        y={shellY}
        width={sheetW}
        height={shellH}
        fill={shellColor}
        fillOpacity={0.35}
      />
      <rect
        x={shellX + shellW - sheetW}
        y={shellY}
        width={sheetW}
        height={shellH}
        fill={shellColor}
        fillOpacity={0.35}
      />

      {/* ── Tubes ── */}
      {tubeYPositions.map((y, i) => (
        <line
          key={i}
          x1={tubeX1}
          y1={y}
          x2={tubeX2}
          y2={y}
          stroke={tubeColor}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ))}
      {/* Tube bore (lighter inner line) */}
      {tubeYPositions.map((y, i) => (
        <line
          key={`bore-${i}`}
          x1={tubeX1}
          y1={y}
          x2={tubeX2}
          y2={y}
          stroke={coldColor}
          strokeWidth={3}
          strokeOpacity={0.5}
          strokeLinecap="round"
        />
      ))}

      {/* ── Cold side (tube side) flow arrows ── */}
      {/* Inlet side */}
      <line
        x1={shellX - 40}
        y1={shellY + shellH / 2}
        x2={shellX - 2}
        y2={shellY + shellH / 2}
        stroke={coldColor}
        strokeWidth={2}
        markerEnd="url(#arrowCold)"
      />
      {/* Outlet side */}
      <line
        x1={shellX + shellW + 2}
        y1={shellY + shellH / 2}
        x2={shellX + shellW + 42}
        y2={shellY + shellH / 2}
        stroke={coldColor}
        strokeWidth={2}
        markerEnd="url(#arrowCold)"
      />

      {/* ── Cold side labels ── */}
      <text
        x={shellX - 42}
        y={shellY + shellH / 2 - 10}
        textAnchor="middle"
        fontSize={10}
        fill={coldColor}
        fontWeight="600"
      >
        Cooling
      </text>
      <text
        x={shellX - 42}
        y={shellY + shellH / 2 + 2}
        textAnchor="middle"
        fontSize={10}
        fill={coldColor}
        fontWeight="600"
      >
        Water In
      </text>
      <text
        x={shellX + shellW + 44}
        y={shellY + shellH / 2 - 10}
        textAnchor="middle"
        fontSize={10}
        fill={coldColor}
        fontWeight="600"
      >
        Cooling
      </text>
      <text
        x={shellX + shellW + 44}
        y={shellY + shellH / 2 + 2}
        textAnchor="middle"
        fontSize={10}
        fill={coldColor}
        fontWeight="600"
      >
        Water Out
      </text>

      {/* ── Side labels ── */}
      <text x={shellX + sheetW + 8} y={shellY + 14} fontSize={10} fill={subLabelColor}>
        {orientation === 'horizontal' ? 'Shell Side (Condensation)' : 'Shell Side (Condensation)'}
      </text>
      <text x={shellX + sheetW + 8} y={shellY + shellH - 6} fontSize={10} fill={subLabelColor}>
        Tube Side (Forced Convection)
      </text>

      {/* ── Result boxes ── */}
      {/* h_i box (tube side) */}
      <rect
        x={10}
        y={H - 68}
        width={150}
        height={60}
        rx={4}
        fill={resultBg}
        stroke={coldColor}
        strokeWidth={1.5}
      />
      <text x={85} y={H - 50} textAnchor="middle" fontSize={10} fill={coldColor} fontWeight="700">
        h_i (Tube Side)
      </text>
      <text x={85} y={H - 34} textAnchor="middle" fontSize={12} fill={labelColor} fontWeight="600">
        {hiText}
      </text>
      <text x={85} y={H - 18} textAnchor="middle" fontSize={9} fill={subLabelColor}>
        Re = {tubeSideResult ? tubeSideResult.reynoldsNumber.toFixed(0) : '—'}
        {'  '}Pr = {tubeSideResult ? tubeSideResult.prandtlNumber.toFixed(2) : '—'}
      </text>

      {/* h_o box (shell side) */}
      <rect
        x={W / 2 - 75}
        y={H - 68}
        width={150}
        height={60}
        rx={4}
        fill={resultBg}
        stroke={hotColor}
        strokeWidth={1.5}
      />
      <text x={W / 2} y={H - 50} textAnchor="middle" fontSize={10} fill={hotColor} fontWeight="700">
        h_o (Shell Side)
      </text>
      <text
        x={W / 2}
        y={H - 34}
        textAnchor="middle"
        fontSize={12}
        fill={labelColor}
        fontWeight="600"
      >
        {hoText}
      </text>
      <text x={W / 2} y={H - 18} textAnchor="middle" fontSize={9} fill={subLabelColor}>
        Nusselt Film Condensation
      </text>

      {/* U_o box (overall) */}
      <rect
        x={W - 160}
        y={H - 68}
        width={150}
        height={60}
        rx={4}
        fill={resultBg}
        stroke={theme.palette.success.main}
        strokeWidth={1.5}
      />
      <text
        x={W - 85}
        y={H - 50}
        textAnchor="middle"
        fontSize={10}
        fill={theme.palette.success.main}
        fontWeight="700"
      >
        U_o (Overall)
      </text>
      <text
        x={W - 85}
        y={H - 34}
        textAnchor="middle"
        fontSize={12}
        fill={labelColor}
        fontWeight="600"
      >
        {uoText}
      </text>
      <text x={W - 85} y={H - 18} textAnchor="middle" fontSize={9} fill={subLabelColor}>
        Based on outer tube area
      </text>

      {/* ── Arrow markers ── */}
      <defs>
        <marker id="arrowHot" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={hotColor} />
        </marker>
        <marker id="arrowCold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={coldColor} />
        </marker>
      </defs>
    </svg>
  );
}
