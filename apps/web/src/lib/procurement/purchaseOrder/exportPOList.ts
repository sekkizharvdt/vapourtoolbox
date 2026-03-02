/**
 * Purchase Order List Export — CSV
 *
 * Generates a CSV file from the filtered purchase order list
 * and triggers a browser download.
 */

import type { PurchaseOrder } from '@vapour/types';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';

const CSV_HEADERS = [
  'PO Number',
  'Title',
  'Vendor',
  'Status',
  'Amount',
  'Currency',
  'Delivery Status',
  'Created Date',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getDeliveryStatus(deliveryProgress: number): string {
  if (deliveryProgress >= 100) return 'Delivered';
  if (deliveryProgress > 0) return 'In Progress';
  return 'Pending';
}

export function downloadPOListCSV(pos: PurchaseOrder[]): void {
  const rows = pos.map((po) => [
    po.number,
    po.title || '-',
    po.vendorName || '-',
    po.status.replace(/_/g, ' '),
    formatCurrency(po.grandTotal, po.currency),
    po.currency,
    getDeliveryStatus(po.deliveryProgress),
    formatDate(po.createdAt),
  ]);

  const csvContent = [
    CSV_HEADERS.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Purchase_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
