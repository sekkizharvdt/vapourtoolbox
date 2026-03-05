/**
 * Three-Way Match List PDF Document Template
 *
 * React-PDF template for a tabular listing of three-way matches.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { ThreeWayMatch } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'match', header: 'Match #', width: '9%' },
  { key: 'po', header: 'PO #', width: '9%' },
  { key: 'gr', header: 'GR #', width: '9%' },
  { key: 'bill', header: 'Bill #', width: '9%' },
  { key: 'vendor', header: 'Vendor', width: '12%' },
  { key: 'percent', header: 'Match %', width: '7%', align: 'right' },
  { key: 'poAmt', header: 'PO Amount', width: '10%', align: 'right' },
  { key: 'invAmt', header: 'Invoice Amount', width: '10%', align: 'right' },
  { key: 'variance', header: 'Variance', width: '8%', align: 'right' },
  { key: 'status', header: 'Status', width: '9%' },
  { key: 'approval', header: 'Approval', width: '8%' },
];

interface MatchListPDFDocumentProps {
  matches: ThreeWayMatch[];
}

export function MatchListPDFDocument({ matches }: MatchListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = matches.map((m) => ({
    match: m.matchNumber || '-',
    po: m.poNumber || '-',
    gr: m.grNumber || '-',
    bill: m.vendorBillNumber || '-',
    vendor: m.vendorName || '-',
    percent: `${m.overallMatchPercentage.toFixed(1)}%`,
    poAmt: formatCurrency(m.poAmount),
    invAmt: formatCurrency(m.invoiceAmount),
    variance: formatCurrency(m.variance),
    status: m.status.replace(/_/g, ' '),
    approval: m.approvalStatus?.replace(/_/g, ' ') || '-',
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Three-Way Match Report"
          subtitle={`Generated on ${generatedAt} — ${matches.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Three-Way Match Report" />
      </ReportPage>
    </Document>
  );
}
