/**
 * Work Completion Certificate List PDF Generation Service
 */

import type { WorkCompletionCertificate } from '@vapour/types';
import { WCCListPDFDocument } from '@/components/pdf/WCCListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generateWCCListPDF(wccs: WorkCompletionCertificate[]): Promise<Blob> {
  return generatePDFBlob(WCCListPDFDocument({ wccs }));
}

export async function downloadWCCListPDF(wccs: WorkCompletionCertificate[]): Promise<void> {
  const blob = await generateWCCListPDF(wccs);
  downloadBlob(blob, `Work_Completion_Certificates_${new Date().toISOString().slice(0, 10)}.pdf`);
}
