/**
 * Goods Receipt List PDF Document Template
 *
 * React-PDF template for a tabular listing of goods receipts.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { GoodsReceipt } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'GR Number', width: '12%' },
  { key: 'po', header: 'PO Number', width: '12%' },
  { key: 'project', header: 'Project', width: '16%' },
  { key: 'status', header: 'Status', width: '12%' },
  { key: 'condition', header: 'Condition', width: '14%' },
  { key: 'issues', header: 'Has Issues', width: '10%', align: 'center' },
  { key: 'payment', header: 'Payment Approved', width: '12%', align: 'center' },
  { key: 'date', header: 'Inspection Date', width: '12%' },
];

interface GRListPDFDocumentProps {
  grs: GoodsReceipt[];
}

export function GRListPDFDocument({ grs }: GRListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = grs.map((gr) => ({
    number: gr.number,
    po: gr.poNumber || '-',
    project: gr.projectName || '-',
    status: gr.status.replace(/_/g, ' '),
    condition: gr.overallCondition?.replace(/_/g, ' ') || '-',
    issues: gr.hasIssues ? 'Yes' : 'No',
    payment: gr.approvedForPayment ? 'Yes' : 'No',
    date: formatDate(gr.inspectionDate),
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Goods Receipts"
          subtitle={`Generated on ${generatedAt} — ${grs.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Goods Receipts" />
      </ReportPage>
    </Document>
  );
}
