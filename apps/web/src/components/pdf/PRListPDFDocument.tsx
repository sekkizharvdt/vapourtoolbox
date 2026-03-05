/**
 * Purchase Request List PDF Document Template
 *
 * React-PDF template for a tabular listing of purchase requests.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { PurchaseRequest } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'PR Number', width: '12%' },
  { key: 'project', header: 'Project', width: '16%' },
  { key: 'description', header: 'Description', width: '24%' },
  { key: 'type', header: 'Type', width: '10%' },
  { key: 'category', header: 'Category', width: '12%' },
  { key: 'priority', header: 'Priority', width: '8%' },
  { key: 'status', header: 'Status', width: '10%' },
  { key: 'date', header: 'Date', width: '8%' },
];

interface PRListPDFDocumentProps {
  requests: PurchaseRequest[];
}

export function PRListPDFDocument({ requests }: PRListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = requests.map((r) => ({
    number: r.number,
    project: r.projectName || '-',
    description: r.description || '-',
    type: r.type,
    category: r.category,
    priority: r.priority,
    status: r.status.replace(/_/g, ' '),
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
