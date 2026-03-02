/**
 * Work Completion Certificate List Export — CSV
 *
 * Generates a CSV file from the filtered WCC list
 * and triggers a browser download.
 */

import type { WorkCompletionCertificate } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'WCC Number',
  'PO Number',
  'Vendor',
  'Project',
  'Completion Date',
  'Items Delivered',
  'Items Accepted',
  'Payments Complete',
  'Issued By',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadWCCListCSV(wccs: WorkCompletionCertificate[]): void {
  const rows = wccs.map((w) => [
    w.number || '-',
    w.poNumber || '-',
    w.vendorName || '-',
    w.projectName || '-',
    formatDate(w.completionDate),
    w.allItemsDelivered ? 'Yes' : 'No',
    w.allItemsAccepted ? 'Yes' : 'No',
    w.allPaymentsCompleted ? 'Yes' : 'No',
    w.issuedByName || '-',
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Work_Completion_Certificates_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
