/**
 * Work Completion Certificate List PDF Document Template
 *
 * React-PDF template for a tabular listing of work completion certificates.
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { WorkCompletionCertificate } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  ReportPage,
  ListHeader,
  ReportTable,
  ListFooter,
  type TableColumn,
} from '@/lib/pdf/reportComponents';

const columns: TableColumn[] = [
  { key: 'number', header: 'WCC Number', width: '12%' },
  { key: 'po', header: 'PO Number', width: '10%' },
  { key: 'vendor', header: 'Vendor', width: '14%' },
  { key: 'project', header: 'Project', width: '14%' },
  { key: 'date', header: 'Completion Date', width: '10%' },
  { key: 'delivered', header: 'Items Delivered', width: '10%', align: 'center' },
  { key: 'accepted', header: 'Items Accepted', width: '10%', align: 'center' },
  { key: 'payments', header: 'Payments Complete', width: '10%', align: 'center' },
  { key: 'issuer', header: 'Issued By', width: '10%' },
];

interface WCCListPDFDocumentProps {
  wccs: WorkCompletionCertificate[];
}

export function WCCListPDFDocument({ wccs }: WCCListPDFDocumentProps) {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rows = wccs.map((w) => ({
    number: w.number || '-',
    po: w.poNumber || '-',
    vendor: w.vendorName || '-',
    project: w.projectName || '-',
    date: formatDate(w.completionDate),
    delivered: w.allItemsDelivered ? 'Yes' : 'No',
    accepted: w.allItemsAccepted ? 'Yes' : 'No',
    payments: w.allPaymentsCompleted ? 'Yes' : 'No',
    issuer: w.issuedByName || '-',
  }));

  return (
    <Document>
      <ReportPage orientation="landscape">
        <ListHeader
          title="Work Completion Certificates"
          subtitle={`Generated on ${generatedAt} — ${wccs.length} record(s)`}
        />
        <ReportTable columns={columns} rows={rows} striped={true} fontSize={8} />
        <ListFooter label="Vapour Toolbox — Work Completion Certificates" />
      </ReportPage>
    </Document>
  );
}
