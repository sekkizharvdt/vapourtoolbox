/**
 * Falling Film Evaporator Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document, View, Svg, Circle, Line, Text as SvgText } from '@react-pdf/renderer';
import { StyleSheet } from '@react-pdf/renderer';
import type { FallingFilmResult } from '@/lib/thermal/fallingFilmCalculator';
import { TUBE_MATERIALS } from '@/lib/thermal/fallingFilmCalculator';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  WarningsBox,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

export interface FallingFilmReportInputs {
  feedFlowRate: string;
  feedSalinity: string;
  feedTemperature: string;
  steamTemperature: string;
  tubeOD: string;
  tubeID: string;
  tubeLength: string;
  numberOfTubes: string;
  tubeMaterial: string;
  tubeLayout: 'triangular' | 'square';
  pitchRatio: string;
  tubeRows: string;
  foulingResistance: string;
  designMargin: string;
}

interface FallingFilmReportPDFProps {
  result: FallingFilmResult;
  inputs: FallingFilmReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const localStyles = StyleSheet.create({
  tubeLayoutContainer: {
    marginTop: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
});

/**
 * Build a small tube layout diagram using @react-pdf SVG primitives.
 * Shows up to 6 cols x 4 rows with pitch lines.
 */
function TubeLayoutDiagram({
  tubeLayout,
  tubesPerRow,
  tubeRows,
  pitch,
  rowSpacing,
  tubeOD,
}: {
  tubeLayout: 'triangular' | 'square';
  tubesPerRow: number;
  tubeRows: number;
  pitch: number;
  rowSpacing: number;
  tubeOD: number;
}) {
  const maxCols = Math.min(tubesPerRow, 6);
  const maxRows = Math.min(tubeRows, 4);
  const r = tubeOD / 2;

  // Scale everything so the diagram is roughly 200pt wide
  const rawWidth = (maxCols - 1) * pitch + tubeOD;
  const scale = rawWidth > 0 ? 180 / rawWidth : 1;

  const margin = 25;
  const svgW = rawWidth * scale + margin * 2;
  const svgH = ((maxRows - 1) * rowSpacing + tubeOD) * scale + margin * 2;

  const tubes: { cx: number; cy: number }[] = [];
  for (let row = 0; row < maxRows; row++) {
    const offset = tubeLayout === 'triangular' && row % 2 === 1 ? (pitch / 2) * scale : 0;
    for (let col = 0; col < maxCols; col++) {
      tubes.push({
        cx: margin + r * scale + col * pitch * scale + offset,
        cy: margin + r * scale + row * rowSpacing * scale,
      });
    }
  }

  const tubeR = r * scale * 0.85;

  return (
    <View style={localStyles.tubeLayoutContainer}>
      <Svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: svgW, height: svgH }}>
        {/* Tubes */}
        {tubes.map((t, i) => (
          <Circle key={i} cx={t.cx} cy={t.cy} r={tubeR} fill="#bbdefb" stroke="#1565c0" />
        ))}

        {/* Pitch dimension line across top row */}
        {maxCols >= 2 && (
          <>
            <Line
              x1={margin + r * scale}
              y1={margin - 8}
              x2={margin + r * scale + pitch * scale}
              y2={margin - 8}
              stroke="#666666"
              strokeWidth={0.6}
            />
            <SvgText
              x={margin + r * scale + (pitch * scale) / 2}
              y={margin - 11}
              style={{ fontSize: 6, fill: '#666666', textAnchor: 'middle' } as never}
            >
              {`P = ${pitch.toFixed(1)} mm`}
            </SvgText>
          </>
        )}

        {/* Row spacing dimension */}
        {maxRows >= 2 && (
          <>
            <Line
              x1={margin - 10}
              y1={margin + r * scale}
              x2={margin - 10}
              y2={margin + r * scale + rowSpacing * scale}
              stroke="#666666"
              strokeWidth={0.6}
            />
            <SvgText
              x={margin - 14}
              y={margin + r * scale + (rowSpacing * scale) / 2 + 2}
              style={{ fontSize: 5, fill: '#666666', textAnchor: 'middle' } as never}
            >
              {`${rowSpacing.toFixed(1)}`}
            </SvgText>
          </>
        )}

        {/* Label */}
        <SvgText
          x={svgW / 2}
          y={svgH - 4}
          style={{ fontSize: 7, fill: '#333333', textAnchor: 'middle', fontWeight: 700 } as never}
        >
          {tubeLayout === 'triangular' ? 'Triangular Pitch' : 'Square Pitch'}
        </SvgText>
      </Svg>
    </View>
  );
}

export const FallingFilmReportPDF = ({
  result,
  inputs,
  documentNumber = 'FFE-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: FallingFilmReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    isNaN(value) ? '\u2014' : value.toFixed(decimals);

  const materialLabel = TUBE_MATERIALS[inputs.tubeMaterial]?.label ?? inputs.tubeMaterial;
  const layoutLabel =
    inputs.tubeLayout === 'triangular' ? 'Triangular (60\u00B0)' : 'Square (90\u00B0)';

  // Primary banner items
  const bannerItems = [
    { label: 'Overall HTC', value: `${fmt(result.overallHTC, 1)} W/(m\u00B2\u00B7K)` },
    { label: 'Wetting Ratio', value: `${fmt(result.wettingRatio, 2)} (${result.wettingStatus})` },
    { label: 'Heat Duty', value: `${fmt(result.heatDuty, 1)} kW` },
    { label: 'Evaporation Rate', value: `${fmt(result.evaporationRate, 4)} kg/s` },
  ];

  // Heat transfer coefficient table rows
  const htcRows = [
    {
      param: 'Film HTC (outside)',
      value: fmt(result.filmHTC, 1),
      unit: 'W/(m\u00B2\u00B7K)',
    },
    {
      param: 'Condensation HTC (inside)',
      value: fmt(result.condensationHTC, 1),
      unit: 'W/(m\u00B2\u00B7K)',
    },
    {
      param: 'Wall Resistance',
      value: result.wallResistance.toExponential(3),
      unit: 'm\u00B2\u00B7K/W',
    },
    {
      param: 'Fouling Resistance',
      value: result.foulingResistance.toExponential(3),
      unit: 'm\u00B2\u00B7K/W',
    },
    {
      param: 'Overall HTC (U_o)',
      value: fmt(result.overallHTC, 1),
      unit: 'W/(m\u00B2\u00B7K)',
    },
  ];

  // Thermal performance rows
  const thermalRows = [
    { param: 'Boiling Point Elevation', value: fmt(result.boilingPointElevation), unit: '\u00B0C' },
    {
      param: 'Effective \u0394T',
      value: fmt(result.effectiveTemperatureDiff, 2),
      unit: '\u00B0C',
    },
    { param: 'Heat Duty', value: fmt(result.heatDuty, 1), unit: 'kW' },
    {
      param: 'Evaporation Rate',
      value: `${fmt(result.evaporationRate, 4)} (${(result.evaporationRate * 3600).toFixed(1)} kg/h)`,
      unit: 'kg/s',
    },
    {
      param: 'Specific Evaporation Rate',
      value: fmt(result.specificEvaporationRate, 2),
      unit: 'kg/(m\u00B2\u00B7h)',
    },
  ];

  // Design check rows
  const designRows = [
    { param: 'Installed HT Area', value: fmt(result.heatTransferArea, 2), unit: 'm\u00B2' },
    {
      param: `Design Area (${inputs.designMargin}% margin)`,
      value: fmt(result.designArea, 2),
      unit: 'm\u00B2',
    },
    {
      param: 'Excess Area',
      value: `${result.excessArea >= 0 ? '+' : ''}${fmt(result.excessArea, 1)}%`,
      unit: result.excessArea < 0 ? 'UNDERSIZED' : '',
    },
  ];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Falling Film Evaporator Design Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner items={bannerItems} />

        {/* Input Parameters */}
        <TwoColumnLayout
          left={
            <ReportSection title="Operating Conditions">
              <KeyValueTable
                rows={[
                  { label: 'Feed Flow Rate', value: `${inputs.feedFlowRate} kg/s` },
                  {
                    label: 'Feed Salinity',
                    value: `${parseFloat(inputs.feedSalinity || '0').toLocaleString()} ppm`,
                  },
                  { label: 'Feed Temperature', value: `${inputs.feedTemperature} \u00B0C` },
                  { label: 'Steam Temperature', value: `${inputs.steamTemperature} \u00B0C` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Tube Geometry">
              <KeyValueTable
                rows={[
                  {
                    label: 'Tube Size',
                    value: `OD ${inputs.tubeOD} mm / ID ${inputs.tubeID} mm`,
                  },
                  { label: 'Tube Length', value: `${inputs.tubeLength} m` },
                  { label: 'Number of Tubes', value: inputs.numberOfTubes },
                  { label: 'Tube Material', value: materialLabel },
                  { label: 'Layout', value: `${layoutLabel}, P/D = ${inputs.pitchRatio}` },
                  { label: 'Tube Rows', value: inputs.tubeRows },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Wetting Analysis */}
        <ReportSection title="Wetting Analysis">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              {
                param: 'Actual Wetting Rate (\u0393)',
                value: fmt(result.wettingRate, 5),
                unit: 'kg/(m\u00B7s)',
              },
              {
                param: 'Minimum Wetting Rate (\u0393_min)',
                value: fmt(result.minimumWettingRate, 5),
                unit: 'kg/(m\u00B7s)',
              },
              {
                param: 'Wetting Ratio',
                value: `${fmt(result.wettingRatio, 2)} (${result.wettingStatus.toUpperCase()})`,
                unit: '\u2014',
              },
              {
                param: 'Film Reynolds Number',
                value: fmt(result.filmReynolds, 1),
                unit: '\u2014',
              },
              {
                param: 'Flow Regime',
                value: result.flowRegime,
                unit: '\u2014',
              },
            ]}
          />
        </ReportSection>

        {/* Heat Transfer Coefficients */}
        <ReportSection title="Heat Transfer Coefficients">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={htcRows}
          />
        </ReportSection>

        {/* Thermal Performance */}
        <ReportSection title="Thermal Performance">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={thermalRows}
          />
        </ReportSection>

        {/* Tube Bundle Layout */}
        <ReportSection title="Tube Bundle Layout">
          <TubeLayoutDiagram
            tubeLayout={inputs.tubeLayout}
            tubesPerRow={result.tubesPerRow}
            tubeRows={parseInt(inputs.tubeRows, 10)}
            pitch={result.pitch}
            rowSpacing={result.rowSpacing}
            tubeOD={parseFloat(inputs.tubeOD)}
          />
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              { param: 'Tubes per Row', value: String(result.tubesPerRow), unit: '\u2014' },
              { param: 'Tube Pitch', value: fmt(result.pitch, 1), unit: 'mm' },
              { param: 'Row Spacing', value: fmt(result.rowSpacing, 1), unit: 'mm' },
              { param: 'Bundle Width', value: fmt(result.bundleWidth, 1), unit: 'mm' },
              { param: 'Bundle Height', value: fmt(result.bundleHeight, 1), unit: 'mm' },
            ]}
          />
        </ReportSection>

        {/* Design Check */}
        <ReportSection title="Design Check">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={designRows}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Falling Film Evaporator Design Calculator',
            'Film HTC: Chun-Seban (1971) | Condensation: Nusselt (1916) | Seawater: Sharqawy et al. (2010)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
