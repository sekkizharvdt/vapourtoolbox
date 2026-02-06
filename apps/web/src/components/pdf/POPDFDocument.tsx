/**
 * Purchase Order PDF Document Template
 *
 * React-PDF template for professional PO documents.
 * Includes: header, vendor info, line items table, financial summary, terms.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '2pt solid #1976d2',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  poNumber: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
    borderBottom: '1pt solid #e0e0e0',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 6,
    fontWeight: 'bold',
    borderBottom: '1pt solid #ccc',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5pt solid #e0e0e0',
    fontSize: 9,
  },
  colSno: { width: '6%' },
  colDesc: { width: '30%' },
  colSpec: { width: '14%' },
  colQty: { width: '8%', textAlign: 'right' },
  colUnit: { width: '8%' },
  colRate: { width: '12%', textAlign: 'right' },
  colGST: { width: '8%', textAlign: 'right' },
  colAmount: { width: '14%', textAlign: 'right' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 3,
  },
  summaryLabel: {
    width: '30%',
    textAlign: 'right',
    paddingRight: 10,
    fontWeight: 'bold',
  },
  summaryValue: {
    width: '20%',
    textAlign: 'right',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    borderTop: '1pt solid #333',
    marginTop: 2,
  },
  totalLabel: {
    width: '30%',
    textAlign: 'right',
    paddingRight: 10,
    fontWeight: 'bold',
    fontSize: 11,
  },
  totalValue: {
    width: '20%',
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 11,
  },
  termsItem: {
    marginBottom: 6,
  },
  termsLabel: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  termsValue: {
    color: '#333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '0.5pt solid #e0e0e0',
    paddingTop: 5,
  },
});

function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatTimestamp(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface POPDFDocumentProps {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  companyName?: string;
}

export function POPDFDocument({
  po,
  items,
  companyName = 'Vapour Desalination Pvt. Ltd.',
}: POPDFDocumentProps): React.JSX.Element {
  const sortedItems = [...items].sort((a, b) => a.lineNumber - b.lineNumber);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.documentTitle}>PURCHASE ORDER</Text>
          <Text style={styles.poNumber}>{po.number}</Text>
        </View>

        {/* PO Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>PO Number:</Text>
            <Text style={styles.value}>{po.number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatTimestamp(po.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{po.status}</Text>
          </View>
          {po.title && (
            <View style={styles.row}>
              <Text style={styles.label}>Title:</Text>
              <Text style={styles.value}>{po.title}</Text>
            </View>
          )}
          {po.description && (
            <View style={styles.row}>
              <Text style={styles.label}>Description:</Text>
              <Text style={styles.value}>{po.description}</Text>
            </View>
          )}
        </View>

        {/* Vendor Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vendor Name:</Text>
            <Text style={styles.value}>{po.vendorName}</Text>
          </View>
        </View>

        {/* Project Info */}
        {po.projectNames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Project(s):</Text>
              <Text style={styles.value}>{po.projectNames.join(', ')}</Text>
            </View>
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colSno}>#</Text>
              <Text style={styles.colDesc}>Description</Text>
              <Text style={styles.colSpec}>Specification</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit</Text>
              <Text style={styles.colRate}>Unit Price</Text>
              <Text style={styles.colGST}>GST %</Text>
              <Text style={styles.colAmount}>Amount</Text>
            </View>
            {sortedItems.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.colSno}>{item.lineNumber}</Text>
                <Text style={styles.colDesc}>{item.description}</Text>
                <Text style={styles.colSpec}>{item.specification || '—'}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colUnit}>{item.unit}</Text>
                <Text style={styles.colRate}>{formatCurrency(item.unitPrice, po.currency)}</Text>
                <Text style={styles.colGST}>{item.gstRate}%</Text>
                <Text style={styles.colAmount}>{formatCurrency(item.amount, po.currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(po.subtotal, po.currency)}</Text>
          </View>
          {po.cgst > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>CGST:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(po.cgst, po.currency)}</Text>
            </View>
          )}
          {po.sgst > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SGST:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(po.sgst, po.currency)}</Text>
            </View>
          )}
          {po.igst > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(po.igst, po.currency)}</Text>
            </View>
          )}
          {po.totalTax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Tax:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(po.totalTax, po.currency)}</Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text style={styles.totalLabel}>Grand Total:</Text>
            <Text style={styles.totalValue}>{formatCurrency(po.grandTotal, po.currency)}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Terms & Conditions */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.poNumber}>{po.number} — Terms &amp; Conditions</Text>
        </View>

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>

          {po.paymentTerms && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Payment Terms:</Text>
              <Text style={styles.termsValue}>{po.paymentTerms}</Text>
            </View>
          )}

          {po.deliveryTerms && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Delivery Terms:</Text>
              <Text style={styles.termsValue}>{po.deliveryTerms}</Text>
            </View>
          )}

          {po.deliveryAddress && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Delivery Address:</Text>
              <Text style={styles.termsValue}>{po.deliveryAddress}</Text>
            </View>
          )}

          {po.expectedDeliveryDate && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Expected Delivery:</Text>
              <Text style={styles.termsValue}>{formatTimestamp(po.expectedDeliveryDate)}</Text>
            </View>
          )}

          {po.warrantyTerms && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Warranty:</Text>
              <Text style={styles.termsValue}>{po.warrantyTerms}</Text>
            </View>
          )}

          {po.penaltyClause && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Penalty Clause:</Text>
              <Text style={styles.termsValue}>{po.penaltyClause}</Text>
            </View>
          )}

          {po.otherClauses && po.otherClauses.length > 0 && (
            <View style={styles.termsItem}>
              <Text style={styles.termsLabel}>Other Clauses:</Text>
              {po.otherClauses.map((clause, i) => (
                <Text key={i} style={styles.termsValue}>
                  {i + 1}. {clause}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Commercial Terms (if structured terms present) */}
        {po.commercialTerms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Commercial Terms</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Price Basis:</Text>
              <Text style={styles.value}>
                {po.commercialTerms.priceBasis === 'FOR_SITE'
                  ? 'FOR Site'
                  : po.commercialTerms.priceBasis === 'EX_WORKS'
                    ? 'Ex-Works'
                    : 'FOR Destination'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Currency:</Text>
              <Text style={styles.value}>{po.commercialTerms.currency}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Delivery:</Text>
              <Text style={styles.value}>
                {po.commercialTerms.deliveryUnit === 'READY_STOCK'
                  ? 'Ready Stock'
                  : `${po.commercialTerms.deliveryPeriod} ${po.commercialTerms.deliveryUnit.toLowerCase()} from ${po.commercialTerms.deliveryTrigger === 'PO_DATE' ? 'PO date' : po.commercialTerms.deliveryTrigger === 'ADVANCE_PAYMENT' ? 'advance payment' : 'drawing approval'}`}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Freight:</Text>
              <Text style={styles.value}>
                {po.commercialTerms.freightScope === 'VENDOR' ? 'Vendor' : 'Buyer'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Warranty:</Text>
              <Text style={styles.value}>
                {po.commercialTerms.warrantyMonthsFromSupply} months from supply /{' '}
                {po.commercialTerms.warrantyMonthsFromCommissioning} months from commissioning
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>LD:</Text>
              <Text style={styles.value}>
                {po.commercialTerms.ldPerWeekPercent}% per week, max{' '}
                {po.commercialTerms.ldMaxPercent}%
              </Text>
            </View>
          </View>
        )}

        {/* Approval Info */}
        {po.approvedByName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approval</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Approved By:</Text>
              <Text style={styles.value}>{po.approvedByName}</Text>
            </View>
            {po.approvedAt && (
              <View style={styles.row}>
                <Text style={styles.label}>Approved On:</Text>
                <Text style={styles.value}>{formatTimestamp(po.approvedAt)}</Text>
              </View>
            )}
            {po.approvalComments && (
              <View style={styles.row}>
                <Text style={styles.label}>Comments:</Text>
                <Text style={styles.value}>{po.approvalComments}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString('en-IN')} | {po.number}
        </Text>
      </Page>
    </Document>
  );
}
