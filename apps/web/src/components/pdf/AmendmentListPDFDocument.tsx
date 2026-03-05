/**
 * PO Amendment List PDF Document Template
 *
 * React-PDF template for a tabular listing of PO amendments.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { PurchaseOrderAmendment } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

function formatAmendmentType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const columns: TableColumn[] = [
  { key: 'po', header: 'PO Number', width: '12%' },
  { key: 'num', header: 'Amd #', width: '7%', align: 'center' },
  { key: 'type', header: 'Type', width: '12%' },
  { key: 'reason', header: 'Reason', width: '17%' },
  { key: 'prevTotal', header: 'Previous Total', width: '10%', align: 'right' },
  { key: 'newTotal', header: 'New Total', width: '10%', align: 'right' },
  { key: 'change', header: 'Value Change', width: '10%', align: 'right' },
  { key: 'status', header: 'Status', width: '10%' },
  { key: 'requester', header: 'Requested By', width: '12%' },
];

interface AmendmentListPDFDocumentProps {
  amendments: PurchaseOrderAmendment[];
}

export function AmendmentListPDFDocument({ amendments }: AmendmentListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = amendments.map((a) => ({
    po: a.purchaseOrderNumber || '-',
    num: String(a.amendmentNumber),
    type: formatAmendmentType(a.amendmentType),
    reason: a.reason || '-',
    prevTotal: formatCurrency(a.previousGrandTotal),
    newTotal: formatCurrency(a.newGrandTotal),
    change: formatCurrency(a.totalChange),
    status: a.status.replace(/_/g, ' '),
    requester: a.requestedByName || '-',
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="PO Amendments"
          subtitle={`Generated on ${generatedAt} — ${amendments.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — PO Amendments" />
      </ReportPage>
    </Document>
  );
}
