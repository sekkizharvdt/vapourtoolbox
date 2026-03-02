/**
 * Packing List Export — CSV
 *
 * Generates a CSV file from the filtered packing list
 * and triggers a browser download.
 */

import type { PackingList } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'PL Number',
  'PO Number',
  'Vendor',
  'Project',
  'Status',
  'Packages',
  'Shipping Method',
  'Created Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadPLListCSV(pls: PackingList[]): void {
  const rows = pls.map((pl) => [
    pl.number,
    pl.poNumber || '-',
    pl.vendorName || '-',
    pl.projectName || '-',
    pl.status.replace(/_/g, ' '),
    String(pl.numberOfPackages ?? 0),
    pl.shippingMethod || '-',
    formatDate(pl.createdAt),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Packing_Lists_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
