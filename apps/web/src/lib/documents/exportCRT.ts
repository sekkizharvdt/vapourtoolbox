/**
 * Comment Resolution Table Export — CSV
 *
 * Generates a CSV file from document comments and triggers a browser download.
 */

import type { DocumentComment } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'Comment #',
  'Severity',
  'Category',
  'Comment Text',
  'Page',
  'Section',
  'Line Item',
  'Status',
  'Resolution',
  'Resolved By',
  'Resolved Date',
  'PM Approved',
  'PM Remarks',
  'Client Accepted',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCRTAsCSV(
  comments: DocumentComment[],
  documentNumber: string,
  revision: string
): void {
  const rows = comments.map((c) => [
    c.commentNumber,
    c.severity,
    c.category,
    c.commentText,
    c.pageNumber ? String(c.pageNumber) : '-',
    c.section || '-',
    c.lineItem || '-',
    c.status.replace(/_/g, ' '),
    c.resolutionText || '-',
    c.resolvedByName || '-',
    formatDate(c.resolvedAt),
    c.pmApproved ? 'Yes' : 'No',
    c.pmRemarks || '-',
    c.clientAccepted ? 'Yes' : 'No',
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CRT_${documentNumber}_${revision}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
