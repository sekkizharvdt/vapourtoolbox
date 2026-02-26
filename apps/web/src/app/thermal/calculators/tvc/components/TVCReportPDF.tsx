/**
 * TVC Calculation Report — PDF Document
 *
 * React-PDF template following the SiphonReportPDF / DesuperheatingReportPDF pattern.
 */

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { TVCResult } from '@/lib/thermal/tvcCalculator';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import { TVCDiagramPDF } from './TVCDiagramPDF';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '2pt solid #1976d2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 4,
  },
  diagramSection: {
    marginTop: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  headerItem: {
    flexDirection: 'row',
  },
  headerLabel: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  section: {
    marginTop: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    padding: 4,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #e0e0e0',
    paddingVertical: 2.5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1pt solid #ccc',
    paddingVertical: 3,
    fontWeight: 'bold',
  },
  col15: { width: '15%', paddingHorizontal: 3 },
  col20: { width: '20%', paddingHorizontal: 3 },
  col25: { width: '25%', paddingHorizontal: 3 },
  col30: { width: '30%', paddingHorizontal: 3 },
  col35: { width: '35%', paddingHorizontal: 3 },
  col40: { width: '40%', paddingHorizontal: 3 },
  col50: { width: '50%', paddingHorizontal: 3 },
  colRight: { textAlign: 'right' },
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
  },
  bold: {
    fontWeight: 'bold',
  },
  primaryResult: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  warning: {
    backgroundColor: '#fff3e0',
    padding: 5,
    marginTop: 3,
    fontSize: 8,
  },
  warningText: {
    color: '#e65100',
  },
  noteSection: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#fafafa',
    border: '0.5pt solid #e0e0e0',
  },
  noteTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  noteText: {
    fontSize: 8,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 8,
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

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const flowLabel = inputs.flowMode === 'entrained' ? 'Entrained Flow' : 'Motive Flow';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* === Header === */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.title}>Thermo Vapour Compressor (TVC) Calculation Report</Text>
            {projectName && <Text style={styles.subtitle}>{projectName}</Text>}
            <View style={styles.headerRow}>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Document No.:</Text>
                <Text>{documentNumber}</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Revision:</Text>
                <Text>{revision}</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Date:</Text>
                <Text>{today}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* === Primary Result Banner === */}
        <View style={styles.primaryResult}>
          <View>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Entrainment Ratio (Ra)</Text>
            <Text style={styles.primaryValue}>{fmt(result.entrainmentRatio, 4)}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Compression Ratio (CR)</Text>
            <Text style={styles.primaryValue}>{fmt(result.compressionRatio, 3)}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Ejector Efficiency</Text>
            <Text style={styles.primaryValue}>{(result.ejectorEfficiency * 100).toFixed(1)}%</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Discharge Superheat</Text>
            <Text style={styles.primaryValue}>{fmt(result.dischargeSuperheat, 1)}°C</Text>
          </View>
        </View>

        {/* === Diagram === */}
        <View style={styles.diagramSection}>
          <TVCDiagramPDF result={result} />
        </View>

        {/* === Two-column: Inputs + Performance === */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Input Parameters</Text>
              <View style={styles.table}>
                {[
                  ['Motive Pressure', `${inputs.motivePressure} bar abs`],
                  [
                    'Motive Temperature',
                    inputs.motiveTemperature ? `${inputs.motiveTemperature} °C` : 'Saturated',
                  ],
                  ['Suction Pressure', `${inputs.suctionPressure} bar abs`],
                  ['Discharge Pressure', `${inputs.dischargePressure} bar abs`],
                  [flowLabel, `${inputs.flowValue} t/hr`],
                ].map(([label, value]) => (
                  <View key={label} style={styles.tableRow}>
                    <Text style={styles.col50}>{label}</Text>
                    <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Component Efficiencies</Text>
              <View style={styles.table}>
                {[
                  ['Nozzle Efficiency', `${(result.nozzleEfficiency * 100).toFixed(0)}%`],
                  ['Mixing Efficiency', `${(result.mixingEfficiency * 100).toFixed(0)}%`],
                  ['Diffuser Efficiency', `${(result.diffuserEfficiency * 100).toFixed(0)}%`],
                  ['Overall Ejector η', `${(result.ejectorEfficiency * 100).toFixed(1)}%`],
                  ['Expansion Ratio', fmt(result.expansionRatio, 2)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.tableRow}>
                    <Text style={styles.col50}>{label}</Text>
                    <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* === Mass and Energy Balance === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mass & Energy Balance</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col25}>Stream</Text>
              <Text style={[styles.col25, styles.colRight]}>Flow (t/hr)</Text>
              <Text style={[styles.col25, styles.colRight]}>Enthalpy (kJ/kg)</Text>
              <Text style={[styles.col25, styles.colRight]}>Sat. Temp (°C)</Text>
            </View>
            {[
              {
                stream: 'Motive Steam',
                flow: result.motiveFlow,
                enthalpy: result.motiveEnthalpy,
                sat: result.motiveSatTemperature,
              },
              {
                stream: 'Suction Vapor',
                flow: result.entrainedFlow,
                enthalpy: result.suctionEnthalpy,
                sat: result.suctionSatTemperature,
              },
              {
                stream: 'Discharge',
                flow: result.dischargeFlow,
                enthalpy: result.dischargeEnthalpy,
                sat: result.dischargeSatTemperature,
              },
            ].map((row) => (
              <View key={row.stream} style={styles.tableRow}>
                <Text style={[styles.col25, styles.bold]}>{row.stream}</Text>
                <Text style={[styles.col25, styles.colRight]}>{row.flow.toFixed(3)}</Text>
                <Text style={[styles.col25, styles.colRight]}>{row.enthalpy.toFixed(1)}</Text>
                <Text style={[styles.col25, styles.colRight]}>{row.sat.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* === Performance Parameters === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.table}>
            {[
              ['Theoretical Ra (ideal)', fmt(result.theoreticalEntrainmentRatio, 4)],
              ['Actual Ra (with losses)', fmt(result.entrainmentRatio, 4)],
              ['Discharge Temperature', `${fmt(result.dischargeTemperature, 1)} °C`],
              ['Discharge Superheat', `${fmt(result.dischargeSuperheat, 1)} °C`],
            ].map(([label, value]) => (
              <View key={label} style={styles.tableRow}>
                <Text style={styles.col50}>{label}</Text>
                <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* === Discharge Desuperheating (optional) === */}
        {desuperheatingResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discharge Desuperheating</Text>
            <View style={styles.table}>
              {[
                ['Spray Water Temperature', `${inputs.sprayWaterTemperature} °C`],
                ['Required Spray Water', `${desuperheatingResult.sprayWaterFlow.toFixed(3)} t/hr`],
                [
                  'Water/Steam Ratio',
                  `${(desuperheatingResult.waterToSteamRatio * 100).toFixed(1)}%`,
                ],
                ['Heat Removed', `${(desuperheatingResult.heatRemoved / 1000).toFixed(3)} MW`],
              ].map(([label, value]) => (
                <View key={label} style={styles.tableRow}>
                  <Text style={styles.col50}>{label}</Text>
                  <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* === Warnings === */}
        {result.warnings.length > 0 && (
          <View style={styles.section}>
            {result.warnings.map((w, i) => (
              <View key={i} style={styles.warning}>
                <Text style={styles.warningText}>⚠ {w}</Text>
              </View>
            ))}
          </View>
        )}

        {/* === Notes === */}
        {notes && (
          <View style={styles.noteSection}>
            <Text style={styles.noteTitle}>Notes</Text>
            <Text style={styles.noteText}>{notes}</Text>
          </View>
        )}

        {/* === Footer === */}
        <View style={styles.footer}>
          <Text>
            {documentNumber} Rev {revision} | TVC Calculation | Generated by Vapour Toolbox |{' '}
            {today} | Steam tables: IAPWS-IF97 | Method: 1-D Constant Pressure Mixing (Huang 1999)
          </Text>
        </View>
      </Page>
    </Document>
  );
};
