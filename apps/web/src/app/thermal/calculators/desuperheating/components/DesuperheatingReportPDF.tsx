/**
 * Desuperheating Calculation Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document, View, StyleSheet } from '@react-pdf/renderer';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import { DesuperheatingDiagramPDF } from './DesuperheatingDiagramPDF';
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

export interface DesuperheatingReportInputs {
  steamPressure: string;
  steamTemperature: string;
  targetTemperature: string;
  sprayWaterTemperature: string;
  steamFlow: string;
}

interface DesuperheatingReportPDFProps {
  result: DesuperheatingResult;
  inputs: DesuperheatingReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const DesuperheatingReportPDF = ({
  result,
  inputs,
  documentNumber = 'DSH-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: DesuperheatingReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    isNaN(value) ? '—' : value.toFixed(decimals);

  const steamPressureNum = parseFloat(inputs.steamPressure) || null;

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Desuperheating Calculation Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Spray Water Requirement', value: `${fmt(result.sprayWaterFlow, 3)} t/hr` },
            {
              label: 'Water/Steam Ratio',
              value: `${(result.waterToSteamRatio * 100).toFixed(1)}%`,
            },
            { label: 'Heat Removed', value: `${(result.heatRemoved / 1000).toFixed(1)} MW` },
          ]}
        />

        {/* Diagram */}
        <View style={local.diagramSection}>
          <DesuperheatingDiagramPDF result={result} steamPressure={steamPressureNum} />
        </View>

        {/* Input Parameters + Steam Properties */}
        <TwoColumnLayout
          left={
            <ReportSection title="Input Parameters">
              <KeyValueTable
                rows={[
                  { label: 'Steam Pressure', value: `${inputs.steamPressure} bar abs` },
                  { label: 'Steam Temperature', value: `${inputs.steamTemperature} °C` },
                  { label: 'Target Temperature', value: `${inputs.targetTemperature} °C` },
                  { label: 'Spray Water Temperature', value: `${inputs.sprayWaterTemperature} °C` },
                  { label: 'Steam Flow', value: `${inputs.steamFlow} t/hr` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Steam Properties (IAPWS-IF97)">
              <KeyValueTable
                rows={[
                  {
                    label: 'Saturation Temperature',
                    value: `${fmt(result.saturationTemperature, 1)} °C`,
                  },
                  {
                    label: 'Degrees of Superheat (in)',
                    value: `${fmt(result.degreesOfSuperheat, 1)} °C`,
                  },
                  {
                    label: 'Outlet Superheat',
                    value:
                      result.outletSuperheat > 0.1
                        ? `${fmt(result.outletSuperheat, 1)} °C`
                        : 'Saturated',
                  },
                  { label: 'Steam Enthalpy (in)', value: `${fmt(result.steamEnthalpy, 1)} kJ/kg` },
                  { label: 'Target Enthalpy', value: `${fmt(result.targetEnthalpy, 1)} kJ/kg` },
                  {
                    label: 'Spray Water Enthalpy',
                    value: `${fmt(result.sprayWaterEnthalpy, 1)} kJ/kg`,
                  },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Mass Balance */}
        <ReportSection title="Mass Balance">
          <ReportTable
            columns={[
              { key: 'stream', header: 'Stream', width: '30%' },
              { key: 'flow', header: 'Flow (t/hr)', width: '25%', align: 'right' },
              { key: 'enthalpy', header: 'Enthalpy (kJ/kg)', width: '25%', align: 'right' },
              { key: 'ratio', header: 'Ratio', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                stream: 'Steam In',
                flow: isNaN(parseFloat(inputs.steamFlow))
                  ? '—'
                  : parseFloat(inputs.steamFlow).toFixed(3),
                enthalpy: result.steamEnthalpy.toFixed(1),
                ratio: '1.000',
              },
              {
                stream: 'Spray Water',
                flow: isNaN(result.sprayWaterFlow) ? '—' : result.sprayWaterFlow.toFixed(3),
                enthalpy: result.sprayWaterEnthalpy.toFixed(1),
                ratio: fmt(result.waterToSteamRatio, 4),
              },
              {
                stream: 'Total Outlet',
                flow: isNaN(result.totalOutletFlow) ? '—' : result.totalOutletFlow.toFixed(3),
                enthalpy: result.targetEnthalpy.toFixed(1),
                ratio: fmt(1 + result.waterToSteamRatio, 4),
              },
            ]}
          />
        </ReportSection>

        {/* Energy Balance */}
        <ReportSection title="Energy Balance">
          <KeyValueTable
            rows={[
              {
                label: 'Heat Removed from Steam',
                value: `${(result.heatRemoved / 1000).toFixed(3)} MW`,
              },
              { label: 'Heat Removed from Steam', value: `${result.heatRemoved.toFixed(1)} kW` },
              {
                label: 'Enthalpy Drop (steam)',
                value: `${(result.steamEnthalpy - result.targetEnthalpy).toFixed(1)} kJ/kg`,
              },
              {
                label: 'Enthalpy Rise (water)',
                value: `${(result.targetEnthalpy - result.sprayWaterEnthalpy).toFixed(1)} kJ/kg`,
              },
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Desuperheating Calculator',
            "Steam tables: IAPWS-IF97 | Method: Energy Balance (Perry's Chemical Engineers' Handbook)",
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
