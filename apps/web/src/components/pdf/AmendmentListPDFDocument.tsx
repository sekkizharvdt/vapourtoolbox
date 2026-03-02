/**
 * PO Amendment List PDF Document Template
 *
 * React-PDF template for a tabular listing of PO amendments.
 * Used for exporting the filtered amendment list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrderAmendment } from '@vapour/types';
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
  colPO: { width: '12%' },
  colNum: { width: '7%' },
  colType: { width: '12%' },
  colReason: { width: '17%' },
  colPrevTotal: { width: '10%' },
  colNewTotal: { width: '10%' },
  colChange: { width: '10%' },
  colStatus: { width: '10%' },
  colRequester: { width: '12%' },
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

function formatAmendmentType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AmendmentListPDFDocumentProps {
  amendments: PurchaseOrderAmendment[];
}

export function AmendmentListPDFDocument({ amendments }: AmendmentListPDFDocumentProps) {
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
          <Text style={styles.documentTitle}>PO Amendments</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {amendments.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colPO}>PO Number</Text>
            <Text style={styles.colNum}>Amd #</Text>
            <Text style={styles.colType}>Type</Text>
            <Text style={styles.colReason}>Reason</Text>
            <Text style={styles.colPrevTotal}>Previous Total</Text>
            <Text style={styles.colNewTotal}>New Total</Text>
            <Text style={styles.colChange}>Value Change</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colRequester}>Requested By</Text>
          </View>

          {/* Table Rows */}
          {amendments.map((a, i) => (
            <View key={a.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colPO}>{a.purchaseOrderNumber || '-'}</Text>
              <Text style={styles.colNum}>{a.amendmentNumber}</Text>
              <Text style={styles.colType}>{formatAmendmentType(a.amendmentType)}</Text>
              <Text style={styles.colReason}>{a.reason || '-'}</Text>
              <Text style={styles.colPrevTotal}>{formatCurrency(a.previousGrandTotal)}</Text>
              <Text style={styles.colNewTotal}>{formatCurrency(a.newGrandTotal)}</Text>
              <Text style={styles.colChange}>{formatCurrency(a.totalChange)}</Text>
              <Text style={styles.colStatus}>{a.status.replace(/_/g, ' ')}</Text>
              <Text style={styles.colRequester}>{a.requestedByName || '-'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — PO Amendments</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
