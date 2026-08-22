/**
 * PO-wise payment list export — CSV (feature request §3).
 *
 * Maps the filtered list into rows; the escaping and download live in
 * `lib/utils/csvExport.ts`, shared with the purchase-request list.
 *
 * Reads `paymentSummary` only, matching the screen it exports — procurement
 * cannot query the underlying transactions.
 */

import type { PurchaseOrder } from '@vapour/types';
import { PO_PAYMENT_STATUS_LABELS } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';
import { downloadListCSV } from '@/lib/utils/csvExport';

const CSV_HEADERS = [
  'PO Number',
  'PO Date',
  'Vendor',
  'Projects',
  'PO Value',
  'Paid',
  'Pending',
  'Payment Status',
  'Last Synced',
];

export function downloadPOPaymentsCSV(pos: PurchaseOrder[]): void {
  const rows = pos.map((po) => {
    const summary = po.paymentSummary;

    // Blank, not zero, when the projection has not been built for this PO. A 0
    // in the Paid column is a claim that nothing has been paid; the honest
    // answer is that we do not know yet, and a spreadsheet total should not
    // silently absorb the difference (rule 21 — no fallback chains on money).
    const paid = summary ? String(summary.paidAmount) : '';
    const pending = summary ? String(summary.pendingAmount) : '';

    return [
      po.number,
      formatDate(po.createdAt),
      po.vendorName || '-',
      (po.projectNames || []).join('; ') || '-',
      // Raw numbers, not formatted currency: a spreadsheet must be able to sum
      // the column, and a thousands-separated string cannot be. The PO value
      // is always known from the order itself.
      String(po.grandTotal),
      paid,
      pending,
      summary ? (PO_PAYMENT_STATUS_LABELS[summary.status] ?? summary.status) : 'Not synced',
      summary ? formatDate(summary.syncedAt) : '-',
    ];
  });

  downloadListCSV({ headers: CSV_HEADERS, rows, filename: 'PO_Payments' });
}
