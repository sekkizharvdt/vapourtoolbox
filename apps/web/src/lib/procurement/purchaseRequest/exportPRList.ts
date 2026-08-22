/**
 * Purchase Request List Export — CSV
 *
 * Maps the filtered purchase request list into rows; the escaping and download
 * live in `lib/utils/csvExport.ts`, shared with the PO payments list.
 */

import type { PurchaseRequest } from '@vapour/types';
import {
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PURCHASE_REQUEST_RAISED_FOR_LABELS,
  PURCHASE_REQUEST_STATUS_LABELS,
} from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';
import { downloadListCSV } from '@/lib/utils/csvExport';
import { describeLinkage } from './linkage';

const CSV_HEADERS = [
  'PR Number',
  'Raised For',
  'Linked To',
  'Description',
  'Category',
  'Budgetary',
  'Status',
  'Date',
];

export function downloadPRListCSV(requests: PurchaseRequest[]): void {
  const rows = requests.map((r) => [
    r.number,
    PURCHASE_REQUEST_RAISED_FOR_LABELS[r.raisedFor] ?? r.raisedFor ?? '-',
    describeLinkage(r),
    r.description || '-',
    PURCHASE_REQUEST_CATEGORY_LABELS[r.category] ?? r.category,
    r.isBudgetary ? 'Yes' : 'No',
    PURCHASE_REQUEST_STATUS_LABELS[r.status] ?? r.status,
    formatDate(r.createdAt),
  ]);

  downloadListCSV({ headers: CSV_HEADERS, rows, filename: 'Purchase_Requests' });
}
