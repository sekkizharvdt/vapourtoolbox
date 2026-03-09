'use client';

import { Box, Typography, Stack, Divider, useTheme } from '@mui/material';
import type { NozzleLayoutMatch, NozzleCategory } from '@/lib/thermal/sprayNozzleCalculator';

interface NozzleLayoutDiagramProps {
  match: NozzleLayoutMatch;
  category: NozzleCategory;
  bundleLength: number;
  bundleWidth: number;
}

/**
 * Combined elevation + plan view diagram for the nozzle layout.
 *
 * Elevation view (side): spray header, nozzle bodies, spray cones with overlap,
 * tube bundle cross-section, spray height dimension.
 *
 * Plan view (top): tube bundle rectangle, coverage circles/squares, nozzle dots,
 * pitch and dimension annotations.
 */
export function NozzleLayoutDiagram({
  match,
  category,
  bundleLength,
  bundleWidth,
}: NozzleLayoutDiagramProps) {
  const theme = useTheme();

  const pipeColor = theme.palette.grey[700];
  const bundleColor = theme.palette.grey[400];
  const bundleFill = theme.palette.grey[100];
  const sprayColor = theme.palette.info.main;
  const sprayFill = theme.palette.info.light;
  const dimColor = theme.palette.text.secondary;
  const accentColor = theme.palette.primary.main;
  const isSquare = category === 'full_cone_square';
  const isHollow = category === 'hollow_cone_circular';

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        mb: 2,
      }}
    >
      <Stack spacing={2}>
        {/* ── Elevation View ── */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Elevation View (along length)
          </Typography>
          <ElevationView
            match={match}
            bundleLength={bundleLength}
            isSquare={isSquare}
            isHollow={isHollow}
            pipeColor={pipeColor}
            bundleColor={bundleColor}
            bundleFill={bundleFill}
            sprayColor={sprayColor}
            sprayFill={sprayFill}
            dimColor={dimColor}
            accentColor={accentColor}
          />
        </Box>

        <Divider />

        {/* ── Plan View ── */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Plan View (top)
          </Typography>
          <PlanView
            match={match}
            bundleLength={bundleLength}
            bundleWidth={bundleWidth}
            isSquare={isSquare}
            bundleColor={bundleColor}
            bundleFill={bundleFill}
            sprayColor={sprayColor}
            sprayFill={sprayFill}
            dimColor={dimColor}
            accentColor={accentColor}
            pipeColor={pipeColor}
          />
        </Box>
      </Stack>
    </Box>
  );
}

// ── Elevation View ────────────────────────────────────────────────────────────

function ElevationView({
  match,
  bundleLength,
  isSquare: _isSquare,
  isHollow,
  pipeColor,
  bundleColor,
  bundleFill,
  sprayColor,
  sprayFill,
  dimColor,
  accentColor,
}: {
  match: NozzleLayoutMatch;
  bundleLength: number;
  isSquare: boolean;
  isHollow: boolean;
  pipeColor: string;
  bundleColor: string;
  bundleFill: string;
  sprayColor: string;
  sprayFill: string;
  dimColor: string;
  accentColor: string;
}) {
  const padding = { left: 50, right: 60, top: 30, bottom: 50 };
  const drawW = 440;
  const headerY = padding.top + 10;
  const bundleH = 30;
  const nozzleBodyH = 16;

  // Scale bundle length to drawing width
  const scale = drawW / bundleLength;
  const pitchPx = match.pitchAlongLength * scale;

  // Use actual coverage diameter scaled to drawing for correct proportions
  const halfSpreadPx = (match.coverageDiameter / 2) * scale;
  // Derive cone height from actual geometry (height / coverage ratio)
  const aspectRatio = match.derivedHeight / match.coverageDiameter;
  const coneH = Math.max(60, Math.min(180, halfSpreadPx * 2 * aspectRatio));
  const nozzleTipY = headerY + nozzleBodyH + 6;
  const targetY = nozzleTipY + coneH;
  const bundleTopY = targetY;
  const svgW = padding.left + drawW + padding.right;
  const svgH = bundleTopY + bundleH + padding.bottom;

  // Nozzle x positions (along length)
  const nozzleXPositions: number[] = [];
  for (let i = 0; i < match.nozzlesAlongLength; i++) {
    const x =
      match.nozzlesAlongLength === 1
        ? padding.left + drawW / 2
        : padding.left + pitchPx / 2 + i * pitchPx;
    nozzleXPositions.push(x);
  }

  // Clamp max visible nozzles to avoid visual noise
  const maxVisible = 8;
  const visiblePositions =
    nozzleXPositions.length <= maxVisible
      ? nozzleXPositions
      : [...nozzleXPositions.slice(0, 3), ...nozzleXPositions.slice(-3)];
  const showEllipsis = nozzleXPositions.length > maxVisible;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: Math.min(svgH, 300) }}>
      <defs>
        <marker id="el-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
        </marker>
        <marker id="el-arrow-rev" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
          <polygon points="8 0, 0 3, 8 6" fill={dimColor} />
        </marker>
        <marker
          id="el-arrow-accent"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
        </marker>
        <marker
          id="el-arrow-accent-rev"
          markerWidth="8"
          markerHeight="6"
          refX="0"
          refY="3"
          orient="auto"
        >
          <polygon points="8 0, 0 3, 8 6" fill={accentColor} />
        </marker>
        <linearGradient id="el-spray-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sprayFill} stopOpacity={0.6} />
          <stop offset="100%" stopColor={sprayFill} stopOpacity={0.1} />
        </linearGradient>
      </defs>

      {/* === Spray header pipe === */}
      <rect
        x={padding.left - 10}
        y={headerY - 4}
        width={drawW + 20}
        height={8}
        rx={4}
        fill={pipeColor}
      />
      <text x={padding.left - 15} y={headerY + 2} textAnchor="end" fontSize={8} fill={dimColor}>
        Header
      </text>

      {/* === Spray cones === */}
      {visiblePositions.map((nx, i) => {
        const leftEdge = nx - halfSpreadPx;
        const rightEdge = nx + halfSpreadPx;
        return (
          <g key={i}>
            {/* Nozzle body */}
            <rect
              x={nx - 5}
              y={headerY + 4}
              width={10}
              height={nozzleBodyH - 4}
              rx={2}
              fill={pipeColor}
            />
            <polygon
              points={`${nx - 6},${nozzleTipY - 6} ${nx + 6},${nozzleTipY - 6} ${nx + 4},${nozzleTipY} ${nx - 4},${nozzleTipY}`}
              fill={pipeColor}
            />

            {/* Spray cone */}
            {isHollow ? (
              <>
                <line
                  x1={nx - 3}
                  y1={nozzleTipY}
                  x2={leftEdge}
                  y2={targetY}
                  stroke={sprayColor}
                  strokeWidth={1.5}
                  opacity={0.7}
                />
                <line
                  x1={nx + 3}
                  y1={nozzleTipY}
                  x2={rightEdge}
                  y2={targetY}
                  stroke={sprayColor}
                  strokeWidth={1.5}
                  opacity={0.7}
                />
                <line
                  x1={nx - 2}
                  y1={nozzleTipY}
                  x2={nx - halfSpreadPx * 0.4}
                  y2={targetY}
                  stroke={sprayColor}
                  strokeWidth={1}
                  strokeDasharray="3,2"
                  opacity={0.3}
                />
                <line
                  x1={nx + 2}
                  y1={nozzleTipY}
                  x2={nx + halfSpreadPx * 0.4}
                  y2={targetY}
                  stroke={sprayColor}
                  strokeWidth={1}
                  strokeDasharray="3,2"
                  opacity={0.3}
                />
              </>
            ) : (
              <polygon
                points={`${nx},${nozzleTipY} ${leftEdge},${targetY} ${rightEdge},${targetY}`}
                fill="url(#el-spray-grad)"
                stroke={sprayColor}
                strokeWidth={1}
                opacity={0.8}
              />
            )}
          </g>
        );
      })}

      {/* Ellipsis indicator for truncated nozzles */}
      {showEllipsis && (
        <text
          x={padding.left + drawW / 2}
          y={(nozzleTipY + targetY) / 2}
          textAnchor="middle"
          fontSize={16}
          fontWeight="bold"
          fill={dimColor}
        >
          ...
        </text>
      )}

      {/* === Tube bundle cross-section === */}
      <rect
        x={padding.left}
        y={bundleTopY}
        width={drawW}
        height={bundleH}
        rx={2}
        fill={bundleFill}
        stroke={bundleColor}
        strokeWidth={2}
      />
      {/* Tube circles inside bundle */}
      {Array.from({ length: Math.min(Math.floor(drawW / 16), 30) }).map((_, i) => (
        <circle
          key={`tube-${i}`}
          cx={padding.left + 10 + i * (drawW / Math.min(Math.floor(drawW / 16), 30))}
          cy={bundleTopY + bundleH / 2}
          r={4}
          fill="none"
          stroke={bundleColor}
          strokeWidth={1}
          opacity={0.5}
        />
      ))}
      <text
        x={padding.left + drawW / 2}
        y={bundleTopY + bundleH + 14}
        textAnchor="middle"
        fontSize={9}
        fill={dimColor}
      >
        Tube Bundle
      </text>

      {/* === Spray height dimension (right side) === */}
      <line
        x1={padding.left + drawW + 20}
        y1={nozzleTipY}
        x2={padding.left + drawW + 20}
        y2={bundleTopY}
        stroke={accentColor}
        strokeWidth={1.5}
        markerStart="url(#el-arrow-accent-rev)"
        markerEnd="url(#el-arrow-accent)"
      />
      <text
        x={padding.left + drawW + 28}
        y={(nozzleTipY + bundleTopY) / 2 - 4}
        fontSize={9}
        fontWeight="bold"
        fill={accentColor}
      >
        {match.derivedHeight} mm
      </text>
      <text
        x={padding.left + drawW + 28}
        y={(nozzleTipY + bundleTopY) / 2 + 8}
        fontSize={8}
        fill={accentColor}
      >
        (derived height)
      </text>

      {/* === Pitch dimension (between first two nozzles) === */}
      {(() => {
        const p0 = visiblePositions[0];
        const p1 = visiblePositions[1];
        if (match.nozzlesAlongLength <= 1 || !p0 || !p1) return null;
        return (
          <>
            <line
              x1={p0}
              y1={bundleTopY + bundleH + 22}
              x2={p1}
              y2={bundleTopY + bundleH + 22}
              stroke={accentColor}
              strokeWidth={1.5}
              markerStart="url(#el-arrow-accent-rev)"
              markerEnd="url(#el-arrow-accent)"
            />
            <text
              x={(p0 + p1) / 2}
              y={bundleTopY + bundleH + 36}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={accentColor}
            >
              {match.pitchAlongLength} mm pitch
            </text>
          </>
        );
      })()}

      {/* === Bundle length dimension (bottom) === */}
      <line
        x1={padding.left}
        y1={bundleTopY + bundleH + 42}
        x2={padding.left + drawW}
        y2={bundleTopY + bundleH + 42}
        stroke={dimColor}
        strokeWidth={1}
        markerStart="url(#el-arrow-rev)"
        markerEnd="url(#el-arrow)"
      />
      <text
        x={padding.left + drawW / 2}
        y={bundleTopY + bundleH + 54}
        textAnchor="middle"
        fontSize={9}
        fill={dimColor}
      >
        {bundleLength} mm
      </text>

      {/* === Nozzle count label === */}
      <text
        x={padding.left - 15}
        y={(nozzleTipY + targetY) / 2}
        textAnchor="end"
        fontSize={9}
        fill={dimColor}
      >
        {match.nozzlesAlongLength} nozzles
      </text>
      <text
        x={padding.left - 15}
        y={(nozzleTipY + targetY) / 2 + 12}
        textAnchor="end"
        fontSize={8}
        fill={dimColor}
      >
        along length
      </text>
    </svg>
  );
}

// ── Plan View ─────────────────────────────────────────────────────────────────

function PlanView({
  match,
  bundleLength,
  bundleWidth,
  isSquare,
  bundleColor,
  bundleFill,
  sprayColor,
  sprayFill,
  dimColor,
  accentColor,
  pipeColor,
}: {
  match: NozzleLayoutMatch;
  bundleLength: number;
  bundleWidth: number;
  isSquare: boolean;
  bundleColor: string;
  bundleFill: string;
  sprayColor: string;
  sprayFill: string;
  dimColor: string;
  accentColor: string;
  pipeColor: string;
}) {
  const padding = 50;
  const maxDrawW = 440;
  const maxDrawH = 260;

  const scaleX = maxDrawW / bundleLength;
  const scaleY = maxDrawH / bundleWidth;
  const scale = Math.min(scaleX, scaleY);

  const drawW = bundleLength * scale;
  const drawH = bundleWidth * scale;
  const svgW = drawW + padding * 2;
  const svgH = drawH + padding * 2;

  const bx = padding;
  const by = padding;

  const covR = (match.coverageDiameter / 2) * scale;
  const pitchL = match.pitchAlongLength * scale;

  const pitchW = match.pitchAcrossWidth * scale;

  const nozzlePositions: Array<{ cx: number; cy: number }> = [];
  for (let row = 0; row < match.rowsAcrossWidth; row++) {
    const rowCy = match.rowsAcrossWidth === 1 ? by + drawH / 2 : by + pitchW / 2 + row * pitchW;
    for (let col = 0; col < match.nozzlesAlongLength; col++) {
      const cx = match.nozzlesAlongLength === 1 ? bx + drawW / 2 : bx + pitchL / 2 + col * pitchL;
      nozzlePositions.push({ cx, cy: rowCy });
    }
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxHeight: Math.min(svgH, 360) }}>
      <defs>
        <marker id="pl-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={dimColor} />
        </marker>
        <marker id="pl-arrow-rev" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
          <polygon points="8 0, 0 3, 8 6" fill={dimColor} />
        </marker>
        <marker
          id="pl-arrow-accent"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={accentColor} />
        </marker>
        <marker
          id="pl-arrow-accent-rev"
          markerWidth="8"
          markerHeight="6"
          refX="0"
          refY="3"
          orient="auto"
        >
          <polygon points="8 0, 0 3, 8 6" fill={accentColor} />
        </marker>
      </defs>

      {/* Bundle rectangle */}
      <rect
        x={bx}
        y={by}
        width={drawW}
        height={drawH}
        rx={3}
        fill={bundleFill}
        stroke={bundleColor}
        strokeWidth={2}
      />
      <text
        x={bx + drawW / 2}
        y={by - 8}
        textAnchor="middle"
        fontSize={10}
        fontWeight="bold"
        fill={dimColor}
      >
        Tube Bundle
      </text>

      {/* Coverage areas */}
      {nozzlePositions.map((pos, i) =>
        isSquare ? (
          <rect
            key={i}
            x={pos.cx - covR}
            y={pos.cy - covR}
            width={covR * 2}
            height={covR * 2}
            fill={sprayFill}
            fillOpacity={0.2}
            stroke={sprayColor}
            strokeWidth={1}
            strokeDasharray="4,3"
            rx={1}
          />
        ) : (
          <circle
            key={i}
            cx={pos.cx}
            cy={pos.cy}
            r={covR}
            fill={sprayFill}
            fillOpacity={0.2}
            stroke={sprayColor}
            strokeWidth={1}
            strokeDasharray="4,3"
          />
        )
      )}

      {/* Nozzle dots */}
      {nozzlePositions.map((pos, i) => (
        <circle key={`dot-${i}`} cx={pos.cx} cy={pos.cy} r={3} fill={pipeColor} />
      ))}

      {/* Bundle length (bottom) */}
      <line
        x1={bx}
        y1={by + drawH + 18}
        x2={bx + drawW}
        y2={by + drawH + 18}
        stroke={dimColor}
        strokeWidth={1}
        markerStart="url(#pl-arrow-rev)"
        markerEnd="url(#pl-arrow)"
      />
      <text x={bx + drawW / 2} y={by + drawH + 32} textAnchor="middle" fontSize={9} fill={dimColor}>
        {bundleLength} mm (length)
      </text>

      {/* Bundle width (right) */}
      <line
        x1={bx + drawW + 18}
        y1={by}
        x2={bx + drawW + 18}
        y2={by + drawH}
        stroke={dimColor}
        strokeWidth={1}
        markerStart="url(#pl-arrow-rev)"
        markerEnd="url(#pl-arrow)"
      />
      <text
        x={bx + drawW + 26}
        y={by + drawH / 2}
        fontSize={9}
        fill={dimColor}
        transform={`rotate(90, ${bx + drawW + 26}, ${by + drawH / 2})`}
        textAnchor="middle"
      >
        {bundleWidth} mm (width)
      </text>

      {/* Pitch along length */}
      {(() => {
        const p0 = nozzlePositions[0];
        const p1 = nozzlePositions[1];
        if (match.nozzlesAlongLength <= 1 || !p0 || !p1) return null;
        return (
          <>
            <line
              x1={p0.cx}
              y1={p0.cy - covR - 6}
              x2={p1.cx}
              y2={p1.cy - covR - 6}
              stroke={accentColor}
              strokeWidth={1.5}
              markerStart="url(#pl-arrow-accent-rev)"
              markerEnd="url(#pl-arrow-accent)"
            />
            <text
              x={(p0.cx + p1.cx) / 2}
              y={p0.cy - covR - 10}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={accentColor}
            >
              {match.pitchAlongLength} mm pitch
            </text>
          </>
        );
      })()}

      {/* Pitch across width */}
      {match.rowsAcrossWidth > 1 &&
        (() => {
          const firstRow = nozzlePositions[0];
          const secondRow = nozzlePositions[match.nozzlesAlongLength];
          if (!firstRow || !secondRow) return null;
          return (
            <>
              <line
                x1={firstRow.cx - covR - 6}
                y1={firstRow.cy}
                x2={secondRow.cx - covR - 6}
                y2={secondRow.cy}
                stroke={accentColor}
                strokeWidth={1.5}
                markerStart="url(#pl-arrow-accent-rev)"
                markerEnd="url(#pl-arrow-accent)"
              />
              <text
                x={firstRow.cx - covR - 14}
                y={(firstRow.cy + secondRow.cy) / 2}
                textAnchor="middle"
                fontSize={9}
                fontWeight="bold"
                fill={accentColor}
                transform={`rotate(-90, ${firstRow.cx - covR - 14}, ${(firstRow.cy + secondRow.cy) / 2})`}
              >
                {match.pitchAcrossWidth} mm
              </text>
            </>
          );
        })()}

      {/* Summary text */}
      <text x={bx + drawW / 2} y={by + drawH + 46} textAnchor="middle" fontSize={9} fill={dimColor}>
        {match.nozzlesAlongLength} x {match.rowsAcrossWidth} = {match.totalNozzles} nozzle
        {match.totalNozzles !== 1 ? 's' : ''} | Height: {match.derivedHeight} mm | Overlap: L=
        {match.actualOverlapLength}%
        {match.rowsAcrossWidth > 1 ? `, W=${match.actualOverlapWidth}%` : ''}
      </text>
    </svg>
  );
}
