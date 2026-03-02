/**
 * Purchase Request List Export — CSV
 *
 * Generates a CSV file from the filtered purchase request list
 * and triggers a browser download.
 */

import type { PurchaseRequest } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'PR Number',
  'Project',
  'Description',
  'Type',
  'Category',
  'Priority',
  'Status',
  'Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadPRListCSV(requests: PurchaseRequest[]): void {
  const rows = requests.map((r) => [
    r.number,
    r.projectName || '-',
    r.description || '-',
    r.type,
    r.category,
    r.priority,
    r.status.replace(/_/g, ' '),
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
  link.download = `Purchase_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
