/**
 * Three-Way Match List PDF Document Template
 *
 * React-PDF template for a tabular listing of three-way matches.
 * Used for exporting the filtered match list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ThreeWayMatch } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    orientation: 'landscape',
  },
  header: {
    marginBottom: 15,
    paddingBottom: 8,
    borderBottom: '2pt solid #1976d2',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 3,
  },
  documentTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 5,
    fontWeight: 'bold',
    borderBottom: '1pt solid #ccc',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: '0.5pt solid #e0e0e0',
    fontSize: 8,
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: '0.5pt solid #e0e0e0',
    fontSize: 8,
    backgroundColor: '#fafafa',
  },
  colMatch: { width: '9%' },
  colPO: { width: '9%' },
  colGR: { width: '9%' },
  colBill: { width: '9%' },
  colVendor: { width: '12%' },
  colPercent: { width: '7%' },
  colPOAmt: { width: '10%' },
  colInvAmt: { width: '10%' },
  colVariance: { width: '8%' },
  colStatus: { width: '9%' },
  colApproval: { width: '8%' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999',
  },
});

interface MatchListPDFDocumentProps {
  matches: ThreeWayMatch[];
}

export function MatchListPDFDocument({ matches }: MatchListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Vapour Toolbox</Text>
          <Text style={styles.documentTitle}>Three-Way Match Report</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {matches.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colMatch}>Match #</Text>
            <Text style={styles.colPO}>PO #</Text>
            <Text style={styles.colGR}>GR #</Text>
            <Text style={styles.colBill}>Bill #</Text>
            <Text style={styles.colVendor}>Vendor</Text>
            <Text style={styles.colPercent}>Match %</Text>
            <Text style={styles.colPOAmt}>PO Amount</Text>
            <Text style={styles.colInvAmt}>Invoice Amount</Text>
            <Text style={styles.colVariance}>Variance</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colApproval}>Approval</Text>
          </View>

          {/* Table Rows */}
          {matches.map((m, i) => (
            <View key={m.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colMatch}>{m.matchNumber || '-'}</Text>
              <Text style={styles.colPO}>{m.poNumber || '-'}</Text>
              <Text style={styles.colGR}>{m.grNumber || '-'}</Text>
              <Text style={styles.colBill}>{m.vendorBillNumber || '-'}</Text>
              <Text style={styles.colVendor}>{m.vendorName || '-'}</Text>
              <Text style={styles.colPercent}>{m.overallMatchPercentage.toFixed(1)}%</Text>
              <Text style={styles.colPOAmt}>{formatCurrency(m.poAmount)}</Text>
              <Text style={styles.colInvAmt}>{formatCurrency(m.invoiceAmount)}</Text>
              <Text style={styles.colVariance}>{formatCurrency(m.variance)}</Text>
              <Text style={styles.colStatus}>{m.status.replace(/_/g, ' ')}</Text>
              <Text style={styles.colApproval}>{m.approvalStatus?.replace(/_/g, ' ') || '-'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — Three-Way Match Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
