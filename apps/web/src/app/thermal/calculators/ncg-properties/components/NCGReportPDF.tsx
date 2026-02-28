/**
 * NCG Properties Calculation Report — PDF Document
 *
 * React-PDF template following the SiphonReportPDF pattern.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { NCGResult, NCGInputMode } from '@/lib/thermal/ncgCalculator';

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
  totalRow: {
    flexDirection: 'row',
    borderTop: '1.5pt solid #333',
    paddingVertical: 3,
    fontWeight: 'bold',
  },
  col20: { width: '20%', paddingHorizontal: 3 },
  col25: { width: '25%', paddingHorizontal: 3 },
  col30: { width: '30%', paddingHorizontal: 3 },
  col35: { width: '35%', paddingHorizontal: 3 },
  col40: { width: '40%', paddingHorizontal: 3 },
  col50: { width: '50%', paddingHorizontal: 3 },
  col60: { width: '60%', paddingHorizontal: 3 },
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

export interface NCGReportInputs {
  mode: NCGInputMode;
  temperatureC: string;
  pressureBar: string;
  useSatPressure: boolean;
  // Seawater mode
  seawaterFlowM3h?: string;
  seawaterTempC?: string;
  salinityGkg?: string;
  // Dry NCG mode
  dryNcgFlowKgH?: string;
  // Wet NCG mode
  wetNcgFlowKgH?: string;
  // Split flows mode
  splitNcgFlowKgH?: string;
  splitVapourFlowKgH?: string;
}

interface NCGReportPDFProps {
  result: NCGResult;
  inputs: NCGReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const MODE_LABELS: Record<NCGInputMode, string> = {
  seawater: 'Seawater Feed',
  dry_ncg: 'Dry NCG Flow',
  wet_ncg: 'Wet NCG Flow',
  split_flows: 'NCG + Vapour Split',
};

export const NCGReportPDF = ({
  result,
  inputs,
  documentNumber = 'NCG-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: NCGReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const pressureLabel =
    inputs.mode === 'split_flows'
      ? 'Derived from flow rates (Dalton\u2019s law)'
      : inputs.useSatPressure
        ? `${inputs.pressureBar} bar (NCG partial pressure above P_sat)`
        : `${inputs.pressureBar} bar abs (total)`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.title}>NCG PROPERTIES CALCULATION</Text>
            <Text style={styles.subtitle}>Non-Condensable Gas + Water Vapour Mixture</Text>
            {projectName && <Text style={styles.subtitle}>{projectName}</Text>}
            <View style={styles.headerRow}>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Doc No:</Text>
                <Text>{documentNumber}</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Rev:</Text>
                <Text>{revision}</Text>
              </View>
              <View style={styles.headerItem}>
                <Text style={styles.headerLabel}>Date:</Text>
                <Text>{today}</Text>
              </View>
            </View>
          </View>
          {logoDataUri && <View style={{ width: 50, marginLeft: 12 }} />}
        </View>

        {/* Primary Result Banner */}
        <View style={styles.primaryResult}>
          <View>
            <Text style={{ fontSize: 8, color: '#666' }}>Temperature</Text>
            <Text style={styles.primaryValue}>{fmt(result.temperatureC, 1)} °C</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Total Pressure</Text>
            <Text style={styles.primaryValue}>{fmt(result.totalPressureBar, 4)} bar</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Density</Text>
            <Text style={styles.primaryValue}>{fmt(result.density, 4)} kg/m³</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>NCG Partial Pressure</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
              {fmt(result.ncgPartialPressureBar, 4)} bar
            </Text>
          </View>
        </View>

        {/* 1. Input Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. INPUT PARAMETERS</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Input Mode</Text>
                  <Text style={[styles.col50, styles.colRight]}>{MODE_LABELS[inputs.mode]}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Temperature</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.temperatureC} °C</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Pressure Input</Text>
                  <Text style={[styles.col50, styles.colRight]}>{pressureLabel}</Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                {inputs.mode === 'seawater' && (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.col50}>Seawater Flow</Text>
                      <Text style={[styles.col50, styles.colRight]}>
                        {inputs.seawaterFlowM3h} m³/h
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.col50}>SW Inlet Temperature</Text>
                      <Text style={[styles.col50, styles.colRight]}>{inputs.seawaterTempC} °C</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.col50}>Salinity</Text>
                      <Text style={[styles.col50, styles.colRight]}>{inputs.salinityGkg} g/kg</Text>
                    </View>
                  </>
                )}
                {inputs.mode === 'dry_ncg' && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>Dry NCG Flow</Text>
                    <Text style={[styles.col50, styles.colRight]}>{inputs.dryNcgFlowKgH} kg/h</Text>
                  </View>
                )}
                {inputs.mode === 'wet_ncg' && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>Total (Wet) Gas Flow</Text>
                    <Text style={[styles.col50, styles.colRight]}>{inputs.wetNcgFlowKgH} kg/h</Text>
                  </View>
                )}
                {inputs.mode === 'split_flows' && (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.col50}>Dry NCG Flow (input)</Text>
                      <Text style={[styles.col50, styles.colRight]}>
                        {inputs.splitNcgFlowKgH} kg/h
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.col50}>Water Vapour Flow (input)</Text>
                      <Text style={[styles.col50, styles.colRight]}>
                        {inputs.splitVapourFlowKgH} kg/h
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 2. System Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. SYSTEM CONDITIONS</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Total Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.totalPressureBar, 5)} bar abs
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Saturation Pressure P_sat(T)</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.satPressureBar, 5)} bar
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Water Vapour Partial P</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.waterVapourPartialPressureBar, 5)} bar
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>NCG Partial Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.ncgPartialPressureBar, 5)} bar
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Mixture Composition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. MIXTURE COMPOSITION</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col35}>Component</Text>
              <Text style={[styles.col25, styles.colRight]}>Mole Fraction</Text>
              <Text style={[styles.col25, styles.colRight]}>Mass Fraction</Text>
              <Text style={[styles.col25, styles.colRight]}>Partial P (bar)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col35}>Water Vapour (H₂O)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.waterVapourMoleFrac, 4)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.waterVapourMassFrac, 4)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.waterVapourPartialPressureBar, 5)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col35}>NCG (Dry Air)</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.ncgMoleFrac, 4)}</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.ncgMassFrac, 4)}</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.ncgPartialPressureBar, 5)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.col35}>Mixture Molar Mass</Text>
              <Text style={[styles.col25, styles.colRight]}>—</Text>
              <Text style={[styles.col25, styles.colRight]}>—</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.mixMolarMass, 3)} g/mol
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Thermodynamic Properties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. THERMODYNAMIC PROPERTIES</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Density (ρ)</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.density, 5)} kg/m³
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Specific Volume (v)</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.specificVolume, 4)} m³/kg
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Specific Enthalpy (h_mix)</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.specificEnthalpy, 2)} kJ/kg
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}> └ Vapour enthalpy (h_g)</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.vaporEnthalpy, 2)} kJ/kg
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}> └ Air enthalpy (Cp·T)</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.airEnthalpy, 2)} kJ/kg
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Spec. Heat Cp</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.cpMix, 4)} kJ/(kg·K)
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Spec. Heat Cv</Text>
                  <Text style={[styles.col40, styles.colRight]}>
                    {fmt(result.cvMix, 4)} kJ/(kg·K)
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col60}>Heat Ratio γ (Cp/Cv)</Text>
                  <Text style={[styles.col40, styles.colRight]}>{fmt(result.gammaMix, 4)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Transport Properties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. TRANSPORT PROPERTIES</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Dynamic Viscosity (μ)</Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(result.dynamicViscosityPas * 1e6, 3)} μPa·s
              </Text>
              <Text style={[styles.col20, styles.colRight]}>Wilke mixing rule</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Thermal Conductivity (λ)</Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(result.thermalConductivityWmK * 1000, 3)} mW/(m·K)
              </Text>
              <Text style={[styles.col20, styles.colRight]}>Wassiljewa–M.S.</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Prandtl Number (Pr)</Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(
                  (result.cpMix * 1000 * result.dynamicViscosityPas) /
                    result.thermalConductivityWmK,
                  3
                )}
              </Text>
              <Text style={[styles.col20, styles.colRight]}>—</Text>
            </View>
          </View>
        </View>

        {/* 6. Flow Breakdown (conditional) */}
        {result.totalFlowKgH !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. FLOW BREAKDOWN</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col50}>Stream</Text>
                <Text style={[styles.col25, styles.colRight]}>Flow (kg/h)</Text>
                <Text style={[styles.col25, styles.colRight]}>Note</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col50}>Dry NCG (Air)</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.dryNcgFlowKgH ?? 0, 4)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt((result.ncgMassFrac ?? 0) * 100, 1)}% by mass
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col50}>Water Vapour</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.waterVapourFlowKgH ?? 0, 4)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt((result.waterVapourMassFrac ?? 0) * 100, 1)}% by mass
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.col50}>Total (Wet)</Text>
                <Text style={[styles.col25, styles.colRight]}>{fmt(result.totalFlowKgH, 4)}</Text>
                <Text style={[styles.col25, styles.colRight]}>kg/h</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col50}>Volumetric Flow at T, P</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.volumetricFlowM3h ?? 0, 3)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>m³/h</Text>
              </View>
            </View>
          </View>
        )}

        {/* 7. Dissolved Gas Content (seawater mode only) */}
        {result.seawaterInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              7. DISSOLVED GAS CONTENT — Weiss (1970) at {fmt(result.seawaterInfo.gasTempC, 1)} °C,{' '}
              {result.seawaterInfo.salinityGkg} g/kg
              {result.seawaterInfo.extrapolated ? ' [EXTRAPOLATED — outside valid range]' : ''}
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col25}>Gas</Text>
                <Text style={[styles.col25, styles.colRight]}>mL(STP)/L</Text>
                <Text style={[styles.col25, styles.colRight]}>mg/L</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col25}>O₂</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {result.seawaterInfo.o2MlL.toExponential(3)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.seawaterInfo.o2MgL, 3)}
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col25}>N₂</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {result.seawaterInfo.n2MlL.toExponential(3)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.seawaterInfo.n2MgL, 3)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.col25}>Total</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {(result.seawaterInfo.o2MlL + result.seawaterInfo.n2MlL).toExponential(3)}
                </Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.seawaterInfo.totalGasMgL, 3)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {notes && (
          <View style={styles.noteSection}>
            <Text style={styles.noteTitle}>NOTES:</Text>
            <Text style={styles.noteText}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated by Vapour Toolbox | NCG Properties Calculator</Text>
          <Text>
            Methods: Dalton&apos;s Law (Ideal Gas) | Dissolved Gas: Weiss (1970) | Viscosity: Wilke
            (1950) | Conductivity: Wassiljewa–Mason–Saxena | Steam: IAPWS-IF97
          </Text>
          <Text style={{ marginTop: 4 }}>
            This is a computer-generated document for preliminary design purposes only.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
