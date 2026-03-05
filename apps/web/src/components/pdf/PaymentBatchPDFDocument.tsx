/**
 * Payment Batch PDF Document Template (Portrait)
 *
 * React-PDF template for payment batch documents.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 * Includes: header, summary, receipts table, payments grouped by category, totals.
 */

import React from 'react';
import { Document, Text, View } from '@react-pdf/renderer';
import type { PaymentBatch } from '@vapour/types';
import {
  ReportPage,
  ListHeader,
  ReportSection,
  ReportTable,
  SummaryCards,
  ReportFooter,
  KeyValueTable,
  NotesSection,
  reportStyles as s,
  REPORT_THEME,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

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

/* ── Receipts table columns ────────────────────────────────── */

const receiptColumns: TableColumn[] = [
  { key: 'description', header: 'Description', width: '35%' },
  { key: 'project', header: 'Project', width: '20%' },
  { key: 'date', header: 'Date', width: '15%' },
  { key: 'entity', header: 'Entity', width: '15%' },
  { key: 'amount', header: 'Amount', width: '15%', align: 'right' },
];

/* ── Payment table columns (with/without TDS) ─────────────── */

function getPaymentColumns(hasTds: boolean): TableColumn[] {
  if (hasTds) {
    return [
      { key: 'payee', header: 'Payee', width: '25%' },
      { key: 'reference', header: 'Reference', width: '20%' },
      { key: 'project', header: 'Project', width: '15%' },
      { key: 'amount', header: 'Amount', width: '13%', align: 'right' },
      { key: 'tds', header: 'TDS', width: '12%', align: 'right' },
      { key: 'net', header: 'Net Payable', width: '15%', align: 'right' },
    ];
  }
  return [
    { key: 'payee', header: 'Payee', width: '25%' },
    { key: 'reference', header: 'Reference', width: '20%' },
    { key: 'project', header: 'Project', width: '15%' },
    { key: 'amount', header: 'Amount', width: '20%', align: 'right' },
    { key: 'net', header: '', width: '20%' },
  ];
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
  const paymentColumns = getPaymentColumns(hasTds);

  // Build receipt rows
  const receiptRows = batch.receipts.map((receipt) => ({
    description: receipt.description,
    project: receipt.projectName || '-',
    date: formatDate(receipt.receiptDate),
    entity: receipt.entityName || '-',
    amount: formatCurrency(receipt.amount),
  }));

  // Build batch details key-value pairs
  const batchDetails = [
    { label: 'Status', value: batch.status.replace(/_/g, ' ') },
    { label: 'Created', value: formatDate(batch.createdAt) },
    ...(batch.bankAccountName ? [{ label: 'Bank Account', value: batch.bankAccountName }] : []),
  ];

  return (
    <Document>
      <ReportPage>
        {/* Header */}
        <ListHeader companyName={companyName} title="Payment Batch" subtitle={batch.batchNumber} />

        {/* Batch Details */}
        <KeyValueTable rows={batchDetails} labelWidth="35%" valueWidth="65%" />

        {/* Notes */}
        {batch.notes && <NotesSection notes={batch.notes} title="Notes:" />}

        {/* Summary Cards */}
        <SummaryCards
          items={[
            {
              label: 'Total Receipts',
              value: `${formatCurrency(batch.totalReceiptAmount)} (${batch.receipts.length} receipt${batch.receipts.length !== 1 ? 's' : ''})`,
              color: REPORT_THEME.successText,
            },
            {
              label: 'Total Payments',
              value: `${formatCurrency(batch.totalPaymentAmount)} (${batch.payments.length} payment${batch.payments.length !== 1 ? 's' : ''})`,
              color: REPORT_THEME.errorText,
            },
            {
              label: 'Remaining Balance',
              value: formatCurrency(batch.remainingBalance),
              color:
                batch.remainingBalance >= 0 ? REPORT_THEME.successText : REPORT_THEME.errorText,
            },
          ]}
        />

        {/* Receipts Table */}
        <ReportSection title="Receipts (Fund Sources)">
          <ReportTable
            columns={receiptColumns}
            rows={receiptRows}
            striped
            fontSize={9}
            totalRow={{
              description: '',
              project: '',
              date: '',
              entity: 'Total Receipts:',
              amount: formatCurrency(batch.totalReceiptAmount),
            }}
          />
        </ReportSection>

        {/* Payments Table (grouped by category) */}
        <ReportSection title="Payments (Allocations)">
          <View style={{ width: '100%' }}>
            {/* Table header */}
            <View style={[s.tableHeader, { fontSize: 9 }]}>
              {paymentColumns.map((col) => (
                <Text
                  key={col.key}
                  style={{
                    width: col.width,
                    paddingHorizontal: 3,
                    ...(col.align === 'right' ? { textAlign: 'right' as const } : {}),
                  }}
                >
                  {col.header}
                </Text>
              ))}
            </View>

            {/* Category groups */}
            {sortedCategories.map(([key, group]) => (
              <View key={key}>
                {/* Category header row */}
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: REPORT_THEME.primaryLight,
                    paddingVertical: 3,
                    paddingHorizontal: 3,
                    fontSize: 9,
                    fontWeight: 'bold',
                    borderBottom: `1pt solid #bbdefb`,
                  }}
                >
                  <Text style={{ width: '70%' }}>
                    {group.label} ({group.payments.length})
                  </Text>
                  <Text style={{ width: '30%', textAlign: 'right' }}>
                    {formatCurrency(group.total)}
                  </Text>
                </View>

                {/* Payment rows within category */}
                {group.payments.map((payment, i) => {
                  const cellData: Record<string, string> = {
                    payee: payment.entityName,
                    reference: payment.linkedReference || payment.payeeType,
                    project: payment.projectName || '-',
                    amount: formatCurrency(payment.amount),
                    tds: payment.tdsAmount ? formatCurrency(payment.tdsAmount) : '-',
                    net: hasTds ? formatCurrency(payment.netPayable ?? payment.amount) : '',
                  };
                  return (
                    <View key={payment.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                      {paymentColumns.map((col) => (
                        <Text
                          key={col.key}
                          style={{
                            width: col.width,
                            paddingHorizontal: 3,
                            fontSize: 9,
                            ...(col.align === 'right' ? { textAlign: 'right' as const } : {}),
                          }}
                        >
                          {cellData[col.key] ?? ''}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Grand total */}
            <View style={s.totalRow}>
              {paymentColumns.map((col, i) => {
                const isLast = i === paymentColumns.length - 1;
                return (
                  <Text
                    key={col.key}
                    style={{
                      width: col.width,
                      paddingHorizontal: 3,
                      ...(isLast
                        ? {
                            textAlign: 'right' as const,
                            fontWeight: 'bold' as const,
                            fontSize: 11,
                            color: REPORT_THEME.errorText,
                          }
                        : {}),
                    }}
                  >
                    {isLast ? formatCurrency(batch.totalPaymentAmount) : ''}
                  </Text>
                );
              })}
            </View>
          </View>
        </ReportSection>

        {/* Approval Information */}
        {batch.approvedBy && (
          <ReportSection title="Approval">
            <KeyValueTable
              rows={[{ label: 'Approved On', value: formatDate(batch.approvedAt) }]}
              labelWidth="25%"
              valueWidth="75%"
            />
          </ReportSection>
        )}

        {/* Rejection Information */}
        {batch.rejectionReason && (
          <ReportSection title="Rejection">
            <KeyValueTable
              rows={[{ label: 'Reason', value: batch.rejectionReason }]}
              labelWidth="25%"
              valueWidth="75%"
            />
          </ReportSection>
        )}

        {/* Footer */}
        <ReportFooter
          lines={[`Generated on ${new Date().toLocaleDateString('en-IN')} | ${batch.batchNumber}`]}
        />
      </ReportPage>
    </Document>
  );
}
