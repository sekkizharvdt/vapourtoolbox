/**
 * Demister Sizing Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document } from '@react-pdf/renderer';
import type { DemisterResult, DemisterType } from '@/lib/thermal/demisterCalculator';
import {
  DEMISTER_TYPE_LABELS,
  calculateCarryoverComparison,
} from '@/lib/thermal/demisterCalculator';
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

export interface DemisterReportInputs {
  fluidMode: string;
  satInput: string;
  satPressure: string;
  satTemperature: string;
  manualVaporDensity: string;
  manualLiquidDensity: string;
  vaporMassFlow: string;
  demisterType: DemisterType;
  orientation: string;
  designMargin: string;
  geometry: string;
  rectWidth: string;
  padThickness: string;
  enableCarryover: boolean;
  brineSalinity: string;
  entrainmentMode: string;
  manualEntrainment: string;
  steamProps: { tSat: number; rhoV: number; rhoL: number } | null;
}

interface DemisterReportPDFProps {
  result: DemisterResult;
  inputs: DemisterReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const DemisterReportPDF = ({
  result,
  inputs,
  documentNumber = 'DEM-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: DemisterReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    isNaN(value) ? '—' : value.toFixed(decimals);

  const orientationLabel = inputs.orientation === 'horizontal' ? 'Horizontal' : 'Vertical — upflow';
  const geometryLabel =
    inputs.geometry === 'circular' ? 'Circular' : `Rectangular (W = ${inputs.rectWidth} m)`;

  // Build primary banner items
  const bannerItems = [
    { label: 'Required Area', value: `${fmt(result.requiredArea)} m²` },
    ...(result.vesselDiameter !== undefined
      ? [{ label: 'Min. Diameter', value: `${fmt(result.vesselDiameter)} m` }]
      : []),
    { label: 'Pressure Drop', value: `${fmt(result.pressureDrop, 1)} Pa` },
    { label: 'Loading', value: `${(result.loadingFraction * 100).toFixed(0)}% of V_max` },
  ];

  // Fluid property rows
  const fluidRows =
    inputs.fluidMode === 'saturation' && inputs.steamProps
      ? [
          {
            label: 'Condition',
            value:
              inputs.satInput === 'pressure'
                ? `${inputs.satPressure} bar abs (saturation)`
                : `${inputs.satTemperature} °C (saturation)`,
          },
          { label: 'T_sat', value: `${fmt(inputs.steamProps.tSat, 2)} °C` },
          { label: 'Vapor Density (ρ_V)', value: `${fmt(inputs.steamProps.rhoV, 4)} kg/m³` },
          { label: 'Liquid Density (ρ_L)', value: `${fmt(inputs.steamProps.rhoL, 2)} kg/m³` },
        ]
      : [
          { label: 'Condition', value: 'Manual entry' },
          { label: 'Vapor Density (ρ_V)', value: `${inputs.manualVaporDensity} kg/m³` },
          { label: 'Liquid Density (ρ_L)', value: `${inputs.manualLiquidDensity} kg/m³` },
        ];

  // Sizing results table
  const sizingRows = [
    { param: 'K Factor', value: fmt(result.kFactor), unit: 'm/s' },
    { param: 'Max. Velocity (V_max)', value: fmt(result.maxVelocity), unit: 'm/s' },
    { param: 'Design Velocity', value: fmt(result.designVelocity), unit: 'm/s' },
    {
      param: 'Vapor Volumetric Flow',
      value: fmt(result.vaporVolumetricFlow, 4),
      unit: 'm³/s',
    },
    { param: 'Required Demister Area', value: fmt(result.requiredArea), unit: 'm²' },
    ...(result.vesselDiameter !== undefined
      ? [
          {
            param: 'Min. Vessel Diameter',
            value: `${fmt(result.vesselDiameter)} (${(result.vesselDiameter * 1000).toFixed(0)} mm)`,
            unit: 'm',
          },
        ]
      : []),
    ...(result.rectangleHeight !== undefined
      ? [{ param: 'Required Height', value: fmt(result.rectangleHeight), unit: 'm' }]
      : []),
    { param: 'Pad Thickness', value: String(result.padThickness), unit: 'mm' },
    {
      param: 'Pressure Drop (calculated)',
      value: fmt(result.pressureDrop, 1),
      unit: 'Pa',
    },
    {
      param: 'Pressure Drop (ref. range)',
      value: `${result.pressureDropRange.min}–${result.pressureDropRange.max}`,
      unit: 'Pa',
    },
    {
      param: 'Loading at Design Point',
      value: `${(result.loadingFraction * 100).toFixed(0)}%`,
      unit: `of V_max (${result.loadingStatus})`,
    },
  ];

  // Collect all warnings
  const allWarnings: string[] = [];
  if (result.loadingStatus === 'high')
    allWarnings.push('Loading exceeds 90% of V_max — risk of flooding and re-entrainment.');
  if (result.loadingStatus === 'low')
    allWarnings.push('Loading below 40% of V_max — demister may be oversized.');
  if (result.carryover) allWarnings.push(...result.carryover.warnings);

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Demister / Mist Eliminator Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner items={bannerItems} />

        {/* Input Parameters + Fluid Properties */}
        <TwoColumnLayout
          left={
            <ReportSection title="Input Parameters">
              <KeyValueTable
                rows={[
                  { label: 'Demister Type', value: DEMISTER_TYPE_LABELS[inputs.demisterType] },
                  { label: 'Orientation', value: orientationLabel },
                  { label: 'Vapor Mass Flow', value: `${inputs.vaporMassFlow} kg/s` },
                  { label: 'Design Margin', value: `${inputs.designMargin}%` },
                  { label: 'Pad Thickness', value: `${inputs.padThickness} mm` },
                  { label: 'Vessel Geometry', value: geometryLabel },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Fluid Properties">
              <KeyValueTable rows={fluidRows} />
            </ReportSection>
          }
        />

        {/* Sizing Results */}
        <ReportSection title="Sizing Results">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={sizingRows}
          />
        </ReportSection>

        {/* Carryover Analysis */}
        {result.carryover && (
          <>
            <ReportSection title="Brine Carryover Analysis">
              <ReportTable
                columns={[
                  { key: 'param', header: 'Parameter', width: '50%' },
                  { key: 'value', header: 'Value', width: '30%', align: 'right' },
                  { key: 'unit', header: 'Unit', width: '20%' },
                ]}
                rows={[
                  {
                    param: 'Brine Salinity (TDS)',
                    value: parseFloat(inputs.brineSalinity || '0').toLocaleString(),
                    unit: 'ppm',
                  },
                  {
                    param: `Primary Entrainment (${result.carryover.primaryEntrainmentSource})`,
                    value: (result.carryover.primaryEntrainment * 100).toFixed(3),
                    unit: '% of vapor',
                  },
                  {
                    param: 'Demister Separation Efficiency',
                    value: (result.carryover.demisterEfficiency * 100).toFixed(2),
                    unit: '%',
                  },
                  {
                    param: 'Net Carryover (after demister)',
                    value: result.carryover.carryoverPPM.toFixed(1),
                    unit: 'ppm of vapor',
                  },
                  {
                    param: 'Carryover Mass Flow',
                    value: result.carryover.carryoverMassFlow.toExponential(3),
                    unit: 'kg/s',
                  },
                  {
                    param: 'Predicted Distillate TDS',
                    value: result.carryover.distillateTDS.toFixed(2),
                    unit: 'ppm',
                  },
                  {
                    param: 'Quality Assessment',
                    value: result.carryover.qualityAssessment.toUpperCase(),
                    unit: '',
                  },
                ]}
              />
            </ReportSection>

            {/* Comparison across all demister types */}
            <ReportSection title="Distillate TDS Comparison — All Demister Types">
              <ReportTable
                columns={[
                  { key: 'scenario', header: 'Scenario', width: '35%' },
                  { key: 'efficiency', header: 'Efficiency', width: '15%', align: 'right' },
                  { key: 'minDroplet', header: 'Min. Droplet', width: '13%', align: 'right' },
                  { key: 'tds', header: 'Distillate TDS', width: '17%', align: 'right' },
                  { key: 'quality', header: 'Quality', width: '20%', align: 'center' },
                ]}
                rows={calculateCarryoverComparison(
                  result.carryover.primaryEntrainment,
                  parseFloat(inputs.brineSalinity || '0'),
                  result.loadingFraction
                ).map((row) => ({
                  scenario:
                    row.type === inputs.demisterType ? `${row.label} (SELECTED)` : row.label,
                  efficiency: row.type === null ? '—' : `${(row.efficiency * 100).toFixed(2)}%`,
                  minDroplet: row.minDroplet_um !== null ? `${row.minDroplet_um} µm` : '—',
                  tds: `${row.distillateTDS < 0.01 ? '< 0.01' : row.distillateTDS.toFixed(2)} ppm`,
                  quality: row.qualityAssessment.toUpperCase(),
                }))}
              />
            </ReportSection>
          </>
        )}

        <WarningsBox warnings={allWarnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Demister / Mist Eliminator Sizing Calculator',
            'Correlation: Souders-Brown (GPSA / Koch-Otto York) | Carryover: Sterman-type model',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
