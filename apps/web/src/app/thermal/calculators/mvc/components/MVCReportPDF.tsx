/**
 * Mechanical Vapour Compressor Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import type { MVCResult } from '@/lib/thermal/mvcCalculator';
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

export interface MVCReportInputs {
  suctionPressure: string;
  suctionTemperature: string;
  dischargePressure: string;
  flowRate: string;
  isentropicEfficiency: string;
  mechanicalEfficiency: string;
}

interface MVCReportPDFProps {
  result: MVCResult;
  inputs: MVCReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number, d = 2) => (isNaN(v) ? '—' : v.toFixed(d));

export const MVCReportPDF = ({
  result,
  inputs,
  documentNumber = 'MVC-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: MVCReportPDFProps) => {
  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Mechanical Vapour Compressor Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Shaft Power', value: `${fmt(result.shaftPower, 1)} kW` },
            { label: 'Specific Energy', value: `${fmt(result.specificEnergy, 1)} kWh/ton` },
            { label: 'Compression Ratio', value: fmt(result.compressionRatio, 2) },
          ]}
        />

        {/* ── Inputs ── */}
        <TwoColumnLayout
          left={
            <ReportSection title="Operating Conditions">
              <KeyValueTable
                rows={[
                  { label: 'Suction Pressure', value: `${inputs.suctionPressure} bar abs` },
                  {
                    label: 'Suction Temperature',
                    value: inputs.suctionTemperature
                      ? `${inputs.suctionTemperature} \u00B0C`
                      : 'Saturated',
                  },
                  { label: 'Discharge Pressure', value: `${inputs.dischargePressure} bar abs` },
                  { label: 'Vapour Flow Rate', value: `${inputs.flowRate} ton/hr` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Efficiencies">
              <KeyValueTable
                rows={[
                  { label: 'Isentropic Efficiency', value: `${inputs.isentropicEfficiency}%` },
                  { label: 'Mechanical Efficiency', value: `${inputs.mechanicalEfficiency}%` },
                  { label: 'Compression Ratio', value: fmt(result.compressionRatio, 3) },
                ]}
              />
            </ReportSection>
          }
        />

        {/* ── Thermodynamic State Points ── */}
        <ReportSection title="State Points">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '40%' },
              { key: 'suction', header: 'Suction', width: '20%', align: 'right' },
              { key: 'isentropic', header: 'Discharge (Isen.)', width: '20%', align: 'right' },
              { key: 'actual', header: 'Discharge (Actual)', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                param: 'Temperature (\u00B0C)',
                suction: fmt(result.suctionTemperature, 1),
                isentropic: fmt(result.dischargeTemperatureIsentropic, 1),
                actual: fmt(result.dischargeTemperatureActual, 1),
              },
              {
                param: 'Enthalpy (kJ/kg)',
                suction: fmt(result.suctionEnthalpy, 1),
                isentropic: fmt(result.dischargeEnthalpyIsentropic, 1),
                actual: fmt(result.dischargeEnthalpyActual, 1),
              },
              {
                param: 'Entropy (kJ/kg\u00B7K)',
                suction: fmt(result.suctionEntropy, 4),
                isentropic: fmt(result.suctionEntropy, 4),
                actual: '—',
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
              { param: 'Isentropic Power', value: fmt(result.isentropicPower, 2), unit: 'kW' },
              { param: 'Shaft Power', value: fmt(result.shaftPower, 2), unit: 'kW' },
              { param: 'Electrical Power', value: fmt(result.electricalPower, 2), unit: 'kW' },
              { param: 'Specific Energy', value: fmt(result.specificEnergy, 2), unit: 'kWh/ton' },
              {
                param: 'Volumetric Flow (Suction)',
                value: fmt(result.volumetricFlowSuction, 1),
                unit: 'm\u00B3/hr',
              },
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | MVC Calculator',
            'Method: Isentropic compression with IAPWS-IF97 steam tables',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
