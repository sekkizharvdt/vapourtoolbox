/**
 * Vacuum Breaker Sizing Report — PDF Document
 *
 * Supports all three modes: Manual Valve, Diaphragm Analysis, Diaphragm Design.
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

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(2)} hr`;
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

  const modeLabel =
    result.mode === 'MANUAL_VALVE'
      ? 'Manual Valve'
      : result.mode === 'DIAPHRAGM_ANALYSIS'
        ? 'Burst Diaphragm — Analysis'
        : 'Burst Diaphragm — Design';

  const profileSample = result.pressureProfile.filter(
    (_, i) => i === 0 || i === result.pressureProfile.length - 1 || i % 5 === 0
  );

  // Build right column rows based on mode
  const rightRows = [
    { label: 'Discharge Coefficient (Cd)', value: fmt(result.dischargeCoefficient, 2) },
    { label: 'Critical Pressure Ratio', value: fmt(result.criticalPressureRatio, 3) },
    {
      label: 'Choked → Subsonic Transition',
      value: `${fmt(result.transitionPressureKPa)} kPa abs`,
    },
    { label: 'Choked Mass Flux', value: `${fmt(result.chokedFluxPerCd)} kg/(s·m²)` },
  ];

  if (result.mode === 'MANUAL_VALVE') {
    rightRows.unshift({
      label: 'Valve Type',
      value:
        VALVE_TYPE_LABELS[inputs.valveType as keyof typeof VALVE_TYPE_LABELS] ?? inputs.valveType,
    });
  }
  if (result.mode === 'DIAPHRAGM_ANALYSIS' || result.mode === 'DIAPHRAGM_DESIGN') {
    rightRows.unshift({ label: 'Burst Pressure', value: `${result.burstPressureMbar} mbar abs` });
  }
  if (result.mode === 'DIAPHRAGM_DESIGN') {
    rightRows.push({ label: 'Max Allowed Rise Rate', value: `${result.maxAllowedRiseRate} kPa/s` });
  }

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
              label: `Selected Size (${modeLabel})`,
              value: `DN ${result.selectedValve.dn} (${result.selectedValve.nps})`,
            },
            { label: 'Number of Breakers', value: `${result.numberOfBreakers}` },
            { label: 'Equalization Time', value: formatTime(result.equalizationTimeSec) },
            { label: 'Peak Rise Rate', value: `${fmt(result.peakPressureRiseRate, 3)} kPa/s` },
          ]}
        />

        <TwoColumnLayout
          left={
            <ReportSection title="Design Basis">
              <KeyValueTable
                rows={[
                  { label: 'Calculation Mode', value: modeLabel },
                  { label: 'Total Volume', value: `${inputs.totalVolume} m³` },
                  { label: 'Number of Breakers', value: inputs.numberOfBreakers },
                  { label: 'Volume per Breaker', value: `${fmt(result.volumePerBreaker)} m³` },
                  { label: 'Operating Pressure', value: `${inputs.operatingPressure} kPa abs` },
                  { label: 'Ambient Temperature', value: `${inputs.ambientTemperature} °C` },
                  ...(result.mode === 'MANUAL_VALVE'
                    ? [
                        {
                          label: 'Target Equalization Time',
                          value: `${inputs.equalizationTime} min`,
                        },
                      ]
                    : []),
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Flow Parameters">
              <KeyValueTable rows={rightRows} />
            </ReportSection>
          }
        />

        <ReportSection title="Sizing Results">
          <KeyValueTable
            rows={[
              {
                label: 'Air Mass Required (per breaker)',
                value: `${fmt(result.airMassRequired, 3)} kg`,
              },
              {
                label: 'Selected Size',
                value: `DN ${result.selectedValve.dn} (${result.selectedValve.nps}) — bore area ${fmt(result.selectedValve.boreArea)} cm²`,
              },
              {
                label: 'Equalization Time (actual)',
                value: formatTime(result.equalizationTimeSec),
              },
              {
                label: 'Peak Pressure Rise Rate',
                value: `${fmt(result.peakPressureRiseRate, 3)} kPa/s`,
              },
              ...(result.mode === 'MANUAL_VALVE'
                ? [
                    {
                      label: 'Required Orifice Area',
                      value: `${fmt(result.requiredOrificeArea)} cm²`,
                    },
                    {
                      label: 'Required Orifice Diameter',
                      value: `${fmt(result.requiredOrificeDiameter, 1)} mm`,
                    },
                    {
                      label: 'Average Mass Flow Rate',
                      value: `${fmt(result.averageMassFlowRate, 4)} kg/s`,
                    },
                  ]
                : []),
            ]}
          />
        </ReportSection>

        <ReportSection title="Pressure Equalization Profile">
          <ReportTable
            columns={[
              { key: 'time', header: 'Time (min)', width: '20%', align: 'right' },
              { key: 'pressure', header: 'Pressure (kPa)', width: '20%', align: 'right' },
              { key: 'riseRate', header: 'dP/dt (kPa/s)', width: '20%', align: 'right' },
              { key: 'flowRate', header: 'Flow (kg/s)', width: '20%', align: 'right' },
              { key: 'regime', header: 'Regime', width: '20%' },
            ]}
            rows={profileSample.map((step) => ({
              time: (step.time / 60).toFixed(1),
              pressure: step.pressure.toFixed(2),
              riseRate: step.pressureRiseRate.toFixed(3),
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
