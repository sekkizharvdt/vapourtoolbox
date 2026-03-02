/**
 * Goods Receipt List Export — CSV
 *
 * Generates a CSV file from the filtered goods receipt list
 * and triggers a browser download.
 */

import type { GoodsReceipt } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'GR Number',
  'PO Number',
  'Project',
  'Status',
  'Condition',
  'Has Issues',
  'Payment Approved',
  'Inspection Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadGRListCSV(grs: GoodsReceipt[]): void {
  const rows = grs.map((gr) => [
    gr.number,
    gr.poNumber || '-',
    gr.projectName || '-',
    gr.status.replace(/_/g, ' '),
    gr.overallCondition?.replace(/_/g, ' ') || '-',
    gr.hasIssues ? 'Yes' : 'No',
    gr.approvedForPayment ? 'Yes' : 'No',
    formatDate(gr.inspectionDate),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Goods_Receipts_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
