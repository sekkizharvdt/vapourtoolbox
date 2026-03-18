'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { SingleTubeResult } from '@vapour/types';

interface SingleTubeDiagramProps {
  result: SingleTubeResult | null;
}

export function SingleTubeDiagram({ result }: SingleTubeDiagramProps) {
  const theme = useTheme();
  const textCol = theme.palette.text.primary;
  const lightBlue = '#bbdefb';
  const orange = '#ff9800';
  const grey = theme.palette.grey[400];

  const W = 500;
  const H = 260;
  const tubeY = H / 2;
  const tubeLen = 360;
  const tubeX = (W - tubeLen) / 2;
  const tubeODpx = 40;
  const tubeWallPx = result
    ? Math.max(2, (result.inputs.wallThickness / result.inputs.tubeOD) * tubeODpx)
    : 4;
  const tubeIDpx = tubeODpx - 2 * tubeWallPx;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Single Tube Cross-Section
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 500 }}>
          {/* Spray droplets (outside) */}
          {[0.15, 0.3, 0.45, 0.6, 0.75, 0.85].map((frac, i) => {
            const x = tubeX + frac * tubeLen;
            return (
              <g key={`drop-${i}`}>
                <line
                  x1={x}
                  y1={tubeY - tubeODpx / 2 - 25}
                  x2={x}
                  y2={tubeY - tubeODpx / 2 - 5}
                  stroke={lightBlue}
                  strokeWidth={1.5}
                  strokeDasharray="3,4"
                />
                <circle cx={x} cy={tubeY - tubeODpx / 2 - 5} r={2} fill={lightBlue} />
              </g>
            );
          })}

          {/* Label: Spray Water */}
          <text
            x={W / 2}
            y={tubeY - tubeODpx / 2 - 32}
            textAnchor="middle"
            fontSize={10}
            fill={textCol}
          >
            Spray Water (Evaporation)
          </text>

          {/* Outer tube surface */}
          <rect
            x={tubeX}
            y={tubeY - tubeODpx / 2}
            width={tubeLen}
            height={tubeODpx}
            rx={tubeODpx / 2}
            ry={tubeODpx / 2}
            fill={grey}
            stroke={textCol}
            strokeWidth={1}
          />

          {/* Inner bore (condensation zone) */}
          <rect
            x={tubeX + tubeWallPx}
            y={tubeY - tubeIDpx / 2}
            width={tubeLen - 2 * tubeWallPx}
            height={tubeIDpx}
            rx={tubeIDpx / 2}
            ry={tubeIDpx / 2}
            fill="#fff3e0"
            stroke="none"
          />

          {/* Condensate film (inside, thin orange band) */}
          <rect
            x={tubeX + tubeWallPx}
            y={tubeY - tubeIDpx / 2}
            width={tubeLen - 2 * tubeWallPx}
            height={tubeIDpx}
            rx={tubeIDpx / 2}
            ry={tubeIDpx / 2}
            fill="none"
            stroke={orange}
            strokeWidth={2}
            opacity={0.6}
          />

          {/* Falling film (outside, thin blue band) */}
          <rect
            x={tubeX - 2}
            y={tubeY - tubeODpx / 2 - 2}
            width={tubeLen + 4}
            height={tubeODpx + 4}
            rx={(tubeODpx + 4) / 2}
            ry={(tubeODpx + 4) / 2}
            fill="none"
            stroke={lightBlue}
            strokeWidth={3}
            opacity={0.7}
          />

          {/* Vapour arrow IN (left) */}
          <defs>
            <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill={orange} />
            </marker>
            <marker id="arrowD" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
              <path d="M0,0 L6,0 L3,8 Z" fill={lightBlue} />
            </marker>
          </defs>

          <line
            x1={tubeX - 30}
            y1={tubeY}
            x2={tubeX - 2}
            y2={tubeY}
            stroke={orange}
            strokeWidth={2}
            markerEnd="url(#arrowR)"
          />
          <text x={tubeX - 32} y={tubeY - 6} textAnchor="end" fontSize={9} fill={textCol}>
            Vapour In
          </text>

          {/* Condensate arrow OUT (right) */}
          <line
            x1={tubeX + tubeLen + 2}
            y1={tubeY}
            x2={tubeX + tubeLen + 30}
            y2={tubeY}
            stroke={orange}
            strokeWidth={2}
            markerEnd="url(#arrowR)"
          />
          <text
            x={tubeX + tubeLen + 33}
            y={tubeY - 6}
            textAnchor="start"
            fontSize={9}
            fill={textCol}
          >
            Condensate
          </text>

          {/* Evaporated vapour rising */}
          <text
            x={W / 2}
            y={tubeY + tubeODpx / 2 + 20}
            textAnchor="middle"
            fontSize={9}
            fill={textCol}
          >
            Brine / Concentrate drains down
          </text>

          {/* Results annotation */}
          {result && (
            <>
              {/* Film thickness annotations */}
              <text
                x={tubeX + tubeLen + 5}
                y={tubeY + tubeODpx / 2 + 40}
                fontSize={8}
                fill={textCol}
              >
                Inside film: {result.insideFilm.filmThickness.toFixed(4)} mm
              </text>
              <text
                x={tubeX + tubeLen + 5}
                y={tubeY + tubeODpx / 2 + 52}
                fontSize={8}
                fill={textCol}
              >
                Outside film: {result.outsideFilm.filmThickness.toFixed(4)} mm
              </text>

              {/* Material label */}
              <text
                x={W / 2}
                y={tubeY + 4}
                textAnchor="middle"
                fontSize={8}
                fill={textCol}
                fontWeight="bold"
              >
                {result.inputs.tubeOD} &times; {result.inputs.wallThickness} mm
              </text>
            </>
          )}
        </svg>
      </Box>
    </Paper>
  );
}
