/**
 * Siphon Sizing Calculation Report — PDF Document
 *
 * React-PDF template following the FlashChamberDatasheet pattern.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import { FITTING_NAMES, type FittingType } from '@/lib/thermal/pressureDropCalculator';
import { ELBOW_CONFIG_LABELS, FLUID_TYPE_LABELS, PRESSURE_UNIT_LABELS } from './types';

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
  diagramImage: {
    maxWidth: '85%',
    maxHeight: 220,
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

export interface SiphonReportInputs {
  upstreamPressure: string;
  downstreamPressure: string;
  pressureUnit: string;
  fluidType: string;
  salinity: string;
  flowRate: string;
  targetVelocity: string;
  pipeSchedule: string;
  elbowConfig: string;
  horizontalDistance: string;
  offsetDistance: string;
  safetyFactor: string;
}

interface SiphonReportPDFProps {
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
  diagramImageUri?: string;
}

export const SiphonReportPDF = ({
  result,
  inputs,
  documentNumber = 'SIPHON-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
  diagramImageUri,
}: SiphonReportPDFProps) => {
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

  const unitLabel = PRESSURE_UNIT_LABELS[inputs.pressureUnit] || inputs.pressureUnit;
  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType] || inputs.fluidType;
  const elbowLabel = ELBOW_CONFIG_LABELS[inputs.elbowConfig] || inputs.elbowConfig;
  const scheduleLabel = `Sch ${inputs.pipeSchedule || '40'}`;
  const safetyPct = (
    (result.safetyMargin / (result.staticHead + result.frictionHead)) *
    100
  ).toFixed(0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
          <View style={styles.headerText}>
            <Text style={styles.title}>SIPHON SIZING CALCULATION</Text>
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
          {/* Balancing spacer so title centres on the page when logo is present */}
          {logoDataUri && <View style={{ width: 50, marginLeft: 12 }} />}
        </View>

        {/* Primary Result Banner */}
        <View style={styles.primaryResult}>
          <View>
            <Text style={{ fontSize: 8, color: '#666' }}>Selected Pipe</Text>
            <Text style={styles.primaryValue}>
              {result.pipe.nps}&quot; {scheduleLabel} (DN{result.pipe.dn})
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Min. Siphon Height</Text>
            <Text style={styles.primaryValue}>{fmt(result.minimumHeight, 3)} m</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: '#666' }}>Velocity</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
              {fmt(result.velocity)} m/s ({result.velocityStatus})
            </Text>
          </View>
        </View>

        {/* Siphon Arrangement Diagram */}
        {diagramImageUri && (
          <View style={styles.diagramSection}>
            <Text style={styles.sectionTitle}>SIPHON ARRANGEMENT</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            <Image src={diagramImageUri} style={styles.diagramImage} />
          </View>
        )}

        {/* 1. Input Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. INPUT PARAMETERS</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Upstream Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {inputs.upstreamPressure} {unitLabel}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Downstream Pressure</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {inputs.downstreamPressure} {unitLabel}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Pressure Difference</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.pressureDiffBar * 1000, 1)} mbar ({fmt(result.pressureDiffBar, 4)}{' '}
                    bar)
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Fluid Type</Text>
                  <Text style={[styles.col50, styles.colRight]}>{fluidLabel}</Text>
                </View>
                {(inputs.fluidType === 'seawater' || inputs.fluidType === 'brine') && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>Salinity</Text>
                    <Text style={[styles.col50, styles.colRight]}>{inputs.salinity} ppm</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Mass Flow Rate</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.flowRate} ton/hr</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Target Velocity</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.targetVelocity} m/s</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Elbow Configuration</Text>
                  <Text style={[styles.col50, styles.colRight]}>{elbowLabel}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Horizontal Distance</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.horizontalDistance} m</Text>
                </View>
                {inputs.elbowConfig !== '2_elbows' && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>Offset Distance</Text>
                    <Text style={[styles.col50, styles.colRight]}>{inputs.offsetDistance} m</Text>
                  </View>
                )}
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Safety Factor</Text>
                  <Text style={[styles.col50, styles.colRight]}>{inputs.safetyFactor}%</Text>
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
              <Text style={styles.col20}>NPS</Text>
              <Text style={styles.col15}>DN</Text>
              <Text style={[styles.col15, styles.colRight]}>OD (mm)</Text>
              <Text style={[styles.col15, styles.colRight]}>ID (mm)</Text>
              <Text style={[styles.col15, styles.colRight]}>WT (mm)</Text>
              <Text style={[styles.col20, styles.colRight]}>Velocity (m/s)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col20}>
                {result.pipe.nps}&quot; {scheduleLabel}
              </Text>
              <Text style={styles.col15}>{result.pipe.dn}</Text>
              <Text style={[styles.col15, styles.colRight]}>{fmt(result.pipe.od_mm, 1)}</Text>
              <Text style={[styles.col15, styles.colRight]}>{fmt(result.pipe.id_mm, 1)}</Text>
              <Text style={[styles.col15, styles.colRight]}>{fmt(result.pipe.wt_mm, 2)}</Text>
              <Text style={[styles.col20, styles.colRight]}>
                {fmt(result.velocity)} ({result.velocityStatus})
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Siphon Height Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. SIPHON HEIGHT BREAKDOWN</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col50}>Component</Text>
              <Text style={[styles.col25, styles.colRight]}>Value (m)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Static head (dP / rho.g)</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.staticHead, 3)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Friction losses (pipe + fittings)</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.frictionHead, 3)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Safety margin ({safetyPct}%)</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.safetyMargin, 3)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.col50}>Minimum Siphon Height</Text>
              <Text style={[styles.col25, styles.colRight]}>{fmt(result.minimumHeight, 3)}</Text>
            </View>
          </View>
        </View>

        {/* 4. Pressure Drop Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. PRESSURE DROP DETAILS</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={{ marginRight: 20 }}>
              <Text style={styles.bold}>Re: </Text>
              {fmt(result.pressureDrop.reynoldsNumber, 0)}
            </Text>
            <Text style={{ marginRight: 20 }}>
              <Text style={styles.bold}>Regime: </Text>
              {result.pressureDrop.flowRegime}
            </Text>
            <Text>
              <Text style={styles.bold}>f: </Text>
              {result.pressureDrop.frictionFactor.toFixed(5)}
            </Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col40}>Component</Text>
              <Text style={[styles.col30, styles.colRight]}>m H2O</Text>
              <Text style={[styles.col30, styles.colRight]}>mbar</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Straight pipe ({fmt(result.totalPipeLength, 1)} m)</Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(result.pressureDrop.straightPipeLoss, 3)}
              </Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt((result.pressureDrop.straightPipeLoss * result.fluidDensity * 9.81) / 100, 1)}
              </Text>
            </View>
            {result.pressureDrop.fittingsBreakdown.map((f, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col40}>
                  {FITTING_NAMES[f.type as FittingType]} x {f.count} (K={f.kFactor})
                </Text>
                <Text style={[styles.col30, styles.colRight]}>{fmt(f.loss, 3)}</Text>
                <Text style={[styles.col30, styles.colRight]}>
                  {fmt((f.loss * result.fluidDensity * 9.81) / 100, 1)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.col40}>Total</Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(result.pressureDrop.totalPressureDropMH2O, 3)}
              </Text>
              <Text style={[styles.col30, styles.colRight]}>
                {fmt(result.pressureDrop.totalPressureDropMbar, 1)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Flash Vapor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. FLASH VAPOR AT DOWNSTREAM EFFECT</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Downstream Saturation Temp</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {fmt(result.downstreamSatTemp, 1)} °C
              </Text>
            </View>
            {result.downstreamSatTemp !== result.downstreamSatTempPure && (
              <View style={styles.tableRow}>
                <Text style={styles.col50}>Pure Saturation Temp</Text>
                <Text style={[styles.col25, styles.colRight]}>
                  {fmt(result.downstreamSatTempPure, 1)} °C
                </Text>
              </View>
            )}
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Flash Occurs</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {result.flashOccurs ? 'Yes' : 'No'}
              </Text>
            </View>
            {result.flashOccurs && (
              <>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Flash Vapor Fraction</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {fmt(result.flashVaporFraction * 100, 2)}%
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Vapor Flow</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {fmt(result.flashVaporFlow, 3)} ton/hr
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Liquid After Flash</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {fmt(result.liquidFlowAfterFlash, 3)} ton/hr
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 6. Fluid Properties & Geometry */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. FLUID PROPERTIES &amp; GEOMETRY</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Fluid Temperature</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidTemperature, 1)} °C
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Density</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidDensity, 2)} kg/m³
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Viscosity</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.fluidViscosity * 1000, 3)} mPa·s
                  </Text>
                </View>
                {result.upstreamSatTempPure !== result.fluidTemperature && (
                  <View style={styles.tableRow}>
                    <Text style={styles.col50}>BPE</Text>
                    <Text style={[styles.col50, styles.colRight]}>
                      {fmt(result.fluidTemperature - result.upstreamSatTempPure, 2)} °C
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Elbows</Text>
                  <Text style={[styles.col50, styles.colRight]}>{result.elbowCount}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Total Pipe Length</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {fmt(result.totalPipeLength, 1)} m
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Holdup Volume</Text>
                  <Text style={[styles.col50, styles.colRight]}>
                    {result.holdupVolumeLiters >= 1000
                      ? `${fmt(result.holdupVolumeLiters / 1000, 2)} m³`
                      : `${fmt(result.holdupVolumeLiters, 1)} L`}
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
                - {w}
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
          <Text>Generated by Vapour Toolbox | Siphon Sizing Calculator</Text>
          <Text>
            Method: Darcy-Weisbach | Steam Tables: IAPWS-IF97 | Seawater Properties: Sharqawy et al.
            (2010)
          </Text>
          <Text style={{ marginTop: 4 }}>
            This is a computer-generated document for preliminary design purposes only.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
