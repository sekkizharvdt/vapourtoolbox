/**
 * Desuperheating Calculation Report — PDF Document
 *
 * React-PDF template following the SiphonReportPDF pattern.
 */

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { DesuperheatingResult } from '@/lib/thermal/desuperheatingCalculator';
import { DesuperheatingDiagramPDF } from './DesuperheatingDiagramPDF';

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
    fontSize: 16,
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
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* === Header === */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.title}>Desuperheating Calculation Report</Text>
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
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Spray Water Requirement</Text>
            <Text style={styles.primaryValue}>{fmt(result.sprayWaterFlow, 3)} t/hr</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Water/Steam Ratio</Text>
            <Text style={styles.primaryValue}>{(result.waterToSteamRatio * 100).toFixed(1)}%</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Heat Removed</Text>
            <Text style={styles.primaryValue}>{(result.heatRemoved / 1000).toFixed(1)} MW</Text>
          </View>
        </View>

        {/* === Diagram === */}
        <View style={styles.diagramSection}>
          <DesuperheatingDiagramPDF result={result} steamPressure={steamPressureNum} />
        </View>

        {/* === Two-column sections === */}
        <View style={styles.twoColumn}>
          {/* Left: Input Parameters */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Input Parameters</Text>
              <View style={styles.table}>
                {[
                  ['Steam Pressure', `${inputs.steamPressure} bar abs`],
                  ['Steam Temperature', `${inputs.steamTemperature} °C`],
                  ['Target Temperature', `${inputs.targetTemperature} °C`],
                  ['Spray Water Temperature', `${inputs.sprayWaterTemperature} °C`],
                  ['Steam Flow', `${inputs.steamFlow} t/hr`],
                ].map(([label, value]) => (
                  <View key={label} style={styles.tableRow}>
                    <Text style={styles.col50}>{label}</Text>
                    <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Right: Steam Properties */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Steam Properties (IAPWS-IF97)</Text>
              <View style={styles.table}>
                {[
                  ['Saturation Temperature', `${fmt(result.saturationTemperature, 1)} °C`],
                  ['Degrees of Superheat (in)', `${fmt(result.degreesOfSuperheat, 1)} °C`],
                  [
                    'Outlet Superheat',
                    result.outletSuperheat > 0.1
                      ? `${fmt(result.outletSuperheat, 1)} °C`
                      : 'Saturated',
                  ],
                  ['Steam Enthalpy (in)', `${fmt(result.steamEnthalpy, 1)} kJ/kg`],
                  ['Target Enthalpy', `${fmt(result.targetEnthalpy, 1)} kJ/kg`],
                  ['Spray Water Enthalpy', `${fmt(result.sprayWaterEnthalpy, 1)} kJ/kg`],
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

        {/* === Mass Balance === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mass Balance</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col30}>Stream</Text>
              <Text style={[styles.col25, styles.colRight]}>Flow (t/hr)</Text>
              <Text style={[styles.col25, styles.colRight]}>Enthalpy (kJ/kg)</Text>
              <Text style={[styles.col20, styles.colRight]}>Ratio</Text>
            </View>
            {[
              {
                stream: 'Steam In',
                flow: parseFloat(inputs.steamFlow),
                enthalpy: result.steamEnthalpy,
                ratio: '1.000',
              },
              {
                stream: 'Spray Water',
                flow: result.sprayWaterFlow,
                enthalpy: result.sprayWaterEnthalpy,
                ratio: fmt(result.waterToSteamRatio, 4),
              },
              {
                stream: 'Total Outlet',
                flow: result.totalOutletFlow,
                enthalpy: result.targetEnthalpy,
                ratio: fmt(1 + result.waterToSteamRatio, 4),
              },
            ].map((row) => (
              <View key={row.stream} style={styles.tableRow}>
                <Text style={[styles.col30, styles.bold]}>{row.stream}</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {isNaN(row.flow) ? '—' : row.flow.toFixed(3)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>{row.enthalpy.toFixed(1)}</Text>
                <Text style={[styles.col20, styles.colRight]}>{row.ratio}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* === Energy Balance === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Energy Balance</Text>
          <View style={styles.table}>
            {[
              ['Heat Removed from Steam', `${(result.heatRemoved / 1000).toFixed(3)} MW`],
              ['Heat Removed from Steam', `${result.heatRemoved.toFixed(1)} kW`],
              [
                'Enthalpy Drop (steam)',
                `${(result.steamEnthalpy - result.targetEnthalpy).toFixed(1)} kJ/kg`,
              ],
              [
                'Enthalpy Rise (water)',
                `${(result.targetEnthalpy - result.sprayWaterEnthalpy).toFixed(1)} kJ/kg`,
              ],
            ].map(([label, value]) => (
              <View key={label} style={styles.tableRow}>
                <Text style={styles.col50}>{label}</Text>
                <Text style={[styles.col50, styles.colRight, styles.bold]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

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
            {documentNumber} Rev {revision} | Desuperheating Calculation | Generated by Vapour
            Toolbox | {today} | Steam tables: IAPWS-IF97 | Method: Energy Balance (Perry&apos;s
            Chemical Engineers&apos; Handbook)
          </Text>
        </View>
      </Page>
    </Document>
  );
};
