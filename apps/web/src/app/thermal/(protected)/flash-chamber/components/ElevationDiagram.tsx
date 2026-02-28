'use client';

/**
 * SVG-based Engineering Elevation Diagram
 *
 * Shows the calculated chamber dimensions with an engineering-grade
 * SVG elevation diagram showing level gauge tapping points and nozzle positions.
 */

import { useTheme, useMediaQuery } from '@mui/material';
import type { FlashChamberElevations, NozzleSizing } from '@vapour/types';

interface ElevationDiagramProps {
  elevations: FlashChamberElevations;
  nozzles?: NozzleSizing[];
}

/**
 * Format elevation value for display
 */
const formatElevation = (value: number): string => {
  return value.toFixed(3);
};

export function ElevationDiagram({ elevations, nozzles }: ElevationDiagramProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // SVG dimensions
  const svgWidth = isMobile ? 320 : 450;
  const svgHeight = 420;
  const chamberWidth = 80;
  const chamberX = 160;
  const topY = 40;
  const bottomY = 340;
  const drawingHeight = bottomY - topY;

  // Calculate Y positions based on actual elevations
  // All elevations are relative to FFL = 0.000 m
  // FFL is at 0, pump is above FFL, chamber is above pump
  const ttlM = elevations.ttl;
  const ffl = elevations.ffl; // Always 0
  const pumpCL = elevations.pumpCenterline; // Positive (above FFL)

  // Total range from FFL to TTL (or slightly below for margin)
  const minY = Math.min(ffl, pumpCL) - 0.5; // Add margin below pump/FFL
  const totalRange = ttlM - minY;

  const scaleY = (elevation: number) => {
    // Convert elevation to SVG Y
    const normalized = (elevation - minY) / totalRange;
    return bottomY - normalized * drawingHeight;
  };

  // Zone Y positions
  const fflY = scaleY(ffl);
  const btlY = scaleY(elevations.btl);
  const lgLowY = scaleY(elevations.lgLow);
  const operatingY = scaleY(elevations.operatingLevel);
  const lgHighY = scaleY(elevations.lgHigh);
  const flashBottomY = scaleY(elevations.flashingZoneBottom);
  const flashTopY = scaleY(elevations.flashingZoneTop);
  const ttlY = scaleY(elevations.ttl);
  const pumpY = scaleY(elevations.pumpCenterline);

  // Colors
  const sprayColor = theme.palette.info.main;
  const flashColor = theme.palette.warning.main;
  const retentionColor = theme.palette.primary.main;
  const lineColor = theme.palette.text.secondary;
  const textColor = theme.palette.text.primary;
  const labelColor = theme.palette.text.secondary;

  // Get nozzle info
  const inletNozzle = nozzles?.find((n) => n.type === 'inlet');
  const vaporNozzle = nozzles?.find((n) => n.type === 'vapor');
  const brineNozzle = nozzles?.find((n) => n.type === 'outlet');

  return (
    <svg width={svgWidth} height={svgHeight} style={{ fontFamily: 'monospace' }}>
      {/* Title */}
      <text
        x={svgWidth / 2}
        y={20}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill={textColor}
      >
        ELEVATION DIAGRAM
      </text>

      {/* Chamber outline - from TTL to BTL */}
      <rect
        x={chamberX}
        y={ttlY}
        width={chamberWidth}
        height={btlY - ttlY}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
      />

      {/* Top dome (semi-ellipse) */}
      <ellipse
        cx={chamberX + chamberWidth / 2}
        cy={ttlY}
        rx={chamberWidth / 2}
        ry={15}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
      />

      {/* Bottom head (semi-ellipse) - at BTL level */}
      <ellipse
        cx={chamberX + chamberWidth / 2}
        cy={btlY}
        rx={chamberWidth / 2}
        ry={15}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
      />

      {/* Zone fills (with transparency) */}
      {/* Spray Zone - from TTL (top of dome, ttlY - 15) to flash zone top */}
      {/* In SVG: Y increases downward, so higher elevation = lower Y value */}
      <rect
        x={chamberX + 1}
        y={ttlY - 15}
        width={chamberWidth - 2}
        height={flashTopY - (ttlY - 15)}
        fill={sprayColor}
        fillOpacity={0.3}
      />
      {/* Flashing Zone - from flash zone top to flash zone bottom */}
      <rect
        x={chamberX + 1}
        y={flashTopY}
        width={chamberWidth - 2}
        height={flashBottomY - flashTopY}
        fill={flashColor}
        fillOpacity={0.3}
      />
      {/* Retention Zone - from LG-H to LG-L (lower elevation = higher Y) */}
      <rect
        x={chamberX + 1}
        y={lgHighY}
        width={chamberWidth - 2}
        height={lgLowY - lgHighY}
        fill={retentionColor}
        fillOpacity={0.3}
      />

      {/* Zone labels inside chamber */}
      <text
        x={chamberX + chamberWidth / 2}
        y={(ttlY + flashTopY) / 2 + 4}
        textAnchor="middle"
        fontSize={9}
        fill={textColor}
      >
        SPRAY
      </text>
      <text
        x={chamberX + chamberWidth / 2}
        y={(flashTopY + flashBottomY) / 2 + 4}
        textAnchor="middle"
        fontSize={9}
        fill={textColor}
      >
        FLASHING
      </text>
      <text
        x={chamberX + chamberWidth / 2}
        y={(lgLowY + lgHighY) / 2 + 4}
        textAnchor="middle"
        fontSize={9}
        fill={textColor}
      >
        RETENTION
      </text>

      {/* Zone boundary lines (dashed) */}
      <line
        x1={chamberX}
        y1={flashTopY}
        x2={chamberX + chamberWidth}
        y2={flashTopY}
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray="4,2"
      />
      <line
        x1={chamberX}
        y1={flashBottomY}
        x2={chamberX + chamberWidth}
        y2={flashBottomY}
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray="4,2"
      />
      <line
        x1={chamberX}
        y1={lgLowY}
        x2={chamberX + chamberWidth}
        y2={lgLowY}
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray="4,2"
      />

      {/* Level Gauge Bridle (right side) */}
      <g>
        {/* Bridle vertical line */}
        <line
          x1={chamberX + chamberWidth + 25}
          y1={lgLowY}
          x2={chamberX + chamberWidth + 25}
          y2={lgHighY}
          stroke={theme.palette.success.main}
          strokeWidth={3}
        />
        {/* Tapping connections */}
        <line
          x1={chamberX + chamberWidth}
          y1={lgLowY}
          x2={chamberX + chamberWidth + 25}
          y2={lgLowY}
          stroke={theme.palette.success.main}
          strokeWidth={2}
        />
        <line
          x1={chamberX + chamberWidth}
          y1={lgHighY}
          x2={chamberX + chamberWidth + 25}
          y2={lgHighY}
          stroke={theme.palette.success.main}
          strokeWidth={2}
        />
        {/* Bridle label */}
        <text
          x={chamberX + chamberWidth + 35}
          y={(lgLowY + lgHighY) / 2}
          fontSize={8}
          fill={theme.palette.success.main}
          dominantBaseline="middle"
        >
          LG
        </text>
      </g>

      {/* Elevation labels (left side) */}
      <g fontSize={9} fill={labelColor}>
        {/* TTL */}
        <line
          x1={30}
          y1={ttlY}
          x2={chamberX - 5}
          y2={ttlY}
          stroke={lineColor}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <text x={25} y={ttlY + 3} textAnchor="end">
          TTL
        </text>
        <text x={60} y={ttlY + 3} textAnchor="start" fontWeight="bold" fill={textColor}>
          EL {formatElevation(elevations.ttl)} m
        </text>

        {/* Flash Zone Top */}
        <line
          x1={60}
          y1={flashTopY}
          x2={chamberX - 5}
          y2={flashTopY}
          stroke={lineColor}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <text x={60} y={flashTopY + 3} textAnchor="start" fill={textColor}>
          EL {formatElevation(elevations.flashingZoneTop)} m
        </text>

        {/* LG-H */}
        <line
          x1={30}
          y1={lgHighY}
          x2={chamberX - 5}
          y2={lgHighY}
          stroke={lineColor}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <text x={25} y={lgHighY + 3} textAnchor="end">
          LG-H
        </text>
        <text x={60} y={lgHighY + 3} textAnchor="start" fontWeight="bold" fill={textColor}>
          EL {formatElevation(elevations.lgHigh)} m
        </text>

        {/* Operating Level */}
        <line
          x1={30}
          y1={operatingY}
          x2={chamberX - 5}
          y2={operatingY}
          stroke={theme.palette.info.main}
          strokeWidth={1}
          strokeDasharray="6,2"
        />
        <text x={25} y={operatingY + 3} textAnchor="end" fill={theme.palette.info.main}>
          OP-LVL
        </text>
        <text
          x={60}
          y={operatingY + 3}
          textAnchor="start"
          fontWeight="bold"
          fill={theme.palette.info.main}
        >
          EL {formatElevation(elevations.operatingLevel)} m
        </text>

        {/* LG-L */}
        <line
          x1={30}
          y1={lgLowY}
          x2={chamberX - 5}
          y2={lgLowY}
          stroke={lineColor}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <text x={25} y={lgLowY + 3} textAnchor="end">
          LG-L
        </text>
        <text x={60} y={lgLowY + 3} textAnchor="start" fontWeight="bold" fill={textColor}>
          EL {formatElevation(elevations.lgLow)} m
        </text>

        {/* BTL */}
        <line
          x1={30}
          y1={btlY}
          x2={chamberX - 5}
          y2={btlY}
          stroke={lineColor}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <text x={25} y={btlY + 3} textAnchor="end">
          BTL
        </text>
        <text x={60} y={btlY + 3} textAnchor="start" fontWeight="bold" fill={textColor}>
          EL {formatElevation(elevations.btl)} m
        </text>

        {/* FFL Reference */}
        <line
          x1={30}
          y1={fflY}
          x2={chamberX + chamberWidth + 50}
          y2={fflY}
          stroke={theme.palette.error.main}
          strokeWidth={1.5}
          strokeDasharray="8,4"
        />
        <text
          x={25}
          y={fflY + 3}
          textAnchor="end"
          fontWeight="bold"
          fill={theme.palette.error.main}
        >
          FFL
        </text>
        <text
          x={60}
          y={fflY + 3}
          textAnchor="start"
          fontWeight="bold"
          fill={theme.palette.error.main}
        >
          EL 0.000 m
        </text>
      </g>

      {/* Nozzles (right side) */}
      <g>
        {/* N2 - Vapor Outlet (top) */}
        <line
          x1={chamberX + chamberWidth}
          y1={ttlY + 5}
          x2={chamberX + chamberWidth + 40}
          y2={ttlY + 5}
          stroke={lineColor}
          strokeWidth={2}
        />
        <text x={chamberX + chamberWidth + 45} y={ttlY + 8} fontSize={8} fill={textColor}>
          N2 Vapor
        </text>
        {vaporNozzle && (
          <text x={chamberX + chamberWidth + 45} y={ttlY + 18} fontSize={7} fill={labelColor}>
            {vaporNozzle.nps}
          </text>
        )}

        {/* N1 - Inlet (spray zone) */}
        <line
          x1={chamberX + chamberWidth}
          y1={scaleY(elevations.nozzleElevations.inlet)}
          x2={chamberX + chamberWidth + 40}
          y2={scaleY(elevations.nozzleElevations.inlet)}
          stroke={lineColor}
          strokeWidth={2}
        />
        <text
          x={chamberX + chamberWidth + 45}
          y={scaleY(elevations.nozzleElevations.inlet) + 3}
          fontSize={8}
          fill={textColor}
        >
          N1 Inlet
        </text>
        {inletNozzle && (
          <text
            x={chamberX + chamberWidth + 45}
            y={scaleY(elevations.nozzleElevations.inlet) + 13}
            fontSize={7}
            fill={labelColor}
          >
            {inletNozzle.nps}
          </text>
        )}

        {/* N3 - Brine Outlet (bottom - at BTL level) */}
        <line
          x1={chamberX + chamberWidth / 2}
          y1={btlY + 15}
          x2={chamberX + chamberWidth / 2}
          y2={btlY + 35}
          stroke={lineColor}
          strokeWidth={2}
        />
        <text x={chamberX + chamberWidth / 2 + 5} y={btlY + 45} fontSize={8} fill={textColor}>
          N3 Brine
        </text>
        {brineNozzle && (
          <text x={chamberX + chamberWidth / 2 + 5} y={btlY + 55} fontSize={7} fill={labelColor}>
            {brineNozzle.nps}
          </text>
        )}
      </g>

      {/* Pump centerline (below BTL) */}
      <g>
        <line
          x1={chamberX + chamberWidth / 2 - 20}
          y1={pumpY}
          x2={chamberX + chamberWidth / 2 + 20}
          y2={pumpY}
          stroke={lineColor}
          strokeWidth={1}
          strokeDasharray="6,3"
        />
        <text
          x={chamberX + chamberWidth / 2 - 25}
          y={pumpY + 3}
          textAnchor="end"
          fontSize={8}
          fill={labelColor}
        >
          Pump CL
        </text>
        <text x={chamberX + chamberWidth / 2 + 25} y={pumpY + 3} fontSize={8} fill={textColor}>
          EL {formatElevation(elevations.pumpCenterline)} m
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${svgWidth - 120}, ${svgHeight - 80})`}>
        <text x={0} y={0} fontSize={8} fontWeight="bold" fill={textColor}>
          LEGEND:
        </text>
        <rect
          x={0}
          y={8}
          width={12}
          height={12}
          fill={sprayColor}
          fillOpacity={0.3}
          stroke={sprayColor}
        />
        <text x={18} y={18} fontSize={8} fill={labelColor}>
          Spray Zone
        </text>
        <rect
          x={0}
          y={24}
          width={12}
          height={12}
          fill={flashColor}
          fillOpacity={0.3}
          stroke={flashColor}
        />
        <text x={18} y={34} fontSize={8} fill={labelColor}>
          Flashing Zone
        </text>
        <rect
          x={0}
          y={40}
          width={12}
          height={12}
          fill={retentionColor}
          fillOpacity={0.3}
          stroke={retentionColor}
        />
        <text x={18} y={50} fontSize={8} fill={labelColor}>
          Retention Zone
        </text>
        <line x1={0} y1={62} x2={12} y2={62} stroke={theme.palette.success.main} strokeWidth={3} />
        <text x={18} y={66} fontSize={8} fill={labelColor}>
          Level Gauge
        </text>
      </g>

      {/* Notes */}
      <text x={10} y={svgHeight - 10} fontSize={7} fill={labelColor}>
        FFL: Finished Floor Level (reference) | OP-LVL: Operating Level | LG-L/LG-H: Level Gauge
        Tappings | BTL: Bottom Tangent Line
      </text>
    </svg>
  );
}
