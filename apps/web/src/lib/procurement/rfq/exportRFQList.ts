/**
 * RFQ List Export — CSV
 *
 * Generates a CSV file from the filtered RFQ list
 * and triggers a browser download.
 */

import type { RFQ } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'RFQ Number',
  'Title',
  'Vendors',
  'Status',
  'Offers Received',
  'Due Date',
  'Created By',
  'Created Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadRFQListCSV(rfqs: RFQ[]): void {
  const rows = rfqs.map((r) => [
    r.number,
    r.title || '-',
    r.vendorNames?.join(', ') || '-',
    r.status.replace(/_/g, ' '),
    String(r.offersReceived ?? 0),
    formatDate(r.dueDate),
    r.createdByName || '-',
    formatDate(r.createdAt),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RFQs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
