/**
 * Purchase Order List PDF Generation Service
 *
 * Generates a PDF of the filtered PO list using @react-pdf/renderer.
 */

import { pdf } from '@react-pdf/renderer';
import type { PurchaseOrder } from '@vapour/types';
import { POListPDFDocument } from '@/components/pdf/POListPDFDocument';

export async function generatePOListPDF(pos: PurchaseOrder[]): Promise<Blob> {
  const pdfDocument = POListPDFDocument({ pos });
  return pdf(pdfDocument).toBlob();
}

export async function downloadPOListPDF(pos: PurchaseOrder[]): Promise<void> {
  const blob = await generatePOListPDF(pos);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Purchase_Orders_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
