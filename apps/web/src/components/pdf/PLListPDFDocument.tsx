/**
 * Packing List PDF Document Template
 *
 * React-PDF template for a tabular listing of packing lists.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { PackingList } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'PL Number', width: '12%' },
  { key: 'po', header: 'PO Number', width: '12%' },
  { key: 'vendor', header: 'Vendor', width: '14%' },
  { key: 'project', header: 'Project', width: '14%' },
  { key: 'status', header: 'Status', width: '12%' },
  { key: 'packages', header: 'Packages', width: '10%', align: 'center' },
  { key: 'shipping', header: 'Shipping Method', width: '12%' },
  { key: 'date', header: 'Created Date', width: '14%' },
];

interface PLListPDFDocumentProps {
  pls: PackingList[];
}

export function PLListPDFDocument({ pls }: PLListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = pls.map((pl) => ({
    number: pl.number,
    po: pl.poNumber || '-',
    vendor: pl.vendorName || '-',
    project: pl.projectName || '-',
    status: pl.status.replace(/_/g, ' '),
    packages: String(pl.numberOfPackages ?? 0),
    shipping: pl.shippingMethod || '-',
    date: formatDate(pl.createdAt),
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Packing Lists"
          subtitle={`Generated on ${generatedAt} — ${pls.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Packing Lists" />
      </ReportPage>
    </Document>
  );
}
