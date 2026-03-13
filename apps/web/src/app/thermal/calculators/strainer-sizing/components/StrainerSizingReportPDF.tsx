/**
 * Strainer Sizing Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import {
  STRAINER_TYPE_LABELS,
  FLUID_TYPE_LABELS,
  type StrainerSizingResult,
  type FluidType,
} from '@/lib/thermal/strainerSizingCalculator';
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

export interface StrainerSizingReportInputs {
  fluidType: string;
  flowRate: string;
  lineSize: string;
  strainerType: string;
  fluidDensity: string;
  fluidViscosity: string;
  fluidTemperature: string;
}

interface StrainerSizingReportPDFProps {
  result: StrainerSizingResult;
  inputs: StrainerSizingReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number, d = 2) => (isNaN(v) ? '\u2014' : v.toFixed(d));

export const StrainerSizingReportPDF = ({
  result,
  inputs,
  documentNumber = 'STR-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: StrainerSizingReportPDFProps) => {
  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType as FluidType] || inputs.fluidType;
  const strainerLabel =
    STRAINER_TYPE_LABELS[inputs.strainerType as 'y_type' | 'bucket_type'] || inputs.strainerType;

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Strainer Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            {
              label: 'Mesh Size',
              value: `${fmt(result.meshSizeMm, 1)} mm (#${result.meshNumber})`,
            },
            { label: '\u0394P Clean', value: `${fmt(result.totalPressureDropClean, 4)} bar` },
            {
              label: '\u0394P 50% Clogged',
              value: `${fmt(result.totalPressureDropClogged, 4)} bar`,
            },
          ]}
        />

        {/* Input Parameters */}
        <TwoColumnLayout
          left={
            <ReportSection title="Fluid Properties">
              <KeyValueTable
                rows={[
                  { label: 'Fluid Type', value: fluidLabel },
                  { label: 'Density', value: `${inputs.fluidDensity} kg/m\u00B3` },
                  { label: 'Viscosity', value: `${inputs.fluidViscosity} cP` },
                  { label: 'Temperature', value: `${inputs.fluidTemperature} \u00B0C` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Line & Strainer">
              <KeyValueTable
                rows={[
                  { label: 'Flow Rate', value: `${inputs.flowRate} m\u00B3/hr` },
                  { label: 'Line Size', value: `NPS ${inputs.lineSize}"` },
                  { label: 'Strainer Type', value: strainerLabel },
                  {
                    label: 'Mesh Size',
                    value: `${fmt(result.meshSizeMm, 1)} mm (#${result.meshNumber})`,
                  },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Pressure Drop Results */}
        <ReportSection title="Pressure Drop Results">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '40%' },
              { key: 'clean', header: 'Clean', width: '30%', align: 'right' },
              { key: 'clogged', header: '50% Clogged', width: '30%', align: 'right' },
            ]}
            rows={[
              {
                param: 'Body \u0394P (bar)',
                clean: fmt(result.bodyPressureDrop, 4),
                clogged: fmt(result.bodyPressureDrop, 4),
              },
              {
                param: 'Screen \u0394P (bar)',
                clean: fmt(result.screenPressureDropClean, 4),
                clogged: fmt(result.screenPressureDropClogged, 4),
              },
              {
                param: 'TOTAL \u0394P (bar)',
                clean: fmt(result.totalPressureDropClean, 4),
                clogged: fmt(result.totalPressureDropClogged, 4),
              },
              {
                param: 'Screen Velocity (m/s)',
                clean: fmt(result.screenVelocityClean, 2),
                clogged: fmt(result.screenVelocityClogged, 2),
              },
            ]}
          />
        </ReportSection>

        {/* Geometry */}
        <ReportSection title="Strainer Geometry">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              { param: 'Pipe ID', value: fmt(result.pipeIdMm, 1), unit: 'mm' },
              { param: 'Pipe Area', value: fmt(result.pipeAreaMm2, 1), unit: 'mm\u00B2' },
              { param: 'Screen Area', value: fmt(result.screenAreaMm2, 1), unit: 'mm\u00B2' },
              {
                param: 'Effective Open Area (Clean)',
                value: fmt(result.effectiveOpenAreaClean, 1),
                unit: 'mm\u00B2',
              },
              { param: 'Pipe Velocity', value: fmt(result.pipeVelocity, 2), unit: 'm/s' },
              { param: 'Body K Factor', value: fmt(result.bodyKFactor, 1), unit: '\u2014' },
              {
                param: 'Reynolds Number',
                value: result.reynoldsNumber.toLocaleString(),
                unit: '\u2014',
              },
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Strainer Sizing Calculator',
            '\u0394P = K \u00D7 \u03C1 \u00D7 v\u00B2 / 2 | 50% clog: open area halved, screen velocity doubled',
            'Reference: Crane TP-410, Flow of Fluids through Valves, Fittings, and Pipe',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
