/**
 * Heat Exchanger Sizing Report — PDF Document
 *
 * Multi-section report covering heat duty, HTC, tube geometry, and sizing results.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document } from '@react-pdf/renderer';
import type { HeatExchangerResult, TubeLayout } from '@/lib/thermal/heatExchangerSizing';
import { TUBE_MATERIALS, TUBE_LAYOUT_LABELS } from '@/lib/thermal/heatExchangerSizing';
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

export interface HeatExchangerReportInputs {
  heatDutyKW: number;
  lmtd: number;
  overallHTC: number;
}

export interface VelocityCheckData {
  velocity: number;
  reynoldsNumber: number;
  pressureDrop: number;
}

interface HeatExchangerReportPDFProps {
  result: HeatExchangerResult;
  inputs: HeatExchangerReportInputs;
  velocityCheck?: VelocityCheckData | null;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number | undefined, d = 2) => (v === undefined || isNaN(v) ? '—' : v.toFixed(d));

const layoutLabel = (layout: TubeLayout) => TUBE_LAYOUT_LABELS[layout] ?? layout;

export const HeatExchangerReportPDF = ({
  result,
  inputs,
  velocityCheck,
  documentNumber = 'HX-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: HeatExchangerReportPDFProps) => {
  const materialLabel = TUBE_MATERIALS[result.tubeMaterial]?.label ?? result.tubeMaterial;

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Heat Exchanger Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Design Area', value: `${fmt(result.designArea, 1)} m\u00B2` },
            { label: 'Tubes', value: `${result.actualTubeCount}` },
            { label: 'Shell ID', value: `${result.shellID} mm` },
          ]}
        />

        {/* ── Design Basis ── */}
        <TwoColumnLayout
          left={
            <ReportSection title="Design Basis">
              <KeyValueTable
                rows={[
                  { label: 'Heat Duty', value: `${fmt(inputs.heatDutyKW, 1)} kW` },
                  { label: 'LMTD', value: `${fmt(inputs.lmtd, 1)} \u00B0C` },
                  {
                    label: 'Overall HTC (U)',
                    value: `${fmt(inputs.overallHTC, 0)} W/m\u00B2\u00B7K`,
                  },
                  { label: 'Fouling Margin', value: `${(result.foulingMargin * 100).toFixed(0)}%` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Heat Transfer Area">
              <KeyValueTable
                rows={[
                  { label: 'Required (Clean)', value: `${fmt(result.requiredArea, 1)} m\u00B2` },
                  { label: 'Design (Fouled)', value: `${fmt(result.designArea, 1)} m\u00B2` },
                  { label: 'Actual (Installed)', value: `${fmt(result.actualArea, 1)} m\u00B2` },
                  { label: 'Excess Area', value: `${fmt(result.excessArea, 1)}%` },
                ]}
              />
            </ReportSection>
          }
        />

        {/* ── Tube Geometry ── */}
        <ReportSection title="Tube Geometry">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              { param: 'Tube OD', value: fmt(result.tubeSpec.od_mm, 2), unit: 'mm' },
              { param: 'Tube ID', value: fmt(result.tubeSpec.id_mm, 2), unit: 'mm' },
              { param: 'Wall Thickness', value: fmt(result.tubeSpec.wall_mm, 2), unit: 'mm' },
              { param: 'BWG', value: `${result.tubeSpec.bwg}`, unit: '' },
              { param: 'Material', value: materialLabel, unit: '' },
              {
                param: 'Conductivity',
                value: fmt(result.tubeMaterialConductivity, 0),
                unit: 'W/m\u00B7K',
              },
              { param: 'Tube Layout', value: layoutLabel(result.tubeLayout), unit: '' },
              { param: 'Tube Pitch', value: fmt(result.tubePitch, 1), unit: 'mm' },
              { param: 'Tube Passes', value: `${result.tubePasses}`, unit: '' },
              { param: 'Tube Length', value: fmt(result.tubeLength, 1), unit: 'm' },
            ]}
          />
        </ReportSection>

        {/* ── Sizing Results ── */}
        <TwoColumnLayout
          left={
            <ReportSection title="Tube Bundle">
              <KeyValueTable
                rows={[
                  { label: 'Required Tube Count', value: fmt(result.requiredTubeCount, 1) },
                  { label: 'Actual Tube Count', value: `${result.actualTubeCount}` },
                  { label: 'Bundle Diameter', value: `${fmt(result.bundleDiameter, 0)} mm` },
                  {
                    label: 'Tubes per Pass',
                    value: `${result.actualTubeCount / result.tubePasses}`,
                  },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Shell">
              <KeyValueTable
                rows={[
                  { label: 'Min Shell ID', value: `${fmt(result.minShellID, 0)} mm` },
                  { label: 'Selected Shell ID', value: `${result.shellID} mm` },
                  { label: 'Bundle Clearance', value: `${fmt(result.bundleClearance, 1)} mm` },
                ]}
              />
            </ReportSection>
          }
        />

        {/* ── Flow Areas & Velocity ── */}
        <ReportSection title="Flow Areas">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              {
                param: 'Tube-side Flow Area (per pass)',
                value: (result.tubeSideFlowArea * 1e4).toFixed(2),
                unit: 'cm\u00B2',
              },
              {
                param: 'Shell-side Cross-flow Area',
                value: (result.shellSideFlowArea * 1e4).toFixed(2),
                unit: 'cm\u00B2',
              },
              ...(velocityCheck
                ? [
                    {
                      param: 'Tube-side Velocity',
                      value: fmt(velocityCheck.velocity, 2),
                      unit: 'm/s',
                    },
                    {
                      param: 'Reynolds Number',
                      value: velocityCheck.reynoldsNumber.toLocaleString(),
                      unit: '',
                    },
                    {
                      param: 'Est. Pressure Drop',
                      value: fmt(velocityCheck.pressureDrop / 1000, 2),
                      unit: 'kPa',
                    },
                  ]
                : []),
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Heat Exchanger Sizing Calculator',
            'Area: A = Q / (U \u00D7 LMTD) | Bundle: TEMA tube count correlation | Shell: next standard TEMA size',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
