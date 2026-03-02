/**
 * RFQ List PDF Document Template
 *
 * React-PDF template for a tabular listing of requests for quotation.
 * Used for exporting the filtered RFQ list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { RFQ } from '@vapour/types';
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
  colNumber: { width: '14%' },
  colTitle: { width: '20%' },
  colVendors: { width: '16%' },
  colStatus: { width: '10%' },
  colOffers: { width: '10%' },
  colDueDate: { width: '10%' },
  colCreatedBy: { width: '10%' },
  colDate: { width: '10%' },
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

interface RFQListPDFDocumentProps {
  rfqs: RFQ[];
}

export function RFQListPDFDocument({ rfqs }: RFQListPDFDocumentProps) {
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
          <Text style={styles.documentTitle}>Requests for Quotation</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {rfqs.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNumber}>RFQ Number</Text>
            <Text style={styles.colTitle}>Title</Text>
            <Text style={styles.colVendors}>Vendors</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colOffers}>Offers Received</Text>
            <Text style={styles.colDueDate}>Due Date</Text>
            <Text style={styles.colCreatedBy}>Created By</Text>
            <Text style={styles.colDate}>Created Date</Text>
          </View>

          {/* Table Rows */}
          {rfqs.map((r, i) => (
            <View key={r.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colNumber}>{r.number}</Text>
              <Text style={styles.colTitle}>{r.title || '-'}</Text>
              <Text style={styles.colVendors}>{r.vendorNames?.join(', ') || '-'}</Text>
              <Text style={styles.colStatus}>{r.status.replace(/_/g, ' ')}</Text>
              <Text style={styles.colOffers}>{String(r.offersReceived ?? 0)}</Text>
              <Text style={styles.colDueDate}>{formatDate(r.dueDate)}</Text>
              <Text style={styles.colCreatedBy}>{r.createdByName || '-'}</Text>
              <Text style={styles.colDate}>{formatDate(r.createdAt)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — Requests for Quotation</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
