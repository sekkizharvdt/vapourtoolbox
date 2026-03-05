/**
 * Purchase Order PDF Generation Service
 */

import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { POPDFDocument } from '@/components/pdf/POPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generatePOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<Blob> {
  return generatePDFBlob(POPDFDocument({ po, items }));
}

export async function downloadPOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<void> {
  const blob = await generatePOPDF(po, items);
  downloadBlob(blob, `${po.number.replace(/\//g, '-')}.pdf`);
}
