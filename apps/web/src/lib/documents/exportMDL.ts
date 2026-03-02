/**
 * Master Document List Export — CSV
 *
 * Generates a CSV file from the filtered MDL and triggers a browser download.
 */

import type { MasterDocumentEntry } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'Document Number',
  'Title',
  'Type',
  'Discipline',
  'Status',
  'Revision',
  'Assigned To',
  'Due Date',
  'Priority',
  'Progress %',
  'Visibility',
  'Submissions',
  'Open Comments',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadMDLAsCSV(documents: MasterDocumentEntry[], projectCode?: string): void {
  const rows = documents.map((doc) => [
    doc.documentNumber,
    doc.documentTitle,
    doc.documentType || '-',
    `${doc.disciplineCode} - ${doc.disciplineName}`,
    doc.status.replace(/_/g, ' '),
    doc.currentRevision,
    doc.assignedToNames?.length > 0 ? doc.assignedToNames.join('; ') : '-',
    formatDate(doc.dueDate),
    doc.priority,
    String(doc.progressPercentage ?? 0),
    doc.visibility === 'CLIENT_VISIBLE' ? 'Client Visible' : 'Internal',
    String(doc.submissionCount ?? 0),
    String(doc.openComments ?? 0),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const prefix = projectCode ? `${projectCode}_` : '';
  link.download = `${prefix}Master_Document_List_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
