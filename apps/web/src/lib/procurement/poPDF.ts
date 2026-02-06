/**
 * Purchase Order PDF Generation Service
 *
 * Generates PO PDFs using @react-pdf/renderer on the client side.
 * Follows the same pattern as proposalPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { POPDFDocument } from '@/components/pdf/POPDFDocument';

/**
 * Generate PO PDF blob
 */
export async function generatePOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<Blob> {
  const pdfDocument = POPDFDocument({ po, items });
  return pdf(pdfDocument).toBlob();
}

/**
 * Download PO PDF
 */
export async function downloadPOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<void> {
  const blob = await generatePOPDF(po, items);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${po.number.replace(/\//g, '-')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
