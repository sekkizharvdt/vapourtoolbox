/**
 * TVC Calculation Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document, View, StyleSheet } from '@react-pdf/renderer';
import type { TVCResult } from '@/lib/thermal/tvcCalculator';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import { TVCDiagramPDF } from './TVCDiagramPDF';
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

const local = StyleSheet.create({
  diagramSection: {
    marginTop: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
});

export interface TVCReportInputs {
  motivePressure: string;
  motiveTemperature: string;
  suctionPressure: string;
  dischargePressure: string;
  flowMode: string;
  flowValue: string;
  desuperheatEnabled: boolean;
  sprayWaterTemperature: string;
}

interface TVCReportPDFProps {
  result: TVCResult;
  desuperheatingResult: DesuperheatingResult | null;
  inputs: TVCReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const TVCReportPDF = ({
  result,
  desuperheatingResult,
  inputs,
  documentNumber = 'TVC-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: TVCReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    isNaN(value) ? '—' : value.toFixed(decimals);

  const flowLabel = inputs.flowMode === 'entrained' ? 'Entrained Flow' : 'Motive Flow';

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Thermo Vapour Compressor (TVC) Calculation Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Entrainment Ratio (Ra)', value: fmt(result.entrainmentRatio, 4) },
            { label: 'Compression Ratio (CR)', value: fmt(result.compressionRatio, 3) },
            {
              label: 'Ejector Efficiency',
              value: `${(result.ejectorEfficiency * 100).toFixed(1)}%`,
            },
            { label: 'Discharge Superheat', value: `${fmt(result.dischargeSuperheat, 1)}°C` },
          ]}
        />

        {/* Diagram */}
        <View style={local.diagramSection}>
          <TVCDiagramPDF result={result} />
        </View>

        {/* Inputs + Component Efficiencies */}
        <TwoColumnLayout
          left={
            <ReportSection title="Input Parameters">
              <KeyValueTable
                rows={[
                  { label: 'Motive Pressure', value: `${inputs.motivePressure} bar abs` },
                  {
                    label: 'Motive Temperature',
                    value: inputs.motiveTemperature
                      ? `${inputs.motiveTemperature} °C`
                      : 'Saturated',
                  },
                  { label: 'Suction Pressure', value: `${inputs.suctionPressure} bar abs` },
                  { label: 'Discharge Pressure', value: `${inputs.dischargePressure} bar abs` },
                  { label: flowLabel, value: `${inputs.flowValue} t/hr` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Component Efficiencies">
              <KeyValueTable
                rows={[
                  {
                    label: 'Nozzle Efficiency',
                    value: `${(result.nozzleEfficiency * 100).toFixed(0)}%`,
                  },
                  {
                    label: 'Mixing Efficiency',
                    value: `${(result.mixingEfficiency * 100).toFixed(0)}%`,
                  },
                  {
                    label: 'Diffuser Efficiency',
                    value: `${(result.diffuserEfficiency * 100).toFixed(0)}%`,
                  },
                  {
                    label: 'Overall Ejector η',
                    value: `${(result.ejectorEfficiency * 100).toFixed(1)}%`,
                  },
                  { label: 'Expansion Ratio', value: fmt(result.expansionRatio, 2) },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Mass and Energy Balance */}
        <ReportSection title="Mass & Energy Balance">
          <ReportTable
            columns={[
              { key: 'stream', header: 'Stream', width: '25%' },
              { key: 'flow', header: 'Flow (t/hr)', width: '25%', align: 'right' },
              { key: 'enthalpy', header: 'Enthalpy (kJ/kg)', width: '25%', align: 'right' },
              { key: 'sat', header: 'Sat. Temp (°C)', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                stream: 'Motive Steam',
                flow: result.motiveFlow.toFixed(3),
                enthalpy: result.motiveEnthalpy.toFixed(1),
                sat: result.motiveSatTemperature.toFixed(1),
              },
              {
                stream: 'Suction Vapor',
                flow: result.entrainedFlow.toFixed(3),
                enthalpy: result.suctionEnthalpy.toFixed(1),
                sat: result.suctionSatTemperature.toFixed(1),
              },
              {
                stream: 'Discharge',
                flow: result.dischargeFlow.toFixed(3),
                enthalpy: result.dischargeEnthalpy.toFixed(1),
                sat: result.dischargeSatTemperature.toFixed(1),
              },
            ]}
          />
        </ReportSection>

        {/* Performance */}
        <ReportSection title="Performance">
          <KeyValueTable
            rows={[
              {
                label: 'Theoretical Ra (ideal)',
                value: fmt(result.theoreticalEntrainmentRatio, 4),
              },
              { label: 'Actual Ra (with losses)', value: fmt(result.entrainmentRatio, 4) },
              {
                label: 'Discharge Temperature',
                value: `${fmt(result.dischargeTemperature, 1)} °C`,
              },
              { label: 'Discharge Superheat', value: `${fmt(result.dischargeSuperheat, 1)} °C` },
            ]}
          />
        </ReportSection>

        {/* Discharge Desuperheating (optional) */}
        {desuperheatingResult && (
          <ReportSection title="Discharge Desuperheating">
            <KeyValueTable
              rows={[
                { label: 'Spray Water Temperature', value: `${inputs.sprayWaterTemperature} °C` },
                {
                  label: 'Required Spray Water',
                  value: `${desuperheatingResult.sprayWaterFlow.toFixed(3)} t/hr`,
                },
                {
                  label: 'Water/Steam Ratio',
                  value: `${(desuperheatingResult.waterToSteamRatio * 100).toFixed(1)}%`,
                },
                {
                  label: 'Heat Removed',
                  value: `${(desuperheatingResult.heatRemoved / 1000).toFixed(3)} MW`,
                },
              ]}
            />
          </ReportSection>
        )}

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | TVC Calculator',
            'Steam tables: IAPWS-IF97 | Method: 1-D Constant Pressure Mixing (Huang 1999)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
