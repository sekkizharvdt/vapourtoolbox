/**
 * Work Completion Certificate List PDF Generation Service
 *
 * Generates a PDF of the filtered WCC list using @react-pdf/renderer.
 * Follows the same pattern as prListPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { WorkCompletionCertificate } from '@vapour/types';
import { WCCListPDFDocument } from '@/components/pdf/WCCListPDFDocument';

export async function generateWCCListPDF(wccs: WorkCompletionCertificate[]): Promise<Blob> {
  const pdfDocument = WCCListPDFDocument({ wccs });
  return pdf(pdfDocument).toBlob();
}

export async function downloadWCCListPDF(wccs: WorkCompletionCertificate[]): Promise<void> {
  const blob = await generateWCCListPDF(wccs);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Work_Completion_Certificates_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
