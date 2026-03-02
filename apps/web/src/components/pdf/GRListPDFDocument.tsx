/**
 * Goods Receipt List PDF Document Template
 *
 * React-PDF template for a tabular listing of goods receipts.
 * Used for exporting the filtered GR list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { GoodsReceipt } from '@vapour/types';
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
  colPO: { width: '12%' },
  colProject: { width: '16%' },
  colStatus: { width: '12%' },
  colCondition: { width: '14%' },
  colIssues: { width: '10%' },
  colPayment: { width: '12%' },
  colDate: { width: '12%' },
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

interface GRListPDFDocumentProps {
  grs: GoodsReceipt[];
}

export function GRListPDFDocument({ grs }: GRListPDFDocumentProps) {
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
          <Text style={styles.documentTitle}>Goods Receipts</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {grs.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNumber}>GR Number</Text>
            <Text style={styles.colPO}>PO Number</Text>
            <Text style={styles.colProject}>Project</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colCondition}>Condition</Text>
            <Text style={styles.colIssues}>Has Issues</Text>
            <Text style={styles.colPayment}>Payment Approved</Text>
            <Text style={styles.colDate}>Inspection Date</Text>
          </View>

          {/* Table Rows */}
          {grs.map((gr, i) => (
            <View key={gr.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colNumber}>{gr.number}</Text>
              <Text style={styles.colPO}>{gr.poNumber || '-'}</Text>
              <Text style={styles.colProject}>{gr.projectName || '-'}</Text>
              <Text style={styles.colStatus}>{gr.status.replace(/_/g, ' ')}</Text>
              <Text style={styles.colCondition}>
                {gr.overallCondition?.replace(/_/g, ' ') || '-'}
              </Text>
              <Text style={styles.colIssues}>{gr.hasIssues ? 'Yes' : 'No'}</Text>
              <Text style={styles.colPayment}>{gr.approvedForPayment ? 'Yes' : 'No'}</Text>
              <Text style={styles.colDate}>{formatDate(gr.inspectionDate)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — Goods Receipts</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
