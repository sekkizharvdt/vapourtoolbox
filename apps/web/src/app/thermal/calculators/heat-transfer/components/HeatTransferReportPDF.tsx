/**
 * Heat Transfer Coefficient Calculator — PDF Report
 *
 * Full A4 report with:
 *  - Logo header + project metadata
 *  - Primary results banner (h_i, h_o, U_o)
 *  - Embedded diagram
 *  - Input parameters (Tube Side / Shell Side / Tube Wall)
 *  - Thermal resistance breakdown
 *  - Correlations reference
 */

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { HeatTransferDiagramPDF } from './HeatTransferDiagramPDF';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';

export interface HeatTransferReportInputs {
  // Tube side
  tsDensity: string;
  tsVelocity: string;
  tsTubeID: string;
  tsViscosity: string;
  tsSpecificHeat: string;
  tsConductivity: string;
  tsIsHeating: boolean;
  // Shell side
  condLiquidDensity: string;
  condVaporDensity: string;
  condLatentHeat: string;
  condLiquidConductivity: string;
  condLiquidViscosity: string;
  condDimension: string;
  condDeltaT: string;
  condOrientation: 'vertical' | 'horizontal';
  // Tube wall
  overallTubeOD: string;
  overallWallConductivity: string;
  overallTubeSideFouling: string;
  overallShellSideFouling: string;
}

interface HeatTransferReportPDFProps {
  inputs: HeatTransferReportInputs;
  tubeSideResult: TubeSideHTCResult;
  condensationResult: CondensationHTCResult;
  overallResult: OverallHTCResult;
  logoDataUri: string | null;
  // Report metadata
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
}

const BLUE = '#1565c0';
const RED = '#c62828';
const GREEN = '#2e7d32';
const GRAY = '#616161';
const LIGHT = '#f5f5f5';
const BORDER = '#e0e0e0';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 32, color: '#212121' },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottom: `2 solid ${BLUE}`,
    paddingBottom: 8,
  },
  logo: { width: 80, height: 30, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BLUE },
  headerSub: { fontSize: 8, color: GRAY, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  metaBlock: { flex: 1, backgroundColor: LIGHT, padding: 6, borderRadius: 3 },
  metaLabel: { fontSize: 7, color: GRAY },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  // Banner
  bannerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bannerCard: { flex: 1, padding: 10, borderRadius: 4, alignItems: 'center' },
  bannerLabel: { fontSize: 8, marginBottom: 3 },
  bannerValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  bannerUnit: { fontSize: 7, marginTop: 2, color: GRAY },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BLUE,
    marginTop: 12,
    marginBottom: 5,
    borderBottom: `1 solid ${BORDER}`,
    paddingBottom: 3,
  },
  // Two-column params
  paramGrid: { flexDirection: 'row', gap: 8 },
  paramCol: { flex: 1 },
  paramGroupTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: GRAY,
    marginBottom: 4,
    backgroundColor: LIGHT,
    padding: '3 6',
    borderRadius: 2,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottom: `1 solid ${BORDER}`,
  },
  paramLabel: { color: GRAY, flex: 2 },
  paramValue: { fontFamily: 'Helvetica-Bold', flex: 1, textAlign: 'right' },
  // Resistance table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BLUE,
    padding: '4 6',
    borderRadius: 2,
    marginBottom: 0,
  },
  tableHeaderCell: { flex: 1, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', padding: '3 6', borderBottom: `1 solid ${BORDER}` },
  tableRowAlt: {
    flexDirection: 'row',
    padding: '3 6',
    borderBottom: `1 solid ${BORDER}`,
    backgroundColor: LIGHT,
  },
  tableCell: { flex: 1, fontSize: 8 },
  tableCellBold: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    borderTop: `1 solid ${BORDER}`,
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GRAY },
  notes: {
    backgroundColor: '#fff8e1',
    border: `1 solid #ffe082`,
    padding: 8,
    borderRadius: 3,
    marginTop: 8,
  },
  notesText: { fontSize: 8, color: '#5d4037' },
});

function fmtHTC(v: number) {
  return `${v.toFixed(1)} W/(m²·K)`;
}
function fmtR(v: number) {
  return `${(v * 1000).toFixed(4)} ×10⁻³ m²·K/W`;
}

export function HeatTransferReportPDF({
  inputs,
  tubeSideResult,
  condensationResult,
  overallResult,
  logoDataUri,
  documentNumber,
  revision,
  projectName,
  notes,
}: HeatTransferReportPDFProps) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const resTotal = overallResult.resistances.total;
  const resistanceRows = [
    {
      label: 'Tube-side convection (ref. OD)',
      value: overallResult.resistances.tubeSide,
      pct: (overallResult.resistances.tubeSide / resTotal) * 100,
    },
    {
      label: 'Tube-side fouling (ref. OD)',
      value: overallResult.resistances.tubeSideFouling,
      pct: (overallResult.resistances.tubeSideFouling / resTotal) * 100,
    },
    {
      label: 'Tube wall conduction',
      value: overallResult.resistances.tubeWall,
      pct: (overallResult.resistances.tubeWall / resTotal) * 100,
    },
    {
      label: 'Shell-side fouling',
      value: overallResult.resistances.shellSideFouling,
      pct: (overallResult.resistances.shellSideFouling / resTotal) * 100,
    },
    {
      label: 'Shell-side convection',
      value: overallResult.resistances.shellSide,
      pct: (overallResult.resistances.shellSide / resTotal) * 100,
    },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoDataUri} style={styles.logo} />
            ) : (
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLUE }}>
                Vapour Toolbox
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Heat Transfer Coefficient</Text>
            <Text style={styles.headerSub}>
              Shell &amp; Tube — Condensation (Shell) + Forced Convection (Tube)
            </Text>
            <Text style={styles.headerSub}>Dittus-Boelter / Nusselt Film Condensation</Text>
          </View>
        </View>

        {/* Metadata row */}
        <View style={styles.metaRow}>
          {projectName && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Project</Text>
              <Text style={styles.metaValue}>{projectName}</Text>
            </View>
          )}
          {documentNumber && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Document No.</Text>
              <Text style={styles.metaValue}>{documentNumber}</Text>
            </View>
          )}
          {revision && (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Revision</Text>
              <Text style={styles.metaValue}>{revision}</Text>
            </View>
          )}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{today}</Text>
          </View>
        </View>

        {/* Primary results banner */}
        <View style={styles.bannerRow}>
          <View
            style={[styles.bannerCard, { backgroundColor: '#e3f2fd', border: `1.5 solid ${BLUE}` }]}
          >
            <Text style={[styles.bannerLabel, { color: BLUE }]}>h_i — Tube Side HTC</Text>
            <Text style={[styles.bannerValue, { color: BLUE }]}>{fmtHTC(tubeSideResult.htc)}</Text>
            <Text style={styles.bannerUnit}>
              Re = {tubeSideResult.reynoldsNumber.toFixed(0)} · Pr ={' '}
              {tubeSideResult.prandtlNumber.toFixed(3)}
            </Text>
          </View>
          <View
            style={[styles.bannerCard, { backgroundColor: '#ffebee', border: `1.5 solid ${RED}` }]}
          >
            <Text style={[styles.bannerLabel, { color: RED }]}>h_o — Shell Side HTC</Text>
            <Text style={[styles.bannerValue, { color: RED }]}>
              {fmtHTC(condensationResult.htc)}
            </Text>
            <Text style={styles.bannerUnit}>Nusselt Film Condensation</Text>
          </View>
          <View
            style={[
              styles.bannerCard,
              { backgroundColor: '#e8f5e9', border: `1.5 solid ${GREEN}` },
            ]}
          >
            <Text style={[styles.bannerLabel, { color: GREEN }]}>U_o — Overall HTC</Text>
            <Text style={[styles.bannerValue, { color: GREEN }]}>
              {fmtHTC(overallResult.overallHTC)}
            </Text>
            <Text style={styles.bannerUnit}>Based on outer tube area</Text>
          </View>
        </View>

        {/* Diagram */}
        <Text style={styles.sectionTitle}>Heat Exchanger Schematic</Text>
        <HeatTransferDiagramPDF
          tubeSideResult={tubeSideResult}
          condensationResult={condensationResult}
          overallResult={overallResult}
        />

        {/* Input parameters */}
        <Text style={styles.sectionTitle}>Input Parameters</Text>
        <View style={styles.paramGrid}>
          {/* Tube Side */}
          <View style={styles.paramCol}>
            <Text style={[styles.paramGroupTitle, { color: BLUE }]}>
              Tube Side (Cold — Forced Convection)
            </Text>
            {[
              { label: 'Fluid Density', value: `${inputs.tsDensity} kg/m³` },
              { label: 'Flow Velocity', value: `${inputs.tsVelocity} m/s` },
              { label: 'Tube Inner Diameter', value: `${inputs.tsTubeID} mm` },
              { label: 'Dynamic Viscosity', value: `${inputs.tsViscosity} Pa·s` },
              { label: 'Specific Heat', value: `${inputs.tsSpecificHeat} kJ/(kg·K)` },
              { label: 'Thermal Conductivity', value: `${inputs.tsConductivity} W/(m·K)` },
              { label: 'Process', value: inputs.tsIsHeating ? 'Heating' : 'Cooling' },
            ].map((row, i) => (
              <View
                key={i}
                style={
                  i % 2 === 0 ? styles.paramRow : { ...styles.paramRow, backgroundColor: LIGHT }
                }
              >
                <Text style={styles.paramLabel}>{row.label}</Text>
                <Text style={styles.paramValue}>{row.value}</Text>
              </View>
            ))}
          </View>
          {/* Shell Side */}
          <View style={styles.paramCol}>
            <Text style={[styles.paramGroupTitle, { color: RED }]}>
              Shell Side (Hot — Condensation)
            </Text>
            {[
              { label: 'Liquid Density', value: `${inputs.condLiquidDensity} kg/m³` },
              { label: 'Vapor Density', value: `${inputs.condVaporDensity} kg/m³` },
              { label: 'Latent Heat', value: `${inputs.condLatentHeat} kJ/kg` },
              { label: 'Liquid Conductivity', value: `${inputs.condLiquidConductivity} W/(m·K)` },
              { label: 'Liquid Viscosity', value: `${inputs.condLiquidViscosity} Pa·s` },
              {
                label: inputs.condOrientation === 'vertical' ? 'Tube Length' : 'Tube OD',
                value: `${inputs.condDimension} m`,
              },
              { label: 'ΔT (Tsat − Twall)', value: `${inputs.condDeltaT} °C` },
              {
                label: 'Orientation',
                value: inputs.condOrientation === 'vertical' ? 'Vertical' : 'Horizontal',
              },
            ].map((row, i) => (
              <View
                key={i}
                style={
                  i % 2 === 0 ? styles.paramRow : { ...styles.paramRow, backgroundColor: LIGHT }
                }
              >
                <Text style={styles.paramLabel}>{row.label}</Text>
                <Text style={styles.paramValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tube wall & fouling */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.paramGroupTitle, { color: GRAY }]}>Tube Geometry &amp; Fouling</Text>
          <View style={styles.paramGrid}>
            {[
              { label: 'Tube Inner Diameter', value: `${inputs.tsTubeID} mm` },
              { label: 'Tube Outer Diameter', value: `${inputs.overallTubeOD} mm` },
              { label: 'Wall Conductivity', value: `${inputs.overallWallConductivity} W/(m·K)` },
              { label: 'Tube-side Fouling', value: `${inputs.overallTubeSideFouling} m²·K/W` },
              { label: 'Shell-side Fouling', value: `${inputs.overallShellSideFouling} m²·K/W` },
            ].map((row, i) => (
              <View key={i} style={{ flex: 1 }}>
                <View
                  style={
                    i % 2 === 0 ? styles.paramRow : { ...styles.paramRow, backgroundColor: LIGHT }
                  }
                >
                  <Text style={styles.paramLabel}>{row.label}</Text>
                  <Text style={styles.paramValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Thermal resistance breakdown */}
        <Text style={styles.sectionTitle}>Thermal Resistance Breakdown</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Resistance Component</Text>
          <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Value (m²·K/W)</Text>
          <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>% of Total</Text>
        </View>
        {resistanceRows.map((row, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.tableCell, { flex: 3 }]}>{row.label}</Text>
            <Text style={[styles.tableCell, { textAlign: 'right' }]}>{fmtR(row.value)}</Text>
            <Text style={[styles.tableCell, { textAlign: 'right' }]}>{row.pct.toFixed(1)}%</Text>
          </View>
        ))}
        <View style={[styles.tableRow, { backgroundColor: '#e8f5e9' }]}>
          <Text style={[styles.tableCellBold, { flex: 3 }]}>Total Resistance → U_o</Text>
          <Text style={[styles.tableCellBold, { textAlign: 'right' }]}>{fmtR(resTotal)}</Text>
          <Text style={[styles.tableCellBold, { textAlign: 'right' }]}>100%</Text>
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.notes}>
            <Text style={[styles.notesText, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>
              Notes
            </Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Vapour Toolbox — Heat Transfer Calculator</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
