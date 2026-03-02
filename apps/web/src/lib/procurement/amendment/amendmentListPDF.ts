/**
 * PO Amendment List PDF Generation Service
 *
 * Generates a PDF of the filtered amendment list using @react-pdf/renderer.
 * Follows the same pattern as prListPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { PurchaseOrderAmendment } from '@vapour/types';
import { AmendmentListPDFDocument } from '@/components/pdf/AmendmentListPDFDocument';

export async function generateAmendmentListPDF(
  amendments: PurchaseOrderAmendment[]
): Promise<Blob> {
  const pdfDocument = AmendmentListPDFDocument({ amendments });
  return pdf(pdfDocument).toBlob();
}

export async function downloadAmendmentListPDF(
  amendments: PurchaseOrderAmendment[]
): Promise<void> {
  const blob = await generateAmendmentListPDF(amendments);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PO_Amendments_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
