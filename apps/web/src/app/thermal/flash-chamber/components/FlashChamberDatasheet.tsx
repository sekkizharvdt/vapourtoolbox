/**
 * Flash Chamber Datasheet PDF Document
 *
 * React-PDF template for flash evaporation chamber process datasheet
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { FlashChamberResult } from '@vapour/types';

// Styles for the datasheet
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
    marginBottom: 8,
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
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
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
    paddingVertical: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1pt solid #ccc',
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  col25: { width: '25%', paddingHorizontal: 4 },
  col20: { width: '20%', paddingHorizontal: 4 },
  col15: { width: '15%', paddingHorizontal: 4 },
  col12: { width: '12%', paddingHorizontal: 4 },
  col10: { width: '10%', paddingHorizontal: 4 },
  col40: { width: '40%', paddingHorizontal: 4 },
  col50: { width: '50%', paddingHorizontal: 4 },
  colRight: { textAlign: 'right' },
  colCenter: { textAlign: 'center' },
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
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
  warning: {
    backgroundColor: '#fff3e0',
    padding: 6,
    marginTop: 4,
    fontSize: 8,
  },
  warningText: {
    color: '#e65100',
  },
  bold: {
    fontWeight: 'bold',
  },
  noteSection: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fafafa',
    border: '0.5pt solid #e0e0e0',
  },
  noteTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 8,
    lineHeight: 1.4,
  },
});

interface FlashChamberDatasheetProps {
  result: FlashChamberResult;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
}

export const FlashChamberDatasheet = ({
  result,
  documentNumber = 'FC-DS-001',
  revision = '0',
  projectName,
  notes,
}: FlashChamberDatasheetProps) => {
  const { inputs, heatMassBalance, chamberSizing, nozzles, npsha, elevations, warnings } = result;

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatElevation = (value: number) => formatNumber(value, 3);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FLASH EVAPORATION CHAMBER</Text>
          <Text style={styles.subtitle}>PROCESS DATASHEET</Text>
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

        {/* Process Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. PROCESS CONDITIONS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col40}>Parameter</Text>
              <Text style={[styles.col25, styles.colRight]}>Value</Text>
              <Text style={styles.col20}>Unit</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Operating Pressure</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(inputs.operatingPressure, 0)}
              </Text>
              <Text style={styles.col20}>mbar abs</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Saturation Temperature</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.temperature, 1)}
              </Text>
              <Text style={styles.col20}>°C</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Water Type</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {inputs.waterType === 'SEAWATER' ? 'Seawater' : 'DM Water'}
              </Text>
              <Text style={styles.col20}>-</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Salinity (Inlet)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(inputs.salinity, 0)}
              </Text>
              <Text style={styles.col20}>ppm</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Retention Time</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(inputs.retentionTime, 1)}
              </Text>
              <Text style={styles.col20}>minutes</Text>
            </View>
          </View>
        </View>

        {/* Heat & Mass Balance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. HEAT & MASS BALANCE</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col25}>Stream</Text>
              <Text style={[styles.col15, styles.colRight]}>Flow Rate</Text>
              <Text style={[styles.col12, styles.colRight]}>Temp</Text>
              <Text style={[styles.col15, styles.colRight]}>Pressure</Text>
              <Text style={[styles.col15, styles.colRight]}>Enthalpy</Text>
              <Text style={[styles.col15, styles.colRight]}>Heat Duty</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={styles.col25}></Text>
              <Text style={[styles.col15, styles.colRight]}>ton/hr</Text>
              <Text style={[styles.col12, styles.colRight]}>°C</Text>
              <Text style={[styles.col15, styles.colRight]}>mbar abs</Text>
              <Text style={[styles.col15, styles.colRight]}>kJ/kg</Text>
              <Text style={[styles.col15, styles.colRight]}>kW</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col25}>{heatMassBalance.inlet.stream}</Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.inlet.flowRate, 2)}
              </Text>
              <Text style={[styles.col12, styles.colRight]}>
                {formatNumber(heatMassBalance.inlet.temperature, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.inlet.pressure, 0)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.inlet.enthalpy, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.inlet.heatDuty, 0)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col25}>{heatMassBalance.vapor.stream}</Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.flowRate, 3)}
              </Text>
              <Text style={[styles.col12, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.temperature, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.pressure, 0)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.enthalpy, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.vapor.heatDuty, 0)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col25}>{heatMassBalance.brine.stream}</Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.brine.flowRate, 2)}
              </Text>
              <Text style={[styles.col12, styles.colRight]}>
                {formatNumber(heatMassBalance.brine.temperature, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.brine.pressure, 0)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.brine.enthalpy, 1)}
              </Text>
              <Text style={[styles.col15, styles.colRight]}>
                {formatNumber(heatMassBalance.brine.heatDuty, 0)}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, marginTop: 4, color: '#666' }}>
            Heat Balance Error: {formatNumber(heatMassBalance.balanceError, 2)}% (
            {heatMassBalance.isBalanced ? 'OK' : 'Check'})
          </Text>
        </View>

        {/* Chamber Dimensions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. CHAMBER DIMENSIONS</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Inside Diameter</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.diameter, 0)}
                  </Text>
                  <Text style={styles.col25}>mm</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Total Height (T/T)</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.totalHeight, 0)}
                  </Text>
                  <Text style={styles.col25}>mm</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Spray Zone Height</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.sprayZoneHeight, 0)}
                  </Text>
                  <Text style={styles.col25}>mm</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Flashing Zone Height</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.flashingZoneHeight, 0)}
                  </Text>
                  <Text style={styles.col25}>mm</Text>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Retention Zone Height</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.retentionZoneHeight, 0)}
                  </Text>
                  <Text style={styles.col25}>mm</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Cross-section Area</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.crossSectionArea, 2)}
                  </Text>
                  <Text style={styles.col25}>m²</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Total Volume</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.totalVolume, 2)}
                  </Text>
                  <Text style={styles.col25}>m³</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.col50}>Liquid Holdup</Text>
                  <Text style={[styles.col25, styles.colRight]}>
                    {formatNumber(chamberSizing.liquidHoldupVolume, 2)}
                  </Text>
                  <Text style={styles.col25}>m³</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Elevation Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. ELEVATION SCHEDULE</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col40}>Description</Text>
              <Text style={[styles.col25, styles.colRight]}>Elevation</Text>
              <Text style={styles.col25}>Notes</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Top Tangent Line (TTL)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                EL {formatElevation(elevations.ttl)} m
              </Text>
              <Text style={styles.col25}>Top of chamber</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Flashing Zone Top</Text>
              <Text style={[styles.col25, styles.colRight]}>
                EL {formatElevation(elevations.flashingZoneTop)} m
              </Text>
              <Text style={styles.col25}>-</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Level Gauge High (LG-H)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                EL {formatElevation(elevations.lgHigh)} m
              </Text>
              <Text style={styles.col25}>Max operating level</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Level Gauge Low (LG-L)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                EL {formatElevation(elevations.lgLow)} m
              </Text>
              <Text style={styles.col25}>Min operating level</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Bottom Tangent Line (BTL)</Text>
              <Text style={[styles.col25, styles.colRight]}>EL 0.000 m</Text>
              <Text style={styles.col25}>Reference datum</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col40}>Pump Centerline</Text>
              <Text style={[styles.col25, styles.colRight]}>
                EL {formatElevation(elevations.pumpCenterline)} m
              </Text>
              <Text style={styles.col25}>Below BTL</Text>
            </View>
          </View>
        </View>

        {/* Nozzle Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. NOZZLE SCHEDULE</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col10}>Tag</Text>
              <Text style={styles.col25}>Service</Text>
              <Text style={styles.col15}>Size</Text>
              <Text style={[styles.col15, styles.colRight]}>Elevation</Text>
              <Text style={[styles.col15, styles.colRight]}>Velocity</Text>
              <Text style={styles.col15}>Status</Text>
            </View>
            {nozzles.map((nozzle, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.col10}>N{idx + 1}</Text>
                <Text style={styles.col25}>{nozzle.name}</Text>
                <Text style={styles.col15}>{nozzle.nps}</Text>
                <Text style={[styles.col15, styles.colRight]}>
                  {nozzle.type === 'inlet' &&
                    `EL ${formatElevation(elevations.nozzleElevations.inlet)} m`}
                  {nozzle.type === 'vapor' &&
                    `EL ${formatElevation(elevations.nozzleElevations.vaporOutlet)} m`}
                  {nozzle.type === 'outlet' &&
                    `EL ${formatElevation(elevations.nozzleElevations.brineOutlet)} m`}
                </Text>
                <Text style={[styles.col15, styles.colRight]}>
                  {formatNumber(nozzle.actualVelocity, 1)} m/s
                </Text>
                <Text style={styles.col15}>{nozzle.velocityStatus}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* NPSHa Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. NPSHa CALCULATION</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Static Head (liquid above pump)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(npsha.staticHead, 2)}
              </Text>
              <Text style={styles.col25}>m</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Chamber Pressure Head</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(npsha.chamberPressureHead, 2)}
              </Text>
              <Text style={styles.col25}>m</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Vapor Pressure Head (-)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(npsha.vaporPressureHead, 2)}
              </Text>
              <Text style={styles.col25}>m</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col50}>Friction Loss (estimated) (-)</Text>
              <Text style={[styles.col25, styles.colRight]}>
                {formatNumber(npsha.frictionLoss, 2)}
              </Text>
              <Text style={styles.col25}>m</Text>
            </View>
            <View style={[styles.tableRow, { backgroundColor: '#e8f5e9' }]}>
              <Text style={[styles.col50, styles.bold]}>NPSHa Available</Text>
              <Text style={[styles.col25, styles.colRight, styles.bold]}>
                {formatNumber(npsha.npshAvailable, 2)}
              </Text>
              <Text style={styles.col25}>m</Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, marginTop: 6, fontStyle: 'italic' }}>
            {npsha.recommendation}
          </Text>
        </View>

        {/* Warnings */}
        {warnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. WARNINGS & NOTES</Text>
            <View style={styles.warning}>
              {warnings.map((warning, idx) => (
                <Text key={idx} style={styles.warningText}>
                  • {warning}
                </Text>
              ))}
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
          <Text>
            Generated by Vapour Toolbox | Flash Chamber Calculator v
            {result.metadata?.calculatorVersion || '1.0.0'}
          </Text>
          <Text>
            Steam Tables: {result.metadata?.steamTableSource || 'IAPWS-IF97'} | Seawater Properties:{' '}
            {result.metadata?.seawaterSource || 'MIT'}
          </Text>
          <Text style={{ marginTop: 4 }}>
            This is a computer-generated document for preliminary design purposes only.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
