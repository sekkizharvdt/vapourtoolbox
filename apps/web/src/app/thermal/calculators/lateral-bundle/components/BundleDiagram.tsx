'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { TubeBundleGeometryResult, TubeBundleGeometryInput } from '@/lib/thermal';

interface BundleDiagramProps {
  result: TubeBundleGeometryResult | null;
  input: TubeBundleGeometryInput | null;
}

export function BundleDiagram({ result, input }: BundleDiagramProps) {
  const theme = useTheme();
  const textCol = theme.palette.text.primary;
  const tubeCol = theme.palette.grey[400];
  const shellCol = theme.palette.grey[600];
  if (!result || !input || result.totalTubes === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Tube Bundle Layout
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Enter inputs to see the tube layout diagram.
        </Typography>
      </Paper>
    );
  }

  const shellR = (input.shellID ?? 2000) / 2;
  const tubeOD = input.tubeOD ?? 25.4;

  // SVG viewport: scale to fit the shell
  const margin = 40;
  const viewSize = shellR * 2 + margin * 2;
  const cx = viewSize / 2;
  const cy = viewSize / 2;

  // Scale tube circles for visibility (min 2px radius in the viewport)
  const tubeR = Math.max(tubeOD / 2, 2);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Tube Bundle Layout ({result.totalTubes} tubes)
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          width="100%"
          style={{ maxWidth: 600, maxHeight: 600 }}
        >
          {/* Shell circle */}
          <circle cx={cx} cy={cy} r={shellR} fill="none" stroke={shellCol} strokeWidth={2} />

          {/* Centre lines */}
          <line
            x1={cx}
            y1={margin}
            x2={cx}
            y2={viewSize - margin}
            stroke={shellCol}
            strokeWidth={0.5}
            strokeDasharray="8,4"
          />
          <line
            x1={margin}
            y1={cy}
            x2={viewSize - margin}
            y2={cy}
            stroke={shellCol}
            strokeWidth={0.5}
            strokeDasharray="8,4"
          />

          {/* Tubes */}
          {result.tubes.map((t, i) => (
            <circle
              key={i}
              cx={cx + t.x}
              cy={cy - t.y}
              r={tubeR}
              fill={tubeCol}
              stroke={textCol}
              strokeWidth={0.3}
            />
          ))}

          {/* Labels */}
          <text x={cx} y={margin - 10} textAnchor="middle" fontSize={12} fill={textCol}>
            {result.totalTubes} tubes | {result.numberOfRows} rows
          </text>
          <text x={cx} y={viewSize - margin + 20} textAnchor="middle" fontSize={10} fill={textCol}>
            Shell ID: {input.shellID} mm
          </text>
        </svg>
      </Box>
    </Paper>
  );
}
