/**
 * RFQ List PDF Generation Service
 *
 * Generates a PDF of the filtered RFQ list using @react-pdf/renderer.
 */

import { pdf } from '@react-pdf/renderer';
import type { RFQ } from '@vapour/types';
import { RFQListPDFDocument } from '@/components/pdf/RFQListPDFDocument';

export async function generateRFQListPDF(rfqs: RFQ[]): Promise<Blob> {
  const pdfDocument = RFQListPDFDocument({ rfqs });
  return pdf(pdfDocument).toBlob();
}

export async function downloadRFQListPDF(rfqs: RFQ[]): Promise<void> {
  const blob = await generateRFQListPDF(rfqs);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RFQs_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
