/**
 * RFQ List PDF Document Template
 *
 * React-PDF template for a tabular listing of requests for quotation.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { RFQ } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'RFQ Number', width: '14%' },
  { key: 'title', header: 'Title', width: '20%' },
  { key: 'vendors', header: 'Vendors', width: '16%' },
  { key: 'status', header: 'Status', width: '10%' },
  { key: 'offers', header: 'Offers Received', width: '10%', align: 'center' },
  { key: 'dueDate', header: 'Due Date', width: '10%' },
  { key: 'createdBy', header: 'Created By', width: '10%' },
  { key: 'date', header: 'Created Date', width: '10%' },
];

interface RFQListPDFDocumentProps {
  rfqs: RFQ[];
}

export function RFQListPDFDocument({ rfqs }: RFQListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = rfqs.map((r) => ({
    number: r.number,
    title: r.title || '-',
    vendors: r.vendorNames?.join(', ') || '-',
    status: r.status.replace(/_/g, ' '),
    offers: String(r.offersReceived ?? 0),
    dueDate: formatDate(r.dueDate),
    createdBy: r.createdByName || '-',
    date: formatDate(r.createdAt),
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Requests for Quotation"
          subtitle={`Generated on ${generatedAt} — ${rfqs.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Requests for Quotation" />
      </ReportPage>
    </Document>
  );
}
