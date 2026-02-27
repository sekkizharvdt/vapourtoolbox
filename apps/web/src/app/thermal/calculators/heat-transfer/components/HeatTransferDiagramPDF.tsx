/**
 * Shell-and-Tube Heat Exchanger Diagram — react-pdf version
 */

import { Svg, Rect, Line, Text as PdfText, Path, G } from '@react-pdf/renderer';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';

const HOT = '#d32f2f';
const COLD = '#0288d1';
const SHELL = '#777';
const SUCCESS = '#388e3c';
const LABEL = '#333';
const SUBLABEL = '#666';
const BG = '#f5f5f5';

interface HeatTransferDiagramPDFProps {
  tubeSideResult: TubeSideHTCResult | null;
  condensationResult: CondensationHTCResult | null;
  overallResult: OverallHTCResult | null;
}

function fmt(v: number) {
  return v >= 1000
    ? `${(v / 1000).toFixed(2)} kW/(m\u00b2\u00b7K)`
    : `${v.toFixed(1)} W/(m\u00b2\u00b7K)`;
}

export function HeatTransferDiagramPDF({
  tubeSideResult,
  condensationResult,
  overallResult,
}: HeatTransferDiagramPDFProps) {
  const hiText = tubeSideResult ? fmt(tubeSideResult.htc) : '\u2014';
  const hoText = condensationResult ? fmt(condensationResult.htc) : '\u2014';
  const uoText = overallResult ? fmt(overallResult.overallHTC) : '\u2014';

  const W = 480;
  const H = 230;

  const shellX = 70;
  const shellY = 55;
  const shellW = 340;
  const shellH = 110;
  const sheetW = 12;

  const tubeYs = [84, 98, 114, 128];
  const tubeX1 = shellX + sheetW;
  const tubeX2 = shellX + shellW - sheetW;

  const inletNozzleX = shellX + shellW * 0.3 - 13;
  const outletNozzleX = shellX + shellW * 0.65 - 13;

  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      {/* Inlet nozzle */}
      <Rect
        x={String(inletNozzleX)}
        y={String(shellY - 22)}
        width="26"
        height="22"
        fill={HOT}
        fillOpacity="0.2"
        stroke={HOT}
        strokeWidth="1.2"
      />
      <Line
        x1={String(inletNozzleX + 13)}
        y1={String(shellY - 18)}
        x2={String(inletNozzleX + 13)}
        y2={String(shellY - 1)}
        stroke={HOT}
        strokeWidth="1.5"
      />

      {/* Outlet nozzle */}
      <Rect
        x={String(outletNozzleX)}
        y={String(shellY + shellH)}
        width="26"
        height="22"
        fill={HOT}
        fillOpacity="0.2"
        stroke={HOT}
        strokeWidth="1.2"
      />
      <Line
        x1={String(outletNozzleX + 13)}
        y1={String(shellY + shellH + 1)}
        x2={String(outletNozzleX + 13)}
        y2={String(shellY + shellH + 18)}
        stroke={HOT}
        strokeWidth="1.5"
      />

      {/* Nozzle labels */}
      <PdfText
        x={String(inletNozzleX - 2)}
        y={String(shellY - 26)}
        style={{ fontSize: 7, fill: HOT, fontWeight: 'bold' }}
      >
        Vapor In
      </PdfText>
      <PdfText
        x={String(outletNozzleX - 8)}
        y={String(shellY + shellH + 27)}
        style={{ fontSize: 7, fill: HOT }}
      >
        Condensate Out
      </PdfText>

      {/* Shell body */}
      <Rect
        x={String(shellX)}
        y={String(shellY)}
        width={String(shellW)}
        height={String(shellH)}
        fill="none"
        stroke={SHELL}
        strokeWidth="2"
      />

      {/* Tube sheets */}
      <Rect
        x={String(shellX)}
        y={String(shellY)}
        width={String(sheetW)}
        height={String(shellH)}
        fill={SHELL}
        fillOpacity="0.3"
      />
      <Rect
        x={String(shellX + shellW - sheetW)}
        y={String(shellY)}
        width={String(sheetW)}
        height={String(shellH)}
        fill={SHELL}
        fillOpacity="0.3"
      />

      {/* Tubes */}
      {tubeYs.map((y, i) => (
        <G key={i}>
          <Line
            x1={String(tubeX1)}
            y1={String(y)}
            x2={String(tubeX2)}
            y2={String(y)}
            stroke={SHELL}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Line
            x1={String(tubeX1)}
            y1={String(y)}
            x2={String(tubeX2)}
            y2={String(y)}
            stroke={COLD}
            strokeWidth="2.5"
            strokeOpacity="0.6"
            strokeLinecap="round"
          />
        </G>
      ))}

      {/* Cold side flow arrows */}
      <Line
        x1={String(shellX - 30)}
        y1={String(shellY + shellH / 2)}
        x2={String(shellX - 2)}
        y2={String(shellY + shellH / 2)}
        stroke={COLD}
        strokeWidth="1.5"
      />
      <Path
        d={`M${shellX - 6},${shellY + shellH / 2 - 4} L${shellX},${shellY + shellH / 2} L${shellX - 6},${shellY + shellH / 2 + 4}`}
        stroke={COLD}
        strokeWidth="1.5"
        fill="none"
      />
      <Line
        x1={String(shellX + shellW + 2)}
        y1={String(shellY + shellH / 2)}
        x2={String(shellX + shellW + 32)}
        y2={String(shellY + shellH / 2)}
        stroke={COLD}
        strokeWidth="1.5"
      />
      <Path
        d={`M${shellX + shellW + 26},${shellY + shellH / 2 - 4} L${shellX + shellW + 32},${shellY + shellH / 2} L${shellX + shellW + 26},${shellY + shellH / 2 + 4}`}
        stroke={COLD}
        strokeWidth="1.5"
        fill="none"
      />

      {/* Cold side labels */}
      <PdfText
        x={String(shellX - 62)}
        y={String(shellY + shellH / 2 - 8)}
        style={{ fontSize: 7, fill: COLD, fontWeight: 'bold' }}
      >
        Cooling In
      </PdfText>
      <PdfText
        x={String(shellX + shellW + 34)}
        y={String(shellY + shellH / 2 - 8)}
        style={{ fontSize: 7, fill: COLD, fontWeight: 'bold' }}
      >
        Cooling Out
      </PdfText>

      {/* Shell/tube side sub-labels */}
      <PdfText
        x={String(shellX + sheetW + 6)}
        y={String(shellY + 11)}
        style={{ fontSize: 7, fill: SUBLABEL }}
      >
        Shell Side (Condensation)
      </PdfText>
      <PdfText
        x={String(shellX + sheetW + 6)}
        y={String(shellY + shellH - 4)}
        style={{ fontSize: 7, fill: SUBLABEL }}
      >
        Tube Side (Forced Convection)
      </PdfText>

      {/* Result boxes */}
      {/* h_i */}
      <Rect
        x="4"
        y={String(H - 56)}
        width="130"
        height="52"
        rx="3"
        fill={BG}
        stroke={COLD}
        strokeWidth="1.2"
      />
      <PdfText
        x="69"
        y={String(H - 43)}
        style={{ fontSize: 8, fill: COLD, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        h_i (Tube Side)
      </PdfText>
      <PdfText
        x="69"
        y={String(H - 28)}
        style={{ fontSize: 9, fill: LABEL, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        {hiText}
      </PdfText>
      <PdfText
        x="69"
        y={String(H - 14)}
        style={{ fontSize: 7, fill: SUBLABEL, textAnchor: 'middle' }}
      >
        {tubeSideResult
          ? `Re=${tubeSideResult.reynoldsNumber.toFixed(0)}  Pr=${tubeSideResult.prandtlNumber.toFixed(2)}`
          : 'Re=—  Pr=—'}
      </PdfText>

      {/* h_o */}
      <Rect
        x={String(W / 2 - 65)}
        y={String(H - 56)}
        width="130"
        height="52"
        rx="3"
        fill={BG}
        stroke={HOT}
        strokeWidth="1.2"
      />
      <PdfText
        x={String(W / 2)}
        y={String(H - 43)}
        style={{ fontSize: 8, fill: HOT, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        h_o (Shell Side)
      </PdfText>
      <PdfText
        x={String(W / 2)}
        y={String(H - 28)}
        style={{ fontSize: 9, fill: LABEL, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        {hoText}
      </PdfText>
      <PdfText
        x={String(W / 2)}
        y={String(H - 14)}
        style={{ fontSize: 7, fill: SUBLABEL, textAnchor: 'middle' }}
      >
        Nusselt Film Condensation
      </PdfText>

      {/* U_o */}
      <Rect
        x={String(W - 134)}
        y={String(H - 56)}
        width="130"
        height="52"
        rx="3"
        fill={BG}
        stroke={SUCCESS}
        strokeWidth="1.2"
      />
      <PdfText
        x={String(W - 69)}
        y={String(H - 43)}
        style={{ fontSize: 8, fill: SUCCESS, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        U_o (Overall)
      </PdfText>
      <PdfText
        x={String(W - 69)}
        y={String(H - 28)}
        style={{ fontSize: 9, fill: LABEL, fontWeight: 'bold', textAnchor: 'middle' }}
      >
        {uoText}
      </PdfText>
      <PdfText
        x={String(W - 69)}
        y={String(H - 14)}
        style={{ fontSize: 7, fill: SUBLABEL, textAnchor: 'middle' }}
      >
        Based on outer tube area
      </PdfText>
    </Svg>
  );
}
