/**
 * Purchase Request List PDF Document Template
 *
 * React-PDF template for a tabular listing of purchase requests.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { PurchaseRequest } from '@vapour/types';
import {
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PURCHASE_REQUEST_RAISED_FOR_LABELS,
  PURCHASE_REQUEST_STATUS_LABELS,
} from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';
import { describeLinkage } from '@/lib/procurement/purchaseRequest/linkage';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'PR Number', width: '12%' },
  { key: 'raisedFor', header: 'Raised For', width: '9%' },
  { key: 'linkedTo', header: 'Linked To', width: '17%' },
  { key: 'description', header: 'Description', width: '26%' },
  { key: 'category', header: 'Category', width: '12%' },
  { key: 'budgetary', header: 'Budgetary', width: '7%' },
  { key: 'status', header: 'Status', width: '11%' },
  { key: 'date', header: 'Date', width: '6%' },
];

interface PRListPDFDocumentProps {
  requests: PurchaseRequest[];
}

export function PRListPDFDocument({ requests }: PRListPDFDocumentProps) {
  const generatedAt = formatDate(new Date());

  const rows = requests.map((r) => ({
    number: r.number,
    raisedFor: PURCHASE_REQUEST_RAISED_FOR_LABELS[r.raisedFor] ?? r.raisedFor ?? '-',
    linkedTo: describeLinkage(r),
    description: r.description || '-',
    category: PURCHASE_REQUEST_CATEGORY_LABELS[r.category] ?? r.category,
    budgetary: r.isBudgetary ? 'Yes' : 'No',
    status: PURCHASE_REQUEST_STATUS_LABELS[r.status] ?? r.status,
    date: formatDate(r.createdAt),
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Purchase Requests"
          subtitle={`Generated on ${generatedAt} — ${requests.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Purchase Requests" />
      </ReportPage>
    </Document>
  );
}
