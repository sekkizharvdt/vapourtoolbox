/**
 * Purchase Order List PDF Document Template
 *
 * React-PDF template for a tabular listing of purchase orders.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { PurchaseOrder } from '@vapour/types';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

function getDeliveryStatus(deliveryProgress: number): string {
  if (deliveryProgress >= 100) return 'Delivered';
  if (deliveryProgress > 0) return 'In Progress';
  return 'Pending';
}

const columns: TableColumn[] = [
  { key: 'number', header: 'PO Number', width: '14%' },
  { key: 'title', header: 'Title', width: '18%' },
  { key: 'vendor', header: 'Vendor', width: '16%' },
  { key: 'status', header: 'Status', width: '12%' },
  { key: 'amount', header: 'Amount', width: '14%', align: 'right' },
  { key: 'delivery', header: 'Delivery Status', width: '12%' },
  { key: 'date', header: 'Created Date', width: '14%' },
];

interface POListPDFDocumentProps {
  pos: PurchaseOrder[];
}

export function POListPDFDocument({ pos }: POListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = pos.map((po) => ({
    number: po.number,
    title: po.title || '-',
    vendor: po.vendorName || '-',
    status: po.status.replace(/_/g, ' '),
    amount: formatCurrency(po.grandTotal, po.currency),
    delivery: getDeliveryStatus(po.deliveryProgress),
    date: formatDate(po.createdAt),
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Purchase Orders"
          subtitle={`Generated on ${generatedAt} — ${pos.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Purchase Orders" />
      </ReportPage>
    </Document>
  );
}
