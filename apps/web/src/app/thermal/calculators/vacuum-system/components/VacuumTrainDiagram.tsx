'use client';

/**
 * Vacuum Train Process Flow Diagram
 *
 * SVG schematic showing the vacuum system configuration:
 * condenser vent → ejector(s) → inter-condenser(s) → LRVP → atmosphere
 */

import { Paper, Typography, useTheme } from '@mui/material';
import type { VacuumSystemResult, StageResult } from '@/lib/thermal/vacuumSystemCalculator';

interface VacuumTrainDiagramProps {
  result: VacuumSystemResult;
}

export function VacuumTrainDiagram({ result }: VacuumTrainDiagramProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const primary = theme.palette.primary.main;
  const text = isDark ? '#e0e0e0' : '#333';
  const textMuted = isDark ? '#999' : '#777';
  const bg = isDark ? '#1e1e1e' : '#fafafa';
  const pipeFill = isDark ? '#555' : '#bbb';
  const ejectorFill = isDark ? '#1565c0' : '#bbdefb';
  const ejectorStroke = isDark ? '#42a5f5' : '#1976d2';
  const lrvpFill = isDark ? '#2e7d32' : '#c8e6c9';
  const lrvpStroke = isDark ? '#66bb6a' : '#388e3c';
  const icFill = isDark ? '#e65100' : '#ffe0b2';
  const icStroke = isDark ? '#ff9800' : '#f57c00';
  const condenserFill = isDark ? '#4a148c' : '#e1bee7';
  const condenserStroke = isDark ? '#ab47bc' : '#7b1fa2';

  // Build equipment sequence from stages
  const equipment: {
    type: 'condenser' | 'ejector' | 'inter_condenser' | 'lrvp' | 'atmosphere';
    stage?: StageResult;
    label: string;
    sublabel?: string;
  }[] = [];

  // Condenser (source)
  equipment.push({
    type: 'condenser',
    label: 'Condenser',
    sublabel: `${result.suctionPressureMbar} mbar`,
  });

  // Stages
  for (const stage of result.stages) {
    if (stage.type === 'ejector') {
      equipment.push({
        type: 'ejector',
        stage,
        label: `Ejector ${stage.stageNumber <= 2 ? stage.stageNumber : Math.ceil(stage.stageNumber / 2)}`,
        sublabel: `CR ${stage.compressionRatio}`,
      });
    } else if (stage.type === 'inter_condenser') {
      equipment.push({
        type: 'inter_condenser',
        stage,
        label: 'Inter-Cond.',
        sublabel: `${stage.condenserDutyKW} kW`,
      });
    } else if (stage.type === 'lrvp') {
      equipment.push({
        type: 'lrvp',
        stage,
        label: stage.lrvpModel ?? 'LRVP',
        sublabel: `${stage.lrvpPowerKW} kW`,
      });
    }
  }

  // Atmosphere (sink)
  equipment.push({
    type: 'atmosphere',
    label: 'Atmosphere',
    sublabel: `${result.dischargePressureMbar} mbar`,
  });

  const count = equipment.length;
  const svgWidth = 800;
  const svgHeight = 200;
  const margin = 60;
  const usableWidth = svgWidth - 2 * margin;
  const spacing = usableWidth / (count - 1);
  const centerY = 100;
  const boxW = 80;
  const boxH = 50;

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Vacuum Train Schematic
      </Typography>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ maxHeight: 220, background: bg, borderRadius: 8 }}
      >
        <defs>
          <marker id="arrow-vac" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill={pipeFill} />
          </marker>
        </defs>

        {/* Connecting pipes between equipment */}
        {equipment.map((_, idx) => {
          if (idx === count - 1) return null;
          const x1 = margin + idx * spacing + boxW / 2;
          const x2 = margin + (idx + 1) * spacing - boxW / 2;
          if (x2 <= x1) return null;
          return (
            <line
              key={`pipe-${idx}`}
              x1={x1}
              y1={centerY}
              x2={x2}
              y2={centerY}
              stroke={pipeFill}
              strokeWidth={3}
              markerEnd="url(#arrow-vac)"
            />
          );
        })}

        {/* Motive steam arrows for ejectors */}
        {equipment.map((eq, idx) => {
          if (eq.type !== 'ejector' || !eq.stage) return null;
          const cx = margin + idx * spacing;
          return (
            <g key={`motive-${idx}`}>
              <line
                x1={cx}
                y1={centerY - boxH / 2 - 30}
                x2={cx}
                y2={centerY - boxH / 2}
                stroke={ejectorStroke}
                strokeWidth={2}
                markerEnd="url(#arrow-vac)"
              />
              <text
                x={cx}
                y={centerY - boxH / 2 - 34}
                textAnchor="middle"
                fill={textMuted}
                fontSize={8}
              >
                Steam {eq.stage.motiveSteamKgH} kg/h
              </text>
            </g>
          );
        })}

        {/* Cooling water arrows for inter-condensers */}
        {equipment.map((eq, idx) => {
          if (eq.type !== 'inter_condenser' || !eq.stage) return null;
          const cx = margin + idx * spacing;
          return (
            <g key={`cw-${idx}`}>
              <line
                x1={cx}
                y1={centerY + boxH / 2}
                x2={cx}
                y2={centerY + boxH / 2 + 25}
                stroke={icStroke}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={centerY + boxH / 2 + 38}
                textAnchor="middle"
                fill={textMuted}
                fontSize={8}
              >
                CW {eq.stage.coolingWaterM3h} m³/h
              </text>
            </g>
          );
        })}

        {/* Equipment boxes */}
        {equipment.map((eq, idx) => {
          const cx = margin + idx * spacing;
          const x = cx - boxW / 2;
          const y = centerY - boxH / 2;

          let fill = bg;
          let stroke = pipeFill;

          switch (eq.type) {
            case 'condenser':
              fill = condenserFill;
              stroke = condenserStroke;
              break;
            case 'ejector':
              fill = ejectorFill;
              stroke = ejectorStroke;
              break;
            case 'inter_condenser':
              fill = icFill;
              stroke = icStroke;
              break;
            case 'lrvp':
              fill = lrvpFill;
              stroke = lrvpStroke;
              break;
            case 'atmosphere':
              // No box for atmosphere, just label
              return (
                <g key={`eq-${idx}`}>
                  <text
                    x={cx}
                    y={centerY - 4}
                    textAnchor="middle"
                    fill={text}
                    fontSize={10}
                    fontWeight="bold"
                  >
                    {eq.label}
                  </text>
                  <text x={cx} y={centerY + 10} textAnchor="middle" fill={textMuted} fontSize={9}>
                    {eq.sublabel}
                  </text>
                </g>
              );
          }

          return (
            <g key={`eq-${idx}`}>
              <rect
                x={x}
                y={y}
                width={boxW}
                height={boxH}
                rx={6}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={centerY - 4}
                textAnchor="middle"
                fill={text}
                fontSize={10}
                fontWeight="bold"
              >
                {eq.label}
              </text>
              {eq.sublabel && (
                <text x={cx} y={centerY + 10} textAnchor="middle" fill={textMuted} fontSize={9}>
                  {eq.sublabel}
                </text>
              )}
            </g>
          );
        })}

        {/* Flow annotation at suction */}
        <text
          x={margin}
          y={centerY + boxH / 2 + 16}
          textAnchor="middle"
          fill={primary}
          fontSize={9}
          fontWeight="bold"
        >
          {result.designSuctionVolumeM3h} m³/h
        </text>
      </svg>
    </Paper>
  );
}
