/**
 * Purchase Order List PDF Generation Service
 */

import type { PurchaseOrder } from '@vapour/types';
import { POListPDFDocument } from '@/components/pdf/POListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generatePOListPDF(pos: PurchaseOrder[]): Promise<Blob> {
  return generatePDFBlob(POListPDFDocument({ pos }));
}

export async function downloadPOListPDF(pos: PurchaseOrder[]): Promise<void> {
  const blob = await generatePOListPDF(pos);
  downloadBlob(blob, `Purchase_Orders_${new Date().toISOString().slice(0, 10)}.pdf`);
}
