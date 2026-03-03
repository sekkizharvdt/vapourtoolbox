/**
 * Payment Batch PDF Document Template (Portrait)
 *
 * React-PDF template for payment batch documents.
 * Includes: header, summary, receipts table, payments grouped by category, totals.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PaymentBatch } from '@vapour/types';

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
  batchNumber: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
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
    width: '35%',
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    width: '65%',
  },
  // Summary cards row
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    border: '1pt solid #e0e0e0',
    borderRadius: 4,
    padding: 10,
  },
  summaryCardLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  summaryCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  summaryCardCount: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  // Tables
  table: {
    marginTop: 8,
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
  tableRowAlt: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5pt solid #e0e0e0',
    fontSize: 9,
    backgroundColor: '#fafafa',
  },
  // Receipt columns
  rColDesc: { width: '35%' },
  rColProject: { width: '20%' },
  rColDate: { width: '15%' },
  rColEntity: { width: '15%' },
  rColAmount: { width: '15%', textAlign: 'right' },
  // Payment columns
  pColEntity: { width: '25%' },
  pColRef: { width: '20%' },
  pColProject: { width: '15%' },
  pColAmount: { width: '13%', textAlign: 'right' },
  pColTds: { width: '12%', textAlign: 'right' },
  pColNet: { width: '15%', textAlign: 'right' },
  // Category header
  categoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    borderBottom: '1pt solid #bbdefb',
  },
  // Totals
  totalRow: {
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
  // Approval section
  approvalRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  approvalLabel: {
    width: '25%',
    fontWeight: 'bold',
    color: '#333',
    fontSize: 9,
  },
  approvalValue: {
    width: '75%',
    fontSize: 9,
  },
  statusBadge: {
    padding: '2 8',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold',
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

const CATEGORY_LABELS: Record<string, string> = {
  SALARY: 'Salary',
  TAXES_DUTIES: 'Taxes & Duties',
  PROJECTS: 'Projects',
  LOANS: 'Loans',
  ADMINISTRATION: 'Administration',
  '3D_PRINTER': '3D Printer',
  OTHER: 'Other',
  UNCATEGORIZED: 'Uncategorized',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | unknown): string {
  if (!date) return '-';
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    return (date as { toDate: () => Date }).toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const d = typeof date === 'string' ? new Date(date) : (date as Date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface PaymentBatchPDFDocumentProps {
  batch: PaymentBatch;
  companyName?: string;
}

export function PaymentBatchPDFDocument({
  batch,
  companyName = 'Vapour Desalination Pvt. Ltd.',
}: PaymentBatchPDFDocumentProps): React.JSX.Element {
  // Group payments by category
  const paymentsByCategory = new Map<
    string,
    { label: string; payments: PaymentBatch['payments']; total: number; tdsTotal: number }
  >();

  batch.payments.forEach((payment) => {
    const key = payment.category || 'UNCATEGORIZED';
    if (!paymentsByCategory.has(key)) {
      paymentsByCategory.set(key, {
        label: CATEGORY_LABELS[key] || key,
        payments: [],
        total: 0,
        tdsTotal: 0,
      });
    }
    const group = paymentsByCategory.get(key)!;
    group.payments.push(payment);
    group.total += payment.amount;
    group.tdsTotal += payment.tdsAmount || 0;
  });

  const sortedCategories = Array.from(paymentsByCategory.entries()).sort(([a], [b]) => {
    if (a === 'UNCATEGORIZED') return 1;
    if (b === 'UNCATEGORIZED') return -1;
    return a.localeCompare(b);
  });

  const totalTds = batch.payments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0);
  const hasTds = totalTds > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.documentTitle}>PAYMENT BATCH</Text>
          <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
        </View>

        {/* Batch Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{batch.status.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Created:</Text>
            <Text style={styles.value}>{formatDate(batch.createdAt)}</Text>
          </View>
          {batch.bankAccountName && (
            <View style={styles.row}>
              <Text style={styles.label}>Bank Account:</Text>
              <Text style={styles.value}>{batch.bankAccountName}</Text>
            </View>
          )}
          {batch.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={styles.value}>{batch.notes}</Text>
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Receipts</Text>
            <Text style={{ ...styles.summaryCardValue, color: '#2e7d32' }}>
              {formatCurrency(batch.totalReceiptAmount)}
            </Text>
            <Text style={styles.summaryCardCount}>
              {batch.receipts.length} receipt{batch.receipts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Payments</Text>
            <Text style={{ ...styles.summaryCardValue, color: '#d32f2f' }}>
              {formatCurrency(batch.totalPaymentAmount)}
            </Text>
            <Text style={styles.summaryCardCount}>
              {batch.payments.length} payment{batch.payments.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Remaining Balance</Text>
            <Text
              style={{
                ...styles.summaryCardValue,
                color: batch.remainingBalance >= 0 ? '#2e7d32' : '#d32f2f',
              }}
            >
              {formatCurrency(batch.remainingBalance)}
            </Text>
            <Text style={styles.summaryCardCount}>After all payments</Text>
          </View>
        </View>

        {/* Receipts Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipts (Fund Sources)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.rColDesc}>Description</Text>
              <Text style={styles.rColProject}>Project</Text>
              <Text style={styles.rColDate}>Date</Text>
              <Text style={styles.rColEntity}>Entity</Text>
              <Text style={styles.rColAmount}>Amount</Text>
            </View>
            {batch.receipts.map((receipt, i) => (
              <View key={receipt.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.rColDesc}>{receipt.description}</Text>
                <Text style={styles.rColProject}>{receipt.projectName || '-'}</Text>
                <Text style={styles.rColDate}>{formatDate(receipt.receiptDate)}</Text>
                <Text style={styles.rColEntity}>{receipt.entityName || '-'}</Text>
                <Text style={styles.rColAmount}>{formatCurrency(receipt.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Receipts:</Text>
              <Text style={{ ...styles.totalValue, color: '#2e7d32' }}>
                {formatCurrency(batch.totalReceiptAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payments Table (grouped by category) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments (Allocations)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.pColEntity}>Payee</Text>
              <Text style={styles.pColRef}>Reference</Text>
              <Text style={styles.pColProject}>Project</Text>
              <Text style={styles.pColAmount}>Amount</Text>
              {hasTds && <Text style={styles.pColTds}>TDS</Text>}
              <Text style={styles.pColNet}>{hasTds ? 'Net Payable' : ''}</Text>
            </View>

            {sortedCategories.map(([key, group]) => (
              <View key={key}>
                {/* Category header */}
                <View style={styles.categoryHeader}>
                  <Text style={{ width: '70%' }}>
                    {group.label} ({group.payments.length})
                  </Text>
                  <Text style={{ width: '30%', textAlign: 'right' }}>
                    {formatCurrency(group.total)}
                  </Text>
                </View>

                {/* Payments in category */}
                {group.payments.map((payment, i) => (
                  <View key={payment.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={styles.pColEntity}>{payment.entityName}</Text>
                    <Text style={styles.pColRef}>
                      {payment.linkedReference || payment.payeeType}
                    </Text>
                    <Text style={styles.pColProject}>{payment.projectName || '-'}</Text>
                    <Text style={styles.pColAmount}>{formatCurrency(payment.amount)}</Text>
                    {hasTds && (
                      <Text style={styles.pColTds}>
                        {payment.tdsAmount ? formatCurrency(payment.tdsAmount) : '-'}
                      </Text>
                    )}
                    <Text style={styles.pColNet}>
                      {hasTds ? formatCurrency(payment.netPayable ?? payment.amount) : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Grand total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Payments:</Text>
              <Text style={{ ...styles.totalValue, color: '#d32f2f' }}>
                {formatCurrency(batch.totalPaymentAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Approval Information */}
        {batch.approvedBy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approval</Text>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalLabel}>Approved On:</Text>
              <Text style={styles.approvalValue}>{formatDate(batch.approvedAt)}</Text>
            </View>
          </View>
        )}

        {batch.rejectionReason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejection</Text>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalLabel}>Reason:</Text>
              <Text style={styles.approvalValue}>{batch.rejectionReason}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString('en-IN')} | {batch.batchNumber}
        </Text>
      </Page>
    </Document>
  );
}
