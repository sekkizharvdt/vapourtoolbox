/**
 * Packing List PDF Generation Service
 *
 * Generates a PDF of the filtered packing list using @react-pdf/renderer.
 */

import { pdf } from '@react-pdf/renderer';
import type { PackingList } from '@vapour/types';
import { PLListPDFDocument } from '@/components/pdf/PLListPDFDocument';

export async function generatePLListPDF(pls: PackingList[]): Promise<Blob> {
  const pdfDocument = PLListPDFDocument({ pls });
  return pdf(pdfDocument).toBlob();
}

export async function downloadPLListPDF(pls: PackingList[]): Promise<void> {
  const blob = await generatePLListPDF(pls);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Packing_Lists_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
