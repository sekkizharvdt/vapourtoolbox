/**
 * Purchase Order List PDF Document Template
 *
 * React-PDF template for a tabular listing of purchase orders.
 * Used for exporting the filtered PO list from the list page.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrder } from '@vapour/types';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';

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
  colTitle: { width: '18%' },
  colVendor: { width: '16%' },
  colStatus: { width: '12%' },
  colAmount: { width: '14%' },
  colDelivery: { width: '12%' },
  colDate: { width: '14%' },
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

function getDeliveryStatus(deliveryProgress: number): string {
  if (deliveryProgress >= 100) return 'Delivered';
  if (deliveryProgress > 0) return 'In Progress';
  return 'Pending';
}

interface POListPDFDocumentProps {
  pos: PurchaseOrder[];
}

export function POListPDFDocument({ pos }: POListPDFDocumentProps) {
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
          <Text style={styles.documentTitle}>Purchase Orders</Text>
          <Text style={styles.subtitle}>
            Generated on {generatedAt} — {pos.length} record(s)
          </Text>
        </View>

        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNumber}>PO Number</Text>
            <Text style={styles.colTitle}>Title</Text>
            <Text style={styles.colVendor}>Vendor</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colAmount}>Amount</Text>
            <Text style={styles.colDelivery}>Delivery Status</Text>
            <Text style={styles.colDate}>Created Date</Text>
          </View>

          {/* Table Rows */}
          {pos.map((po, i) => (
            <View key={po.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colNumber}>{po.number}</Text>
              <Text style={styles.colTitle}>{po.title || '-'}</Text>
              <Text style={styles.colVendor}>{po.vendorName || '-'}</Text>
              <Text style={styles.colStatus}>{po.status.replace(/_/g, ' ')}</Text>
              <Text style={styles.colAmount}>{formatCurrency(po.grandTotal, po.currency)}</Text>
              <Text style={styles.colDelivery}>{getDeliveryStatus(po.deliveryProgress)}</Text>
              <Text style={styles.colDate}>{formatDate(po.createdAt)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Vapour Toolbox — Purchase Orders</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
