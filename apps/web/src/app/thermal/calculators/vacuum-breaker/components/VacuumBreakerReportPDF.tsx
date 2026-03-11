/**
 * Vacuum Breaker Sizing Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document } from '@react-pdf/renderer';
import type { VacuumBreakerResult } from '@/lib/thermal/vacuumBreakerCalculator';
import { VALVE_TYPE_LABELS } from '@/lib/thermal/vacuumBreakerCalculator';
import type { VacuumBreakerReportInputs } from './VacuumBreakerResults';
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

interface VacuumBreakerReportPDFProps {
  result: VacuumBreakerResult;
  inputs: VacuumBreakerReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const VacuumBreakerReportPDF = ({
  result,
  inputs,
  documentNumber = 'VB-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: VacuumBreakerReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    isNaN(value) ? '—' : value.toFixed(decimals);

  // Sample the pressure profile for the report (every 5th entry, ~10 rows)
  const profileSample = result.pressureProfile.filter(
    (_, i) => i === 0 || i === result.pressureProfile.length - 1 || i % 5 === 0
  );

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Vacuum Breaker Sizing Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            {
              label: 'Selected Valve Size',
              value: `DN ${result.selectedValve.dn} (${result.selectedValve.nps})`,
            },
            {
              label: 'Number of Breakers',
              value: `${result.numberOfBreakers}`,
            },
            {
              label: 'Required Orifice Area',
              value: `${fmt(result.requiredOrificeArea)} cm²`,
            },
          ]}
        />

        {/* Input Parameters + Valve Configuration */}
        <TwoColumnLayout
          left={
            <ReportSection title="Design Basis">
              <KeyValueTable
                rows={[
                  { label: 'Total Volume (all effects)', value: `${inputs.totalVolume} m³` },
                  { label: 'Number of Breakers', value: inputs.numberOfBreakers },
                  {
                    label: 'Volume per Breaker',
                    value: `${fmt(result.volumePerBreaker)} m³`,
                  },
                  {
                    label: 'Operating Pressure',
                    value: `${inputs.operatingPressure} kPa abs`,
                  },
                  { label: 'Equalization Time', value: `${inputs.equalizationTime} minutes` },
                  { label: 'Ambient Temperature', value: `${inputs.ambientTemperature} °C` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Valve & Flow Parameters">
              <KeyValueTable
                rows={[
                  {
                    label: 'Valve Type',
                    value:
                      VALVE_TYPE_LABELS[inputs.valveType as keyof typeof VALVE_TYPE_LABELS] ??
                      inputs.valveType,
                  },
                  {
                    label: 'Discharge Coefficient (Cd)',
                    value: fmt(result.dischargeCoefficient, 2),
                  },
                  {
                    label: 'Critical Pressure Ratio',
                    value: fmt(result.criticalPressureRatio, 3),
                  },
                  {
                    label: 'Choked → Subsonic Transition',
                    value: `${fmt(result.transitionPressureKPa)} kPa abs`,
                  },
                  {
                    label: 'Choked Mass Flux',
                    value: `${fmt(result.chokedFluxPerCd)} kg/(s·m²)`,
                  },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Sizing Results */}
        <ReportSection title="Sizing Results">
          <KeyValueTable
            rows={[
              {
                label: 'Air Mass Required (per breaker)',
                value: `${fmt(result.airMassRequired, 3)} kg`,
              },
              {
                label: 'Average Mass Flow Rate',
                value: `${fmt(result.averageMassFlowRate, 4)} kg/s`,
              },
              {
                label: 'Required Orifice Area',
                value: `${fmt(result.requiredOrificeArea)} cm²`,
              },
              {
                label: 'Required Orifice Diameter',
                value: `${fmt(result.requiredOrificeDiameter, 1)} mm`,
              },
              {
                label: 'Selected Valve',
                value: `DN ${result.selectedValve.dn} (${result.selectedValve.nps}) — bore area ${fmt(result.selectedValve.boreArea)} cm²`,
              },
            ]}
          />
        </ReportSection>

        {/* Pressure Equalization Profile */}
        <ReportSection title="Pressure Equalization Profile">
          <ReportTable
            columns={[
              { key: 'time', header: 'Time (min)', width: '25%', align: 'right' },
              { key: 'pressure', header: 'Pressure (kPa abs)', width: '25%', align: 'right' },
              { key: 'flowRate', header: 'Flow Rate (kg/s)', width: '25%', align: 'right' },
              { key: 'regime', header: 'Flow Regime', width: '25%' },
            ]}
            rows={profileSample.map((step) => ({
              time: (step.time / 60).toFixed(1),
              pressure: step.pressure.toFixed(2),
              flowRate: step.massFlowRate.toFixed(4),
              regime: step.regime === 'choked' ? 'Choked' : 'Subsonic',
            }))}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Vacuum Breaker Sizing Calculator',
            'Method: Isentropic compressible flow (ISO 9300) | Reference: HEI Tech Sheet #131, HEI 2629',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
