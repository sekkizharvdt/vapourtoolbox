/**
 * PO Amendment List Export — CSV
 *
 * Generates a CSV file from the filtered amendment list
 * and triggers a browser download.
 */

import type { PurchaseOrderAmendment } from '@vapour/types';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'PO Number',
  'Amendment #',
  'Type',
  'Reason',
  'Previous Total',
  'New Total',
  'Value Change',
  'Status',
  'Requested By',
  'Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatAmendmentType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function downloadAmendmentListCSV(amendments: PurchaseOrderAmendment[]): void {
  const rows = amendments.map((a) => [
    a.purchaseOrderNumber || '-',
    String(a.amendmentNumber),
    formatAmendmentType(a.amendmentType),
    a.reason || '-',
    formatCurrency(a.previousGrandTotal),
    formatCurrency(a.newGrandTotal),
    formatCurrency(a.totalChange),
    a.status.replace(/_/g, ' '),
    a.requestedByName || '-',
    formatDate(a.amendmentDate),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PO_Amendments_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
