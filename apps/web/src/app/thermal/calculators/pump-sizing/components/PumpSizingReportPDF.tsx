/**
 * Pump Sizing Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import type { PumpSizingResult } from '@/lib/thermal/pumpSizing';
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

export interface PumpSizingReportInputs {
  flowRate: string;
  fluidDensity: string;
  suctionVesselPressure: string;
  dischargeVesselPressure: string;
  staticHead: string;
  suctionPressureDrop: string;
  dischargePressureDrop: string;
  pumpEfficiency: string;
  motorEfficiency: string;
}

interface PumpSizingReportPDFProps {
  result: PumpSizingResult;
  inputs: PumpSizingReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number, d = 2) => (isNaN(v) ? '—' : v.toFixed(d));

export const PumpSizingReportPDF = ({
  result,
  inputs,
  documentNumber = 'PUMP-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: PumpSizingReportPDFProps) => {
  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Pump Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'TDH', value: `${fmt(result.totalDifferentialHead, 1)} m` },
            { label: 'Brake Power', value: `${fmt(result.brakePower, 2)} kW` },
            { label: 'Motor Size', value: `${fmt(result.recommendedMotorKW, 1)} kW` },
          ]}
        />

        {/* ── Input Parameters ── */}
        <TwoColumnLayout
          left={
            <ReportSection title="Process Conditions">
              <KeyValueTable
                rows={[
                  { label: 'Flow Rate', value: `${inputs.flowRate} m\u00B3/hr` },
                  { label: 'Fluid Density', value: `${inputs.fluidDensity} kg/m\u00B3` },
                  {
                    label: 'Suction Vessel Pressure',
                    value: `${inputs.suctionVesselPressure} bar abs`,
                  },
                  {
                    label: 'Discharge Vessel Pressure',
                    value: `${inputs.dischargeVesselPressure} bar abs`,
                  },
                  { label: 'Static Head', value: `${inputs.staticHead} m` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Friction & Efficiency">
              <KeyValueTable
                rows={[
                  { label: 'Suction Pressure Drop', value: `${inputs.suctionPressureDrop} bar` },
                  {
                    label: 'Discharge Pressure Drop',
                    value: `${inputs.dischargePressureDrop} bar`,
                  },
                  { label: 'Pump Efficiency', value: `${inputs.pumpEfficiency}%` },
                  { label: 'Motor Efficiency', value: `${inputs.motorEfficiency}%` },
                ]}
              />
            </ReportSection>
          }
        />

        {/* ── Head Breakdown ── */}
        <ReportSection title="Head Breakdown">
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '60%' },
              { key: 'head', header: 'Head (m)', width: '20%', align: 'right' },
              { key: 'bar', header: 'bar', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                component: 'Discharge Pressure Head',
                head: fmt(result.headBreakdown.dischargePressureHead, 2),
                bar: inputs.dischargeVesselPressure,
              },
              {
                component: 'Suction Pressure Head (credit)',
                head: `\u2212${fmt(result.headBreakdown.suctionPressureHead, 2)}`,
                bar: `\u2212${inputs.suctionVesselPressure}`,
              },
              {
                component: 'Static Head',
                head: fmt(result.headBreakdown.staticHead, 2),
                bar: '—',
              },
              {
                component: 'Discharge Friction Head',
                head: fmt(result.headBreakdown.dischargeFrictionHead, 2),
                bar: inputs.dischargePressureDrop,
              },
              {
                component: 'Suction Friction Head',
                head: fmt(result.headBreakdown.suctionFrictionHead, 2),
                bar: inputs.suctionPressureDrop,
              },
              {
                component: 'TOTAL DIFFERENTIAL HEAD',
                head: fmt(result.totalDifferentialHead, 2),
                bar: fmt(result.differentialPressure, 3),
              },
            ]}
          />
        </ReportSection>

        {/* ── Power Summary ── */}
        <ReportSection title="Power Summary">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={[
              {
                param: 'Volumetric Flow',
                value: fmt(result.volumetricFlowM3Hr, 2),
                unit: 'm\u00B3/hr',
              },
              {
                param: 'Differential Pressure',
                value: fmt(result.differentialPressure, 3),
                unit: 'bar',
              },
              { param: 'Hydraulic Power', value: fmt(result.hydraulicPower, 2), unit: 'kW' },
              { param: 'Brake Power (Shaft)', value: fmt(result.brakePower, 2), unit: 'kW' },
              { param: 'Motor Input Power', value: fmt(result.motorPower, 2), unit: 'kW' },
              {
                param: 'Recommended Motor Size',
                value: fmt(result.recommendedMotorKW, 1),
                unit: 'kW (IEC)',
              },
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Pump Sizing Calculator',
            'TDH = (Pd - Ps)/(rho x g) + static + friction | Power: P = Q x rho x g x H / 1000',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
