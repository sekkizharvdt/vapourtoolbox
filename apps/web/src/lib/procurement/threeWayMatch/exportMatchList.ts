/**
 * Three-Way Match List Export — CSV
 *
 * Generates a CSV file from the filtered three-way match list
 * and triggers a browser download.
 */

import type { ThreeWayMatch } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'Match #',
  'PO #',
  'GR #',
  'Bill #',
  'Vendor',
  'Match %',
  'PO Amount',
  'Invoice Amount',
  'Variance',
  'Status',
  'Approval',
  'Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadMatchListCSV(matches: ThreeWayMatch[]): void {
  const rows = matches.map((m) => [
    m.matchNumber || '-',
    m.poNumber || '-',
    m.grNumber || '-',
    m.vendorBillNumber || '-',
    m.vendorName || '-',
    m.overallMatchPercentage.toFixed(1) + '%',
    m.poAmount.toFixed(2),
    m.invoiceAmount.toFixed(2),
    m.variance.toFixed(2),
    m.status.replace(/_/g, ' '),
    m.approvalStatus?.replace(/_/g, ' ') || '-',
    formatDate(m.matchedAt),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Three_Way_Matches_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
