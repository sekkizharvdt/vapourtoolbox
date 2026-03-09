/**
 * Pipe Sizing Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import type { PipeVariant } from '@/lib/thermal/pipeService';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

export interface PipeSizingReportInputs {
  mode: 'size_by_flow' | 'check_velocity';
  flowRate: string;
  flowUnit: string;
  fluidType: string;
  temperature: string;
  salinity?: string;
  density: number;
  targetVelocity: string;
  minVelocity: string;
  maxVelocity: string;
  selectedNPS?: string;
}

export interface PipeSizingReportResult {
  pipe: PipeVariant;
  velocity: number;
  velocityStatus: 'OK' | 'HIGH' | 'LOW';
  requiredArea?: number;
  alternatives?: Array<PipeVariant & { velocity: number; status: 'OK' | 'HIGH' | 'LOW' }>;
}

interface PipeSizingReportPDFProps {
  result: PipeSizingReportResult;
  inputs: PipeSizingReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number, d = 2) => (isNaN(v) ? '—' : v.toFixed(d));

const FLOW_UNIT_LABELS: Record<string, string> = {
  tonhr: 'ton/hr',
  kgs: 'kg/s',
  m3hr: 'm\u00B3/hr',
};

const FLUID_LABELS: Record<string, string> = {
  water: 'Pure Water',
  seawater: 'Seawater',
  steam: 'Steam',
  custom: 'Custom Fluid',
};

export const PipeSizingReportPDF = ({
  result,
  inputs,
  documentNumber = 'PIPE-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: PipeSizingReportPDFProps) => {
  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Pipe Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Selected Pipe', value: `NPS ${result.pipe.nps} (DN ${result.pipe.dn})` },
            { label: 'Velocity', value: `${fmt(result.velocity, 2)} m/s` },
            { label: 'Status', value: result.velocityStatus },
          ]}
        />

        <TwoColumnLayout
          left={
            <ReportSection title="Input Parameters">
              <KeyValueTable
                rows={[
                  {
                    label: 'Mode',
                    value: inputs.mode === 'size_by_flow' ? 'Size by Flow' : 'Check Velocity',
                  },
                  {
                    label: 'Flow Rate',
                    value: `${inputs.flowRate} ${FLOW_UNIT_LABELS[inputs.flowUnit] ?? inputs.flowUnit}`,
                  },
                  {
                    label: 'Fluid Type',
                    value: FLUID_LABELS[inputs.fluidType] ?? inputs.fluidType,
                  },
                  { label: 'Temperature', value: `${inputs.temperature} \u00B0C` },
                  ...(inputs.fluidType === 'seawater'
                    ? [{ label: 'Salinity', value: `${inputs.salinity ?? '35000'} mg/L` }]
                    : []),
                  { label: 'Fluid Density', value: `${fmt(inputs.density, 1)} kg/m\u00B3` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Velocity Limits">
              <KeyValueTable
                rows={[
                  { label: 'Target', value: `${inputs.targetVelocity} m/s` },
                  { label: 'Minimum', value: `${inputs.minVelocity} m/s` },
                  { label: 'Maximum', value: `${inputs.maxVelocity} m/s` },
                ]}
              />
            </ReportSection>
          }
        />

        <ReportSection title="Selected Pipe">
          <KeyValueTable
            rows={[
              { label: 'NPS', value: result.pipe.nps },
              { label: 'DN', value: `${result.pipe.dn}` },
              { label: 'ID', value: `${fmt(result.pipe.id_mm, 1)} mm` },
              { label: 'Flow Area', value: `${fmt(result.pipe.area_mm2, 0)} mm\u00B2` },
              { label: 'Actual Velocity', value: `${fmt(result.velocity, 2)} m/s` },
              { label: 'Velocity Status', value: result.velocityStatus },
              ...(result.requiredArea != null
                ? [
                    {
                      label: 'Required Area',
                      value: `${fmt(result.requiredArea * 1e6, 0)} mm\u00B2`,
                    },
                  ]
                : []),
            ]}
          />
        </ReportSection>

        {result.alternatives && result.alternatives.length > 0 && (
          <ReportSection title="Alternative Pipe Sizes">
            <ReportTable
              columns={[
                { key: 'nps', header: 'NPS', width: '15%' },
                { key: 'dn', header: 'DN', width: '15%' },
                { key: 'id', header: 'ID (mm)', width: '20%', align: 'right' },
                { key: 'velocity', header: 'Velocity (m/s)', width: '25%', align: 'right' },
                { key: 'status', header: 'Status', width: '25%' },
              ]}
              rows={result.alternatives.map((alt) => ({
                nps: alt.nps,
                dn: `${alt.dn}`,
                id: fmt(alt.id_mm, 1),
                velocity: fmt(alt.velocity, 2),
                status: alt.status,
              }))}
            />
          </ReportSection>
        )}

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Pipe Sizing Calculator',
            'Pipe data: ASME B36.10M Schedule 40 | Velocity: v = Q / A',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
