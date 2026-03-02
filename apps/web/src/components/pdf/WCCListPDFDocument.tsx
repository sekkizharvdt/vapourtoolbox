/**
 * Work Completion Certificate List PDF Document Template
 *
 * React-PDF template for a tabular listing of work completion certificates.
 * Used for exporting the filtered WCC list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { WorkCompletionCertificate } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

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
  colNumber: { width: '12%' },
  colPO: { width: '10%' },
  colVendor: { width: '14%' },
  colProject: { width: '14%' },
  colDate: { width: '10%' },
  colDelivered: { width: '10%' },
  colAccepted: { width: '10%' },
  colPayments: { width: '10%' },
  colIssuer: { width: '10%' },
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

interface WCCListPDFDocumentProps {
  wccs: WorkCompletionCertificate[];
}

export function WCCListPDFDocument({ wccs }: WCCListPDFDocumentProps) {
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
          <Text style={styles.documentTitle}>Work Completion Certificates</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {wccs.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNumber}>WCC Number</Text>
            <Text style={styles.colPO}>PO Number</Text>
            <Text style={styles.colVendor}>Vendor</Text>
            <Text style={styles.colProject}>Project</Text>
            <Text style={styles.colDate}>Completion Date</Text>
            <Text style={styles.colDelivered}>Items Delivered</Text>
            <Text style={styles.colAccepted}>Items Accepted</Text>
            <Text style={styles.colPayments}>Payments Complete</Text>
            <Text style={styles.colIssuer}>Issued By</Text>
          </View>

          {/* Table Rows */}
          {wccs.map((w, i) => (
            <View key={w.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colNumber}>{w.number || '-'}</Text>
              <Text style={styles.colPO}>{w.poNumber || '-'}</Text>
              <Text style={styles.colVendor}>{w.vendorName || '-'}</Text>
              <Text style={styles.colProject}>{w.projectName || '-'}</Text>
              <Text style={styles.colDate}>{formatDate(w.completionDate)}</Text>
              <Text style={styles.colDelivered}>{w.allItemsDelivered ? 'Yes' : 'No'}</Text>
              <Text style={styles.colAccepted}>{w.allItemsAccepted ? 'Yes' : 'No'}</Text>
              <Text style={styles.colPayments}>{w.allPaymentsCompleted ? 'Yes' : 'No'}</Text>
              <Text style={styles.colIssuer}>{w.issuedByName || '-'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — Work Completion Certificates</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
