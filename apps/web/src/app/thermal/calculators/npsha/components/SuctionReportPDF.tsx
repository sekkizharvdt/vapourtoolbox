/**
 * Suction System Design Report — PDF Document
 *
 * React-PDF template following the SiphonReportPDF pattern.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';
import { FLUID_TYPE_LABELS } from './types';
import type { SuctionReportInputs } from './SuctionResults';

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
  col15: { width: '15%', paddingHorizontal: 3 },
  col20: { width: '20%', paddingHorizontal: 3 },
  col25: { width: '25%', paddingHorizontal: 3 },
  col30: { width: '30%', paddingHorizontal: 3 },
  col40: { width: '40%', paddingHorizontal: 3 },
  col50: { width: '50%', paddingHorizontal: 3 },
  colRight: { textAlign: 'right' },
  colCenter: { textAlign: 'center' },
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

interface SuctionReportPDFProps {
  result: SuctionSystemResult;
  inputs: SuctionReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
}

export const SuctionReportPDF = ({
  result,
  inputs,
  documentNumber = 'SUCTION-001',
  revision = '0',
  projectName,
  notes,
}: SuctionReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType] || inputs.fluidType;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>MED SUCTION SYSTEM DESIGN</Text>
          <Text style={styles.subtitle}>CALCULATION REPORT</Text>
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

        {/* Primary Result Banner */}
        <View style={styles.primaryResult}>
          <View>
            <Text style={{ fontSize: 8, color: '#666' }}>Required Elevation</Text>
            <Text style={styles.primaryValue}>{fmt(result.requiredElevation)} m</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>NPSHa (Dirty)</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold' }}>
              {fmt(result.npshaDirty.npsha)} m
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Nozzle / Suction</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
              {result.nozzlePipe.nps}&quot; / {result.suctionPipe.nps}&quot;
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Margin</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: result.npshaDirty.isAdequate ? '#2e7d32' : '#c62828',
              }}
            >
              {result.npshaDirty.margin >= 0 ? '+' : ''}
              {fmt(result.npshaDirty.margin)} m
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
                  <Text style={styles.col50}>Effect Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {inputs.effectPressure} mbar(a)
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Fluid Type</Text>
                  <Text style={[styles.col50, styles.colRight]}>{fluidLabel}</Text>
                </View>
                {inputs.fluidType === 'brine' && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>Salinity</Text>
                    <Text style={[styles.col50, styles.colRight]}>{inputs.salinity} ppm</Text>
                  </View>
                )}
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Mass Flow Rate</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.flowRate} ton/hr</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Pump NPSHr</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.pumpNPSHr} m</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Safety Margin</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.safetyMargin} m</Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Nozzle Vel. Target</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {inputs.nozzleVelocityTarget} m/s
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Suction Vel. Target</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {inputs.suctionVelocityTarget} m/s
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>90° Elbows</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.elbowCount}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Vertical Run</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.verticalPipeRun} m</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Horizontal Run</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.horizontalPipeRun} m</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Pipe Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. PIPE SELECTION</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col20}>Function</Text>
              <Text style={styles.col15}>NPS</Text>
              <Text style={styles.col15}>DN</Text>
              <Text style={[styles.col15, styles.colRight]}>ID (mm)</Text>
              <Text style={[styles.col15, styles.colRight]}>OD (mm)</Text>
              <Text style={[styles.col20, styles.colRight]}>Velocity (m/s)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col20}>Nozzle</Text>
              <Text style={styles.col15}>{result.nozzlePipe.nps}&quot;</Text>
              <Text style={styles.col15}>{result.nozzlePipe.dn}</Text>
              <Text style={[styles.col15, styles.colRight]}>{fmt(result.nozzlePipe.id_mm, 1)}</Text>
              <Text style={[styles.col15, styles.colRight]}>{fmt(result.nozzlePipe.od_mm, 1)}</Text>
              <Text style={[styles.col20, styles.colRight]}>
                {fmt(result.nozzleVelocity, 3)} ({result.nozzleVelocityStatus})
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col20}>Suction</Text>
              <Text style={styles.col15}>{result.suctionPipe.nps}&quot;</Text>
              <Text style={styles.col15}>{result.suctionPipe.dn}</Text>
              <Text style={[styles.col15, styles.colRight]}>
                {fmt(result.suctionPipe.id_mm, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {fmt(result.suctionPipe.od_mm, 1)}
              </Text>
              <Text style={[styles.col20, styles.colRight]}>
                {fmt(result.suctionVelocity, 2)} ({result.suctionVelocityStatus})
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, color: '#666', marginTop: 3 }}>
            Reducer: Concentric ({result.reducer.largePipeNPS}&quot; to{' '}
            {result.reducer.smallPipeNPS}&quot;, Beta={fmt(result.reducer.beta, 3)}, K=
            {fmt(result.reducer.kFactor, 4)})
          </Text>
        </View>

        {/* 3. Fittings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. FITTINGS &amp; K-FACTORS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col40}>Fitting</Text>
              <Text style={[styles.col15, styles.colCenter]}>Count</Text>
              <Text style={[styles.col20, styles.colRight]}>K-factor</Text>
              <Text style={[styles.col25, styles.colRight]}>Loss (m H2O)</Text>
            </View>
            {result.fittings.map((f, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col40}>{f.name}</Text>
                <Text style={[styles.col15, styles.colCenter]}>{f.count}</Text>
                <Text style={[styles.col20, styles.colRight]}>{fmt(f.kFactor, 4)}</Text>
                <Text style={[styles.col25, styles.colRight]}>{fmt(f.loss, 4)}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 8, color: '#666', marginTop: 3 }}>
            Auto-selected: {result.valveType === 'gate' ? 'Gate' : 'Ball'} valve,{' '}
            {result.strainerType === 'bucket_type' ? 'Bucket' : 'Y-type'} strainer (NPS{' '}
            {result.suctionPipe.nps}&quot; threshold at 4&quot;)
          </Text>
        </View>

        {/* 4. Strainer Pressure Drop */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            4. STRAINER PRESSURE DROP — {result.strainerPressureDrop.strainerName.toUpperCase()}
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col30}>Condition</Text>
              <Text style={[styles.col20, styles.colRight]}>K-factor</Text>
              <Text style={[styles.col25, styles.colRight]}>Loss (m H2O)</Text>
              <Text style={[styles.col25, styles.colRight]}>Loss (mbar)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Clean</Text>
              <Text style={[styles.col20, styles.colRight]}>
                {result.strainerPressureDrop.cleanKFactor}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.strainerPressureDrop.cleanLoss, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.strainerPressureDrop.cleanLossMbar, 1)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Dirty</Text>
              <Text style={[styles.col20, styles.colRight]}>
                {result.strainerPressureDrop.dirtyKFactor}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.strainerPressureDrop.dirtyLoss, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.strainerPressureDrop.dirtyLossMbar, 1)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. NPSHa Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. NPSHa BREAKDOWN (CLEAN vs DIRTY)</Text>
          <Text style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>
            NPSHa = Hs + Hp - Hvp - Hf
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col30}>Component</Text>
              <Text style={[styles.col15, styles.colCenter]}>Sign</Text>
              <Text style={[styles.col25, styles.colRight]}>Clean (m)</Text>
              <Text style={[styles.col25, styles.colRight]}>Dirty (m)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Hs — Static head</Text>
              <Text style={[styles.col15, styles.colCenter]}>+</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaClean.staticHead, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaDirty.staticHead, 3)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Hp — Pressure head</Text>
              <Text style={[styles.col15, styles.colCenter]}>+</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaClean.pressureHead, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaDirty.pressureHead, 3)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Hvp — Vapor pressure</Text>
              <Text style={[styles.col15, styles.colCenter]}>-</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaClean.vaporPressureHead, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaDirty.vaporPressureHead, 3)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Hf — Friction loss</Text>
              <Text style={[styles.col15, styles.colCenter]}>-</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaClean.frictionLoss, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.npshaDirty.frictionLoss, 3)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.col30}>NPSHa</Text>
              <Text style={[styles.col15, styles.colCenter]}>=</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.npshaClean.npsha, 3)}</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.npshaDirty.npsha, 3)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col30}>Margin (NPSHa - NPSHr)</Text>
              <Text style={styles.col15} />
              <Text style={[styles.col25, styles.colRight]}>
                {result.npshaClean.margin >= 0 ? '+' : ''}
                {fmt(result.npshaClean.margin, 3)}
              </Text>
              <Text style={[styles.col25, styles.colRight]}>
                {result.npshaDirty.margin >= 0 ? '+' : ''}
                {fmt(result.npshaDirty.margin, 3)}
              </Text>
            </View>
          </View>
        </View>

        {/* 6. Holdup Volume & Elevation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. HOLDUP VOLUME &amp; ELEVATION</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Holdup Pipe</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {result.holdup.holdupPipeNPS}&quot; (ID {fmt(result.holdup.holdupPipeID, 1)} mm)
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>From Residence Time</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.holdup.heightFromResidenceTime, 2)} m
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>From Min Column</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.holdup.heightFromMinColumn, 2)} m
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.col50, styles.bold]}>Governing Height</Text>
                  <Text style={[styles.col50, styles.colRight, styles.bold]}>
                    {fmt(result.holdup.governingHeight, 2)} m
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Volume</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.holdup.holdupVolume, 1)} litres
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Holdup Height</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.elevationBreakdown.holdupHeight, 2)} m
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Additional for NPSHa</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.elevationBreakdown.additionalHeadRequired, 2)} m
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.col50}>Required Elevation</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.elevationBreakdown.total, 2)} m
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 7. Fluid Properties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. FLUID PROPERTIES</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Sat. Temperature</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.saturationTemperature, 1)} C
                  </Text>
                </View>
                {result.boilingPointElevation > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>BPE</Text>
                    <Text style={[styles.col50, styles.colRight]}>
                      {fmt(result.boilingPointElevation, 2)} C
                    </Text>
                  </View>
                )}
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Fluid Temperature</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidTemperature, 1)} C
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Density</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidDensity, 2)} kg/m3
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Viscosity</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidViscosity * 1000, 3)} mPa.s
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Vapor Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.vaporPressure * 1000, 1)} mbar
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <View style={styles.warning}>
            {result.warnings.map((w, i) => (
              <Text key={i} style={styles.warningText}>
                {'\u2022'} {w}
              </Text>
            ))}
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
          <Text>Generated by Vapour Toolbox | Suction System Designer</Text>
          <Text>
            Method: Darcy-Weisbach + Crane TP-410 | NPSHa: Hydraulic Institute | Steam Tables:
            IAPWS-IF97
          </Text>
          <Text style={{ marginTop: 4 }}>
            This is a computer-generated document for preliminary design purposes only.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
