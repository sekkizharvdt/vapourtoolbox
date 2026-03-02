/**
 * Purchase Request List PDF Generation Service
 *
 * Generates a PDF of the filtered PR list using @react-pdf/renderer.
 * Follows the same pattern as poPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { PurchaseRequest } from '@vapour/types';
import { PRListPDFDocument } from '@/components/pdf/PRListPDFDocument';

export async function generatePRListPDF(requests: PurchaseRequest[]): Promise<Blob> {
  const pdfDocument = PRListPDFDocument({ requests });
  return pdf(pdfDocument).toBlob();
}

export async function downloadPRListPDF(requests: PurchaseRequest[]): Promise<void> {
  const blob = await generatePRListPDF(requests);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Purchase_Requests_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
